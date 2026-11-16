/** Explicit filenames/extensions, never content guessing (especially for errors). */
const LANGUAGES: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  json: "json", jsonc: "json", css: "css", scss: "scss", less: "less",
  html: "xml", htm: "xml", xml: "xml", svg: "xml", csproj: "xml", props: "xml",
  md: "markdown", markdown: "markdown", mdx: "markdown",
  yml: "yaml", yaml: "yaml", toml: "ini", ini: "ini", cfg: "ini",
  py: "python", pyw: "python", rb: "ruby", php: "php", rs: "rust", go: "go",
  c: "c", h: "c", cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp",
  cs: "csharp", java: "java", kt: "kotlin", kts: "kotlin", swift: "swift",
  sh: "bash", bash: "bash", zsh: "bash", sql: "sql", graphql: "graphql", gql: "graphql",
  lua: "lua", pl: "perl", r: "r", diff: "diff", patch: "diff", vue: "xml",
};
const FILENAMES: Record<string, string> = { makefile: "makefile", gnumakefile: "makefile", ".bashrc": "bash", ".zshrc": "bash", ".env": "bash" };
export function fileLanguage(path?: string): string | undefined {
  const name = path?.split(/[\\/]/).at(-1)?.toLowerCase();
  if (!name) return undefined;
  if (Object.hasOwn(FILENAMES, name)) return FILENAMES[name];
  if (name.startsWith(".env.")) return "bash";
  if (!name.includes(".")) return undefined;
  const extension = name.slice(name.lastIndexOf(".") + 1);
  return Object.hasOwn(LANGUAGES, extension) ? LANGUAGES[extension] : undefined;
}
