# TODO

## High Priority

- [ ] Implement upstream token extraction from FastMCP session (`src/tools/grep.ts:getUpstreamToken`, `src/lib/octokit.ts`)
- [ ] Install dependencies and verify TypeScript compilation
- [ ] Add `.env.example` with all required environment variables
- [ ] Test MCP server startup locally

## Bootstrap Tool

- [ ] Test `gh_project_bootstrap` end-to-end (create repo + atomic commit)
- [ ] Test `gh_project_add_context` section parsing and append logic
- [ ] Add `.github/copilot-instructions.md` mirror to bootstrap output (per tool design spec)

## Grep Tool

- [ ] Verify shallow clone cache TTL behavior
- [ ] Add cleanup for stale clones (disk space management)
- [ ] Handle private repos that require auth for clone

## Store Tools

- [ ] Add max file size limit to `store_write`
- [ ] Add total storage quota per project
- [ ] Consider adding `store_exists` tool

## Standalone gh-bootstrap.js

- [ ] Integrate ntfy notifications on successful bootstrap
- [ ] Add CORS origin whitelist (currently allows any origin)
- [ ] Add request logging to file

## UI (bootstrap.jsx)

- [ ] Decide on hosting approach (static site? embedded in MCP server?)
- [ ] Add loading states and error recovery
- [ ] Support selecting .gitignore template

## Deployment

- [ ] Test deployment on Uberspace with new directory structure
- [ ] Update supervisord.ini paths if needed
- [ ] Set up log rotation
- [ ] Add health check endpoint to MCP server

## Documentation

- [ ] Add API examples to docs/tools.md
- [ ] Document OAuth flow and token lifecycle
- [ ] Add architecture diagram

## Code Quality

- [ ] Add ESLint configuration
- [ ] Add unit tests for templates.ts renderers
- [ ] Add integration tests for store tools (path traversal, edge cases)
- [ ] Replace `any` types in session handling with proper McpSession type
