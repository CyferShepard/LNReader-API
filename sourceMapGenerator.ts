// import { readTextFileSync } from "https://deno.land/std/fs/mod.ts";
import { resolve } from "https://deno.land/std/path/mod.ts";

const filePath = resolve(Deno.cwd(), "src/plugins/index.ts");
const fileContent = await Deno.readTextFile(filePath);

const importRegex = /import\s+p_(\d+)\s+from\s+"\.\/(\w+)\/(\w+)\.ts";/g;
const sourceMap: { source: string; language: string; index: number }[] = [];

let match;
while ((match = importRegex.exec(fileContent)) !== null) {
  const index = parseInt(match[1], 10);
  const language = match[2];
  const source = match[3];
  sourceMap.push({ source, language, index });
}
const outputFilePath = resolve(Deno.cwd(), "sourceMap.json");

await Deno.writeTextFile(outputFilePath, JSON.stringify(sourceMap, null, 2));

console.log(sourceMap);
