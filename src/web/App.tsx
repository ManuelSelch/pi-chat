import { useState, type FormEvent, type KeyboardEvent } from "react";
import { usePiChat } from "./use-pi-chat.js";

export function App() {
  const { state, prompt, abort, takeControl } = usePiChat();
  const [input, setInput] = useState("");

  function submit(event?: FormEvent): void {
    event?.preventDefault();
    const message = input.trim();
    if (!message || state.status !== "idle") return;
    prompt(message);
    setInput("");
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <main className="shell">
      <header>
        <div>
          <strong>Pi Chat</strong>
          <span>{state.projectPath || "Connecting…"}</span>
        </div>
        <output data-status={state.status}>{state.status}</output>
      </header>

      <section className="messages" aria-live="polite">
        {state.messages.length === 0 && !state.draft ? (
          <div className="empty">
            <h1>What would you like to explore?</h1>
            <p>A minimal local chat powered by your Pi session.</p>
          </div>
        ) : null}
        {state.messages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <div className="role">{message.role === "assistant" ? "Pi" : "You"}</div>
            <div className="content">{message.text}</div>
          </article>
        ))}
        {state.draft ? (
          <article className="message assistant streaming">
            <div className="role">Pi</div>
            <div className="content">{state.draft.text}<span className="cursor" /></div>
          </article>
        ) : null}
      </section>

      <footer>
        {state.status === "superseded" ? (
          <div className="notice">
            Another browser tab is using this Pi session.{" "}
            <button className="link" onClick={takeControl} type="button">Take control here</button>
          </div>
        ) : state.status === "connecting" ? (
          <div className="notice">Connecting to the Pi Chat server… the runtime takes a few seconds to start.</div>
        ) : state.error ? (
          <div className="error">{state.error}</div>
        ) : null}
        <form onSubmit={submit}>
          <textarea
            aria-label="Message Pi"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={keyDown}
            placeholder="Ask Pi anything…"
            rows={2}
            value={input}
          />
          {state.status === "running" || state.status === "aborting" ? (
            <button className="stop" disabled={state.status === "aborting"} onClick={abort} type="button">Stop</button>
          ) : (
            <button disabled={!input.trim() || state.status !== "idle"} type="submit">Send</button>
          )}
        </form>
        <small>Enter to send · Shift+Enter for a new line</small>
      </footer>
    </main>
  );
}
