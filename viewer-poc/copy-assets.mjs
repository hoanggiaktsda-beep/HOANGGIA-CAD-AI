import {mkdir,copyFile,stat} from 'node:fs/promises';import {createRequire} from 'node:module';import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);const root=dirname(require.resolve('@flyfish-dev/cad-viewer/package.json'));const out='dist/wasm';await mkdir(out,{recursive:true});
for(const name of ['libredwg-web.js','libredwg-web.wasm','dwg-worker.js','dwfv-render.wasm']){const from=join(root,'dist','wasm',name);const s=await stat(from);if(s.size<100)throw Error('Invalid runtime asset '+name);await copyFile(from,join(out,name));console.log(name,s.size)}
