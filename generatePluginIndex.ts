import { walk } from "https://deno.land/std/fs/mod.ts";
import { resolve, relative } from "https://deno.land/std/path/mod.ts";

async function findAllTsFiles(dir: string): Promise<string[]> {
  const tsFiles: string[] = [];
  for await (const entry of walk(dir, { exts: [".ts"], includeDirs: false })) {
    const relativePath = relative(dir, entry.path);
    if (relativePath.includes("/") || relativePath.includes("\\")) {
      // Ensure the file is in a subdirectory
      tsFiles.push(entry.path);
    }
  }
  return tsFiles;
}
async function generatePluginIndex() {
  const pluginsDir = resolve(Deno.cwd(), "./src/plugins");
  const indexPath = resolve(pluginsDir, "index.ts");

  const tsFiles = await findAllTsFiles(pluginsDir);

  const exports = tsFiles.map((filePath, index) => {
    const relativePath = `./${relative(pluginsDir, filePath).replace(/\\/g, "/")}`;
    return `import p_${index} from "${relativePath}";`;
  });

  const indexContent =
    "import { Plugin } from '../types/plugin.ts';\n" +
    exports.join("\n") +
    "\n\nconst PLUGINS: Plugin.PluginBase[] = [" +
    tsFiles.map((_, index) => `p_${index}`).join(", ") +
    "]; \nexport default PLUGINS";

  await Deno.writeTextFile(indexPath, indexContent);
  console.log(`Generated ${indexPath}`);
}

async function replaceKeywordsInFiles(dir: string, keywords: string[], replacements: string[]) {
  const tsFiles = await findAllTsFiles(dir);

  for (const filePath of tsFiles) {
    let fileContent = await Deno.readTextFile(filePath);
    keywords.forEach((keyword, index) => {
      const replacement = replacements[index];
      fileContent = fileContent.replace(new RegExp(keyword, "g"), replacement);
    });
    await Deno.writeTextFile(filePath, fileContent);
    console.log(`Updated ${filePath}`);
  }
}

await generatePluginIndex();
await replaceKeywordsInFiles(
  resolve(Deno.cwd(), "./src/plugins"),
  [
    "'cheerio'",
    "'dayjs'",
    "'htmlparser2'",
    "'urlencode'",
    "'@libs/fetch'",
    "'@libs/filterInputs'",
    "'@typings/plugin'",
    "'@libs/defaultCover'",
    "'@libs/novelStatus'",
    "'@libs/storage'",
    "'@libs/isAbsoluteUrl'",
    "'../../../src/libs/filterInputs'",
    "import { NovelItem } from '../../test_web/static/js';",
  ],
  [
    "'npm:cheerio'",
    "'npm:dayjs'",
    "'npm:htmlparser2'",
    "'npm:urlencode'",
    "'@libs/fetch.ts'",
    "'@libs/filterInputs.ts'",
    "'@typings/plugin.ts'",
    "'@libs/defaultCover.ts'",
    "'@libs/novelStatus.ts'",
    "'@libs/storage.ts'",
    "'@libs/isAbsoluteUrl.ts'",
    "'@libs/filterInputs.ts'",
    "",
  ]
);
