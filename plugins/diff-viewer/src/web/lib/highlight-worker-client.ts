import type { PatchLine } from "../../domain/parse-patch.js";
import type { HighlightSegment } from "./highlight-patch.js";

export interface HighlightMessage { id:number; path:string; lines:PatchLine[] }
export interface HighlightReply { id:number; tokens:HighlightSegment[][] }
export type RequestHighlight = (path:string,lines:PatchLine[],done:(tokens:HighlightSegment[][])=>void)=>()=>void;
interface Job extends HighlightMessage { done:(tokens:HighlightSegment[][])=>void }

/** One lazily-created worker per stream, with cancellable, serialized jobs. */
export class HighlightWorkerClient {
  private worker:Worker|null = null;
  private active:Job|null = null;
  private queue:Job[] = [];
  private nextId = 0;
  private timer:ReturnType<typeof setTimeout>|undefined;

  constructor(private readonly createWorker=()=>new Worker(new URL("./highlight.worker.js",import.meta.url),{type:"module"})) {}

  readonly request:RequestHighlight = (path,lines,done)=>{
    // Keep generated/minified files readable without creating an enormous token DOM.
    if (lines.length>2000 || lines.reduce((sum,line)=>sum+line.text.length,0)>128_000) {
      done([]);
      return ()=>{};
    }
    const job:Job = {id:++this.nextId,path,lines,done};
    this.queue.push(job);
    this.pump();
    return ()=>{
      this.queue = this.queue.filter(item=>item!==job);
      if (this.active!==job) return;
      this.stopWorker();
      this.active = null;
      this.pump();
    };
  };

  dispose() {
    this.queue = [];
    this.active = null;
    this.stopWorker();
  }

  private stopWorker() {
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.worker = null;
  }

  private finish(job:Job,tokens:HighlightSegment[][]) {
    if (this.active!==job) return;
    clearTimeout(this.timer);
    this.active = null;
    job.done(tokens);
    this.pump();
  }

  private pump() {
    if (this.active || !this.queue.length) return;
    const job = this.queue.shift()!;
    this.active = job;
    try {
      if (!this.worker) {
        const worker = this.createWorker();
        this.worker = worker;
        worker.onmessage = (event:MessageEvent<HighlightReply>)=>{
          if (this.worker!==worker || this.active?.id!==event.data.id) return;
          this.finish(this.active,event.data.tokens);
        };
        worker.onerror = ()=>{
          if (this.worker!==worker || !this.active) return;
          const failed = this.active;
          this.stopWorker();
          this.finish(failed,[]);
        };
      }
      this.timer = setTimeout(()=>{
        this.stopWorker();
        this.finish(job,[]);
      },2000);
      this.worker.postMessage({id:job.id,path:job.path,lines:job.lines} satisfies HighlightMessage);
    } catch {
      this.stopWorker();
      this.finish(job,[]);
    }
  }
}
