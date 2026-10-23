export function familyForFont(file){
 const name=String(file||'').split(/[\\/]/).pop().replace(/\.(ttf|otf|woff2?|shx)$/i,'');
 if(!name)return null;
 const standard={arial:'Arial',arialbd:'Arial',ariali:'Arial',arialbi:'Arial',times:'Times New Roman',timesbd:'Times New Roman',timesi:'Times New Roman',timesbi:'Times New Roman',segoeui:'Segoe UI',segoeuil:'Segoe UI',calibri:'Calibri',calibril:'Calibri',tahoma:'Tahoma',verdana:'Verdana',cour:'Courier New'};
 return standard[name.toLowerCase()]||name;
}
export function textFontCss(file){
 if(!file||! /\.(ttf|otf|woff2?)$/i.test(file))return null;
 const family=familyForFont(file);
 if(!family)return null;
 const base=String(file).split(/[\\/]/).pop().toLowerCase();
 const bold=/^(arial|times)(bd|bi)/.test(base);
 const italic=/^(arial|times)(i|bi)\./.test(base);
 const light=/^(segoeuil|calibril)\./.test(base);
 const prefix=(italic?'italic ':'')+(bold?'bold ':light?'300 ':'');
 return {family,css:JSON.stringify(family)+', sans-serif',prefix};
}
