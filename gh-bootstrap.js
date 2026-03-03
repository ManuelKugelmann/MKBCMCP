#!/usr/bin/env node
// gh-bootstrap.js — Zero dependencies, Node 20+
//
// POST /gh/bootstrap  { name, description?, public?, claude_md }
// GET  /gh/status     (no auth)
//
// Env vars:
//   GITHUB_PAT    GITHUB_OWNER    AUTH_USER    AUTH_PASS    PORT(9876)

import { createServer } from "node:http";
import { request as httpsReq } from "node:https";

const C = {
  PAT:   process.env.GITHUB_PAT,
  OWNER: process.env.GITHUB_OWNER,
  USER:  process.env.AUTH_USER,
  PASS:  process.env.AUTH_PASS,
  PORT:  parseInt(process.env.PORT || "9876"),
};
for (const [k, v] of Object.entries(C)) {
  if (!v && k !== "PORT") { console.error(`❌ Missing: ${k}`); process.exit(1); }
}

// ── Rate: 5 creates / calendar day UTC ──────────────────
let dayKey = "", dayCount = 0;
function rateLimited() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) { dayKey = today; dayCount = 0; }
  if (dayCount >= 5) return true;
  dayCount++;
  return false;
}

// ── IP ban: 5 fails / 15min → block 1h ─────────────────
const bans = new Map();
function ip(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
}
function isBanned(a) {
  const s = bans.get(a);
  if (!s?.until) return false;
  if (Date.now() > s.until) { bans.delete(a); return false; }
  return true;
}
function authFail(a) {
  const now = Date.now(), s = bans.get(a) || { f: [], until: null };
  s.f = s.f.filter(t => now - t < 900_000);
  s.f.push(now);
  if (s.f.length >= 5) { s.until = now + 3_600_000; s.f = []; log(`🚫 BAN ${a}`); }
  bans.set(a, s);
}
setInterval(() => { const n = Date.now(); for (const [k, v] of bans) if (v.until && n > v.until) bans.delete(k); }, 600_000);

// ── Helpers ─────────────────────────────────────────────
function log(...a) { console.error(new Date().toISOString().slice(11, 19), ...a); }
function send(res, code, data) { const b = JSON.stringify(data); res.writeHead(code, { "Content-Type": "application/json" }); res.end(b); }

function checkAuth(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return false;
  const [u, p] = Buffer.from(h.slice(6), "base64").toString().split(":");
  return u === C.USER && p === C.PASS;
}

function readBody(req) {
  return new Promise((ok, no) => {
    const ch = []; let sz = 0;
    req.on("data", c => { sz += c.length; if (sz > 500_000) { req.destroy(); no(new Error("too large")); } ch.push(c); });
    req.on("end", () => ok(Buffer.concat(ch).toString()));
    req.on("error", no);
  });
}

function gh(method, path, body) {
  return new Promise((ok, no) => {
    const d = body ? JSON.stringify(body) : null;
    const r = httpsReq({
      hostname: "api.github.com", path, method,
      headers: {
        "User-Agent": "gh-bootstrap", Authorization: `Bearer ${C.PAT}`,
        Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
        ...(d ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(d) } : {}),
      },
    }, res => {
      const ch = [];
      res.on("data", c => ch.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(ch).toString();
        const j = raw ? JSON.parse(raw) : null;
        res.statusCode >= 400 ? no({ status: res.statusCode, message: j?.message || raw }) : ok(j);
      });
    });
    r.on("error", no);
    if (d) r.write(d);
    r.end();
  });
}

// ── Server ──────────────────────────────────────────────
createServer(async (req, res) => {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const addr = ip(req);
  const path = new URL(req.url, "http://x").pathname;

  // No auth
  if (path === "/gh/status") return send(res, 200, { ok: true, today: dayCount, bans: bans.size });

  // Auth gate
  if (isBanned(addr)) return send(res, 429, { error: "Banned. Try later." });
  if (!checkAuth(req)) { authFail(addr); res.setHeader("WWW-Authenticate", 'Basic realm="gh"'); return send(res, 401, { error: "Unauthorized" }); }
  bans.delete(addr);

  if (path !== "/gh/bootstrap" || req.method !== "POST")
    return send(res, 404, { error: "POST /gh/bootstrap" });

  if (rateLimited()) return send(res, 429, { error: "5/day limit reached. Resets midnight UTC.", remaining: 0 });

  try {
    const { name, description = "", claude_md, public: pub = true } = JSON.parse(await readBody(req));

    if (!name || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name))
      return send(res, 400, { error: "Bad name. a-z0-9, hyphens, underscores." });
    if (!claude_md || typeof claude_md !== "string" || claude_md.length < 10)
      return send(res, 400, { error: "claude_md required (min 10 chars)." });
    if (claude_md.length > 100_000)
      return send(res, 400, { error: "claude_md too large (100KB max)." });

    // Create or detect
    let exists = false;
    try { await gh("GET", `/repos/${C.OWNER}/${name}`); exists = true; } catch {}

    if (!exists) {
      await gh("POST", "/user/repos", { name, description, private: !pub, auto_init: true });
      await new Promise(r => setTimeout(r, 2000));
    }

    // Push CLAUDE.md
    let sha;
    try { sha = (await gh("GET", `/repos/${C.OWNER}/${name}/contents/CLAUDE.md`)).sha; } catch {}

    await gh("PUT", `/repos/${C.OWNER}/${name}/contents/CLAUDE.md`, {
      message: sha ? "Update CLAUDE.md" : "Bootstrap with CLAUDE.md",
      content: Buffer.from(claude_md).toString("base64"),
      ...(sha ? { sha } : {}),
    });

    const r = { repo: exists ? "updated" : "created", url: `https://github.com/${C.OWNER}/${name}`, remaining: 5 - dayCount };
    log(`✓ ${r.repo} ${name} [${dayCount}/5] ${addr}`);
    return send(res, exists ? 200 : 201, r);

  } catch (e) {
    log(`💥 ${addr} ${e.message || e}`);
    return send(res, 502, { error: String(e.message || e) });
  }

}).listen(C.PORT, "0.0.0.0", () => log(`🚀 :${C.PORT} owner=${C.OWNER}`));
