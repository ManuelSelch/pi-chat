export type Status = 'attention' | 'working' | 'ready';
export interface Session {
  id: string; title: string; project: string; branch: string; status: Status;
  detail: string; time: string; later?: boolean; archived?: boolean;
}
export const initialSessions: Session[] = [
  { id: 'inbox', title: 'Session inbox navigation', project: 'pi-chat', branch: 'main', status: 'attention', detail: 'Design ready for your review', time: 'now' },
  { id: 'pdf', title: 'PDF thumbnail rendering', project: 'notesToGo', branch: 'feat/pdf-previews', status: 'attention', detail: 'Which fallback should I use?', time: '3m' },
  { id: 'tests', title: 'Integration test coverage', project: 'pi-chat', branch: 'test/session-flows', status: 'working', detail: 'Running the integration suite', time: '6m' },
  { id: 'studio', title: 'Workspace navigation', project: 'pi-studio', branch: 'feat/workspace', status: 'working', detail: 'Implementing the project switcher', time: '12m' },
  { id: 'focus', title: 'Composer focus restoration', project: 'pi-chat', branch: 'fix/composer-focus', status: 'ready', detail: 'Ready to continue', time: '24m' },
  { id: 'quick', title: 'A quick question about Swift', project: 'Quick Chats', branch: '', status: 'ready', detail: 'Ready to continue', time: '1h' },
  { id: 'later-theme', title: 'Theme contrast cleanup', project: 'pi-chat', branch: 'chore/theme', status: 'ready', detail: 'Ready to continue', time: '1d', later: true },
  { id: 'later-notes', title: 'Review PDF page layout', project: 'notesToGo', branch: 'feat/pdf-layout', status: 'ready', detail: 'Ready to continue', time: '2d', later: true },
];
export const concepts = {
  a: { label: 'A · Open sessions', title: 'Your tabs, turned vertical.', description: 'One flat list of open sessions. Project and branch provide context; status tells you what is happening. The smallest change.' },
  b: { label: 'B · Inbox', title: 'A queue you can work through.', description: 'Needs you rises to the top. Running agents live in Working; idle conversations stay in Ready. Move sessions to Later when you want to come back to them.' },
  c: { label: 'C · Project inbox', title: 'Attention first. Projects close by.', description: 'A compact Needs you shelf, followed by open sessions grouped by project. Familiar project navigation with a cross-project attention queue.' },
};
export type Concept = keyof typeof concepts;
export const statusLabels: Record<Status, string> = { attention: 'Needs you', working: 'Working', ready: 'Ready' };
