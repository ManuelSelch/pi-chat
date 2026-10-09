import { expect, it } from "vitest";
import { fileLanguage } from "../../../../../src/web/chat/tools/file-language.js";
it.each([
  ["src/index.TSX", "typescript"], ["C:\\project\\main.py", "python"],
  ["package.json", "json"], ["config.yaml", "yaml"], ["config.toml", "ini"],
  ["Program.cs", "csharp"], ["view.html", "xml"], ["README.md", "markdown"],
  ["Makefile", "makefile"], [".env.local", "bash"], ["script.sh", "bash"],
  ["unknown.xyz", undefined], ["notes.txt", undefined], ["ts", undefined],
  ["README", undefined], [undefined, undefined], ["constructor", undefined],
  ["file.constructor", undefined], ["file.__proto__", undefined],
])("maps %s to %s without guessing from content", (path, language) => {
  expect(fileLanguage(path)).toBe(language);
});
