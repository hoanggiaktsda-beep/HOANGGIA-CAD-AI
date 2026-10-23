// A parser/render audit is diagnostic evidence, never an AutoCAD fidelity certificate.
export function assessFidelity(document, stats, references = []) {
  const issues = [];
  if (!document) return { state: 'empty', issues, message: 'Chưa mở bản vẽ.' };
  const blocks = Array.isArray(document.blocks)
    ? Object.fromEntries(document.blocks.map(b => [b.name, b])) : document.blocks || {};
  const visited = new Set();
  const missing = new Set();
  let distorted = false, mirrored = false, cycles = false;
  function walk(entities, path = []) {
    for (const e of entities || []) {
      const type = String(e.type || '').toUpperCase();
      if (e.kind !== 'insert' && !['INSERT', 'MINSERT'].includes(type)) continue;
      const name = e.blockName || e.name;
      const block = blocks[name];
      if (!block) { missing.add(name || '(không tên)'); continue; }
      const sx = Number(e.scale?.x ?? e.scaleX ?? 1);
      const sy = Number(e.scale?.y ?? e.scaleY ?? sx);
      if (!Number.isFinite(sx) || !Number.isFinite(sy) || Math.abs(sx) < 1e-14 || Math.abs(sy) < 1e-14) {
        issues.push('Block có tỷ lệ suy biến: ' + name);
      }
      if (Math.abs(Math.abs(sx) - Math.abs(sy)) > 1e-7) distorted = true;
      if (sx * sy < 0) mirrored = true;
      if (path.includes(name) || path.length > 32) { cycles = true; continue; }
      if (!visited.has(name)) { visited.add(name); walk(block.entities, [...path, name]); }
    }
  }
  walk(document.entities);
  if (missing.size) issues.push('Thiếu định nghĩa Block: ' + [...missing].join(', '));
  if (distorted) issues.push('Block scale X/Y khác nhau: đường cong có nguy cơ bị dựng xấp xỉ.');
  if (mirrored) issues.push('Block đối xứng: cần đối chiếu chiều cung và chữ.');
  if (cycles) issues.push('Block lồng có chu trình hoặc vượt giới hạn duyệt.');
  if (references.length) issues.push('Thiếu tham chiếu/font: ' + references.map(r => r.fileName || r.name || 'không rõ').join(', '));
  const unsupported = Object.entries(stats?.unsupported || {}).filter(([, n]) => n > 0);
  if (unsupported.length) issues.push('Chưa hỗ trợ: ' + unsupported.map(([k, n]) => k + ' (' + n + ')').join(', '));
  if (stats?.skipped > 0) issues.push('Bộ dựng hình bỏ qua ' + stats.skipped + ' đối tượng; cần kiểm tra nguyên nhân.');
  for (const warning of document.warnings || []) issues.push(String(warning));
  if (!document.entities?.length) issues.push('Không có đối tượng Model Space; chưa xác minh nội dung Layout.');
  if (!stats || !(stats.total > 0)) issues.push('Chưa có thống kê dựng hình để kiểm tra.');
  const state = issues.length ? 'risk' : 'unverified';
  return { state, issues: [...new Set(issues)], message: issues.length
    ? 'CÓ NGUY CƠ HIỂN THỊ SAI / THIẾU — chưa đạt yêu cầu chính xác.'
    : 'CHƯA ĐỐI CHIẾU AUTOCAD — giải mã được không đồng nghĩa bản vẽ chính xác.' };
}
