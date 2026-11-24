import { ActionIcon, Group, Text, Textarea } from "@mantine/core";
import { IconCheck, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
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
  return <div className="mx-3 my-2 rounded-md border border-(--mantine-color-default-border) bg-(--mantine-color-default) px-2 py-1.5 font-sans text-(--mantine-color-text) focus-within:border-[#647b8f] focus-within:shadow-[0_0_0_1px_#647b8f]">
    {editing ? <div className="relative">
      <Textarea autoFocus aria-label="Review comment" placeholder="What should change?" size="xs" autosize minRows={1}
        value={editor.body} disabled={disabled} onChange={event=>onDraft(event.currentTarget.value)}
        styles={{input:{background:"transparent",border:0,borderRadius:0,padding:"6px 64px 6px 8px",minHeight:36}}}
        onKeyDown={event=>{
          if (event.key==="Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault();event.stopPropagation();if (!disabled && editor.body.trim()) onSave(); }
          if (event.key==="Escape") { event.stopPropagation();onCancel(); }
        }}/>
      <div className="absolute right-1 bottom-1.5 flex gap-0.5">
        <ActionIcon variant="subtle" color="gray" size={24} aria-label="Cancel comment" onClick={onCancel}><IconX size={14}/></ActionIcon>
        <ActionIcon variant="subtle" color="gray" size={24} aria-label="Save comment" disabled={disabled || !editor.body.trim()} onClick={onSave}><IconCheck size={15}/></ActionIcon>
      </div>
    </div> : <>
      <Text size="sm" className="whitespace-pre-wrap wrap-anywhere">{comment.body}</Text>
      <Group justify="flex-end" gap={2} mt={4}>
        <ActionIcon size={24} variant="subtle" color="gray" aria-label="Edit comment" disabled={disabled} onClick={onEdit}><IconPencil size={14}/></ActionIcon>
        <ActionIcon size={24} variant="subtle" color="gray" aria-label="Delete comment" disabled={disabled} onClick={onDelete}><IconTrash size={14}/></ActionIcon>
      </Group>
    </>}
  </div>;
}
