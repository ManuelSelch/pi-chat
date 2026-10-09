import type { SessionNameSource } from "../../shared/protocol.js";

export interface ChatSessionSummary {
  path: string;
  id: string;
  title: string;
  name?: string;
  nameSource: SessionNameSource;
  firstMessage?: string;
  modified: number;
  created: number;
  messageCount: number;
  archivedAt?: number;
}

export interface ChatWorktreeSummary {
  branch?: string;
  commit?: string;
  detached: boolean;
  primary: boolean;
}

export interface ChatProjectSummary {
  path: string;
  displayPath: string;
  name: string;
  exists: boolean;
  modified: number;
  sessionCount: number;
  pinned?: boolean;
  quickChats?: boolean;
  sessions: ChatSessionSummary[];
  repositoryPath?: string;
  repositoryName?: string;
  worktree?: ChatWorktreeSummary;
}

export interface ProjectCatalogue {
  projects: ChatProjectSummary[];
}

export interface ActiveSessionSummary {
  path?: string;
  id: string;
  name?: string;
  nameSource?: SessionNameSource;
  cwd: string;
  messageCount: number;
  firstMessage?: string;
}

export interface PersistedSessionRecord {
  path: string;
  id: string;
  cwd?: string;
  firstMessage?: string;
  modified: Date;
  created: Date;
  messageCount: number;
}

export interface ProjectSessionLister {
  listAll(sessionDir?: string): Promise<PersistedSessionRecord[]>;
}

export interface SessionNameInfo {
  name?: string;
  source: SessionNameSource;
}
