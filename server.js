import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 5173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function resolveRequestPath(url) {
  const parsed = new URL(url, `http://localhost:${port}`);
  const cleanPath = normalize(decodeURIComponent(parsed.pathname)).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = resolve(join(root, cleanPath));

  if (!requestedPath.startsWith(root)) {
    return null;
  }

  if (!existsSync(requestedPath)) {
    return resolve(join(root, "index.html"));
  }

  const stats = statSync(requestedPath);
  if (stats.isDirectory()) {
    return resolve(join(requestedPath, "index.html"));
  }

  return requestedPath;
}

const server = createServer((request, response) => {
  if (!request.url || request.method !== "GET") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }

  const filePath = resolveRequestPath(request.url);
  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const extension = extname(filePath);
  response.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SpriteForge is running at http://127.0.0.1:${port}`);
});
