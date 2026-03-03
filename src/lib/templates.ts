interface BootstrapArgs {
  name: string;
  description: string;
  project_context: string;
  tech_stack: string[];
  goals: string[];
  constraints?: string[];
  references?: string[];
  template?: string;
}

export function renderClaudeMd(args: BootstrapArgs, owner: string): string {
  const sections = [
    `# ${args.name}`,
    "",
    `> ${args.description}`,
    "",
    "## Project Context",
    "",
    args.project_context,
    "",
    "## Tech Stack",
    "",
    args.tech_stack.map((t) => `- ${t}`).join("\n"),
    "",
    "## Goals",
    "",
    args.goals.map((g, i) => `${i + 1}. ${g}`).join("\n"),
  ];

  if (args.constraints?.length) {
    sections.push("", "## Constraints", "", args.constraints.map((c) => `- ${c}`).join("\n"));
  }

  sections.push("", "## Decisions", "", "_No decisions recorded yet._");

  if (args.references?.length) {
    sections.push("", "## References", "", args.references.map((r) => `- ${r}`).join("\n"));
  }

  sections.push(
    "",
    "## Development Notes",
    "",
    `- Created: ${new Date().toISOString().split("T")[0]}`,
    "- Origin: claude.ai chat -> Claude Code handoff",
    `- Owner: ${owner}`
  );

  return sections.join("\n") + "\n";
}

export function renderReadme(args: BootstrapArgs): string {
  return [
    `# ${args.name}`,
    "",
    args.description,
    "",
    "## Tech Stack",
    "",
    args.tech_stack.map((t) => `- ${t}`).join("\n"),
    "",
    "## Getting Started",
    "",
    "See [CLAUDE.md](./CLAUDE.md) for project context and goals.",
    "",
  ].join("\n");
}

const GITIGNORE_TEMPLATES: Record<string, string> = {
  bare: ["node_modules/", ".env", ".DS_Store", "*.log", "dist/", "build/"].join("\n"),
  "node-ts": [
    "node_modules/",
    "dist/",
    ".env",
    ".env.local",
    "*.log",
    ".DS_Store",
    "coverage/",
    ".tsbuildinfo",
  ].join("\n"),
  "unity-cs": [
    "[Ll]ibrary/",
    "[Tt]emp/",
    "[Oo]bj/",
    "[Bb]uild/",
    "[Bb]uilds/",
    "[Ll]ogs/",
    "[Uu]ser[Ss]ettings/",
    "*.csproj",
    "*.unityproj",
    "*.sln",
    "*.suo",
    "*.tmp",
    "*.user",
    "*.userprefs",
    "*.pidb",
    "*.booproj",
    "*.svd",
    "*.pdb",
    "*.mdb",
    "*.opendb",
    "*.VC.db",
    ".DS_Store",
  ].join("\n"),
  python: [
    "__pycache__/",
    "*.py[cod]",
    "*$py.class",
    ".env",
    ".venv/",
    "venv/",
    "dist/",
    "build/",
    "*.egg-info/",
    ".DS_Store",
  ].join("\n"),
};

export function renderGitignore(template: string): string {
  return (GITIGNORE_TEMPLATES[template] ?? GITIGNORE_TEMPLATES.bare) + "\n";
}

export function renderDecisions(args: BootstrapArgs): string {
  return [
    "# Architectural Decisions",
    "",
    `Project: ${args.name}`,
    `Created: ${new Date().toISOString().split("T")[0]}`,
    "",
    "---",
    "",
    "_Record architectural decisions here as the project evolves._",
    "",
    "## Template",
    "",
    "### ADR-NNN: Title",
    "",
    "**Decision:** What was decided.",
    "",
    "**Context:** Why this decision was made.",
    "",
    "**Consequence:** What follows from this decision.",
    "",
  ].join("\n");
}
