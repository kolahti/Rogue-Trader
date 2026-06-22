import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  blankSheet,
  generateId,
  isValidShipId,
  validateSheet,
} from "../lib/ships-core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SHIPS_DIR = path.join(ROOT, "ships");
const DIST_DIR = path.join(ROOT, "dist");

const isProd = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || (isProd ? 3000 : 3001);

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function shipFilePath(id) {
  if (!isValidShipId(id)) return null;
  const resolved = path.resolve(SHIPS_DIR, `${id}.json`);
  if (!resolved.startsWith(path.resolve(SHIPS_DIR) + path.sep)) return null;
  return resolved;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

function sendJson(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

async function ensureShipsDir() {
  await fs.mkdir(SHIPS_DIR, { recursive: true });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
  };
  return types[ext] ?? "application/octet-stream";
}

async function serveStatic(req, res) {
  let urlPath = new URL(req.url, "http://localhost").pathname;
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = path.join(DIST_DIR, urlPath);
  const resolved = path.resolve(filePath);
  if (
    !resolved.startsWith(path.resolve(DIST_DIR) + path.sep) &&
    resolved !== path.resolve(DIST_DIR, "index.html")
  ) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(resolved);
    if (stat.isFile()) {
      res.writeHead(200, { "Content-Type": contentType(resolved) });
      createReadStream(resolved).pipe(res);
      return;
    }
  } catch {
    // fall through to SPA index
  }

  const indexPath = path.join(DIST_DIR, "index.html");
  if (existsSync(indexPath)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    createReadStream(indexPath).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  try {
    if (url.pathname === "/api/ships" && req.method === "POST") {
      await ensureShipsDir();
      const id = generateId();
      const sheet = blankSheet(id);
      const filePath = shipFilePath(id);
      await fs.writeFile(filePath, JSON.stringify(sheet, null, 2), "utf8");
      sendJson(res, 201, { id, url: `/s/${id}` });
      return;
    }

    const shipMatch = url.pathname.match(/^\/api\/ships\/([^/]+)$/);
    if (shipMatch) {
      const id = decodeURIComponent(shipMatch[1]);
      const filePath = shipFilePath(id);
      if (!filePath) {
        sendJson(res, 400, { error: "Invalid ship id" });
        return;
      }

      if (req.method === "GET") {
        try {
          const raw = await fs.readFile(filePath, "utf8");
          sendJson(res, 200, JSON.parse(raw));
        } catch (err) {
          if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
            sendJson(res, 404, { error: "Ship not found" });
            return;
          }
          throw err;
        }
        return;
      }

      if (req.method === "PUT") {
        const sheet = await readJsonBody(req);
        const validationError = validateSheet(sheet);
        if (validationError) {
          sendJson(res, 400, { error: validationError });
          return;
        }
        await ensureShipsDir();
        sheet.id = id;
        await fs.writeFile(filePath, JSON.stringify(sheet, null, 2), "utf8");
        sendJson(res, 200, { id });
        return;
      }
    }

    if (isProd && !url.pathname.startsWith("/api/")) {
      await serveStatic(req, res);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal server error" });
    }
  }
});

server.listen(PORT, () => {
  console.log(`Ship API listening on http://localhost:${PORT}${isProd ? " (serving dist)" : ""}`);
});
