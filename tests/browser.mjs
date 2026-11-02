import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdtempSync,rmSync,cpSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pageOperation} from '../extension/page.js';
import {createBridge} from '../bridge/server.mjs';
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(readFileSync('tests/fixture.html'));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
const userData=mkdtempSync(join(tmpdir(),'applypilot-test-'));const extension=join(userData,'extension');cpSync(resolve('extension'),extension,{recursive:true});
// A test-only fixture permission substitutes for the user clicking the toolbar action (activeTab).
const manifest=JSON.parse(readFileSync(join(extension,'manifest.json'),'utf8'));manifest.host_permissions.push(`http://127.0.0.1/*`);writeFileSync(join(extension,'manifest.json'),JSON.stringify(manifest));
let context,bridge;
try{
  context=await chromium.launchPersistentContext(userData,{headless:true,channel:'chromium',...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const page=await context.newPage();await page.goto(`http://127.0.0.1:${port}`);
  const inspect=()=>page.evaluate(pageOperation,'inspect');
  const op=(name,args)=>page.evaluate(({code,name,args})=>(0,eval)(`(${code})`)(name,args),{code:pageOperation.toString(),name,args});
  let snap=await inspect();assert(!snap.fields.some(f=>f.type==='password'));
  const id=name=>snap.fields.find(f=>f.name===name).id;
  const args=()=>({url:snap.url,revision:snap.revision});
  let result=await op('fill',{...args(),entries:[{fieldId:id('fullName'),value:'测试用户'},{fieldId:id('email'),value:'user@example.test'},{fieldId:id('degree'),value:'硕士'},{fieldId:id('school'),value:'不应覆盖'},{fieldId:id('consent'),value:'yes'}]});
  assert.equal(result.filter(r=>r.ok).length,3);assert.equal(await page.locator('[name=school]').inputValue(),'已有学校');assert.equal(await page.locator('[name=degree]').inputValue(),'master');assert.equal(await page.locator('[name=consent]').isChecked(),false);
  assert((await page.evaluate(()=>window.events)).includes('fullName'));
  await op('attach',{...args(),fieldId:id('resume'),file:{name:'resume.pdf',type:'application/pdf',data:Buffer.from('%PDF-1.4 test').toString('base64')}});
  assert.equal(await page.locator('[name=resume]').evaluate(el=>el.files[0].name),'resume.pdf');
  await assert.rejects(op('attach',{...args(),fieldId:id('resume'),file:{name:'bad.exe',type:'application/octet-stream',data:'AA=='}}),/格式/);
  const stale={...args()};snap=await inspect();await assert.rejects(op('fill',{...stale,entries:[]}),/变化/);
  await page.goto(`http://127.0.0.1:${port}/next`);await assert.rejects(op('fill',{...args(),entries:[]}),/变化/);
  assert.equal(await page.evaluate(()=>window.submitted),false);
  // Test the actual packaged extension UI, isolated-world execution and MCP bridge.
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');const extensionId=new URL(worker.url()).host;
  const panel=await context.newPage();await panel.goto(`chrome-extension://${extensionId}/panel.html`);
  await panel.locator('[data-tab=profile]').click();await panel.locator('#profile-fullName').fill('侧栏用户');await panel.locator('#profile-email').fill('panel@example.test');await panel.locator('#saveProfile').click();
  await panel.waitForFunction(()=>document.querySelector('#status').textContent.includes('已保存'));
  await panel.reload();await panel.locator('[data-tab=profile]').click();assert.equal(await panel.locator('#profile-fullName').inputValue(),'侧栏用户');
  // Panel runs as its own tab in tests: stub active-tab lookup to the fixture tab.
  const fixtureId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,page.url());
  await panel.evaluate(id=>{chrome.tabs.query=async()=>[await chrome.tabs.get(id)];},fixtureId);
  await panel.locator('[data-tab=apply]').click();await panel.locator('#scan').click();await panel.locator('.preview-row').first().waitFor();await panel.locator('#fill').click();
  await panel.waitForFunction(()=>document.querySelector('#status').textContent.includes('已填写'));assert.equal(await page.locator('[name=fullName]').inputValue(),'侧栏用户');
  await panel.setViewportSize({width:390,height:850});await panel.evaluate(()=>window.scrollTo(0,0));mkdirSync('.local',{recursive:true});await panel.screenshot({path:'.local/panel-preview.png',fullPage:true});
  await panel.locator('[data-tab=files]').click();await panel.locator('#fileInput').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF test')});await panel.locator('.file-row').waitFor();
  bridge=createBridge();await new Promise((r,j)=>{bridge.server.once('error',j);bridge.server.listen(17321,'127.0.0.1',r);});
  await panel.locator('[data-tab=connect]').click();await panel.locator('#token').fill(bridge.token);await panel.locator('#connectButton').click();await panel.waitForFunction(()=>document.querySelector('#connection').textContent.startsWith('已连接'));
  assert.equal((await bridge.call('get_profile')).fullName,'侧栏用户');
  const aiSnap=await bridge.call('inspect_form');const materials=await bridge.call('list_materials');assert.equal(materials.length,1);
  await bridge.call('attach_material',{url:aiSnap.url,revision:aiSnap.revision,fieldId:aiSnap.fields.find(f=>f.name==='resume').id,materialId:materials[0].id});
  assert.equal(await page.locator('[name=resume]').evaluate(el=>el.files[0].name),'test.pdf');
  await bridge.call('fill_fields',{url:aiSnap.url,revision:aiSnap.revision,entries:[{fieldId:aiSnap.fields.find(f=>f.name==='phone').id,value:'13800000000'}]});assert.equal(await page.locator('[name=phone]').inputValue(),'13800000000');
  await page.goto(`http://localhost:${port}`);await assert.rejects(bridge.call('inspect_form'),/跨站/);
  await panel.locator('#disconnect').click();assert.equal(await page.evaluate(()=>window.submitted),false);
  console.log('PASS: real Chrome extension profile persistence, preview/fill, material upload, authenticated MCP round-trip, stale page and cross-origin protection');
}finally{await context?.close();if(bridge)await bridge.close();await new Promise(r=>server.close(r));rmSync(userData,{recursive:true,force:true});}
