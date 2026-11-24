import { useState } from "react";
import { Button, Group, Text, Textarea } from "@mantine/core";
import type { Comment } from "./data";

export function CommentCard({comment,editing,onSave,onCancel,onEdit,onDelete}:{comment:Comment;editing:boolean;onSave(body:string):void;onCancel():void;onEdit():void;onDelete():void}) {
  const [body,setBody] = useState(comment.body);
  return <div className="review-comment">
    <Group justify="space-between" mb={4}><Text size="xs" c="dimmed">{comment.side==="deletions" ? "Old" : "New"} line {comment.line}</Text><Text size="xs" c="dimmed">Draft</Text></Group>
    {editing ? <>
      <Textarea aria-label="Review comment" placeholder="What should change?" size="xs" autosize minRows={1} value={body} onChange={event=>setBody(event.currentTarget.value)} onKeyDown={event=>{if ((event.metaKey || event.ctrlKey) && event.key==="Enter" && body.trim()) onSave(body.trim());if(event.key==="Escape") onCancel();}}/>
      <Group justify="flex-end" gap={4} mt={4}><Button size="compact-xs" variant="subtle" color="gray" onClick={onCancel}>Cancel</Button><Button className="comment-save" size="compact-xs" variant="default" disabled={!body.trim()} onClick={()=>onSave(body.trim())}>Save</Button></Group>
    </> : <>
      <Text size="sm" className="comment-body">{comment.body}</Text>
      <Group justify="flex-end" gap={4} mt={4}><Button size="compact-xs" variant="subtle" color="gray" onClick={onEdit}>Edit</Button><Button size="compact-xs" variant="subtle" color="gray" onClick={onDelete}>Delete</Button></Group>
    </>}
  </div>;
}
