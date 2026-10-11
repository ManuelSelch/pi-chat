const data = [
  {type:'Session', title:'Improve the quick switcher', context:'pi-chat · feat/quick-switcher · just now', open:true},
  {type:'Worktree', title:'feat/quick-switcher', context:'pi-chat · ~/.worktrees/pi-chat/feat-quick-switcher'},
  {type:'Folder', title:'pi-chat', context:'~/.pi/agent/git/pi-chat'},
  {type:'Session', title:'Review the transport changes', context:'pi-chat · main · 2h ago'},
  {type:'Worktree', title:'Detached worktree', context:'pi-chat · detached at abc1234 · ~/work/review'},
  {type:'Folder', title:'notes', context:'~/Documents/notes'},
  {type:'Folder', title:'notes', context:'~/Work/notes'},
  {type:'Action', title:'New session', context:'Start a session in the current folder'},
  {type:'Action', title:'Open folder…', context:'Choose a folder to start a session'},
  {type:'Action', title:'Open settings', context:'Models, appearance and preferences'},
];
const paths = {Action:'<path d="m13 3-9 11h7l-1 7 10-12h-7l1-6Z"/>',Folder:'<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"/>',Worktree:'<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10m12-10c0 8-12 2-12 10"/>',Session:'<path d="M4 4h16v12H8l-4 4V4Z"/>'};
const dialog=document.querySelector('dialog'), input=document.querySelector('#search'), results=document.querySelector('#results');
let active=0, shown=[];
function render(){
  const query=input.value.trim().toLowerCase(), scope={'#':'Folder','%':'Worktree','@':'Session','/':'Action'}[query[0]], text=scope?query.slice(1).trim():query;
  shown=data.filter(item=>(!scope||item.type===scope)&&`${item.title} ${item.context}`.toLowerCase().includes(text));
  active=Math.min(active,Math.max(0,shown.length-1));results.replaceChildren();
  document.querySelectorAll('[data-scope]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.scope===(scope?query[0]:'')));
  if(!shown.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No matching results';results.append(empty);}
  shown.forEach((item,index)=>{
    const row=document.createElement('button');row.className='row';row.setAttribute('role','option');row.setAttribute('aria-selected',index===active);
    row.setAttribute('aria-label', `${item.type}: ${item.title} · ${item.context}${item.open ? ' · Open' : ''}`);
    row.innerHTML=`<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${paths[item.type]}</svg><span class="copy"><span class="title"></span><span class="context"></span></span>`;
    row.querySelector('.title').textContent=item.title;row.querySelector('.context').textContent=item.context;
    if(item.open){const mark=document.createElement('span');mark.className='open';mark.textContent='Open';row.querySelector('.title').append(mark);}
    row.addEventListener('click',()=>choose(item));results.append(row);
  });
}
function choose(item){dialog.removeAttribute('open');document.querySelector('#notice').textContent=`Simulated ${item.type==='Action'?'action':'opening'}: ${item.title}`;}
input.addEventListener('input',()=>{active=0;render();});
document.querySelectorAll('[data-scope]').forEach(button=>button.addEventListener('click',()=>{input.value=button.dataset.scope;active=0;render();input.focus();}));
function reopen(){dialog.setAttribute('open','');input.focus();}
document.querySelector('#reopen').addEventListener('click',reopen);
document.querySelector('#theme').addEventListener('click',()=>document.documentElement.classList.toggle('light'));
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='o'){event.preventDefault();reopen();}
  if(!dialog.hasAttribute('open'))return;
  if(event.key==='Escape'){dialog.removeAttribute('open');return;}
  if(event.target!==input)return;
  if(['ArrowDown','ArrowUp'].includes(event.key)&&shown.length){event.preventDefault();active=(active+(event.key==='ArrowDown'?1:-1)+shown.length)%shown.length;render();}
  if(event.key==='Enter'&&shown[active]){event.preventDefault();choose(shown[active]);}
});
const params=new URLSearchParams(location.search);if(params.get('theme')==='light')document.documentElement.classList.add('light');input.value=params.get('q')||'';render();
