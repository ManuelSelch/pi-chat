import { createAgentSessionServices, getAgentDir } from "@earendil-works/pi-coding-agent";

const services = await createAgentSessionServices({ cwd: process.cwd(), agentDir: getAgentDir() });
const available = await services.modelRuntime.getAvailable();
const byProvider = new Map<string, string[]>();
for (const model of available) {
  byProvider.set(model.provider, [...(byProvider.get(model.provider) ?? []), model.id]);
}
for (const [provider, ids] of byProvider) {
  console.log(`${provider}: ${ids.slice(0, 6).join(", ")}${ids.length > 6 ? ` … (+${ids.length - 6})` : ""}`);
}
console.log("total:", available.length);
