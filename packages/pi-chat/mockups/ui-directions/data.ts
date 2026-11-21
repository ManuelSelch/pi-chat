export type Status = 'blocked' | 'ready' | 'working' | 'later';
export interface Session { id: number; title: string; project: string; branch: string; status: Status; summary: string; time: string; changes?: string; }
export const labels: Record<Status, string> = { blocked: 'Blocked', ready: 'Ready', working: 'Working', later: 'Later' };
export const sessions: Session[] = [
  { id: 1, title: 'Add keyboard navigation to the model picker', project: 'pi-chat', branch: 'feat/model-picker', status: 'blocked', summary: 'Should Escape close the picker or clear the search first?', time: 'Just now' },
  { id: 2, title: 'Simplify the session sidebar', project: 'pi-chat', branch: 'feat/session-sidebar', status: 'ready', summary: 'Grouped sessions by status. Ready for your review.', time: '2m ago', changes: '+148 −62' },
  { id: 3, title: 'Fix reconnect after waking from sleep', project: 'pi-server', branch: 'fix/reconnect', status: 'ready', summary: 'Reconnect now retries with backoff. All 24 tests pass.', time: '8m ago', changes: '+42 −18' },
  { id: 4, title: 'Improve tool call rendering', project: 'pi-chat', branch: 'feat/tool-density', status: 'working', summary: 'Refining collapsed tool groups and running component tests…', time: 'Running 4m' },
  { id: 5, title: 'Document the extension API', project: 'pi-server', branch: 'docs/extensions', status: 'working', summary: 'Reading extension entry points and drafting examples…', time: 'Running 7m' },
  { id: 6, title: 'Explore a compact diff viewer', project: 'pi-chat', branch: 'explore/diffs', status: 'later', summary: 'Parked for a quieter afternoon.', time: 'Yesterday' },
];
export const directions = {
  studio: { label: '01 Studio', title: 'A quieter control room.', note: 'Cool neutrals, precise rows and a restrained blue accent. Inspired by Codex’s multi-agent workspace.' },
  paper: { label: '02 Warm paper', title: 'Less dashboard. More breathing room.', note: 'Warm ivory, clay accents and editorial headings. A Claude-inspired space for thinking and reviewing.' },
  night: { label: '03 Night shift', title: 'All your agents. One clear signal.', note: 'Graphite surfaces, violet accents and tighter density. A T3 Code-inspired developer workspace.' },
};
export type Direction = keyof typeof directions;
export type Home = 'inbox' | 'cook' | 'current';
