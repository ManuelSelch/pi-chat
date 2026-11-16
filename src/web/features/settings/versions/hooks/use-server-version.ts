import { useEffect, useState } from "react";

export function useServerVersion(endpoint: string, connected: boolean, opened: boolean): string | null {
  const [version, setVersion] = useState<{ endpoint: string; value: string } | null>(null);
  useEffect(() => {
    setVersion(null);
    if (!connected || !opened) return;
    const abort = new AbortController();
    let active = true;
    const timeout = setTimeout(() => abort.abort(), 5000);
    void (async () => {
      try {
        const url = new URL(endpoint);
        url.protocol = url.protocol === "wss:" ? "https:" : "http:";
        url.pathname = "/api/pi-chat/version";
        const response = await fetch(url, { signal: abort.signal, cache: "no-store" });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (active && data && typeof data === "object" && "server" in data && typeof data.server === "string" && data.server.length > 0 && data.server.length <= 128)
          setVersion({ endpoint, value: data.server });
      } catch { /* Unavailable metadata must not interfere with settings or transport. */ }
      finally { clearTimeout(timeout); }
    })();
    return () => { active = false; abort.abort(); clearTimeout(timeout); };
  }, [endpoint, connected, opened]);
  return connected && version?.endpoint === endpoint ? version.value : null;
}
