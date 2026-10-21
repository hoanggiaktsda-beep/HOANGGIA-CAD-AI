import { CadViewer } from '@flyfish-dev/cad-viewer';

const status = document.getElementById('status');
const host = document.getElementById('viewer');
const fitButton = document.getElementById('fit');
const setStatus = message => { status.textContent = message; };
let loadedName = '';
let loadInProgress = false;

const viewer = new CadViewer({
  container: host,
  wasmPath: new URL('./wasm/', document.baseURI).href,
  workerUrl: new URL('./wasm/dwg-worker.js', document.baseURI).href,
  renderer: 'auto',
  canvasOptions: { fitMode: 'auto' },
  onLoadProgress: progress => {
    if (!loadInProgress) return;
    setStatus((progress.message || progress.phase || 'Đang đọc bản vẽ') +
      (progress.percent == null ? '' : ' · ' + progress.percent + '%'));
  }
});

function diagnoseCanvas() {
  const canvases = [...host.querySelectorAll('canvas')];
  if (!canvases.length) return 'Không tìm thấy canvas dựng hình.';
  const sizes = canvases.map(c => c.width + '×' + c.height).join(', ');
  const valid = canvases.some(c => c.width > 0 && c.height > 0);
  return valid ? 'Canvas: ' + sizes + '. Nếu màn hình trống, có thể lỗi dựng hình hoặc nội dung bản vẽ.' :
    'Canvas chưa có kích thước: ' + sizes + '.';
}

function fitDrawing() {
  if (!loadedName) {
    setStatus('Chưa có bản vẽ được tải. Hãy mở DWG/DXF trước.');
    return;
  }
  try {
    viewer.fit('auto');
    setStatus('Đã yêu cầu vừa khung cho ' + loadedName + '. ' + diagnoseCanvas() +
      ' Nút Vừa khung không phải lựa chọn tỷ lệ 1:50 / 1:100.');
  } catch (error) {
    setStatus('Lỗi vừa khung: ' + (error?.message || String(error)) + '. ' + diagnoseCanvas());
    console.error('CAD fit failed', error);
  }
}

document.getElementById('file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  loadedName = '';
  loadInProgress = true;
  fitButton.disabled = true;
  setStatus('Đang đọc ' + file.name + ' (' + (file.size / 1048576).toFixed(1) + ' MB)…');
  try {
    await viewer.loadFile(file);
    loadedName = file.name;
    setStatus('Đã xử lý ' + file.name + '. ' + diagnoseCanvas() +
      ' Chưa thể xác nhận hình học đã hiển thị; hãy thử Vừa khung.');
  } catch (error) {
    setStatus('Không đọc được file: ' + (error?.message || String(error)) + '. ' + diagnoseCanvas());
    console.error('CAD load failed', error);
  } finally {
    loadInProgress = false;
    fitButton.disabled = false;
  }
});

fitButton.addEventListener('click', fitDrawing);
document.getElementById('fit-secondary').addEventListener('click', fitDrawing);
document.getElementById('file').addEventListener('change', event => { const name = event.target.files?.[0]?.name; if (name) document.getElementById('filename').textContent = name; });
window.addEventListener('error', event => {
  if (loadedName) setStatus('Lỗi trình duyệt: ' + event.message + '. ' + diagnoseCanvas());
});
window.addEventListener('unhandledrejection', event => {
  if (loadedName) setStatus('Lỗi xử lý bản vẽ: ' +
    (event.reason?.message || String(event.reason)) + '. ' + diagnoseCanvas());
});
