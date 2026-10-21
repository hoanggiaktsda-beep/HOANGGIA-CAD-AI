import { CadViewer } from '@flyfish-dev/cad-viewer';
const status=document.getElementById('status');
const setStatus=s=>{status.textContent=s};
const viewer=new CadViewer({container:document.getElementById('viewer'),wasmPath:new URL('./wasm/',document.baseURI).href,useWorker:true,workerTimeoutMs:180000,onLoadProgress:p=>setStatus((p.message||p.phase||'Đang đọc bản vẽ')+(p.percent==null?'':' · '+p.percent+'%'))});
document.getElementById('file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;setStatus('Đang đọc '+file.name+' ('+(file.size/1048576).toFixed(1)+' MB)…');try{await viewer.loadFile(file);setStatus('Đã đọc '+file.name+'. Kiểm tra layer, block, font và kích thước trước khi sử dụng.');}catch(err){setStatus('Không đọc được file: '+(err?.message||String(err)));console.error(err)}});
document.getElementById('fit').addEventListener('click',()=>{try{viewer.fitToView?.()}catch(err){setStatus('Không thể vừa khung: '+err.message)}});
