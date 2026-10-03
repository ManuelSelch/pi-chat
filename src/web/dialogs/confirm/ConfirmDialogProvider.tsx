import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ConfirmDialog, type ConfirmOptions } from "./ConfirmDialog.js";

interface ConfirmDialogContextValue {
  confirm(options: ConfirmOptions): Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | undefined>(undefined);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (confirmed: boolean) => void }>();

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setPending({ options, resolve });
  }), []);

  const resolve = useCallback((confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(undefined);
  }, [pending]);

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog options={pending?.options} onResolve={resolve} />
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog(): ConfirmDialogContextValue {
  const context = useContext(ConfirmDialogContext);
  if (!context) throw new Error("useConfirmDialog must be used inside ConfirmDialogProvider");
  return context;
}
