import { Chapter } from "../schemas/chapters.ts";
import type { ChapterWithContent } from "../schemas/chaptersWithContent.ts";
import { Favourite } from "../schemas/favourites.ts";
import { History } from "../schemas/history.ts";
import { NovelMeta } from "../schemas/novel_meta.ts";
import { NovelMetaWithChapters } from "../schemas/novel_metaWithChapters.ts";
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
      username TEXT,
      source TEXT,
      path TEXT,
      last_read TEXT,
      page INTEGER,
      position INTEGER,
      PRIMARY KEY (username, source,  path)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS favourites (
        username TEXT,
        source TEXT,
        path TEXT,
        date_added TEXT,
        PRIMARY KEY (username, source,  path)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS novel_meta (
        source TEXT,
        path TEXT ,
        name TEXT,
        cover TEXT,
        summary TEXT,
        PRIMARY KEY (source, path)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS chapter_meta (
        source TEXT,
        path TEXT ,
        name TEXT,
        novelPath TEXT,
        PRIMARY KEY (source, path)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS chapters (
        name TEXT,
        path TEXT ,
        source TEXT,
        content TEXT,
        PRIMARY KEY (source, path)
      )
    `);

    const users = await this.getAllUser();
    if (users.length === 0) {
      const user = new User("admin", "admin", 0);
      await this.insertUser(user);
    }
  }

  //insert

  public async insertNovelMeta(novel: NovelMeta) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO novel_meta VALUES (:source,:path,:name,:cover,:summary)");
    stmt.run({ source: novel.source, path: novel.path, name: novel.name, cover: novel.cover, summary: novel.summary });
  }

  public async insertChapterMeta(chapter: Chapter, novel: NovelMeta) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO chapter_meta VALUES (:source,:path,:name,:novelPath)");
    stmt.run({ source: novel.source, path: chapter.path, name: chapter.name, novelPath: novel.path });
  }

  public async insertChapterMetaBulk(chapters: Chapter[], novel: NovelMeta) {
    if (!this.db) {
      await this.initialize();
    }

    const values = chapters.map(() => "(?, ?, ?, ?)").join(", ");
    const stmt = this.db!.prepare(`INSERT OR REPLACE INTO chapter_meta (source, path, name, novelPath) VALUES ${values}`);

    const params = chapters.flatMap((chapter) => [novel.source, chapter.path, chapter.name, novel.path]);

    try {
      this.db!.exec("BEGIN TRANSACTION");
      stmt.run(...params);
      this.db!.exec("COMMIT");
    } catch (error) {
      this.db!.exec("ROLLBACK");
      throw error;
    } finally {
      stmt.finalize();
    }
  }

  public async insertChapter(chapter: ChapterWithContent, source: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT INTO chapters VALUES (:name,:path,:source,:content)");
    stmt.run({ name: chapter.name, path: chapter.path, source: source, content: chapter.content });
  }

  // public async insertNovel(novel: Novel) {
  //   if (!this.db) {
  //     await this.initialize();
  //   }

  //   const stmt = this.db!.prepare("INSERT OR REPLACE INTO novels VALUES (:source,:name,:path,:cover,:summary,:chapters)");

  //   stmt.run({
  //     source: novel.source,
  //     name: novel.name,
  //     path: novel.path,
  //     cover: novel.cover,
  //     summary: novel.summary,
  //     chapters: JSON.stringify(novel.chapters),
  //   });
  // }

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

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO favourites VALUES (:username, :source, :path,:date_added)");
    stmt.run({ username: favourite.username, source: favourite.source, path: favourite.path, date_added: favourite.date_added });
  }

  public async insertHistory(history: History) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "INSERT OR REPLACE INTO history VALUES ( :username, :source, :path, :last_read, :page, :position)"
    );
    stmt.run({
      username: history.username,
      source: history.source,
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

  public async getNovelByPath(path: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!
      .prepare(`SELECT n.* , (SELECT json_group_array(json_object('source', c.source, 'path', c.path, 'name', c.name, 'novelPath', c.novelPath))
        FROM chapter_meta c 
        WHERE c.novelPath = n.path) AS chapters FROM novel_meta n WHERE n.path=:path`);
    const result: any = stmt.get({ path: path });

    if (result) {
      return NovelMetaWithChapters.fromResult(result);
    }
  }
  public async getNovelsByPath(path: string[]) {
    if (!this.db) {
      await this.initialize();
    }

    const placeholders = path.map(() => "?").join(",");
    const stmt = this.db!
      .prepare(`SELECT n.* , (SELECT json_group_array(json_object('source', c.source, 'path', c.path, 'name', c.name, 'novelPath', c.novelPath))
        FROM chapter_meta c 
        WHERE c.novelPath = n.path) AS chapters FROM novel_meta n WHERE n.path in (${placeholders})`);
    const result: any = stmt.all(...path);

    if (result && result.length > 0) {
      return result.map((r: any) => NovelMetaWithChapters.fromResult(r));
    }
  }

  public async getChaptersForNovel(path: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM chapters WHERE path=:path");
    const result = stmt.get({ path: path });

    // if (result) {
    //   const novelResult: NovelMeta = Novel.fromResult(result);

    //   const placeholders = novelResult.chapters.map(() => "?").join(",");

    //   const stmt = this.db!.prepare(`SELECT * FROM chapters WHERE path in (${placeholders})`);
    //   const results = stmt.all(...novelResult.chapters.map((chapter) => chapter.path));

    //   return results.map((result: any) => Chapter.fromResult(result));
    // }
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
      const stmt = this.db!.prepare(`SELECT h.*, 
        (SELECT json_group_array(json_object('source', c.source, 'path', c.path, 'name', c.name, 'novelPath', c.novelPath))
        FROM chapter_meta c 
        WHERE c.path = h.path) chapter
        FROM history h WHERE h.username=:username AND h.path=:path`);
      const result: any = stmt.get({ username: username, path: path });

      if (result) {
        return History.fromResult(result);
      }

      return null;
    }

    const stmt = this.db!.prepare(`WITH latest_history AS (
  SELECT h.*,lh.novelPath,lh.max_last_read
  FROM history h
  JOIN (
    SELECT c.novelPath, MAX(h.last_read) AS max_last_read, h.path
    FROM history h
    JOIN chapter_meta c ON h.path = c.path
    GROUP BY c.novelPath
  ) lh ON h.path = lh.path AND h.last_read = lh.max_last_read
)
SELECT lh.*, 
       (SELECT json_object('source', c.source, 'path', c.path, 'name', c.name, 'novelPath', c.novelPath)
        FROM chapter_meta c 
        WHERE c.path = lh.path) AS chapter,
       (SELECT json_object('source', n.source, 'path', n.path, 'name', n.name, 'cover', n.cover, 'summary', n.summary)
        FROM novel_meta n 
        WHERE n.path = lh.novelPath) AS novel
FROM latest_history lh
where username=:username
ORDER BY lh.last_read DESC`);
    const results = stmt.all({ username: username });

    return results.map((result: any) => History.fromResult(result));
  }

  public async getFavourites(username: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM favourites WHERE username=:username");
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

  public async deleteFavourite(path: string, username: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("DELETE FROM favourites WHERE path=:path AND username=:username");
    stmt.run({ path: path, username: username });
  }
}

export const dbSqLiteHandler = new DBSqLiteHandler();
