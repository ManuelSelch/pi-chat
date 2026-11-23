import { useEffect, useState } from "react";
import { ActionIcon, Button, Group, Select, Text, Tooltip } from "@mantine/core";
import { IconGitBranch, IconRefresh } from "@tabler/icons-react";
import type { CommitPage, RepositoryContext } from "../../contract.js";
import type { Mode, Preferences } from "../stores/DiffViewerProvider.js";
import type { QueryState } from "../hooks/use-remote-query.js";

interface Props {
  branch: string; context: QueryState<RepositoryContext>; preferences: Preferences; update(patch:Partial<Preferences>):void;
  commits: QueryState<CommitPage>; onQuery(value:string):void; offset:number; onNext():void; onPrevious():void;
  loading:boolean; disabled:boolean; onRefresh():void;
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
  return <div className="flex flex-wrap items-center gap-3 border-b border-(--mantine-color-default-border) px-4 py-2">
    <Group gap={6}><IconGitBranch size={15}/><Text size="xs">{p.branch}</Text></Group>
    <Select aria-label="Comparison mode" size="xs" w={145} value={p.preferences.mode} allowDeselect={false}
      onChange={value=>{if(value) p.update({mode:value as Mode});}}
      data={[{value:"branch",label:"Branch"},{value:"uncommitted",label:"Uncommitted"},{value:"commit",label:"Commit"}]}/>
    {p.preferences.mode==="branch" && <Select aria-label="Comparison branch" placeholder="Select a branch" size="xs" w={230} searchable allowDeselect={false}
      disabled={p.disabled} value={p.preferences.branch} onChange={branch=>p.update({branch})} nothingFoundMessage="No matching branches"
      searchValue={branchSearch} onSearchChange={setBranchSearch} onDropdownOpen={()=>setBranchSearch("")}
      onDropdownClose={()=>setBranchSearch(branches.find(branch=>branch.ref===p.preferences.branch)?.name ?? "")}
      data={[
        {group:"Local branches",items:branches.filter(branch=>!branch.remote).map(branch=>({value:branch.ref,label:branch.name}))},
        {group:"Remote branches",items:branches.filter(branch=>branch.remote).map(branch=>({value:branch.ref,label:branch.name}))},
      ]}/>}
    {p.preferences.mode==="commit" && <div className="min-w-0">
      <Select aria-label="Comparison commit" placeholder="Select a commit" size="xs" w={280} maw="100%" searchable allowDeselect={false}
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
    <Tooltip label="Refresh changes"><ActionIcon className="ml-auto" variant="subtle" color="gray" aria-label="Refresh changes" loading={p.loading} disabled={p.disabled} onClick={p.onRefresh}><IconRefresh size={17}/></ActionIcon></Tooltip>
  </div>;
}
