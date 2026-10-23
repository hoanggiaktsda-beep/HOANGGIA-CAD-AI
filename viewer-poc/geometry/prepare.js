import {applyByBlockColorInheritance,applyByBlockLineTypeInheritance} from '@flyfish-dev/cad-viewer';
import {IDENTITY_MATRIX,matrixFromInsert,multiplyMatrix,transformEntity,transformPoint} from './transform.js';
import {textFontCss} from './fonts.js';
import {splinePolyline} from './spline.js';
const TAU=Math.PI*2;
const kind=e=>String(e.type||'').toUpperCase();
// For planar OCS with a negative normal, local X points opposite world X.
function ocsMatrix(e){
 const n=e.extrusionDirection;
 if(n && Math.abs(n.x||0)<1e-12 && Math.abs(n.y||0)<1e-12 && n.z<0)
  return {a:-1,b:0,c:0,d:1,e:0,f:0};
 return IDENTITY_MATRIX;
}

function affineConic(e,m){
 const ellipse=e.kind==='ellipse'||kind(e)==='ELLIPSE';
 const u=ellipse?e.majorAxisEndPoint:{x:e.radius,y:0};
 if(!e.center||!u)return transformEntity(e,m);
 const ratio=ellipse?Number(e.axisRatio??1):1;
 const v={x:-u.y*ratio,y:u.x*ratio};
 const U={x:m.a*u.x+m.c*u.y,y:m.b*u.x+m.d*u.y};
 const V={x:m.a*v.x+m.c*v.y,y:m.b*v.x+m.d*v.y};
 const xx=U.x*U.x+V.x*V.x,yy=U.y*U.y+V.y*V.y,xy=U.x*U.y+V.x*V.y;
 const delta=Math.hypot(xx-yy,2*xy),r1=Math.sqrt(Math.max(0,(xx+yy+delta)/2));
 // Product of singular values avoids cancellation for thin ellipses.
 const determinant=U.x*V.y-U.y*V.x,r2=r1?Math.abs(determinant)/r1:0;
 if(!(r1>0&&r2>0))return transformEntity(e,m);
 const angle=.5*Math.atan2(2*xy,xx-yy),co=Math.cos(angle),si=Math.sin(angle);
 const parameter=t=>{
  const x=U.x*Math.cos(t)+V.x*Math.sin(t),y=U.y*Math.cos(t)+V.y*Math.sin(t);
  return Math.atan2((-si*x+co*y)/r2,(co*x+si*y)/r1);
 };
 const circle=e.kind==='circle'||kind(e)==='CIRCLE';
 const start=circle?0:Number(e.startAngle??0),end=circle?TAU:Number(e.endAngle??TAU);
 const full=circle||Math.abs(end-start)>=TAU-1e-10;
 let a=parameter(start),b=parameter(end);
 if(determinant<0)[a,b]=[b,a];
 if(full)b=a+TAU;else while(b<a)b+=TAU;
 return {...transformEntity(e,m),type:'ELLIPSE',kind:'ellipse',center:transformPoint(e.center,m),majorAxisEndPoint:{x:r1*co,y:r1*si},axisRatio:r2/r1,startAngle:a,endAngle:b};
}
function transformedLeaves(e,m){
 if(['CIRCLE','ARC','LWPOLYLINE','POLYLINE2D','TEXT','ATTRIB','ATTDEF','HATCH'].includes(kind(e)))
  m=multiplyMatrix(m,ocsMatrix(e));

 if(e.kind==='spline'){
  const result=splinePolyline(e,.02/Math.max(1,Math.hypot(m.a,m.b),Math.hypot(m.c,m.d)));
  if(!result||result.limited)return [{...transformEntity(e,m),kind:'unknown',fidelityIssue:result?'Spline vượt giới hạn sai số hiển thị':(e.flag&1)&&e.fitPoints?.length?'Bộ dựng chưa xác nhận spline kín dạng fit-point':'Spline thiếu tham số bậc/nút/trọng số'}];
  return [{...transformEntity(e,m),type:'LWPOLYLINE',kind:'polyline',vertices:result.points.map(p=>transformPoint(p,m)),controlPoints:undefined,fitPoints:undefined}];
 }
 if(['circle','arc','ellipse'].includes(e.kind)||['CIRCLE','ARC','ELLIPSE'].includes(kind(e)))return [affineConic(e,m)];
 const x=Math.hypot(m.a,m.b),y=Math.hypot(m.c,m.d);
 const anisotropic=Math.abs(x-y)>1e-8||Math.abs(m.a*m.c+m.b*m.d)>1e-8;
 if(e.kind==='polyline'&&anisotropic&&e.vertices?.some(v=>Math.abs(v.bulge||0)>1e-12)){
  const out=[],vs=e.vertices,n=e.isClosed?vs.length:vs.length-1;
  for(let i=0;i<n;i++){
   const p=vs[i],q=vs[(i+1)%vs.length],b=Number(p.bulge||0);
   if(Math.abs(b)<1e-12){out.push(transformEntity({...e,type:'LINE',kind:'line',vertices:undefined,startPoint:p,endPoint:q},m));continue;}
   const dx=q.x-p.x,dy=q.y-p.y,k=(1-b*b)/(4*b),center={x:(p.x+q.x)/2-dy*k,y:(p.y+q.y)/2+dx*k};
   const radius=Math.hypot(p.x-center.x,p.y-center.y),a=Math.atan2(p.y-center.y,p.x-center.x),sweep=4*Math.atan(b);
   const arc={...e,type:'ARC',kind:'arc',vertices:undefined,center,radius,startAngle:sweep>0?a:a+sweep,endAngle:sweep>0?a+sweep:a};
   out.push(affineConic(arc,m));
  }return out;
 }
 const transformed=transformEntity(e,m);
 if(e.kind==='text'){
  const angle=Number(e.rotation||0),c=Math.cos(angle),s=Math.sin(angle);
  const ux=m.a*c+m.c*s,uy=m.b*c+m.d*s;
  const vx=-m.a*s+m.c*c,vy=-m.b*s+m.d*c;
  const baseline=Math.hypot(ux,uy),det=ux*vy-uy*vx;
  const vertical=baseline>1e-14?Math.abs(det)/baseline:0;
  if(vertical>1e-14){
   transformed.rotation=Math.atan2(uy,ux);
   if(typeof e.textHeight==='number')transformed.textHeight=e.textHeight*vertical;
   if(typeof e.height==='number')transformed.height=e.height*vertical;
   transformed.xScale=Number(e.xScale??1)*baseline/vertical;
   transformed.generationFlag=Number(e.generationFlag||0)^(det<0?4:0);
  }
 }
 return [transformed];
}
// Expand once with a composed affine matrix. Source document and coordinates remain unchanged.
export function prepareDrawing(source){
 const output=[],issues=[],report={dimensions:0,missingDimensions:0,nestedInserts:0,missingBlocks:0,cycles:0,expanded:0};
 const blocks=source.blocks||{};
 const residuals=new Set();
 const textStyles=new Map((source.metadata?.textStyles||[]).map(style=>[style.name?.toLowerCase(),style]));
 const namedBlocks=new Map(Object.values(blocks).map(b=>[b.name,b]));
 const lookup=name=>blocks[name]||namedBlocks.get(name);
 const attributeHandles=new Set();
 for(const e of source.entities||[])for(const a of e.attribs||[])if(a.handle)attributeHandles.add(a.handle);
 function walk(e,m,path,depth=0){
  const dimension=kind(e)==='DIMENSION';
  const insert=e.kind==='insert'||['INSERT','MINSERT'].includes(kind(e));
  if(!dimension&&!insert){
   if(e.kind==='text'){
    const style=textStyles.get(String(e.styleName||'').toLowerCase());
    const font=textFontCss(style?.font);
    if(font)e={...e,fontFamily:font.css,fontPrefix:font.prefix};
    else residuals.add('Một số chữ chưa có font gốc tương thích (SHX hoặc STYLE không ghi font); đang dùng font thay thế.');
   }
   const n=e.extrusionDirection;
   if(n&&(Math.abs(n.x||0)>1e-10||Math.abs(n.y||0)>1e-10))residuals.add('Đối tượng có pháp tuyến nghiêng: chưa xác nhận phép chiếu 3D.');
   const det=m.a*m.d-m.b*m.c;
   if(e.kind==='text'&&(det<0||Math.abs(m.a*m.c+m.b*m.d)>1e-7))residuals.add('Chữ trong Block đối xứng/xiên cần đối chiếu hình dạng font.');
   if(e.kind==='hatch'&&Math.abs(Math.hypot(m.a,m.b)-Math.hypot(m.c,m.d))>1e-7)residuals.add('Hatch trong Block scale X/Y khác nhau cần đối chiếu.');
   output.push(...transformedLeaves(e,m));return;
  }
  const name=e.blockName||e.name,block=lookup(name);
  if(!block||path.includes(name)||depth>64){
   if(dimension)report.missingDimensions++;else if(!block)report.missingBlocks++;else report.cycles++;
   // Do not replace missing CAD geometry with guessed markers.
   output.push({...transformEntity(e,m),kind:'unknown'});return;
  }
  if(dimension)report.dimensions++;else if(depth)report.nestedInserts++;
  const instance=dimension?{...e,insertionPoint:{x:0,y:0},rotation:0,scale:{x:1,y:1}}:e;
  const local=multiplyMatrix(dimension?IDENTITY_MATRIX:ocsMatrix(e),matrixFromInsert(instance,block.basePoint||{x:0,y:0}));
  const combined=multiplyMatrix(m,local);
  const rows=Math.max(1,Math.floor(e.insertRowCount||1)),cols=Math.max(1,Math.floor(e.insertColumnCount||1));
  // MINSERT spacing lives in the rotated insert coordinate system, not scaled block coordinates.
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   if(output.length>1500000)throw new Error('Bản vẽ vượt giới hạn 1.500.000 đối tượng sau khi mở Block. Không cắt bớt bản vẽ.');
   const theta=Number(e.rotation||0),dx=col*Number(e.insertColumnSpacing||0),dy=row*Number(e.insertRowSpacing||0);
   const tx=dx*Math.cos(theta)-dy*Math.sin(theta),ty=dx*Math.sin(theta)+dy*Math.cos(theta);
   const matrix={...combined,e:combined.e+m.a*tx+m.c*ty,f:combined.f+m.b*tx+m.d*ty};
   for(const child of block.entities||[]){
    // Layer 0 inherits the INSERT layer; BYBLOCK colors/linetypes inherit too.
    const layer=child.layer==='0'?e.layer:child.layer;
    const parentLayer=source.layers?.[e.layer];
    const parentVisible=e.isVisible!==false && parentLayer?.isVisible!==false && !parentLayer?.isFrozen;
    let inherited=applyByBlockColorInheritance({...child,layer,isVisible:parentVisible&&child.isVisible!==false},e,source,{});
    inherited=applyByBlockLineTypeInheritance(inherited,e,source);
    if(kind(inherited)==='ATTDEF'&&!(Number(inherited.attributeFlags||0)&2))continue;
    walk(inherited,matrix,[...path,name],depth+1);
   }
  }
  // ATTRIB positions are already in the parent coordinate system (not block-local).
  for(const attr of e.attribs||[])output.push(...transformedLeaves({...attr,isVisible:e.isVisible!==false&&attr.isVisible!==false},m));
 }
 for(const e of source.entities||[]){if(kind(e)==='ATTRIB'&&attributeHandles.has(e.handle))continue;walk(e,IDENTITY_MATRIX,[]);}
 report.expanded=output.length;
 issues.push(...residuals);
 const invalidSplines=output.filter(e=>e.fidelityIssue).length;
 if(invalidSplines)issues.push('Spline chưa dựng đúng: '+invalidSplines+' (không dùng đa giác điều khiển thay thế).');
 const types=new Set(output.map(kind));
 if(['OLE2FRAME','TOLERANCE','MULTILEADER','WIPEOUT'].some(t=>types.has(t)))issues.push('Còn đối tượng chuyên biệt cần đối chiếu CAD gốc: '+['OLE2FRAME','TOLERANCE','MULTILEADER','WIPEOUT'].filter(t=>types.has(t)).join(', '));
 if(report.missingDimensions)issues.push('DIM không có Block hình học: '+report.missingDimensions);
 if(report.missingBlocks)issues.push('INSERT thiếu Block: '+report.missingBlocks);
 if(report.cycles)issues.push('Block lồng không thể mở hết: '+report.cycles);
 return {document:{...source,entities:output,warnings:[...(source.warnings||[]),...issues],metadata:{...source.metadata,geometryPreparation:report}},report};
}
