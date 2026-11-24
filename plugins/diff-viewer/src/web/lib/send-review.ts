import type { PiClient } from "@manuelselch/pi-sdk";

/** Acceptance isn't delivery: wait for the exact user-message echo, not the agent's answer. */
export function sendReview(client:PiClient,sessionId:string,text:string):Promise<void> {
  return new Promise((resolve,reject)=>{
    let operationId:string|undefined;
    let echoed = false;
    let accepted = false;
    let finished = false;
    const earlyFailures = new Map<string,string>();
    const existing = new Set(client.getSession(sessionId)?.messages.map(message=>message.id));
    const timer = setTimeout(()=>finish(new Error("Delivery is unconfirmed. Check the chat before resending; no automatic retry was sent.")),10_000);
    const stop = client.onMessage(message=>{
      if (message.type!=="event" || message.sessionId!==sessionId) return;
      if (message.event==="message.finalized" && message.data.message.role==="user" && message.data.message.text===text && !existing.has(message.data.message.id)) {
        echoed = true;
        if (accepted) finish();
      }
      if (message.event==="operation.finished" && message.data.outcome==="failed") {
        earlyFailures.set(message.data.operationId,message.data.error.message);
        if (operationId===message.data.operationId) finish(new Error(message.data.error.message));
      }
      if (message.event==="session.closed") finish(new Error("Session closed. Check the chat before resending these retained comments."));
    });
    function finish(error?:Error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      stop();
      if (error) reject(error);
      else resolve();
    }
    void client.prompt(sessionId,text).then(result=>{
      operationId=result.operationId;
      accepted = true;
      const error = earlyFailures.get(operationId);
      if (echoed) finish();
      else if(error) finish(new Error(error));
    },error=>finish(new Error((error instanceof Error ? error.message : String(error))+" Comments retained; check the chat before resending.")));
  });
}
