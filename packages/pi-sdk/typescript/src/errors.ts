export type SDKErrorCode = "notConnected" | "disconnected" | "stopped" | "disposed" | "superseded" | "timeout" | "cancelled" | "limitExceeded" | "invalidMessage" | "invalidRequest" | "transportError" | "serverError" | "listenerError";
export type RequestOutcome = "notSent" | "unknown" | "rejected";

/** Local failures are distinct from server rejections; unknown never means retry. */
export class SDKError extends Error {
  constructor(readonly code: SDKErrorCode, message: string, readonly outcome: RequestOutcome = "notSent", readonly requestId?: string) {
    super(message);
    this.name = "SDKError";
  }
}
