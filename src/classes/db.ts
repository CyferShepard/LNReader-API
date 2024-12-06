import { Chapter } from "../schemas/chapters.ts";
import { Favourite } from "../schemas/favourites.ts";
import { History } from "../schemas/history.ts";
import { Novel } from "../schemas/novels.ts";
import { User } from "../schemas/users.ts";

class DBHandler {
  private kv: any | undefined;

  private async initialize() {
    this.kv = await Deno.openKv();

    const users = await this.getAllUser();
    if (users.length === 0) {
      const user = new User("admin", "admin", 0);
      await this.insertUser(user);
    }
  }

  //insert

  public async insertChapter(chapter: Chapter) {
    if (!this.kv) {
      await this.initialize();
    }
    await this.kv!.set(["chapters", chapter.path], chapter.toJSON());
  }

  public async insertNovel(novel: Novel) {
    if (!this.kv) {
      await this.initialize();
    }
    await this.kv!.set(["novels", novel.path], novel.toJSON());
  }

  public async insertUser(user: User) {
    if (!this.kv) {
      await this.initialize();
    }
    await this.kv!.set(["users", user.username], user.toJSON());
  }

  public async insertFavourite(favourite: Favourite) {
    if (!this.kv) {
      await this.initialize();
    }
    await this.kv!.set(["favourites", favourite.username, favourite.path], favourite.toJSON());
  }

  public async insertHistory(history: History) {
    if (!this.kv) {
      await this.initialize();
    }
    const key = ["history", history.username];
    if (history.path) {
      key.push(history.path);
    }
    await this.kv!.set(key, history.toJSON());
  }

  public async insertToken(token: string, user: User) {
    if (!this.kv) {
      await this.initialize();
    }
    await this.kv!.set(["tokens", token], user.toJSON());
  }

  //select

  public async getUserByToken(token: string): Promise<User | null> {
    if (!this.kv) {
      await this.initialize();
    }
    const entry = await this.kv!.get(["tokens", token]);

    if (entry.value) {
      return User.fromJSON(entry.value);
    }
    return null;
  }

  public async getAllUser(): Promise<User[]> {
    if (!this.kv) {
      await this.initialize();
    }
    const entries = this.kv!.list({ prefix: ["users"] });
    const users: User[] = [];

    for await (const entry of entries) {
      if (entry.value) {
        users.push(User.fromJSON(entry.value as string));
      }
    }
    return users;
  }

  public async getUser(username: string) {
    if (!this.kv) {
      await this.initialize();
    }
    const entry = await this.kv!.get(["users", username]);
    if (entry.value) {
      const userResult: User = User.fromJSON(entry.value as string);
      return userResult;
    }
  }

  public async getChaptersForNovel(path: string) {
    if (!this.kv) {
      await this.initialize();
    }
    const chapters = [];

    const novel = await this.kv!.get(["novels", path]);
    if (novel.value) {
      const novelResult: Novel = Novel.fromJSON(novel.value as string);

      const chapterResult: any[] = await this.kv!.getMany(novelResult.chapters.map((chapterPath) => ["chapters", chapterPath]));
      for (const chapterPath of chapterResult) {
        if (chapterPath.value) {
          const chapterResult: Chapter = Chapter.fromJSON(chapterPath.value as string);
          chapters.push(chapterResult);
        }
      }

      return chapters;
    }
  }

  public async getChapterByPath(path: string) {
    if (!this.kv) {
      await this.initialize();
    }
    const entry = await this.kv!.get(["chapters", path]);
    if (entry.value) {
      const chapterResult: Chapter = Chapter.fromJSON(entry.value as string);
      return chapterResult;
    }
  }

  public async getAllTokens() {
    if (!this.kv) {
      await this.initialize();
    }
    const entries = this.kv!.list({ prefix: ["tokens"] });

    for await (const entry of entries) {
      //   console.log(entry);
    }
  }

  public async getHistory(username: string, path: string | null) {
    if (!this.kv) {
      await this.initialize();
    }
    const key = ["history", username];
    if (path) {
      key.push(path);
    }
    const results: History[] = [];
    const entries = await this.kv!.list({ prefix: key });
    for await (const entry of entries) {
      if (entry.value) {
        const result: History = History.fromJSON(entry.value as string);
        results.push(result);
      }
    }
    return results;
  }

  public async getFavourites(username: string, path: string | null) {
    if (!this.kv) {
      await this.initialize();
    }
    const key = ["favourites", username];
    if (path) {
      key.push(path);
    }

    const results: Favourite[] = [];
    const entries = await this.kv!.list({ prefix: key });
    for await (const entry of entries) {
      if (entry.value) {
        const result: Favourite = Favourite.fromJSON(entry.value as string);
        results.push(result);
      }
    }
    return results;
  }
  //delete

  public async deleteToken(token: string) {
    if (!this.kv) {
      await this.initialize();
    }
    await this.kv!.delete(["Tokens", token]);
  }

  public async deleteAllTokens() {
    if (!this.kv) {
      await this.initialize();
    }
    const tokens = this.kv!.list({ prefix: ["tokens"] });
    for await (const token of tokens) {
      console.log(token);
      await this.kv!.delete(["tokens", token.key[1]]);
    }
  }
}

export const dbHandler = new DBHandler();
