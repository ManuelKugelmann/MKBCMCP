import { FastMCP, requireAuth } from "fastmcp";
import { z } from "zod";
import { join, resolve, relative } from "node:path";
import { readFile, writeFile, rm, readdir, stat, mkdir } from "node:fs/promises";

export function registerStoreTools(server: FastMCP, dataDir: string) {
  const storeRoot = join(dataDir, "store");

  function safePath(project: string, filePath: string): string {
    if (project.includes("..") || project.includes("/") || project.includes("\\")) {
      throw new Error(`Invalid project name: ${project}`);
    }
    const full = resolve(storeRoot, project, filePath);
    const expected = resolve(storeRoot, project);
    if (!full.startsWith(expected + "/") && full !== expected) {
      throw new Error(`Path traversal rejected: ${filePath}`);
    }
    return full;
  }

  server.addTool({
    name: "store_write",
    canAccess: requireAuth,
    description: "Save a file to local project store on server.",
    parameters: z.object({
      project: z.string().describe("Project identifier"),
      path: z.string().describe("File path within project"),
      content: z.string().describe("File content (UTF-8)"),
    }),
    execute: async (args) => {
      const fullPath = safePath(args.project, args.path);
      await mkdir(join(fullPath, ".."), { recursive: true });
      await writeFile(fullPath, args.content, "utf-8");
      return `Written ${args.project}/${args.path} (${Buffer.byteLength(args.content)} bytes)`;
    },
  });

  server.addTool({
    name: "store_read",
    canAccess: requireAuth,
    description: "Read a file from local project store.",
    parameters: z.object({
      project: z.string().describe("Project identifier"),
      path: z.string().describe("File path within project"),
    }),
    execute: async (args) => {
      const fullPath = safePath(args.project, args.path);
      const content = await readFile(fullPath, "utf-8");
      return content;
    },
  });

  server.addTool({
    name: "store_list",
    canAccess: requireAuth,
    description: "List files in local project store.",
    parameters: z.object({
      project: z.string().describe("Project identifier"),
      path: z.string().optional().default("").describe("Subdirectory"),
    }),
    execute: async (args) => {
      const dir = safePath(args.project, args.path || "");
      const entries = await listTree(dir, dir);
      if (entries.length === 0) return `${args.project}/${args.path || ""} is empty`;
      return entries.map((e) => `${e.type === "dir" ? "dir" : "file"} ${e.path} ${e.size ? `(${e.size}B)` : ""}`).join("\n");
    },
  });

  server.addTool({
    name: "store_delete",
    canAccess: requireAuth,
    description: "Delete a file from local project store.",
    parameters: z.object({
      project: z.string().describe("Project identifier"),
      path: z.string().describe("File path within project"),
    }),
    execute: async (args) => {
      const fullPath = safePath(args.project, args.path);
      await rm(fullPath);
      return `Deleted ${args.project}/${args.path}`;
    },
  });

  async function listTree(
    dir: string,
    root: string
  ): Promise<Array<{ path: string; type: "file" | "dir"; size?: number }>> {
    const results: Array<{ path: string; type: "file" | "dir"; size?: number }> = [];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = relative(root, fullPath);
        if (entry.isDirectory()) {
          results.push({ path: relPath, type: "dir" });
          results.push(...(await listTree(fullPath, root)));
        } else {
          const st = await stat(fullPath);
          results.push({ path: relPath, type: "file", size: st.size });
        }
      }
    } catch {
      // Directory doesn't exist
    }
    return results;
  }
}
