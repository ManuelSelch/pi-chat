// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { PluginUIHost } from "@manuelselch/pi-sdk/plugins";
import type { Comparison, DiffSnapshot } from "../../../contract.js";
import { DiffViewerProvider } from "../../stores/DiffViewerProvider.js";
import { useReview } from "../use-review.js";
import { sendReview } from "../../lib/send-review.js";
vi.mock("../../lib/send-review.js",()=>({sendReview:vi.fn()}));

const snapshot:DiffSnapshot={branch:"feature",baseCommit:"a".repeat(40),files:[{path:"test.ts",patch:"@@ -1 +1 @@\n-old\n+new\n",status:"M",binary:false,added:1,removed:1}]};
const comparison:Comparison={kind:"uncommitted"};
let host:PluginUIHost;
beforeEach(()=>{
  vi.resetAllMocks();
  host={activeSessionId:"one",projectPath:"/project",connected:true,sessions:[{sessionId:"one",status:"idle"},{sessionId:"two",status:"idle"}],request:invoke=>invoke({} as never),createSession:vi.fn(),useOverlayFocus:()=>({returnFocus:false,onExitTransitionEnd:()=>{}})};
});
afterEach(cleanup);
function wrapper({children}:{children:ReactNode}) {return <DiffViewerProvider host={host}>{children}</DiffViewerProvider>;}
function setup() {return renderHook(({value=snapshot,base=comparison})=>useReview(value,base),{wrapper,initialProps:{value:snapshot,base:comparison}});}
it("keeps unsaved editor text across session switches and isolates destinations",()=>{
  const hook=setup();
  act(()=>hook.result.current.begin("test.ts","additions",1));
  act(()=>hook.result.current.draft("Handle errors."));
  host={...host,activeSessionId:"two"};
  hook.rerender({value:snapshot,base:comparison});
  expect(hook.result.current.state.comments).toHaveLength(0);
  host={...host,activeSessionId:"one"};
  hook.rerender({value:snapshot,base:comparison});
  expect(hook.result.current.state.editor?.body).toBe("Handle errors.");
  act(()=>hook.result.current.save());
  expect(hook.result.current.state.comments[0]?.body).toBe("Handle errors.");
});
it("disables sending while editing, stale, disconnected or busy",()=>{
  const hook=setup();
  act(()=>hook.result.current.begin("test.ts","deletions",1));
  act(()=>hook.result.current.draft("Retain this."));
  expect(hook.result.current.canSend).toBe(false);
  act(()=>hook.result.current.save());
  expect(hook.result.current.canSend).toBe(true);
  hook.rerender({value:{...snapshot,files:[]},base:comparison});
  expect(hook.result.current.canSend).toBe(false);
  expect(hook.result.current.stale).toHaveLength(1);
  host={...host,connected:false};
  hook.rerender({value:snapshot,base:comparison});
  expect(hook.result.current.canSend).toBe(false);
  host={...host,connected:true,sessions:[{sessionId:"one",status:"running"}]};
  hook.rerender({value:snapshot,base:comparison});
  expect(hook.result.current.canSend).toBe(false);
});
it("sends once to the captured session and clears only that confirmed batch",async()=>{
  let complete!:()=>void;
  vi.mocked(sendReview).mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
  const hook=setup();
  act(()=>hook.result.current.begin("test.ts","additions",1));
  act(()=>hook.result.current.draft("Handle errors."));
  act(()=>hook.result.current.save());
  let pending!:Promise<void>;
  act(()=>{pending=hook.result.current.send();void hook.result.current.send();});
  expect(sendReview).toHaveBeenCalledOnce();
  expect(sendReview).toHaveBeenCalledWith(expect.anything(),"one",expect.stringContaining("Handle errors."));
  host={...host,activeSessionId:"two"};
  hook.rerender({value:snapshot,base:comparison});
  act(()=>hook.result.current.begin("test.ts","deletions",1));
  act(()=>hook.result.current.draft("Another session."));
  act(()=>hook.result.current.save());
  await act(async()=>{complete();await pending;});
  expect(hook.result.current.state.comments[0]?.body).toBe("Another session.");
  host={...host,activeSessionId:"one"};
  hook.rerender({value:snapshot,base:comparison});
  expect(hook.result.current.state.comments).toHaveLength(0);
});
it("retains comments on delivery failure and lets users remove stale drafts",async()=>{
  vi.mocked(sendReview).mockRejectedValue(new Error("Delivery unconfirmed"));
  const hook=setup();
  act(()=>hook.result.current.begin("test.ts","additions",1));
  act(()=>hook.result.current.draft("Handle errors."));
  act(()=>hook.result.current.save());
  await act(()=>hook.result.current.send());
  expect(hook.result.current.state.comments).toHaveLength(1);
  expect(hook.result.current.state.error).toBe("Delivery unconfirmed");
  act(()=>hook.result.current.remove(hook.result.current.state.comments[0]!.id));
  expect(hook.result.current.state.comments).toHaveLength(0);
});
