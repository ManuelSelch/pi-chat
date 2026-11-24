import { parseDiffFromFile } from "@pierre/diffs";

const before = `export interface ReviewComment {
  path: string;
  line: number;
  body: string;
}

export function formatReview(comments: ReviewComment[]) {
  return comments.map(comment =>
    comment.path + ":" + comment.line + "\\n" + comment.body
  ).join("\\n\\n");
}
`;
const after = `export interface ReviewComment {
  path: string;
  side: "old" | "new";
  line: number;
  excerpt: string;
  body: string;
}

export function formatReview(comments: ReviewComment[]) {
  if (!comments.length) return "";
  return comments.map(comment =>
    comment.path + ":" + comment.line + " (" + comment.side + ")" +
    "\\n> " + comment.excerpt + "\\n" + comment.body
  ).join("\\n\\n");
}
`;
const oldSend = `export async function sendReview(sessionId: string, message: string) {
  await client.prompt(sessionId, message);
  clearComments();
}
`;
const newSend = `export async function sendReview(sessionId: string, message: string) {
  const destination = sessionId;
  const batch = capturePendingComments();
  await client.prompt(destination, message);
  markSubmitted(batch);
}
`;
export const fixtures = [
  {path:"src/review/format-review.ts", before, after},
  {path:"src/review/send-review.ts", before:oldSend, after:newSend},
  {path:"src/review/legacy.ts", before:"export const reviewServer = 'http://localhost:3000';\n", after:""},
];
const params = new URLSearchParams(location.search);
if (params.get("state") === "large") {
  const rows = Array.from({length:6000}, (_,i)=>`export const setting${i + 1} = ${i};`);
  fixtures.push({path:"src/generated/settings.ts", before:rows.join("\n")+"\n", after:rows.map((row,i)=>i % 3===0 ? row.replace(" = ", " = 1 + ") : row).join("\n")+"\n"});
}
export const files = fixtures.map(file=>({
  ...file,
  diff:parseDiffFromFile({name:file.path,contents:file.before,cacheKey:file.path+":old"},{name:file.path,contents:file.after,cacheKey:file.path+":new"}),
}));
export interface Comment {
  id: string;
  path: string;
  side: "additions" | "deletions";
  line: number;
  body: string;
}
export function formatBatch(comments:Comment[]) {
  return "Please address these diff review comments.\n\n"+comments.map(comment=>{
    const file = files.find(file=>file.path===comment.path)!;
    const excerpt = (comment.side==="deletions" ? file.before : file.after).split("\n")[comment.line-1];
    return comment.path+":"+comment.line+" ("+(comment.side==="deletions" ? "old" : "new")+")\n> "+excerpt+"\n"+comment.body;
  }).join("\n\n");
}
