// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useRemoteQuery } from "../use-remote-query.js";

afterEach(cleanup);
it("ignores old project replies and cancels their local waits", async()=>{
  let finishOld!: (value:string)=>void;
  let oldSignal!: AbortSignal;
  const old = vi.fn((signal:AbortSignal)=>{oldSignal=signal;return new Promise<string>(resolve=>{finishOld=resolve;});});
  const current = vi.fn(async()=>"current");
  const hook = renderHook(({key,load})=>useRemoteQuery(key,true,load),{initialProps:{key:"old",load:old}});

  hook.rerender({key:"new",load:current});
  await waitFor(()=>expect(hook.result.current).toEqual({status:"ready",value:"current"}));
  await act(async()=>finishOld("stale"));

  expect(oldSignal.aborted).toBe(true);
  expect(hook.result.current).toEqual({status:"ready",value:"current"});
});
it("aborts a pending request when the panel unmounts", ()=>{
  let signal!: AbortSignal;
  const load = (value:AbortSignal)=>{signal=value;return new Promise<string>(()=>{});};
  const hook = renderHook(()=>useRemoteQuery("project",true,load));

  hook.unmount();

  expect(signal.aborted).toBe(true);
});
