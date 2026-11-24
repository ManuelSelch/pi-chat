import { useState } from "react";
import { ActionIcon, Button, Group, Text, Textarea } from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import type { Comment } from "./data";

export function CommentCard({comment,editing,onSave,onCancel,onEdit,onDelete}:{comment:Comment;editing:boolean;onSave(body:string):void;onCancel():void;onEdit():void;onDelete():void}) {
  const [body,setBody] = useState(comment.body);
  return <div className="review-comment">
    {editing ? <div className="comment-editor">
      <Textarea aria-label="Review comment" placeholder="What should change?" size="xs" autosize minRows={1} value={body} onChange={event=>setBody(event.currentTarget.value)} onKeyDown={event=>{if ((event.metaKey || event.ctrlKey) && event.key==="Enter" && body.trim()) onSave(body.trim());if(event.key==="Escape") onCancel();}}/>
      <div className="comment-editor-actions">
        <ActionIcon size={24} variant="subtle" color="gray" aria-label="Cancel comment" onClick={onCancel}><IconX size={14}/></ActionIcon>
        <ActionIcon size={24} variant="subtle" color="gray" aria-label="Save comment" disabled={!body.trim()} onClick={()=>onSave(body.trim())}><IconCheck size={15}/></ActionIcon>
      </div>
    </div> : <>
      <Text size="sm" className="comment-body">{comment.body}</Text>
      <Group justify="flex-end" gap={4} mt={4}><Button size="compact-xs" variant="subtle" color="gray" onClick={onEdit}>Edit</Button><Button size="compact-xs" variant="subtle" color="gray" onClick={onDelete}>Delete</Button></Group>
    </>}
  </div>;
}
