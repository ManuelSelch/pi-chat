import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HighlightWorkerClient, type HighlightReply } from "../highlight-worker-client.js";
import { parsePatch } from "../../../domain/parse-patch.js";

class FakeWorker {
  onmessage:((event:MessageEvent<HighlightReply>)=>void)|null = null;
  onerror:(()=>void)|null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  reply(id:number) {
    const data:HighlightReply = {id,tokens:[[{text:"done",classes:[]}]]};
    this.onmessage?.(new MessageEvent("message",{data}));
  }
}
const lines = parsePatch("@@ -0,0 +1 @@\n+const value = 1;\n");
let workers:FakeWorker[];
let client:HighlightWorkerClient;
let create:ReturnType<typeof vi.fn<()=>Worker>>;
beforeEach(()=>{
  workers = [];
  create = vi.fn(()=>{const worker=new FakeWorker();workers.push(worker);return worker as unknown as Worker;});
  client = new HighlightWorkerClient(create);
});
afterEach(()=>{client.dispose();vi.useRealTimers();});

it("creates no worker until requested, and serializes jobs in one worker",()=>{
  const first = vi.fn();
  const second = vi.fn();
  expect(create).not.toHaveBeenCalled();

  client.request("first.ts",lines,first);
  client.request("second.ts",lines,second);

  expect(create).toHaveBeenCalledOnce();
  expect(workers[0]!.postMessage).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();

  workers[0]!.reply(1);

  expect(first).toHaveBeenCalledWith([[{text:"done",classes:[]}]]);
  expect(second).not.toHaveBeenCalled();
  expect(workers[0]!.postMessage).toHaveBeenCalledTimes(2);

  workers[0]!.reply(2);

  expect(second).toHaveBeenCalledOnce();
});

it("drops cancelled queued jobs without interrupting the active one",()=>{
  const done = vi.fn();
  client.request("first.ts",lines,vi.fn());
  const cancel = client.request("second.ts",lines,done);

  cancel();
  workers[0]!.reply(1);

  expect(workers[0]!.terminate).not.toHaveBeenCalled();
  expect(workers[0]!.postMessage).toHaveBeenCalledTimes(1);
  expect(done).not.toHaveBeenCalled();
});

it("terminates cancelled active work and ignores stale replies",()=>{
  const first = vi.fn();
  const second = vi.fn();
  const cancel = client.request("first.ts",lines,first);
  client.request("second.ts",lines,second);

  cancel();
  workers[0]!.reply(1);

  expect(workers[0]!.terminate).toHaveBeenCalledOnce();
  expect(workers).toHaveLength(2);
  expect(first).not.toHaveBeenCalled();
  expect(second).not.toHaveBeenCalled();

  workers[1]!.reply(2);

  expect(second).toHaveBeenCalledOnce();
});

it("ignores replies for unrelated request identities",()=>{
  const done = vi.fn();
  client.request("test.ts",lines,done);
  workers[0]!.reply(99);

  expect(done).not.toHaveBeenCalled();

  workers[0]!.reply(1);

  expect(done).toHaveBeenCalledOnce();
});

it("falls back to plain text and continues queued work after a worker error",()=>{
  const first = vi.fn();
  const second = vi.fn();
  client.request("first.ts",lines,first);
  client.request("second.ts",lines,second);

  workers[0]!.onerror?.();

  expect(first).toHaveBeenCalledWith([]);
  expect(workers[0]!.terminate).toHaveBeenCalledOnce();
  expect(workers).toHaveLength(2);

  workers[1]!.reply(2);

  expect(second).toHaveBeenCalledOnce();
});

it("times out pathological grammars without blocking subsequent files",()=>{
  vi.useFakeTimers();
  const first = vi.fn();
  client.request("slow.ts",lines,first);
  client.request("next.ts",lines,vi.fn());

  vi.advanceTimersByTime(2000);

  expect(first).toHaveBeenCalledWith([]);
  expect(workers[0]!.terminate).toHaveBeenCalledOnce();
  expect(workers).toHaveLength(2);
});

it("keeps plain text when worker creation fails",()=>{
  const done = vi.fn();
  const unavailable = new HighlightWorkerClient(()=>{throw new Error("Worker unavailable");});

  unavailable.request("test.ts",lines,done);

  expect(done).toHaveBeenCalledWith([]);
  unavailable.dispose();
});

it.each([2001,128_001])("does not tokenize oversized input (%s)",size=>{
  const input = size===2001 ? Array.from({length:size},()=>lines[1]!) : [{...lines[1]!,text:"x".repeat(size)}];
  const done = vi.fn();

  const cancel = client.request("generated.ts",input,done);
  cancel();

  expect(create).not.toHaveBeenCalled();
  expect(done).toHaveBeenCalledWith([]);
});

it("disposes active and queued work, and supports a StrictMode effect restart",()=>{
  const done = vi.fn();
  client.request("first.ts",lines,done);
  client.request("second.ts",lines,done);

  client.dispose();
  workers[0]!.reply(1);

  expect(workers[0]!.terminate).toHaveBeenCalledOnce();
  expect(done).not.toHaveBeenCalled();

  client.request("third.ts",lines,done);
  workers[1]!.reply(3);

  expect(done).toHaveBeenCalledOnce();
});
