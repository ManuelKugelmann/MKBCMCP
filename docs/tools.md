# Tool Design

## gh_project_bootstrap

Creates a GitHub repo with structured scaffolding for claude.ai -> Claude Code handoff.

### Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Repo name (slug) |
| `description` | string | yes | One-line repo description |
| `project_context` | string | yes | Background, decisions from chat |
| `tech_stack` | string[] | yes | e.g. `["typescript", "unity"]` |
| `goals` | string[] | yes | Immediate goals for Claude Code |
| `constraints` | string[] | no | Known constraints, non-goals |
| `references` | string[] | no | URLs, papers, docs |
| `template` | enum | no | `"node-ts"`, `"unity-cs"`, `"python"`, `"bare"` (default) |
| `private` | bool | no | Default: `true` |
| `topics` | string[] | no | GitHub topics |

### Creates

```
repo/
  CLAUDE.md                        # Handoff document (generated)
  README.md                        # From description + tech stack
  .github/copilot-instructions.md  # Mirror of CLAUDE.md
  .gitignore                       # Template-appropriate
  docs/decisions.md                # Architectural decisions
```

### Implementation

Uses Git Data API for atomic multi-file commit:
1. `POST /repos/{owner}/{repo}` -- create repo
2. `POST /repos/{owner}/{repo}/git/blobs` -- create blobs for each file
3. `POST /repos/{owner}/{repo}/git/trees` -- create tree
4. `POST /repos/{owner}/{repo}/git/commits` -- create commit
5. `PATCH /repos/{owner}/{repo}/git/refs/heads/main` -- update ref

Wrapped via Octokit using upstream GH token from OAuth session.

---

## gh_project_add_context

Appends content to a specific section of an existing CLAUDE.md.

### Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `repo` | string | yes | `owner/name` |
| `section` | enum | yes | `"goals"`, `"constraints"`, `"decisions"`, `"context"`, `"references"` |
| `content` | string | yes | Markdown content to append |

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
| `repo` | string | yes | `owner/name` |
| `pattern` | string | yes | Regex pattern |
| `path_filter` | string | no | Glob, e.g. `**/*.ts` |
| `ref` | string | no | Branch/tag/SHA |
| `context_lines` | int | no | Lines before/after (default: 2) |
| `max_results` | int | no | Default: 50 |

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
| `project` | string | yes | Project identifier |
| `path` | string | yes | File path within project |
| `content` | string | yes | File content (UTF-8) |

Storage root: `~/mcp-data/store/{project}/{path}`

Path validation: reject `..`, absolute paths, symlink traversal.

---

## store_read

| Param | Type | Required |
|-------|------|----------|
| `project` | string | yes |
| `path` | string | yes |

Returns file content. Fails on 404.

---

## store_list

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `project` | string | yes | Project identifier |
| `path` | string | no | Subdirectory (default: root) |

Returns tree listing with type/size.

---

## store_delete

| Param | Type | Required |
|-------|------|----------|
| `project` | string | yes |
| `path` | string | yes |

Fails if file doesn't exist.
