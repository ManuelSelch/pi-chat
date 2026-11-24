import { ActionIcon, Button, Menu, Text } from "@mantine/core";
import { IconCheck, IconChevronDown, IconTextWrap, IconRefresh } from "@tabler/icons-react";
import type { CommitPage, RepositoryContext } from "../../contract.js";
import type { Mode, Preferences } from "../stores/DiffViewerProvider.js";
import type { QueryState } from "../hooks/use-remote-query.js";
import { comparisonButtonStyles, ReferencePicker } from "./ReferencePicker.js";

interface Props {
  context: QueryState<RepositoryContext>; preferences: Preferences; update(patch:Partial<Preferences>):void;
  commits: QueryState<CommitPage>;
  loading:boolean; disabled:boolean; onRefresh():void; wrap:boolean; onToggleWrap():void;
}
const modes: {value:Mode;label:string}[] = [{value:"branch",label:"Branch"},{value:"uncommitted",label:"Uncommitted"},{value:"commit",label:"Commit"}];
export function ComparisonControls(p:Props) {
  const context = p.context.status==="ready" ? p.context.value : null;
  const branches = context?.branches ?? [];
  const commits = p.commits.status==="ready" ? p.commits.value.commits : [];
  const priority = [context?.defaultBranch,...(context?.suggestedBranches ?? [])];
  const rank = (ref:string)=>{const index=priority.indexOf(ref);return index===-1 ? priority.length : index;};
  const branchOptions = [...branches].sort((a,b)=>rank(a.ref)-rank(b.ref)).map(branch=>({value:branch.ref,label:branch.name,
    note:branch.ref===context?.defaultBranch ? "Default" : context?.suggestedBranches.includes(branch.ref) ? "Suggested" : "",
    suggested:branch.ref===context?.defaultBranch || context?.suggestedBranches.includes(branch.ref)}));
  const commitOptions = commits.map((commit,index)=>({value:commit.sha,label:commit.subject || "(no commit message)",note:index===0 ? "Latest" : new Date(commit.date).toLocaleDateString(undefined,{month:"short",day:"numeric"})}));
  return <div className="flex flex-wrap items-center gap-2 border-b border-(--mantine-color-default-border) px-3 py-2.5">
    <div className="flex min-w-0 flex-1 items-start gap-1.5">
      <Menu position="bottom-start" withinPortal styles={{item:{fontSize:12,minHeight:32}}}>
        <Menu.Target><Button variant="default" size="compact-xs" className="shrink-0" styles={comparisonButtonStyles} aria-label="Comparison mode"
          rightSection={<IconChevronDown size={12}/>}>{modes.find(mode=>mode.value===p.preferences.mode)?.label}</Button></Menu.Target>
        <Menu.Dropdown styles={{dropdown:{padding:4,borderRadius:7,background:"var(--mantine-color-default)",borderColor:"var(--mantine-color-default-border)"}}}>
          {modes.map(mode=><Menu.Item key={mode.value} onClick={()=>p.update({mode:mode.value})} rightSection={p.preferences.mode===mode.value ? <IconCheck size={13}/> : null}>{mode.label}</Menu.Item>)}
        </Menu.Dropdown>
      </Menu>
      <div className="min-w-0">
        {p.preferences.mode==="branch" && <ReferencePicker key="branch" label="Comparison branch" value={p.preferences.branch} prefix="Against"
          selectedLabel={branches.find(branch=>branch.ref===p.preferences.branch)?.name ?? p.preferences.branch?.replace(/^refs\/(heads|remotes)\//,"") ?? "Select a branch"}
          options={branchOptions} searchable disabled={p.disabled} message={p.context.status==="loading" ? "Loading branches…" : "No suggested branches"}
          onSelect={branch=>p.update({branch})}/>}
        {p.preferences.mode==="commit" && <ReferencePicker key="commit" label="Comparison commit" value={p.preferences.commit}
          selectedLabel={p.preferences.commitSubject || "Select a commit"} options={commitOptions} searchable={false} heading="Recent commits" disabled={p.disabled}
          message={p.commits.status==="loading" ? "Loading commits…" : "No recent commits"}
          onSelect={commit=>p.update({commit,commitSubject:commitOptions.find(option=>option.value===commit)?.label ?? ""})}/>}
        {p.preferences.mode==="commit" && p.commits.status==="error" && <Text size="xs" c="red" role="alert">{p.commits.message}</Text>}
      </div>
    </div>
    <div className="ml-auto flex items-center gap-0.5 self-start">
      <ActionIcon variant={p.wrap ? "light" : "subtle"} color="gray" aria-label="Wrap lines" aria-pressed={p.wrap} onClick={p.onToggleWrap}><IconTextWrap size={17}/></ActionIcon>
      <ActionIcon variant="subtle" color="gray" aria-label="Refresh changes" loading={p.loading} disabled={p.disabled} onClick={p.onRefresh}><IconRefresh size={17}/></ActionIcon>
    </div>
  </div>;
}
