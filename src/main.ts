import "./style.css";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header><strong>HOANGGIA <span>CAD AI</span></strong><small>SITE WORKSPACE · FOUNDATION</small></header><main><section class="toolbar"><label class="upload">Mở DXF <input id="file" type="file" accept=".dxf,.dwg" hidden /></label><button id="fit">Vừa khung</button><button id="clear">Xóa bản xem</button></section><section class="viewer"><canvas id="canvas"></canvas><div id="hint">Chọn tệp DXF để bắt đầu. DWG chưa được hỗ trợ trong bản nền tảng.</div></section><footer id="status">Chưa có bản vẽ · Chế độ thử nghiệm</footer></main>`;
const canvas=document.querySelector<HTMLCanvasElement>("#canvas")!, ctx=canvas.getContext("2d")!;
let zoom=1,panX=0,panY=0,drag=false,lastX=0,lastY=0,filename="";
function resize(){const r=canvas.getBoundingClientRect();canvas.width=r.width*devicePixelRatio;canvas.height=r.height*devicePixelRatio;render();}
function render(){ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.fillStyle="#111b29";ctx.fillRect(0,0,canvas.width,canvas.height);const w=canvas.clientWidth,h=canvas.clientHeight;ctx.save();ctx.translate(w/2+panX,h/2+panY);ctx.scale(zoom,zoom);ctx.strokeStyle="#314358";ctx.lineWidth=1/zoom;for(let x=-2000;x<=2000;x+=40){ctx.beginPath();ctx.moveTo(x,-2000);ctx.lineTo(x,2000);ctx.stroke();}for(let y=-2000;y<=2000;y+=40){ctx.beginPath();ctx.moveTo(-2000,y);ctx.lineTo(2000,y);ctx.stroke();}ctx.restore();}
new ResizeObserver(resize).observe(canvas);
canvas.addEventListener("pointerdown",e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener("pointermove",e=>{if(!drag)return;panX+=e.clientX-lastX;panY+=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;render();});
canvas.addEventListener("pointerup",()=>drag=false);
canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=Math.max(.1,Math.min(20,zoom*(e.deltaY<0?1.1:.9)));render();},{passive:false});
document.querySelector<HTMLButtonElement>("#fit")!.onclick=()=>{zoom=1;panX=panY=0;render();};
document.querySelector<HTMLButtonElement>("#clear")!.onclick=()=>{filename="";document.querySelector("#status")!.textContent="Chưa có bản vẽ · Chế độ thử nghiệm";document.querySelector("#hint")!.textContent="Chọn tệp DXF để bắt đầu. DWG chưa được hỗ trợ trong bản nền tảng.";};
document.querySelector<HTMLInputElement>("#file")!.onchange=e=>{const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;filename=file.name;document.querySelector("#status")!.textContent=filename+" · Chưa có bộ phân tích CAD";document.querySelector("#hint")!.textContent="Đã chọn "+filename+". Bộ đọc CAD sẽ được tích hợp ở bước tiếp theo; chưa hiển thị hình học.";};
