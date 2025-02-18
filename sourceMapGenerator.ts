// import { readTextFileSync } from "https://deno.land/std/fs/mod.ts";
import { resolve } from "https://deno.land/std/path/mod.ts";
import PLUGINS from "./src/plugins/index.ts";

const filePath = resolve(Deno.cwd(), "src/plugins/index.ts");
const fileContent = await Deno.readTextFile(filePath);

const importRegex = /import\s+p_(\d+)\s+from\s+"\.\/(\w+)\/(\w+)\.ts";/g;
const sourceMap: {
  id: string;
  name: string;
  site: string;
  lang: string;
  version: string;
  url: string; // the url of raw code
  iconUrl: string;
}[] = [];

let match;
while ((match = importRegex.exec(fileContent)) !== null) {
  const index = parseInt(match[1], 10);
  const lang = match[2];

  // console.log("./src/plugins" + match[0].substring(match[0].indexOf(`/`), match[0].indexOf(`;`)));
  // const id = match[3];

  const tempSource = PLUGINS[index];
  const id = tempSource.id;
  const name = tempSource.name;
  const site = tempSource.site;
  // const lang = tempSource.lang;
  const version = tempSource.version;

  const url = "./src/plugins" + match[0].substring(match[0].indexOf(`/`), match[0].indexOf(`;`) - 1);
  const iconUrl = tempSource.icon;

  console.log(url);

  const plugin = {
    id,
    name,
    site,
    lang,
    version,
    url,
    iconUrl,
    index,
  };
  sourceMap.push(plugin);
}
const outputFilePath = resolve(Deno.cwd(), "sourceMap.json");

await Deno.writeTextFile(outputFilePath, JSON.stringify(sourceMap, null, 2));

// console.log(sourceMap);
