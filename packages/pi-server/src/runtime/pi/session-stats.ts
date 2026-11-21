/** The parts of Pi's `SessionStats` this host reports, kept structural for tests. */
export interface SessionStatsView {
  sessionId: string;
  sessionFile?: string | undefined;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  cost: number;
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
}

/**
 * The terminal prints this with box drawing and colour; the web transcript
 * renders markdown, so the same numbers are laid out as a definition list.
 * Context usage is absent until the model reports it (right after compaction,
 * for instance), and the line is dropped rather than shown as unknown.
 */
export function sessionStatsMarkdown(stats: SessionStatsView, sessionName?: string, model?: string): string {
  const count = (value: number) => value.toLocaleString("en-US");
  const { input, output, cacheRead, cacheWrite, total } = stats.tokens;
  const prompt = input + cacheRead + cacheWrite;
  const lines = [
    "**Session**",
    ...(sessionName ? [`- Name: ${sessionName}`] : []),
    ...(model ? [`- Model: ${model}`] : []),
    `- File: ${stats.sessionFile ?? "in memory"}`,
    `- ID: ${stats.sessionId}`,
    "",
    "**Messages**",
    `- Total: ${count(stats.totalMessages)} (${count(stats.userMessages)} user, ${count(stats.assistantMessages)} assistant)`,
    `- Tools: ${count(stats.toolCalls)} calls, ${count(stats.toolResults)} results`,
    "",
    "**Tokens**",
    `- Input: ${count(prompt)}`,
    // Only meaningful once the provider actually reports cache activity.
    ...(prompt > 0 && (cacheRead > 0 || cacheWrite > 0)
      ? [
          `  - Cached: ${count(cacheRead)} (${((cacheRead / prompt) * 100).toFixed(1)}%)`,
          `  - Uncached: ${count(input + cacheWrite)}`,
        ]
      : []),
    `- Output: ${count(output)}`,
    `- Total: ${count(total)}`,
  ];
  const usage = stats.contextUsage;
  if (usage && usage.tokens !== null) {
    const percent = usage.percent ?? (usage.contextWindow > 0 ? (usage.tokens / usage.contextWindow) * 100 : 0);
    lines.push("", "**Context**", `- Used: ${count(usage.tokens)} of ${count(usage.contextWindow)} (${percent.toFixed(1)}%)`);
  }
  if (stats.cost > 0) lines.push("", "**Cost**", `- Total: $${stats.cost.toFixed(3)}`);
  return lines.join("\n");
}
