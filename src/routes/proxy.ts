import { Router, send } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import { ImageCache } from "../schemas/imageCache.ts";

const proxyRouter = new Router({ prefix: "/proxy" });

proxyRouter.get("/icon", async (context) => {
  const source = context.request.url.searchParams.get("source");
  if (!source) {
    context.response.status = 400;
    context.response.body = { error: "source name is required" };
    return;
  }

  try {
    const projectDir = `./src/plugins/${source}`;
    // Check if directory exists
    try {
      const dirInfo = await Deno.stat(projectDir);
      if (!dirInfo.isDirectory) {
        throw new Error("Source path is not a directory");
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        context.response.status = 404;
        context.response.body = { error: "Source directory not found" };
        return;
      } else {
        throw error;
      }
    }

    // Look for icon files in the project directory
    let iconFile: string | null = null;
    for await (const entry of Deno.readDir(projectDir)) {
      if (entry.isFile && (entry.name.endsWith(".ico") || entry.name.endsWith(".png"))) {
        iconFile = `${projectDir}/${entry.name}`;
        break; // Use the first icon found
      }
    }

    if (iconFile) {
      context.response.headers.set("Content-Type", "image/png"); // Set appropriate content type
      await send(context, iconFile);
    } else {
      context.response.status = 404;
      context.response.body = { error: "Icon file not found" };
    }
  } catch (e) {
    console.error(e);
    context.response.status = 500;
    context.response.body = { error: (e as Error).toString() };
  }
});

proxyRouter.get("/imageProxy", async (context) => {
  const imageUrl = context.request.url.searchParams.get("imageUrl");
  const cacheImage = (context.request.url.searchParams.get("cacheImage") ?? "true") === "true";

  if (!imageUrl) {
    context.response.body = { error: "imageUrl is required" };
    return;
  }
  try {
    if (cacheImage == true) {
      const cachedImage = await dbSqLiteHandler.getCachedImage(imageUrl);
      if (cachedImage) {
        context.response.headers.set("Content-Type", cachedImage.contentType);
        context.response.body = cachedImage.data;
        console.log(`Serving cached image for URL: ${imageUrl}`);
        return;
      }
    }
    const response = await fetch(imageUrl);
    if (!response.ok) {
      context.response.status = response.status;
      context.response.body = { error: "Failed to fetch image" };
      console.error(`Failed to fetch image from URL: ${imageUrl}, Status: ${response.status}`);
      return;
    }

    const contentType = response.headers.get("Content-Type");
    const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "application/octet-stream"];
    if (!contentType || !validImageTypes.includes(contentType)) {
      context.response.status = 400;
      context.response.body = { error: "Invalid image URL" };
      console.error(`Invalid image URL: ${imageUrl} with content type: ${contentType}`);
      return;
    }

    const imageBuffer = await response.arrayBuffer();
    context.response.headers.set("Content-Type", contentType);
    const imageArray = new Uint8Array(imageBuffer);
    context.response.body = imageArray;
    // console.log(`Serving non-cached image for URL: ${imageUrl}`);
    if (cacheImage == true) {
      await dbSqLiteHandler.insertImageCache(new ImageCache(imageUrl, contentType, imageArray));
    }
  } catch (error) {
    console.error(error);
    context.response.status = 500;
    context.response.body = { error: "Internal Server Error" };
  }
});

export default proxyRouter;
