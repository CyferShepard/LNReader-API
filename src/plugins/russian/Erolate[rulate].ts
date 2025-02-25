import { fetchApi } from '@libs/fetch.ts';
import { Filters, FilterTypes } from '@libs/filterInputs.ts';
import { Plugin } from '@typings/plugin.ts';
import { NovelStatus } from '@libs/novelStatus.ts';
import { load as parseHTML } from 'npm:cheerio';
import dayjs from 'npm:dayjs';

export type RulateMetadata = {
  id: string;
  sourceSite: string;
  sourceName: string;
  filters?: Filters;
  versionIncrements: number;
};

class RulatePlugin implements Plugin.PluginBase {
  id: string;
  name: string;
  icon: string;
  site: string;
  version: string;
  filters?: Filters | undefined;

  constructor(metadata: RulateMetadata) {
    this.id = metadata.id;
    this.name = metadata.sourceName;
    this.icon = `multisrc/rulate/${metadata.id.toLowerCase()}/icon.png`;
    this.site = metadata.sourceSite;
    this.version = '1.0.' + (1 + metadata.versionIncrements);
    this.filters = metadata.filters;
  }

  async popularNovels(
    pageNo: number,
    { filters, showLatestNovels }: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    const novels: Plugin.NovelItem[] = [];
    let url = this.site + '/search?t=';
    url += '&cat=' + (filters?.cat?.value || '0');
    url += '&s_lang=' + (filters?.s_lang?.value || '0');
    url += '&t_lang=' + (filters?.t_lang?.value || '0');
    url += '&type=' + (filters?.type?.value || '0');
    url += '&sort=' + (showLatestNovels ? '4' : filters?.sort?.value || '6');
    url += '&atmosphere=' + (filters?.atmosphere?.value || '0');
    url += '&adult=' + (filters?.adult?.value || '0');

    Object.entries(filters || {}).forEach(([type, { value }]) => {
      if (value instanceof Array && value.length) {
        url +=
          '&' +
          value
            .map(val => (type == 'extra' ? val + '=1' : type + '[]=' + val))
            .join('&');
      }
    });

    url += '&Book_page=' + pageNo;

    const body = await fetchApi(url).then(res => res.text());
    const loadedCheerio = parseHTML(body);

    loadedCheerio(
      'ul[class="search-results"] > li:not([class="ad_type_catalog"])',
    ).each((index, element) => {
      loadedCheerio(element).find('p > a').text();
      const name = loadedCheerio(element).find('p > a').text();
      const cover = loadedCheerio(element).find('img').attr('src');
      const path = loadedCheerio(element).find('p > a').attr('href');
      if (!name || !path) return;

      novels.push({ name, cover: this.site + cover, path });
    });

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    let result = await fetchApi(this.site + novelPath);
    if (result.url.includes('mature?path=')) {
      const formData = new FormData();
      formData.append('path', novelPath);
      formData.append('ok', 'Да');

      result = await fetchApi(result.url, {
        method: 'POST',
        body: formData,
      });
    }
    const body = await result.text();
    const loadedCheerio = parseHTML(body);

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: loadedCheerio('.span8 > h1, .book__title').text().trim(),
    };
    if (novel.name?.includes?.('[')) {
      novel.name = novel.name.split('[')[0].trim();
    }
    novel.cover =
      this.site +
      loadedCheerio('div[class="images"] > div img, .book__cover > img').attr(
        'src',
      );
    novel.summary = loadedCheerio(
      '#Info > div:nth-child(3), .book__description',
    )
      .text()
      .trim();
    const genres: string[] = [];

    loadedCheerio('div.span5 > p').each(function () {
      switch (loadedCheerio(this).find('strong').text()) {
        case 'Автор:':
          novel.author = loadedCheerio(this).find('em > a').text().trim();
          break;
        case 'Выпуск:':
          novel.status =
            loadedCheerio(this).find('em').text().trim() === 'продолжается'
              ? NovelStatus.Ongoing
              : NovelStatus.Completed;
          break;
        case 'Тэги:':
          loadedCheerio(this)
            .find('em > a')
            .each(function () {
              genres.push(loadedCheerio(this).text());
            });
          break;
        case 'Жанры:':
          loadedCheerio(this)
            .find('em > a')
            .each(function () {
              genres.push(loadedCheerio(this).text());
            });
          break;
      }
    });

    if (genres.length) {
      novel.genres = genres.reverse().join(',');
    }

    const chapters: Plugin.ChapterItem[] = [];
    if (this.id === 'rulate') {
      loadedCheerio('table > tbody > tr.chapter_row').each(
        (chapterIndex, element) => {
          const chapterName = loadedCheerio(element)
            .find('td[class="t"] > a')
            .text()
            .trim();
          const releaseDate = loadedCheerio(element)
            .find('td > span')
            .attr('title')
            ?.trim();
          const chapterUrl = loadedCheerio(element)
            .find('td[class="t"] > a')
            .attr('href');

          if (
            !loadedCheerio(element).find('td > span[class="disabled"]')
              .length &&
            releaseDate &&
            chapterUrl
          ) {
            chapters.push({
              name: chapterName,
              path: chapterUrl,
              releaseTime: this.parseDate(releaseDate),
              chapterNumber: chapterIndex + 1,
            });
          }
        },
      );
    } else {
      loadedCheerio('a.chapter').each((chapterIndex, element) => {
        const chapterName = loadedCheerio(element)
          .find('div:nth-child(1) > span:nth-child(2)')
          .text()
          .trim();
        const chapterUrl = loadedCheerio(element).attr('href');
        const isPaid = loadedCheerio(element).find(
          'span[data-can-buy="true"]',
        ).length;

        if (!isPaid && chapterUrl) {
          chapters.push({
            name: chapterName,
            path: chapterUrl,
            chapterNumber: chapterIndex + 1,
          });
        }
      });
    }
    novel.chapters = chapters;
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    let result = await fetchApi(this.site + chapterPath);
    if (result.url.includes('mature?path=')) {
      const formData = new FormData();
      formData.append('path', chapterPath.split('/').slice(0, 3).join('/'));
      formData.append('ok', 'Да');

      result = await fetchApi(result.url, {
        method: 'POST',
        body: formData,
      });
    }
    const body = await result.text();
    const loadedCheerio = parseHTML(body);

    const chapterText = loadedCheerio('.content-text, #read-text').html();
    return chapterText || '';
  }

  async searchNovels(searchTerm: string): Promise<Plugin.NovelItem[]> {
    const novels: Plugin.NovelItem[] = [];
    const result: response[] = await fetchApi(
      this.site + '/search/autocomplete?query=' + searchTerm,
    ).then(res => res.json());

    result.forEach(novel => {
      const name = novel.title_one + ' / ' + novel.title_two;
      if (!novel.url) return;

      novels.push({
        name,
        cover: this.site + novel.img,
        path: novel.url,
      });
    });

    return novels;
  }

  parseDate = (dateString: string | undefined = '') => {
    const months: Record<string, number> = {
      'янв.': 1,
      'февр.': 2,
      'мар.': 3,
      'апр.': 4,
      мая: 5,
      'июн.': 6,
      'июл.': 7,
      'авг.': 8,
      'сент.': 9,
      'окт.': 10,
      'нояб.': 11,
      'дек.': 12,
    };
    const [day, month, year, , time] = dateString.split(' ');
    if (day && months[month] && year && time) {
      return dayjs(year + '-' + months[month] + '-' + day + ' ' + time).format(
        'LLL',
      );
    }
    return dateString || null;
  };
}

type response = {
  id: number;
  title_one: string;
  title_two: string;
  url: string;
  img: string;
};

const plugin = new RulatePlugin({"id":"erolate","sourceSite":"https://erolate.com","sourceName":"Erolate","filters":{"sort":{"label":"Сортировка:","value":"6","options":[{"label":"По рейтингу","value":"6"},{"label":"По дате последней активности","value":"4"},{"label":"По дате создания","value":"3"},{"label":"По кол-ву бесплатных глав","value":"11"},{"label":"По кол-ву в закладках","value":"13"},{"label":"По кол-ву в избранном","value":"14"},{"label":"По кол-ву лайков","value":"8"},{"label":"По кол-ву переведённых глав","value":"7"},{"label":"По кол-ву рецензий","value":"12"},{"label":"По кол-ву страниц","value":"10"},{"label":"По названию на языке оригинала","value":"1"},{"label":"По названию на языке перевода","value":"2"},{"label":"По просмотрам","value":"5"},{"label":"По степени готовности","value":"0"},{"label":"Случайно","value":"9"}],"type":FilterTypes.Picker},"cat":{"label":"Из раздела каталога:","value":"","options":[{"label":"Неважно","value":"0"},{"label":"Авторские","value":"35"},{"label":"Английские","value":"34"},{"label":"Китайские","value":"31"},{"label":"Комиксы","value":"29"},{"label":"Корейские","value":"33"},{"label":"Авторские","value":"18"},{"label":"Авторские фанфики","value":"51"},{"label":"Английские","value":"28"},{"label":"Английские","value":"48"},{"label":"Аниме","value":"20"},{"label":"Аудиокниги","value":"25"},{"label":"Блич","value":"42"},{"label":"Большие игры","value":"22"},{"label":"Ван-Пис","value":"41"},{"label":"Визуальные новеллы","value":"8"},{"label":"Вьетнамские","value":"39"},{"label":"Вьетнамские","value":"49"},{"label":"Игры","value":"3"},{"label":"Китайские","value":"5"},{"label":"Китайские","value":"45"},{"label":"Книги","value":"2"},{"label":"Книги","value":"14"},{"label":"Корейские","value":"7"},{"label":"Корейские","value":"47"},{"label":"Маленькие игры","value":"23"},{"label":"Манга","value":"16"},{"label":"Манга","value":"30"},{"label":"Марвел","value":"43"},{"label":"Машинный перевод","value":"44"},{"label":"Наруто","value":"40"},{"label":"Новеллы и ранобэ","value":"12"},{"label":"Переводы фанфиков","value":"19"},{"label":"Психология","value":"37"},{"label":"Путешествия","value":"36"},{"label":"Статьи","value":"13"},{"label":"Субтитры","value":"15"},{"label":"Фильмы","value":"21"},{"label":"Японские","value":"6"},{"label":"Японские","value":"32"},{"label":"Японские","value":"46"},{"label":"Авторские","value":"12"},{"label":"Игры 18+","value":"3"},{"label":"Манга для взрослых","value":"30"},{"label":"Машинный перевод","value":"38"},{"label":"Переводы","value":"15"},{"label":"Фанфики","value":"16"},{"label":"Эротические рассказы","value":"2"}],"type":FilterTypes.Picker},"s_lang":{"label":"Язык оригинала:","value":"0","options":[{"label":"Неважно","value":"0"},{"label":"Абхазский","value":"20"},{"label":"Аварский","value":"21"},{"label":"Азербайджанский","value":"22"},{"label":"Аймара","value":"23"},{"label":"Акан","value":"24"},{"label":"Албанский","value":"25"},{"label":"Амхарский","value":"26"},{"label":"Английский","value":"2"},{"label":"Арабский","value":"27"},{"label":"Арагонский","value":"28"},{"label":"Арберешский","value":"29"},{"label":"Армянский","value":"30"},{"label":"Ассамский","value":"31"},{"label":"Астурийский","value":"32"},{"label":"Афарский","value":"33"},{"label":"Африкаанс","value":"34"},{"label":"Ацтекский","value":"35"},{"label":"Баварский","value":"36"},{"label":"Бамбарийский","value":"37"},{"label":"Баскский","value":"39"},{"label":"Башкирский","value":"40"},{"label":"Белорусский","value":"10"},{"label":"Бенгальский","value":"41"},{"label":"Бирманский","value":"42"},{"label":"Бислама","value":"43"},{"label":"Бихари","value":"44"},{"label":"Болгарский","value":"45"},{"label":"Боснийский","value":"234"},{"label":"Бретонский","value":"47"},{"label":"Валенсийский","value":"48"},{"label":"Валлийский","value":"49"},{"label":"Валлонский","value":"50"},{"label":"Венгерский","value":"51"},{"label":"Венда","value":"52"},{"label":"Венетский","value":"53"},{"label":"Верхнелужицкий","value":"54"},{"label":"Волоф","value":"55"},{"label":"Вьетнамский","value":"57"},{"label":"Гавайский","value":"58"},{"label":"Гаитянский","value":"59"},{"label":"Галисийский","value":"60"},{"label":"Гереро","value":"61"},{"label":"Голландский","value":"62"},{"label":"Греческий","value":"63"},{"label":"Грузинский","value":"64"},{"label":"Гуарани","value":"65"},{"label":"Гуджарати","value":"66"},{"label":"Датский","value":"19"},{"label":"Дзонг-кэ","value":"68"},{"label":"Древнегреческий","value":"69"},{"label":"Западно-фламандский","value":"70"},{"label":"Зулу","value":"71"},{"label":"Иврит","value":"15"},{"label":"Игбо","value":"72"},{"label":"Идиш","value":"73"},{"label":"Илоко","value":"74"},{"label":"Индонезийский","value":"75"},{"label":"Интерлингва","value":"76"},{"label":"Инуктитут","value":"77"},{"label":"Инупиак","value":"78"},{"label":"Ирландский","value":"79"},{"label":"Исландский","value":"80"},{"label":"Испанский","value":"6"},{"label":"Итальянский","value":"5"},{"label":"Йоруба","value":"81"},{"label":"Кабильский","value":"82"},{"label":"Казахский","value":"83"},{"label":"Калмыцкий","value":"235"},{"label":"Каннада","value":"84"},{"label":"Кантонский юэ","value":"85"},{"label":"Канури","value":"86"},{"label":"Каталанский","value":"87"},{"label":"Кашмири","value":"88"},{"label":"Кечуа","value":"90"},{"label":"Кикуйю","value":"91"},{"label":"Киньяруанда","value":"92"},{"label":"Киргизский","value":"93"},{"label":"Китайский","value":"7"},{"label":"Клингонский","value":"94"},{"label":"Коми","value":"95"},{"label":"Конго","value":"96"},{"label":"Конкани","value":"97"},{"label":"Корейский","value":"98"},{"label":"Корсиканский","value":"100"},{"label":"Котава","value":"101"},{"label":"Кри","value":"102"},{"label":"Курдский","value":"105"},{"label":"Кхмерский","value":"107"},{"label":"Лакский","value":"233"},{"label":"Лаосский","value":"109"},{"label":"Латынь","value":"110"},{"label":"Латышский","value":"111"},{"label":"Лезгинский","value":"112"},{"label":"Лимбургский","value":"113"},{"label":"Лингала","value":"114"},{"label":"Литовский","value":"115"},{"label":"Луба","value":"118"},{"label":"Луганда","value":"119"},{"label":"Люксембургский","value":"120"},{"label":"Македонский","value":"121"},{"label":"Малагасийский","value":"122"},{"label":"Малайский","value":"123"},{"label":"Мальдивский","value":"125"},{"label":"Мальтийский","value":"126"},{"label":"Маори","value":"127"},{"label":"Марийский","value":"232"},{"label":"Маршалльский","value":"130"},{"label":"Молдавский","value":"11"},{"label":"Монгольский","value":"133"},{"label":"Мяо (хмонг)","value":"209"},{"label":"Навахо","value":"135"},{"label":"Неаполитанский","value":"139"},{"label":"Немецкий","value":"3"},{"label":"Непальский","value":"140"},{"label":"Норвежский","value":"18"},{"label":"Осетинский","value":"147"},{"label":"Пакистанский","value":"230"},{"label":"Пенджабский","value":"149"},{"label":"Персидский","value":"151"},{"label":"Польский","value":"152"},{"label":"Португальский","value":"153"},{"label":"Румынский","value":"158"},{"label":"Русский","value":"1"},{"label":"Санскрит","value":"163"},{"label":"Сардинский","value":"164"},{"label":"Сербохорватский","value":"166"},{"label":"Словацкий","value":"170"},{"label":"Словенский","value":"171"},{"label":"Сомали","value":"172"},{"label":"Старотурецкий","value":"174"},{"label":"Суахили","value":"175"},{"label":"Сунданский","value":"176"},{"label":"Тагальский","value":"177"},{"label":"Таджикский","value":"178"},{"label":"Таитянский","value":"179"},{"label":"Тайваньский","value":"180"},{"label":"Тайский","value":"181"},{"label":"Тамильский","value":"182"},{"label":"Татарский","value":"12"},{"label":"Телугу","value":"184"},{"label":"Тибетский","value":"185"},{"label":"Тигринья","value":"186"},{"label":"Ток-писин","value":"187"},{"label":"Токи пона","value":"188"},{"label":"Тонганский","value":"189"},{"label":"Тсвана","value":"191"},{"label":"Тсонга","value":"192"},{"label":"Турецкий","value":"193"},{"label":"Туркменский","value":"194"},{"label":"Удмуртский","value":"196"},{"label":"Узбекский","value":"197"},{"label":"Уйгурский","value":"198"},{"label":"Украинский","value":"9"},{"label":"Фиджийский","value":"201"},{"label":"Филиппинский","value":"229"},{"label":"Финский","value":"17"},{"label":"Французский","value":"4"},{"label":"Фризский","value":"203"},{"label":"Фулах","value":"204"},{"label":"Хауса","value":"206"},{"label":"Хинди","value":"207"},{"label":"Хири-моту","value":"208"},{"label":"Чеченский","value":"213"},{"label":"Чешский","value":"13"},{"label":"Чувашский","value":"217"},{"label":"Шведский","value":"16"},{"label":"Швейцарский немецкий","value":"218"},{"label":"Шона","value":"219"},{"label":"Шотландский","value":"67"},{"label":"Эве","value":"221"},{"label":"Эскимосский","value":"223"},{"label":"Эсперанто","value":"14"},{"label":"Эстонский","value":"224"},{"label":"Южно-корейский","value":"231"},{"label":"Юкатекский","value":"225"},{"label":"Яванский","value":"227"},{"label":"Японский","value":"8"}],"type":FilterTypes.Picker},"t_lang":{"label":"Язык перевода:","value":"0","options":[{"label":"Неважно","value":"0"},{"label":"Абхазский","value":"20"},{"label":"Аварский","value":"21"},{"label":"Азербайджанский","value":"22"},{"label":"Аймара","value":"23"},{"label":"Акан","value":"24"},{"label":"Албанский","value":"25"},{"label":"Амхарский","value":"26"},{"label":"Английский","value":"2"},{"label":"Арабский","value":"27"},{"label":"Арагонский","value":"28"},{"label":"Арберешский","value":"29"},{"label":"Армянский","value":"30"},{"label":"Ассамский","value":"31"},{"label":"Астурийский","value":"32"},{"label":"Афарский","value":"33"},{"label":"Африкаанс","value":"34"},{"label":"Ацтекский","value":"35"},{"label":"Баварский","value":"36"},{"label":"Бамбарийский","value":"37"},{"label":"Баскский","value":"39"},{"label":"Башкирский","value":"40"},{"label":"Белорусский","value":"10"},{"label":"Бенгальский","value":"41"},{"label":"Бирманский","value":"42"},{"label":"Бислама","value":"43"},{"label":"Бихари","value":"44"},{"label":"Болгарский","value":"45"},{"label":"Боснийский","value":"234"},{"label":"Бретонский","value":"47"},{"label":"Валенсийский","value":"48"},{"label":"Валлийский","value":"49"},{"label":"Валлонский","value":"50"},{"label":"Венгерский","value":"51"},{"label":"Венда","value":"52"},{"label":"Венетский","value":"53"},{"label":"Верхнелужицкий","value":"54"},{"label":"Волоф","value":"55"},{"label":"Вьетнамский","value":"57"},{"label":"Гавайский","value":"58"},{"label":"Гаитянский","value":"59"},{"label":"Галисийский","value":"60"},{"label":"Гереро","value":"61"},{"label":"Голландский","value":"62"},{"label":"Греческий","value":"63"},{"label":"Грузинский","value":"64"},{"label":"Гуарани","value":"65"},{"label":"Гуджарати","value":"66"},{"label":"Датский","value":"19"},{"label":"Дзонг-кэ","value":"68"},{"label":"Древнегреческий","value":"69"},{"label":"Западно-фламандский","value":"70"},{"label":"Зулу","value":"71"},{"label":"Иврит","value":"15"},{"label":"Игбо","value":"72"},{"label":"Идиш","value":"73"},{"label":"Илоко","value":"74"},{"label":"Индонезийский","value":"75"},{"label":"Интерлингва","value":"76"},{"label":"Инуктитут","value":"77"},{"label":"Инупиак","value":"78"},{"label":"Ирландский","value":"79"},{"label":"Исландский","value":"80"},{"label":"Испанский","value":"6"},{"label":"Итальянский","value":"5"},{"label":"Йоруба","value":"81"},{"label":"Кабильский","value":"82"},{"label":"Казахский","value":"83"},{"label":"Калмыцкий","value":"235"},{"label":"Каннада","value":"84"},{"label":"Кантонский юэ","value":"85"},{"label":"Канури","value":"86"},{"label":"Каталанский","value":"87"},{"label":"Кашмири","value":"88"},{"label":"Кечуа","value":"90"},{"label":"Кикуйю","value":"91"},{"label":"Киньяруанда","value":"92"},{"label":"Киргизский","value":"93"},{"label":"Китайский","value":"7"},{"label":"Клингонский","value":"94"},{"label":"Коми","value":"95"},{"label":"Конго","value":"96"},{"label":"Конкани","value":"97"},{"label":"Корейский","value":"98"},{"label":"Корсиканский","value":"100"},{"label":"Котава","value":"101"},{"label":"Кри","value":"102"},{"label":"Курдский","value":"105"},{"label":"Кхмерский","value":"107"},{"label":"Лакский","value":"233"},{"label":"Лаосский","value":"109"},{"label":"Латынь","value":"110"},{"label":"Латышский","value":"111"},{"label":"Лезгинский","value":"112"},{"label":"Лимбургский","value":"113"},{"label":"Лингала","value":"114"},{"label":"Литовский","value":"115"},{"label":"Луба","value":"118"},{"label":"Луганда","value":"119"},{"label":"Люксембургский","value":"120"},{"label":"Македонский","value":"121"},{"label":"Малагасийский","value":"122"},{"label":"Малайский","value":"123"},{"label":"Мальдивский","value":"125"},{"label":"Мальтийский","value":"126"},{"label":"Маори","value":"127"},{"label":"Марийский","value":"232"},{"label":"Маршалльский","value":"130"},{"label":"Молдавский","value":"11"},{"label":"Монгольский","value":"133"},{"label":"Мяо (хмонг)","value":"209"},{"label":"Навахо","value":"135"},{"label":"Неаполитанский","value":"139"},{"label":"Немецкий","value":"3"},{"label":"Непальский","value":"140"},{"label":"Норвежский","value":"18"},{"label":"Осетинский","value":"147"},{"label":"Пакистанский","value":"230"},{"label":"Пенджабский","value":"149"},{"label":"Персидский","value":"151"},{"label":"Польский","value":"152"},{"label":"Португальский","value":"153"},{"label":"Румынский","value":"158"},{"label":"Русский","value":"1"},{"label":"Санскрит","value":"163"},{"label":"Сардинский","value":"164"},{"label":"Сербохорватский","value":"166"},{"label":"Словацкий","value":"170"},{"label":"Словенский","value":"171"},{"label":"Сомали","value":"172"},{"label":"Старотурецкий","value":"174"},{"label":"Суахили","value":"175"},{"label":"Сунданский","value":"176"},{"label":"Тагальский","value":"177"},{"label":"Таджикский","value":"178"},{"label":"Таитянский","value":"179"},{"label":"Тайваньский","value":"180"},{"label":"Тайский","value":"181"},{"label":"Тамильский","value":"182"},{"label":"Татарский","value":"12"},{"label":"Телугу","value":"184"},{"label":"Тибетский","value":"185"},{"label":"Тигринья","value":"186"},{"label":"Ток-писин","value":"187"},{"label":"Токи пона","value":"188"},{"label":"Тонганский","value":"189"},{"label":"Тсвана","value":"191"},{"label":"Тсонга","value":"192"},{"label":"Турецкий","value":"193"},{"label":"Туркменский","value":"194"},{"label":"Удмуртский","value":"196"},{"label":"Узбекский","value":"197"},{"label":"Уйгурский","value":"198"},{"label":"Украинский","value":"9"},{"label":"Фиджийский","value":"201"},{"label":"Филиппинский","value":"229"},{"label":"Финский","value":"17"},{"label":"Французский","value":"4"},{"label":"Фризский","value":"203"},{"label":"Фулах","value":"204"},{"label":"Хауса","value":"206"},{"label":"Хинди","value":"207"},{"label":"Хири-моту","value":"208"},{"label":"Чеченский","value":"213"},{"label":"Чешский","value":"13"},{"label":"Чувашский","value":"217"},{"label":"Шведский","value":"16"},{"label":"Швейцарский немецкий","value":"218"},{"label":"Шона","value":"219"},{"label":"Шотландский","value":"67"},{"label":"Эве","value":"221"},{"label":"Эскимосский","value":"223"},{"label":"Эсперанто","value":"14"},{"label":"Эстонский","value":"224"},{"label":"Южно-корейский","value":"231"},{"label":"Юкатекский","value":"225"},{"label":"Яванский","value":"227"},{"label":"Японский","value":"8"}],"type":FilterTypes.Picker},"type":{"label":"Тип:","value":"0","options":[{"label":"Неважно","value":"0"},{"label":"Только авторские","value":"2"},{"label":"Только переводы","value":"1"}],"type":FilterTypes.Picker},"extra":{"label":"Другое:","value":[],"options":[{"label":"Без фэндомов","value":"fandoms_ex_all"},{"label":"Готовые на 100%","value":"ready"},{"label":"Доступные для перевода","value":"tr"},{"label":"Доступные для скачивания","value":"gen"},{"label":"Завершённые проекты","value":"wealth"},{"label":"Распродажа","value":"discount"},{"label":"Только онгоинги","value":"ongoings"},{"label":"Убрать машинный","value":"remove_machinelate"}],"type":FilterTypes.CheckboxGroup},"atmosphere":{"label":"Атмосфера:","value":"0","options":[{"label":"Неважно","value":"0"},{"label":"Позитивная","value":"1"},{"label":"Dark","value":"2"}],"type":FilterTypes.Picker},"adult":{"label":"Возрастные ограничения:","value":"1","options":[{"label":"Все","value":"0"},{"label":"Только 18+","value":"2"},{"label":"Убрать 18+","value":"1"}],"type":FilterTypes.Picker},"genres":{"label":"Жанры: все жанры любой жанр","value":[],"options":[{"label":"Анал","value":"2"},{"label":"Бдсм","value":"3"},{"label":"Большая грудь","value":"5"},{"label":"Большая попка","value":"6"},{"label":"Большой член","value":"7"},{"label":"Бондаж","value":"8"},{"label":"В первый раз","value":"9"},{"label":"В цвете","value":"10"},{"label":"Гарем","value":"11"},{"label":"Гендарная интрига","value":"12"},{"label":"Групповой секс","value":"13"},{"label":"Детектив","value":"39"},{"label":"Драма","value":"14"},{"label":"Зрелые женщины (milf)","value":"15"},{"label":"Измена","value":"16"},{"label":"Изнасилование","value":"17"},{"label":"Инцест","value":"18"},{"label":"Исторический","value":"19"},{"label":"Комедия","value":"20"},{"label":"Контроль над разумом","value":"35"},{"label":"Маленькая грудь","value":"21"},{"label":"Мистика","value":"40"},{"label":"Научная фантастика","value":"22"},{"label":"Нетораре","value":"23"},{"label":"Оральный секс","value":"24"},{"label":"Повседневность","value":"41"},{"label":"Приключения","value":"38"},{"label":"Публичный секс","value":"33"},{"label":"Романтика","value":"25"},{"label":"С изображениями","value":"36"},{"label":"Сверхъестественное","value":"34"},{"label":"Смат","value":"37"},{"label":"Тентакли","value":"26"},{"label":"Трагедия","value":"27"},{"label":"Ужасы","value":"28"},{"label":"Фантастика","value":"32"},{"label":"Фэнтези","value":"29"},{"label":"Чикан","value":"30"},{"label":"Этти","value":"31"},{"label":"Ahegao","value":"1"}],"type":FilterTypes.CheckboxGroup},"tags":{"label":"Тэги: все тэги любой тэг","value":[],"options":[{"label":"+18","value":"141"},{"label":"18+","value":"200"},{"label":"21+","value":"334"},{"label":"Адекватные главные герои","value":"253"},{"label":"Азартные игры","value":"210"},{"label":"Айдолы","value":"364"},{"label":"Акула","value":"53"},{"label":"Альтернативное развитие событий","value":"338"},{"label":"Альфа самец","value":"453"},{"label":"Аморальный главный герой","value":"219"},{"label":"Анал","value":"7"},{"label":"Анальный секс","value":"67"},{"label":"Ангелы","value":"114"},{"label":"Антигерой","value":"226"},{"label":"Аристократия","value":"260"},{"label":"Армия","value":"415"},{"label":"Артефакт","value":"379"},{"label":"Афродизиак","value":"276"},{"label":"Ахегао","value":"240"},{"label":"Бабушка беременна от внука","value":"393"},{"label":"Бабушка и внук","value":"380"},{"label":"Бандиты","value":"441"},{"label":"Бдс","value":"420"},{"label":"Бдсм","value":"131"},{"label":"Беременность","value":"148"},{"label":"Бесплатно","value":"79"},{"label":"Бесстрашные персонажи","value":"339"},{"label":"Бесстыдный главный герой","value":"433"},{"label":"Библиотека","value":"265"},{"label":"Бистиалити","value":"391"},{"label":"Битва за трон","value":"404"},{"label":"Близнецы","value":"198"},{"label":"Блондинка","value":"91"},{"label":"Богатые персонажи","value":"248"},{"label":"Боги","value":"115"},{"label":"Боевик","value":"252"},{"label":"Боевые искусства","value":"430"},{"label":"Большая грудь","value":"33"},{"label":"Большая попка","value":"328"},{"label":"Большой член","value":"76"},{"label":"Большой член сына","value":"396"},{"label":"Босс и подчиненный","value":"330"},{"label":"Брак","value":"182"},{"label":"Брак по расчёту","value":"346"},{"label":"Брат","value":"29"},{"label":"Брат и сестра","value":"30"},{"label":"Братский комплекс","value":"466"},{"label":"Брюнетка","value":"28"},{"label":"Будущее","value":"457"},{"label":"Бэтмен","value":"369"},{"label":"Бэтмен","value":"170"},{"label":"В первый раз","value":"179"},{"label":"Вагинальный секс","value":"57"},{"label":"Вагинальный секс","value":"171"},{"label":"Вайурист","value":"9"},{"label":"Вампиры","value":"133"},{"label":"Ван-пис","value":"335"},{"label":"Веб камера","value":"289"},{"label":"Ведьмы","value":"232"},{"label":"Викинги","value":"307"},{"label":"Виртуальная реальность","value":"382"},{"label":"Вирус","value":"203"},{"label":"Внучка","value":"189"},{"label":"Возвращение домой","value":"448"},{"label":"Война","value":"387"},{"label":"Волшебство","value":"438"},{"label":"Воспоминания из прошлого","value":"405"},{"label":"Враги становятся любовниками","value":"410"},{"label":"Время","value":"81"},{"label":"Второй шанс","value":"244"},{"label":"Вуайеризм","value":"62"},{"label":"Выживание","value":"135"},{"label":"Гарем","value":"107"},{"label":"Гарри поттер","value":"97"},{"label":"Гвен","value":"402"},{"label":"Гг имба","value":"87"},{"label":"Генетические модификации","value":"314"},{"label":"Гениальный главный герой","value":"471"},{"label":"Гипноз","value":"143"},{"label":"Гл","value":"427"},{"label":"Главная героиня девушка","value":"147"},{"label":"Главный герой женщина","value":"213"},{"label":"Главный герой извращенец","value":"116"},{"label":"Главный герой мужчина","value":"117"},{"label":"Глубокое горло","value":"94"},{"label":"Гоблины","value":"230"},{"label":"Город","value":"139"},{"label":"Городское фэнтези","value":"297"},{"label":"Грудное молоко","value":"225"},{"label":"Групповой секс","value":"72"},{"label":"Гэнг-бэнг","value":"235"},{"label":"Гяру","value":"222"},{"label":"Двойное проникновение","value":"42"},{"label":"Двойной анал","value":"47"},{"label":"Дворяне","value":"246"},{"label":"Деамоны старший школы","value":"291"},{"label":"Девственница","value":"119"},{"label":"Девушки-монстры","value":"223"},{"label":"Демоны","value":"98"},{"label":"Детектив","value":"249"},{"label":"Дзёсэй","value":"259"},{"label":"Доктор","value":"326"},{"label":"Дом","value":"138"},{"label":"Доминирование","value":"18"},{"label":"Дочь","value":"153"},{"label":"Дочь беременна от отца","value":"348"},{"label":"Древние времена","value":"383"},{"label":"Древний китай","value":"261"},{"label":"Другой мир","value":"365"},{"label":"Дружба","value":"325"},{"label":"Друзья детства","value":"183"},{"label":"Дядя","value":"160"},{"label":"Жена","value":"70"},{"label":"Жена и муж","value":"99"},{"label":"Жена шлюха","value":"236"},{"label":"Женское доминирование","value":"100"},{"label":"Жесткий секс","value":"283"},{"label":"Жёсткий секс","value":"101"},{"label":"Жестокие персонажи","value":"254"},{"label":"Жестокий мир","value":"336"},{"label":"Жестокость","value":"123"},{"label":"Заботливый главный герой","value":"340"},{"label":"Зависимость","value":"370"},{"label":"Заключение","value":"196"},{"label":"Заключённые","value":"384"},{"label":"Замок","value":"140"},{"label":"Запретная любовь","value":"273"},{"label":"Заражение","value":"206"},{"label":"Зачарованные","value":"467"},{"label":"Звёздные войны","value":"120"},{"label":"Зверодевочки","value":"158"},{"label":"Зло","value":"343"},{"label":"Золовка","value":"77"},{"label":"Золотой дождь","value":"146"},{"label":"Зомби апокалипсис","value":"241"},{"label":"Зоофилия","value":"144"},{"label":"Зрелы","value":"419"},{"label":"Зрелые женщины","value":"398"},{"label":"Игровые элементы","value":"385"},{"label":"Извращения","value":"192"},{"label":"Измена","value":"71"},{"label":"Изменения внешности","value":"315"},{"label":"Изменения личности","value":"316"},{"label":"Изнасилование","value":"275"},{"label":"Изуку мидория","value":"337"},{"label":"Инвалидность","value":"458"},{"label":"Ино","value":"127"},{"label":"Инопланетяне","value":"304"},{"label":"Интересный сюжет","value":"349"},{"label":"Интимные сцены","value":"322"},{"label":"Интрига","value":"435"},{"label":"Интриги и заговоры","value":"262"},{"label":"Интроверт","value":"38"},{"label":"Инфекция","value":"207"},{"label":"Инцест","value":"35"},{"label":"Исторический роман","value":"406"},{"label":"Камера","value":"92"},{"label":"Киберспорт","value":"426"},{"label":"Китай","value":"445"},{"label":"Колледж","value":"82"},{"label":"Кольца","value":"455"},{"label":"Комикс","value":"286"},{"label":"Контроль","value":"19"},{"label":"Контроль над разумом","value":"181"},{"label":"Контроль разума","value":"65"},{"label":"Кончил внутрь","value":"221"},{"label":"Корея","value":"446"},{"label":"Кормление грудью","value":"440"},{"label":"Королевская семья","value":"358"},{"label":"Королевство","value":"465"},{"label":"Коррупция","value":"49"},{"label":"Космос","value":"204"},{"label":"Красивая главная героиня","value":"255"},{"label":"Красивы","value":"462"},{"label":"Красивые женщины","value":"321"},{"label":"Красивый главный герой","value":"266"},{"label":"Ксенофилия","value":"386"},{"label":"Кулинария","value":"362"},{"label":"Культвация","value":"86"},{"label":"Кунилингус","value":"152"},{"label":"Кушина","value":"399"},{"label":"Лактация","value":"11"},{"label":"Лесби","value":"408"},{"label":"Лишение девственности","value":"212"},{"label":"Лоли","value":"218"},{"label":"Лунатизм","value":"279"},{"label":"Любовный треугольник","value":"473"},{"label":"Любовь","value":"89"},{"label":"Любовь с первого взгляда","value":"436"},{"label":"Магические предметы","value":"454"},{"label":"Магический мир","value":"357"},{"label":"Магия","value":"80"},{"label":"Магия природы","value":"437"},{"label":"Мама","value":"3"},{"label":"Мама беременна от сына","value":"274"},{"label":"Мама и дочь","value":"163"},{"label":"Мама и сын","value":"1"},{"label":"Мама супермена","value":"39"},{"label":"Манипуляция временем","value":"292"},{"label":"Марвел","value":"290"},{"label":"Марвел","value":"173"},{"label":"Марти стью","value":"102"},{"label":"Массаж","value":"224"},{"label":"Мастурбация","value":"63"},{"label":"Мать","value":"239"},{"label":"Мать и дочь","value":"381"},{"label":"Мать и сын","value":"237"},{"label":"Мафия","value":"256"},{"label":"Мачеха","value":"197"},{"label":"Мачеха беременна от сына","value":"395"},{"label":"Мачеха и сын","value":"394"},{"label":"Медленная романтика","value":"431"},{"label":"Медсестра","value":"341"},{"label":"Межрассовый","value":"54"},{"label":"Месть","value":"306"},{"label":"Меха","value":"268"},{"label":"Ми","value":"243"},{"label":"Милф","value":"34"},{"label":"Милф","value":"180"},{"label":"Минет","value":"52"},{"label":"Мистика","value":"250"},{"label":"Младшая сестра","value":"154"},{"label":"Много спермы","value":"409"},{"label":"Модель","value":"324"},{"label":"Монахиня","value":"470"},{"label":"Монстры","value":"333"},{"label":"Мошеничество","value":"44"},{"label":"Муж куколд","value":"452"},{"label":"Мужская беременность","value":"363"},{"label":"Мужчина протагонист","value":"108"},{"label":"Музыка","value":"331"},{"label":"Мэри съюха","value":"309"},{"label":"Наруко","value":"400"},{"label":"Наруто","value":"46"},{"label":"Насилие","value":"128"},{"label":"Насилие и жестокость","value":"193"},{"label":"Научный эксперимент","value":"313"},{"label":"Невеста","value":"421"},{"label":"Нежить","value":"373"},{"label":"Некромантия","value":"298"},{"label":"Ненормативная лексика","value":"124"},{"label":"Нетораре","value":"69"},{"label":"Нетори","value":"284"},{"label":"Нижнее бельё","value":"392"},{"label":"Ниндзя","value":"296"},{"label":"Новый год","value":"459"},{"label":"Ношеные трусики","value":"166"},{"label":"Нудизм","value":"156"},{"label":"Няня","value":"88"},{"label":"Обмен женами","value":"78"},{"label":"Оборотни","value":"136"},{"label":"Обратный гарем","value":"214"},{"label":"Одержимость","value":"345"},{"label":"Омегаверс","value":"368"},{"label":"Оплодотворение","value":"157"},{"label":"Оральный секс","value":"10"},{"label":"Оргия","value":"356"},{"label":"Орки","value":"388"},{"label":"От бедности к богатству","value":"444"},{"label":"От слабого к сильному","value":"351"},{"label":"Отец","value":"2"},{"label":"Отец делится с сыном","value":"6"},{"label":"Отец и дочь","value":"205"},{"label":"Отец куколд","value":"272"},{"label":"Отчим","value":"417"},{"label":"Офис","value":"234"},{"label":"Падчерица","value":"271"},{"label":"Пайзури","value":"195"},{"label":"Папа и дочь","value":"360"},{"label":"Паразиты","value":"208"},{"label":"Параллельный мир","value":"320"},{"label":"Пародия","value":"371"},{"label":"Первая любовь","value":"434"},{"label":"Первый раз","value":"159"},{"label":"Перемещение в другой мир","value":"347"},{"label":"Перемещение во времени","value":"245"},{"label":"Перерождение","value":"109"},{"label":"Перерождение в злодея","value":"202"},{"label":"Пирсинг","value":"145"},{"label":"Писатель","value":"267"},{"label":"Планомерное развитие событий","value":"350"},{"label":"Повседневность","value":"247"},{"label":"Подглядывание","value":"280"},{"label":"Подчинение","value":"106"},{"label":"Подчинение и унижение","value":"211"},{"label":"Поедание киски","value":"26"},{"label":"Покемоны","value":"132"},{"label":"Покорная","value":"8"},{"label":"Полигамия","value":"352"},{"label":"Половое воспитание","value":"37"},{"label":"Полулюди","value":"231"},{"label":"Попаданец","value":"103"},{"label":"Попадание в книгу","value":"361"},{"label":"Порка","value":"20"},{"label":"Порно","value":"278"},{"label":"Постапокалипсис","value":"332"},{"label":"Потеря девственности","value":"142"},{"label":"Похищение","value":"161"},{"label":"Преданные любовный интерес","value":"407"},{"label":"Призраки","value":"412"},{"label":"Приключения","value":"134"},{"label":"Принуждение","value":"66"},{"label":"Проклятие","value":"456"},{"label":"Психические расстройства","value":"463"},{"label":"Психология","value":"238"},{"label":"Публично","value":"85"},{"label":"Публичный секс","value":"233"},{"label":"Раб","value":"353"},{"label":"Рабы","value":"308"},{"label":"Разват","value":"58"},{"label":"Разврат","value":"64"},{"label":"Райзен","value":"95"},{"label":"Раса инопланетных космических лесбиянок","value":"294"},{"label":"Ревность","value":"414"},{"label":"Реинкарнация","value":"428"},{"label":"Религия","value":"403"},{"label":"Рестленг","value":"84"},{"label":"Риас гремори","value":"389"},{"label":"Рождество","value":"460"},{"label":"Романтика","value":"178"},{"label":"Рыжий","value":"90"},{"label":"С","value":"413"},{"label":"Сакура","value":"126"},{"label":"Самолет","value":"93"},{"label":"Санса старк","value":"277"},{"label":"Санта","value":"372"},{"label":"Свадьба","value":"73"},{"label":"Сверхсила","value":"228"},{"label":"Сверхъестественное","value":"319"},{"label":"Свингеры","value":"201"},{"label":"Свободные отношения","value":"186"},{"label":"Связывание","value":"137"},{"label":"Сёдзе","value":"264"},{"label":"Секс","value":"21"},{"label":"Секс без проникновения","value":"68"},{"label":"Секс втроем","value":"43"},{"label":"Секс игрушки","value":"59"},{"label":"Секс рабыня","value":"55"},{"label":"Секс с монстрами","value":"56"},{"label":"Секс с учителем","value":"184"},{"label":"Секса будет много","value":"151"},{"label":"Сексуальное желание","value":"209"},{"label":"Селфцест","value":"397"},{"label":"Семейные традиции","value":"449"},{"label":"Семья","value":"5"},{"label":"Сестра","value":"31"},{"label":"Сестра беременна от брата","value":"355"},{"label":"Сильный с самого начала","value":"112"},{"label":"Симбиоз","value":"50"},{"label":"Сирена","value":"51"},{"label":"Система","value":"104"},{"label":"Сиськи","value":"285"},{"label":"Сквирт","value":"164"},{"label":"Скрытый секс","value":"287"},{"label":"Служанка","value":"215"},{"label":"Соб","value":"281"},{"label":"Соблазнение","value":"162"},{"label":"Современность","value":"217"},{"label":"Соколиный Глаз","value":"176"},{"label":"Соперничество","value":"216"},{"label":"Соседи","value":"61"},{"label":"Соседка","value":"312"},{"label":"Сперма","value":"229"},{"label":"Сперма на лицо","value":"199"},{"label":"Спорт","value":"450"},{"label":"Спящие","value":"187"},{"label":"Средневековье","value":"443"},{"label":"Сталкер","value":"418"},{"label":"Старшая сестра","value":"311"},{"label":"Стеб","value":"111"},{"label":"Студенты","value":"177"},{"label":"Суккуб","value":"390"},{"label":"Супергерои","value":"305"},{"label":"Суперспособности","value":"300"},{"label":"Счастливый конец","value":"461"},{"label":"Сын","value":"4"},{"label":"Сын солдат","value":"416"},{"label":"Сюаньхуа","value":"425"},{"label":"Сянься","value":"424"},{"label":"Таблетки для развития","value":"429"},{"label":"Тайная любовь","value":"432"},{"label":"Тайные отношения","value":"451"},{"label":"Твинцест","value":"188"},{"label":"Темное фэнтези","value":"293"},{"label":"Тентакли","value":"303"},{"label":"Тетя","value":"113"},{"label":"Тетя беременна от племянника","value":"376"},{"label":"Тетя и племянник","value":"377"},{"label":"Техника","value":"302"},{"label":"Технологии","value":"301"},{"label":"Тёща","value":"270"},{"label":"Тиран","value":"310"},{"label":"Трагическое прошлое","value":"251"},{"label":"Трансмиграция","value":"269"},{"label":"Трансформация","value":"317"},{"label":"Триллер","value":"344"},{"label":"Трусики","value":"165"},{"label":"Убийства","value":"258"},{"label":"Удача","value":"299"},{"label":"Ужасы","value":"375"},{"label":"Улучшение тела","value":"288"},{"label":"Умная главная героиня","value":"242"},{"label":"Умные персонажи","value":"257"},{"label":"Умный главный герой","value":"354"},{"label":"Университет","value":"323"},{"label":"Уся","value":"423"},{"label":"Учеба в университете","value":"472"},{"label":"Ученик","value":"83"},{"label":"Ф","value":"149"},{"label":"Фанатичная любовь","value":"366"},{"label":"Фанаты","value":"367"},{"label":"Фантастика","value":"295"},{"label":"Фанфик","value":"40"},{"label":"Фелляция","value":"22"},{"label":"Ферма","value":"191"},{"label":"Фетиш","value":"60"},{"label":"Флэш","value":"121"},{"label":"Футанария","value":"150"},{"label":"Фэн","value":"422"},{"label":"Фэнтези","value":"359"},{"label":"Фэнтезийный мир","value":"464"},{"label":"Хентай","value":"75"},{"label":"Хината","value":"110"},{"label":"Холодная главная героиня","value":"263"},{"label":"Христианство","value":"468"},{"label":"Хулиганы","value":"442"},{"label":"Церковь","value":"469"},{"label":"Черная вдова","value":"220"},{"label":"Черная Вдова","value":"175"},{"label":"Черный юмор","value":"374"},{"label":"Читерство","value":"45"},{"label":"Чтение мыслей","value":"227"},{"label":"Чудовища","value":"378"},{"label":"Чулки","value":"439"},{"label":"Шантаж","value":"129"},{"label":"Школа","value":"118"},{"label":"Школьная жизнь","value":"318"},{"label":"Шлюха","value":"32"},{"label":"Шоу-бизнес","value":"329"},{"label":"Шоу-бизнес","value":"172"},{"label":"Эксгибиционизм","value":"74"},{"label":"Элементы бдсм","value":"185"},{"label":"Эмма уотсон","value":"342"},{"label":"Эмма Уотсон","value":"169"},{"label":"Эротика","value":"36"},{"label":"Этти","value":"327"},{"label":"Юмор","value":"105"},{"label":"Яндере","value":"155"},{"label":"Япония","value":"447"},{"label":"Bl","value":"125"},{"label":"Dc","value":"411"},{"label":"Gl","value":"96"},{"label":"Harry potter","value":"190"},{"label":"Harry potter","value":"168"},{"label":"Hentai","value":"282"},{"label":"Marvel","value":"194"},{"label":"Marvel","value":"174"},{"label":"Milf","value":"167"},{"label":"Mj","value":"401"}],"type":FilterTypes.CheckboxGroup},"fandoms":{"label":"Фэндом: все фэндомы любой фэндом","value":[],"options":[{"label":"Аватар: Легенда о Корре / Avatar legend of Korra","value":"46"},{"label":"Аватар: Легенда об Аанге / Avatar: The Legend of Aang / Avatar: The Last Airbender","value":"45"},{"label":"Аладдин / Aladdin","value":"86"},{"label":"Алиса в Стране чудес / Alice in Wonderland","value":"90"},{"label":"Американский папаша / American Dad","value":"85"},{"label":"Атака титанов / Атака на титанов / Attack on Titan","value":"41"},{"label":"Блич / Bleach","value":"58"},{"label":"Боевой континент","value":"101"},{"label":"Большой куш / One Piece","value":"18"},{"label":"Боруто: Новое поколение Наруто / Boruto: Naruto Next Generations","value":"9"},{"label":"Бэтмен / The Batman","value":"36"},{"label":"Ведьмак / The Witcher","value":"53"},{"label":"Военная хроника маленькой девочки","value":"100"},{"label":"Волейбол / Haikyu!!","value":"37"},{"label":"Вселенная Марвел / Marvel Universe","value":"7"},{"label":"Вселенная Марвел / Marvel Universe / Marvel Comics","value":"52"},{"label":"Вселенная Стивена","value":"61"},{"label":"Вселенная DC / DC Universe / DC Comics","value":"48"},{"label":"Гарри Поттер / Harry Potter","value":"4"},{"label":"Гоэтия / Гоетия / Yοητεία / Ars Goetia","value":"77"},{"label":"Демоны старшей школы / High School DxD","value":"10"},{"label":"День сурка / Groundhog Day","value":"3"},{"label":"Джессика Джонс / Marvel's Jessica Jones","value":"42"},{"label":"Дисней / The Walt Disney Company","value":"74"},{"label":"Древние свитки: Скайрим / TES: Skyrim","value":"15"},{"label":"Дэдпул / Deadpool","value":"22"},{"label":"Дэнни-призрак / Danny Phantom","value":"51"},{"label":"Железный человек / Iron Man","value":"19"},{"label":"Звёздная принцесса и силы зла / Стар против сил зла / Star vs. The Forces of Evil","value":"50"},{"label":"Звездные Войны / Star Wars","value":"43"},{"label":"Звёздные Войны / Star Wars","value":"16"},{"label":"Игра престолов","value":"78"},{"label":"Касльвания / Castlevania","value":"29"},{"label":"Киберпанк 2077 / Cyberpunk 2077","value":"6"},{"label":"Код Гиас / Code Geass","value":"84"},{"label":"Кольцо Элдена","value":"60"},{"label":"Королевства Сердец / Kingdom Hearts","value":"93"},{"label":"Красавица и чудовище / Beauty and the Beast","value":"91"},{"label":"Красный, Белый, Черный, Желтый / RWBY","value":"32"},{"label":"Кунг фу панда","value":"81"},{"label":"Лига Легенд / League of Legends","value":"5"},{"label":"Люди Икс / X-Men","value":"25"},{"label":"Ма","value":"104"},{"label":"Маг на полную ставку / Quanzhi Fashi","value":"30"},{"label":"Мастера меча онлайн / Sword Art Online / SAO","value":"47"},{"label":"Мир Тьмы / World of Darkness","value":"28"},{"label":"Мой маленький пони / My Little Pony","value":"72"},{"label":"Мой маленький пони: Дружба — это чудо / My Little Pony: Friendship is Magic","value":"71"},{"label":"Моя геройская академия / Boku no Hero Academia","value":"8"},{"label":"Мстители / The Avengers","value":"20"},{"label":"Мстители. Эра Альтрона / The Avengers. Age of Ultron","value":"24"},{"label":"Мулан / Mulan","value":"94"},{"label":"Наруто / Naruto","value":"2"},{"label":"Овервотч","value":"79"},{"label":"Поднятие уровня в одиночку","value":"87"},{"label":"Порновселенная / Porn Universe","value":"31"},{"label":"Прототип / Prototype","value":"44"},{"label":"Рапунцель: Запутанная история / Tangled","value":"96"},{"label":"Розовая пора моей школьной жизни сплошной обман / Yahari Ore no Seishun Love Come wa Machigatteiru","value":"14"},{"label":"Русалочка / The Little Mermaid","value":"97"},{"label":"Сага о Винланде","value":"66"},{"label":"Светлячок / Firefly","value":"76"},{"label":"Сильнейший в истории ученик Кэнити / Shijou Saikyou no Deshi Kenichi","value":"13"},{"label":"Симпсоны / The Simpsons","value":"73"},{"label":"Судьба: Великий Приказ / Fate: Grand Order","value":"54"},{"label":"Супергёрл(телесериал, 2015) / Supergirl","value":"95"},{"label":"Супермен / Superman","value":"1"},{"label":"Теория большого взрыва / The Big Bang Theory","value":"75"},{"label":"Тор / Thor","value":"27"},{"label":"У Коми-сан проблемы с общением / 古見さんは、コミュ症です / Komi Can't Communicate","value":"11"},{"label":"Убийца Акаме / Akame ga Kill","value":"40"},{"label":"Уэнздей / Wednesday","value":"26"},{"label":"Фантастическая четвёрка / Fantastic Four","value":"21"},{"label":"Флэш / The Flash","value":"17"},{"label":"Хвост Феи / Fairy Tail","value":"59"},{"label":"Холодное сердце / Frozen","value":"92"},{"label":"Человек одного удара / Ванпанчмен / One Punch-Man","value":"39"},{"label":"Человек-паук / Spider-Man","value":"23"},{"label":"Чёрный зверь / Чёрный Пёс / Kuroinu","value":"35"},{"label":"Чёрный зверь: Развращение Благородных Воительниц / Black Beast: Corruption of the Noble Warriors","value":"34"},{"label":"Школа мертвецов","value":"67"},{"label":"Школа строгого режима / Prison School","value":"12"},{"label":"Эффект Массы / Mass Effect","value":"57"},{"label":"Юные Титаны / Teen Titans","value":"49"},{"label":"Ars Goetia | Gods and Demons","value":"69"},{"label":"Biohazard","value":"99"},{"label":"CD","value":"103"},{"label":"CL","value":"70"},{"label":"Daraku Reijou Hakoiri Ojou-sama Netorare Choukyou Kiroku","value":"55"},{"label":"Doom","value":"64"},{"label":"Granblue fantasy","value":"88"},{"label":"Halo","value":"80"},{"label":"Highschool of the Dead/Школа мертвецов","value":"68"},{"label":"JK Bitch ni Shiboraretai","value":"56"},{"label":"Monogatari Series","value":"65"},{"label":"Monster girl quest","value":"62"},{"label":"Over","value":"102"},{"label":"Rapunzel/Рапунцель","value":"83"},{"label":"Resident Evil","value":"98"},{"label":"Solo leveling","value":"63"},{"label":"Tentacle Locker","value":"89"},{"label":"X-COM","value":"82"}],"type":FilterTypes.CheckboxGroup}},"versionIncrements":1});
export default plugin;