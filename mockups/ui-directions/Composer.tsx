import { useState } from 'react';
import { TextInput } from '@mantine/core';
export function Composer({ onSend, compact = false }: { onSend: (text: string) => void; compact?: boolean }) {
  const [text, setText] = useState('');
  function send() { if (!text.trim()) return; onSend(text.trim()); setText(''); }
  return <div className={`composer ${compact ? 'compact' : ''}`}>
    <TextInput size="md" aria-label="Message your agent" placeholder={compact ? 'Reply or give the agent a new direction…' : 'What are we building today?'} value={text} onChange={e => setText(e.currentTarget.value)} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(); }}/>
  </div>;
}
