import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
test('stdio MCP handshake, tool discovery and disconnected errors', {timeout:10000}, async()=>{
  const child=spawn(process.execPath,['bridge/server.mjs'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  const responses=new Map();const waiting=new Map();let errorLog='';child.stderr.on('data',x=>errorLog+=x);
  const lines=createInterface({input:child.stdout});lines.on('line',line=>{const msg=JSON.parse(line);if(waiting.has(msg.id)){waiting.get(msg.id)(msg);waiting.delete(msg.id);}else responses.set(msg.id,msg);});
  const receive=id=>responses.has(id)?Promise.resolve(responses.get(id)):new Promise(r=>waiting.set(id,r));
  const send=(id,method,params)=>child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
  try{
    send(1,'initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'test',version:'1'}});
    assert.equal((await receive(1)).result.serverInfo.name,'applypilot');
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
    send(2,'tools/list',{});assert.equal((await receive(2)).result.tools.length,5);
    send(3,'tools/call',{name:'inspect_form',arguments:{}});const reply=await receive(3);assert.equal(reply.result.isError,true);assert.match(reply.result.content[0].text,/未连接/);
    send(4,'not/a/method',{});assert.equal((await receive(4)).error.code,-32601);
  }finally{
    const exit=new Promise(r=>child.once('exit',r));child.stdin.end();await exit;lines.close();assert.equal(child.exitCode,0,errorLog);
  }
});
