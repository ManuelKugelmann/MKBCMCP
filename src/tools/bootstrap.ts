import { FastMCP } from "fastmcp";
import { z } from "zod";
import { createOctokit } from "../lib/octokit.js";
import { renderClaudeMd, renderReadme, renderGitignore, renderDecisions } from "../lib/templates.js";

// TODO: Implement bootstrap tools
// See docs/tools.md for the full design specification.

export function registerBootstrapTools(server: FastMCP) {
  server.addTool({
    name: "gh_project_bootstrap",
    description:
      "Create a GitHub repo with structured CLAUDE.md scaffolding for " +
      "claude.ai chat -> Claude Code handoff. Uses Git Data API for " +
      "atomic multi-file commit.",
    parameters: z.object({
      name: z.string().describe("Repo name (slug)"),
      description: z.string().describe("One-line repo description"),
      project_context: z.string().describe("Background and decisions from chat"),
      tech_stack: z.array(z.string()).describe('e.g. ["typescript", "fastmcp"]'),
      goals: z.array(z.string()).describe("Immediate goals for Claude Code"),
      constraints: z.array(z.string()).optional().describe("Known constraints, non-goals"),
      references: z.array(z.string()).optional().describe("URLs, papers, docs"),
      template: z.enum(["bare", "node-ts", "unity-cs", "python"]).optional().default("bare"),
      private: z.boolean().optional().default(true),
      topics: z.array(z.string()).optional(),
    }),
    execute: async (args, { session }) => {
      const octokit = createOctokit(session);
      const user = await octokit.rest.users.getAuthenticated();
      const owner = user.data.login;

      // 1. Create repo
      await octokit.rest.repos.createForAuthenticatedUser({
        name: args.name,
        description: args.description,
        private: args.private,
        auto_init: true,
      });

      // 2. Generate files
      const files: Record<string, string> = {
        "CLAUDE.md": renderClaudeMd(args, owner),
        "README.md": renderReadme(args),
        ".gitignore": renderGitignore(args.template ?? "bare"),
        "docs/decisions.md": renderDecisions(args),
      };

      // 3. Atomic commit via Git Data API
      // Get current commit SHA
      const ref = await octokit.rest.git.getRef({
        owner,
        repo: args.name,
        ref: "heads/main",
      });
      const baseSha = ref.data.object.sha;

      // Create blobs
      const blobPromises = Object.entries(files).map(async ([path, content]) => {
        const blob = await octokit.rest.git.createBlob({
          owner,
          repo: args.name,
          content,
          encoding: "utf-8",
        });
        return { path, sha: blob.data.sha };
      });
      const blobs = await Promise.all(blobPromises);

      // Create tree
      const tree = await octokit.rest.git.createTree({
        owner,
        repo: args.name,
        base_tree: baseSha,
        tree: blobs.map((b) => ({
          path: b.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: b.sha,
        })),
      });

      // Create commit
      const commit = await octokit.rest.git.createCommit({
        owner,
        repo: args.name,
        message: "Bootstrap project with CLAUDE.md",
        tree: tree.data.sha,
        parents: [baseSha],
      });

      // Update ref
      await octokit.rest.git.updateRef({
        owner,
        repo: args.name,
        ref: "heads/main",
        sha: commit.data.sha,
      });

      // 4. Set topics if provided
      if (args.topics?.length) {
        await octokit.rest.repos.replaceAllTopics({
          owner,
          repo: args.name,
          names: args.topics,
        });
      }

      const url = `https://github.com/${owner}/${args.name}`;
      return `Created ${url} with CLAUDE.md, README.md, .gitignore, docs/decisions.md`;
    },
  });

  server.addTool({
    name: "gh_project_add_context",
    description: "Append content to a specific section of an existing CLAUDE.md in a GitHub repo.",
    parameters: z.object({
      repo: z.string().describe("owner/name"),
      section: z.enum(["goals", "constraints", "decisions", "context", "references"]),
      content: z.string().describe("Markdown content to append"),
    }),
    execute: async (args, { session }) => {
      const octokit = createOctokit(session);
      const [owner, repo] = args.repo.split("/");

      // Get current CLAUDE.md
      const file = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: "CLAUDE.md",
      });

      if (!("content" in file.data)) {
        throw new Error("CLAUDE.md not found or is a directory");
      }

      const current = Buffer.from(file.data.content, "base64").toString("utf-8");
      const sha = file.data.sha;

      // Map section names to headers
      const headerMap: Record<string, string> = {
        goals: "## Goals",
        constraints: "## Constraints",
        decisions: "## Decisions",
        context: "## Project Context",
        references: "## References",
      };

      const header = headerMap[args.section];
      const headerIdx = current.indexOf(header);
      if (headerIdx === -1) {
        throw new Error(`Section "${args.section}" not found in CLAUDE.md`);
      }

      // Find the end of the section (next ## or EOF)
      const afterHeader = current.indexOf("\n", headerIdx);
      const nextSection = current.indexOf("\n## ", afterHeader + 1);
      const insertAt = nextSection === -1 ? current.length : nextSection;

      const updated = current.slice(0, insertAt) + "\n" + args.content + "\n" + current.slice(insertAt);

      // Write back
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: "CLAUDE.md",
        message: `Add ${args.section} context to CLAUDE.md`,
        content: Buffer.from(updated).toString("base64"),
        sha,
      });

      return `Updated ${args.section} section in ${args.repo}/CLAUDE.md`;
    },
  });
}
