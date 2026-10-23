# Tâm An Online: đưa web lên Vercel

## Trước khi đưa lên
1. Mở `index.html`, tìm `SO_ZALO_CUA_ANH` (3 chỗ) và thay bằng số Zalo, ví dụ `https://zalo.me/0905123456`.
2. Thay ảnh `bac-si-thu-hang.jpg` nếu có ảnh chân dung đẹp hơn (tỉ lệ 4:5).

## Đưa lên Vercel
1. Vào vercel.com, đăng nhập, bấm Add New > Project.
2. Chọn "Deploy without Git" hoặc kéo thả cả thư mục này. Framework: Other. Không cần lệnh build.
3. Vercel cho một link dạng ten-du-an.vercel.app để xem thử.

## Gắn tên miền qua Cloudflare
1. Trên Vercel: Project > Settings > Domains > thêm tên miền (ví dụ taman.vn và www.taman.vn).
2. Trên Cloudflare: DNS > thêm đúng các bản ghi Vercel đưa (thường là A `76.76.21.21` cho tên miền gốc và CNAME `cname.vercel-dns.com` cho www). Lấy giá trị chính xác ở màn hình Vercel.
3. Để các bản ghi này ở chế độ **DNS only** (đám mây xám).
4. Chờ vài phút đến vài giờ, Vercel tự cấp HTTPS.

## Còn thiếu trước khi chạy quảng cáo
- Trang chính sách quyền riêng tư.
- Xác nhận của bệnh viện về việc ghi tên "Bệnh viện Đại học Y Hà Nội".
- Hợp đồng thu hộ với phòng khám có giấy phép khám từ xa.
