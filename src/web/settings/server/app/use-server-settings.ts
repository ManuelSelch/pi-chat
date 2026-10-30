import { useRef, useState } from "react";
import type { ConfirmOptions } from "../../../ui/confirm/ConfirmDialog.js";
import { defaultEndpoint, endpointError, type EndpointPage, type EndpointPreference } from "../domain/endpoint.js";

interface ServerSettingsOptions {
  preference: EndpointPreference;
  page: EndpointPage;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  persist: (value: string) => string | undefined;
  reload: () => void;
}

export function useServerSettings({ preference, page, confirm, persist, reload }: ServerSettingsOptions) {
  const [draft, setDraft] = useState(preference.endpoint);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const applying = useRef(false);
  const validation = endpointError(draft, page.protocol);
  const canSave = !busy && !validation && (draft.trim() || defaultEndpoint(page)) !== preference.endpoint;
  const canReset = !busy && preference.hasStoredOverride;

  const apply = async (value: string) => {
    if (applying.current) return;
    applying.current = true;
    setBusy(true);
    try {
      const accepted = await confirm({
        title: value ? "Save endpoint and reload?" : "Reset endpoint and reload?",
        body: "Reloading discards unsent drafts in all tabs. Running sessions stay on the server; no commands are replayed.",
        confirmLabel: value ? "Save and reload" : "Reset and reload",
      });
      if (!accepted) return;
      const failure = persist(value);
      if (failure) { setError(failure); return; }
      reload();
    } finally {
      applying.current = false;
      setBusy(false);
    }
  };

  return {
    draft, error, busy, validation, canSave, canReset,
    edit: (value: string) => { setDraft(value); setError(undefined); },
    save: async () => { if (canSave) await apply(draft.trim()); },
    reset: async () => { if (canReset) await apply(""); },
  };
}
