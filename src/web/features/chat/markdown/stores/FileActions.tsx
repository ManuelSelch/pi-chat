import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Stack } from "@mantine/core";

type OpenFile = (sessionId: string, path: string) => Promise<void>;
type FileAction = (sessionId: string, path: string) => void;
const FileActionContext = createContext<FileAction | undefined>(undefined);
interface FileNotice { key: string; sessionId: string; path: string; message: string; expiresAt: number }

/** Narrow, stable action boundary. Feedback is ephemeral and never a chat error. */
export function FileActionsProvider({ openFile, children }: { openFile: OpenFile; children: ReactNode }) {
  const [notices, setNotices] = useState<FileNotice[]>([]);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!notices.length) return;
    const timer = setTimeout(() => setNotices((current) => current.filter((notice) => notice.expiresAt > Date.now())), Math.max(0, Math.min(...notices.map((notice) => notice.expiresAt)) - Date.now()));
    return () => clearTimeout(timer);
  }, [notices]);
  const activate = useCallback((sessionId: string, path: string) => {
    void openFile(sessionId, path).catch((error: unknown) => {
      if (!mounted.current || (error instanceof Error && error.name === "AbortError")) return;
      const key = JSON.stringify([sessionId, path]);
      const message = error instanceof Error ? error.message : "Unable to open this file on the server.";
      setNotices((current) => [...current.filter((notice) => notice.key !== key), { key, sessionId, path, message: message.slice(0, 512), expiresAt: Date.now() + 8000 }].slice(-3));
    });
  }, [openFile]);
  return <FileActionContext.Provider value={activate}>
    {children}
    <Stack pos="fixed" top={104} right={16} maw="min(480px, calc(100vw - 32px))" style={{ zIndex: 400 }}>
      {notices.map((notice) => <Alert key={notice.key} color="red" title={`File: ${notice.path}`} withCloseButton closeButtonLabel="Dismiss file error" onClose={() => setNotices((current) => current.filter((item) => item.key !== notice.key))}>
        Session: {notice.sessionId}. {notice.message}
      </Alert>)}
    </Stack>
  </FileActionContext.Provider>;
}

export function useFileAction(): FileAction {
  const action = useContext(FileActionContext);
  if (!action) throw new Error("useFileAction must be used inside FileActionsProvider");
  return action;
}
