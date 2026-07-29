import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Serves the static export for the end-to-end tests.
 *
 * The app is `output: "export"`, so `next start` cannot serve it and the tests
 * need a plain file server. Twenty lines beats a dependency, and testing the
 * exported bundle rather than the dev server is the point: it is the artefact
 * that actually ships.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const port = Number(process.env.PORT ?? 4180);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

async function resolve(pathname) {
  // normalize collapses any ../ before it can escape the export directory.
  const candidate = join(root, normalize(pathname));
  if (!candidate.startsWith(root)) return undefined;

  for (const file of [candidate, `${candidate}.html`, join(candidate, "index.html")]) {
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {
      // try the next shape
    }
  }
  return undefined;
}

createServer(async (req, res) => {
  const file = await resolve(new URL(req.url ?? "/", "http://localhost").pathname);

  if (file === undefined) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }

  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
