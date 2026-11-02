import {readdirSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for (const dir of ['extension','bridge']) for(const f of readdirSync(dir).filter(f=>/\.(mjs|js)$/.test(f))){const r=spawnSync(process.execPath,['--check',`${dir}/${f}`],{stdio:'inherit'});if(r.status)process.exit(r.status);}
const m=JSON.parse(readFileSync('extension/manifest.json','utf8'));
if(m.manifest_version!==3 || m.permissions.includes('debugger') || m.host_permissions.some(p=>p.includes('<all_urls>')))throw Error('Unexpected permissions');
console.log('Syntax and manifest checks passed');
