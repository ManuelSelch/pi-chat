import { expect, it } from "vitest";
import { comparisonSchema, diffViewerContract } from "../contract.js";

it("rejects unknown modes, option-like branches and non-object commit identities",()=>{
  expect(comparisonSchema.safeParse({kind:"branch",ref:"--output=/tmp/x"}).success).toBe(false);
  expect(comparisonSchema.safeParse({kind:"commit",sha:"HEAD; rm -rf /"}).success).toBe(false);
  expect(comparisonSchema.safeParse({kind:"split"}).success).toBe(false);
  expect(comparisonSchema.safeParse({kind:"uncommitted",ref:"main"}).success).toBe(false);
});
it("accepts opaque full commit IDs while keeping labels out of RPC comparison identity",()=>{
  expect(comparisonSchema.parse({kind:"commit",sha:"a".repeat(40)})).toEqual({kind:"commit",sha:"a".repeat(40)});
  expect(diffViewerContract.methods.commits.input.parse({projectPath:"/repo"})).toEqual({projectPath:"/repo"});
  expect(diffViewerContract.methods.commits.input.safeParse({projectPath:"/repo",query:"fix",offset:50}).success).toBe(false);
});
