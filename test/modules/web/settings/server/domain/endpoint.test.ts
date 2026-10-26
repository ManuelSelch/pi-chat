import { describe, expect, it } from "vitest";
import { defaultEndpoint, endpointError, redactEndpoint, isOtherHost } from "../../../../../../src/web/settings/server/domain/endpoint.js";

describe("server endpoint rules", () => {
  it("preserves the page host, port and query in the default", () => {
    expect(defaultEndpoint({ protocol: "http:", host: "localhost:5173", search: "?profile=work" })).toBe("ws://localhost:5173/ws?profile=work");
    expect(defaultEndpoint({ protocol: "https:", host: "pi.example", search: "" })).toBe("wss://pi.example/ws");
  });
  it.each(["", "  ", "ws://localhost:8788/ws", "wss://pi.example/path?profile=work", "wss://[::1]:8788/ws"])("accepts %j on HTTP", input => {
    expect(endpointError(input, "http:")).toBeUndefined();
  });
  it.each(["not a URL", "/ws", "http://pi.example/ws", "ws:pi.example", "wss://", "wss://user:pass@pi.example/ws", "wss://pi.example/ws#fragment", "wss://pi.example/ws#", "wss://pi.exa\nmple/ws"])("rejects %j without echoing input", input => {
    const error = endpointError(input, "http:");
    expect(error).toBeTruthy();
    expect(error).not.toContain(input);
  });
  it("rejects mixed content on HTTPS", () => {
    expect(endpointError("ws://localhost/ws", "https:")).toContain("wss://");
    expect(endpointError("wss://pi.example/ws", "https:")).toBeUndefined();
  });
  it("redacts the whole query and detects another host/port", () => {
    expect(redactEndpoint("wss://pi.example/ws?token=secret")).toBe("wss://pi.example/ws?…");
    expect(redactEndpoint("ws://localhost/ws")).toBe("ws://localhost/ws");
    expect(isOtherHost("wss://pi.example:8788/ws", "pi.example")).toBe(true);
    expect(isOtherHost("wss://pi.example/ws", "pi.example")).toBe(false);
    expect(isOtherHost("invalid", "pi.example")).toBe(false);
  });
});
