import { ActionIcon, Button, Group, Text, Textarea } from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import type { ReviewComment as Comment } from "../../domain/review.js";

interface Props {
  comment:Comment;
  editor:{id:string;body:string}|null;
  disabled:boolean;
  onDraft(body:string):void;
  onSave():void;
  onCancel():void;
  onEdit():void;
  onDelete():void;
}
export function ReviewComment({comment,editor,disabled,onDraft,onSave,onCancel,onEdit,onDelete}:Props) {
  const editing = editor?.id===comment.id;
  return <div className="mx-1.5 my-1 bg-(--mantine-color-default) px-2 py-1.5 font-sans text-(--mantine-color-text) focus-within:shadow-[inset_2px_0_var(--mantine-color-dimmed)]">
    {editing ? <div className="relative">
      <Textarea aria-label="Review comment" placeholder="What should change?" size="xs" autosize minRows={1}
        value={editor.body} disabled={disabled} onChange={event=>onDraft(event.currentTarget.value)}
        styles={{input:{background:"transparent",border:0,borderRadius:0,padding:"6px 64px 6px 8px",minHeight:36}}}
        onKeyDown={event=>{
          if ((event.metaKey || event.ctrlKey) && event.key==="Enter" && editor.body.trim()) { event.preventDefault();onSave(); }
          if (event.key==="Escape") { event.stopPropagation();onCancel(); }
        }}/>
      <div className="absolute right-1 bottom-1.5 flex gap-0.5">
        <ActionIcon variant="subtle" color="gray" size={24} aria-label="Cancel comment" onClick={onCancel}><IconX size={14}/></ActionIcon>
        <ActionIcon variant="subtle" color="gray" size={24} aria-label="Save comment" disabled={disabled || !editor.body.trim()} onClick={onSave}><IconCheck size={15}/></ActionIcon>
      </div>
    </div> : <>
      <Text size="sm" className="whitespace-pre-wrap wrap-anywhere">{comment.body}</Text>
      <Group justify="flex-end" gap={4} mt={4}>
        <Button size="compact-xs" variant="subtle" color="gray" disabled={disabled} onClick={onEdit}>Edit</Button>
        <Button size="compact-xs" variant="subtle" color="gray" disabled={disabled} onClick={onDelete}>Delete</Button>
      </Group>
    </>}
  </div>;
}
