import { useEffect, useState } from "react";
import { ActionIcon, Button, Group, Select, Text } from "@mantine/core";
import { IconTextWrap, IconRefresh } from "@tabler/icons-react";
import type { CommitPage, RepositoryContext } from "../../contract.js";
import type { Mode, Preferences } from "../stores/DiffViewerProvider.js";
import type { QueryState } from "../hooks/use-remote-query.js";

interface Props {
  context: QueryState<RepositoryContext>; preferences: Preferences; update(patch:Partial<Preferences>):void;
  commits: QueryState<CommitPage>; onQuery(value:string):void; offset:number; onNext():void; onPrevious():void;
  loading:boolean; disabled:boolean; onRefresh():void; wrap:boolean; onToggleWrap():void;
}
export function ComparisonControls(p:Props) {
  const [branchSearch,setBranchSearch] = useState("");
  const [commitSearch,setCommitSearch] = useState("");
  const branches = p.context.status==="ready" ? p.context.value.branches : [];
  useEffect(()=>{setBranchSearch(branches.find(branch=>branch.ref===p.preferences.branch)?.name ?? "");},[p.preferences.branch,p.context]);
  useEffect(()=>{setCommitSearch(p.preferences.commitSubject);},[p.preferences.commit,p.preferences.commitSubject]);
  const commits = p.commits.status==="ready" ? p.commits.value.commits : [];
  const commitOptions = commits.map(commit=>({value:commit.sha,label:commit.subject || "(no commit message)"}));
  if (p.preferences.commit && !commitOptions.some(option=>option.value===p.preferences.commit)) commitOptions.push({value:p.preferences.commit,label:p.preferences.commitSubject || "(no commit message)"});
  const pickerStyles = {
    input: {height:30,minHeight:30,borderRadius:5,fontSize:12,background:"var(--mantine-color-body)",borderColor:"var(--mantine-color-default-border)"},
    dropdown: {padding:4,borderRadius:6,background:"var(--mantine-color-default)",borderColor:"var(--mantine-color-default-border)",boxShadow:"var(--mantine-shadow-md)"},
    option: {fontSize:12,minHeight:30,borderRadius:3,overflowWrap:"anywhere" as const},
  };
  return <div className="flex flex-wrap items-center gap-2 border-b border-(--mantine-color-default-border) px-3 py-2.5">
    <div className="flex min-w-0 flex-1 items-start gap-1.5">
    <Select styles={pickerStyles} className="shrink-0" aria-label="Comparison mode" size="xs" w={120} value={p.preferences.mode} allowDeselect={false}
      onChange={value=>{if(value) p.update({mode:value as Mode});}}
      data={[{value:"branch",label:"Branch"},{value:"uncommitted",label:"Uncommitted"},{value:"commit",label:"Commit"}]}/>
    {p.preferences.mode==="branch" && <Select styles={pickerStyles} className="min-w-0 flex-1" aria-label="Comparison branch" placeholder="Select a branch" size="xs" searchable allowDeselect={false}
      disabled={p.disabled} value={p.preferences.branch} onChange={branch=>p.update({branch})} nothingFoundMessage="No matching branches"
      searchValue={branchSearch} onSearchChange={setBranchSearch} onDropdownOpen={()=>setBranchSearch("")}
      onDropdownClose={()=>setBranchSearch(branches.find(branch=>branch.ref===p.preferences.branch)?.name ?? "")}
      data={[
        {group:"Local branches",items:branches.filter(branch=>!branch.remote).map(branch=>({value:branch.ref,label:branch.name}))},
        {group:"Remote branches",items:branches.filter(branch=>branch.remote).map(branch=>({value:branch.ref,label:branch.name}))},
      ]}/>}
    {p.preferences.mode==="commit" && <div className="min-w-0 flex-1">
      <Select styles={pickerStyles} aria-label="Comparison commit" placeholder="Select a commit" size="xs" searchable allowDeselect={false}
        disabled={p.disabled} value={p.preferences.commit} onChange={commit=>p.update({commit,commitSubject:commitOptions.find(option=>option.value===commit)?.label ?? ""})}
        searchValue={commitSearch} onSearchChange={value=>{setCommitSearch(value);p.onQuery(value);}} filter={({options})=>options}
        onDropdownOpen={()=>{setCommitSearch("");p.onQuery("");}}
        onDropdownClose={()=>{setCommitSearch(p.preferences.commitSubject);p.onQuery("");}}
        nothingFoundMessage={p.commits.status==="loading" ? "Loading commits…" : "No matching commits"}
        data={commitOptions}/>
      <Group gap="xs" mt={4}>
        <Button size="compact-xs" variant="subtle" color="gray" disabled={p.offset===0 || p.commits.status==="loading"} onClick={p.onPrevious}>Newer</Button>
        <Button size="compact-xs" variant="subtle" color="gray" disabled={p.commits.status!=="ready" || p.commits.value.nextOffset===null} onClick={p.onNext}>Older</Button>
      </Group>
      {p.commits.status==="error" && <Text size="xs" c="red" role="alert">{p.commits.message}</Text>}
    </div>}
    </div>
    <div className="ml-auto flex items-center gap-0.5 self-start">
    <ActionIcon variant={p.wrap ? "light" : "subtle"} color="gray" aria-label="Wrap lines" aria-pressed={p.wrap} onClick={p.onToggleWrap}><IconTextWrap size={17}/></ActionIcon>
    <ActionIcon variant="subtle" color="gray" aria-label="Refresh changes" loading={p.loading} disabled={p.disabled} onClick={p.onRefresh}><IconRefresh size={17}/></ActionIcon>
    </div>
  </div>;
}
