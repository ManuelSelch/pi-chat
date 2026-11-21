const SECRET_ASSIGNMENT = /\b(api[_-]?key|token|authorization|password|secret)\b\s*[:=]\s*[^\s,;]+/gi;
const BEARER_TOKEN = /\bBearer\s+[^\s,;]+/gi;
const URL = /https?:\/\/[^\s"'<>]+/gi;
const HOME_PATH = /(?:\/Users\/|\/home\/)[^\s"'<>]+/g;
const CONTROL = /[\r\n\t\0-\x1f\x7f]+/g;

/** Keep useful short failure text while removing common credentials, URLs, and local paths. */
export function redactRuntimeError(value: string): string {
  return value
    .replace(CONTROL, " ")
    .replace(BEARER_TOKEN, "Bearer [REDACTED]")
    .replace(SECRET_ASSIGNMENT, "$1=[REDACTED]")
    .replace(URL, "[URL]")
    .replace(HOME_PATH, "[PATH]")
    .trim()
    .slice(0, 400);
}
