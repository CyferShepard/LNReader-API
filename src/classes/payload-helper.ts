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
        entries.push(entry.name);
      }
    }

    PLUGINS = entries;
  } catch (e) {
    console.error(e);
  }
}

export { getSource, getProjectConfigs, getPayload, getPlugins, PLUGINS };
