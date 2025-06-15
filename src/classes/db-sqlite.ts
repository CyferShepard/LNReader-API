import { Chapter } from "../schemas/chapter.ts";
import type { ChapterWithContent } from "../schemas/chaptersWithContent.ts";
import { Favourite } from "../schemas/favourites.ts";
import { FavouriteWithNovelMeta } from "../schemas/favouritesWithNovelMeta.ts";
import { History } from "../schemas/history.ts";
import { NovelMeta } from "../schemas/novel_meta.ts";
import { NovelMetaWithChapters } from "../schemas/novel_metaWithChapters.ts";
import { User } from "../schemas/users.ts";
import { Database } from "jsr:@db/sqlite@0.11";

class DBSqLiteHandler {
  private db: Database | undefined;

  private async initialize() {
    this.db = await new Database("./data/ln-api.db");

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
      url TEXT,
      last_read TEXT,
      page INTEGER,
      position REAL,
      PRIMARY KEY (username, source,  url)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS favourites (
        username TEXT,
        source TEXT,
        url TEXT,
        date_added TEXT,
        PRIMARY KEY (username, source,  url)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS novel_meta (
        source TEXT,
        url TEXT ,
        title TEXT,
        cover TEXT,
        summary TEXT,
        author TEXT,
        status TEXT,
        genres TEXT,
        PRIMARY KEY (source, url)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS chapter_meta (
        source TEXT,
        chapterIndex INTEGER,
        url TEXT ,
        title TEXT,
        novelUrl TEXT,
        PRIMARY KEY (source, url)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS chapters (
        chapterIndex INTEGER,
        title TEXT,
        url TEXT ,
        source TEXT,
        content TEXT,
        PRIMARY KEY (source, url)
      )
    `);

    const users = await this.getAllUser();
    if (users.length === 0) {
      const user = new User("admin", "$2a$10$ZG7ZuVE.MfN9HTPj1GLluegeA.wsVYn75dkv6R5ItVMBwSxnZS7WG", 0);
      await this.insertUser(user);
    }
  }

  //insert

  public async insertNovelMeta(novel: NovelMeta) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "INSERT OR REPLACE INTO novel_meta VALUES (:source,:url,:title,:cover,:summary, :author, :status, :genres)"
    );
    stmt.run({
      source: novel.source,
      url: novel.url,
      title: novel.title,
      cover: novel.cover,
      summary: novel.summary,
      author: novel.author,
      status: novel.status,
      genres: novel.genres.join(","),
    });
  }

  public async insertChapterMeta(chapter: Chapter, novel: NovelMeta) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO chapter_meta VALUES (:source,:chapterIndex,:url,:title,:novelUrl)");
    stmt.run({
      source: novel.source,
      chapterIndex: chapter.index,
      url: chapter.url,
      title: chapter.title,
      novelUrl: novel.url,
    });
  }

  public async insertChapterMetaBulk(chapters: Chapter[], novel: NovelMeta) {
    if (!this.db) {
      await this.initialize();
    }

    const values = chapters.map(() => "(?, ?, ?, ? ,?)").join(", ");
    const stmt = this.db!.prepare(
      `INSERT OR REPLACE INTO chapter_meta (source,chapterIndex, url, title, novelUrl) VALUES ${values}`
    );

    const params = chapters.flatMap((chapter) => [novel.source, chapter.index, chapter.url, chapter.title, novel.url]);

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

    const stmt = this.db!.prepare("INSERT INTO chapters VALUES (:chapterIndex,:title,:url,:source,:content)");
    stmt.run({
      chapterIndex: chapter.index,
      title: chapter.title,
      url: chapter.url,
      source: source,
      content: chapter.content,
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

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO favourites VALUES (:username, :source, :url,:date_added)");
    stmt.run({ username: favourite.username, source: favourite.source, url: favourite.url, date_added: favourite.date_added });
  }

  public async insertHistory(history: History) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "INSERT OR REPLACE INTO history VALUES ( :username, :source, :url, :last_read, :page, :position)"
    );
    stmt.run({
      username: history.username,
      source: history.source,
      url: history.url,
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

    const stmt = this.db!.prepare("SELECT username,userlevel FROM users");
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

  public async updateUserPassword(username: string, newPassword: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("UPDATE users SET password=:password WHERE username=:username");
    stmt.run({ username: username, password: newPassword });
  }

  public async getNovelByUrl(url: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!
      .prepare(`SELECT n.* , (SELECT json_group_array(json_object('source', c.source, 'url', c.url, 'title', c.title, 'novelurl', c.novelurl))
        FROM chapter_meta c 
        WHERE c.novelUrl = n.url) AS chapters FROM novel_meta n WHERE n.url=:url`);
    const result: any = stmt.get({ url: url });

    if (result) {
      return NovelMetaWithChapters.fromResult(result);
    }
  }
  public async getNovelsByUrl(urls: string[]) {
    if (!this.db) {
      await this.initialize();
    }

    const placeholders = urls.map(() => "?").join(",");
    const stmt = this.db!
      .prepare(`SELECT n.* , (SELECT json_group_array(json_object('source', c.source, 'url', c.url, 'title', c.title, 'novelUrl', c.novelUrl))
        FROM chapter_meta c 
        WHERE c.novelUrl = n.url) AS chapters FROM novel_meta n WHERE n.url in (${placeholders})`);
    const result: any = stmt.all(...urls);

    if (result && result.length > 0) {
      return result.map((r: any) => NovelMetaWithChapters.fromResult(r));
    }
  }

  public async getChaptersForNovel(url: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM chapters WHERE url=:url");
    const result = stmt.get({ url: url });

    // if (result) {
    //   const novelResult: NovelMeta = Novel.fromResult(result);

    //   const placeholders = novelResult.chapters.map(() => "?").join(",");

    //   const stmt = this.db!.prepare(`SELECT * FROM chapters WHERE url in (${placeholders})`);
    //   const results = stmt.all(...novelResult.chapters.map((chapter) => chapter.url));

    //   return results.map((result: any) => Chapter.fromResult(result));
    // }
  }

  public async getChapterByUrl(url: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM chapters WHERE url=:url");
    const result: any = stmt.get({ url: url });

    if (result) {
      return Chapter.fromResult(result);
    }
  }

  public async getCachedChapters(url: string, source: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM chapter_meta WHERE source=:source AND novelUrl=:url ORDER BY chapterIndex");
    const results: any = stmt.all({ source: source, url: url });

    if (results && results.length > 0) {
      return results.map((result: any) => Chapter.fromResult(result));
    }
    return [];
  }

  public async getCachedNovel(url: string, source: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM novel_meta WHERE source=:source AND url=:url limit 1");
    const results: any = stmt.all({ source: source, url: url });

    if (results && results.length > 0) {
      return NovelMeta.fromResult(results[0]);
    }
    return null;
  }

  public async getHistory(username: string, url: string | null, novelUrl: string | null) {
    if (!this.db) {
      await this.initialize();
    }

    if (url) {
      const stmt = this.db!.prepare(`
        SELECT lh.*, 
       (SELECT json_object('source', c.source, 'url', c.url, 'title', c.title, 'novelUrl', c.novelUrl)
        FROM chapter_meta c 
        WHERE c.url=:url) AS chapter,
       (SELECT json_object('source', n.source, 'url', n.url, 'title', n.title, 'cover', n.cover, 'summary', n.summary)
        FROM novel_meta n 
        join  chapter_meta c  on n.url=c.novelUrl
        WHERE c.url=:url) AS novel
FROM history lh
where lh.username=:username  and lh.url=:url
ORDER BY lh.last_read DESC
        `);

      const results: any = stmt.get({ username: username, url: url });

      if (results) {
        return History.fromResult(results);
      }

      return null;
    }

    if (novelUrl) {
      const stmt = this.db!.prepare(`
        SELECT lh.*, 
       (SELECT json_object('source', c.source, 'url', c.url, 'title', c.title, 'novelUrl', c.novelUrl)
        FROM chapter_meta c 
        WHERE c.novelUrl=:url and c.url=lh.url) AS chapter,
       (SELECT json_object('source', n.source, 'url', n.url, 'title', n.title, 'cover', n.cover, 'summary', n.summary)
        FROM novel_meta n 
        join  chapter_meta c  on n.url=c.novelUrl
        WHERE c.novelUrl=:url) AS novel
        FROM history lh
       join  chapter_meta c  on lh.url=c.url
        and c.novelUrl=:url
      where lh.username=:username 
      ORDER BY lh.last_read DESC
        `);

      const results: any = stmt.all({ username: username, url: novelUrl });

      if (results) {
        return results.map((result: any) => History.fromResult(result));
      }

      return null;
    }

    const stmt = this.db!.prepare(`WITH latest_history AS (
  SELECT h.*,lh.novelUrl,lh.max_last_read
  FROM history h
  JOIN (
    SELECT c.novelUrl,c.source,  MAX(h.last_read) AS max_last_read, h.url
    FROM history h
    JOIN chapter_meta c ON h.url = c.url
    and h.source=c.source
    where h.username=:username
    GROUP BY c.novelUrl
  ) lh ON h.url = lh.url AND h.source=lh.source AND h.last_read = lh.max_last_read
)
SELECT lh.*, 
       (SELECT json_object('source', c.source, 'url', c.url, 'title', c.title, 'novelUrl', c.novelUrl, 'chapterIndex',c.chapterIndex)
        FROM chapter_meta c 
        WHERE c.url = lh.url) AS chapter,
       (SELECT json_object('source', n.source, 'url', n.url, 'title', n.title, 'cover', n.cover, 'summary', n.summary)
        FROM novel_meta n 
        WHERE n.url = lh.novelUrl) AS novel
FROM latest_history lh
where username=:username
ORDER BY lh.last_read DESC`);
    const results = stmt.all({ username: username });

    return results.map((result: any) => History.fromResult(result));
  }

  public async getFavourites(username: string, url: string | null = null, source: string | null = null) {
    if (!this.db) {
      await this.initialize();
    }

    let statement: string =
      "SELECT f.date_added, nm.*  FROM favourites f JOIN novel_meta nm on nm.source=f.source and nm.url=f.url WHERE username=:username";
    let params: any = { username: username };
    if (url && source) {
      statement += " AND f.url=:url AND f.source=:source";
      params = { username: params.username, url: url, source: source };
    }

    const stmt = this.db!.prepare(statement);

    const results = stmt.all(params);

    const refavouriteWithNovelMeta: FavouriteWithNovelMeta[] = results.map((result: any) =>
      FavouriteWithNovelMeta.fromResult(result)
    );

    return refavouriteWithNovelMeta;
  }
  //delete

  public async deleteHistoryExceptLatest(chapter: Chapter, novel: NovelMeta, username: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(`
      DELETE FROM history 
      WHERE username = :username 
        AND url != :url 
        AND source = :source 
        AND url IN ( SELECT h.url FROM history h
                      JOIN chapter_meta c ON c.url = h.url
                      WHERE c.novelUrl = :novelUrl
                      AND h.username = :username
                      AND h.source = :source
                      AND h.url != :url
          )`);
    stmt.run({ username: username, url: chapter.url, source: novel.source, novelUrl: novel.url });
  }

  public async deleteAllTokens() {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("DELETE FROM tokens");
    stmt.run();
  }

  public async deleteFavourite(url: string, source: string, username: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("DELETE FROM favourites WHERE url=:url AND source=:source AND username=:username");
    stmt.run({ url: url, source: source, username: username });
  }

  public async clearChaptersCache(url: string, source: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "DELETE FROM chapter_meta WHERE novelUrl=:url AND source=:source AND url NOT IN (SELECT url FROM history h WHERE h.source=:source AND h.url=chapter_meta.url)"
    );
    stmt.run({ url: url, source: source });
  }
}

export const dbSqLiteHandler = new DBSqLiteHandler();
