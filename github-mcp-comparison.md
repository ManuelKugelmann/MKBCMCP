# Tool Design

## gh_project_bootstrap

Creates a GitHub repo with structured scaffolding for claude.ai → Claude Code handoff.

### Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Repo name (slug) |
| `description` | string | ✅ | One-line repo description |
| `project_context` | string | ✅ | Background, decisions from chat |
| `tech_stack` | string[] | ✅ | e.g. `["typescript", "unity"]` |
| `goals` | string[] | ✅ | Immediate goals for Claude Code |
| `constraints` | string[] | ❌ | Known constraints, non-goals |
| `references` | string[] | ❌ | URLs, papers, docs |
| `template` | enum | ❌ | `"node-ts"`, `"unity-cs"`, `"python"`, `"bare"` (default) |
| `private` | bool | ❌ | Default: `true` |
| `topics` | string[] | ❌ | GitHub topics |

### Creates

```
repo/
├── CLAUDE.md                        # Handoff document (generated)
├── README.md                        # From description + tech stack
├── .github/copilot-instructions.md  # Mirror of CLAUDE.md
├── .gitignore                       # Template-appropriate
└── docs/decisions.md                # Architectural decisions
```

### Implementation

Uses Git Data API for atomic multi-file commit:
1. `POST /repos/{owner}/{repo}` — create repo
2. `POST /repos/{owner}/{repo}/git/blobs` — create blobs for each file
3. `POST /repos/{owner}/{repo}/git/trees` — create tree
4. `POST /repos/{owner}/{repo}/git/commits` — create commit
5. `PATCH /repos/{owner}/{repo}/git/refs/heads/main` — update ref

Wrapped via Octokit using upstream GH token from OAuth session.

---

## gh_project_add_context

Appends content to a specific section of an existing CLAUDE.md.

### Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `repo` | string | ✅ | `owner/name` |
| `section` | enum | ✅ | `"goals"`, `"constraints"`, `"decisions"`, `"context"`, `"references"` |
| `content` | string | ✅ | Markdown content to append |

### Implementation

1. Read current CLAUDE.md via Contents API (get sha)
2. Parse sections by `## ` headers
3. Append content to target section
4. Write back with sha (optimistic concurrency)

---

## gh_grep

Regex grep across a GitHub repo via local shallow clone cache.

### Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `repo` | string | ✅ | `owner/name` |
| `pattern` | string | ✅ | Regex pattern |
| `path_filter` | string | ❌ | Glob, e.g. `**/*.ts` |
| `ref` | string | ❌ | Branch/tag/SHA |
| `context_lines` | int | ❌ | Lines before/after (default: 2) |
| `max_results` | int | ❌ | Default: 50 |

### Implementation

1. Shallow clone/pull to `~/mcp-data/clones/{owner}/{repo}/`
2. `git grep -n -P --context={n} "{pattern}" -- "{path_filter}"`
3. Parse output into structured results: `{file, line, content, context}`
4. Cache TTL: pull before grep if >5min since last pull

### Why Not GH Search API?

- No regex support
- Rate limited to 10 req/min
- Index lag (not real-time)
- No context lines

---

## store_write

Save a file to local Uberspace filesystem.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `project` | string | ✅ | Project identifier |
| `path` | string | ✅ | File path within project |
| `content` | string | ✅ | File content (UTF-8) |

Storage root: `~/mcp-data/store/{project}/{path}`

Path validation: reject `..`, absolute paths, symlink traversal.

---

## store_read

| Param | Type | Required |
|-------|------|----------|
| `project` | string | ✅ |
| `path` | string | ✅ |

Returns file content. Fails on 404.

---

## store_list

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `project` | string | ✅ | Project identifier |
| `path` | string | ❌ | Subdirectory (default: root) |

Returns tree listing with type/size.

---

## store_delete

| Param | Type | Required |
|-------|------|----------|
| `project` | string | ✅ |
| `path` | string | ✅ |

Fails if file doesn't exist.
