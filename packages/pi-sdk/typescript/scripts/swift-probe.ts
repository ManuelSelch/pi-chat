import { readFile } from "node:fs/promises";
import { InputData, JSONSchemaInput, quicktype } from "quicktype-core";

export async function generateSwiftProbe(): Promise<string> {
  const input = new JSONSchemaInput(undefined);
  for (const name of ["ChatMessage", "ThinkingLevel", "ExtensionContributions", "FooterItem", "PromptResult"]) {
    const schema = await readFile(new URL(`../../protocol/schema/v2/${name}.schema.json`, import.meta.url), "utf8");
    await input.addSource({ name, schema });
  }
  const inputData = new InputData();
  inputData.addInput(input);
  const result = await quicktype({
    inputData,
    lang: "swift",
    rendererOptions: { "initializers": "false", "coding-keys": "true", "access-level": "internal", "final-classes": "true" },
  });
  const generated = result.lines.join("\n").trimEnd();
  return `// Generated feasibility probe with quicktype-core 26.0.0. Do not edit.\n// NOT public PiSDK API and NOT sufficient wire validation.\n${generated}\n`;
}
