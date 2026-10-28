# Tâm Trí Online

## Cấu trúc
- `index.html`: trang chính.
- `dat-lich/`: trang khách chọn giờ, giữ chỗ 30 phút, thanh toán trước 100% qua VIB.
- `quan-ly/`: trang đăng nhập cho quản lý và bác sĩ (tamtri.vn/quan-ly/).
- `assets/config.js`: nơi điền Project URL và khóa publishable của Supabase. Đây là file duy nhất cần sửa.
- `supabase/schema.sql`: tạo cơ sở dữ liệu (chạy 1 lần).
- `supabase/cap-quyen.sql`: cấp quyền quản lý và bác sĩ cho 2 email.

## Cài Supabase (khoảng 10 phút)
1. Vào supabase.com, đăng nhập bằng GitHub, bấm **New project**. Region chọn **Singapore**, đặt mật khẩu database và lưu lại.
2. Vào **SQL Editor** → **New query**, dán toàn bộ `supabase/schema.sql` → **Run**.
3. Vào **Authentication** → **Users** → **Add user** → **Create new user**. Tạo 2 tài khoản: email của anh và email bác sĩ, đặt mật khẩu, tick **Auto Confirm User**.
4. Quay lại **SQL Editor**, dán `supabase/cap-quyen.sql`, sửa 2 email cho đúng → **Run**. Kết quả phải hiện 2 dòng: admin và doctor.
5. Vào **Project Settings** → **API Keys** (hoặc **Data API**), chép **Project URL** và khóa **publishable** (hoặc **anon public**). Dán vào `assets/config.js`. Tuyệt đối không dùng khóa **secret** hay **service_role**.
6. Vào **Authentication** → **Sign In / Providers**, tắt **Allow new users to sign up**, để người lạ không tự tạo tài khoản.

## Vai trò
- **Quản lý (admin)**: mở và đóng khung giờ, xem mọi ca, bấm "Đã nhận tiền", hủy ca.
- **Bác sĩ (doctor)**: mở và đóng khung giờ, xem mọi ca. Không xác nhận tiền.
- **Khách**: chỉ xem được giờ trống và giữ chỗ cho mình. Không đọc được thông tin của người khác.

## Mỗi ngày
- Bác sĩ hoặc anh vào `/quan-ly/` → **Khung giờ** để mở lịch (có thể lặp 7 ngày).
- Khi khách chuyển khoản, anh đối chiếu sao kê VIB theo nội dung "THU HO TAMTRI + mã", rồi bấm **Đã nhận tiền**. Trang của khách sẽ tự báo đã xác nhận. Sau đó nhắn Zalo cho khách.
- Ca **Cờ đỏ** là khách trả lời "Có" ở câu hỏi an toàn: cần gọi lại ngay.
- Khách giữ chỗ quá 30 phút mà chưa được xác nhận thì người khác có thể đặt khung đó. Nếu khách đã chuyển khoản muộn, anh vẫn bấm "Đã nhận tiền" được, miễn khung chưa bán cho người khác.

## Đưa lên Vercel
Đẩy lên nhánh main của GitHub, Vercel tự cập nhật. Tên miền chính: tamtri.vn (mua ở iNET, bản ghi A và CNAME theo Vercel → Settings → Domains). tamtri.shopyte.vn chuyển hướng 308 về tamtri.vn.

## Còn thiếu trước khi chạy quảng cáo
- Trang chính sách quyền riêng tư.
- Xác nhận của bệnh viện về việc ghi tên "Bệnh viện Đại học Y Hà Nội".
- Hợp đồng thu hộ với phòng khám có giấy phép khám từ xa.

## Bài viết (blog chuẩn SEO) và đăng Facebook tự động
- Mỗi bài là 1 file Markdown trong `noi-dung/bai-viet/`. Phần đầu có `title`, `description`, `slug`, `date`, `keywords`. Sau dòng `<!-- facebook -->` là nội dung đăng Fanpage (không hiện trên web).
- Chạy `node scripts/build-blog.mjs` để dựng `bai-viet/`, `sitemap.xml`. Bài có `date` sau hôm nay sẽ tự lên web vào sáng ngày đó.
- Workflow `.github/workflows/dang-bai.yml` chạy 7:00 sáng mỗi ngày (giờ VN) và mỗi khi có bài mới: xuất bản bài đến ngày, rồi đăng lên Fanpage.
- Để đăng Facebook tự động: vào GitHub → repo → Settings → Secrets and variables → Actions, thêm `FB_PAGE_ID` và `FB_PAGE_TOKEN` (Page access token dài hạn, quyền `pages_manage_posts`). Chưa thêm thì web vẫn đăng bình thường, chỉ bỏ qua Facebook.
- Sau khi web có bài: khai báo `https://tamtri.vn/sitemap.xml` trong Google Search Console.
