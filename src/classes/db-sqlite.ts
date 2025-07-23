import { Categorties } from "../schemas/categories.ts";
import { Chapter } from "../schemas/chapter.ts";
import { ClientConfig } from "../schemas/client_config.ts";
import { Favourite } from "../schemas/favourites.ts";
import { FavouriteWitChapterMeta } from "../schemas/favouritesWithChapterMeta.ts";
import { FavouriteWithNovelMeta } from "../schemas/favouritesWithNovelMeta.ts";
import { History } from "../schemas/history.ts";
import { ImageCache } from "../schemas/imageCache.ts";
import { NovelMeta } from "../schemas/novel_meta.ts";
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
      CREATE TABLE IF NOT EXISTS favouritesCategories (
        username TEXT,
        source TEXT,
        url TEXT,
        category TEXT,
        PRIMARY KEY (username, source,  url, category)
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
        lastUpdate TEXT,
        additionalProps TEXT,
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
        date_added TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (source, url)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        url TEXT,
        contentType TEXT DEFAULT 'image/jpeg',
        data BLOB,
        PRIMARY KEY (url)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        name TEXT,
        username TEXT,
        position INTEGER DEFAULT 0,
        PRIMARY KEY (name,username)
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

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        client_version TEXT,
        client_type TEXT ,
        PRIMARY KEY (client_type, client_version)
      )
    `);

    const users = await this.getAllUser();

    if (users.length === 0) {
      const user = new User("admin", "$2a$10$ZG7ZuVE.MfN9HTPj1GLluegeA.wsVYn75dkv6R5ItVMBwSxnZS7WG", 0);
      const categories = new Categorties("Favourites", "admin", 0);
      await this.insertUser(user);
      await this.insertCategories(categories);
    }

    const configs = await this.getAllClientConfigs();
    if (configs.length === 0) {
      const config = new ClientConfig("1.0.0", "web");
      await this.insertConfig(config.client_version, config.client_type);
    }
  }

  //insert

  public async insertNovelMeta(novel: NovelMeta) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "INSERT OR REPLACE INTO novel_meta VALUES (:source,:url,:title,:cover,:summary, :author, :status, :genres, :last_updated, :additionalProps)"
    );

    const genres = Array.isArray(novel.genres) ? novel.genres.join(",") : novel.genres || "";
    const summary = Array.isArray(novel.summary) ? novel.summary.join("\n") : novel.summary || "";
    stmt.run({
      source: novel.source,
      url: novel.url,
      title: novel.title,
      cover: novel.cover,
      summary: summary,
      author: novel.author,
      status: novel.status,
      genres: genres,
      last_updated: novel.lastUpdate,
      additionalProps: JSON.stringify(novel.additionalProps || {}),
    });
  }

  public async insertChapterMeta(chapter: Chapter, novel: NovelMeta) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "INSERT OR REPLACE INTO chapter_meta (source,chapterIndex,url, title, novelUrl) VALUES (:source,:chapterIndex,:url,:title,:novelUrl)"
    );
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

    this.insertCategoryLink(favourite.username, favourite.source, favourite.url);
  }

  public async insertCategoryLink(username: string, source: string, url: string, categoryName?: string | null) {
    if (!this.db) {
      this.initialize();
    }

    if (categoryName == null) {
      const categories = await this.getCategories(username);
      if (categories && categories.length > 0) {
        categoryName = categories[0].name;
      } else {
        console.warn("No categories found for user, skipping category link insert.");
        return;
      }
    }

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO favouritesCategories VALUES (:username, :source, :url, :category)");
    stmt.run({ username: username, source: source, url: url, category: categoryName });
  }

  insertCategoryLinkBulk(username: string, source: string, url: string, categories: string[]) {
    if (!this.db) {
      this.initialize();
    }

    if (!categories || categories.length === 0) {
      console.warn("No categories provided for bulk insert, skipping.");
      return;
    }

    this.deleteCategoriesLinkByNovel(username, source, url);

    const values = categories.map(() => "(?, ?, ?, ?)").join(", ");
    const stmt = this.db!.prepare(
      `INSERT OR REPLACE INTO favouritesCategories (username, source, url, category) VALUES ${values}`
    );

    const params = categories.flatMap((category) => [username, source, url, category]);

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

  updateCategoryName(username: string, newName: string, name: string) {
    if (!this.db) {
      this.initialize();
    }

    const stmt = this.db!.prepare("UPDATE categories SET name=:newName WHERE username=:username AND name=:name");
    stmt.run({ username: username, newName: newName, name: name });

    this.updateCategoryLinkName(username, newName, name);
  }

  updateCategoryPosition(username: string, name: string, position: number) {
    if (!this.db) {
      this.initialize();
    }

    const stmt = this.db!.prepare("UPDATE categories SET position=:position WHERE username=:username AND name=:name");
    stmt.run({ username: username, position: position, name: name });
  }

  updateCategoryLinkName(username: string, newCategoryName: string, oldCategoryName: string) {
    if (!this.db) {
      this.initialize();
    }

    const stmt = this.db!.prepare(
      "UPDATE favouritesCategories SET category=:newCategoryName WHERE username=:username AND category=:oldCategoryName"
    );
    stmt.run({
      username: username,

      newCategoryName: newCategoryName,
      oldCategoryName: oldCategoryName,
    });
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

  public async insertHistoryBulk(histories: History[]) {
    if (!this.db) {
      await this.initialize();
    }

    const values = histories.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
    const stmt = this.db!.prepare(
      `INSERT OR REPLACE INTO history (username, source, url, last_read, page, position) VALUES ${values}`
    );

    const params = histories.flatMap((history) => [
      history.username,
      history.source,
      history.url,
      history.last_read,
      history.page,
      history.position,
    ]);

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

  insertImageCache(imageCache: ImageCache) {
    if (!this.db) {
      this.initialize();
    }

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO images (url,contentType, data) VALUES (:url, :contentType, :data)");
    stmt.run({ url: imageCache.url, contentType: imageCache.contentType, data: imageCache.data });
    console.log(`Caching image for URL: ${imageCache.url}`);
  }

  public async insertCategories(categories: Categorties) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO categories VALUES (:name, :username, :position)");
    stmt.run({ name: categories.name, username: categories.username, position: categories.position });
  }

  public async insertCategoriesBulk(categories: Categorties[]) {
    if (!this.db) {
      await this.initialize();
    }

    const values = categories.map(() => "(?, ?, ?)").join(", ");
    const stmt = this.db!.prepare(`INSERT OR REPLACE INTO categories (name, username, position) VALUES ${values}`);

    const params = categories.flatMap((category) => [category.name, category.username, category.position]);

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

  public async insertConfig(client_version: string, client_type: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO config VALUES (:client_version, :client_type)");
    stmt.run({ client_version: client_version, client_type: client_type });
  }

  //select

  public async getAllUser(): Promise<User[]> {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT username,userlevel FROM users");
    const results = stmt.all();

    return results.map((result: Record<string, unknown>) => User.fromResult(result));
  }

  public async getUser(username: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM users WHERE username=:username");
    const result: Record<string, unknown> | undefined = stmt.get({ username: username });

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

  public async getCachedChapters(url: string, source: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM chapter_meta WHERE source=:source AND novelUrl=:url ORDER BY chapterIndex");
    const results: Record<string, unknown>[] | undefined = stmt.all({ source: source, url: url });

    if (results && results.length > 0) {
      return results.map((result: Record<string, unknown>) => Chapter.fromResult(result));
    }
    return [];
  }

  public async getChapterMeta(url: string, source: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM chapter_meta WHERE source=:source AND url=:url LIMIT 1");
    const result: Record<string, unknown> | undefined = stmt.get({ source: source, url: url });

    if (result) {
      return Chapter.fromResult(result);
    }
    return null;
  }

  public async getCachedImage(url: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM images WHERE url=:url LIMIT 1");
    const result: Record<string, unknown> | undefined = stmt.get({ url: url });

    if (result) {
      return ImageCache.fromResult(result);
    }
    return null;
  }

  public async getLastUpdatedChapters(username: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(`
SELECT 
nm.*,
json_object('source',cm.source, 'url', cm.url, 'title', cm.title, 'novelUrl', cm.novelUrl, 'chapterIndex',cm.chapterIndex, 'date_added', cm.date_added) chapter

FROM favourites f
join novel_meta nm
on nm.source =f .source and nm.url=f.url
JOIN chapter_meta cm
on cm.novelUrl=f.url
and cm.source=f.source
and f.username=:username

  order by cm.date_added desc, cm.chapterIndex desc
    `);
    const results: Record<string, unknown>[] | undefined = stmt.all({ username: username });

    if (results && results.length > 0) {
      return results.map((result: Record<string, unknown>) => FavouriteWitChapterMeta.fromResult(result));
    }
    return [];
  }

  public async getCachedNovel(url: string, source: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM novel_meta WHERE source=:source AND url=:url limit 1");
    const results: Record<string, unknown>[] | undefined = stmt.all({ source: source, url: url });

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
        (SELECT json_object('source', c.source, 'url', c.url, 'title', c.title, 'novelUrl', c.novelUrl, 'chapterIndex',c.chapterIndex)
        FROM chapter_meta c 
        WHERE c.url=:url) AS chapter,
       (SELECT json_object('source', n.source, 'url', n.url, 'title', n.title, 'cover', n.cover, 'summary', n.summary, 'author', n.author, 'status', n.status, 'genres', n.genres, 'lastUpdate', n.lastUpdate, 'additionalProps', n.additionalProps)
        FROM novel_meta n 
        join  chapter_meta c  on n.url=c.novelUrl
        WHERE c.url=:url) AS novel
FROM history lh
where lh.username=:username  and lh.url=:url
ORDER BY lh.last_read DESC
        `);

      const results: Record<string, unknown> | undefined = stmt.get({ username: username, url: url });

      if (results) {
        return History.fromResult(results);
      }

      return null;
    }

    if (novelUrl) {
      const stmt = this.db!.prepare(`
        SELECT lh.*, 
         (SELECT json_object('source', c.source, 'url', c.url, 'title', c.title, 'novelUrl', c.novelUrl, 'chapterIndex',c.chapterIndex)
        FROM chapter_meta c 
        WHERE c.novelUrl=:url and c.url=lh.url) AS chapter,
       (SELECT json_object('source', n.source, 'url', n.url, 'title', n.title, 'cover', n.cover, 'summary', n.summary, 'author', n.author, 'status', n.status, 'genres', n.genres, 'lastUpdate', n.lastUpdate, 'additionalProps', n.additionalProps)
        FROM novel_meta n 
        join  chapter_meta c  on n.url=c.novelUrl
        WHERE c.novelUrl=:url) AS novel
        FROM history lh
       join  chapter_meta c  on lh.url=c.url
        and c.novelUrl=:url
      where lh.username=:username 
      ORDER BY lh.last_read DESC
        `);

      const results: Record<string, unknown>[] | undefined = stmt.all({ username: username, url: novelUrl });

      if (results) {
        return results.map((result: Record<string, unknown>) => History.fromResult(result));
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
       (SELECT json_object('source', n.source, 'url', n.url, 'title', n.title, 'cover', n.cover, 'summary', n.summary, 'author',n.author, 'status', n.status, 'genres', n.genres, 'lastUpdate', n.lastUpdate, 'additionalProps', n.additionalProps)
        FROM novel_meta n 
        WHERE n.url = lh.novelUrl) AS novel
FROM latest_history lh
where username=:username
ORDER BY lh.last_read DESC`);
    const results = stmt.all({ username: username });

    return results.map((result: Record<string, unknown>) => History.fromResult(result));
  }

  public async getFavourites(username: string, url: string | null = null, source: string | null = null) {
    if (!this.db) {
      await this.initialize();
    }

    let statement: string = `
    SELECT f.date_added, nm.*,
    (SELECT COUNT(*) FROM chapter_meta cm WHERE cm.novelUrl = f.url AND cm.source = f.source) AS chapterCount,
    (SELECT COUNT(*) FROM history h
     JOIN chapter_meta cm ON h.url = cm.url AND h.source = cm.source
     WHERE h.username = :username AND cm.novelUrl = f.url AND cm.source = f.source
    ) AS readCount ,
       (
        SELECT json_group_array(category)
        FROM favouritesCategories fc
        WHERE fc.username = f.username AND fc.source = f.source AND fc.url = f.url
      ) as categories,
    (
      SELECT date_added
      FROM chapter_meta cm
      WHERE cm.novelUrl = f.url AND cm.source = f.source
      ORDER BY cm.chapterIndex DESC
      LIMIT 1
    ) as chapter_date_added
     
    FROM favourites f 
    JOIN novel_meta nm 
      on nm.source=f.source and nm.url=f.url 

    WHERE f.username=:username`;
    // deno-lint-ignore no-explicit-any
    let params: Record<string, any> = { username: username };
    if (url && source) {
      statement += " AND f.url=:url AND f.source=:source";
      params = { username: params.username, url: url, source: source };
    }
    // console.log("getFavourites statement: ", statement, params);

    const stmt = this.db!.prepare(statement);

    const results = stmt.all(params);

    const refavouriteWithNovelMeta: FavouriteWithNovelMeta[] = results.map((result: Record<string, unknown>) =>
      FavouriteWithNovelMeta.fromResult(result)
    );

    return refavouriteWithNovelMeta;
  }

  public async getAllUniqueFavourites() {
    if (!this.db) {
      await this.initialize();
    }

    const statement: string = "SELECT * FROM favourites GROUP BY source, url";

    const stmt = this.db!.prepare(statement);

    const results = stmt.all();

    const refavourites: Favourite[] = results.map((result: Record<string, unknown>) => Favourite.fromResult(result));

    return refavourites;
  }

  public async getCategories(username: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM categories WHERE username=:username ORDER BY position");
    const results: Record<string, unknown>[] | undefined = stmt.all({ username: username });

    return results.map((result: Record<string, unknown>) => Categorties.fromResult(result));
  }

  public async getCategoriesLinkByNovel(username: string, source: string, url: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM favouritesCategories WHERE username=:username AND source=:source AND url=:url");
    const results: Record<string, unknown>[] | undefined = stmt.all({ username: username, source: source, url: url });

    return results.map((result: Record<string, unknown>) => Categorties.fromResult(result));
  }

  public async getClientConfig(client_type: string) {
    if (!this.db) {
      await this.initialize();
    }

    const statement = "SELECT * FROM config WHERE client_type=:client_type";
    const params: Record<string, string> = { client_type: client_type };

    const stmt = this.db!.prepare(statement);
    const result: Record<string, unknown> | Record<string, unknown>[] | undefined = stmt.get(params);

    if (result) {
      return ClientConfig.fromJSON(result);
    }
    return null;
  }

  public async getAllClientConfigs() {
    if (!this.db) {
      await this.initialize();
    }

    const statement = "SELECT * FROM config";

    const stmt = this.db!.prepare(statement);
    const result: Record<string, unknown>[] | undefined = stmt.all();

    return ClientConfig.fromJSONList(result);
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

  public async deleteFavourite(url: string, source: string, username: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("DELETE FROM favourites WHERE url=:url AND source=:source AND username=:username");
    stmt.run({ url: url, source: source, username: username });

    await this.deleteCategoriesLinkByNovel(username, source, url);
  }

  public async deleteNovelMeta(url: string, source: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("DELETE FROM novel_meta WHERE url=:url AND source=:source");
    stmt.run({ url: url, source: source });
  }

  public async deleteChapterMeta(url: string, source: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("DELETE FROM chapter_meta WHERE url=:url AND source=:source");
    stmt.run({ url: url, source: source });
  }
  public async deleteChapterMetaForNovel(url: string, source: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("DELETE FROM chapter_meta WHERE novelUrl=:url AND source=:source");
    stmt.run({ url: url, source: source });
  }

  //below actualy only clears the cache thats not in history
  public async clearChaptersCache(url: string, source: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "DELETE FROM chapter_meta WHERE novelUrl=:url AND source=:source AND url NOT IN (SELECT url FROM history h WHERE h.source=:source AND h.url=chapter_meta.url)"
    );
    stmt.run({ url: url, source: source });
  }

  public async deleteHistory(url: string, source: string, username: string) {
    if (!this.db) {
      await this.initialize();
    }
    try {
      const stmt = this.db!.prepare("DELETE FROM history WHERE url=:url AND source=:source AND username=:username");
      stmt.run({ url: url, source: source, username: username });
      return true;
    } catch (error) {
      console.error("Error deleting history:", error);
      return false;
    }
  }

  public async deleteHistoryForNovelByUser(url: string, source: string, username: string) {
    if (!this.db) {
      await this.initialize();
    }

    const selectStmt = this.db!.prepare(`
        SELECT c.*
        FROM chapter_meta c
        join  history lh  on lh.url=c.url
        and c.novelUrl=:url
          and c.source=:source
        and lh.username=:username 
        ORDER BY lh.last_read DESC
        `);

    const results: Record<string, unknown>[] | undefined = selectStmt.all({ username: username, url: url, source: source });
    const chapterMeta = results.map((result: Record<string, unknown>) => Chapter.fromResult(result));

    if (chapterMeta.length > 0) {
      const urls = chapterMeta.map((chapter: Chapter) => chapter.url);
      // Prepare placeholders for the IN clause
      const placeholders = urls.map(() => "?").join(", ");
      const deleteStmt = this.db!.prepare(
        `DELETE FROM history WHERE url IN (${placeholders}) AND source=:source AND username=:username`
      );
      deleteStmt.run(...urls, { source: source, username: username });
    }
  }

  public async deleteHistoryForNovel(url: string, source: string) {
    if (!this.db) {
      await this.initialize();
    }

    const selectStmt = this.db!.prepare(`
        SELECT c.*
        FROM chapter_meta c
        join  history lh  on lh.url=c.url
        and c.novelUrl=:url
        and c.source=:source
        ORDER BY lh.last_read DESC
        `);

    const results: Record<string, unknown>[] | undefined = selectStmt.all({ url: url, source: source });
    const chapterMeta = results.map((result: Record<string, unknown>) => Chapter.fromResult(result));

    if (chapterMeta.length > 0) {
      const urls = chapterMeta.map((chapter: Chapter) => chapter.url);
      // Prepare placeholders for the IN clause
      const placeholders = urls.map(() => "?").join(", ");
      const deleteStmt = this.db!.prepare(`DELETE FROM history WHERE url IN (${placeholders}) AND source=:source`);
      deleteStmt.run(...urls, { source: source });
    }
  }

  public async deleteImageCache(url: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("DELETE FROM images WHERE url=:url");
    stmt.run({ url: url });
  }

  public async deleteCategories(name: string, username: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("DELETE FROM categories WHERE name=:name AND username=:username");
    stmt.run({ name: name, username: username });
  }

  public async deleteCategoryLink(username: string, source: string, url: string, categoryName: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "DELETE FROM favouritesCategories WHERE username=:username AND source=:source AND url=:url AND category=:category"
    );
    stmt.run({ username: username, source: source, url: url, category: categoryName });
  }

  public async deleteCategoryLinkBulk(username: string, source: string, url: string, categories: string[]) {
    if (!this.db) {
      await this.initialize();
    }

    const values = categories.map(() => "(?, ?, ?, ?)").join(", ");
    const stmt = this.db!.prepare(
      `DELETE FROM favouritesCategories WHERE username=:username AND source=:source AND url=:url AND category IN (${values})`
    );

    const params = categories.flatMap((category) => [username, source, url, category]);

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

  public async deleteCategoriesLinkByNovel(username: string, source: string, url: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("DELETE FROM favouritesCategories WHERE username=:username AND source=:source AND url=:url");
    stmt.run({ username: username, source: source, url: url });
  }
}

export const dbSqLiteHandler = new DBSqLiteHandler();
