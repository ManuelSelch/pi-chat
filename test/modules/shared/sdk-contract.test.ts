import { describe, expect, it } from "vitest";
import * as sdk from "@manuelselch/pi-sdk";
import * as contract from "@manuelselch/pi-sdk/contract";
import * as legacy from "../../../src/shared/protocol.js";
import * as directories from "../../../src/shared/directories.js";
import * as files from "../../../src/shared/files.js";

describe("SDK contract migration boundary", () => {
  it("exports the unchanged v1 contract through public SDK entry points", () => {
    expect(sdk.PROTOCOL_VERSION).toBe(1);
    expect(sdk.CONTROLLER_REPLACED_CODE).toBe(4001);
    expect(sdk.clientMessageSchema).toBe(contract.clientMessageSchema);
    expect(legacy.clientMessageSchema).toBe(contract.clientMessageSchema);
    expect(legacy.serverMessageSchema).toBe(contract.serverMessageSchema);
    expect(directories.directoryBrowseSchema).toBe(contract.directoryBrowseSchema);
    expect(files.fileOpenResultSchema).toBe(contract.fileOpenResultSchema);
  });

  it("preserves defaults, trimming, unknown fields and path validation", () => {
    expect(sdk.parseClientMessage({ version: 1, type: "prompt", sessionId: "runtime", message: " hello ", future: true }))
      .toEqual({ version: 1, type: "prompt", sessionId: "runtime", message: "hello" });
    expect(sdk.footerItemSchema.parse({ key: "mode", text: "ready" })).toEqual({ key: "mode", text: "ready", align: "left", variant: "plain" });
    expect(sdk.piChatExtensionsSchema.parse({})).toEqual({ buttons: [], badges: [], state: {} });
    expect(sdk.filePathSchema.safeParse("https://example.com").success).toBe(false);
    expect(sdk.directoryBrowseSchema.safeParse({ path: "/tmp\0bad" }).success).toBe(false);
    expect(files.localPathFromHref("file:///tmp/a%20b.txt")).toBe("/tmp/a b.txt");
  });
});
