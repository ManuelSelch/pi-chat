import { Button, Group, Paper, Text, ThemeIcon } from "@mantine/core";
import { IconArrowUpRight, IconMessageQuestion } from "@tabler/icons-react";
import type { Stage } from "./PromptDialog";
export function PendingPrompt({stage,hasDraft,onOpen}:{stage:Stage;hasDraft:boolean;onOpen:()=>void}) {
 return <Paper className="pending" p="md" withBorder radius="md"><Group wrap="nowrap"><ThemeIcon variant="light" size={36}><IconMessageQuestion size={20}/></ThemeIcon><div className="pending-copy"><Text size="sm" fw={600}>Question pending</Text><Text size="xs" c="dimmed">Check 2 · {stage==="editor"?"Your reasoning":"Choose an answer"}{hasDraft?" · Draft saved in this preview":""}</Text></div><Button variant="light" rightSection={<IconArrowUpRight size={15}/>} onClick={onOpen}>Reopen</Button></Group></Paper>;
}
