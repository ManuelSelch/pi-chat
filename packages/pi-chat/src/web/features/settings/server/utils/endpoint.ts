export interface EndpointPage {
  protocol: string;
  host: string;
  search: string;
}

export interface EndpointPreference {
  endpoint: string;
  override: string;
  hasStoredOverride: boolean;
  warning?: string;
}

export function defaultEndpoint(page: EndpointPage): string {
  return `${page.protocol === "https:" ? "wss" : "ws"}://${page.host}/ws${page.search}`;
}

/** Empty input selects the page-derived default. Error messages never echo URLs. */
export function endpointError(input: string, pageProtocol: string): string | undefined {
  const value = input.trim();
  if (!value) return;
  if (!/^wss?:\/\//i.test(value) || /[\u0000-\u0020\u007f]/.test(value)) return "Enter a full ws:// or wss:// URL.";
  try {
    const url = new URL(value);
    if (!["ws:", "wss:"].includes(url.protocol) || !url.hostname) return "Enter a valid WebSocket URL.";
    if (url.username || url.password || value.includes("#")) return "Credentials and fragments are not supported.";
    if (pageProtocol === "https:" && url.protocol === "ws:") return "This HTTPS page requires a secure wss:// endpoint.";
  } catch { return "Enter a valid WebSocket URL."; }
}

export function redactEndpoint(endpoint: string): string {
  return endpoint.replace(/\?.*$/, "?…");
}

export function isOtherHost(endpoint: string, pageHost: string): boolean {
  try { return new URL(endpoint).host.toLowerCase() !== pageHost.toLowerCase(); }
  catch { return false; }
}
