// Hàm dùng chung: kết nối Supabase, định dạng giờ Việt Nam và tiền
(function () {
  const C = window.TAMTRI;
  const ready = C && /^https?:\/\//.test(C.supabaseUrl) && C.supabaseKey && !/^DIEN_/.test(C.supabaseKey);
  const TZ = 'Asia/Ho_Chi_Minh';
  const T = {
    ready,
    db: ready ? window.supabase.createClient(C.supabaseUrl, C.supabaseKey) : null,
    $: id => document.getElementById(id),
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    money: n => Number(n || 0).toLocaleString('vi-VN') + ' đ',
    pad: n => String(n).padStart(2, '0'),
    // Ngày theo giờ Việt Nam, dạng 2026-10-24
    vnDate: d => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ }),
    vnTime: d => new Date(d).toLocaleTimeString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }),
    vnDay: d => new Date(d).toLocaleDateString('vi-VN', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit' }),
    // Giờ Việt Nam cố định UTC+7
    vnToIso: (date, time) => new Date(`${date}T${time}:00+07:00`).toISOString(),
    kindLabel: k => (C.kinds[k] || { label: k }).label,
    toast(msg) {
      let t = document.querySelector('.toast');
      if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
      t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 3500);
    },
    // Lỗi từ máy chủ đổi sang câu dễ hiểu
    errText(e) {
      const m = (e && (e.message || e.error_description)) || String(e);
      const map = {
        slot_taken: 'Khung này vừa có người khác giữ. Bạn chọn khung khác nhé.',
        slot_too_late: 'Khung này đã sát giờ, không nhận đặt nữa.',
        slot_not_found: 'Khung giờ không còn tồn tại. Bạn tải lại trang nhé.',
        invalid_age: 'Dịch vụ dành cho người từ 18 tuổi. Người dưới 18 tuổi cần người giám hộ đặt giúp.',
        invalid_input: 'Bạn kiểm tra lại họ tên và số điện thoại nhé.',
        not_allowed: 'Tài khoản của bạn không có quyền làm việc này.',
        slot_already_paid: 'Khung này đã có ca khác thanh toán.',
        'Invalid login credentials': 'Sai email hoặc mật khẩu.',
        'Failed to fetch': 'Không kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại.'
      };
      for (const k in map) if (m.includes(k)) return map[k];
      return 'Có lỗi: ' + m;
    }
  };
  T.qrUrl = (amount, memo) => `https://img.vietqr.io/image/${C.bank.bin}-${C.bank.account}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(C.bank.holder)}`;
  window.T = T;
})();
