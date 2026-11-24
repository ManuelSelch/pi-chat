import { useEffect, useRef, useState } from "react";
import { ActionIcon, Button, Combobox, Text, useCombobox } from "@mantine/core";
import { IconArrowLeft, IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";

export interface ReferenceOption { value:string; label:string; note:string; suggested?:boolean }
interface Props {
  label:string; value:string|null; selectedLabel:string; prefix?:string; options:ReferenceOption[];
  searchable:boolean; heading?:string; disabled:boolean; message:string; onSelect(value:string):void;
}
export const comparisonButtonStyles = {
  root:{height:30,minHeight:30,borderRadius:5,fontSize:12,fontWeight:400,background:"var(--mantine-color-body)",borderColor:"var(--mantine-color-default-border)"},
};
export function ReferencePicker(p:Props) {
  const [all,setAll] = useState(false);
  const [query,setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const picker = useCombobox({onDropdownClose:()=>{setAll(false);setQuery("");picker.resetSelectedOption();}});
  useEffect(()=>{
    if (all && picker.dropdownOpened) search.current?.focus();
  },[all,picker.dropdownOpened]);
  const options = p.options.filter(option=>p.searchable ? all ? option.label.toLowerCase().includes(query.trim().toLowerCase()) : option.suggested || option.value===p.value : true);
  return <Combobox store={picker} position="bottom-start" width={340} withinPortal onOptionSubmit={value=>{p.onSelect(value);picker.closeDropdown();picker.focusTarget();}}>
    <Combobox.Target targetType="button" withExpandedAttribute={false} aria-expanded={picker.dropdownOpened}>
      <Button className="min-w-0 max-w-full" styles={{...comparisonButtonStyles,label:{gap:7,minWidth:0},inner:{justifyContent:"flex-start"},section:{flexShrink:0}}} variant="default" size="compact-xs"
        aria-label={p.label} aria-description={p.selectedLabel} disabled={p.disabled} rightSection={<IconChevronDown size={12}/>}
        onClick={()=>picker.toggleDropdown()}>
        {p.prefix && <span className="shrink-0 text-(--mantine-color-dimmed)">{p.prefix}</span>}<span className="truncate">{p.selectedLabel}</span>
      </Button>
    </Combobox.Target>
    <Combobox.Dropdown style={{padding:4,borderRadius:7,maxWidth:"calc(100vw - 24px)",background:"var(--mantine-color-default)",borderColor:"var(--mantine-color-default-border)",boxShadow:"var(--mantine-shadow-md)"}}>
      {all && <Combobox.Search ref={search} value={query} onChange={event=>{setQuery(event.currentTarget.value);picker.resetSelectedOption();}}
        placeholder="Search all branches…" aria-label="Search all branches" styles={{input:{fontSize:12,background:"var(--mantine-color-body)"}}}
        leftSectionPointerEvents="all" leftSection={<ActionIcon variant="subtle" color="gray" size="sm" aria-label="Back to suggestions"
          onClick={()=>{setAll(false);setQuery("");picker.resetSelectedOption();picker.focusTarget();}}><IconArrowLeft size={15}/></ActionIcon>}/>}
      {p.heading && <Text size="xs" c="dimmed" px={9} pt={7} pb={5}>{p.heading}</Text>}
      <Combobox.Options style={{maxHeight:270,overflowY:"auto"}}>
        {options.length ? options.map(option=><Combobox.Option key={option.value} value={option.value} active={option.value===p.value} aria-label={option.label}
          style={{display:"flex",gap:8,alignItems:"center",padding:"9px 8px",fontSize:12,borderRadius:4}}>
          <span className="flex w-3.5 shrink-0">{option.value===p.value && <IconCheck size={14}/>}</span>
          <span className="min-w-0 flex-1 wrap-anywhere">{option.label}</span>
          {option.note && <span className="max-w-25 shrink-0 text-right text-[10px] text-(--mantine-color-dimmed)">{option.note}</span>}
        </Combobox.Option>) : <Combobox.Empty>{all ? "No matching branches" : p.message}</Combobox.Empty>}
      </Combobox.Options>
      {p.searchable && !all && <div className="mt-1 border-t border-(--mantine-color-default-border) pt-1">
        <Button fullWidth variant="subtle" color="gray" justify="start" size="compact-sm" styles={{root:{fontSize:12,fontWeight:400}}}
          leftSection={<IconSearch size={14}/>} onClick={()=>{setAll(true);picker.resetSelectedOption();}}>Search all branches…</Button>
      </div>}
    </Combobox.Dropdown>
  </Combobox>;
}
