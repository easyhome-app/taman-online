// Cấu hình Tâm Trí. Lấy 2 giá trị Supabase ở: Project Settings → API (hoặc Data API).
window.TAMTRI = {
  supabaseUrl: 'https://etvtyzrykufvvblarkdx.supabase.co',          // ví dụ https://abcdxyz.supabase.co
  supabaseKey: 'sb_publishable_1uUQI7IMesg5AS2Mc0k3nw_CtlysDlX',      // khóa "publishable" hoặc "anon public", KHÔNG dùng khóa secret/service_role
  bank: { bin: '970441', name: 'VIB', account: '012323456', holder: 'NGUYEN DUY HIEN', memoPrefix: 'THU HO TAMTRI' },
  kinds: {
    dau: { label: 'Khám lần đầu', dur: 45, price: 350000 },
    tai: { label: 'Tái khám', dur: 25, price: 200000 }
  }
};
