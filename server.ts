# GitHub MCP — Official vs mkbc-mcp

## Official GitHub MCP Connector

**URL:** `https://api.githubcopilot.com/mcp/`

### Default Toolsets (repos, issues, pull_requests)

| Tool | Description |
|------|-------------|
| `create_repository` | Create new repo |
| `get_file_contents` | Read file from repo |
| `create_or_update_file` | Write single file |
| `push_files` | Multi-file commit |
| `search_repositories` | Search repos by query |
| `search_code` | Search code (no regex, 10 req/min) |
| `list_commits` | List commits on branch |
| `create_branch` | Create branch |
| `issue_read` / `issue_write` | CRUD issues |
| `pull_request_read` / `pull_request_write` | CRUD PRs |
| `pull_request_review_write` | PR reviews |

### Optional Toolsets

| Toolset | Enable Via |
|---------|-----------|
| `actions` | Header `X-MCP-Toolsets: default,actions` |
| `code_security` | Header `X-MCP-Toolsets: default,code_security` |
| `secret_protection` | Separate toolset |
| `notifications` | Separate toolset |
| `copilot` | Remote-only, creates PRs via Copilot agent |

### Configuration

- Read-only mode: `X-MCP-Readonly: true` or URL `/readonly`
- Specific tools: `X-MCP-Tools: get_file_contents,issue_read`
- Lockdown mode: sanitizes prompt injection from public repos

## mkbc-mcp (This Server) — Covers the Gaps

| Tool | Why Not In Official |
|------|---------------------|
| `gh_project_bootstrap` | Templated CLAUDE.md scaffolding from chat context |
| `gh_project_add_context` | Structured section-append to CLAUDE.md |
| `gh_grep` | Real regex via clone cache (GH search has no regex) |
| `store_*` | Local filesystem, not GitHub |

## GitHub Search API Reference

### Search Repositories

```
GET /search/repositories?q={query}&sort={sort}&order={order}&per_page={n}
```

Key qualifiers: `user:`, `org:`, `in:name,description,readme,topics`, `language:`, `topic:`, `stars:>N`, `pushed:>DATE`, `is:public|private`, `archived:false`

Sort: `stars`, `forks`, `updated` (default: best match)
Rate: 30 req/min authenticated

### Search Code

```
GET /search/code?q={query}+repo:{owner/name}
```

Qualifiers: `repo:`, `path:`, `language:`, `extension:`, `filename:`
Rate: **10 req/min** (must be authenticated, no regex, index lag)

### Git Data API (for atomic commits)

```
POST /repos/{owner}/{repo}/git/blobs      # create file blobs
POST /repos/{owner}/{repo}/git/trees      # create tree from blobs
POST /repos/{owner}/{repo}/git/commits    # create commit on tree
PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}  # update branch ref
```
