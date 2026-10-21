import { CadViewer } from '@flyfish-dev/cad-viewer';

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
const actionBar = document.querySelector('.toolbar');

const fallbackButton = document.createElement('button');
fallbackButton.type = 'button';
fallbackButton.textContent = 'Thử Canvas2D';
fallbackButton.title = 'Đổi công nghệ dựng hình khi WebGL không hiển thị nét vẽ';
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
    onRenderStats: stats => { lastStats = stats; },
    onLoadProgress: progress => {
      if (loading) setStatus((progress.message || progress.phase || 'Đang đọc bản vẽ') +
        (progress.percent == null ? '' : ' · ' + progress.percent + '%'));
    }
  });
}

function summaryText() {
  if (!lastResult) return 'Chưa có kết quả phân tích.';
  const doc = lastResult.document;
  const summary = lastResult.summary;
  const count = doc?.entities?.length ?? 0;
  const blocks = doc?.blocks?.length ?? Object.keys(doc?.blocks ?? {}).length;
  const layers = doc?.layers?.length ?? Object.keys(doc?.layers ?? {}).length;
  const warnings = (lastResult.warnings || []).length;
  const drawn = lastStats ? ' · Nét dựng: ' + (lastStats.drawn ?? '?') +
    '/' + (lastStats.total ?? '?') + ' (' + (lastStats.backend ?? backend) + ')' : '';
  return 'Đối tượng: ' + count + ' · Block: ' + blocks +
    ' · Layer: ' + layers + ' · Cảnh báo: ' + warnings + drawn;
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
  loading = true;
  fitButton.disabled = true;
  fallbackButton.disabled = true;
  filenameLabel.textContent = file.name;
  setStatus('Đang giải mã ' + file.name + ' (' + (file.size / 1048576).toFixed(1) + ' MB)…');
  try {
    const result = await viewer.loadFile(file);
    lastResult = result;
    loadedName = file.name;
    // The CAD canvas is inside a responsive workspace; ensure its final size is applied.
    viewer.resize();
    viewer.fit('auto');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    setStatus('Đã phân tích ' + file.name + ' · ' + summaryText() + ' · ' + canvasText() +
      '. Nếu hình quá nhỏ, bấm Vừa nội dung; Toàn bộ đối tượng có thể bao gồm nét nằm xa.');
    console.info('CAD drawing diagnostics', { summary: result.summary, warnings: result.warnings, render: lastStats });
  } catch (error) {
    setStatus('Không thể đọc/dựng DWG: ' + (error?.message || String(error)) + ' · ' + canvasText());
    console.error('CAD load failed', error);
  } finally {
    loading = false;
    fitButton.disabled = false;
    fallbackButton.disabled = false;
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
  backend = backend === 'canvas2d' ? 'auto' : 'canvas2d';
  fallbackButton.textContent = backend === 'canvas2d' ? 'Thử WebGL' : 'Thử Canvas2D';
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

window.addEventListener('resize', () => {
  if (!viewer) return;
  try { viewer.resize(); } catch (error) { console.warn('Resize CAD viewer failed', error); }
});
window.addEventListener('error', event => {
  if (loadedName) setStatus('Lỗi trình duyệt: ' + event.message + ' · ' + summaryText());
});
window.addEventListener('unhandledrejection', event => {
  if (loadedName) setStatus('Lỗi xử lý: ' + (event.reason?.message || String(event.reason)) + ' · ' + summaryText());
});
