import { useState } from "react";
import { ActionIcon, Badge, Button, Group, Paper, SegmentedControl, Text, Textarea } from "@mantine/core";
import { IconArrowUp, IconChevronDown, IconMessageCircle, IconPlus, IconSettings } from "@tabler/icons-react";
import { PromptDialog, type Stage } from "./PromptDialog";
import { PendingPrompt } from "./PendingPrompt";
import { RichText } from "./RichText";
import { explanation } from "./content";
type ReviewState = "select"|"editor"|"minimized";
export function App() {
 const initial = new URLSearchParams(location.search).get("state")||"select";
 const [stage,setStage]=useState<Stage>(initial==="editor"?"editor":"select");
 const [minimized,setMinimized]=useState(initial==="minimized");
 const [answer,setAnswer]=useState(initial==="editor"?"1":"");
 const [reasoning,setReasoning]=useState(initial==="editor"?"The filter visits every id. Each visit does one Set lookup, so…":"");
 const [status,setStatus]=useState<"pending"|"submitted"|"cancelled">("pending");
 const [review,setReview]=useState(initial);
 const chooseState=(value:string)=>{const state=value as ReviewState;setReview(state);setStage(state==="editor"?"editor":"select");setMinimized(state==="minimized");setStatus("pending");setAnswer(state==="editor"?"1":"");setReasoning(state==="editor"?"The filter visits every id. Each visit does one Set lookup, so…":"");history.replaceState(null,"","?state="+state);};
 return <div className="app">
 <div className="review-strip"><Group justify="space-between" gap="sm"><Group gap="sm"><Badge variant="outline" color="gray">Mockup · r1</Badge><Text size="xs" c="dimmed">Pending prompts · no backend</Text></Group><SegmentedControl size="xs" value={review} onChange={chooseState} data={[{value:"select",label:"Question"},{value:"editor",label:"Reasoning"},{value:"minimized",label:"Minimized"}]}/></Group></div>
 <header className="app-header"><Group justify="space-between"><Group gap="sm"><IconMessageCircle size={20}/><Text fw={650}>Pi Chat</Text><Text c="dimmed" size="sm" className="desktop-only">/ Quick Chats</Text></Group><Group gap="sm"><Button variant="subtle" size="xs" color="gray" leftSection={<IconPlus size={14}/>}>New chat</Button><ActionIcon variant="subtle" color="gray" aria-label="Settings"><IconSettings size={18}/></ActionIcon></Group></Group></header>
 <div className="tab-row"><span className="active-tab"><span className="status-dot"/>Collection complexity <IconChevronDown size={13}/></span></div>
 <main className="transcript">
 <div className="user-message">Help me understand time complexity when using arrays and sets. Quiz me on one small topic.</div>
 <article><Text className="speaker" size="xs" c="dimmed" mb="md">PI · FEEDBACK ON CHECK 1</Text><RichText text={explanation}/></article>
 <Paper className="tool-line" p="sm" withBorder><Group justify="space-between"><Text size="xs" ff="monospace">quiz <span className="muted">· Check 2</span></Text><Badge size="xs" variant="light" color={status==="pending"?"yellow":"gray"}>{status==="pending"?"Waiting for you":status}</Badge></Group></Paper>
 {status!=="pending"&&<Paper p="md" withBorder mt="lg"><Text size="sm">{status==="submitted"?"Answer and reasoning submitted. This preview does not grade or run the next question.":"Quiz cancelled. No answer submitted."}</Text><Button variant="subtle" mt="xs" size="xs" onClick={()=>chooseState("select")}>Restart preview</Button></Paper>}
 </main>
 <footer className="composer-area"><div className="composer-inner">
 {status==="pending"&&minimized&&<PendingPrompt stage={stage} hasDraft={Boolean(answer||reasoning)} onOpen={()=>setMinimized(false)}/>}
 <Paper className="composer" p="md" withBorder><Textarea aria-label="Chat message" variant="unstyled" minRows={2} placeholder={status==="pending"?"Read the explanation, then reopen the pending question…":"Message Pi…"} disabled={status==="pending"}/><Group justify="space-between"><Text size="xs" c="dimmed">{status==="pending"?"Pi is waiting for your answer":"Preview only"}</Text><ActionIcon aria-label="Send message" variant="filled" disabled><IconArrowUp size={17}/></ActionIcon></Group></Paper>
 <Text className="runtime-label" size="xs" c="dimmed">One small topic · Adaptive checks · No mastery score</Text>
 </div></footer>
 <PromptDialog opened={status==="pending"&&!minimized} stage={stage} answer={answer} reasoning={reasoning} onAnswer={setAnswer} onReasoning={setReasoning} onMinimize={()=>setMinimized(true)} onCancel={()=>setStatus("cancelled")} onContinue={()=>stage==="select"?setStage("editor"):setStatus("submitted")}/>
 </div>;
}
