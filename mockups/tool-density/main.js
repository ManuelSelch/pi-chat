const app=document.querySelector('.app');
const panel=document.querySelector('#settingsPanel');
const trigger=document.querySelector('#settingsButton');
function setOpen(open){panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));}
trigger.addEventListener('click',()=>setOpen(panel.hidden));
document.querySelector('#closeSettings').addEventListener('click',()=>setOpen(false));
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
  const compact=button.dataset.mode==='compact';
  app.classList.toggle('compact',compact);
  document.querySelectorAll('[data-mode]').forEach(item=>item.classList.toggle('selected',item===button));
  document.querySelectorAll('.tool').forEach(tool=>{tool.open=!compact;});
}));
