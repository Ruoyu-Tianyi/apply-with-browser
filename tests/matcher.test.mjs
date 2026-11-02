import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makePlan,matchField} from '../extension/matcher.js';
test('Chinese and English labels map to factual profile values',()=>{
  const profile={fullName:'测试用户',email:'test@example.test',school:'测试大学'};
  assert.equal(matchField({id:'1',label:'姓名：',type:'text'},profile).key,'fullName');
  assert.equal(matchField({id:'2',label:'Email *',type:'email'},profile).value,profile.email);
  assert.equal(matchField({id:'3',label:'毕业院校',type:'text'},profile).key,'school');
});
test('never proposes sensitive controls, existing values or unsupported facts',()=>{
  const fields=[{id:'1',label:'邮箱',type:'email',value:'existing@test.test'},{id:'2',label:'姓名',type:'password'},{id:'3',label:'姓名',type:'checkbox'},{id:'4',label:'是否有工作许可',type:'text'},{id:'5',label:'姓名',type:'text',disabled:true}];
  assert.deepEqual(makePlan({fields},{fullName:'Test',email:'new@test.test'}),[]);
});
