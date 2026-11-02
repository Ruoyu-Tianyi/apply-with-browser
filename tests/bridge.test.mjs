import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createBridge,validate} from '../bridge/server.mjs';
test('bridge authenticates, rejects website origins and carries commands/results',async()=>{
  const b=createBridge({timeout:300});await new Promise(r=>b.server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${b.server.address().port}`;const headers={Authorization:`Bearer ${b.token}`,'Content-Type':'application/json'};
  try{
    assert.equal((await fetch(url+'/poll')).status,401);
    assert.equal((await fetch(url+'/poll',{headers:{...headers,Origin:'https://evil.test'}})).status,403);
    const hostStatus=await new Promise((resolve,reject)=>{const req=http.get(url+'/poll',{headers:{...headers,Host:'evil.test'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});assert.equal(hostStatus,403);
    await assert.rejects(b.call('inspect_form'),/未连接/);
    assert.equal((await fetch(url+'/connect',{method:'POST',headers,body:JSON.stringify({tabId:7})})).status,200);
    const result=b.call('inspect_form');const command=await (await fetch(url+'/poll',{headers})).json();assert.equal(command.name,'inspect_form');
    await fetch(url+'/result',{method:'POST',headers,body:JSON.stringify({id:command.id,value:{fields:[]}})});assert.deepEqual(await result,{fields:[]});
    const timed=b.call('get_profile');await assert.rejects(timed,/超时/);
    const rejected=b.call('inspect_form');const outcome=assert.rejects(rejected,/reconnected/);
    await fetch(url+'/connect',{method:'POST',headers,body:JSON.stringify({tabId:7})});await outcome;
    assert.equal((await fetch(url+'/connect',{method:'POST',headers,body:JSON.stringify({tabId:8})})).status,400);
  }finally{await b.close();}
});
test('tools reject malformed payloads and do not expose arbitrary execution',()=>{
  assert.throws(()=>validate('evaluate',{script:'anything'}),/Unknown/);
  assert.throws(()=>validate('fill_fields',{url:'x',revision:'r',entries:[{fieldId:'a',value:12}]}));
  assert.throws(()=>validate('get_profile',{extra:true}));
  validate('fill_fields',{url:'x',revision:'r',entries:[{fieldId:'a',value:'Test'}]});
});
