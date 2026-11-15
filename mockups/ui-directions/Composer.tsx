import { useState } from 'react';
import { Button, Select, Textarea } from '@mantine/core';
import { IconArrowUp, IconGitBranch } from '@tabler/icons-react';
export function Composer({ onSend, compact = false }: { onSend: (text: string) => void; compact?: boolean }) {
  const [text, setText] = useState('');
  function send() { if (!text.trim()) return; onSend(text.trim()); setText(''); }
  return <div className={`composer ${compact ? 'compact' : ''}`}>
    <Textarea aria-label="Message your agent" placeholder={compact ? 'Reply or give the agent a new direction…' : 'What are we building today?'} value={text} onChange={e => setText(e.currentTarget.value)} autosize minRows={compact ? 2 : 3} maxRows={8} variant="unstyled" onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(); }}/>
    <div className="composer-tools"><Select aria-label="Project" defaultValue="pi-chat" data={['pi-chat', 'pi-server', 'Quick chat']} w={125} variant="unstyled"/><span className="composer-branch"><IconGitBranch size={13}/> main</span><Select aria-label="Model" defaultValue="Claude Sonnet" data={['Claude Sonnet', 'GPT Codex', 'Gemini Pro']} w={145} variant="unstyled"/><Button className="send" aria-label="Send message" disabled={!text.trim()} onClick={send}><IconArrowUp size={18}/></Button></div>
  </div>;
}
