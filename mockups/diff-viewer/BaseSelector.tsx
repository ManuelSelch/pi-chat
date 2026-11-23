import { Group, Select } from "@mantine/core";

const branches = [
  {group:"Local branches",items:[
    {value:"branch:refs/heads/main",label:"main"},
    {value:"branch:refs/heads/develop",label:"develop"},
    {value:"branch:refs/heads/feature/diff-viewer",label:"feature/diff-viewer"},
  ]},
  {group:"Remote branches",items:[{value:"branch:refs/remotes/origin/main",label:"origin/main"}]},
];
const commits = [
  {value:"commit:72ac6c4",label:"feat(plugins): add browser contributions"},
  {value:"commit:4e521b8",label:"refactor(plugins): isolate folder opening"},
  {value:"commit:13bf0d2",label:"fix(chat): preserve composer focus"},
  {value:"commit:9bd20a1",label:"feat(plugins): add chimes"},
];
export function BaseSelector({base,onChange}:{base:string;onChange:(base:string)=>void}) {
  const mode = base.startsWith("branch:") ? "branch" : base.startsWith("commit:") ? "commit" : "uncommitted";
  return <Group gap="xs">
    <Select aria-label="Comparison mode" size="xs" w={145} value={mode} allowDeselect={false}
      onChange={value=>{if(value) onChange(value==="uncommitted" ? "HEAD" : value==="branch" ? "branch:refs/heads/main" : "commit:72ac6c4");}}
      data={[{value:"branch",label:"Branch"},{value:"uncommitted",label:"Uncommitted"},{value:"commit",label:"Commit"}]}
    />
    {mode!=="uncommitted" && <Select aria-label={mode==="branch" ? "Comparison branch" : "Comparison commit"}
      placeholder={mode==="branch" ? "Select a branch" : "Select a commit"} searchable
      nothingFoundMessage={mode==="branch" ? "No matching branches" : "No matching recent commits"}
      size="xs" w={280} maw="100%" value={base.endsWith(":") ? null : base} allowDeselect={false}
      onChange={value=>{if(value) onChange(value);}} data={mode==="branch" ? branches : commits}
    />}
  </Group>;
}
