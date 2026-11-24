import { expect, it } from "vitest";
import { createReviewComment, formatReview, isCommentStale, reviewScope } from "../review.js";
import type { DiffSnapshot } from "../../contract.js";

const snapshot:DiffSnapshot = {branch:"feature",baseCommit:"a".repeat(40),files:[{path:"test.ts",status:"M",binary:false,added:1,removed:1,patch:"@@ -3 +3 @@\n-old value\n+new value\n"}]};
it("captures the old side and excerpt rather than treating deleted lines as new",()=>{
  const comment = createReviewComment("one",snapshot,"test.ts","deletions",3);
  expect(comment).toMatchObject({side:"deletions",line:3,excerpt:"old value",baseCommit:snapshot.baseCommit});
  expect(()=>createReviewComment("two",snapshot,"test.ts","additions",4)).toThrow();
});
it("isolates drafts by session, project and comparison",()=>{
  const key = reviewScope("session","/project",{kind:"uncommitted"});
  expect(reviewScope("other","/project",{kind:"uncommitted"})).not.toBe(key);
  expect(reviewScope("session","/other",{kind:"uncommitted"})).not.toBe(key);
  expect(reviewScope("session","/project",{kind:"branch",ref:"refs/heads/main"})).not.toBe(key);
});
it("marks changed patches, missing files and changed bases stale without moving the anchor",()=>{
  const comment = createReviewComment("one",snapshot,"test.ts","additions",3);
  expect(isCommentStale(comment,snapshot)).toBe(false);
  expect(isCommentStale(comment,{...snapshot,files:[]})).toBe(true);
  expect(isCommentStale(comment,{...snapshot,baseCommit:"b".repeat(40)})).toBe(true);
  expect(isCommentStale(comment,{...snapshot,files:[{...snapshot.files[0]!,patch:"different"}]})).toBe(true);
});
it("formats one contextual batch using saved text and original code",()=>{
  const comment = {...createReviewComment("one",snapshot,"test.ts","deletions",3),body:"Keep the validation."};
  const text = formatReview([comment],{kind:"branch",ref:"refs/heads/main"});
  expect(text).toContain("refs/heads/main");
  expect(text).toContain('"test.ts":3 (old)');
  expect(text).toContain("> old value");
  expect(text).toContain("Keep the validation.");
  expect(text).toContain(snapshot.baseCommit);
});
