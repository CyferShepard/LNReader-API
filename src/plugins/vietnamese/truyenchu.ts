import { CheerioAPI, load as parseHTML } from 'npm:cheerio';
import { fetchApi } from '@libs/fetch.ts';
import { Plugin } from '@typings/plugin.ts';
import { NovelStatus } from '@libs/novelStatus.ts';

class TruyenFull implements Plugin.PagePlugin {
  id = 'truyenchu';
  name = 'Truyện Chữ';
  icon = 'src/vi/truyenchu/icon.png';
  site = 'https://truyenchu.vn';
  version = '1.0.0';

  parseNovels(loadedCheerio: CheerioAPI) {
    const novels: Plugin.NovelItem[] = [];
    loadedCheerio('.list-truyen .row').each((idx, ele) => {
      const novelName = loadedCheerio(ele).find('h3.truyen-title > a').text();

      const novelCover =
        this.site +
        loadedCheerio(ele)
          .find("div[data-classname='cover']")
          .attr('data-image');

      const novelUrl = loadedCheerio(ele)
        .find('h3.truyen-title > a')
        .attr('href');
      if (novelUrl) {
        novels.push({
          name: novelName,
          cover: novelCover,
          path: novelUrl.replace(this.site, ''),
        });
      }
    });
    return novels;
  }
  parseChapters(html: string) {
    const listChapterHTML = html.match(
      /("list_chapter":\s?\\{0}"(.+)\\{0}"),/,
    )?.[1];
    if (!listChapterHTML) throw new Error('Không tải được chương');
    const listChapter = JSON.parse(`{${listChapterHTML}}`);
    const loadedChapterList = parseHTML(listChapter.list_chapter);
    const chapters: Plugin.ChapterItem[] = [];
    loadedChapterList('ul > li > a').each((idx, ele) => {
      const path = ele.attribs['href'].replace(this.site, '');
      if (path) {
        chapters.push({
          name: ele.attribs['title'],
          path,
          chapterNumber: Number(path.match(/\/chuong-(\d+)/)?.[1]),
        });
      }
    });
    return chapters;
  }
  async popularNovels(pageNo: number): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}/danh-sach/truyen-hot?page=${pageNo}`;
    const result = await fetchApi(url);
    const body = await result.text();
    const loadedCheerio = parseHTML(body);

    return this.parseNovels(loadedCheerio);
  }
  async parseNovel(
    novelPath: string,
  ): Promise<Plugin.SourceNovel & { totalPages: number }> {
    const url = this.site + novelPath;

    const result = await fetchApi(url);
    const body = await result.text();

    const loadedCheerio = parseHTML(body);
    let lastPage = 1;
    const regex = new RegExp(`${novelPath}\\?page=\\d+`, 'g');
    body.match(regex)?.forEach(v => {
      const page = Number(v.match(/\?page=(\d+)/)?.[1]);
      if (page && page > lastPage) {
        lastPage = page;
      }
    });
    const novel: Plugin.SourceNovel & { totalPages: number } = {
      path: novelPath,
      name: loadedCheerio('div.book > img').attr('alt') || 'Không có tiêu đề',
      chapters: [],
      totalPages: lastPage,
    };

    novel.cover = this.site + loadedCheerio('div.book > img').attr('src');

    novel.summary = loadedCheerio('div.desc-text').text().trim();

    novel.author = loadedCheerio('h3:contains("Tác giả:")')
      .parent()
      .contents()
      .text()
      .replace('Tác giả:', '');

    novel.genres = loadedCheerio('h3:contains("Thể loại")')
      .siblings()
      .map((i, el) => loadedCheerio(el).text())
      .toArray()
      .join(',');

    novel.status = loadedCheerio('h3:contains("Trạng thái")').next().text();
    if (novel.status === 'Full') {
      novel.status = NovelStatus.Completed;
    } else if (novel.status === 'Đang ra') {
      novel.status = NovelStatus.Ongoing;
    } else {
      novel.status = NovelStatus.Unknown;
    }
    novel.chapters = this.parseChapters(body);
    return novel;
  }
  async parsePage(novelPath: string, page: string): Promise<Plugin.SourcePage> {
    const url = `${this.site}${novelPath}?page=${page}`;
    const result = await fetchApi(url);
    const body = await result.text();

    const chapters = this.parseChapters(body);
    return {
      chapters,
    };
  }
  async parseChapter(chapterPath: string): Promise<string> {
    const result = await fetchApi(this.site + chapterPath);
    const body = await result.text();

    const loadedCheerio = parseHTML(body);

    const chapterText =
      (loadedCheerio('.chapter-title').html() || '') +
      (loadedCheerio('#chapter-c').html() || '');

    return chapterText;
  }
  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const searchUrl = `${this.site}/tim-kiem?tukhoa=${searchTerm}&page=${pageNo}`;

    const result = await fetchApi(searchUrl);
    const body = await result.text();

    const loadedCheerio = parseHTML(body);
    return this.parseNovels(loadedCheerio);
  }
}

export default new TruyenFull();
