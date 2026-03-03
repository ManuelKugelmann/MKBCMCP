import { FastMCP } from "fastmcp";
import { z } from "zod";
import { createOctokit } from "../lib/octokit.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat, mkdir } from "node:fs/promises";
import { join } from "node:path";

const exec = promisify(execFile);

const CLONE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function registerGrepTool(server: FastMCP, dataDir: string) {
  const clonesDir = join(dataDir, "clones");

  server.addTool({
    name: "gh_grep",
    description:
      "Regex grep across a GitHub repo using local shallow clone cache. " +
      "Supports PCRE regex, context lines, and path filters. " +
      "Much faster and more powerful than GitHub Search API.",
    parameters: z.object({
      repo: z.string().describe("owner/name"),
      pattern: z.string().describe("Regex pattern (PCRE)"),
      path_filter: z.string().optional().describe('Glob filter, e.g. "**/*.ts"'),
      ref: z.string().optional().describe("Branch/tag/SHA"),
      context_lines: z.number().int().min(0).max(10).optional().default(2),
      max_results: z.number().int().min(1).max(200).optional().default(50),
    }),
    execute: async (args, { session }) => {
      const octokit = createOctokit(session);
      const [owner, repo] = args.repo.split("/");
      const repoDir = join(clonesDir, owner, repo);

      // Ensure clone exists and is fresh
      await ensureClone(repoDir, owner, repo, args.ref, session);

      // Run git grep
      const grepArgs = [
        "grep",
        "-n", // line numbers
        "-P", // PCRE regex
        `--context=${args.context_lines}`,
        `--max-count=${args.max_results}`,
        "--color=never",
        args.pattern,
      ];

      if (args.path_filter) {
        grepArgs.push("--", args.path_filter);
      }

      try {
        const { stdout } = await exec("git", grepArgs, {
          cwd: repoDir,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          timeout: 30_000,
        });

        const lines = stdout.split("\n").filter(Boolean);
        return `Found ${lines.length} matches for /${args.pattern}/ in ${args.repo}\n\n${stdout}`;
      } catch (err: any) {
        if (err.code === 1) {
          return `No matches for /${args.pattern}/ in ${args.repo}`;
        }
        throw err;
      }
    },
  });

  async function ensureClone(
    repoDir: string,
    owner: string,
    repo: string,
    ref: string | undefined,
    session: any
  ) {
    let needsClone = false;

    try {
      const st = await stat(join(repoDir, ".git"));
      // Check freshness
      const age = Date.now() - st.mtimeMs;
      if (age > CLONE_TTL_MS) {
        // Pull to refresh
        await exec("git", ["fetch", "--depth=1", "origin"], {
          cwd: repoDir,
          timeout: 60_000,
        });
        if (ref) {
          await exec("git", ["checkout", ref], { cwd: repoDir });
        } else {
          await exec("git", ["reset", "--hard", "origin/HEAD"], { cwd: repoDir });
        }
      }
    } catch {
      needsClone = true;
    }

    if (needsClone) {
      await mkdir(repoDir, { recursive: true });
      const token = getUpstreamToken(session);
      const cloneUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;

      const cloneArgs = ["clone", "--depth=1", "--single-branch"];
      if (ref) cloneArgs.push("--branch", ref);
      cloneArgs.push(cloneUrl, repoDir);

      await exec("git", cloneArgs, { timeout: 120_000 });
    }
  }

  function getUpstreamToken(session: any): string {
    // TODO: Extract upstream GH token from FastMCP session
    // This depends on FastMCP's token swap implementation
    // The OAuthProxy stores upstream tokens and provides access via session
    throw new Error("TODO: implement upstream token extraction from session");
  }
}
