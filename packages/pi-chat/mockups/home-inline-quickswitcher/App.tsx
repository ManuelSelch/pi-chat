import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { IconChevronRight, IconFolder, IconLayoutSidebar, IconMessage, IconPlus, IconSearch } from '@tabler/icons-react';

const items = [
  { title: 'Inline quickswitcher', context: 'pi-chat / feat-home-inline-quickswitcher', kind: '@' },
  { title: 'Improve session inbox', context: 'pi-chat / session-inbox', kind: '@' },
  { title: 'pi-chat', context: '~/projects/pi-chat', kind: '#' },
  { title: 'pi-server', context: '~/projects/pi-server', kind: '#' },
  { title: 'Open settings', context: 'Action', kind: '/' },
  { title: 'feat-home-inline-quickswitcher', context: 'pi-chat worktree', kind: '%' },
];
const scopes = [{ prefix: '#', label: '# Folders' }, { prefix: '%', label: '% Worktrees' }, { prefix: '@', label: '@ Sessions' }, { prefix: '/', label: '/ Actions' }];

export function App() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(0);
  const [opened, setOpened] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const prefix = scopes.find(scope => query.startsWith(scope.prefix))?.prefix;
  const term = (prefix ? query.slice(1) : query).trim().toLowerCase();
  const results = items.filter(item => (!prefix || item.kind === prefix) && `${item.title} ${item.context}`.toLowerCase().includes(term));
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') { event.preventDefault(); setExpanded(true); setQuery(''); setActive(0); input.current?.focus(); }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  function choose(title: string) { setOpened(title); setExpanded(false); }
  return <div className="mock-shell">
    <header><ActionIcon variant="subtle" color="gray" aria-label="Toggle sidebar"><IconLayoutSidebar size={18}/></ActionIcon><Text size="xs" c="dimmed">Workspace</Text><IconChevronRight size={12}/><Text size="xs">Home</Text><div className="header-actions"><span className="mock-label">MOCKUP</span><ActionIcon variant="subtle" color="gray" aria-label="New session"><IconPlus size={19}/></ActionIcon></div></header>
    <aside><Text size="10px" c="dimmed" tt="uppercase" lts="0.1em" px={10} mt={24} mb={12}>Projects</Text>{['pi-chat', 'pi-server'].map(project => <div className="project" key={project}><div className="project-heading"><IconChevronRight size={12}/><IconFolder size={15}/><strong>{project}</strong></div></div>)}</aside>
    <main><div className="home-page"><section className="welcome"><Title order={1} size={32} fw={550}>Lets cook</Title>
      <div className={`switcher ${expanded ? 'is-expanded' : ''}`}>
        <TextInput ref={input} size="md" leftSection={<IconSearch size={16}/>} aria-label="Search folders, worktrees, sessions and actions" placeholder="Search" value={query} onFocus={() => setExpanded(true)} onChange={event => { setQuery(event.currentTarget.value); setExpanded(true); setActive(0); }} onKeyDown={event => {
          if (event.key === 'Escape') { setExpanded(false); input.current?.blur(); }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(value => (value + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(results.length, 1)); }
          if (event.key === 'Enter' && results[active]) choose(results[active].title);
          if (event.key === 'Tab') { event.preventDefault(); const index = scopes.findIndex(scope => scope.prefix === prefix); const next = scopes[(index + (event.shiftKey ? 3 : 1)) % scopes.length]; setQuery(next.prefix + (prefix ? query.slice(1) : query)); setActive(0); }
        }}/>
        {expanded && <div className="switcher-content"><div className="scopes">{scopes.map(scope => <UnstyledButton key={scope.prefix} className={`scope ${prefix === scope.prefix ? 'selected' : ''}`} onClick={() => { setQuery(scope.prefix); setActive(0); input.current?.focus(); }}>{scope.label}</UnstyledButton>)}</div><div role="listbox" aria-label="Search results" className="results">{results.length ? results.map((item, index) => <UnstyledButton key={item.title} role="option" aria-selected={index === active} className={`result ${index === active ? 'selected' : ''}`} onMouseEnter={() => setActive(index)} onClick={() => choose(item.title)}>{item.kind === '@' ? <IconMessage size={16}/> : <IconFolder size={16}/>}<span><strong>{item.title}</strong><small>{item.context}</small></span></UnstyledButton>) : <Text size="sm" c="dimmed" p="sm">Nothing matches “{query}”.</Text>}</div></div>}
      </div></section>
      {opened && <Text className="notice" size="sm">Opening “{opened}” is simulated in this mockup.</Text>}
      <div className="activity"><section className="activity-section"><Title order={2} size="xs" mb={10}>Ready</Title><div className="cards">{['Inline quickswitcher', 'Improve session inbox'].map(title => <div className="activity-row" key={title}><span className="status ready"/><strong>{title}</strong><Text size="xs" c="dimmed">pi-chat</Text></div>)}</div></section></div>
    </div></main>
  </div>;
}
