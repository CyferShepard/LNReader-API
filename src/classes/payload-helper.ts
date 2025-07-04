import { Source } from "../schemas/source.ts";
import { FieldOptions, FilterType, SourceFilterField } from "../schemas/source_filter.ts";
import { ScraperPayload } from "./api-parser.ts";

let PLUGINS: any[] = []; // This will hold the loaded plugins

async function getSource(source: string) {
  const plugin = await getProjectConfigs(source);

  return plugin;
}

async function getProjectConfigs(project: string) {
  try {
    const projectDir = `./src/plugins/${project}`;

    // Check if directory exists
    try {
      const dirInfo = await Deno.stat(projectDir);
      if (!dirInfo.isDirectory) {
        throw new Error("Project path is not a directory");
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error("Project directory not found");
      }
    }

    // Read and process all TypeScript files in the project directory
    const result = [];

    for await (const entry of Deno.readDir(projectDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        try {
          // Get the file name without extension
          const fileName = entry.name.replace(/\.json$/, "");

          // Read and parse the JSON file
          const filePath = `${projectDir}/${entry.name}`;
          const fileContent = await Deno.readTextFile(filePath);
          let jsonData = {};
          try {
            jsonData = JSON.parse(fileContent);
          } catch (parseErr) {
            console.error(`Error parsing JSON in file ${entry.name}:`, parseErr);
            jsonData = { error: "Invalid JSON" };
          }

          // Add to result array as {name, config}
          result.push({
            name: fileName,
            config: jsonData,
          });
        } catch (fileErr) {
          console.error(`Error processing file ${entry.name}:`, fileErr);
          result.push({
            name: entry.name.replace(/\.json$/, ""),
            error: `Failed to process: ${fileErr instanceof Error ? fileErr.message : "Unknown error"}`,
          });
        }
      }
    }

    console.log(`Loaded project configs for ${project}:`, result);

    return {
      project: project,
      files: result,
    };
  } catch (e) {
    console.error(e);
    throw new Error(`Failed to read project files: ${(e as Error).toString()}`);
  }
}

async function getPayload(type: string, source: string) {
  const payloads: any = await getSource(source);
  const payloadItem = payloads["files"].findOrNull((p: any) => p["name"] == type);
  const payload = payloadItem ? payloadItem["config"] : null;
  const scraperPayload: ScraperPayload | null = payload ? ScraperPayload.fromJson(payload) : null;
  return scraperPayload;
}

async function getPlugins() {
  try {
    const configsDir = "./src/plugins"; // Path to configs folder
    const entries = [];

    // Check if directory exists
    try {
      const dirInfo = await Deno.stat(configsDir);
      if (!dirInfo.isDirectory) {
        return;
      }
    } catch (error) {
      // If directory doesn't exist, create it
      if (error instanceof Deno.errors.NotFound) {
        await Deno.mkdir(configsDir, { recursive: true });
      } else {
        throw error;
      }
    }

    // Read all entries in the configs directory
    for await (const entry of Deno.readDir(configsDir)) {
      // if (entry.isDirectory) {
      //   entries.push(entry.name);
      // }
      if (entry.isDirectory) {
        // const sourceField: SourceFilterField = new SourceFilterField("text", true, "name", "name", false);
        const filterPath = `${configsDir}/${entry.name}/filters.json`;

        try {
          const filterStat = await Deno.stat(filterPath);
          if (filterStat.isFile) {
            const filterContent = await Deno.readTextFile(filterPath);
            const filterJson = JSON.parse(filterContent);
            const source = Source.fromJSON ? Source.fromJSON(filterJson) : new Source(entry.name, filterJson); // fallback if no fromJSON
            entries.push(source);
            continue;
          }
        } catch (e) {
          // filter.json does not exist, skip
          // console.log(e);
        }
        // console.log(JSON.stringify(new Source(entry.name, f).toJSON()));
        const source = new Source(entry.name);

        entries.push(source);
      }
    }

    PLUGINS = entries;
  } catch (e) {
    console.error(e);
  }
}

const f: SourceFilterField[] = [
  new SourceFilterField({ type: FilterType.Main(), fieldName: "Keyword", fieldVar: "keyword" }),
  new SourceFilterField({ type: FilterType.Text(), fieldName: "Title", fieldVar: "title" }),
  new SourceFilterField({ type: FilterType.Text(), fieldName: "Author", fieldVar: "author" }),
  new SourceFilterField({
    type: FilterType.MultiSelect([
      new FieldOptions("Action", "action"),
      new FieldOptions("Adventure", "adventure"),
      new FieldOptions("Comedy", "comedy"),
      new FieldOptions("Contemporary", "contemporary"),
      new FieldOptions("Drama", "drama"),
      new FieldOptions("Fantasy", "fantasy"),
      new FieldOptions("Historical", "historical"),
      new FieldOptions("Horror", "horror"),
      new FieldOptions("Mystery", "mystery"),
      new FieldOptions("Psychological", "psychological"),
      new FieldOptions("Romance", "romance"),
      new FieldOptions("Satire", "satire"),
      new FieldOptions("Sci Fi", "sci_fi"),
      new FieldOptions("One Shot", "one_shot"),
      new FieldOptions("Tragedy", "tragedy"),
    ]),
    fieldName: "Genres",
    fieldVar: "tagsAdd",
    isMultiVar: true,
  }),
  new SourceFilterField({
    type: FilterType.MultiSelect([
      new FieldOptions("Action", "action"),
      new FieldOptions("Adventure", "adventure"),
      new FieldOptions("Comedy", "comedy"),
      new FieldOptions("Contemporary", "contemporary"),
      new FieldOptions("Drama", "drama"),
      new FieldOptions("Fantasy", "fantasy"),
      new FieldOptions("Historical", "historical"),
      new FieldOptions("Horror", "horror"),
      new FieldOptions("Mystery", "mystery"),
      new FieldOptions("Psychological", "psychological"),
      new FieldOptions("Romance", "romance"),
      new FieldOptions("Satire", "satire"),
      new FieldOptions("Sci Fi", "sci_fi"),
      new FieldOptions("One Shot", "one_shot"),
      new FieldOptions("Tragedy", "tragedy"),
    ]),
    fieldName: "Exclude Genres",
    fieldVar: "tagsRemove",
    isMultiVar: true,
  }),
  new SourceFilterField({
    type: FilterType.MultiSelect([
      new FieldOptions("AI-Assisted Content", "ai_assisted"),
      new FieldOptions("AI-Generated Content", "ai_generated"),
      new FieldOptions("Graphic Violence", "graphic_violence"),
      new FieldOptions("Profanity", "profanity"),
      new FieldOptions("Sensitive Content", "sensitive"),
      new FieldOptions("Sexual Content", "sexuality"),
    ]),
    fieldName: "Content Warnings",
    fieldVar: "tagsAdd",
    isMultiVar: true,
  }),
  new SourceFilterField({
    type: FilterType.MultiSelect([
      new FieldOptions("AI-Assisted Content", "ai_assisted"),
      new FieldOptions("AI-Generated Content", "ai_generated"),
      new FieldOptions("Graphic Violence", "graphic_violence"),
      new FieldOptions("Profanity", "profanity"),
      new FieldOptions("Sensitive Content", "sensitive"),
      new FieldOptions("Sexual Content", "sexuality"),
    ]),
    fieldName: "Exclude Content Warnings",
    fieldVar: "tagsRemove",
    isMultiVar: true,
  }),
  new SourceFilterField({
    type: FilterType.Numeric(),
    fieldName: "Pages (Min)",
    fieldVar: "minPages",
  }),
  new SourceFilterField({
    type: FilterType.Numeric(),
    fieldName: "Pages (Max)",
    fieldVar: "maxPages",
  }),
  new SourceFilterField({
    type: FilterType.Dropdown([
      new FieldOptions("ALL", "ALL"),
      new FieldOptions("COMPLETED", "COMPLETED"),
      new FieldOptions("DROPPED", "DROPPED"),
      new FieldOptions("ONGOING", "ONGOING"),
      new FieldOptions("HIATUS", "HIATUS"),
      new FieldOptions("STUB", "STUB"),
    ]),
    fieldName: "Status",
    fieldVar: "status",
  }),
  new SourceFilterField({
    type: FilterType.Dropdown([
      new FieldOptions("Relevance", "relevance"),
      new FieldOptions("Popularity", "popularity"),
      new FieldOptions("Average Rating", "rating"),
      new FieldOptions("Last Update", "last_update"),
      new FieldOptions("Release Date", "release_date"),
      new FieldOptions("Followers", "followers"),
      new FieldOptions("Number of Pages", "length"),
      new FieldOptions("Views", "views"),
      new FieldOptions("Title", "title"),
      new FieldOptions("Author", "author"),
    ]),
    fieldName: "Order By",
    fieldVar: "orderBy",
  }),
  new SourceFilterField({
    type: FilterType.Dropdown([new FieldOptions("Ascending", "asc"), new FieldOptions("Descending", "desc")]),
    fieldName: "Dir",
    fieldVar: "dir",
  }),
  new SourceFilterField({
    type: FilterType.Dropdown([
      new FieldOptions("All", "ALL"),
      new FieldOptions("Fan Fiction", "fanfiction"),
      new FieldOptions("Original", "original"),
    ]),
    fieldName: "Type",
    fieldVar: "type",
  }),
];
// console.log(new Source(entry.name, f).toJSON());

export { getSource, getProjectConfigs, getPayload, getPlugins, PLUGINS };
