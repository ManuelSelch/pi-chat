import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
export function RichText({text}: {text:string}) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm, [remarkMath, {singleDollarTextMath:false}]]} rehypePlugins={[rehypeKatex, {strict:false}]} skipHtml components={{img:()=>null, a:({children,href})=><a href={href} target="_blank" rel="noopener noreferrer">{children}</a>}}>{text}</ReactMarkdown></div>;
}
