import { load, CheerioAPI } from 'npm:cheerio';
import { fetchApi } from '@libs/fetch.ts';
import { Plugin } from '@typings/plugin.ts';
import { NovelStatus } from '@libs/novelStatus.ts';
import { Filters, FilterTypes } from '@libs/filterInputs.ts';
import { defaultCover } from '@libs/defaultCover.ts';
import dayjs from 'npm:dayjs';

class NovelDeGlacePlugin implements Plugin.PluginBase {
  id = 'noveldeglace';
  name = 'NovelDeGlace';
  icon = 'src/fr/noveldeglace/icon.png';
  site = 'https://noveldeglace.com/';
  version = '1.0.3';

  async getCheerio(url: string): Promise<CheerioAPI | undefined> {
    const r = await fetchApi(url, {
      headers: { 'Accept-Encoding': 'deflate' },
    });
    if (!r.ok) return undefined;
    const body = await r.text();
    const loadedCheerio = load(body);
    return loadedCheerio;
  }

  parseDate(date: string): string {
    const monthMapping: Record<string, number> = {
      janvier: 1,
      fevrier: 2,
      mars: 3,
      avril: 4,
      mai: 5,
      juin: 6,
      juillet: 7,
      aout: 8,
      septembre: 9,
      octobre: 10,
      novembre: 11,
      decembre: 12,
    };

    const [day, month, year] = date.split(' ');
    return dayjs(
      `${day} ${monthMapping[month.normalize('NFD').replace(/[\u0300-\u036f]/g, '')]} ${year}`,
      'D MMMM YYYY',
    ).format('DD MMMM YYYY');
  }

  parseNovels(
    $: CheerioAPI,
    showLatestNovels: boolean | undefined,
  ): Plugin.NovelItem[] {
    const novels: Plugin.NovelItem[] = [];

    $('article').each((i, el) => {
      const cheerio = $(el);
      const novelName = cheerio.find('h2').text().trim();
      const novelCover = cheerio.find('img').attr('src');
      let novelUrl: string | undefined;
      if (showLatestNovels)
        novelUrl = cheerio.find('span.Roman > a').attr('href');
      else novelUrl = cheerio.find('h2 > a').attr('href');

      if (novelUrl) {
        const novel: Plugin.NovelItem = {
          name: novelName,
          path: novelUrl.replace(this.site, ''),
          cover: novelCover,
        };
        novels.push(novel);
      }
    });

    return novels;
  }

  async popularNovels(
    pageNo: number,
    {
      filters,
      showLatestNovels,
    }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    let url = this.site;
    if (showLatestNovels) url += 'chapitre';
    else {
      let cat_gen = 'all';
      if (filters && typeof filters.categorie_genre.value == 'string')
        cat_gen = filters.categorie_genre.value;
      if (
        cat_gen != 'all' &&
        cat_gen != 'categorie_roman' &&
        cat_gen != 'genre'
      ) {
        if (cat_gen[0] == 'c') url += 'categorie_roman/' + cat_gen.substring(2);
        else if (cat_gen[0] == 'g') url += 'genre/' + cat_gen.substring(2);
      } else if (pageNo > 1)
        return []; // when asking for all novels, there is only 1 page
      else url += 'roman';
    }
    url += '/page/' + pageNo;
    const $ = await this.getCheerio(url);
    if (!$) return [];
    return this.parseNovels($, showLatestNovels);
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const $ = await this.getCheerio(this.site + novelPath);
    if (!$) throw new Error('Failed to load page (open in web view)');

    const novel: Plugin.SourceNovel = { path: novelPath, name: 'Untitled' };

    novel.name =
      (
        $('div.entry-content > div > strong')[0].nextSibling as string | null
      )?.nodeValue?.trim() || 'Untitled';

    novel.cover = $('.su-row > div > div > img').attr('src') || defaultCover;

    const novelInfos = $('div[data-title=Tomes] >').toArray();
    novelInfos.pop();
    novelInfos.shift();
    novel.summary =
      $('div[data-title=Synopsis]').text().trim() +
      '\n\n' +
      novelInfos
        .map(el => $(el).text())
        .join('\n')
        .trim();

    novel.author = $("strong:contains('Auteur :')")
      .parent()
      .text()
      .replace('Auteur : ', '')
      .trim();

    novel.artist = $("strong:contains('Illustrateur :')")
      .parent()
      .text()
      .replace('Illustrateur :', '')
      .trim();

    const categorie = $('.categorie').text().replace('Catégorie :', '').trim();
    const genres = $('.genre')
      .text()
      .replace('Genre :', '')
      .replace(/, /g, ',')
      .trim();
    if (categorie && categorie != 'Autre') novel.genres = categorie;
    if (genres)
      novel.genres = novel.genres ? novel.genres + ',' + genres : genres;

    const status = $("strong:contains('Statut :')").parent().attr('class');
    switch (status) {
      case 'type etat0':
      case 'type etat1':
        novel.status = NovelStatus.Ongoing;
        break;
      case 'type etat4':
        novel.status = NovelStatus.OnHiatus;
        break;
      case 'type etat5':
        novel.status = NovelStatus.Completed;
        break;
      case 'type etat6':
        novel.status = NovelStatus.Cancelled;
        break;
      default:
        novel.status = NovelStatus.Unknown;
        break;
    }

    const novelChapters: Plugin.ChapterItem[] = [];

    const volumes = $('div[data-title=Tomes] > div').last().contents();
    const hasMultipleVolumes = volumes.length > 1;

    let chapterName = '';
    const site = this.site;
    volumes.each((volumeIndex: number, el) => {
      if (hasMultipleVolumes) chapterName = 'T.' + (volumeIndex + 1) + ' ';
      $(el)
        .find('.chpt')
        .each((chapterIndex: number, el) => {
          const cheerio = $(el);
          const newChapterName =
            chapterName + cheerio.find('a').first().text().trim() || '';
          if (!cheerio.find('i.fa').length) {
            // no parts
            const dateHtml =
              cheerio.html()?.substring(cheerio.html()?.indexOf('</a>') || 0) ||
              '';
            const releaseDate =
              dateHtml?.substring(
                dateHtml.indexOf('(') + 1,
                dateHtml.indexOf(')'),
              ) || undefined;
            const chapterUrl = cheerio.find('a').attr('href');
            if (chapterUrl) {
              const chapter: Plugin.ChapterItem = {
                name: newChapterName,
                releaseTime: this.parseDate(releaseDate),
                path: chapterUrl.replace(site, ''),
                chapterNumber: chapterIndex,
              };

              novelChapters.push(chapter);
            }
          } // has parts that needs to be added individually
          else {
            const items =
              cheerio.find('i').parent().next().html()?.split('</a>') || [];
            items?.shift();
            const dates: string[] = [];
            items?.forEach(item => {
              // there is a date on every publish parts
              dates.push(
                item.substring(item.indexOf('(') + 1, item.indexOf(')')),
              );
            });
            const hrefs: string[] = [];
            cheerio
              .find('i')
              .parent()
              .next()
              .find('a')
              .each(function () {
                hrefs.push(this['attribs']['href']);
              });
            if (dates.length == hrefs.length)
              dates.forEach((date, index) => {
                const chapter: Plugin.ChapterItem = {
                  name: newChapterName + ' (' + (index + 1) + ')',
                  releaseTime: this.parseDate(date),
                  path: hrefs[index].replace(site, ''),
                  chapterNumber: chapterIndex + (index + 1) / 1000,
                };
                novelChapters.push(chapter);
              });
          }
        });
    });

    novel.chapters = novelChapters;

    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const $ = await this.getCheerio(this.site + chapterPath);
    if (!$) throw new Error('Failed to load page (open in web view)');

    $('.mistape_caption').remove();
    const chapterText =
      $('.chapter-content').html() || $('.entry-content').html() || '';
    return chapterText;
  }

  async searchNovels(
    searchTerm: string,
    num: number,
  ): Promise<Plugin.NovelItem[]> {
    if (num !== 1) return []; // only 1 page of results
    const url = this.site + 'roman';
    const $ = await this.getCheerio(url);
    if (!$) throw new Error('Failed to load page (open in web view)');

    let novels = this.parseNovels($, false);

    novels = novels.filter(novel =>
      novel.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .includes(
          searchTerm
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim(),
        ),
    );

    return novels;
  }

  filters = {
    categorie_genre: {
      type: FilterTypes.Picker,
      label: 'Catégorie/Genre',
      value: 'all',
      options: [
        { label: 'Tous', value: 'all' },
        { label: '═══CATÉGORIES═══', value: 'categorie_roman' },
        { label: 'Seinen', value: 'c_seinen' },
        { label: 'Shonen', value: 'c_shonen' },
        { label: 'Original', value: 'c_original' },
        { label: 'Yuri', value: 'c_yuri' },
        { label: 'Autre', value: 'c_autre' },
        { label: 'Fille', value: 'c_fille' },
        { label: 'Roman pour Adulte', value: 'c_roman-pour-adulte' },
        { label: 'Xuanhuan', value: 'c_xuanhuan' },
        { label: 'Yaoi', value: 'c_yaoi' },
        { label: '═══GENRES═══', value: 'genre' },
        { label: 'Action', value: 'g_action' },
        { label: 'Aventure', value: 'g_aventure' },
        { label: 'Comédie', value: 'g_comedie' },
        { label: 'Drame', value: 'g_drame' },
        { label: 'Fantastique', value: 'g_fantastique' },
        { label: 'Harem', value: 'g_harem' },
        { label: 'Psychologique', value: 'g_psychologique' },
        { label: 'Romance', value: 'g_romance' },
        { label: 'Ecchi', value: 'g_ecchi' },
        { label: 'Mature', value: 'g_mature' },
        { label: 'Surnaturel', value: 'g_surnaturel' },
        { label: 'Vie scolaire', value: 'g_vie-scolaire' },
        { label: 'Adulte', value: 'g_adulte' },
        { label: 'Tragédie', value: 'g_tragedie' },
        { label: 'Arts Martiaux', value: 'g_arts-martiaux' },
        { label: 'Pas de harem', value: 'g_pas-de-harem' },
        { label: 'Tranche de vie', value: 'g_tranche-de-vie' },
        { label: 'Mecha', value: 'g_mecha' },
        { label: 'Sci-fi', value: 'g_sci-fi' },
        { label: 'Science-Fiction', value: 'g_science-fiction' },
        { label: 'Anti-Héros', value: 'g_anti-heros' },
        { label: 'Horreur', value: 'g_horreur' },
        { label: 'Insectes', value: 'g_insectes' },
        { label: 'Mystère', value: 'g_mystere' },
        { label: 'Lolicon', value: 'g_lolicon' },
        { label: 'Shoujo Ai', value: 'g_shoujo-ai' },
        { label: 'Smut', value: 'g_smut' },
        { label: 'Xuanhuan', value: 'g_xuanhuan' },
        { label: 'Shotacon', value: 'g_shotacon' },
      ],
    },
  } satisfies Filters;
}

export default new NovelDeGlacePlugin();
