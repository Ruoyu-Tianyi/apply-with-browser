import {fields, makePlan} from './matcher.js';
import {pageOperation} from './page.js';
import {vault} from './vault.js';
const $ = id => document.getElementById(id);
const names = {fullName:'姓名',firstName:'英文名',lastName:'英文姓',email:'邮箱',phone:'手机号',city:'现居城市',address:'通讯地址',school:'毕业院校',major:'专业',degree:'学历',graduation:'毕业时间',linkedin:'LinkedIn',github:'GitHub',website:'个人网站',introduction:'自我介绍'};
const status = text => { $('status').textContent = text; };
let snapshot, target, connected = false, generation = 0, token = '';
for (const [key, name] of Object.entries(names)) {
  const label = document.createElement('label'); label.textContent = name;
  const input = document.createElement('input'); input.name = key; input.id = `profile-${key}`; input.autocomplete = 'off'; label.append(input); $('profileForm').append(label);
}
const stored = await chrome.storage.local.get('profile');
for (const key of Object.keys(fields)) $(`profile-${key}`).value = stored.profile?.[key] || '';
$('context').value = stored.profile?.context || '';
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('main section').forEach(s => s.hidden = s.id !== b.dataset.tab);
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('active', x === b));
}));
function safe(handler) { return async () => { try { await handler(); } catch(e) { status(e.message); } }; }
$('saveProfile').onclick = safe(async () => {
  const profile = Object.fromEntries(Object.keys(fields).map(k => [k,$(`profile-${k}`).value.trim()])); profile.context = $('context').value;
  await chrome.storage.local.set({profile}); status('资料已保存到本机');
});
$('clearProfile').onclick = safe(async () => { await chrome.storage.local.remove('profile'); $('profileForm').reset(); $('context').value = ''; status('个人资料已清空'); });
async function currentTarget() {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!tab || !/^https?:/.test(tab.url || '')) throw Error('请先在普通网页上点击插件图标，再试一次。');
  return {id:tab.id,origin:new URL(tab.url).origin};
}
async function run(op, args = {}, dest = target) {
  if (!dest) throw Error('请先识别或授权当前页面');
  const tab = await chrome.tabs.get(dest.id);
  if (!tab.url || new URL(tab.url).origin !== dest.origin) throw Error('页面已跨站跳转或失去授权，请重新授权');
  const [result] = await chrome.scripting.executeScript({target:{tabId:dest.id},func:pageOperation,args:[op,args]});
  if (result.error) throw Error(result.error.message || '页面操作失败');
  if (result.result === undefined) throw Error('无法读取页面；请重新识别');
  return result.result;
}
async function inspect(dest) { return run('inspect',{},dest); }
function renderPlan(plan) {
  $('preview').replaceChildren(); $('fill').hidden = !plan.length;
  if (!plan.length) { const p = document.createElement('p'); p.textContent = '没有可自动匹配的空白字段。检查资料，或让 Codex 处理复杂问题。'; $('preview').append(p); }
  for (const entry of plan) {
    const row = document.createElement('div'); row.className='preview-row'; row.dataset.fieldId=entry.fieldId;
    const label = document.createElement('label'); const check = document.createElement('input'); check.type='checkbox'; check.checked=true;
    label.append(check,` ${snapshot.fields.find(f=>f.id===entry.fieldId).label} · ${Math.round(entry.confidence*100)}%`);
    const input = document.createElement('input'); input.type='text'; input.value=entry.value; input.setAttribute('aria-label','将填写的内容'); row.append(label,input); $('preview').append(row);
  }
}
$('scan').onclick = safe(async () => {
  target = await currentTarget(); snapshot = await inspect(target); $('pageTitle').textContent = snapshot.title || snapshot.url;
  const {profile={}} = await chrome.storage.local.get('profile'); renderPlan(makePlan(snapshot,profile)); status(`识别到 ${snapshot.fields.length} 个字段`);
});
$('fill').onclick = safe(async () => {
  const entries = [...document.querySelectorAll('.preview-row')].filter(row=>row.querySelector('[type=checkbox]').checked).map(row=>({fieldId:row.dataset.fieldId,value:row.querySelector('[type=text]').value}));
  const results = await run('fill',{url:snapshot.url,revision:snapshot.revision,entries});
  status(`已填写 ${results.filter(r=>r.ok).length} 项；${results.filter(r=>!r.ok).length} 项需检查。${results.filter(r=>!r.ok).map(r=>r.error).join('；')}`);
});
async function renderFiles() {
  $('fileList').replaceChildren();
  for (const item of await vault('list')) {
    const row = document.createElement('div'); row.className='file-row'; const text=document.createElement('span'); text.textContent=`${item.name} · ${(item.size/1024).toFixed(0)} KB`;
    const remove=document.createElement('button'); remove.textContent='删除'; remove.onclick=safe(async()=>{await vault('delete',item.id);await renderFiles();});
    const attach=document.createElement('button'); attach.textContent='上传到页面'; attach.onclick=safe(async()=>{
      if (!snapshot) throw Error('请先在填写页识别表单');
      const candidates=snapshot.fields.filter(f=>f.type==='file');
      if (!candidates.length) throw Error('未发现上传字段。展开上传区域后重新识别。');
      row.querySelector('.upload-options')?.remove(); const options=document.createElement('div'); options.className='upload-options';
      for (const f of candidates) {const b=document.createElement('button');b.textContent=f.label || '未命名上传字段';b.onclick=safe(async()=>{await attachFile(item.id,f.id,snapshot,target);status(`已上传 ${item.name}`); options.remove();}); options.append(b);} row.append(options);
    }); row.append(text,attach,remove); $('fileList').append(row);
  }
}
$('fileInput').onchange=safe(async()=>{
  for(const file of $('fileInput').files){
    if(file.size>10*1024*1024) throw Error(`${file.name} 超过 10 MB`);
    await vault('put',{id:crypto.randomUUID(),name:file.name,type:file.type,size:file.size,blob:file});
  } $('fileInput').value=''; await renderFiles();status('材料已保存到本机');
});
async function attachFile(materialId,fieldId,snap,dest){
  const item=await vault('get',materialId);if(!item)throw Error('材料不存在');
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(item.blob);});
  return run('attach',{url:snap.url,revision:snap.revision,fieldId,file:{name:item.name,type:item.type,data}},dest);
}
let aiTarget, aiSnapshot;
async function execute(command){
  if(command.name==='get_profile') return (await chrome.storage.local.get('profile')).profile || {};
  if(command.name==='list_materials') return (await vault('list')).map(({id,name,type,size})=>({id,name,type,size}));
  if(command.name==='inspect_form'){aiSnapshot=await inspect(aiTarget);return aiSnapshot;}
  if(!aiSnapshot || command.args.revision!==aiSnapshot.revision || command.args.url!==aiSnapshot.url) throw Error('请先 inspect_form 并使用返回的 url 和 revision');
  if(command.name==='fill_fields') return run('fill',command.args,aiTarget);
  if(command.name==='attach_material') return attachFile(command.args.materialId,command.args.fieldId,aiSnapshot,aiTarget);
  throw Error('未知工具');
}
async function request(path,body,signal){
  const r=await fetch(`http://127.0.0.1:17321${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal});
  if(!r.ok)throw Error(`连接失败 (${r.status})`);return r.json();
}
let controller;
function disconnect(){connected=false;generation++;controller?.abort();$('connection').textContent='未连接';aiSnapshot=undefined;}
$('disconnect').onclick=disconnect;
$('connectButton').onclick=safe(async()=>{
  disconnect();aiTarget=await currentTarget();token=$('token').value.trim();if(!token)throw Error('请粘贴配对令牌');
  await request('/connect',{tabId:aiTarget.id});connected=true;const gen=generation; $('connection').textContent='已连接 · 当前标签页已授权';status('Codex 连接已启用');
  while(connected && gen===generation){
    try{
      controller=new AbortController();const command=await request('/poll',null,controller.signal);
      if(!connected || gen!==generation)break;
      if(command.id){let result;try{result={value:await execute(command)};}catch(e){result={error:e.message};} await request('/result',{id:command.id,...result});status(`${command.name} · ${result.error || '完成'}`);}
    }catch(e){if(gen!==generation)break;disconnect();status(`${e.message}，请检查桥接服务后重新连接`);}
  }
});
await renderFiles();
