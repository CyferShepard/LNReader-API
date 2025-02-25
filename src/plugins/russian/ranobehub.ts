import { Plugin } from '@typings/plugin.ts';
import { FilterTypes, Filters } from '@libs/filterInputs.ts';
import { fetchApi } from '@libs/fetch.ts';
import { NovelStatus } from '@libs/novelStatus.ts';
import dayjs from 'npm:dayjs';

const statusKey: Record<number, string> = {
  1: NovelStatus.Ongoing,
  2: NovelStatus.Completed,
  3: NovelStatus.OnHiatus,
};

class RNBH implements Plugin.PluginBase {
  id = 'RNBH.org';
  name = 'RanobeHub';
  version = '1.0.2';
  site = 'https://ranobehub.org';
  icon = 'src/ru/ranobehub/icon.png';

  async popularNovels(
    pageNo: number,
    {
      showLatestNovels,
      filters,
    }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    let url = this.site + '/api/search?page=' + pageNo + '&sort=';
    url += showLatestNovels
      ? 'last_chapter_at'
      : filters?.sort?.value || 'computed_rating';
    url += '&status=' + (filters?.status?.value ? filters?.status?.value : '0');

    if (filters) {
      if (filters.country?.value?.length) {
        url += '&country=' + filters.country.value.join(',');
      }

      const includeTags = [
        filters.tags?.value?.include,
        filters.events?.value?.include,
      ]
        .flat()
        .filter(t => t);

      if (includeTags.length) {
        url += '&tags:positive=' + includeTags.join(',');
      }

      const excludeTags = [
        filters.tags?.value?.exclude,
        filters.events?.value?.exclude,
      ]
        .flat()
        .filter(t => t);

      if (excludeTags.length) {
        url += '&tags:negative=' + excludeTags.join(',');
      }
    }
    const { resource }: { resource: responseNovels[] } = await fetchApi(
      url + '&take=40',
    ).then(res => res.json());

    const novels: Plugin.NovelItem[] = [];
    resource.forEach(novel =>
      novels.push({
        name: novel.names.rus || novel.names.eng || novel.names.original,
        cover: novel.poster.medium,
        path: novel.id.toString(),
      }),
    );

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const { data }: { data: responseNovel } = await fetchApi(
      this.site + '/api/ranobe/' + novelPath,
    ).then(res => res.json());

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: data.names.rus || data.names.eng || '',
      cover: data.posters.medium,
      summary: data.description.trim(),
      author: data?.authors?.[0]?.name_eng || '',
      status: statusKey[data.status.id] || NovelStatus.Unknown,
    };

    const tags = [data.tags.events, data.tags.genres]
      .flat()
      .map(tags => tags?.names?.rus || tags?.names?.eng || tags?.title)
      .filter(tags => tags);

    if (tags.length) {
      novel.genres = tags.join(', ');
    }

    const chapters: Plugin.ChapterItem[] = [];
    const chaptersJSON: { volumes: VolumesEntity[] } = await fetchApi(
      this.site + '/api/ranobe/' + novelPath + '/contents',
    ).then(res => res.json());

    chaptersJSON.volumes.forEach(volume =>
      volume.chapters?.forEach(chapter =>
        chapters.push({
          name: chapter.name,
          path: novelPath + '/' + volume.num + '/' + chapter.num,
          releaseTime: dayjs(parseInt(chapter.changed_at, 10) * 1000).format(
            'LLL',
          ),
          chapterNumber: chapters.length + 1,
        }),
      ),
    );

    novel.chapters = chapters;
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const body = await fetchApi(this.resolveUrl(chapterPath)).then(res =>
      res.text(),
    );

    const indexA = body.indexOf('<div class="title-wrapper">');
    const indexB = body.indexOf('<div class="ui text container"', indexA);

    const chapterText = body
      .substring(indexA, indexB)
      .replace(/<img data-media-id="(.*?)".*?>/g, '<img src="/api/media/$1">');

    return chapterText;
  }

  async searchNovels(searchTerm: string): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}/api/fulltext/global?query=${searchTerm}&take=10`;
    const result: responseSearch[] = await fetchApi(url).then(res =>
      res.json(),
    );
    const novels: Plugin.NovelItem[] = [];

    result
      ?.find(item => item?.meta?.key === 'ranobe')
      ?.data?.forEach(novel =>
        novels.push({
          name:
            novel?.names?.rus ||
            novel?.names?.eng ||
            novel.name ||
            novel?.names?.original ||
            '',
          path: novel.id.toString(),
          cover: novel?.image?.replace('/small', '/medium'),
        }),
      );

    return novels;
  }

  resolveUrl = (path: string) => this.site + '/ranobe/' + path;

  filters = {
    sort: {
      label: 'Сортировка',
      value: 'computed_rating',
      options: [
        { label: 'по рейтингу', value: 'computed_rating' },
        { label: 'по дате обновления', value: 'last_chapter_at' },
        { label: 'по дате добавления', value: 'created_at' },
        { label: 'по названию', value: 'name_rus' },
        { label: 'по просмотрам', value: 'views' },
        { label: 'по количеству глав', value: 'count_chapters' },
        { label: 'по объему перевода', value: 'count_of_symbols' },
      ],
      type: FilterTypes.Picker,
    },
    status: {
      label: 'Статус перевода',
      value: '',
      options: [
        { label: 'Любой', value: '' },
        { label: 'В процессе', value: '1' },
        { label: 'Завершено', value: '2' },
        { label: 'Заморожено', value: '3' },
        { label: 'Неизвестно', value: '4' },
      ],
      type: FilterTypes.Picker,
    },
    country: {
      label: 'Тип',
      value: [],
      options: [
        { label: 'Китай', value: '2' },
        { label: 'Корея', value: '3' },
        { label: 'США', value: '4' },
        { label: 'Япония', value: '1' },
      ],
      type: FilterTypes.CheckboxGroup,
    },
    events: {
      label: 'События',
      value: { include: [], exclude: [] },
      options: [
        { label: '[Награжденная работа]', value: '611' },
        { label: '18+', value: '338' },
        { label: 'Авантюристы', value: '353' },
        { label: 'Автоматоны', value: '538' },
        { label: 'Агрессивные персонажи', value: '434' },
        { label: 'Ад', value: '509' },
        { label: 'Адаптация в радиопостановку', value: '522' },
        { label: 'Академия', value: '25' },
        { label: 'Актеры озвучки', value: '578' },
        { label: 'Активный главный герой', value: '132' },
        { label: 'Алхимия', value: '116' },
        { label: 'Альтернативный мир', value: '28' },
        { label: 'Амнезия/Потеря памяти', value: '247' },
        { label: 'Анабиоз', value: '657' },
        { label: 'Ангелы', value: '218' },
        { label: 'Андрогинные персонажи', value: '217' },
        { label: 'Андроиды', value: '82' },
        { label: 'Анти-магия', value: '471' },
        { label: 'Антигерой', value: '346' },
        { label: 'Антикварный магазин', value: '572' },
        { label: 'Антисоциальный главный герой', value: '562' },
        { label: 'Антиутопия', value: '663' },
        { label: 'Апатичный протагонист', value: '29' },
        { label: 'Апокалипсис', value: '314' },
        { label: 'Аранжированный брак', value: '285' },
        { label: 'Армия', value: '598' },
        { label: 'Артефакты', value: '117' },
        { label: 'Артисты', value: '460' },
        { label: 'Банды', value: '581' },
        { label: 'БДСМ', value: '676' },
        { label: 'Бедный главный герой', value: '309' },
        { label: 'Безжалостный главный герой', value: '144' },
        { label: 'Беззаботный главный герой', value: '355' },
        { label: 'Безусловная любовь', value: '650' },
        { label: 'Беременность', value: '131' },
        { label: 'Бесполый главный герой', value: '222' },
        { label: 'Бессмертные', value: '275' },
        { label: 'Бесстрашный протагонист', value: '619' },
        { label: 'Бесстыдный главный герой', value: '256' },
        { label: 'Бесчестный главный герой', value: '699' },
        { label: 'Библиотека', value: '342' },
        { label: 'Бизнесмен ', value: '813' },
        { label: 'Биочип', value: '120' },
        { label: 'Бисексуальный главный герой', value: '822' },
        { label: 'Близнецы', value: '148' },
        { label: 'Боги', value: '211' },
        { label: 'Богини', value: '356' },
        { label: 'Боевая академия', value: '369' },
        { label: 'Боевые духи', value: '347' },
        { label: 'Боевые соревнования', value: '422' },
        { label: 'Божественная защита', value: '336' },
        { label: 'Божественные силы', value: '224' },
        {
          label:
            'Большая разница в возрасте между героем и его любовным интересом',
          value: '348',
        },
        { label: 'Борьба за власть', value: '544' },
        { label: 'Брак', value: '363' },
        { label: 'Брак по расчету', value: '65' },
        { label: 'Братский комплекс', value: '31' },
        { label: 'Братство', value: '413' },
        { label: 'Братья и сестры', value: '518' },
        { label: 'Буддизм', value: '742' },
        { label: 'Быстрая культивация', value: '273' },
        { label: 'Быстрообучаемый', value: '221' },
        { label: 'Валькирии', value: '667' },
        { label: 'Вампиры', value: '266' },
        { label: 'Ваншот', value: '679' },
        { label: 'Ведьмы', value: '169' },
        { label: 'Вежливый главный герой', value: '289' },
        { label: 'Верные подчиненные', value: '225' },
        { label: 'Взрослый главный герой', value: '183' },
        { label: 'Видит то, чего не видят другие', value: '636' },
        { label: 'Виртуальная реальность', value: '313' },
        { label: 'Владелец магазина', value: '653' },
        { label: 'Внезапная сила', value: '376' },
        { label: 'Внезапное богатство', value: '802' },
        {
          label: 'Внешний вид отличается от фактического возраста',
          value: '334',
        },
        { label: 'Военные Летописи', value: '740' },
        { label: 'Возвращение из другого мира', value: '673' },
        { label: 'Войны', value: '58' },
        { label: 'Вокалоид', value: '678' },
        { label: 'Волшебники/Волшебницы', value: '477' },
        { label: 'Волшебные звери', value: '201' },
        { label: 'Воображаемый друг', value: '614' },
        { label: 'Воры', value: '326' },
        { label: 'Воскрешение', value: '78' },
        { label: 'Враги становятся возлюбленными', value: '428' },
        { label: 'Враги становятся союзниками', value: '502' },
        { label: 'Врата в другой мир', value: '558' },
        { label: 'Врачи', value: '286' },
        { label: 'Временной парадокс', value: '163' },
        { label: 'Всемогущий главный герой', value: '42' },
        { label: 'Вторжение на землю', value: '77' },
        { label: 'Второй шанс', value: '112' },
        { label: 'Вуайеризм', value: '851' },
        { label: 'Выживание', value: '290' },
        { label: 'Высокомерные персонажи', value: '268' },
        { label: 'Гадание', value: '540' },
        { label: 'Гарем рабов', value: '828' },
        { label: 'Геймеры', value: '302' },
        { label: 'Генералы', value: '223' },
        { label: 'Генетические модификации', value: '620' },
        { label: 'Гениальный главный герой', value: '566' },
        { label: 'Герои', value: '173' },
        { label: 'Героиня — сорванец', value: '525' },
        { label: 'Герой влюбляется первым', value: '64' },
        { label: 'Гетерохромия', value: '510' },
        { label: 'Гильдии', value: '323' },
        { label: 'Гипнотизм', value: '768' },
        { label: 'Главный герой — бог', value: '486' },
        { label: 'Главный герой — гуманоид', value: '595' },
        { label: 'Главный герой — женщина', value: '63' },
        { label: 'Главный герой — мужчина', value: '39' },
        { label: 'Главный герой — наполовину человек', value: '362' },
        { label: 'Главный герой — отец', value: '859' },
        { label: 'Главный герой — раб', value: '832' },
        { label: 'Главный герой — ребенок', value: '415' },
        { label: 'Главный герой — рубака', value: '400' },
        { label: 'Главный герой — собиратель гарема', value: '439' },
        { label: 'Главный герой влюбляется первым', value: '655' },
        { label: 'Главный герой играет роль', value: '396' },
        { label: 'Главный герой носит очки', value: '637' },
        { label: 'Главный герой пацифист', value: '675' },
        { label: 'Главный герой с несколькими телами', value: '628' },
        { label: 'Главный герой силен с самого начала', value: '45' },
        { label: 'Гладиаторы', value: '549' },
        { label: 'Глуповатый главный герой', value: '295' },
        { label: 'Гоблины', value: '529' },
        { label: 'Големы', value: '569' },
        { label: 'Гомункул', value: '850' },
        { label: 'Горничные', value: '380' },
        { label: 'Госпиталь', value: '1043' },
        { label: 'Готовка', value: '193' },
        { label: 'Гриндинг', value: '303' },
        { label: 'Дао Компаньон', value: '384' },
        { label: 'Даосизм', value: '792' },
        { label: 'Дарк', value: '151' },
        { label: 'Дварфы', value: '220' },
        { label: 'Двойная личность', value: '601' },
        { label: 'Двойник', value: '547' },
        { label: 'Дворецкий', value: '623' },
        { label: 'Дворяне', value: '41' },
        { label: 'Дворянство/Аристократия', value: '354' },
        { label: 'Девушки-монстры', value: '634' },
        { label: 'Демоническая техника культивации', value: '706' },
        { label: 'Демоны', value: '6' },
        { label: 'Денежный долг', value: '841' },
        { label: 'Депрессия', value: '494' },
        { label: 'Детективы', value: '561' },
        { label: 'Дискриминация', value: '34' },
        {
          label: 'Добыча денег одно из основных стремлений главного героя',
          value: '307',
        },
        { label: 'Долгая разлука', value: '200' },
        { label: 'Домашние дела', value: '178' },
        { label: 'Домогательство', value: '394' },
        { label: 'Драконы', value: '195' },
        { label: 'Драконьи всадники', value: '555' },
        { label: 'Древние времена', value: '102' },
        { label: 'Древний Китай', value: '284' },
        { label: 'Дружба', value: '97' },
        { label: 'Друзья детства', value: '170' },
        { label: 'Друзья становятся врагами', value: '507' },
        { label: 'Друиды', value: '427' },
        { label: 'Дух лисы', value: '842' },
        { label: 'Духи/Призраки', value: '46' },
        { label: 'Духовный советник', value: '351' },
        { label: 'Душевность', value: '587' },
        { label: 'Души', value: '136' },
        { label: 'Европейская атмосфера', value: '457' },
        { label: 'Ёкаи', value: '516' },
        { label: 'Есть аниме-адаптация', value: '26' },
        { label: 'Есть видеоигра по мотивам', value: '491' },
        { label: 'Есть манга-адаптация', value: '27' },
        { label: 'Есть манхва-адаптация', value: '453' },
        { label: 'Есть маньхуа-адаптация', value: '298' },
        { label: 'Есть сериал-адаптация', value: '421' },
        { label: 'Есть фильм по мотивам', value: '47' },
        { label: 'Женища-наставник', value: '438' },
        { label: 'Жертва изнасилования влюбляется в насильника', value: '414' },
        { label: 'Жесткая, двуличная личность', value: '249' },
        { label: 'Жестокие персонажи', value: '436' },
        { label: 'Жестокое обращение с ребенком', value: '617' },
        { label: 'Жестокость', value: '127' },
        { label: 'Животноводство', value: '765' },
        { label: 'Животные черты', value: '466' },
        { label: 'Жизнь в квартире', value: '554' },
        { label: 'Жрицы', value: '564' },
        { label: 'Заботливый главный герой', value: '176' },
        { label: 'Забывчивый главный герой', value: '579' },
        { label: 'Заговоры', value: '177' },
        { label: 'Закалка тела', value: '269' },
        { label: 'Законники', value: '769' },
        { label: 'Замкнутый главный герой', value: '533' },
        { label: 'Запечатанная сила', value: '344' },
        { label: 'Застенчивые персонажи', value: '443' },
        { label: 'Звери', value: '119' },
        { label: 'Звери-компаньоны', value: '192' },
        { label: 'Злой протагонист', value: '125' },
        { label: 'Злые боги', value: '437' },
        { label: 'Злые организации', value: '503' },
        { label: 'Злые религии', value: '725' },
        { label: 'Знаменитости', value: '397' },
        { label: 'Знаменитый главный герой', value: '469' },
        { label: 'Знания современного мира', value: '185' },
        { label: 'Зомби', value: '321' },
        { label: 'Игра на выживание', value: '162' },
        { label: 'Игривый протагонист', value: '700' },
        { label: 'Игровая система рейтинга', value: '301' },
        { label: 'Игровые элементы', value: '152' },
        { label: 'Игрушки (18+)', value: '644' },
        { label: 'Из грязи в князи', value: '330' },
        { label: 'Из женщины в мужчину ', value: '688' },
        { label: 'Из мужчины в женщину', value: '698' },
        { label: 'Из полного в худого', value: '809' },
        { label: 'Из слабого в сильного', value: '81' },
        { label: 'Из страшно(го/й) в красиво(го/ю)', value: '810' },
        { label: 'Извращенный главный герой', value: '349' },
        { label: 'Изгои', value: '472' },
        { label: 'Изменение расы', value: '627' },
        { label: 'Изменения внешнего вида', value: '191' },
        { label: 'Изменения личности', value: '99' },
        { label: 'Изнасилование', value: '110' },
        { label: 'Изображения жестокости', value: '260' },
        { label: 'Империи', value: '749' },
        { label: 'Инвалидность', value: '656' },
        { label: 'Индустриализация', value: '180' },
        { label: 'Инженер', value: '35' },
        { label: 'Инцест', value: '463' },
        { label: 'Искусственный интеллект', value: '118' },
        { label: 'Исследования', value: '635' },
        { label: 'Каннибализм', value: '377' },
        { label: 'Карточные игры', value: '654' },
        { label: 'Киберспорт', value: '658' },
        { label: 'Кланы', value: '950' },
        { label: 'Класс безработного [Игровой класс в игре]', value: '727' },
        { label: 'Клоны', value: '365' },
        { label: 'Клубы', value: '96' },
        { label: 'Книги', value: '341' },
        { label: 'Книги навыков', value: '312' },
        { label: 'Книжный червь', value: '455' },
        { label: 'Коварство', value: '111' },
        { label: 'Коллеги', value: '683' },
        { label: 'Колледж/Университет', value: '712' },
        { label: 'Кома', value: '826' },
        { label: 'Командная работа', value: '426' },
        { label: 'Комедийный оттенок', value: '523' },
        { label: 'Комплекс неполноценности', value: '489' },
        { label: 'Комплекс семейных отношений', value: '104' },
        { label: 'Конкуренция', value: '746' },
        { label: 'Контракты', value: '483' },
        { label: 'Контроль разума/сознания', value: '262' },
        { label: 'Копейщик', value: '339' },
        { label: 'Королевская битва', value: '1025' },
        { label: 'Королевская власть', value: '53' },
        { label: 'Королевства', value: '141' },
        { label: 'Коррупция', value: '378' },
        { label: 'Космические войны', value: '674' },
        { label: 'Красивый герой', value: '107' },
        { label: 'Крафт', value: '287' },
        { label: 'Кризис личности', value: '599' },
        { label: 'Кругосветное путешествие', value: '257' },
        { label: 'Кудере', value: '440' },
        { label: 'Кузены', value: '701' },
        { label: 'Кузнец', value: '454' },
        { label: 'Кукловоды', value: '431' },
        { label: 'Куклы/марионетки', value: '573' },
        { label: 'Культивация', value: '123' },
        { label: 'Куннилингус', value: '632' },
        { label: 'Легенды', value: '430' },
        { label: 'Легкая жизнь', value: '604' },
        { label: 'Ленивый главный герой', value: '570' },
        { label: 'Лидерство', value: '424' },
        { label: 'Лоли', value: '92' },
        { label: 'Лотерея', value: '401' },
        { label: 'Любовный интерес влюбляется первым', value: '647' },
        { label: 'Любовный интерес главного героя носит очки', value: '576' },
        { label: 'Любовный треугольник', value: '98' },
        { label: 'Любовь детства', value: '500' },
        { label: 'Любовь с первого взгляда', value: '730' },
        { label: 'Магические надписи', value: '373' },
        { label: 'Магические печати', value: '277' },
        { label: 'Магические технологии', value: '357' },
        {
          label:
            'Магическое пространство/измерение, доступное не всем персонажам',
          value: '244',
        },
        { label: 'Магия', value: '38' },
        { label: 'Магия призыва', value: '333' },
        { label: 'Мазохистские персонажи', value: '660' },
        { label: 'Манипулятивные персонажи', value: '130' },
        { label: 'Мания', value: '91' },
        { label: 'Мастер на все руки', value: '390' },
        { label: 'Мастурбация', value: '846' },
        { label: 'Махо-сёдзё', value: '496' },
        { label: 'Медицинские знания', value: '441' },
        { label: 'Медленная романтическая линия', value: '113' },
        { label: 'Медленное развитие на старте ', value: '670' },
        { label: 'Межпространственные путешествия', value: '316' },
        { label: 'Менеджмент', value: '182' },
        { label: 'Мертвый главный герой', value: '794' },
        { label: 'Месть', value: '88' },
        { label: 'Метаморфы', value: '234' },
        { label: 'Меч и магия', value: '55' },
        { label: 'Мечник', value: '607' },
        { label: 'Мечты', value: '733' },
        { label: 'Милая история', value: '709' },
        { label: 'Милое дитя', value: '596' },
        { label: 'Милый главный герой', value: '697' },
        { label: 'Мировое дерево', value: '385' },
        { label: 'Мистический ореол вокруг семьи', value: '409' },
        { label: 'Мифические звери', value: '418' },
        { label: 'Мифология', value: '468' },
        { label: 'Младшие братья', value: '843' },
        { label: 'Младшие сестры', value: '465' },
        { label: 'ММОРПГ (ЛитРПГ)', value: '306' },
        { label: 'Множество перемещенных людей', value: '488' },
        { label: 'Множество реальностей', value: '278' },
        { label: 'Множество реинкарнированных людей', value: '227' },
        { label: 'Модели', value: '649' },
        { label: 'Молчаливый персонаж', value: '705' },
        { label: 'Монстры', value: '69' },
        { label: 'Мужская гей-пара', value: '685' },
        { label: 'Мужчина-яндере', value: '155' },
        { label: 'Музыка', value: '589' },
        { label: 'Музыкальные группы', value: '588' },
        { label: 'Мутации', value: '668' },
        { label: 'Мутированные существа', value: '317' },
        { label: 'Навык кражи', value: '626' },
        { label: 'Навязчивая любовь', value: '85' },
        { label: 'Наемники', value: '324' },
        { label: 'Назойливый возлюбленный', value: '501' },
        { label: 'Наивный главный герой', value: '66' },
        { label: 'Наркотики', value: '661' },
        { label: 'Нарциссический главный герой', value: '470' },
        { label: 'Насилие сексуального характера', value: '824' },
        { label: 'Наследование', value: '372' },
        { label: 'Национализм', value: '318' },
        { label: 'Не блещущий внешне главный герой', value: '328' },
        { label: 'Не родные братья и сестры', value: '464' },
        { label: 'Небеса', value: '508' },
        { label: 'Небесное испытание', value: '274' },
        { label: 'Негуманоидный главный герой', value: '622' },
        { label: 'Недоверчивый главный герой', value: '485' },
        { label: 'Недооцененный главный герой', value: '140' },
        { label: 'Недоразумения', value: '202' },
        { label: 'Неизлечимая болезнь', value: '75' },
        { label: 'Некромант', value: '308' },
        { label: 'Нелинейная история', value: '157' },
        { label: 'Ненавистный главный герой', value: '487' },
        { label: 'Ненадежный рассказчик', value: '165' },
        { label: 'Нерезиденты', value: '821' },
        { label: 'Нерешительный главный герой', value: '741' },
        { label: 'Несерьезный главный герой', value: '294' },
        { label: 'Несколько временных линий', value: '517' },
        { label: 'Несколько главных героев', value: '475' },
        { label: 'Несколько идентичностей', value: '615' },
        { label: 'Несколько личностей', value: '474' },
        { label: 'Нетораре', value: '721' },
        { label: 'Нетори', value: '450' },
        { label: 'Неудачливый главный герой', value: '567' },
        { label: 'Ниндзя', value: '358' },
        { label: 'Обещание из детства', value: '738' },
        { label: 'Обманщик', value: '411' },
        { label: 'Обмен телами', value: '94' },
        { label: 'Обнаженка', value: '417' },
        { label: 'Обольщение', value: '718' },
        { label: 'Оборотни', value: '624' },
        { label: 'Обратный гарем', value: '255' },
        { label: 'Общество монстров', value: '226' },
        { label: 'Обязательство', value: '548' },
        { label: 'Огнестрельное оружие', value: '179' },
        { label: 'Ограниченная продолжительность жизни', value: '73' },
        { label: 'Одержимость', value: '447' },
        { label: 'Одинокий главный герой', value: '304' },
        { label: 'Одиночество', value: '199' },
        { label: 'Одиночное проживание', value: '207' },
        { label: 'Околосмертные переживания', value: '773' },
        { label: 'Оммёдзи', value: '542' },
        { label: 'Омоложение', value: '237' },
        { label: 'Организованная преступность', value: '478' },
        { label: 'Оргия', value: '825' },
        { label: 'Орки', value: '228' },
        { label: 'Освоение навыков', value: '235' },
        { label: 'Основано на аниме', value: '553' },
        { label: 'Основано на видео игре', value: '704' },
        { label: 'Основано на визуальной новелле ', value: '861' },
        { label: 'Основано на песне', value: '677' },
        { label: 'Основано на фильме', value: '552' },
        { label: 'Осторожный главный герой', value: '122' },
        { label: 'Отаку', value: '512' },
        { label: 'Открытый космос', value: '150' },
        { label: 'Отношения в сети', value: '713' },
        { label: 'Отношения между богом и человеком', value: '603' },
        { label: 'Отношения между людьми и нелюдьми', value: '205' },
        { label: 'Отношения на расстоянии', value: '852' },
        { label: 'Отношения начальник-подчиненный', value: '590' },
        { label: 'Отношения Сенпай-Коухай', value: '513' },
        { label: 'Отношения ученика и учителя', value: '451' },
        { label: 'Отношения учитель-ученик', value: '343' },
        { label: 'Отношения хозяин-слуга', value: '206' },
        { label: 'Отомэ игра', value: '723' },
        { label: 'Отсутствие здравого смысла', value: '605' },
        { label: 'Отсутствие родителей', value: '575' },
        { label: 'Офисный роман', value: '686' },
        { label: 'Официанты', value: '681' },
        { label: 'Охотники', value: '288' },
        { label: 'Очаровательный главный герой', value: '659' },
        { label: 'Падшее дворянство', value: '618' },
        { label: 'Падшие ангелы', value: '505' },
        { label: 'Пайзури', value: '630' },
        { label: 'Паразиты', value: '535' },
        { label: 'Параллельные миры', value: '86' },
        { label: 'Парк развлечений', value: '586' },
        { label: 'Пародия', value: '319' },
        { label: 'Певцы/Певицы', value: '734' },
        { label: 'Первая любовь', value: '716' },
        { label: 'Первоисточник новеллы — манга', value: '560' },
        { label: 'Первый раз', value: '845' },
        {
          label:
            'Перемещение в другой мир, имея при себе современные достижения',
          value: '732',
        },
        { label: 'Перемещение в игровой мир', value: '532' },
        { label: 'Перемещение в иной мир', value: '754' },
        { label: 'Перерождение в ином мире', value: '755' },
        { label: 'Переселение души/Трансмиграция', value: '139' },
        { label: 'Персонаж использует щит', value: '631' },
        { label: 'Петля времени', value: '79' },
        { label: 'Пираты', value: '817' },
        { label: 'Писатели', value: '408' },
        { label: 'Питомцы', value: '253' },
        { label: 'Племенное общество', value: '291' },
        { label: 'Повелитель демонов', value: '171' },
        {
          label: 'Повествование от нескольких лиц/Несколько точек зрения',
          value: '156',
        },
        { label: 'Подземелья', value: '219' },
        { label: 'Пожелания', value: '166' },
        { label: 'Познание Дао', value: '360' },
        { label: 'Покинутое дитя', value: '534' },
        { label: 'Полигамия', value: '296' },
        { label: 'Политика', value: '43' },
        { label: 'Полиция', value: '801' },
        { label: 'Полулюди', value: '335' },
        { label: 'Пользователь уникального оружия', value: '432' },
        { label: 'Популярный любовный интерес', value: '241' },
        { label: 'Постапокалиптика', value: '60' },
        { label: 'Потерянные цивилизации', value: '751' },
        { label: 'Похищения людей', value: '707' },
        { label: 'Поэзия', value: '404' },
        { label: 'Правонарушители', value: '694' },
        { label: 'Прагматичный главный герой', value: '536' },
        { label: 'Преданный любовный интерес', value: '106' },
        { label: 'Предательство', value: '103' },
        { label: 'Предвидение', value: '52' },
        { label: 'Прекрасная героиня', value: '30' },
        { label: 'Преступники', value: '728' },
        { label: 'Преступность', value: '83' },
        { label: 'Призванный герой', value: '147' },
        { label: 'Призраки', value: '51' },
        { label: 'Принуждение к отношениям', value: '602' },
        { label: 'Принцессы', value: '933' },
        { label: 'Притворная пара', value: '600' },
        { label: 'Причудливые персонажи', value: '297' },
        { label: 'Пришельцы/Инопланетяне', value: '76' },
        { label: 'Программист', value: '666' },
        { label: 'Проклятия', value: '48' },
        { label: 'Промывание мозгов', value: '519' },
        { label: 'Пропуск времени', value: '138' },
        { label: 'Пророчества', value: '429' },
        { label: 'Проститутки', value: '844' },
        { label: 'Пространственное манипулирование', value: '375' },
        { label: 'Прошлое играет большую роль', value: '215' },
        { label: 'Прыжки между мирами', value: '737' },
        { label: 'Психические силы', value: '265' },
        { label: 'Психопаты', value: '158' },
        { label: 'Путешествие во времени', value: '80' },
        { label: 'Пытка', value: '168' },
        { label: 'Рабы', value: '829' },
        { label: 'Развод', value: '771' },
        { label: 'Разумные предметы', value: '174' },
        { label: 'Расизм', value: '320' },
        { label: 'Рассказ', value: '61' },
        { label: 'Расторжения помолвки', value: '243' },
        { label: 'Расы зооморфов', value: '209' },
        { label: 'Ревность', value: '717' },
        { label: 'Редакторы', value: '684' },
        { label: 'Реинкарнация', value: '281' },
        { label: 'Реинкарнация в монстра', value: '204' },
        { label: 'Реинкарнация в объект', value: '692' },
        { label: 'Религии', value: '565' },
        { label: 'Репортеры', value: '837' },
        { label: 'Ресторан', value: '652' },
        { label: 'Решительный главный герой', value: '124' },
        { label: 'Робкий главный герой', value: '800' },
        { label: 'Родитель одиночка', value: '687' },
        { label: 'Родительский комплекс', value: '531' },
        { label: 'Родословная', value: '121' },
        { label: 'Романтический подсюжет ', value: '159' },
        { label: 'Рост персонажа', value: '95' },
        { label: 'Рыцари', value: '142' },
        { label: 'Садистские персонажи', value: '642' },
        { label: 'Самоотверженный главный герой', value: '748' },
        { label: 'Самоубийства', value: '616' },
        { label: 'Самурай', value: '646' },
        { label: 'Сборник коротких историй', value: '456' },
        { label: 'Связанные сюжетные линии', value: '473' },
        { label: 'Святые', value: '761' },
        { label: 'Священники', value: '325' },
        { label: 'Сдержанный главный герой', value: '799' },
        { label: 'Секретные организации', value: '331' },
        { label: 'Секреты', value: '577' },
        { label: 'Секс рабы', value: '830' },
        { label: 'Семейный конфликт', value: '770' },
        { label: 'Семь добродетелей', value: '233' },
        { label: 'Семь смертных грехов', value: '134' },
        { label: 'Семья', value: '251' },
        { label: 'Сёнэн-ай подсюжет ', value: '664' },
        { label: 'Серийные убийцы', value: '497' },
        { label: 'Сестринский комплекс', value: '498' },
        { label: 'Сила духа', value: '282' },
        { label: 'Сила, требующая платы за пользование', value: '520' },
        { label: 'Сильная пара', value: '109' },
        { label: 'Сильный в сильнейшего', value: '359' },
        { label: 'Сильный любовный интерес', value: '161' },
        { label: 'Синдром восьмиклассника', value: '90' },
        { label: 'Сироты', value: '214' },
        { label: 'Система уровней', value: '198' },
        { label: 'Системный администратор', value: '476' },
        { label: 'Скрытие истинной личности', value: '371' },
        { label: 'Скрытие истинных способностей', value: '252' },
        { label: 'Скрытный главный герой', value: '133' },
        { label: 'Скрытые способности', value: '128' },
        { label: 'Скульпторы', value: '366' },
        { label: 'Слабо выраженная романтическая линия', value: '213' },
        { label: 'Слабый главный герой', value: '188' },
        { label: 'Слепой главный герой', value: '864' },
        { label: 'Слуги', value: '232' },
        { label: 'Смерть', value: '49' },
        { label: 'Смерть близких', value: '361' },
        { label: 'Собственнические персонажи', value: '108' },
        { label: 'Современность', value: '40' },
        { label: 'Сожительство', value: '482' },
        { label: 'Создание армии', value: '175' },
        { label: 'Создание артефактов', value: '292' },
        { label: 'Создание клана', value: '448' },
        { label: 'Создание королевства', value: '181' },
        { label: 'Создание навыков', value: '236' },
        { label: 'Создание секты', value: '393' },
        { label: 'Солдаты/Военные', value: '71' },
        { label: 'Сон', value: '571' },
        { label: 'Состоятельные персонажи', value: '67' },
        { label: 'Социальная иерархия на основе силы', value: '137' },
        { label: 'Социальные изгои', value: '480' },
        { label: 'Спасение мира', value: '597' },
        { label: 'Специальные способности', value: '54' },
        { label: 'Спокойный главный герой', value: '32' },
        { label: 'Справедливый главный герой', value: '702' },
        { label: 'Средневековье', value: '184' },
        { label: 'Ссорящаяся пара', value: '293' },
        { label: 'Сталкеры', value: '689' },
        { label: 'Старение', value: '190' },
        { label: 'Стоические персонажи', value: '444' },
        { label: 'Стокгольмский синдром', value: '643' },
        { label: 'Стратег', value: '425' },
        { label: 'Стратегические битвы', value: '160' },
        { label: 'Стратегия', value: '1038' },
        { label: 'Стрелки', value: '458' },
        { label: 'Стрельба из лука', value: '383' },
        { label: 'Студенческий совет', value: '490' },
        { label: 'Судьба', value: '271' },
        { label: 'Суккубы', value: '484' },
        { label: 'Супер герои', value: '1039' },
        { label: 'Суровая подготовка', value: '261' },
        { label: 'Таинственная болезнь', value: '74' },
        { label: 'Таинственное прошлое', value: '263' },
        { label: 'Тайная личность', value: '310' },
        { label: 'Тайные отношения', value: '812' },
        { label: 'Танцоры', value: '840' },
        { label: 'Телохранители', value: '452' },
        { label: 'Тентакли', value: '693' },
        { label: 'Террористы', value: '515' },
        { label: 'Технологический разрыв', value: '621' },
        { label: 'Тихие персонажи', value: '546' },
        { label: 'Толстый главный герой', value: '299' },
        { label: 'Торговцы', value: '416' },
        { label: 'Травля/Буллинг', value: '89' },
        { label: 'Травник', value: '708' },
        { label: 'Трагическое прошлое', value: '164' },
        { label: 'Трансплантация воспоминаний', value: '367' },
        { label: 'Трап (Путаница с гендером персонажа)', value: '582' },
        { label: 'Трудолюбивый главный герой', value: '37' },
        { label: 'Тюрьма', value: '479' },
        { label: 'Убийства', value: '84' },
        { label: 'Убийцы', value: '248' },
        { label: 'Убийцы драконов', value: '606' },
        { label: 'Уверенный главный герой', value: '270' },
        { label: 'Удачливый главный герой', value: '402' },
        { label: 'Укротитель монстров', value: '337' },
        { label: 'Умения из прошлой жизни', value: '280' },
        { label: 'Умная пара', value: '493' },
        { label: 'Умный главный герой', value: '33' },
        { label: 'Уникальная техника Культивации', value: '254' },
        { label: 'Уникальное оружие', value: '340' },
        { label: 'Управление бизнесом', value: '315' },
        { label: 'Управление временем', value: '167' },
        { label: 'Управление кровью', value: '764' },
        { label: 'Упрямый главный герой', value: '672' },
        { label: 'Уродливый главный герой', value: '803' },
        { label: 'Ускоренный рост', value: '300' },
        { label: 'Усыновленные дети', value: '481' },
        { label: 'Усыновленный главный герой', value: '412' },
        { label: 'Уход за детьми', value: '398' },
        { label: 'Учителя', value: '345' },
        { label: 'Фамильяры', value: '541' },
        { label: 'Фанатизм', value: '613' },
        { label: 'Фантастические существа', value: '322' },
        { label: 'Фанфикшн', value: '388' },
        { label: 'Фармацевт', value: '715' },
        { label: 'Фарминг', value: '379' },
        { label: 'Феи', value: '210' },
        { label: 'Фелляция', value: '584' },
        { label: 'Фениксы', value: '374' },
        { label: 'Фетиш груди', value: '499' },
        { label: 'Философия', value: '87' },
        { label: 'Фильмы', value: '403' },
        { label: 'Флэшбэки', value: '528' },
        { label: 'Фобии', value: '100' },
        { label: 'Фольклор', value: '467' },
        { label: 'Футанари', value: '568' },
        { label: 'Футуристический сеттинг', value: '382' },
        { label: 'Фэнтези мир', value: '126' },
        { label: 'Хакеры', value: '399' },
        { label: 'Харизматический герой', value: '391' },
        { label: 'Хикикомори/Затворники', value: '462' },
        { label: 'Хитроумный главный герой', value: '105' },
        { label: 'Хозяин подземелий', value: '557' },
        { label: 'Холодный главный герой', value: '259' },
        { label: 'Хорошие отношения с семьей', value: '506' },
        { label: 'Хранители могил', value: '68' },
        { label: 'Целители', value: '389' },
        { label: 'Цзянши', value: '735' },
        { label: 'Цундэрэ', value: '445' },
        { label: 'Чаты', value: '580' },
        { label: 'Человеческое оружие', value: '521' },
        { label: 'Честный главный герой', value: '240' },
        { label: 'Читы', value: '238' },
        { label: 'Шантаж', value: '526' },
        { label: 'Шеф-повар', value: '239' },
        { label: 'Шикигами', value: '543' },
        { label: 'Школа только для девочек', value: '633' },
        { label: 'Шота', value: '514' },
        { label: 'Шоу-бизнес', value: '407' },
        { label: 'Шпионы', value: '563' },
        { label: 'Эволюция', value: '196' },
        { label: 'Эгоистичный главный герой', value: '539' },
        { label: 'Эйдетическая память', value: '392' },
        { label: 'Экзорсизм', value: '504' },
        { label: 'Экономика', value: '492' },
        { label: 'Эксгибиционизм', value: '639' },
        { label: 'Эксперименты с людьми', value: '129' },
        { label: 'Элементальная магия', value: '395' },
        { label: 'Эльфы', value: '172' },
        { label: 'Эмоционально слабый главный герой', value: '816' },
        { label: 'Эпизодический', value: '612' },
        { label: 'Юный любовный интерес', value: '446' },
        { label: 'Яды', value: '410' },
        { label: 'Языкастые персонажи', value: '406' },
        { label: 'Языковой барьер', value: '59' },
        { label: 'Яндере', value: '208' },
        { label: 'Японские силы самообороны', value: '559' },
        { label: 'Ярко выраженная романтическая линия', value: '272' },
        { label: 'Abusive Characters', value: '625' },
        { label: 'Adapted to Visual Novel', value: '1046' },
        { label: 'Adopted-lead', value: '886' },
        { label: 'Adultery', value: '866' },
        { label: 'Affair', value: '645' },
        { label: 'Age-gap', value: '923' },
        { label: 'Almost-human-lead', value: '975' },
        { label: 'An*l', value: '780' },
        { label: 'Androgynous-male-lead', value: '1002' },
        { label: 'Anti-hero-lead', value: '976' },
        { label: 'Apathetic-lead', value: '967' },
        { label: 'Arms Dealers', value: '839' },
        { label: 'Army-commander', value: '1003' },
        { label: 'Artifact-refining', value: '924' },
        { label: 'Autism', value: '855' },
        { label: 'Awkward Protagonist', value: '669' },
        { label: 'Awkward-lead', value: '892' },
        { label: 'Bestiality', value: '796' },
        { label: 'Big-breasts', value: '908' },
        { label: 'Birth-of-a-nation', value: '1004' },
        { label: 'Bisexual-lead', value: '1027' },
        { label: 'Body-refining', value: '947' },
        { label: 'Body-swap/s', value: '1036' },
        { label: 'Boss-subordinate-relationship', value: '876' },
        { label: 'Bride-kidnapping', value: '948' },
        { label: 'Caring-lead', value: '879' },
        { label: 'Cautious-lead', value: '1032' },
        { label: 'Changed-man', value: '925' },
        { label: 'Charismatic-lead', value: '1005' },
        { label: 'Child-lead', value: '936' },
        { label: 'Clever-lead', value: '880' },
        { label: 'Clumsy Love Interests', value: '815' },
        { label: 'Cold Love Interests', value: '651' },
        { label: 'Coming of Age', value: '860' },
        { label: 'Confident-lead', value: '894' },
        { label: 'Confident-male-lead', value: '951' },
        { label: 'Confinement', value: '767' },
        { label: 'Conflicting Loyalties', value: '793' },
        { label: 'Couple Growth', value: '690' },
        { label: 'Court Official', value: '863' },
        { label: 'Cowardly Protagonist', value: '703' },
        { label: 'Cowardly-lead', value: '1000' },
        { label: 'Cross-dressing', value: '250' },
        { label: 'Cunnilingus', value: '867' },
        { label: 'Cunning-lead', value: '952' },
        { label: 'Cunning-male-lead', value: '953' },
        { label: 'Curious Protagonist', value: '849' },
        { label: 'Cute-lead', value: '887' },
        { label: 'Dense-lead', value: '868' },
        { label: 'Determined-lead', value: '972' },
        { label: 'Developing-technology', value: '1006' },
        { label: 'Devil/s', value: '1007' },
        { label: 'Different Social Status', value: '758' },
        { label: 'Disfigurement', value: '838' },
        { label: 'Doting Love Interests', value: '665' },
        { label: 'Doting Older Siblings', value: '609' },
        { label: 'Doting Parents', value: '530' },
        { label: 'Dungeon/s-exploring', value: '990' },
        { label: 'Elderly Protagonist', value: '774' },
        { label: 'Enlightenment', value: '729' },
        { label: 'Eunuch', value: '1047' },
        { label: 'Eye Powers', value: '386' },
        { label: 'Family Business', value: '785' },
        { label: 'Famous Parents', value: '790' },
        { label: 'Famous-lead', value: '897' },
        { label: 'Fanfic', value: '942' },
        { label: 'Fated Lovers', value: '797' },
        { label: 'Fellatio', value: '870' },
        { label: 'Female-lead', value: '888' },
        { label: 'First-time-intercourse', value: '871' },
        { label: 'Fleet Battles', value: '836' },
        { label: 'Forced Living Arrangements', value: '808' },
        { label: 'Forced Marriage', value: '835' },
        { label: 'Former Hero', value: '752' },
        { label: 'Fujoshi', value: '1045' },
        { label: 'Galge', value: '848' },
        { label: 'Gambling', value: '1031' },
        { label: 'Gamelit', value: '994' },
        { label: 'Genderless-lead', value: '1008' },
        { label: 'Glasses-wearing-lead', value: '995' },
        { label: 'Guardian Relationship', value: '197' },
        { label: 'H*ndjob', value: '629' },
        { label: 'Half-human-lead', value: '956' },
        { label: 'Hard-working-lead', value: '957' },
        { label: 'Hard-working-male-lead', value: '958' },
        { label: 'Hard-working-protagonist/s', value: '1030' },
        { label: 'Harem-seeking-lead', value: '929' },
        { label: 'Harem-subtext', value: '909' },
        { label: 'Helpful Protagonist', value: '760' },
        { label: 'Helpful-lead', value: '882' },
        { label: 'Hidden-gem', value: '998' },
        { label: 'High-fantasy', value: '991' },
        { label: 'Human-becomes-demon/monster', value: '1009' },
        { label: 'Human-nonhuman-relationship', value: '914' },
        { label: 'Humanoid-lead', value: '915' },
        { label: 'Imperial Harem', value: '805' },
        { label: 'Incubus', value: '1049' },
        { label: 'Insects', value: '831' },
        { label: 'Interspatial-storage', value: '959' },
        { label: 'Kind Love Interests', value: '757' },
        { label: 'Large-number-of-skills', value: '1010' },
        { label: 'Legendary-hero', value: '1011' },
        { label: 'Litrpg', value: '977' },
        { label: 'Love Rivals', value: '788' },
        { label: 'Lovers Reunited', value: '853' },
        { label: 'Low-fantasy', value: '1037' },
        { label: 'Master-disciple-relationship', value: '899' },
        { label: 'Matriarchy', value: '807' },
        { label: 'Mature-lead', value: '900' },
        { label: 'Mind Break', value: '862' },
        { label: 'Mismatched Couple', value: '695' },
        { label: 'Mob Protagonist', value: '648' },
        { label: 'Mob-lead', value: '902' },
        { label: 'Modern', value: '988' },
        { label: 'Monster-pov', value: '1012' },
        { label: 'Mpreg', value: '856' },
        { label: 'Multiple-povs', value: '1013' },
        { label: 'Mystery Solving', value: '710' },
        { label: 'Naive-lead', value: '1014' },
        { label: 'Near-death-experience', value: '996' },
        { label: 'Neet', value: '495' },
        { label: 'Nightmares', value: '833' },
        { label: 'Nobility', value: '1015' },
        { label: 'Non-human-lead', value: '978' },
        { label: 'Non-humanoid-lead', value: '1016' },
        { label: 'Not-so-secret-identity', value: '979' },
        { label: 'Omegaverse', value: '857' },
        { label: 'Online-game', value: '910' },
        { label: 'Online-gaming', value: '911' },
        { label: 'Outdoor Interc**rse', value: '847' },
        { label: 'Outdoor-intercourse', value: '903' },
        { label: 'Overprotective Siblings', value: '610' },
        { label: 'Part-Time Job', value: '865' },
        { label: 'Past Trauma', value: '726' },
        { label: 'Past-memories', value: '1017' },
        { label: 'Persistent Love Interests', value: '714' },
        { label: 'Perverted-lead', value: '932' },
        { label: 'Photography', value: '798' },
        { label: 'Pill Based Cultivation', value: '279' },
        { label: 'Pill Concocting', value: '245' },
        { label: 'Pilots', value: '820' },
        { label: 'Playboys', value: '795' },
        { label: 'Playful-lead', value: '989' },
        { label: 'Polyandry', value: '811' },
        { label: 'Portal-fantasy-/-isekai', value: '992' },
        { label: 'Pragmatic-lead', value: '884' },
        { label: 'Profanity', value: '980' },
        { label: 'Protagonist-loyal-to-love-interest', value: '905' },
        { label: 'R-15 (Японское возрастное ограничение)', value: '230' },
        { label: 'Rebellion', value: '834' },
        { label: 'Reincarnated in a Game World', value: '804' },
        { label: 'Reluctant Protagonist', value: '696' },
        { label: 'Reverse R*pe', value: '776' },
        { label: 'Reversible Couple', value: '854' },
        { label: 'Ruling-class', value: '943' },
        { label: 'S*x Friends', value: '750' },
        { label: 'S*xual Cultivation Technique', value: '823' },
        { label: 'Salaryman', value: '1035' },
        { label: 'Satire', value: '981' },
        { label: 'Schemes And Conspiracies', value: '745' },
        { label: 'Scientist/s', value: '997' },
        { label: 'Scientists', value: '1029' },
        { label: 'Secret Crush', value: '827' },
        { label: 'Seme Protagonist', value: '1034' },
        { label: 'Seme-lead', value: '1028' },
        { label: 'Sentimental Protagonist', value: '1048' },
        { label: 'Seven-heavenly-virtues', value: '1018' },
        { label: 'Sexual Cultivation Technique', value: '350' },
        { label: 'Sexual-content', value: '982' },
        { label: 'Sexuality', value: '983' },
        { label: 'Sharing A Body', value: '814' },
        { label: 'Shotacon', value: '858' },
        { label: 'Shoujo-Ai Subplot', value: '777' },
        { label: 'Sibling Rivalry', value: '766' },
        { label: "Sibling's Care", value: '1042' },
        { label: 'Sickly Characters', value: '787' },
        { label: 'Skills', value: '1019' },
        { label: 'Slave-harem', value: '1001' },
        { label: 'Slime', value: '1020' },
        { label: 'Smart-male-lead', value: '963' },
        { label: 'Spirit Users', value: '739' },
        { label: 'Straight Seme', value: '819' },
        { label: 'Straight Uke', value: '818' },
        { label: 'Strength-based-social-hierarchy', value: '974' },
        { label: 'Strong-lead', value: '944' },
        { label: 'Strong-male-lead', value: '964' },
        { label: 'Student-teacher-relationship', value: '1026' },
        { label: 'Suspense', value: '987' },
        { label: 'Sword-and-sorcery', value: '875' },
        { label: 'Threesome', value: '574' },
        { label: 'Transformation Ability', value: '736' },
        { label: 'Traumatising-content', value: '1040' },
        { label: 'Underestimated-lead', value: '919' },
        { label: 'Underestimated-male-lead', value: '966' },
        { label: 'Unique-abilities', value: '1021' },
        { label: 'Unique-skill', value: '1022' },
        { label: 'Unique-skills', value: '1023' },
        { label: 'Unlimited Flow', value: '1044' },
        { label: 'Unrequited Love', value: '806' },
        { label: 'Urban-fantasy', value: '1041' },
        { label: 'Villainess Noble Girls', value: '719' },
        { label: 'Weak-lead', value: '885' },
        { label: 'Web-novel', value: '1024' },
      ],
      type: FilterTypes.ExcludableCheckboxGroup,
    },
    tags: {
      label: 'Жанры',
      value: { include: [], exclude: [] },
      options: [
        { label: 'Боевые искусства', value: '22' },
        { label: 'Гарем', value: '114' },
        { label: 'Гендер бендер', value: '246' },
        { label: 'Дзёсэй', value: '216' },
        { label: 'Для взрослых', value: '115' },
        { label: 'Для взрослых', value: '258' },
        { label: 'Драма', value: '7' },
        { label: 'Исторический', value: '101' },
        { label: 'Комедия', value: '17' },
        { label: 'Лоликон', value: '638' },
        { label: 'Магический реализм', value: '922' },
        { label: 'Меха', value: '24' },
        { label: 'Милитари', value: '12' },
        { label: 'Мистика', value: '2' },
        { label: 'Научная фантастика', value: '13' },
        { label: 'Непристойность', value: '747' },
        { label: 'Повседневность', value: '93' },
        { label: 'Приключение', value: '11' },
        { label: 'Психология', value: '18' },
        { label: 'Романтика', value: '9' },
        { label: 'Сверхъестественное', value: '20' },
        { label: 'Сёдзё', value: '15' },
        { label: 'Сёдзё-ай', value: '23' },
        { label: 'Сёнэн', value: '189' },
        { label: 'Сёнэн-ай', value: '680' },
        { label: 'Спорт', value: '420' },
        { label: 'Сэйнэн', value: '5' },
        { label: 'Сюаньхуа', value: '242' },
        { label: 'Сянься', value: '364' },
        { label: 'Трагедия', value: '19' },
        { label: 'Триллер', value: '3' },
        { label: 'Ужасы', value: '1' },
        { label: 'Уся', value: '720' },
        { label: 'Фэнтези', value: '8' },
        { label: 'Школьная жизнь', value: '21' },
        { label: 'Экшн', value: '14' },
        { label: 'Эччи', value: '327' },
        { label: 'Юри', value: '691' },
        { label: 'Яой', value: '682' },
        { label: 'Eastern fantasy', value: '907' },
        { label: 'Isekai', value: '999' },
        { label: 'Video games', value: '993' },
      ],
      type: FilterTypes.ExcludableCheckboxGroup,
    },
  } satisfies Filters;
}

export default new RNBH();

type responseNovels = {
  id: number;
  names: Names;
  rating: number;
  synopsis: string;
  url: string;
  poster: Poster;
  created_at: number;
  status: string;
  user?: User;
  counts: Counts;
};
type Names = {
  eng?: string;
  rus?: string;
  original: string;
};
type Poster = {
  medium: string;
  small: string;
  color: string;
};
type User = {
  status?: null;
  liked: boolean;
};
type Counts = {
  volumes: string;
  chapters: string;
};

type responseNovel = {
  id: number;
  names: Names;
  rating: number;
  year: number;
  synopsis: string;
  url: string;
  posters: Posters;
  isSpecial: boolean;
  liked: boolean;
  authors?: AuthorsEntity[] | null;
  translators?: TranslatorsEntity[] | null;
  description: string;
  status: Status;
  start_reading_url: string;
  html: string;
  tags: Tags;
};
type Posters = {
  big: string;
  medium: string;
  small: string;
  tiny: string;
  color: string;
};
type AuthorsEntity = {
  name_eng: string;
  pivot: Pivot;
};
type Pivot = {
  ranobe_id: number;
  author_id?: number;
  translator_id?: number;
};
type TranslatorsEntity = {
  name: string;
  pivot: Pivot;
};
type Status = {
  id: number;
  title: string;
  name: string;
};
type Tags = {
  events?: GenresOrEntity[] | null;
  genres?: GenresOrEntity[] | null;
};
type GenresOrEntity = {
  id: number;
  names: Names;
  url: string;
  title: string;
  description?: string | null;
};

type VolumesEntity = {
  id: number;
  num: number;
  name: string;
  status: Status;
  chapters?: ChaptersEntity[] | null;
};

type ChaptersEntity = {
  id: number;
  name: string;
  num: number;
  url: string;
  is_new: boolean;
  has_images: boolean;
  changed_at: string;
  comments_count: string;
};

type responseSearch = {
  meta: Meta;
  collections?: DataEntity[] | null;
  data?: DataEntity[] | null;
};
type Meta = {
  key: string;
  title: string;
};
type DataEntity = {
  id: number;
  names?: Names | null;
  description?: string | null;
  url: string;
  image?: string | null;
  name?: string | null;
  level?: number | null;
  evolution_scheme?: null;
  roles?: null[] | null;
  avatar?: Avatar | null;
  has_plus?: boolean | null;
};
type Avatar = {
  big: string;
  color: string;
  thumb: string;
  is_default: boolean;
};
