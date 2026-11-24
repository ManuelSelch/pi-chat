import { expect, it } from "vitest";
import { fileKind, groupFiles } from "../file-navigation.js";
import type { ChangedFile } from "../../contract.js";

function file(path:string):ChangedFile { return {path,status:"M",binary:false,patch:"",added:1,removed:1}; }

it.each([
  ["src/features/cart.ts","Source"],["src/styles/global.css","Source"],["assets/logo.png","Source"],
  ["src/__tests__/cart.ts","Tests"],["src/cart.test.tsx","Tests"],["tests/e2e/cart.ts","Tests"],["testing/support/setup.ts","Tests"],["src/cart.spec.ts","Tests"],
  ["docs/images/changes.png","Docs"],["README.md","Docs"],["CONTRIBUTING","Docs"],["guide.mdx","Docs"],
  ["package.json","Config"],["package-lock.json","Config"],["pnpm-lock.yaml","Config"],["tsconfig.web.json","Config"],["vite.config.ts","Config"],[".github/workflows/ci.yml","Config"],[".gitignore","Config"],[".env.local","Config"],["Dockerfile","Config"],["config/app.ts","Config"]
])("classifies %s as %s",(path,kind)=>{
  expect(fileKind(path)).toBe(kind);
});

it("keeps config and docs inside tests in the Tests group",()=>{
  expect(fileKind("tests/fixtures/package.json")).toBe("Tests");
  expect(fileKind("tests/README.md")).toBe("Tests");
});

it("groups in kind order and flattens the same folder-first order used by navigation",()=>{
  const files = ["package.json","src/root.ts","src/feature/z.ts","src/feature/a.ts","docs/guide.md","src/feature/a.test.ts"].map(file);
  const original = files.map(item=>item.path);

  const groups = groupFiles(files);

  expect(groups.map(group=>group.kind)).toEqual(["Source","Tests","Docs","Config"]);
  expect(groups[0]!.files.map(item=>item.path)).toEqual(["src/feature/a.ts","src/feature/z.ts","src/root.ts"]);
  expect(groups[0]!.nodes).toMatchObject([{type:"folder",name:"src",count:3,children:[{type:"folder",name:"feature",count:2},{type:"file",name:"root.ts"}]}]);
  expect(files.map(item=>item.path)).toEqual(original);
});

it("compacts single-child folders without dropping the shared path",()=>{
  const groups = groupFiles(["packages/cart/src/pay.ts","packages/cart/src/refund.ts"].map(file));

  expect(groups[0]!.nodes).toMatchObject([{type:"folder",path:"packages/cart/src",name:"packages/cart/src",count:2,children:[{type:"file",name:"pay.ts"},{type:"file",name:"refund.ts"}]}]);
});

it("omits empty groups and handles root files and no matches",()=>{
  expect(groupFiles([])).toEqual([]);
  const groups = groupFiles([file("root.ts")]);

  expect(groups.map(group=>group.kind)).toEqual(["Source"]);
  expect(groups[0]!.nodes).toMatchObject([{type:"file",name:"root.ts",path:"root.ts"}]);
});

it("keeps identical filenames under their distinct folder paths",()=>{
  const groups = groupFiles(["src/b/index.ts","src/a/index.ts"].map(file));

  expect(groups[0]!.files.map(item=>item.path)).toEqual(["src/a/index.ts","src/b/index.ts"]);
  expect(groups[0]!.nodes).toMatchObject([{name:"src",children:[{name:"a"},{name:"b"}]}]);
});
