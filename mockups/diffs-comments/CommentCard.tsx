import { useState } from "react";
import { ActionIcon, Group, Text, Textarea } from "@mantine/core";
import { IconCheck, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import type { Comment } from "./data";

export function CommentCard({comment,editing,onSave,onCancel,onEdit,onDelete}:{comment:Comment;editing:boolean;onSave(body:string):void;onCancel():void;onEdit():void;onDelete():void}) {
  const [body,setBody] = useState(comment.body);
  return <div className="review-comment">
    {editing ? <div className="comment-editor">
      <Textarea autoFocus aria-label="Review comment" placeholder="What should change?" size="xs" autosize minRows={1} value={body} onChange={event=>setBody(event.currentTarget.value)} onKeyDown={event=>{if (event.key==="Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault();event.stopPropagation();if (body.trim()) onSave(body.trim()); }if(event.key==="Escape") onCancel();}}/>
      <div className="comment-editor-actions">
        <ActionIcon size={24} variant="subtle" color="gray" aria-label="Cancel comment" onClick={onCancel}><IconX size={14}/></ActionIcon>
        <ActionIcon size={24} variant="subtle" color="gray" aria-label="Save comment" disabled={!body.trim()} onClick={()=>onSave(body.trim())}><IconCheck size={15}/></ActionIcon>
      </div>
    </div> : <>
      <Text size="sm" className="comment-body">{comment.body}</Text>
      <Group justify="flex-end" gap={2} mt={4}><ActionIcon size={24} variant="subtle" color="gray" aria-label="Edit comment" onClick={onEdit}><IconPencil size={14}/></ActionIcon><ActionIcon size={24} variant="subtle" color="gray" aria-label="Delete comment" onClick={onDelete}><IconTrash size={14}/></ActionIcon></Group>
    </>}
  </div>;
}
