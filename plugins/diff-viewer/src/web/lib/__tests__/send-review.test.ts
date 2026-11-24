import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PiClient } from "@manuelselch/pi-sdk";
import { sendReview } from "../send-review.js";

let listener:Parameters<PiClient["onMessage"]>[0];
let accept:(value:{state:"accepted";operationId:string})=>void;
let reject:(error:Error)=>void;
let stop:ReturnType<typeof vi.fn>;
let client:PiClient;
beforeEach(()=>{
  vi.useFakeTimers();
  stop=vi.fn();
  client={
    getSession:()=>({messages:[]}),
    onMessage:(callback:typeof listener)=>{listener=callback;return stop;},
    prompt:vi.fn(()=>new Promise((resolve,fail)=>{accept=resolve;reject=fail;})),
  } as unknown as PiClient;
});
afterEach(()=>vi.useRealTimers());
function echo(sessionId="session") {
  listener({version:2,type:"event",serverInstanceId:"server",event:"message.finalized",sessionId,sequence:1,data:{runId:"run",message:{id:"message",role:"user",text:"review"}}});
}
it("waits for a user echo, not just transport acceptance",async()=>{
  const completed=vi.fn();
  const result=sendReview(client,"session","review").then(completed);
  accept({state:"accepted",operationId:"operation"});
  await Promise.resolve();
  expect(completed).not.toHaveBeenCalled();
  echo();
  await result;
  expect(completed).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledOnce();
});
it("handles an echo before acknowledgement and ignores another session",async()=>{
  const completed=vi.fn();
  const result=sendReview(client,"session","review").then(completed);
  echo("other");
  await Promise.resolve();
  expect(completed).not.toHaveBeenCalled();
  echo();
  await Promise.resolve();
  expect(completed).not.toHaveBeenCalled();
  accept({state:"accepted",operationId:"operation"});
  await result;
  expect(completed).toHaveBeenCalledOnce();
});
it("retains unconfirmed delivery and never retries after a timeout",async()=>{
  const result=sendReview(client,"session","review");
  const assertion=expect(result).rejects.toThrow("unconfirmed");
  accept({state:"accepted",operationId:"operation"});
  await vi.advanceTimersByTimeAsync(10_000);
  await assertion;
  expect(client.prompt).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledOnce();
});
it("reports operation failures even if they precede acceptance",async()=>{
  const result=sendReview(client,"session","review");
  listener({version:2,type:"event",serverInstanceId:"server",event:"operation.finished",sessionId:"session",sequence:1,data:{operationId:"operation",requestId:"request",outcome:"failed",error:{code:"operationFailed",message:"Session busy"}}});
  accept({state:"accepted",operationId:"operation"});
  await expect(result).rejects.toThrow("Session busy");
  expect(stop).toHaveBeenCalledOnce();
});
it("keeps comments on transport rejection",async()=>{
  const result=sendReview(client,"session","review");
  reject(new Error("disconnected"));
  await expect(result).rejects.toThrow("Comments retained");
  expect(stop).toHaveBeenCalledOnce();
});
