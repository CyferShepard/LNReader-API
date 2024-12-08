import { Chapter } from "../schemas/chapters.ts";
import { Favourite } from "../schemas/favourites.ts";
import { History } from "../schemas/history.ts";
import { Novel } from "../schemas/novels.ts";
import { User } from "../schemas/users.ts";
import { Database } from "jsr:@db/sqlite@0.11";

class DBSqLiteHandler {
  private db: Database | undefined;

  private async initialize() {
    this.db = await new Database("ln-api.db");

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT,
        userlevel INTEGER DEFAULT 1
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS tokens (
        token TEXT UNIQUE PRIMARY KEY ,
        user TEXT
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS history (
      user TEXT,
      path TEXT,
      last_read TEXT,
      page INTEGER,
      position INTEGER,
      PRIMARY KEY (user, path)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS favourites (
        path TEXT  PRIMARY KEY,
        user TEXT,
        date_added TEXT,
        cover TEXT
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS novels (
        source TEXT,
        name TEXT,
        path TEXT ,
        cover TEXT,
        summary TEXT,
        chapters TEXT,
        PRIMARY KEY (source, path)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS chapters (
        path TEXT PRIMARY KEY,
        name TEXT,
        content TEXT
      )
    `);

    const users = await this.getAllUser();
    if (users.length === 0) {
      const user = new User("admin", "admin", 0);
      await this.insertUser(user);
    }
  }

  //insert

  public async insertChapter(chapter: Chapter) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT INTO chapters VALUES (:path,:name,:content)");
    stmt.run({ path: chapter.path, name: chapter.name, content: chapter.content });
  }

  public async insertNovel(novel: Novel) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT INTO novels VALUES (:source,:name,:path,:cover,:summary,:chapters)");

    stmt.run({
      source: novel.source,
      name: novel.name,
      path: novel.path,
      cover: novel.cover,
      summary: novel.summary,
      chapters: JSON.stringify(novel.chapters),
    });
  }

  public async insertUser(user: User) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO users VALUES (:username,:password,:userlevel)");
    stmt.run({ username: user.username, password: user.password, userlevel: user.userlevel });
  }

  public async insertFavourite(favourite: Favourite) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO favourites VALUES (:username,:path. :cover,:date_added)");
    stmt.run({ username: favourite.username, path: favourite.path, cover: favourite.cover, date_added: favourite.date_added });
  }

  public async insertHistory(history: History) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO history VALUES (:username,:path,:last_read,:page,:position)");
    stmt.run({
      username: history.username,
      path: history.path,
      last_read: history.last_read,
      page: history.page,
      position: history.position,
    });
  }

  public async insertToken(token: string, user: User) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO tokens VALUES (:token,:user)");
    stmt.run({ token: token, user: JSON.stringify(user.toJSON()) });
  }

  //select

  public async getUserByToken(token: string): Promise<User | null> {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM tokens WHERE token=:token");
    const result = stmt.get({ token: token });

    if (result) {
      return User.fromResult(JSON.parse(result.user as string));
    }
    return null;
  }

  public async getAllUser(): Promise<User[]> {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM users");
    const results = stmt.all();

    return results.map((result: any) => User.fromResult(result));
  }

  public async getUser(username: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM users WHERE username=:username");
    const result: any = stmt.get({ username: username });

    if (result) {
      return User.fromResult(result);
    }
  }

  public async getChaptersForNovel(path: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM novels WHERE path=:path");
    const result = stmt.get({ path: path });

    if (result) {
      const novelResult: Novel = Novel.fromResult(result);

      const placeholders = novelResult.chapters.map(() => "?").join(",");

      const stmt = this.db!.prepare(`SELECT * FROM chapters WHERE path in (${placeholders})`);
      const results = stmt.all(...novelResult.chapters);

      return results.map((result: any) => Chapter.fromResult(result));
    }
  }

  public async getChapterByPath(path: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM chapters WHERE path=:path");
    const result: any = stmt.get({ path: path });

    if (result) {
      return Chapter.fromResult(result);
    }
  }

  // public async getAllTokens() {
  //   if (!this.kv) {
  //     await this.initialize();
  //   }
  //   const entries = this.kv!.list({ prefix: ["tokens"] });

  //   for await (const entry of entries) {
  //     //   console.log(entry);
  //   }
  // }

  public async getHistory(username: string, path: string | null) {
    if (!this.db) {
      await this.initialize();
    }

    if (path) {
      const stmt = this.db!.prepare("SELECT * FROM history WHERE user=:username AND path=:path");
      const result: any = stmt.get({ username: username, path: path });

      if (result) {
        return History.fromResult(result);
      }

      return null;
    }

    const stmt = this.db!.prepare("SELECT * FROM history WHERE user=:username");
    const results = stmt.all({ username: username });

    return results.map((result: any) => History.fromResult(result));
  }

  public async getFavourites(username: string, path: string | null) {
    if (!this.db) {
      await this.initialize();
    }

    if (path) {
      const stmt = this.db!.prepare("SELECT * FROM favourites WHERE user=:username AND path=:path");
      const result: any = stmt.get({ username: username, path: path });

      if (result) {
        return Favourite.fromResult(result);
      }

      return null;
    }

    const stmt = this.db!.prepare("SELECT * FROM favourites WHERE user=:username");
    const results = stmt.all({ username: username });

    return results.map((result: any) => Favourite.fromResult(result));
  }
  //delete

  public async deleteToken(token: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("DELETE FROM tokens WHERE token=:token");
    stmt.run({ token: token });
  }

  public async deleteAllTokens() {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("DELETE FROM tokens");
    stmt.run();
  }
}

export const dbSqLiteHandler = new DBSqLiteHandler();
