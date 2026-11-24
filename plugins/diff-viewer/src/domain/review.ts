import type { Comparison, DiffSnapshot } from "../contract.js";
import { parsePatch } from "./parse-patch.js";

export interface ReviewComment {
  id:string;
  path:string;
  side:"additions"|"deletions";
  line:number;
  excerpt:string;
  body:string;
  patch:string;
  baseCommit:string;
}
export function reviewScope(sessionId:string,projectPath:string,comparison:Comparison):string {
  return JSON.stringify([sessionId,projectPath,comparison]);
}
export function createReviewComment(id:string,snapshot:DiffSnapshot,path:string,side:ReviewComment["side"],line:number):ReviewComment {
  const file = snapshot.files.find(file=>file.path===path);
  const row = file && !file.binary && parsePatch(file.patch).find(row=>(side==="deletions" ? row.old : row.next)===line);
  if (!file || !row) throw new Error("This line is no longer available for commenting.");
  return {id,path,side,line,excerpt:row.text,body:"",patch:file.patch,baseCommit:snapshot.baseCommit};
}
export function isCommentStale(comment:ReviewComment,snapshot:DiffSnapshot):boolean {
  return comment.baseCommit!==snapshot.baseCommit || snapshot.files.find(file=>file.path===comment.path)?.patch!==comment.patch;
}
export function formatReview(comments:readonly ReviewComment[],comparison:Comparison):string {
  const against = comparison.kind==="branch" ? comparison.ref : comparison.kind==="commit" ? comparison.sha : "HEAD / working tree";
  return "Please address these diff review comments.\nComparison: "+against+"\n\n"+comments.map(comment=>
    JSON.stringify(comment.path)+":"+comment.line+" ("+(comment.side==="deletions" ? "old" : "new")+")\nBase: "+comment.baseCommit+"\n> "+comment.excerpt+"\n"+comment.body,
  ).join("\n\n");
}
