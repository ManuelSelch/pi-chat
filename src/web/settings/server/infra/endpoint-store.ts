import { defaultEndpoint, endpointError, type EndpointPage, type EndpointPreference } from "../domain/endpoint.js";

export const ENDPOINT_STORAGE_KEY = "pi-chat:serverEndpoint";
type EndpointStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type GetStorage = () => EndpointStorage;
const browserStorage: GetStorage = () => window.localStorage;

export function loadEndpoint(page: EndpointPage, getStorage: GetStorage = browserStorage): EndpointPreference {
  const fallback: EndpointPreference = { endpoint: defaultEndpoint(page), override: "", hasStoredOverride: false };
  try {
    const stored = getStorage().getItem(ENDPOINT_STORAGE_KEY);
    if (stored === null) return fallback;
    const value = stored.trim();
    if (!value || endpointError(value, page.protocol)) return {
      ...fallback, hasStoredOverride: true, warning: "The saved endpoint is invalid. Using this page’s server; reset or save a valid endpoint.",
    };
    return { endpoint: value, override: value, hasStoredOverride: true };
  } catch {
    return { ...fallback, warning: "Could not read the saved endpoint in this browser. Using this page’s server." };
  }
}

/** Undefined means success; callers must not reload after an error. */
export function saveEndpoint(input: string, protocol: string, getStorage: GetStorage = browserStorage): string | undefined {
  const invalid = endpointError(input, protocol);
  if (invalid) return invalid;
  try {
    const value = input.trim();
    const storage = getStorage();
    if (value) storage.setItem(ENDPOINT_STORAGE_KEY, value);
    else storage.removeItem(ENDPOINT_STORAGE_KEY);
  } catch {
    return "Could not save the endpoint in this browser. Your connection has not changed.";
  }
}
