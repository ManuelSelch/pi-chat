import type { ToolCard as ToolCardState } from "../shared/protocol.js";

const STATUS_LABEL: Record<ToolCardState["status"], string> = {
  running: "Running",
  success: "Done",
  error: "Failed",
};

/**
 * One tool call, collapsed by default so tools never dominate the transcript.
 * Native details/summary keeps it keyboard-operable without state. Arguments
 * and output render as plain text — never as markup — so tool output cannot
 * inject anything.
 */
export function ToolCard({ tool }: { tool: ToolCardState }) {
  return (
    <details className={`tool-card ${tool.status}`} data-testid="tool-card">
      <summary>
        <span className="tool-status" aria-hidden="true" />
        <span className="tool-name">{tool.name}</span>
        <span className="tool-state">{STATUS_LABEL[tool.status]}</span>
      </summary>
      {tool.argsText !== undefined || tool.outputText !== undefined ? (
        <div className="tool-body">
          {tool.argsText !== undefined ? (
            <section>
              <h4>Arguments</h4>
              <pre>{tool.argsText}</pre>
            </section>
          ) : null}
          {tool.outputText !== undefined ? (
            <section>
              <h4>{tool.status === "running" ? "Output so far" : "Result"}</h4>
              <pre>{tool.outputText}</pre>
            </section>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
