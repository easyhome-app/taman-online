// Đăng lên Fanpage các bài web mới xuất bản (trong 3 ngày gần nhất) chưa từng đăng.
// Cần 2 secret trên GitHub: FB_PAGE_ID và FB_PAGE_TOKEN (Page access token dài hạn). Thiếu thì bỏ qua, không báo lỗi.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LOG = path.join(ROOT, 'noi-dung', 'da-dang-facebook.json');
const { FB_PAGE_ID, FB_PAGE_TOKEN, FB_GRAPH_VERSION = 'v24.0' } = process.env;

if (!FB_PAGE_ID || !FB_PAGE_TOKEN) { console.log('Chưa có FB_PAGE_ID / FB_PAGE_TOKEN, bỏ qua bước đăng Facebook.'); process.exit(0); }

const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'noi-dung', 'da-xuat-ban.json'), 'utf8'));
const done = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : [];
const since = new Date(Date.now() + 7 * 3600e3 - 3 * 86400e3).toISOString().slice(0, 10);
const todo = live.filter((p) => p.facebook && p.date >= since && !done.some((d) => d.slug === p.slug));
if (!todo.length) { console.log('Không có bài mới cần đăng Facebook.'); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitLive(url) {
  // Chờ Vercel deploy xong để Facebook lấy được ảnh và tiêu đề xem trước
  for (let i = 0; i < 30; i++) { try { if ((await fetch(url, { method: 'HEAD' })).ok) return true; } catch {} await sleep(10000); }
  return false;
}

let failed = 0;
for (const p of todo) {
  if (!(await waitLive(p.url))) { console.error(`Trang chưa lên sau 5 phút, để lần sau: ${p.url}`); failed++; continue; }
  const body = new URLSearchParams({ message: p.facebook, link: p.url, access_token: FB_PAGE_TOKEN });
  const res = await fetch(`https://graph.facebook.com/${FB_GRAPH_VERSION}/${FB_PAGE_ID}/feed`, { method: 'POST', body });
  const json = await res.json();
  if (!res.ok) { console.error(`Lỗi đăng "${p.title}":`, JSON.stringify(json.error || json)); failed++; continue; }
  console.log(`Đã đăng Facebook: ${p.title} (${json.id})`);
  done.push({ slug: p.slug, postId: json.id, at: new Date().toISOString() });
  fs.writeFileSync(LOG, JSON.stringify(done, null, 2) + '\n');
}
process.exit(failed ? 1 : 0);
