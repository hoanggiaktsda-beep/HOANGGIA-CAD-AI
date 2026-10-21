# HOANGGIA CAD AI — DWG WASM proof of concept

Thử nghiệm độc lập, **chưa triển khai** lên website chính. Mục tiêu đọc DWG/DXF trực tiếp trên iPhone bằng LibreDWG WebAssembly, không API trả phí và không gửi bản vẽ khách hàng lên server.

## Chạy thử
1. `cd viewer-poc && npm install`
2. `npm run dev`
3. Mở trình duyệt và chọn DWG. Bản vẽ lớn (ví dụ 10A.dwg ~114 MB) có thể vượt RAM iPhone.

## WASM assets bắt buộc
Theo tài liệu upstream @flyfish-dev/cad-viewer, cần sao chép vào `viewer-poc/public/wasm/`: `libredwg-web.js`, `libredwg-web.wasm`, `dwg-worker.js`. Có thể lấy từ gói npm được upstream cung cấp sau khi `npm install` và kiểm tra đường dẫn gói. **Chưa có asset ở nhánh này; DWG sẽ chưa chạy nếu thiếu.** Cần xây script sao chép tự động trước khi triển khai.

## Kiểm thử trước khi merge
- Kiểm tra API thực tế của phiên bản package, chạy build Vite.
- Thử 10A.dwg trên desktop và iPhone Safari, kiểm tra thời gian/bộ nhớ.
- Đối chiếu số layer, block, text, đơn vị, các đối tượng thiếu với AutoCAD.
- Không bật xuất DWG hoặc đo đạc thi công trước khi kiểm định.
- Tuân thủ AGPL-3.0 của cad-viewer và GPL-3.0 của LibreDWG, giữ license và attribution.

Nguồn: https://github.com/flyfish-dev/cad-viewer
