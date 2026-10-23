import { CadViewer } from '@flyfish-dev/cad-viewer';
import { assessFidelity } from './fidelity.js';

const status = document.getElementById('status');
const host = document.getElementById('viewer');
const fitButton = document.getElementById('fit');
const filenameLabel = document.getElementById('filename');
const setStatus = message => { status.textContent = message; };
let viewer;
let selectedFile;
let loadedName = '';
let loading = false;
let backend = 'auto';
let lastResult;
let lastStats;
let originalDocument;
const fidelityPanel = document.getElementById('fidelity');
function updateFidelity() {
  if (!fidelityPanel) return;
  const result = assessFidelity(originalDocument, lastStats, viewer?.getMissingReferences() || []);
  fidelityPanel.hidden = !originalDocument;
  fidelityPanel.dataset.state = result.state;
  fidelityPanel.replaceChildren();
  const title = document.createElement('strong'); title.textContent = result.message;
  fidelityPanel.appendChild(title);
  if (result.issues.length) {
    const details = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = result.issues.length + ' mục cần kiểm tra';
    const list = document.createElement('ul');
    for (const issue of result.issues) { const li = document.createElement('li'); li.textContent = issue; list.appendChild(li); }
    details.append(summary, list); fidelityPanel.appendChild(details);
  }
}
const hiddenLayers = new Set();
let isolatedLayer = null;
let monochrome = false;
const CANVAS2D_MAX_BYTES = 8 * 1024 * 1024;
const CANVAS2D_MAX_PRIMITIVES = 12000;
const actionBar = document.querySelector('.toolbar');

// A lightweight layer inspector: no server upload and no DWG re-decoding.
const panel = document.createElement('aside');
panel.id = 'cad-layer-panel';
panel.hidden = true;
panel.style.cssText = 'position:absolute;right:8px;top:8px;bottom:8px;width:min(330px,90%);overflow:auto;background:#111b29f2;color:#e8eef8;border:1px solid #52637a;border-radius:9px;padding:12px;z-index:10;box-shadow:0 10px 40px #0008';
document.querySelector('.stage').appendChild(panel);
const layerButton = document.createElement('button');
layerButton.type = 'button';
layerButton.textContent = 'Layer / Lọc bản vẽ';
actionBar.appendChild(layerButton);
layerButton.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) renderLayerPanel(); });
const colorButton = document.createElement('button');
colorButton.type = 'button';
colorButton.textContent = 'Nét đơn sắc';
actionBar.appendChild(colorButton);
colorButton.addEventListener('click', () => {
  monochrome = !monochrome;
  viewer.setColorMode(monochrome ? 'monochrome' : 'source', '#e5edf7');
  colorButton.textContent = monochrome ? 'Màu layer gốc' : 'Nét đơn sắc';
  setStatus('Chế độ màu: ' + (monochrome ? 'đơn sắc' : 'theo bản DWG') + ' · ' + summaryText());
});


// Reference fonts are kept local to the browser; never uploaded to a server.
const fontLabel = document.createElement('label');
fontLabel.className = 'file-button';
fontLabel.textContent = 'Nạp font SHX';
fontLabel.title = 'Nạp font SHX gốc để khôi phục chữ và ký hiệu CAD';
const fontInput = document.createElement('input');
fontInput.type = 'file';
fontInput.accept = '.shx';
fontInput.multiple = true;
fontInput.style.display = 'none';
fontLabel.appendChild(fontInput);
actionBar.appendChild(fontLabel);
const detailButton = document.createElement('button');
detailButton.type = 'button';
detailButton.textContent = 'Kiểm tra DWG';
actionBar.appendChild(detailButton);
function diagnoseGeometry() {
  if (!lastResult) return 'Chưa mở DWG.';
  const types = Object.entries(lastResult.summary?.byType || {})
    .sort((a,b) => b[1]-a[1]).map(([k,v]) => k + ': ' + v).join(' · ');
  const missing = viewer.getMissingReferences();
  const refs = missing.length ? missing.map(x => x.fileName).join(', ') : 'không phát hiện';
  const unsupported = lastStats?.unsupported ? Object.entries(lastStats.unsupported).map(([k,v])=>k+': '+v).join(', ') : '';
  return 'Loại đối tượng: ' + (types || 'không rõ') +
    ' | Font SHX thiếu: ' + refs +
    ' | Đối tượng chưa hỗ trợ: ' + (unsupported || 'không báo cáo') +
    ' | Nét bị bỏ qua: ' + (lastStats?.skipped ?? 'chưa rõ');
}
detailButton.addEventListener('click', () => {
  const info = diagnoseGeometry();
  setStatus(info);
  console.info('DWG geometry audit', info, lastResult?.summary, viewer.getReferenceState(), lastStats);
});
fontInput.addEventListener('change', async () => {
  if (loading) return;
  const files = Array.from(fontInput.files || []);
  let ok = 0;
  const errors = [];
  for (const file of files) {
    try { await viewer.addReferenceFile(file); ok++; }
    catch (error) { errors.push(file.name + ': ' + error.message); }
  }
  setStatus('Đã nạp ' + ok + '/' + files.length + ' font SHX. ' + (errors.join(' · ') || '') +
    ' ' + diagnoseGeometry());
  fontInput.value = '';
  updateFidelity();
});


function auditCadGeometry(doc) {
  const blocks = doc?.blocks || {};
  const counts = Object.create(null);
  const missingBlocks = new Map();
  const nonUniform = [];
  const missingGeometry = [];
  const cycles = [];
  const visited = new Set();
  let insertCount = 0;
  const walk = (entities, trail, depth) => {
    if (depth > 20) { cycles.push('Vượt 20 cấp: ' + trail.join(' > ')); return; }
    for (const entity of entities || []) {
      const type = String(entity.type || entity.kind || 'UNKNOWN').toUpperCase();
      counts[type] = (counts[type] || 0) + 1;
      if (type === 'DIMENSION' && !entity.blockName && !entity.name) missingGeometry.push('DIMENSION ' + (entity.handle || entity.id || 'không ID'));
      if (entity.kind !== 'insert' && type !== 'INSERT' && type !== 'MINSERT') continue;
      insertCount++;
      const name = entity.blockName || entity.name;
      if (!name || !blocks[name]) {
        missingBlocks.set(String(name || '(không tên)'), (missingBlocks.get(String(name || '(không tên)')) || 0) + 1);
        continue;
      }
      const scale = entity.scale || {};
      const sx = Number(scale.x ?? entity.scaleX ?? 1), sy = Number(scale.y ?? entity.scaleY ?? 1);
      if (Math.abs(Math.abs(sx) - Math.abs(sy)) > 1e-7 && nonUniform.length < 100) {
        nonUniform.push({ block: name, scaleX: sx, scaleY: sy, handle: entity.handle || '' });
      }
      if (trail.includes(name)) { cycles.push([...trail,name].join(' > ')); continue; }
      // Avoid exploding counts on repeated furniture instances; audit each definition once.
      if (!visited.has(name)) {
        visited.add(name);
        walk(blocks[name].entities, [...trail,name], depth+1);
      }
    }
  };
  walk(doc?.entities || [], [], 0);
  return { topLevelEntities: doc?.entities?.length || 0, definedBlocks: Object.keys(blocks).length,
    referencedBlocks: visited.size, inserts: insertCount,
    types: Object.fromEntries(Object.entries(counts).sort((a,b)=>b[1]-a[1])),
    missingBlocks: Object.fromEntries(missingBlocks), nonUniformScales: nonUniform,
    cycles: cycles.slice(0,30), dimensionWithoutGraphicsReference: missingGeometry.slice(0,50),
    render: lastStats ? { total: lastStats.total, drawn: lastStats.drawn,
      skipped: lastStats.skipped, unsupported: lastStats.unsupported } : null };
}
const auditButton = document.createElement('button');
auditButton.type = 'button';
auditButton.textContent = 'Phân tích block / DIM';
actionBar.appendChild(auditButton);
auditButton.addEventListener('click', () => {
  if (!originalDocument) { setStatus('Mở bản DWG trước khi phân tích.'); return; }
  const audit = auditCadGeometry(originalDocument);
  const missing = Object.keys(audit.missingBlocks).length;
  setStatus('BLOCK: ' + audit.definedBlocks + ' định nghĩa, ' + audit.inserts +
    ' lượt INSERT đã kiểm tra · Thiếu block: ' + missing +
    ' · Scale X/Y khác nhau: ' + audit.nonUniformScales.length +
    ' · DIM thiếu tham chiếu hình học: ' + audit.dimensionWithoutGraphicsReference.length +
    ' · Chu trình block: ' + audit.cycles.length +
    '. Chi tiết trong bảng kiểm tra.');
  panel.hidden = false;
  panel.replaceChildren();
  const h = document.createElement('h3'); h.textContent = 'Kiểm tra độ chính xác DWG'; panel.appendChild(h);
  const pre = document.createElement('pre');
  pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 monospace';
  pre.textContent = JSON.stringify(audit,null,2);
  panel.appendChild(pre);
  console.info('HOANGGIA CAD AI fidelity audit', audit);
});

const fallbackButton = document.createElement('button');
fallbackButton.type = 'button';
fallbackButton.textContent = 'Canvas2D (chỉ file nhỏ)';
fallbackButton.title = 'Canvas2D có thể treo trình duyệt với DWG nhiều nét; file lớn sẽ bị chặn';
actionBar.appendChild(fallbackButton);

function createViewer(mode) {
  if (viewer) viewer.destroy();
  host.replaceChildren();
  lastStats = undefined;
  viewer = new CadViewer({
    container: host,
    wasmPath: new URL('./wasm/', document.baseURI).href,
    workerUrl: new URL('./wasm/dwg-worker.js', document.baseURI).href,
    renderer: mode,
    canvasOptions: { fitMode: 'auto', background: '#0b1120' },
    onRenderStats: stats => { lastStats = stats; if (originalDocument) updateFidelity(); },
    onLoadProgress: progress => {
      if (loading) setStatus((progress.message || progress.phase || 'Đang đọc bản vẽ') +
        (progress.percent == null ? '' : ' · ' + progress.percent + '%'));
    }
  });
}


function layerNames() {
  return Object.keys(originalDocument?.layers || {}).sort((a,b)=>a.localeCompare(b,'vi'));
}
function applyLayerFilter() {
  if (!originalDocument || !lastResult || loading) return;
  // Preserve original parser data and the current zoom/pan. Only alter visibility
  // on a shallow render copy; never mutate the source DWG document.
  const currentView = viewer.renderer.getViewState();
  const layers = Object.fromEntries(Object.entries(originalDocument.layers || {}).map(([name, layer]) => [
    name, { ...layer, isVisible: layer.isVisible !== false &&
      !hiddenLayers.has(name) && (!isolatedLayer || isolatedLayer === name) }
  ]));
  const document = { ...originalDocument, layers };
  viewer.setDocument(document, loadedName);
  viewer.renderer.setViewState(currentView);
  // setDocument returns a new load result, but the source remains the untouched DWG.
  setStatus('Đã áp dụng bộ lọc layer (không thay đổi file gốc). ' + summaryText());
}
function renderLayerPanel() {
  panel.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = 'LAYER · ' + layerNames().length;
  heading.style.margin = '0 0 10px';
  panel.appendChild(heading);
  if (!originalDocument) {
    const message = document.createElement('p');
    message.textContent = 'Hãy mở DWG trước.';
    panel.appendChild(message);
    return;
  }
  const reset = document.createElement('button');
  reset.textContent = 'Hiện tất cả / Bỏ cô lập';
  reset.addEventListener('click', () => {
    hiddenLayers.clear(); isolatedLayer = null;
    applyLayerFilter(); renderLayerPanel();
  });
  panel.appendChild(reset);
  const filter = document.createElement('input');
  filter.type = 'search';
  filter.placeholder = 'Tìm layer…';
  filter.style.cssText = 'display:block;width:100%;margin:10px 0;padding:8px;background:#273547;color:white;border:1px solid #53647b;border-radius:6px';
  panel.appendChild(filter);
  const list = document.createElement('div');
  panel.appendChild(list);
  const names = layerNames();
  function paint() {
    list.replaceChildren();
    for (const name of names.filter(n=>n.toLowerCase().includes(filter.value.toLowerCase()))) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid #344354';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !hiddenLayers.has(name);
      checkbox.style.display = 'inline-block';
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) hiddenLayers.delete(name); else hiddenLayers.add(name);
        applyLayerFilter();
      });
      const title = document.createElement('span');
      title.textContent = name;
      title.title = name;
      title.style.cssText = 'flex:1;overflow-wrap:anywhere;font-size:12px';
      const solo = document.createElement('button');
      solo.textContent = isolatedLayer === name ? 'Bỏ lọc' : 'Chỉ lớp';
      solo.style.padding = '5px';
      solo.addEventListener('click', () => {
        isolatedLayer = isolatedLayer === name ? null : name;
        applyLayerFilter(); paint();
      });
      row.append(checkbox,title,solo);
      list.appendChild(row);
    }
  }
  filter.addEventListener('input', paint);
  paint();
}

function summaryText() {
  if (!lastResult) return 'Chưa có kết quả phân tích.';
  const doc = lastResult.document;
  const summary = lastResult.summary;
  const count = doc?.entities?.length ?? 0;
  const blocks = doc?.blocks?.length ?? Object.keys(doc?.blocks ?? {}).length;
  const layers = doc?.layers?.length ?? Object.keys(doc?.layers ?? {}).length;
  const warnings = (lastResult.warnings || []).length;
  const missingFonts = viewer.getMissingReferences().length;
  const drawn = lastStats ? ' · Nét dựng: ' + (lastStats.drawn ?? '?') +
    '/' + (lastStats.total ?? '?') + ' (' + (lastStats.backend ?? backend) + ')' : '';
  return 'Đối tượng: ' + count + ' · Block: ' + blocks +
    ' · Layer: ' + layers + ' · Cảnh báo: ' + warnings +
    ' · Thiếu SHX: ' + missingFonts + drawn;
}

function canvasText() {
  const canvases = [...host.querySelectorAll('canvas')];
  return 'Canvas: ' + (canvases.map(c => c.width + '×' + c.height).join(', ') || 'không có');
}

function fitDrawing(mode = 'auto') {
  if (!lastResult) {
    setStatus('Chưa tải bản vẽ. Hãy mở DWG / DXF.');
    return;
  }
  try {
    viewer.resize();
    viewer.fit(mode);
    setStatus('Vừa khung ' + mode + ' · ' + summaryText() + ' · ' + canvasText());
  } catch (error) {
    setStatus('Lỗi vừa khung: ' + (error?.message || String(error)) + ' · ' + summaryText());
    console.error(error);
  }
}

async function loadDrawing(file) {
  if (!file || loading) return;
  selectedFile = file;
  loadedName = '';
  lastResult = undefined;
  originalDocument = undefined;
  lastStats = undefined;
  updateFidelity();
  hiddenLayers.clear();
  isolatedLayer = null;
  loading = true;
  fitButton.disabled = true;
  fallbackButton.disabled = true;
  filenameLabel.textContent = file.name;
  setStatus('Đang giải mã ' + file.name + ' (' + (file.size / 1048576).toFixed(1) + ' MB)…');
  try {
    const result = await viewer.loadFile(file);
    lastResult = result;
    originalDocument = result.document;
    loadedName = file.name;
    if (!panel.hidden) renderLayerPanel();
    // The CAD canvas is inside a responsive workspace; ensure its final size is applied.
    viewer.resize();
    viewer.fit('auto');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    updateFidelity();
    setStatus('Đã giải mã, chưa xác nhận chính xác: ' + file.name + ' · ' + summaryText() + ' · ' + canvasText() +
      '. Đang ở chế độ xem thử; cần đối chiếu CAD gốc vì block, hatch, text hoặc nét có thể chưa hiển thị chính xác.');
    console.info('CAD drawing diagnostics', { summary: result.summary, warnings: result.warnings, render: lastStats });
  } catch (error) {
    setStatus('Không thể đọc/dựng DWG: ' + (error?.message || String(error)) + ' · ' + canvasText());
    console.error('CAD load failed', error);
  } finally {
    loading = false;
    fitButton.disabled = false;
    fallbackButton.disabled = Boolean(selectedFile && (selectedFile.size > CANVAS2D_MAX_BYTES || (lastStats?.total ?? 0) > CANVAS2D_MAX_PRIMITIVES)) && backend !== 'canvas2d';
    fallbackButton.title = fallbackButton.disabled ? 'DWG lớn: khóa Canvas2D để tránh treo máy. Dùng WebGL.' : 'Chuyển bộ dựng hình';
  }
}

createViewer(backend);
document.getElementById('file').addEventListener('change', event => loadDrawing(event.target.files?.[0]));
fitButton.addEventListener('click', () => fitDrawing('auto'));
document.getElementById('fit-secondary').addEventListener('click', () => fitDrawing('extents'));
document.getElementById('fit-secondary').textContent = 'Toàn bộ đối tượng';
fitButton.textContent = 'Vừa nội dung';

fallbackButton.addEventListener('click', async () => {
  if (loading) return;
  if (backend !== 'canvas2d' && selectedFile && (selectedFile.size > CANVAS2D_MAX_BYTES || (lastStats?.total ?? 0) > CANVAS2D_MAX_PRIMITIVES)) {
    setStatus('Đã chặn Canvas2D để bảo vệ thiết bị: bản vẽ quá lớn hoặc có quá nhiều nét. Dùng WebGL. ' + summaryText());
    return;
  }
  backend = backend === 'canvas2d' ? 'auto' : 'canvas2d';
  fallbackButton.textContent = backend === 'canvas2d' ? 'Trở về WebGL' : 'Canvas2D (chỉ file nhỏ)';
  createViewer(backend);
  if (selectedFile) await loadDrawing(selectedFile);
  else setStatus('Đã chuyển sang ' + backend + '. Hãy mở bản vẽ.');
});

const toolbarButtons = [...actionBar.querySelectorAll('button')];
const zoomIn = toolbarButtons.find(button => button.textContent.includes('Phóng to'));
const zoomOut = toolbarButtons.find(button => button.textContent.includes('Thu nhỏ'));
for (const [button, direction] of [[zoomIn, 'in'], [zoomOut, 'out']]) {
  if (!button) continue;
  button.disabled = false;
  button.title = direction === 'in' ? 'Phóng to bản vẽ' : 'Thu nhỏ bản vẽ';
  button.addEventListener('click', () => {
    if (!lastResult) return setStatus('Hãy mở bản vẽ trước khi phóng to / thu nhỏ.');
    try {
      if (direction === 'in') viewer.zoomIn(); else viewer.zoomOut();
      setStatus('Zoom ' + viewer.getZoomPercent().toFixed(1) + '% · ' + summaryText());
    } catch (error) { setStatus('Lỗi zoom: ' + error.message); }
  });
}


/* Quick CAD command line: view/navigation only until editable geometry is validated.
   Do not claim destructive AutoCAD commands are implemented. */
const commandWrap = document.createElement('div');
commandWrap.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:#101923;border-top:1px solid #526176';
const commandPrompt = document.createElement('span');
commandPrompt.textContent = 'Lệnh CAD ›';
commandPrompt.style.cssText = 'white-space:nowrap;color:#d9b879;font-weight:700';
const commandInput = document.createElement('input');
commandInput.type = 'text';
commandInput.placeholder = 'Nhập Z, ZE, ZA, LA, AUDIT, HELP…';
commandInput.setAttribute('aria-label','Dòng lệnh CAD');
commandInput.style.cssText = 'flex:1;min-width:0;background:#202d3c;border:1px solid #526176;color:white;border-radius:6px;padding:9px;font:14px monospace';
commandWrap.append(commandPrompt, commandInput);
document.getElementById('status').before(commandWrap);
const commandHistory = [];
let historyIndex = 0;
const commandHelp = 'Lệnh đã hỗ trợ: Z / ZOOM (phóng to), ZO (thu nhỏ), ZE (vừa nội dung), ZA (toàn bộ), LA (layer), AUDIT (kiểm tra DWG), COLOR (màu nét), HELP (trợ giúp). Lệnh chỉnh sửa L/M/CO/TR chưa hỗ trợ; không làm thay đổi DWG gốc.';
function executeCadCommand(raw) {
  const cmd = String(raw || '').trim().toUpperCase();
  if (!cmd) return;
  commandHistory.push(cmd);
  historyIndex = commandHistory.length;
  if (cmd === 'HELP' || cmd === '?' || cmd === 'H') return setStatus(commandHelp);
  if (cmd === 'LA' || cmd === 'LAYER') { panel.hidden = false; renderLayerPanel(); return setStatus('Đã mở danh sách layer.'); }
  if (cmd === 'AUDIT') { auditButton.click(); return; }
  if (cmd === 'COLOR') { colorButton.click(); return; }
  if (!lastResult) return setStatus('Hãy mở DWG/DXF trước. ' + commandHelp);
  if (cmd === 'Z' || cmd === 'ZOOM' || cmd === '+') viewer.zoomIn();
  else if (cmd === 'ZO' || cmd === '-') viewer.zoomOut();
  else if (cmd === 'ZE' || cmd === 'FIT') return fitDrawing('auto');
  else if (cmd === 'ZA' || cmd === 'EXTENTS') return fitDrawing('extents');
  else return setStatus('Lệnh ' + cmd + ' chưa được triển khai. ' + commandHelp);
  setStatus('Đã thực hiện ' + cmd + ' · Zoom ' + viewer.getZoomPercent().toFixed(1) + '%');
}
commandInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    const command = commandInput.value;
    commandInput.value = '';
    try { executeCadCommand(command); } catch (error) { setStatus('Lỗi lệnh: ' + error.message); }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex-1);
    commandInput.value = commandHistory[historyIndex] || '';
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    historyIndex = Math.min(commandHistory.length, historyIndex+1);
    commandInput.value = commandHistory[historyIndex] || '';
  } else if (event.key === 'Escape') commandInput.value = '';
});
document.addEventListener('keydown', event => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
  if (event.key === ':' || event.key === '/') { event.preventDefault(); commandInput.focus(); }
});


/* Platform-specific controls share the same viewer, without reloading the DWG. */
const deviceDock = document.querySelector('.device-dock');
const platformQuery = window.matchMedia('(max-width:699px)');
function updatePlatform() {
  const mobile = platformQuery.matches;
  document.body.dataset.platform = mobile ? 'mobile' :
    window.matchMedia('(max-width:1099px), (pointer:coarse)').matches ? 'tablet' : 'desktop';
  // Keep the command bar accessible but not covering the phone's drawing by default.
  commandWrap.hidden = mobile && document.activeElement !== commandInput;
  commandWrap.style.display = commandWrap.hidden ? 'none' : 'flex';
  requestAnimationFrame(() => { try { viewer?.resize(); } catch (error) { console.warn(error); } });
}
deviceDock?.addEventListener('click', event => {
  const action = event.target.closest('[data-cad-action]')?.dataset.cadAction;
  if (!action) return;
  if (action === 'command') {
    commandWrap.hidden = false;
    commandWrap.style.display = 'flex';
    commandInput.focus();
    return;
  }
  if (action === 'layers') { layerButton.click(); return; }
  if (!lastResult) return setStatus('Hãy mở DWG trước.');
  try {
    if (action === 'zoom-in') viewer.zoomIn();
    else if (action === 'zoom-out') viewer.zoomOut();
    else if (action === 'fit') fitDrawing('auto');
    if (action !== 'fit') setStatus('Zoom ' + viewer.getZoomPercent().toFixed(1) + '% · ' + summaryText());
  } catch (error) { setStatus('Lỗi thao tác: ' + error.message); }
});
commandInput.addEventListener('blur', () => {
  if (platformQuery.matches) {
    commandWrap.hidden = true;
    commandWrap.style.display = 'none';
    requestAnimationFrame(() => viewer?.resize());
  }
});
window.addEventListener('resize', updatePlatform);
window.addEventListener('orientationchange', updatePlatform);
updatePlatform();

window.addEventListener('resize', () => {
  if (!viewer) return;
  try { viewer.resize(); } catch (error) { console.warn('Resize CAD viewer failed', error); }
});

/* Studio task navigation: progressive disclosure, reuse existing working actions. */
const studioDrawer = document.getElementById('studio-drawer');
const studioBody = document.getElementById('studio-drawer-body');
const studioTitle = document.getElementById('studio-drawer-title');
const studioNav = document.querySelector('.studio-nav');
const studioClose = () => {
  studioDrawer.hidden = true;
  studioNav.querySelectorAll('[data-studio]').forEach(b => b.classList.toggle('active', b.dataset.studio === 'view'));
  requestAnimationFrame(() => viewer?.resize());
};
document.getElementById('studio-drawer-close').addEventListener('click', studioClose);
const makeTool = (label, callback) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', callback);
  return b;
};
function showStudioDrawer(mode) {
  studioBody.replaceChildren();
  studioTitle.textContent = mode === 'tools' ? 'Công cụ bản vẽ' : 'Kiểm tra kỹ thuật';
  const description = document.createElement('p');
  description.textContent = mode === 'tools'
    ? 'Các thao tác thường dùng khi xem DWG. Bản vẽ gốc không bị thay đổi.'
    : 'Thông tin chuyên sâu chỉ mở khi cần kiểm tra lỗi hiển thị.';
  studioBody.appendChild(description);
  if (mode === 'tools') {
    studioBody.append(
      makeTool('＋ Phóng to', () => { if (lastResult) viewer.zoomIn(); else setStatus('Hãy mở DWG trước.'); }),
      makeTool('− Thu nhỏ', () => { if (lastResult) viewer.zoomOut(); else setStatus('Hãy mở DWG trước.'); }),
      makeTool('⌗ Vừa nội dung', () => fitButton.click()),
      makeTool('◐ Đổi màu nét', () => colorButton.click()),
      makeTool('⌘ Dòng lệnh CAD', () => { commandWrap.hidden=false; commandWrap.style.display='flex'; commandInput.focus(); })
    );
  } else {
    studioBody.append(
      makeTool('Kiểm tra đối tượng DWG', () => detailButton.click()),
      makeTool('Phân tích block và DIM', () => auditButton.click())
    );
    // Move the real file input label; preserves the change handler.
    studioBody.appendChild(fontLabel);
    if (fallbackButton && !fallbackButton.disabled) studioBody.appendChild(fallbackButton);
  }
  studioDrawer.hidden = false;
  studioNav.querySelectorAll('[data-studio]').forEach(b => b.classList.toggle('active', b.dataset.studio === mode));
}
studioNav.addEventListener('click', event => {
  const mode = event.target.closest('[data-studio]')?.dataset.studio;
  if (!mode) return;
  if (mode === 'fit') { fitButton.click(); return; }
  if (mode === 'view') { panel.hidden = true; studioClose(); return; }
  if (mode === 'layers') {
    studioClose();
    panel.hidden = false;
    renderLayerPanel();
    studioNav.querySelector('[data-studio="layers"]').classList.add('active');
    return;
  }
  panel.hidden = true;
  showStudioDrawer(mode);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !studioDrawer.hidden) studioClose();
});
// Hide the original diagnostic controls without removing their event listeners.

window.addEventListener('error', event => {
  if (loadedName) setStatus('Lỗi trình duyệt: ' + event.message + ' · ' + summaryText());
});
window.addEventListener('unhandledrejection', event => {
  if (loadedName) setStatus('Lỗi xử lý: ' + (event.reason?.message || String(event.reason)) + ' · ' + summaryText());
});

// Public fixture uses the exact same file-loading pipeline as local files.
const sampleButton = document.getElementById('sample-dwg');
sampleButton.addEventListener('click', async () => {
  if (loading) return;
  sampleButton.disabled = true;
  try {
    const response = await fetch(new URL('./samples/sample_2018.dwg', document.baseURI));
    if (!response.ok) throw new Error('Không tải được bản vẽ mẫu: HTTP ' + response.status);
    await loadDrawing(new File([await response.arrayBuffer()], 'sample_2018.dwg'));
  } catch (error) { setStatus(error.message); }
  finally { sampleButton.disabled = false; }
});
// Re-selecting the same file retries parsing after a failed load.
document.getElementById('file').addEventListener('click', event => { event.target.value = ''; });
