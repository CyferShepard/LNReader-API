import { join, dirname } from "https://deno.land/std@0.224.0/path/mod.ts";
import { Context } from "node:vm";

/**
 * Download all files from a GitHub folder (public repo).
 * @param repo e.g. "user/repo"
 * @param folderPath e.g. "configs"
 * @param branch e.g. "main"
 * @param destLocalPath e.g. "./plugins"
 */
export async function downloadGithubFolder(
  repo: string,
  folderPath: string,
  branch = "main",
  destLocalPath = "./downloaded",
  wsFunction: (message: string) => void,
  rootFolderPath = folderPath // keep track of the original folderPath
) {
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${folderPath}?ref=${branch}`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`Failed to fetch folder: ${res.statusText}`);
  const files = await res.json();
  wsFunction(`Downloading folder: ${folderPath} from repo: ${repo} on branch: ${branch}`);

  for (const file of files) {
    // Remove the rootFolderPath prefix from file.path
    const relativePath = file.path.startsWith(rootFolderPath)
      ? file.path.slice(rootFolderPath.length).replace(/^\/|\\/, "")
      : file.path;

    if (file.type === "file") {
      const fileRes = await fetch(file.download_url);
      if (!fileRes.ok) throw new Error(`Failed to download ${file.name}`);
      const content = new Uint8Array(await fileRes.arrayBuffer());
      const localPath = join(destLocalPath, relativePath);
      await Deno.mkdir(dirname(localPath), { recursive: true });
      await Deno.writeFile(localPath, content);
      console.log(`Downloaded: ${localPath}`);
    }
    if (file.type === "dir") {
      await downloadGithubFolder(repo, file.path, branch, destLocalPath, wsFunction, rootFolderPath);
    }
  }

  wsFunction(`Finished downloading folder: ${folderPath} from repo: ${repo}`);
}
