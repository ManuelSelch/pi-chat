import { useEffect, useRef, useState } from "react";
import { Button, Combobox, Menu, Text, useCombobox } from "@mantine/core";
import { IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";

const branches = [
  {ref:"refs/heads/main",name:"main",note:"Default",suggested:true},
  {ref:"refs/heads/feature/plugin-shell",name:"feature/plugin-shell",note:"Suggested",suggested:true},
  {ref:"refs/heads/feature/diff-stream",name:"feature/diff-stream",note:"Suggested",suggested:true},
  {ref:"refs/heads/develop",name:"develop",note:"Local"},
  {ref:"refs/heads/fix/composer-focus",name:"fix/composer-focus",note:"Local"},
  {ref:"refs/heads/chore/update-dependencies",name:"chore/update-dependencies",note:"Local"},
  {ref:"refs/remotes/origin/feature/plugin-shell",name:"origin/feature/plugin-shell",note:"Remote, different tip"},
  {ref:"refs/remotes/origin/release/0.4",name:"origin/release/0.4",note:"Remote"},
  {ref:"refs/remotes/origin/fix/session-reconnect",name:"origin/fix/session-reconnect",note:"Remote"},
  {ref:"refs/remotes/upstream/main",name:"upstream/main",note:"Remote, different tip"},
];
const commits = [
  {ref:"72ac6c4",name:"Add browser contributions",note:"Latest"},
  {ref:"4e521b8",name:"Isolate folder opening",note:"Yesterday"},
  {ref:"13bf0d2",name:"Preserve composer focus",note:"Yesterday"},
  {ref:"9bd20a1",name:"Add chimes plugin",note:"2 days ago"},
  {ref:"51e7a02",name:"Register plugin panel slots",note:"2 days ago"},
];
type Mode = "branch" | "uncommitted" | "commit";
const labels: Record<Mode,string> = {branch:"Branch",uncommitted:"Uncommitted",commit:"Commit"};

export function BaseSelector({base,onChange}:{base:string;onChange:(base:string)=>void}) {
  const [mode,setMode] = useState<Mode>(base.startsWith("commit:") ? "commit" : "branch");
  const [branch,setBranch] = useState(base.startsWith("branch:") ? base.replace("branch:","") : branches[0].ref);
  const [commit,setCommit] = useState(commits[0].ref);
  const [all,setAll] = useState(false);
  const [query,setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const picker = useCombobox({onDropdownClose:()=>{setQuery("");setAll(false);picker.resetSelectedOption();}});
  const searching = all && mode === "branch";
  useEffect(()=>{
    if (picker.dropdownOpened && searching) search.current?.focus();
  },[picker.dropdownOpened,searching]);
  const selected = mode === "branch" ? branch : commit;
  const options = mode === "branch" ? branches : commits;
  const filtered = options.filter(option=>{
    if (!searching && mode === "branch") return option.ref === selected || ("suggested" in option && option.suggested);
    if (mode === "commit") return true;
    return option.name.toLowerCase().includes(query.toLowerCase());
  });
  const name = options.find(option=>option.ref===selected)?.name ?? selected;
  return <div className="comparison-selectors base-picker-controls">
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <Button className="mode-button" variant="default" size="compact-xs" rightSection={<IconChevronDown size={12}/>} aria-label="Comparison mode">{labels[mode]}</Button>
      </Menu.Target>
      <Menu.Dropdown className="base-menu">
        {(["branch","uncommitted","commit"] as const).map(value=><Menu.Item key={value} onClick={()=>{setMode(value);picker.closeDropdown();onChange(value === "uncommitted" ? "HEAD" : value === "commit" ? `commit:${commit}` : `branch:${branch}`);}} rightSection={mode===value ? <IconCheck size={13}/> : null}>{labels[value]}</Menu.Item>)}
      </Menu.Dropdown>
    </Menu>
    {mode !== "uncommitted" && <Combobox store={picker} position="bottom-start" width={340} withinPortal onOptionSubmit={value=>{
      if (mode === "commit") setCommit(value);
      else setBranch(value);
      onChange(`${mode}:${value}`);
      picker.closeDropdown();
      picker.focusTarget();
    }}>
      <Combobox.Target>
        <Button className="base-trigger" variant="default" size="compact-xs" rightSection={<IconChevronDown size={12}/>} onClick={()=>picker.toggleDropdown()} aria-label={`${mode === "branch" ? "Comparison branch" : "Comparison commit"}: ${name}`}>
          {mode === "branch" && <span className="against-label">Against</span>}<span className="base-trigger-name">{name}</span>
        </Button>
      </Combobox.Target>
      <Combobox.Dropdown className="base-popup">
        {searching ? <Combobox.Search ref={search} value={query} onChange={event=>{setQuery(event.currentTarget.value);picker.resetSelectedOption();}} placeholder="Search all branches…" aria-label="Search all branches" leftSection={<IconSearch size={14}/>} /> : <Text className="base-popup-heading" size="xs" c="dimmed">{mode === "commit" ? "Recent commits" : "Compare against"}</Text>}
        <Combobox.Options className="base-options">
          {filtered.length ? filtered.map(option=><Combobox.Option key={option.ref} value={option.ref} active={option.ref===selected} className="base-option">
            <span className="base-option-check">{option.ref===selected && <IconCheck size={14}/>}</span>
            <span className="base-option-name">{option.name}</span>
            <span className="base-option-note">{option.note}</span>
          </Combobox.Option>) : <Combobox.Empty>No matching {mode === "branch" ? "branches" : "commits"}</Combobox.Empty>}
        </Combobox.Options>
        {mode === "branch" && !all && <div className="base-popup-footer"><Button fullWidth variant="subtle" color="gray" justify="start" size="compact-sm" leftSection={<IconSearch size={14}/>} onClick={()=>{setAll(true);picker.resetSelectedOption();}}>Search all branches…</Button></div>}
        {mode === "branch" && all && <div className="base-popup-footer"><Button variant="subtle" color="gray" size="compact-xs" onClick={()=>{setAll(false);setQuery("");picker.focusTarget();}}>Back to suggestions</Button></div>}
      </Combobox.Dropdown>
    </Combobox>}
  </div>;
}
