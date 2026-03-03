import { useState, useCallback, useRef, useEffect } from "react";

const API = "https://api.github.com";

const TEMPLATE = `<!-- project: my-project -->
<!-- deploy: local-docker -->
# my-project

Short description of what this project does.

## Stack
- Language/framework here

## Architecture
- Keep it simple

## Build & Run
\`\`\`bash
# install
# build  
# run
# test
\`\`\`

## Deploy
- Target: local-docker

## Constraints
- Fail early, don't hide errors
- KISS architecture
- No premature abstraction
`;

function StatusBadge({ status }) {
  const map = {
    idle: { icon: "○", color: "text-zinc-500" },
    loading: { icon: "◌", color: "text-yellow-400 animate-pulse" },
    ok: { icon: "●", color: "text-emerald-400" },
    error: { icon: "✕", color: "text-red-400" },
    creating: { icon: "◐", color: "text-blue-400 animate-spin" },
    pushing: { icon: "◑", color: "text-blue-400 animate-spin" },
    done: { icon: "✓", color: "text-emerald-400" },
  };
  const s = map[status] || map.idle;
  return <span className={`${s.color} font-mono text-lg`}>{s.icon}</span>;
}

async function ghFetch(path, token, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}

function extractProjectName(md) {
  const m = md.match(/<!--\s*project:\s*(.+?)\s*-->/);
  return m ? m[1].trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") : "";
}

function extractDeployTarget(md) {
  const m = md.match(/<!--\s*deploy:\s*(.+?)\s*-->/);
  return m ? m[1].trim() : "";
}

export default function GitHubBootstrap() {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("idle");
  const [claudeMd, setClaudeMd] = useState(TEMPLATE);
  const [repoName, setRepoName] = useState("my-project");
  const [isPublic, setIsPublic] = useState(true);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("idle");
  const [log, setLog] = useState([]);
  const [repoUrl, setRepoUrl] = useState(null);
  const logRef = useRef(null);

  const addLog = useCallback((icon, msg) => {
    setLog((prev) => [...prev, { icon, msg, ts: Date.now() }]);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // Auto-extract project name from CLAUDE.md
  useEffect(() => {
    const name = extractProjectName(claudeMd);
    if (name) setRepoName(name);
  }, [claudeMd]);

  const verifyToken = async () => {
    if (!token.trim()) return;
    setAuthStatus("loading");
    setUser(null);
    try {
      const u = await ghFetch("/user", token);
      setUser(u);
      setAuthStatus("ok");
    } catch (e) {
      setAuthStatus("error");
      addLog("✕", `Auth failed: ${e.message}`);
    }
  };

  const createAndPush = async () => {
    if (!user || !repoName.trim() || !claudeMd.trim()) return;
    setStatus("creating");
    setLog([]);
    setRepoUrl(null);

    try {
      // 1. Check if repo exists
      addLog("◌", `Checking if ${user.login}/${repoName} exists...`);
      let repoExists = false;
      try {
        await ghFetch(`/repos/${user.login}/${repoName}`, token);
        repoExists = true;
      } catch {
        repoExists = false;
      }

      // 2. Create repo if needed
      if (!repoExists) {
        addLog("◐", `Creating repo: ${repoName}`);
        await ghFetch("/user/repos", token, {
          method: "POST",
          body: JSON.stringify({
            name: repoName,
            description: description || extractProjectName(claudeMd) || "",
            private: !isPublic,
            auto_init: true, // creates main branch with README
          }),
        });
        addLog("✓", "Repo created");
        // Small delay for GitHub to initialize
        await new Promise((r) => setTimeout(r, 1500));
      } else {
        addLog("●", "Repo already exists, will update CLAUDE.md");
      }

      // 3. Push CLAUDE.md
      setStatus("pushing");
      addLog("◑", "Pushing CLAUDE.md...");

      const content = btoa(unescape(encodeURIComponent(claudeMd)));

      // Check if CLAUDE.md already exists (for update)
      let sha = undefined;
      try {
        const existing = await ghFetch(
          `/repos/${user.login}/${repoName}/contents/CLAUDE.md`,
          token
        );
        sha = existing.sha;
        addLog("●", "Updating existing CLAUDE.md");
      } catch {
        addLog("○", "Creating new CLAUDE.md");
      }

      await ghFetch(`/repos/${user.login}/${repoName}/contents/CLAUDE.md`, token, {
        method: "PUT",
        body: JSON.stringify({
          message: sha ? "Update CLAUDE.md via bootstrap" : "Bootstrap project with CLAUDE.md",
          content,
          ...(sha ? { sha } : {}),
        }),
      });
      addLog("✓", "CLAUDE.md pushed");

      // 4. Push .gitignore with deploy target hint
      const deploy = extractDeployTarget(claudeMd);
      if (deploy) {
        addLog("◑", "Adding deploy metadata...");
        try {
          const metaContent = btoa(
            unescape(encodeURIComponent(JSON.stringify({ deploy_target: deploy, bootstrapped: new Date().toISOString() }, null, 2)))
          );
          await ghFetch(`/repos/${user.login}/${repoName}/contents/.bootstrap.json`, token, {
            method: "PUT",
            body: JSON.stringify({
              message: "Add bootstrap metadata",
              content: metaContent,
            }),
          });
          addLog("✓", `Deploy target: ${deploy}`);
        } catch (e) {
          addLog("⚠", `Metadata skipped: ${e.message}`);
        }
      }

      const url = `https://github.com/${user.login}/${repoName}`;
      setRepoUrl(url);
      setStatus("done");
      addLog("★", `Done → ${url}`);
    } catch (e) {
      setStatus("error");
      addLog("✕", `Failed: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 font-mono text-sm">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
          <span className="text-xl">⚡</span>
          <h1 className="text-lg font-bold text-zinc-200">Project Bootstrap → GitHub</h1>
        </div>

        {/* Auth */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={authStatus} />
            <span className="text-zinc-400 text-xs uppercase tracking-wider">GitHub Auth</span>
            {user && (
              <span className="text-emerald-400 text-xs ml-auto">
                ● {user.login}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setAuthStatus("idle");
                  setUser(null);
                }}
                placeholder="ghp_... or github_pat_..."
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-zinc-300 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none pr-10"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
                title={showToken ? "Hide" : "Show"}
              >
                {showToken ? "◉" : "◎"}
              </button>
            </div>
            <button
              onClick={verifyToken}
              disabled={!token.trim() || authStatus === "loading"}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded border border-zinc-700 text-zinc-300"
            >
              Verify
            </button>
          </div>
          <p className="text-zinc-600 text-xs">
            Fine-grained PAT with <code className="text-zinc-500">repo</code> scope · stored in memory only · 
            <a
              href="https://github.com/settings/tokens?type=beta"
              target="_blank"
              rel="noopener"
              className="text-blue-500 hover:text-blue-400 ml-1"
            >
              Create token ↗
            </a>
          </p>
        </div>

        {/* CLAUDE.md Editor */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">📄</span>
            <span className="text-zinc-400 text-xs uppercase tracking-wider">CLAUDE.md</span>
            <span className="text-zinc-600 text-xs ml-auto">
              {claudeMd.length} chars
            </span>
          </div>
          <textarea
            value={claudeMd}
            onChange={(e) => setClaudeMd(e.target.value)}
            rows={16}
            spellCheck={false}
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-zinc-300 font-mono text-xs leading-relaxed focus:border-zinc-500 focus:outline-none resize-y"
          />
        </div>

        {/* Repo Config */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">⚙</span>
            <span className="text-zinc-400 text-xs uppercase tracking-wider">Repo Config</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-500 text-xs block mb-1">Repository Name</label>
              <input
                value={repoName}
                onChange={(e) => setRepoName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-zinc-300 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-zinc-500 text-xs block mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-zinc-300 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="accent-emerald-500"
              />
              <span className="text-zinc-400 text-xs">Public</span>
            </label>
            {user && (
              <span className="text-zinc-600 text-xs">
                → github.com/{user.login}/{repoName || "..."}
              </span>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="flex gap-2">
          <button
            onClick={createAndPush}
            disabled={!user || !repoName.trim() || status === "creating" || status === "pushing"}
            className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg font-bold text-zinc-100 transition-colors"
          >
            {status === "creating" || status === "pushing"
              ? "Working..."
              : status === "done"
              ? "✓ Push Again"
              : "🚀 Create Repo & Push"}
          </button>
          {repoUrl && (
            <>
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener"
                className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 flex items-center gap-1 border border-zinc-700"
              >
                GitHub ↗
              </a>
              <a
                href={`https://claude.ai/code?repo=${encodeURIComponent(repoUrl)}`}
                target="_blank"
                rel="noopener"
                className="px-4 py-3 bg-orange-700 hover:bg-orange-600 rounded-lg text-zinc-100 flex items-center gap-1"
                title="Open in Claude Code Web"
              >
                CC ↗
              </a>
            </>
          )}
        </div>

        {/* Log */}
        {log.length > 0 && (
          <div
            ref={logRef}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1"
          >
            {log.map((l, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-zinc-500 w-4 shrink-0 text-center">{l.icon}</span>
                <span className="text-zinc-400">{l.msg}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-zinc-700 text-xs text-center pt-2 border-t border-zinc-800">
          Token never stored · 
          Paste CLAUDE.md from Claude Chat · 
          Use <code>&lt;!-- project: name --&gt;</code> for auto-naming
        </div>
      </div>
    </div>
  );
}
