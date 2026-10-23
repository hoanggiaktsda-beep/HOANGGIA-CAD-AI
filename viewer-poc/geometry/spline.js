// Evaluate authored rational B-spline data with de Boor; never draw a control polygon as the curve.
export function splinePoint(entity,u){
 const p=entity.degree,P=entity.controlPoints,U=entity.knots,n=P.length-1;
 let k=n;
 if(u<U[n+1]){k=p;while(k<n&&u>=U[k+1])k++;}
 const d=[];
 for(let j=0;j<=p;j++){
  const i=k-p+j,w=entity.weights?.[i]??1;
  d.push([P[i].x*w,P[i].y*w,(P[i].z||0)*w,w]);
 }
 for(let r=1;r<=p;r++)for(let j=p;j>=r;j--){
  const i=k-p+j,den=U[i+p-r+1]-U[i],a=den?(u-U[i])/den:0;
  d[j]=d[j].map((v,c)=>(1-a)*d[j-1][c]+a*v);
 }
 const v=d[p];return {x:v[0]/v[3],y:v[1]/v[3],z:v[2]/v[3]};
}
export function splinePolyline(entity,tolerance=.02){
 const p=Number(entity.degree),P=entity.controlPoints,U=entity.knots;
 if(!Number.isInteger(p)||p<1||!P||P.length<=p||!U||U.length!==P.length+p+1||U.some((v,i)=>!Number.isFinite(v)||(i&&v<U[i-1]))||P.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))return null;
 if(entity.weights&&(entity.weights.length!==P.length||entity.weights.some(w=>!Number.isFinite(w)||w<=0)))return null;
 const start=U[p],end=U[P.length];if(!(end>start))return null;
 const points=[];let limited=false;
 function subdivide(a,b,A,B,depth){
  const t=(a+b)/2,M=splinePoint(entity,t),q1=splinePoint(entity,(3*a+b)/4),q3=splinePoint(entity,(a+3*b)/4);
  const error=(Q,f)=>Math.hypot(Q.x-(A.x+(B.x-A.x)*f),Q.y-(A.y+(B.y-A.y)*f));
  const deviation=Math.max(error(M,.5),error(q1,.25),error(q3,.75));
  if(deviation>tolerance&&depth<16&&points.length<8192){subdivide(a,t,A,M,depth+1);subdivide(t,b,M,B,depth+1);}
  else {if(deviation>tolerance)limited=true;points.push(B);}
 }
 points.push(splinePoint(entity,start));
 for(let i=p;i<P.length;i++)if(U[i+1]>U[i])subdivide(U[i],U[i+1],splinePoint(entity,U[i]),splinePoint(entity,U[i+1]),0);
 return {points,limited};
}
