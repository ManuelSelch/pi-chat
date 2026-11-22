import { useState } from "react";
import { ActionIcon, Text, Textarea } from "@mantine/core";
import { IconArrowUp } from "@tabler/icons-react";

export function ChatWorkspace() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  function send() {
    if (!draft.trim()) return;
    setMessages(current => [...current, draft.trim()]);
    setDraft("");
  }
  return <main className="chat-workspace" aria-label="Chat">
    <div className="chat-transcript">
      <div className="user-message">Add a simple diff viewer as an isolated plugin.</div>
      <div className="assistant-message">
        <Text size="sm">I’ll add a read-only viewer for the active project’s local changes.</Text>
        <div className="tool-summary">Updated 2 files</div>
        <Text size="sm">The plugin owns the Git reads and diff UI. Pi Chat only registers it and provides the panel slot.</Text>
      </div>
      {messages.map((message,index)=><div className="user-message" key={index}>{message}</div>)}
    </div>
    <form className="composer" onSubmit={event=>{event.preventDefault();send();}}>
      <Textarea aria-label="Message" placeholder="Message Pi…" autosize minRows={2} maxRows={6} value={draft} onChange={event=>setDraft(event.currentTarget.value)} variant="unstyled"/>
      <div className="composer-toolbar"><Text size="xs" c="dimmed">Claude Sonnet</Text><ActionIcon type="submit" variant="light" color="gray" aria-label="Send mock message" disabled={!draft.trim()}><IconArrowUp size={17}/></ActionIcon></div>
    </form>
    <Text className="chat-footnote" size="xs" c="dimmed">Mockup only. Messages stay in this preview.</Text>
  </main>;
}
