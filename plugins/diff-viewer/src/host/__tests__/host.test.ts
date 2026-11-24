import { expect, it, vi } from "vitest";
import { createDiffViewerHost } from "../index.js";
import { GitService } from "../git-service.js";
import { GitError } from "../git-command.js";
import { diffViewerContract } from "../../contract.js";
import type { RemoteContractImplementation } from "@manuelselch/pi-sdk/plugins";

async function handlers(service:GitService) {
  const provide = vi.fn();
  await createDiffViewerHost(service).setup({provide,onCleanup:vi.fn(),signal:new AbortController().signal});
  expect(provide.mock.calls[0]?.[0]).toBe(diffViewerContract);
  return provide.mock.calls[0]?.[1] as RemoteContractImplementation<typeof diffViewerContract>;
}
it("exposes safe Git failures as actionable results",async()=>{
  const service = new GitService();
  vi.spyOn(service,"context").mockRejectedValue(new GitError("notRepository","Not a repository."));
  const methods = await handlers(service);

  expect(await methods.context({projectPath:"/repo"})).toEqual({ok:false,error:{code:"notRepository",message:"Not a repository."}});
});
it("sanitizes filesystem and unexpected process errors",async()=>{
  const service = new GitService();
  vi.spyOn(service,"diff").mockRejectedValue(new Error("secret process details"));
  const methods = await handlers(service);

  expect(await methods.diff({projectPath:"/repo",comparison:{kind:"uncommitted"}})).toEqual({ok:false,error:{code:"operationFailed",message:"Unable to read this comparison. Refresh and try again."}});
});
it("returns commit choices without changing their opaque identities",async()=>{
  const service = new GitService();
  const page = {commits:[{sha:"a".repeat(40),subject:"Fix things",author:"Test",date:"2026-01-01"}]};
  vi.spyOn(service,"commits").mockResolvedValue(page);
  const methods = await handlers(service);

  expect(await methods.commits({projectPath:"/repo"})).toEqual({ok:true,value:page});
});
