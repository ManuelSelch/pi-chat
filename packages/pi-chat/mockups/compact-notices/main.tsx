import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Agentation } from 'agentation';
import { IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react';
import '@mantine/core/styles.css';
import './styles.css';

function Notice({ level, children }: { level: 'info' | 'warning' | 'error'; children: string }) {
  const Icon = level === 'info' ? IconInfoCircle : IconAlertTriangle;
  return <div className={`notice ${level}`}><Icon size={15}/><pre>{children}</pre></div>;
}
function Mockup() {
  return <><header>π <strong>Pi Chat</strong><span>Compact transcript preview</span></header><main><div className="user">Check the current session status.</div><div className="activity">› &nbsp; Used 2 tools</div><p>The session is ready. Here are its latest notices:</p><Notice level="info">Session compacted successfully.</Notice><Notice level="warning">Some context was omitted from the summary.</Notice><Notice level="error">Could not load the requested extension.</Notice><Notice level="info">{'Available branches:\n  main     current\n  feature  local'}</Notice><p>Notice text and line breaks remain visible without a large panel.</p><footer>Ask anything… <span>↑</span></footer></main></>;
}
createRoot(document.getElementById('root')!).render(<MantineProvider theme={createTheme({ fontFamily: 'system-ui, sans-serif' })}><Mockup />{import.meta.env.DEV && <Agentation />}</MantineProvider>);
