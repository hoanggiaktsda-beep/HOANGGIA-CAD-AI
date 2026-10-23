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
const replacement='const o=Re(t,void 0,{...n,numericColorMode:"rgb"}); /* HG_AUTHORED_GEOMETRY */ for(const key of ["degree","knots","weights","startTangent","endTangent","attachmentPoint","direction","styleName","rectWidth","lineSpacing"])if(t[key]!==undefined)o[key]=t[key]; const e=P(t.color);';
if(worker.includes(needle)){
 if(worker.split(needle).length!==2)throw Error('Ambiguous DWG normalization patch');
 worker=worker.replace(needle,replacement);writeFileSync(workerPath,worker);
}else if(worker.includes('HG_AUTHORED_GEOMETRY')){
 worker=worker.replace('["degree","knots","weights","attachmentPoint"','["degree","knots","weights","startTangent","endTangent","attachmentPoint"');
 writeFileSync(workerPath,worker);
}else throw Error('DWG parameter preservation patch no longer matches');

// Restore authored TrueType family selection in both renderer paths.
let rendered=readFileSync(path,'utf8');
const rendererPatches=[
 ['this.textItems.push({\n      point: c,','this.textItems.push({\n      fontFamily: e.fontFamily, fontPrefix: e.fontPrefix,\n      point: c,'],
 ['`${h}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`','`${e.fontPrefix||""}${h}px ${e.fontFamily||"Arial, sans-serif"}`'],
 ['`${l}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`','`${r.fontPrefix||""}${l}px ${r.fontFamily||"Arial, sans-serif"}`']
];
for(const [before,after] of rendererPatches){
 if(rendered.includes(before)){
  if(rendered.split(before).length!==2)throw Error('Ambiguous authored-font patch');
  rendered=rendered.replace(before,after);
 }else if(!rendered.includes(after))throw Error('Authored-font patch no longer matches');
}
writeFileSync(path,rendered);
let normalized=readFileSync(workerPath,'utf8');
const styleBefore='requiredShxFonts:c,businessData:';
const styleAfter='requiredShxFonts:c,textStyles:(a.tables?.STYLE?.entries||[]).map(({name,font,bigFont,widthFactor,obliqueAngle})=>({name,font,bigFont,widthFactor,obliqueAngle})),businessData:';
if(normalized.includes(styleBefore)){
 if(normalized.split(styleBefore).length!==2)throw Error('Ambiguous STYLE table patch');
 normalized=normalized.replace(styleBefore,styleAfter);writeFileSync(workerPath,normalized);
}else if(!normalized.includes('textStyles:(a.tables?.STYLE?.entries'))throw Error('STYLE table preservation patch no longer matches');
