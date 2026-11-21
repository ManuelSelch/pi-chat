import { ActionIcon, Button, Group, Modal, Radio, Stack, Text, Textarea, Tooltip } from "@mantine/core";
import { IconMinus } from "@tabler/icons-react";
import { RichText } from "./RichText";
import { options, question } from "./content";
export type Stage = "select" | "editor";
interface Props {opened:boolean; stage:Stage; answer:string; reasoning:string; onAnswer:(v:string)=>void; onReasoning:(v:string)=>void; onMinimize:()=>void; onCancel:()=>void; onContinue:()=>void;}
export function PromptDialog(p:Props) {
 return <Modal opened={p.opened} onClose={p.onCancel} withCloseButton={false} closeOnClickOutside={false} centered size={720} padding="lg" overlayProps={{backgroundOpacity:0.55,blur:2}} title={<Text fw={650}>Check 2 · Working with collections</Text>}>
 <div className="minimize-action"><Tooltip label="Minimize without cancelling"><ActionIcon variant="subtle" color="gray" aria-label="Minimize question" onClick={p.onMinimize}><IconMinus size={19}/></ActionIcon></Tooltip></div>
 <Stack gap="lg">
 {p.stage==="select" ? <>
 <RichText text={question}/>
 <Radio.Group value={p.answer} onChange={p.onAnswer} aria-label="Your answer"><Stack gap={8}>{options.map((label,i)=><label className={"answer-option "+(p.answer===String(i)?"chosen":"")} key={label}><Radio value={String(i)} label={label}/></label>)}</Stack></Radio.Group>
 </> : <>
 <div className="answer-summary"><Text size="xs" c="dimmed" mb={5}>YOUR SELECTION</Text><Text size="sm">{options[Number(p.answer||"1")]}</Text></div>
 <Text size="sm">Explain how you reached your answer. What assumptions or uncertainties do you have?</Text>
 <Textarea aria-label="Your reasoning" placeholder="Walk through the function in your own words…" minRows={6} autosize maxRows={12} value={p.reasoning} onChange={e=>p.onReasoning(e.currentTarget.value)}/>
 <Text size="xs" c="dimmed">Optional. An empty explanation is allowed; it won’t be treated as evidence of understanding.</Text>
 </>}
 <Group justify="space-between" className="dialog-footer"><Button variant="subtle" color="gray" onClick={p.onMinimize} leftSection={<IconMinus size={15}/>}>Minimize</Button><Group gap="xs"><Button variant="default" onClick={p.onCancel}>Cancel quiz</Button><Button onClick={p.onContinue} disabled={p.stage==="select"&&!p.answer}>{p.stage==="select"?"Continue to reasoning":"Submit answer"}</Button></Group></Group>
 </Stack></Modal>;
}
