import { fetchApi } from '@libs/fetch.ts';
import { Filters } from '@libs/filterInputs.ts';
import { Plugin } from '@typings/plugin.ts';
import { NovelStatus } from '@libs/novelStatus.ts';
import { load as parseHTML } from 'npm:cheerio';
import dayjs from 'npm:dayjs';

type ReadwnOptions = {
  versionIncrements?: number;
};

export type ReadwnMetadata = {
  id: string;
  sourceSite: string;
  sourceName: string;
  filters?: any;
  options?: ReadwnOptions;
};

class ReadwnPlugin implements Plugin.PluginBase {
  id: string;
  name: string;
  icon: string;
  site: string;
  version: string;
  filters?: Filters;

  constructor(metadata: ReadwnMetadata) {
    this.id = metadata.id;
    this.name = metadata.sourceName;
    this.icon = `multisrc/readwn/${metadata.id.toLowerCase()}/icon.png`;
    this.site = metadata.sourceSite;
    const versionIncrements = metadata.options?.versionIncrements || 0;
    this.version = `1.0.${2 + versionIncrements}`;
    this.filters = metadata.filters;
  }

  async popularNovels(
    pageNo: number,
    { filters, showLatestNovels }: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    let url = this.site + '/list/';
    url += (filters?.genres?.value || 'all') + '/';
    url += (filters?.status?.value || 'all') + '-';
    url += showLatestNovels ? 'lastdotime' : filters?.sort?.value || 'newstime';
    url += '-' + (pageNo - 1) + '.html';

    if (filters?.tags?.value) {
      //only 1 page
      url = this.site + '/tags/' + filters.tags.value + '-0.html';
    }

    const body = await fetchApi(url).then(res => res.text());
    const loadedCheerio = parseHTML(body);

    const novels: Plugin.NovelItem[] = loadedCheerio('li.novel-item')
      .map((index, element) => ({
        name: loadedCheerio(element).find('h4').text() || '',
        cover:
          this.site +
          loadedCheerio(element).find('.novel-cover > img').attr('data-src'),
        path: loadedCheerio(element).find('a').attr('href') || '',
      }))
      .get()
      .filter(novel => novel.name && novel.path);

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const body = await fetchApi(this.site + novelPath).then(res => res.text());
    const loadedCheerio = parseHTML(body);

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: loadedCheerio('h1.novel-title').text() || '',
    };

    novel.author = loadedCheerio('span[itemprop=author]').text();
    novel.cover =
      this.site + loadedCheerio('figure.cover > img').attr('data-src');

    novel.summary = loadedCheerio('.summary')
      .text()
      .replace('Summary', '')
      .trim();

    novel.genres = loadedCheerio('div.categories > ul > li')
      .map((index, element) => loadedCheerio(element).text()?.trim())
      .get()
      .join(',');

    loadedCheerio('div.header-stats > span').each(function () {
      if (loadedCheerio(this).find('small').text() === 'Status') {
        novel.status =
          loadedCheerio(this).find('strong').text() === 'Ongoing'
            ? NovelStatus.Ongoing
            : NovelStatus.Completed;
      }
    });

    const latestChapterNo = parseInt(
      loadedCheerio('.header-stats')
        .find('span > strong')
        .first()
        .text()
        .trim(),
    );

    const chapters: Plugin.ChapterItem[] = loadedCheerio('.chapter-list li')
      .map((chapterIndex, element) => {
        const name = loadedCheerio(element)
          .find('a .chapter-title')
          .text()
          .trim();
        const path = loadedCheerio(element).find('a').attr('href')?.trim();
        if (!name || !path) return null;

        let releaseTime = loadedCheerio(element)
          .find('a .chapter-update')
          .text()
          .trim();
        if (releaseTime?.includes?.('ago')) {
          const timeAgo = releaseTime.match(/\d+/)?.[0] || '0';
          const timeAgoInt = parseInt(timeAgo, 10);

          if (timeAgoInt) {
            const dayJSDate = dayjs(); // today
            if (
              releaseTime.includes('hours ago') ||
              releaseTime.includes('hour ago')
            ) {
              dayJSDate.subtract(timeAgoInt, 'hours'); // go back N hours
            }

            if (
              releaseTime.includes('days ago') ||
              releaseTime.includes('day ago')
            ) {
              dayJSDate.subtract(timeAgoInt, 'days'); // go back N days
            }

            if (
              releaseTime.includes('months ago') ||
              releaseTime.includes('month ago')
            ) {
              dayJSDate.subtract(timeAgoInt, 'months'); // go back N months
            }

            releaseTime = dayJSDate.format('LL');
          }
        }

        return {
          name,
          path,
          releaseTime,
          chapterNumber: chapterIndex + 1,
        };
      })
      .get()
      .filter(chapter => chapter);

    if (latestChapterNo > chapters.length) {
      const lastChapterNo = parseInt(
        chapters[chapters.length - 1].path.match(/_(\d+)\.html/)?.[1] || '',
        10,
      );

      for (
        let i = (lastChapterNo || chapters.length) + 1;
        i <= latestChapterNo;
        i++
      ) {
        chapters.push({
          name: 'Chapter ' + i,
          path: novelPath.replace('.html', '_' + i + '.html'),
          releaseTime: null,
          chapterNumber: i,
        });
      }
    }

    novel.chapters = chapters;
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const body = await fetchApi(this.site + chapterPath).then(res =>
      res.text(),
    );
    const loadedCheerio = parseHTML(body);

    const chapterText = loadedCheerio('.chapter-content').html() || '';
    return chapterText;
  }

  async searchNovels(searchTerm: string): Promise<Plugin.NovelItem[]> {
    const result = await fetchApi(this.site + '/e/search/index.php', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: this.site + '/search.html',
        Origin: this.site,
      },
      method: 'POST',
      body: new URLSearchParams({
        show: 'title',
        tempid: 1,
        tbname: 'news',
        keyboard: searchTerm,
      }).toString(),
    }).then(res => res.text());
    const loadedCheerio = parseHTML(result);

    const novels: Plugin.NovelItem[] = loadedCheerio('li.novel-item')
      .map((index, element) => ({
        name: loadedCheerio(element).find('h4').text() || '',
        cover: this.site + loadedCheerio(element).find('img').attr('data-src'),
        path: loadedCheerio(element).find('a').attr('href') || '',
      }))
      .get()
      .filter(novel => novel.name && novel.path);
    return novels;
  }
}

const plugin = new ReadwnPlugin({"id":"ltnovel","sourceSite":"https://www.ltnovels.com","sourceName":"Ltnovel","options":{"versionIncrements":1},"filters":{"sort":{"type":"Picker","label":"Sort By","value":"onclick","options":[{"label":"New","value":"newstime"},{"label":"Popular","value":"onclick"},{"label":"Updates","value":"lastdotime"}]},"status":{"type":"Picker","label":"Status","value":"all","options":[{"label":"All","value":"all"},{"label":"Completed","value":"Completed"},{"label":"Ongoing","value":"Ongoing"}]},"genres":{"type":"Picker","label":"Genre / Category","value":"","options":[{"label":"All","value":"all"},{"label":"Action","value":"action"},{"label":"Adult","value":"adult"},{"label":"Adventure","value":"adventure"},{"label":"Comedy","value":"comedy"},{"label":"Contemporary Romance","value":"contemporary-romance"},{"label":"Drama","value":"drama"},{"label":"Eastern Fantasy","value":"eastern-fantasy"},{"label":"Ecchi","value":"ecchi"},{"label":"Fantasy","value":"fantasy"},{"label":"Fantasy Romance","value":"fantasy-romance"},{"label":"Game","value":"game"},{"label":"Gender Bender","value":"gender-bender"},{"label":"Harem","value":"harem"},{"label":"Historical","value":"historical"},{"label":"Horror","value":"horror"},{"label":"Josei","value":"josei"},{"label":"Lolicon","value":"lolicon"},{"label":"Magical Realism","value":"magical-realism"},{"label":"Martial Arts","value":"martial-arts"},{"label":"Mature","value":"mature"},{"label":"Mecha","value":"mecha"},{"label":"Mystery","value":"mystery"},{"label":"Psychological","value":"psychological"},{"label":"Romance","value":"romance"},{"label":"School Life","value":"school-life"},{"label":"Sci-fi","value":"sci-fi"},{"label":"Seinen","value":"seinen"},{"label":"Shoujo","value":"shoujo"},{"label":"Shounen","value":"shounen"},{"label":"Shounen Ai","value":"shounen-ai"},{"label":"Slice of Life","value":"slice-of-life"},{"label":"Smut","value":"smut"},{"label":"Sports","value":"sports"},{"label":"Supernatural","value":"supernatural"},{"label":"Tragedy","value":"tragedy"},{"label":"Video Games","value":"video-games"},{"label":"Wuxia","value":"wuxia"},{"label":"Xianxia","value":"xianxia"},{"label":"Xuanhuan","value":"xuanhuan"},{"label":"Yaoi","value":"yaoi"}]},"tags":{"type":"Picker","label":"Tags","value":"","options":[{"label":"NONE","value":""},{"label":"action","value":"639"},{"label":"Adventure","value":"657"},{"label":"Academy","value":"43"},{"label":"Alchemy","value":"46"},{"label":"ArrogantCh","value":"4"},{"label":"Artifacts","value":"127"},{"label":"Apocalypse","value":"206"},{"label":"AntiheroPr","value":"173"},{"label":"AdaptedtoM","value":"2"},{"label":"AlternateW","value":"205"},{"label":"Aristocrac","value":"123"},{"label":"AdaptedtoM","value":"167"},{"label":"ArrangedMa","value":"126"},{"label":"AncientChi","value":"164"},{"label":"AgeProgres","value":"208"},{"label":"Adventurer","value":"171"},{"label":"ArmyBuildi","value":"105"},{"label":"Antihero","value":"858"},{"label":"Assassins","value":"107"},{"label":"Accelerate","value":"163"},{"label":"AncientTim","value":"193"},{"label":"Appearance","value":"23"},{"label":"Angels","value":"104"},{"label":"AdaptedtoM","value":"249"},{"label":"Aliens","value":"137"},{"label":"Acting","value":"1"},{"label":"Amnesia","value":"131"},{"label":"AdaptedtoA","value":"144"},{"label":"AbsentPare","value":"250"},{"label":"AbusiveCha","value":"196"},{"label":"Army","value":"125"},{"label":"ArtifactCr","value":"140"},{"label":"AbilitySte","value":"166"},{"label":"AdaptedtoD","value":"145"},{"label":"AbandonedC","value":"213"},{"label":"ApatheticP","value":"169"},{"label":"AgeRegress","value":"283"},{"label":"Archery","value":"24"},{"label":"AdoptedPro","value":"211"},{"label":"AdoptedChi","value":"326"},{"label":"AdaptedtoD","value":"170"},{"label":"Anl","value":"178"},{"label":"advancedte","value":"804"},{"label":"Androids","value":"408"},{"label":"Aggressive","value":"440"},{"label":"Adultery","value":"573"},{"label":"Alpha","value":"853"},{"label":"Abandoned","value":"910"},{"label":"AdaptedtoG","value":"225"},{"label":"AnimalRear","value":"409"},{"label":"AwkwardPro","value":"304"},{"label":"Affair","value":"217"},{"label":"Automatons","value":"236"},{"label":"AdaptedtoM","value":"479"},{"label":"Artists","value":"492"},{"label":"AntiqueSho","value":"493"},{"label":"AdaptedtoV","value":"485"},{"label":"Anti-Magic","value":"527"},{"label":"ArmsDealer","value":"569"},{"label":"Award-winn","value":"593"},{"label":"Angel","value":"955"},{"label":"ApartmentL","value":"327"},{"label":"AmusementP","value":"462"},{"label":"Angst","value":"617"},{"label":"All-GirlsS","value":"682"},{"label":"ADeadBody","value":"883"},{"label":"Anime","value":"952"},{"label":"Androgynou","value":"3"},{"label":"Average-lo","value":"49"},{"label":"Artificial","value":"106"},{"label":"Appearance","value":"122"},{"label":"AnimalChar","value":"172"},{"label":"Anti-socia","value":"194"},{"label":"Astrologer","value":"419"},{"label":"Autism","value":"555"},{"label":"Alchemist","value":"616"},{"label":"AkamegaKil","value":"703"},{"label":"AmoralityP","value":"711"},{"label":"Avatar&amp","value":"788"},{"label":"Attractive","value":"795"},{"label":"AbsoluteDu","value":"824"},{"label":"ASOIAF","value":"838"},{"label":"APsychicDe","value":"885"},{"label":"BeautifulF","value":"5"},{"label":"Betrayal","value":"6"},{"label":"BeastCompa","value":"27"},{"label":"Bloodlines","value":"32"},{"label":"BodyTemper","value":"34"},{"label":"BusinessMa","value":"121"},{"label":"Beasts","value":"29"},{"label":"BlackBelly","value":"129"},{"label":"Beastkin","value":"179"},{"label":"BrokenEnga","value":"120"},{"label":"BattleAcad","value":"146"},{"label":"Blacksmith","value":"192"},{"label":"BickeringC","value":"218"},{"label":"Businessme","value":"376"},{"label":"Brotherhoo","value":"293"},{"label":"BattleComp","value":"128"},{"label":"Bullying","value":"141"},{"label":"BrotherCom","value":"311"},{"label":"Buddhism","value":"209"},{"label":"Books","value":"54"},{"label":"Blackmail","value":"320"},{"label":"Bookworm","value":"56"},{"label":"Bodyguards","value":"431"},{"label":"BDSM","value":"508"},{"label":"Beasttamin","value":"859"},{"label":"Bloodpumpi","value":"860"},{"label":"Beauty","value":"898"},{"label":"BloodManip","value":"441"},{"label":"Brainwashi","value":"528"},{"label":"BisexualPr","value":"480"},{"label":"BeautifulC","value":"669"},{"label":"Badboy","value":"881"},{"label":"Butlers","value":"421"},{"label":"BreastFeti","value":"489"},{"label":"BodySwap","value":"628"},{"label":"BasedonanA","value":"719"},{"label":"Bl","value":"867"},{"label":"BlindProta","value":"358"},{"label":"Body-doubl","value":"533"},{"label":"Baby","value":"915"},{"label":"Biochip","value":"471"},{"label":"Basketball","value":"587"},{"label":"BasedonaVi","value":"644"},{"label":"BasedonaMo","value":"770"},{"label":"Bleach","value":"802"},{"label":"Businesswo","value":"901"},{"label":"Boss-Subor","value":"329"},{"label":"Bands","value":"565"},{"label":"Baseball","value":"585"},{"label":"BasedonaVi","value":"721"},{"label":"BasedonaSo","value":"726"},{"label":"Beatthemal","value":"871"},{"label":"Beatthefem","value":"872"},{"label":"Bigshot","value":"951"},{"label":"Billionair","value":"975"},{"label":"Chinese","value":"808"},{"label":"Cultivatio","value":"42"},{"label":"ChineseNov","value":"807"},{"label":"CalmProtag","value":"36"},{"label":"CleverProt","value":"11"},{"label":"Cheats","value":"60"},{"label":"CharacterG","value":"158"},{"label":"CunningPro","value":"45"},{"label":"Comedy","value":"584"},{"label":"ColdProtag","value":"38"},{"label":"CaringProt","value":"7"},{"label":"ConfidentP","value":"40"},{"label":"ComedicUnd","value":"264"},{"label":"ColdLoveIn","value":"165"},{"label":"CautiousPr","value":"157"},{"label":"Childcare","value":"9"},{"label":"Cooking","value":"245"},{"label":"CarefreePr","value":"219"},{"label":"Celebritie","value":"8"},{"label":"CharmingPr","value":"59"},{"label":"ChildhoodF","value":"240"},{"label":"Crafting","value":"108"},{"label":"CuteProtag","value":"248"},{"label":"CuteChildr","value":"14"},{"label":"CoupleGrow","value":"214"},{"label":"CEO","value":"623"},{"label":"CruelChara","value":"284"},{"label":"ChildProta","value":"210"},{"label":"Conquer","value":"863"},{"label":"Crime","value":"220"},{"label":"ClingyLove","value":"180"},{"label":"Contracts","value":"312"},{"label":"ClanBuildi","value":"159"},{"label":"ChildhoodL","value":"10"},{"label":"Campus","value":"927"},{"label":"Curses","value":"328"},{"label":"Cross-dres","value":"13"},{"label":"ChildAbuse","value":"331"},{"label":"Corruption","value":"138"},{"label":"CuteStory","value":"496"},{"label":"Cannibalis","value":"294"},{"label":"CollegeorU","value":"224"},{"label":"Cohabitati","value":"404"},{"label":"Clones","value":"61"},{"label":"CuriousPro","value":"720"},{"label":"ChatRooms","value":"383"},{"label":"CosmicWars","value":"422"},{"label":"Cnnilingus","value":"509"},{"label":"Criminals","value":"517"},{"label":"Conditiona","value":"490"},{"label":"CowardlyPr","value":"174"},{"label":"Chefs","value":"359"},{"label":"ChildishPr","value":"515"},{"label":"Cousins","value":"181"},{"label":"ComingofAg","value":"464"},{"label":"Clubs","value":"576"},{"label":"ChildhoodP","value":"318"},{"label":"Conflictin","value":"458"},{"label":"CourtOffic","value":"465"},{"label":"CardGames","value":"478"},{"label":"ClumsyLove","value":"499"},{"label":"Coma","value":"544"},{"label":"Co-Workers","value":"541"},{"label":"Cheat","value":"771"},{"label":"Crossover","value":"366"},{"label":"Chuunibyou","value":"474"},{"label":"CollegeUni","value":"536"},{"label":"Confinemen","value":"684"},{"label":"CharacterD","value":"742"},{"label":"Childhoods","value":"870"},{"label":"Crossdress","value":"933"},{"label":"ComplexFam","value":"12"},{"label":"Charismati","value":"58"},{"label":"Cryostasis","value":"553"},{"label":"Chatgroup","value":"608"},{"label":"ChaptersRe","value":"687"},{"label":"Charlotte(","value":"704"},{"label":"Cyberpunk","value":"792"},{"label":"Chivalryof","value":"823"},{"label":"CatchaGhos","value":"893"},{"label":"Crush","value":"919"},{"label":"Contractma","value":"930"},{"label":"Coolguy","value":"966"},{"label":"Counteratt","value":"968"},{"label":"ClassroomO","value":"969"},{"label":"Demons","value":"65"},{"label":"Dark","value":"317"},{"label":"Dragons","value":"48"},{"label":"DevotedLov","value":"70"},{"label":"Dungeons","value":"110"},{"label":"DenseProta","value":"67"},{"label":"DotingLove","value":"15"},{"label":"Depictions","value":"130"},{"label":"DeathofLov","value":"139"},{"label":"DemonLord","value":"147"},{"label":"Demi-Human","value":"226"},{"label":"Doctors","value":"72"},{"label":"Dwarfs","value":"111"},{"label":"Death","value":"406"},{"label":"DaoCompreh","value":"47"},{"label":"DotingPare","value":"360"},{"label":"DotingOlde","value":"227"},{"label":"Discrimina","value":"132"},{"label":"Dragon","value":"610"},{"label":"Detectives","value":"221"},{"label":"DomesticAf","value":"246"},{"label":"Destiny","value":"305"},{"label":"Divorce","value":"215"},{"label":"Disabiliti","value":"633"},{"label":"Depression","value":"306"},{"label":"DragonSlay","value":"361"},{"label":"DivineProt","value":"399"},{"label":"DungeonMas","value":"502"},{"label":"Daoism","value":"212"},{"label":"Devil","value":"934"},{"label":"DaoCompani","value":"168"},{"label":"Devils","value":"613"},{"label":"Dreams","value":"477"},{"label":"Delinquent","value":"675"},{"label":"Dramatic","value":"926"},{"label":"Divination","value":"384"},{"label":"Drugs","value":"390"},{"label":"Druids","value":"395"},{"label":"Debts","value":"562"},{"label":"Dystopia","value":"564"},{"label":"DishonestP","value":"643"},{"label":"DragonRide","value":"668"},{"label":"Doctor","value":"902"},{"label":"DollsorPup","value":"579"},{"label":"Disfigurem","value":"420"},{"label":"DeadProtag","value":"698"},{"label":"Determined","value":"109"},{"label":"DemonicCul","value":"195"},{"label":"Delusions","value":"443"},{"label":"DifferentS","value":"466"},{"label":"Dancers","value":"566"},{"label":"doppelgang","value":"625"},{"label":"Distrustfu","value":"653"},{"label":"Divination","value":"685"},{"label":"DoulouDalu","value":"700"},{"label":"Diplomacy","value":"728"},{"label":"Dwarves","value":"740"},{"label":"DouluoDalu","value":"787"},{"label":"DanMachi","value":"789"},{"label":"DragonBall","value":"791"},{"label":"Detailed","value":"900"},{"label":"Detective","value":"970"},{"label":"Evolution","value":"265"},{"label":"Elves","value":"113"},{"label":"EuropeanAm","value":"261"},{"label":"ElementalM","value":"160"},{"label":"EarlyRoman","value":"133"},{"label":"EvilProtag","value":"411"},{"label":"EasternSet","value":"597"},{"label":"EvilGods","value":"232"},{"label":"EyePowers","value":"51"},{"label":"EnemiesBec","value":"175"},{"label":"EideticMem","value":"50"},{"label":"Empires","value":"182"},{"label":"EnemiesBec","value":"134"},{"label":"EvilReligi","value":"161"},{"label":"EvilOrgani","value":"207"},{"label":"Economics","value":"112"},{"label":"Engagement","value":"307"},{"label":"Ecchi","value":"956"},{"label":"Episodic","value":"222"},{"label":"Exorcism","value":"646"},{"label":"Enemiestol","value":"875"},{"label":"EasyGoingL","value":"400"},{"label":"Egoist","value":"957"},{"label":"Entertainm","value":"830"},{"label":"e-Sports","value":"271"},{"label":"Exhibition","value":"511"},{"label":"Enlightenm","value":"75"},{"label":"EarthInvas","value":"423"},{"label":"ElderlyPro","value":"649"},{"label":"Engineer","value":"135"},{"label":"Emotionall","value":"321"},{"label":"Elementali","value":"622"},{"label":"Eunuch","value":"753"},{"label":"EvilSpirit","value":"892"},{"label":"Ex","value":"908"},{"label":"Esper","value":"976"},{"label":"FemaleProt","value":"16"},{"label":"FantasyWor","value":"136"},{"label":"FastCultiv","value":"78"},{"label":"Fanfiction","value":"282"},{"label":"Friendship","value":"177"},{"label":"First-time","value":"183"},{"label":"FamousProt","value":"176"},{"label":"FamilialLo","value":"347"},{"label":"FantasyCre","value":"115"},{"label":"faceslappi","value":"632"},{"label":"FastLearne","value":"80"},{"label":"Family","value":"354"},{"label":"Futuristic","value":"308"},{"label":"FirstLove","value":"279"},{"label":"Firearms","value":"17"},{"label":"FamilyConf","value":"335"},{"label":"Farming","value":"247"},{"label":"Fairies","value":"114"},{"label":"Fllatio","value":"184"},{"label":"FearlessPr","value":"497"},{"label":"FatedLover","value":"116"},{"label":"FamousPare","value":"438"},{"label":"Fastpaced","value":"938"},{"label":"ForcedMarr","value":"198"},{"label":"FattoFit","value":"488"},{"label":"Familiars","value":"556"},{"label":"Filipino","value":"813"},{"label":"Future","value":"868"},{"label":"FemaleMast","value":"510"},{"label":"FilipinoNo","value":"812"},{"label":"Fatedlove","value":"888"},{"label":"FamilyBusi","value":"437"},{"label":"Forbiddenl","value":"899"},{"label":"FormerHero","value":"627"},{"label":"FriendsBec","value":"407"},{"label":"FleetBattl","value":"424"},{"label":"Flashbacks","value":"459"},{"label":"FoxSpirits","value":"531"},{"label":"FatProtago","value":"567"},{"label":"FemaleLead","value":"575"},{"label":"FallenAnge","value":"618"},{"label":"FallenNobi","value":"619"},{"label":"Fantasy","value":"781"},{"label":"FairyTail","value":"674"},{"label":"FemaletoMa","value":"727"},{"label":"FantasyMag","value":"748"},{"label":"FengShui","value":"762"},{"label":"Friendstol","value":"903"},{"label":"Forcedinto","value":"197"},{"label":"Folklore","value":"460"},{"label":"Futanari","value":"512"},{"label":"FoodShopke","value":"592"},{"label":"Fellatio","value":"723"},{"label":"Fan-fictio","value":"755"},{"label":"First-time","value":"765"},{"label":"Fatestayni","value":"834"},{"label":"Fantasyrom","value":"939"},{"label":"Fastpace","value":"967"},{"label":"Fiction","value":"974"},{"label":"GameElemen","value":"117"},{"label":"GeniusProt","value":"143"},{"label":"Gods","value":"52"},{"label":"Guilds","value":"119"},{"label":"Gore","value":"237"},{"label":"Gamers","value":"272"},{"label":"Genius","value":"862"},{"label":"Ghosts","value":"367"},{"label":"Goddesses","value":"336"},{"label":"GatetoAnot","value":"337"},{"label":"GameRankin","value":"118"},{"label":"GodlyPower","value":"162"},{"label":"GodProtago","value":"287"},{"label":"GeneticMod","value":"295"},{"label":"Grinding","value":"377"},{"label":"Gangs","value":"142"},{"label":"Goblins","value":"346"},{"label":"Gunfighter","value":"482"},{"label":"Golems","value":"270"},{"label":"Generals","value":"369"},{"label":"Grimdark","value":"827"},{"label":"Gambling","value":"330"},{"label":"Gladiators","value":"534"},{"label":"GenderBend","value":"634"},{"label":"Galge","value":"741"},{"label":"Game","value":"769"},{"label":"GameofThro","value":"837"},{"label":"Gettingbac","value":"907"},{"label":"God-humanR","value":"185"},{"label":"GraveKeepe","value":"647"},{"label":"Genderless","value":"699"},{"label":"Girl&amp03","value":"746"},{"label":"Glasses-we","value":"778"},{"label":"GameLit","value":"844"},{"label":"GhostEvent","value":"886"},{"label":"HandsomeMa","value":"18"},{"label":"Harem","value":"650"},{"label":"HidingTrue","value":"57"},{"label":"HidingTrue","value":"251"},{"label":"HiddenAbil","value":"333"},{"label":"HumanoidPr","value":"289"},{"label":"Heroes","value":"288"},{"label":"Heartwarmi","value":"362"},{"label":"Hunters","value":"266"},{"label":"Historical","value":"874"},{"label":"Highiq","value":"920"},{"label":"HeavenlyTr","value":"148"},{"label":"HiddenGem","value":"538"},{"label":"HumanExper","value":"296"},{"label":"HighFantas","value":"821"},{"label":"Hackers","value":"216"},{"label":"HatedProta","value":"199"},{"label":"HonestProt","value":"385"},{"label":"Healers","value":"500"},{"label":"Hndjob","value":"187"},{"label":"Hell","value":"503"},{"label":"HarryPotte","value":"715"},{"label":"Healing","value":"760"},{"label":"Hypnotism","value":"392"},{"label":"HelpfulPro","value":"453"},{"label":"Heterochro","value":"55"},{"label":"HarshTrain","value":"309"},{"label":"Heaven","value":"620"},{"label":"HighSchool","value":"702"},{"label":"Hospital","value":"535"},{"label":"HumanWeapo","value":"310"},{"label":"Herbalist","value":"442"},{"label":"Horror","value":"971"},{"label":"Hard-Worki","value":"53"},{"label":"Harem-seek","value":"186"},{"label":"Half-human","value":"235"},{"label":"Human-Nonh","value":"391"},{"label":"Hot-bloode","value":"413"},{"label":"Hentai","value":"532"},{"label":"Handjob","value":"545"},{"label":"history","value":"724"},{"label":"Hokage","value":"756"},{"label":"Hunter×Hu","value":"767"},{"label":"HardSci-fi","value":"839"},{"label":"Heartthrob","value":"911"},{"label":"Hiddenmarr","value":"943"},{"label":"Isekai","value":"833"},{"label":"Immortals","value":"252"},{"label":"Incest","value":"355"},{"label":"Inheritanc","value":"149"},{"label":"Immortal","value":"851"},{"label":"Invincible","value":"954"},{"label":"Industrial","value":"468"},{"label":"Interstell","value":"963"},{"label":"ImperialHa","value":"374"},{"label":"Indonesia","value":"819"},{"label":"Investigat","value":"223"},{"label":"Inscriptio","value":"150"},{"label":"IndonesiaN","value":"818"},{"label":"Insects","value":"338"},{"label":"Inferiorit","value":"447"},{"label":"Interconne","value":"290"},{"label":"Introverte","value":"291"},{"label":"Interdimen","value":"425"},{"label":"Invisibili","value":"641"},{"label":"Incubus","value":"663"},{"label":"IsItWrongt","value":"825"},{"label":"IdentityCr","value":"831"},{"label":"Imposter","value":"854"},{"label":"Japanese","value":"806"},{"label":"Jealousy","value":"124"},{"label":"JackofAllT","value":"82"},{"label":"Korean","value":"810"},{"label":"KingdomBui","value":"486"},{"label":"KoreanNove","value":"811"},{"label":"Kingdoms","value":"253"},{"label":"Knights","value":"188"},{"label":"Kidnapping","value":"285"},{"label":"KindLoveIn","value":"348"},{"label":"Killer","value":"856"},{"label":"Kuudere","value":"501"},{"label":"Kendo","value":"604"},{"label":"Karma","value":"614"},{"label":"Kakashi","value":"757"},{"label":"LightNovel","value":"809"},{"label":"LevelSyste","value":"239"},{"label":"LitRPG","value":"539"},{"label":"Levelup","value":"847"},{"label":"LuckyProta","value":"21"},{"label":"Loli","value":"189"},{"label":"LoyalSubor","value":"241"},{"label":"LazyProtag","value":"254"},{"label":"LateRomanc","value":"19"},{"label":"LackofComm","value":"439"},{"label":"Low-keyPro","value":"313"},{"label":"LongSepara","value":"190"},{"label":"Leadership","value":"238"},{"label":"LoveatFirs","value":"461"},{"label":"LoveTriang","value":"349"},{"label":"LonerProta","value":"426"},{"label":"Lovetriang","value":"905"},{"label":"Legends","value":"151"},{"label":"Library","value":"85"},{"label":"Lolicon","value":"286"},{"label":"LimitedLif","value":"86"},{"label":"Lottery","value":"563"},{"label":"LoversReun","value":"350"},{"label":"LGBTQA","value":"601"},{"label":"LoveRivals","value":"676"},{"label":"LowFantasy","value":"796"},{"label":"LoveIntere","value":"20"},{"label":"LostCivili","value":"455"},{"label":"LittleRoma","value":"581"},{"label":"Loneliness","value":"694"},{"label":"leonine","value":"695"},{"label":"LivingAlon","value":"733"},{"label":"Littlebun","value":"931"},{"label":"Loveafterm","value":"962"},{"label":"MaleProtag","value":"63"},{"label":"Magic","value":"292"},{"label":"ModernDay","value":"25"},{"label":"Monsters","value":"64"},{"label":"Mystery","value":"848"},{"label":"MultiplePO","value":"258"},{"label":"Misunderst","value":"22"},{"label":"ModernKnow","value":"274"},{"label":"MultipleRe","value":"66"},{"label":"Military","value":"257"},{"label":"MMORPG","value":"454"},{"label":"Marriage","value":"191"},{"label":"MagicBeast","value":"339"},{"label":"MoneyGrubb","value":"90"},{"label":"MagicalTec","value":"273"},{"label":"MagicForma","value":"62"},{"label":"Mythology","value":"469"},{"label":"MagicalSpa","value":"228"},{"label":"Mysterious","value":"298"},{"label":"MatureProt","value":"256"},{"label":"MythicalBe","value":"356"},{"label":"Medieval","value":"580"},{"label":"MonsterTam","value":"267"},{"label":"MedicalKno","value":"351"},{"label":"MutatedCre","value":"268"},{"label":"MaletoFema","value":"635"},{"label":"Maids","value":"255"},{"label":"Management","value":"487"},{"label":"Mafia","value":"877"},{"label":"Myth","value":"924"},{"label":"Music","value":"332"},{"label":"MaleYander","value":"401"},{"label":"MultiplePr","value":"655"},{"label":"MysterySol","value":"578"},{"label":"Mercenarie","value":"314"},{"label":"MultipleId","value":"345"},{"label":"Martialart","value":"549"},{"label":"Murders","value":"636"},{"label":"Movies","value":"26"},{"label":"Mutations","value":"297"},{"label":"Mecha","value":"394"},{"label":"Marvel","value":"651"},{"label":"Mutation","value":"945"},{"label":"Merchants","value":"557"},{"label":"MindContro","value":"577"},{"label":"MonsterGir","value":"664"},{"label":"Malaysian","value":"817"},{"label":"MartialSpi","value":"414"},{"label":"MagicalGir","value":"543"},{"label":"MobProtago","value":"734"},{"label":"ModernWorl","value":"686"},{"label":"ModernFant","value":"688"},{"label":"Mysterious","value":"526"},{"label":"Mpreg","value":"546"},{"label":"MuteCharac","value":"568"},{"label":"MagicAcade","value":"590"},{"label":"Msturbatio","value":"677"},{"label":"ManlyGayCo","value":"754"},{"label":"MaleLead","value":"797"},{"label":"Mythos","value":"799"},{"label":"MalaysianN","value":"816"},{"label":"Multiplele","value":"942"},{"label":"Manipulati","value":"87"},{"label":"Master-Dis","value":"88"},{"label":"Master-Ser","value":"89"},{"label":"Mysterious","value":"152"},{"label":"Models","value":"280"},{"label":"MultipleRe","value":"463"},{"label":"Masochisti","value":"523"},{"label":"MultipleTr","value":"558"},{"label":"Mage","value":"631"},{"label":"Masturbati","value":"671"},{"label":"Multiverse","value":"681"},{"label":"Marriageof","value":"718"},{"label":"MonsterSoc","value":"739"},{"label":"MyHeroAcad","value":"751"},{"label":"MultipleTi","value":"761"},{"label":"Massacre","value":"790"},{"label":"MultipleLe","value":"798"},{"label":"MultiplePe","value":"801"},{"label":"Mysterious","value":"882"},{"label":"Modern","value":"909"},{"label":"Marysue","value":"921"},{"label":"Mature","value":"928"},{"label":"Mag","value":"953"},{"label":"Monster","value":"960"},{"label":"ModernLife","value":"972"},{"label":"Nobles","value":"259"},{"label":"Non-humanP","value":"665"},{"label":"NaiveProta","value":"322"},{"label":"Nationalis","value":"262"},{"label":"Necromance","value":"315"},{"label":"NotHarem","value":"599"},{"label":"NA","value":"814"},{"label":"Nonhuman","value":"904"},{"label":"No-Harem","value":"935"},{"label":"Netori","value":"498"},{"label":"Naruto","value":"652"},{"label":"NoRomance","value":"642"},{"label":"Near-Death","value":"28"},{"label":"Ninjas","value":"521"},{"label":"NPC","value":"842"},{"label":"Nudity","value":"472"},{"label":"Netorare","value":"707"},{"label":"NoCheats","value":"845"},{"label":"Non-humano","value":"427"},{"label":"Narcissist","value":"432"},{"label":"NotYaoi","value":"691"},{"label":"Neet","value":"758"},{"label":"Nurses","value":"766"},{"label":"Non-Humanl","value":"822"},{"label":"Overpowere","value":"846"},{"label":"OlderLoveI","value":"396"},{"label":"Orphans","value":"397"},{"label":"Orcs","value":"363"},{"label":"OuterSpace","value":"378"},{"label":"OrganizedC","value":"380"},{"label":"OtomeGame","value":"735"},{"label":"ordinary","value":"747"},{"label":"OnePiece","value":"785"},{"label":"ObsessiveL","value":"494"},{"label":"OfficeRoma","value":"648"},{"label":"Overlord","value":"743"},{"label":"Onenightst","value":"917"},{"label":"Overpowere","value":"91"},{"label":"Outcasts","value":"583"},{"label":"Overprotec","value":"729"},{"label":"OriginalON","value":"793"},{"label":"Omegaverse","value":"918"},{"label":"Overpowere","value":"961"},{"label":"PoortoRich","value":"229"},{"label":"Polygamy","value":"71"},{"label":"PowerCoupl","value":"33"},{"label":"Politics","value":"242"},{"label":"Pregnancy","value":"35"},{"label":"Pets","value":"69"},{"label":"Possessive","value":"31"},{"label":"Post-apoca","value":"299"},{"label":"Possessive","value":"850"},{"label":"Powerfulco","value":"852"},{"label":"PastPlaysa","value":"200"},{"label":"PoorProtag","value":"476"},{"label":"ProactiveP","value":"316"},{"label":"Parody","value":"386"},{"label":"PreviousLi","value":"467"},{"label":"PervertedP","value":"448"},{"label":"PillConcoc","value":"92"},{"label":"PsychicPow","value":"260"},{"label":"Police","value":"518"},{"label":"ParallelWo","value":"507"},{"label":"PastTrauma","value":"201"},{"label":"Psychopath","value":"561"},{"label":"PragmaticP","value":"660"},{"label":"Princess","value":"879"},{"label":"Personalit","value":"68"},{"label":"Poisons","value":"93"},{"label":"Phoenixes","value":"153"},{"label":"Prison","value":"444"},{"label":"Pirates","value":"547"},{"label":"Priests","value":"654"},{"label":"PlayfulPro","value":"701"},{"label":"Pokemon","value":"779"},{"label":"PortalFant","value":"836"},{"label":"PopularLov","value":"30"},{"label":"Possession","value":"357"},{"label":"PowerStrug","value":"370"},{"label":"Progressio","value":"800"},{"label":"Positive","value":"948"},{"label":"ParentComp","value":"393"},{"label":"Prophecies","value":"572"},{"label":"Programmer","value":"667"},{"label":"Philosophi","value":"456"},{"label":"Protagonis","value":"705"},{"label":"Psychologi","value":"713"},{"label":"Priestesse","value":"717"},{"label":"Protagonis","value":"94"},{"label":"Protagonis","value":"381"},{"label":"Protagonis","value":"403"},{"label":"PillBasedC","value":"415"},{"label":"Polyandry","value":"519"},{"label":"PreviousLi","value":"529"},{"label":"Pharmacist","value":"574"},{"label":"Planets","value":"607"},{"label":"Parasites","value":"629"},{"label":"Playboys","value":"630"},{"label":"Paizuri","value":"670"},{"label":"Precogniti","value":"710"},{"label":"Protagonis","value":"737"},{"label":"PacifistPr","value":"744"},{"label":"Persistent","value":"749"},{"label":"Pilots","value":"780"},{"label":"Popular","value":"894"},{"label":"PrettyGirl","value":"895"},{"label":"QuirkyChar","value":"387"},{"label":"Reincarnat","value":"74"},{"label":"R18","value":"855"},{"label":"Romance","value":"638"},{"label":"R-18","value":"417"},{"label":"Revenge","value":"37"},{"label":"RomanticSu","value":"154"},{"label":"RuthlessPr","value":"76"},{"label":"Royalty","value":"243"},{"label":"Rpe","value":"203"},{"label":"Racism","value":"379"},{"label":"Rebirth","value":"491"},{"label":"Religions","value":"398"},{"label":"R-15","value":"559"},{"label":"Royalfamil","value":"873"},{"label":"Rarebloodl","value":"864"},{"label":"Rape","value":"530"},{"label":"Restaurant","value":"364"},{"label":"RighteousP","value":"540"},{"label":"Resurrecti","value":"552"},{"label":"RankSystem","value":"595"},{"label":"RaceChange","value":"73"},{"label":"ReverseRpe","value":"483"},{"label":"ReverseRap","value":"690"},{"label":"Rebellion","value":"750"},{"label":"RichProtag","value":"803"},{"label":"Richfamily","value":"889"},{"label":"Reincarnat","value":"95"},{"label":"RpeVictimB","value":"202"},{"label":"Returningf","value":"412"},{"label":"Reincarnat","value":"428"},{"label":"Raids","value":"436"},{"label":"ReverseHar","value":"520"},{"label":"Reincarnat","value":"605"},{"label":"Reincarnat","value":"689"},{"label":"ResolutePr","value":"697"},{"label":"Reincarnat","value":"722"},{"label":"RWBY","value":"829"},{"label":"Races","value":"841"},{"label":"Righteous","value":"947"},{"label":"System","value":"537"},{"label":"SpecialAbi","value":"269"},{"label":"SwordAndMa","value":"344"},{"label":"Superpower","value":"782"},{"label":"SliceofLif","value":"621"},{"label":"Survival","value":"302"},{"label":"SecondChan","value":"281"},{"label":"SystemAdmi","value":"277"},{"label":"StrongtoSt","value":"450"},{"label":"StrongLove","value":"156"},{"label":"SlowRomanc","value":"231"},{"label":"ShamelessP","value":"97"},{"label":"SecretIden","value":"96"},{"label":"SwordWield","value":"100"},{"label":"Showbiz","value":"39"},{"label":"SummoningM","value":"343"},{"label":"Strategist","value":"435"},{"label":"Smut","value":"516"},{"label":"Sweetlove","value":"865"},{"label":"SurvivalGa","value":"368"},{"label":"Spirits","value":"372"},{"label":"Sects","value":"410"},{"label":"SlowCultiv","value":"624"},{"label":"SkillAssim","value":"371"},{"label":"SkillCreat","value":"352"},{"label":"StrategicB","value":"373"},{"label":"Summons","value":"913"},{"label":"SuddenStre","value":"77"},{"label":"SlowGrowth","value":"341"},{"label":"SoulPower","value":"452"},{"label":"Spaceship","value":"600"},{"label":"Souls","value":"99"},{"label":"Saves","value":"300"},{"label":"StoreOwner","value":"276"},{"label":"SentientOb","value":"353"},{"label":"SectDevelo","value":"475"},{"label":"SecretOrga","value":"548"},{"label":"Space","value":"716"},{"label":"SummonedHe","value":"560"},{"label":"Sweet","value":"916"},{"label":"SmartCoupl","value":"41"},{"label":"SpatialMan","value":"233"},{"label":"Scientists","value":"388"},{"label":"SkillBooks","value":"434"},{"label":"Shapeshift","value":"944"},{"label":"ShyCharact","value":"98"},{"label":"SealedPowe","value":"155"},{"label":"SuddenWeal","value":"342"},{"label":"SelfishPro","value":"470"},{"label":"Siblings","value":"505"},{"label":"Slaves","value":"678"},{"label":"SuperHeroe","value":"725"},{"label":"Scary","value":"937"},{"label":"Singlefema","value":"946"},{"label":"SportsBask","value":"588"},{"label":"SpiritUser","value":"645"},{"label":"Sci-fi","value":"679"},{"label":"Superstar","value":"922"},{"label":"SxualAbuse","value":"204"},{"label":"Secrets","value":"319"},{"label":"SinglePare","value":"365"},{"label":"Soldiers","value":"449"},{"label":"Saints","value":"481"},{"label":"SpiritAdvi","value":"484"},{"label":"SpearWield","value":"524"},{"label":"Suicides","value":"656"},{"label":"Seduction","value":"672"},{"label":"Succubus","value":"673"},{"label":"Samurai","value":"683"},{"label":"SadisticCh","value":"692"},{"label":"SicklyChar","value":"712"},{"label":"SelflessPr","value":"738"},{"label":"Satire","value":"835"},{"label":"Serious","value":"936"},{"label":"Seductive","value":"949"},{"label":"Supernatur","value":"964"},{"label":"SexualCult","value":"230"},{"label":"SchemesAnd","value":"244"},{"label":"Sleeping","value":"275"},{"label":"Strength-b","value":"301"},{"label":"SiblingsNo","value":"340"},{"label":"SevenDeadl","value":"416"},{"label":"Sharp-tong","value":"457"},{"label":"StockholmS","value":"495"},{"label":"Student-Te","value":"513"},{"label":"Shapeshift","value":"525"},{"label":"Skyrim","value":"554"},{"label":"Sports","value":"586"},{"label":"SoundMagic","value":"591"},{"label":"Shounen-Ai","value":"596"},{"label":"Sci-Fantas","value":"606"},{"label":"slow-roman","value":"626"},{"label":"SecretRela","value":"658"},{"label":"SisterComp","value":"659"},{"label":"Shoujo-AiS","value":"661"},{"label":"SecretiveP","value":"708"},{"label":"sciencefic","value":"714"},{"label":"SexualAbus","value":"730"},{"label":"Spies","value":"731"},{"label":"StubbornPr","value":"736"},{"label":"SaveProtag","value":"772"},{"label":"Sibling&am","value":"774"},{"label":"SeeingThin","value":"776"},{"label":"SxFriends","value":"777"},{"label":"SharingABo","value":"783"},{"label":"SerialKill","value":"786"},{"label":"Singers","value":"832"},{"label":"SoftSci-fi","value":"840"},{"label":"Strategy","value":"843"},{"label":"Smartprota","value":"876"},{"label":"Strongfl","value":"878"},{"label":"Secretive","value":"890"},{"label":"SuperAbili","value":"891"},{"label":"Stepmom","value":"912"},{"label":"Secretary","value":"932"},{"label":"Studenttea","value":"940"},{"label":"Strongfema","value":"950"},{"label":"Sekai","value":"958"},{"label":"Signin","value":"977"},{"label":"Transmigra","value":"102"},{"label":"Tragedy","value":"794"},{"label":"TimeTravel","value":"389"},{"label":"Thestronga","value":"914"},{"label":"TimeSkip","value":"234"},{"label":"Technologi","value":"429"},{"label":"TragicPast","value":"44"},{"label":"Tsundere","value":"382"},{"label":"TimeManipu","value":"263"},{"label":"Thriller","value":"637"},{"label":"Teachers","value":"101"},{"label":"Twins","value":"506"},{"label":"Thieves","value":"514"},{"label":"Teamwork","value":"542"},{"label":"ThaiNovel","value":"815"},{"label":"TimeLoop","value":"696"},{"label":"Twisted","value":"906"},{"label":"TimeParado","value":"430"},{"label":"TimidProta","value":"473"},{"label":"Torture","value":"589"},{"label":"TwistedPer","value":"693"},{"label":"Threesome","value":"706"},{"label":"Teen","value":"857"},{"label":"Terrori","value":"884"},{"label":"Transporte","value":"103"},{"label":"Transporte","value":"278"},{"label":"Transporte","value":"375"},{"label":"Trap","value":"405"},{"label":"Transforma","value":"612"},{"label":"Tentacles","value":"666"},{"label":"Talesof D","value":"752"},{"label":"Transmigra","value":"764"},{"label":"Transplant","value":"768"},{"label":"Transporte","value":"784"},{"label":"TheAsteris","value":"826"},{"label":"TheGamer","value":"828"},{"label":"Trialmarri","value":"880"},{"label":"TheParanor","value":"887"},{"label":"TheMainCha","value":"896"},{"label":"TheDevil","value":"897"},{"label":"Urban","value":"522"},{"label":"Unprincipl","value":"923"},{"label":"UniqueWeap","value":"418"},{"label":"Undead","value":"965"},{"label":"UnluckyPro","value":"611"},{"label":"Unconditio","value":"445"},{"label":"Unreliable","value":"451"},{"label":"UglytoBeau","value":"550"},{"label":"Underestim","value":"79"},{"label":"UniqueCult","value":"81"},{"label":"UniqueWeap","value":"582"},{"label":"Villain","value":"861"},{"label":"VirtualRea","value":"433"},{"label":"Videogame","value":"925"},{"label":"Vampire","value":"602"},{"label":"Vampires","value":"323"},{"label":"Villainess","value":"680"},{"label":"VoiceActor","value":"446"},{"label":"Vietnamese","value":"820"},{"label":"Villainpro","value":"941"},{"label":"VideoGames","value":"973"},{"label":"WebNovel","value":"805"},{"label":"WeaktoStro","value":"83"},{"label":"Wars","value":"303"},{"label":"WealthyCha","value":"334"},{"label":"WorldTrave","value":"84"},{"label":"WorldHoppi","value":"504"},{"label":"Wizards","value":"571"},{"label":"Werewolf","value":"849"},{"label":"Werebeasts","value":"325"},{"label":"WeakProtag","value":"324"},{"label":"Witches","value":"570"},{"label":"WorldTree","value":"640"},{"label":"WeektoStro","value":"609"},{"label":"Wishes","value":"615"},{"label":"Writers","value":"662"},{"label":"WebnovelSp","value":"709"},{"label":"Warhammer4","value":"732"},{"label":"WarRecords","value":"745"},{"label":"Wuxia","value":"759"},{"label":"Worlds","value":"869"},{"label":"Weak-to-st","value":"959"},{"label":"Xianxia","value":"603"},{"label":"Xuanhuan","value":"773"},{"label":"Yandere","value":"402"},{"label":"Yuri","value":"929"},{"label":"Yaoi","value":"866"},{"label":"YoungerLov","value":"551"},{"label":"YoungerSis","value":"763"},{"label":"YoungerBro","value":"775"},{"label":"Zombies","value":"594"},{"label":"Zombie","value":"598"}]}}});
export default plugin;