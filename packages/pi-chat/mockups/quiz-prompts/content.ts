export const question = [
"What is the **expected time complexity** of this function?",
"",
"```typescript",
"function countMatches(ids: number[], allowed: Set<number>) {",
"  return ids.filter(id => allowed.has(id)).length;",
"}",
"```",
"",
"- Let **n** be the length of `ids`.",
"- Assume each `Set.has()` lookup takes constant expected time.",
"",
"Consider the **whole function**, not just one lookup.",
"",
"$$",
"T(n) = \\sum_{i=1}^{n} T_{\\text{lookup}}",
"$$"
].join("\n");
export const explanation = [
"### One lookup is not the whole operation",
"",
"You correctly identified that a `Set` avoids scanning every allowed value. The important distinction is **how often the lookup runs**.",
"",
"- A lookup is one step.",
"- The surrounding loop determines how many steps we perform.",
"- Work inside a loop is counted for **each iteration**.",
"",
"```typescript",
"for (const id of ids) {",
"  allowed.has(id); // one lookup, repeated for each id",
"}",
"```",
"",
"We’ll now apply this distinction to a different function. You can minimize the question at any time to reread this explanation."
].join("\n");
export const options = ["O(1) — a Set lookup takes constant expected time", "O(n) — one expected constant-time lookup per id", "O(n²) — filter and has create nested linear scans", "I don't know"];
