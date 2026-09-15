import { describe, expect, it } from "vitest";
import { connectionRequestFrom } from "../src/server/connection.js";

describe("connection request context", () => {
  it("extracts URL, query, headers, and remote address", () => {
    const request = connectionRequestFrom({
      url: "/?invite=abc&name=Manuel",
      headers: { host: "127.0.0.1:8788", cookie: "x=y" },
      socket: { remoteAddress: "127.0.0.1" },
    });

    expect(request).toEqual({
      url: "/?invite=abc&name=Manuel",
      query: { invite: "abc", name: "Manuel" },
      headers: { host: "127.0.0.1:8788", cookie: "x=y" },
      remoteAddress: "127.0.0.1",
    });
  });
});
