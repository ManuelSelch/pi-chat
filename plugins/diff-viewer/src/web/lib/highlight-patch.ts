import { common, createLowlight } from "lowlight";
import type { PatchLine } from "../../domain/parse-patch.js";

const highlighter = createLowlight(common);
type Token = ReturnType<typeof highlighter.highlight>["children"][number];
export interface HighlightSegment { text:string; classes:string[] }

const languages: Record<string,string> = {
  js:"javascript",jsx:"javascript",mjs:"javascript",cjs:"javascript",
  ts:"typescript",tsx:"typescript",mts:"typescript",cts:"typescript",
  graphql:"graphql",gql:"graphql",lua:"lua",pl:"perl",r:"r",less:"less",
  json:"json",css:"css",scss:"scss",html:"xml",htm:"xml",xml:"xml",svg:"xml",
  md:"markdown",markdown:"markdown",yml:"yaml",yaml:"yaml",
  py:"python",pyw:"python",rb:"ruby",go:"go",rs:"rust",java:"java",kt:"kotlin",kts:"kotlin",
  c:"c",h:"c",cc:"cpp",cpp:"cpp",hpp:"cpp",cs:"csharp",swift:"swift",php:"php",
  sh:"bash",bash:"bash",zsh:"bash",sql:"sql",toml:"ini",ini:"ini",conf:"ini",
  dockerfile:"dockerfile",makefile:"makefile",
};

function languageForPath(path:string):string|undefined {
  const name = path.split("/").at(-1)?.toLowerCase() ?? "";
  if (name==="dockerfile" || name.startsWith("dockerfile.")) return "dockerfile";
  if (name==="makefile" || name==="gnumakefile") return "makefile";
  if (name===".bashrc" || name===".zshrc") return "bash";
  const extension = name.split(".").at(-1) ?? "";
  return Object.hasOwn(languages,extension) ? languages[extension] : undefined;
}

/** Split token text at newlines, retaining ancestor classes across line boundaries. */
function tokenLines(tokens:Token[]):HighlightSegment[][] {
  const result:HighlightSegment[][] = [[]];
  function visit(token:Token, inherited:string[]) {
    if (token.type==="text") {
      const parts = token.value.split("\n");
      parts.forEach((text,index)=>{
        if (index) result.push([]);
        if (text) result[result.length-1]!.push({text,classes:inherited});
      });
    } else if (token.type==="element") {
      const classes = token.properties.className;
      const combined = [...inherited,...(Array.isArray(classes) ? classes.map(String) : [])];
      token.children.forEach(child=>visit(child,combined));
    }
  }
  tokens.forEach(token=>visit(token,[]));
  return result;
}

/** Highlight each hunk's old/new sides independently; context uses the new side. */
export function highlightPatch(path:string,lines:PatchLine[]):HighlightSegment[][] {
  const result:HighlightSegment[][] = lines.map(line=>[{text:line.text,classes:[]}]);
  const language = languageForPath(path);
  if (!language || !highlighter.registered(language)) return result;
  let hunk:number[] = [];
  function flush() {
    for (const side of ["old","new"] as const) {
      const indices = hunk.filter(index=>side==="old" ? lines[index]!.kind!=="add" : lines[index]!.kind!=="remove");
      if (!indices.length) continue;
      try {
        const source = indices.map(index=>lines[index]!.text).join("\n");
        const highlighted = tokenLines(highlighter.highlight(language!,source).children);
        indices.forEach((index,position)=>{
          const segments = highlighted[position];
          // Never let a grammar alter source text or drop a line.
          if (segments && segments.map(segment=>segment.text).join("")===lines[index]!.text) result[index] = segments;
        });
      } catch {
        // Incomplete or unsupported code must remain readable.
      }
    }
    hunk = [];
  }
  lines.forEach((line,index)=>{
    if (line.kind==="hunk") flush();
    else if (line.kind!=="note") hunk.push(index);
  });
  flush();
  return result;
}
