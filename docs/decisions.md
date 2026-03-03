# Architecture Decisions

## ADR-001: Hybrid MCP Strategy

**Decision:** Use official GitHub MCP for standard ops, custom server only for unique tools.

**Context:** The official GitHub MCP (`https://api.githubcopilot.com/mcp/`) already provides `create_repository`, `push_files`, `get_file_contents`, `search_code`, issue/PR management. Reimplementing these adds maintenance burden with no benefit.

**Consequence:** mkbc-mcp has only 4 tool groups (~7 tools total) instead of 15+. Less code, less surface area, less maintenance.

---

## ADR-002: GitHubProvider OAuth (not generic OAuth)

**Decision:** Use FastMCP's GitHubProvider for OAuth proxy.

**Context:** GitHub is the only upstream provider needed. The OAuth token doubles as the GH API token for Octokit calls in bootstrap/grep tools. Using a generic OAuth provider would require a separate mechanism to get GH API access.

**Consequence:** Single auth flow gives both MCP session auth and GH API access. Token swap keeps upstream token server-side (encrypted).

---

## ADR-003: Shallow Clone Cache for Grep

**Decision:** Use local shallow clones + `git grep` instead of GitHub Search API.

**Context:**
- GH Search API: no regex, 10 req/min rate limit, index lag, no context lines
- Local git grep: full PCRE regex, instant, configurable context, zero API calls

**Trade-offs:**
- Requires disk space (~shallow clones are small)
- First clone is slower than API call
- Need cache invalidation (TTL 5min)

**Consequence:** Real regex grep with context lines. Cache in `~/mcp-data/clones/`.

---

## ADR-004: Atomic Multi-File Commits via Git Data API

**Decision:** Use Git Data API (blobs -> tree -> commit -> ref update) for bootstrap, not sequential Contents API calls.

**Context:** Contents API creates one commit per file. Bootstrapping 5 files = 5 commits. Git Data API creates one atomic commit with all files.

**Consequence:** Clean git history. Single commit for project scaffolding.

---

## ADR-005: No Database

**Decision:** Flat files only. DiskStore for OAuth state, filesystem for project store.

**Context:** Single-user personal server on Uberspace shared hosting. SQLite or Postgres adds complexity with no benefit at this scale.

**Consequence:** Simpler deployment, simpler backup (rsync), no DB process to manage.

---

## ADR-006: CLAUDE.md as Handoff Format

**Decision:** Generate a structured CLAUDE.md with fixed sections as the primary artifact.

**Context:** Claude Code reads CLAUDE.md first when entering a project. A well-structured CLAUDE.md with context, goals, constraints, and decisions enables Claude Code to continue work without re-explaining anything from the chat.

**Sections:**
- Project Context (chat summary)
- Tech Stack
- Goals (Claude Code's TODO list)
- Constraints (dead ends, requirements)
- Decisions (architectural choices)
- References (links, papers)

**Consequence:** Seamless chat -> code transition. Claude Code knows what was discussed, what was decided, and what to do next.
