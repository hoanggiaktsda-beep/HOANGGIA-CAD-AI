// Pinned AGPL-3.0-only viewer rendering correction; fail closed on upstream changes.
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
const path=join(dirname(require.resolve('@flyfish-dev/cad-viewer/package.json')),'dist/cad-viewer.es.js');
let source=readFileSync(path,'utf8');
const pairs=[
 ['Math.max(4, Math.min(256, Math.abs(i) * this.view.scale))','Math.max(0.001, Math.abs(i) * this.view.scale)'],
 ['Math.max(4, Math.min(256, a))','Math.max(0.001, a)']
];
for(const [before,after] of pairs){
 if(source.includes(before)){
  if(source.split(before).length!==2)throw Error('Ambiguous font scale patch');
  source=source.replace(before,after);
 }else if(!source.includes(after))throw Error('Viewer 0.8.3 font patch no longer matches; review upstream');
}
writeFileSync(path,source);
console.log('CAD text pixel scale: no minimum enlargement or maximum shrinkage (both renderers).');
// Preserve authored spline parameters and MTEXT anchors across DWG normalization.
const workerPath=join(dirname(path),'wasm/dwg-worker.js');
let worker=readFileSync(workerPath,'utf8');
const needle='const o=Re(t,void 0,{...n,numericColorMode:"rgb"}),e=P(t.color);';
const replacement='const o=Re(t,void 0,{...n,numericColorMode:"rgb"}); /* HG_AUTHORED_GEOMETRY */ for(const key of ["degree","knots","weights","attachmentPoint","direction","styleName","rectWidth","lineSpacing"])if(t[key]!==undefined)o[key]=t[key]; const e=P(t.color);';
if(worker.includes(needle)){
 if(worker.split(needle).length!==2)throw Error('Ambiguous DWG normalization patch');
 worker=worker.replace(needle,replacement);writeFileSync(workerPath,worker);
}else if(!worker.includes('HG_AUTHORED_GEOMETRY'))throw Error('DWG parameter preservation patch no longer matches');
