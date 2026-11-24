import { useState } from "react";
import { ActionIcon, Text, Textarea } from "@mantine/core";
import { IconArrowUp } from "@tabler/icons-react";

export function ChatWorkspace({batches}:{batches:string[]}) {
  const [draft,setDraft] = useState("");
  const [messages,setMessages] = useState<string[]>([]);
  return <main className="chat-workspace" aria-label="Chat">
    <div className="chat-transcript">
      <div className="user-message">Keep code review inside Pi Chat, with comments I can send together.</div>
      <div className="assistant-message"><Text size="sm">The updated review formatter includes the file, side and original code. You can review the changes alongside this conversation.</Text><div className="tool-summary">Updated 3 files</div></div>
      {[...messages,...batches].map((message,index)=><div className="user-message" key={index}>{message}</div>)}
    </div>
    <form className="composer" onSubmit={event=>{event.preventDefault();if(!draft.trim()) return;setMessages(current=>[...current,draft.trim()]);setDraft("");}}>
      <Textarea aria-label="Message" placeholder="Message Pi…" variant="unstyled" autosize minRows={2} value={draft} onChange={event=>setDraft(event.currentTarget.value)}/>
      <div className="composer-toolbar"><Text size="xs" c="dimmed">Claude Sonnet</Text><ActionIcon type="submit" variant="light" color="gray" aria-label="Send mock message" disabled={!draft.trim()}><IconArrowUp size={17}/></ActionIcon></div>
    </form>
    <Text className="chat-footnote" c="dimmed">Preview only. Nothing is sent to an agent.</Text>
  </main>;
}
