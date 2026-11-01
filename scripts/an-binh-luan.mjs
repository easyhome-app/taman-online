// Tự ẩn bình luận rác trên Fanpage: số điện thoại, link lạ, quảng cáo vay tiền, cờ bạc...
// Chỉ ẩn (người viết và bạn bè họ vẫn thấy), không xoá, không trả lời. Bình luận tâm sự để người thật trả lời.
// Cần FB_PAGE_ID, FB_PAGE_TOKEN (có quyền pages_read_user_content, pages_manage_engagement). Thiếu thì bỏ qua.
const { FB_PAGE_ID, FB_PAGE_TOKEN, FB_GRAPH_VERSION = 'v24.0' } = process.env;
if (!FB_PAGE_ID || !FB_PAGE_TOKEN) { console.log('Chưa có FB_PAGE_ID / FB_PAGE_TOKEN, bỏ qua.'); process.exit(0); }

const API = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;
const RULES = [
  ['số điện thoại', /(?:\+?84|\b0)(?:[\s.-]?\d){9}\b/],
  ['link lạ', /(?:https?:\/\/|www\.|\b[\w-]+\.(?:com|net|org|xyz|top|info|io|me|ly|link|site|online|shop|store|vn)\b|t\.me\/|zalo\.me\/)/i],
  ['quảng cáo', /vay (?:tiền|vốn|nhanh)|giải ngân|tín dụng đen|kiếm tiền (?:online|tại nhà)|việc nhẹ lương cao|cộng tác viên|nhà cái|cá cược|casino|tài xỉu|lô đề|nổ hũ|tăng (?:like|follow)|thuốc giảm cân|hàng (?:auth|fake)|18\+/i],
];
const OK_LINK = /(?:https?:\/\/)?(?:www\.)?tamtri\.vn\S*/gi;

function reason(text = '') {
  const t = text.replace(OK_LINK, '');
  const hit = RULES.find(([, re]) => re.test(t));
  return hit && hit[0];
}

async function get(url) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json.error || json));
  return json;
}

const since = Math.floor(Date.now() / 1000) - 14 * 86400;
const posts = await get(`${API}/${FB_PAGE_ID}/posts?fields=id&since=${since}&limit=25&access_token=${FB_PAGE_TOKEN}`);
let hidden = 0, failed = 0;
for (const post of posts.data || []) {
  let url = `${API}/${post.id}/comments?filter=stream&fields=id,message,is_hidden,from&limit=100&access_token=${FB_PAGE_TOKEN}`;
  while (url) {
    const page = await get(url);
    for (const c of page.data || []) {
      if (c.is_hidden || c.from?.id === FB_PAGE_ID) continue;
      const why = reason(c.message);
      if (!why) continue;
      const res = await fetch(`${API}/${c.id}`, { method: 'POST', body: new URLSearchParams({ is_hidden: 'true', access_token: FB_PAGE_TOKEN }) });
      if (res.ok) { hidden++; console.log(`Đã ẩn ${c.id} (${why})`); }
      else { failed++; console.error(`Không ẩn được ${c.id}:`, JSON.stringify((await res.json()).error)); }
    }
    url = page.paging?.next;
  }
}
console.log(`Xong: ẩn ${hidden} bình luận, lỗi ${failed}.`);
process.exit(failed ? 1 : 0);
