// import { Chapter } from "./chapter.ts";
// import { NovelMeta } from "./novel_meta.ts";

// export class NovelMetaWithChapters extends NovelMeta {
//   chapters: Chapter[];

//   constructor(
//     source: string,
//     url: string,
//     cover: string,
//     title: string,
//     summary: string,
//     author: string,
//     status: string,
//     genres: string[],
//     chapters: Chapter[],
//     lastUpdate: string = "Unknown"
//   ) {
//     super(source, url, cover, title, summary, author, status, genres, lastUpdate);
//     this.chapters = chapters;
//   }

//   static override fromResult(data: any): NovelMetaWithChapters {
//     return new NovelMetaWithChapters(
//       data.source,
//       data.url,
//       data.cover,
//       data.title,
//       data.summary,
//       data.author,
//       data.status,
//       data.genres,
//       data.chapters ? data.chapters.map((c: any) => Chapter.fromResult(c)) : []

//     );
//   }

//   override toJSON(): object {
//     return {
//       ...super.toJSON(),
//       chapters: this.chapters.map((c) => c.toJSON()),
//     };
//   }
// }
