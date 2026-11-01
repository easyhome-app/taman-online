// Đăng lên Fanpage các bài web mới xuất bản (trong 3 ngày gần nhất) chưa từng đăng, và các bài chỉ dành cho Fanpage.
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
const API = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${FB_PAGE_ID}/feed`;
const save = () => fs.writeFileSync(LOG, JSON.stringify(done, null, 2) + '\n');
let failed = 0;

// Bài chỉ đăng Fanpage (không có trang web): noi-dung/fanpage/*.md, phần đầu có title, date (YYYY-MM-DD), time (HH:MM giờ VN).
// Bài còn hơn 15 phút nữa mới tới giờ thì hẹn giờ ngay trên Facebook; tới giờ rồi (trong 3 ngày) thì đăng luôn.
const FP = path.join(ROOT, 'noi-dung', 'fanpage');
const BANNED = /khám|chữa|điều trị|chẩn đoán|kê đơn/i;
for (const f of fs.existsSync(FP) ? fs.readdirSync(FP).filter((x) => x.endsWith('.md')).sort() : []) {
  const slug = 'fanpage/' + f.replace(/\.md$/, '');
  if (done.some((d) => d.slug === slug)) continue;
  const m = fs.readFileSync(path.join(FP, f), 'utf8').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) { console.error(`${f}: thiếu phần đầu ---`); failed++; continue; }
  const meta = Object.fromEntries(m[1].split('\n').map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2].trim()]));
  const message = m[2].trim();
  if (!meta.date || !message) { console.error(`${f}: thiếu date hoặc nội dung`); failed++; continue; }
  if (BANNED.test(message)) { console.error(`${f}: có chữ không được dùng (${message.match(BANNED)[0]}), không đăng.`); failed++; continue; }
  const when = new Date(`${meta.date}T${meta.time || '07:00'}:00+07:00`).getTime();
  const left = when - Date.now();
  if (left > 70 * 86400e3) continue; // Facebook chỉ cho hẹn tối đa 75 ngày, để lần sau
  if (left < -3 * 86400e3) { console.log(`Bỏ qua bài Fanpage quá cũ: ${f}`); continue; }
  const body = new URLSearchParams({ message, access_token: FB_PAGE_TOKEN });
  if (left > 15 * 60e3) { body.set('published', 'false'); body.set('scheduled_publish_time', String(Math.floor(when / 1000))); }
  const res = await fetch(API, { method: 'POST', body });
  const json = await res.json();
  if (!res.ok) { console.error(`Lỗi đăng Fanpage "${meta.title || f}":`, JSON.stringify(json.error || json)); failed++; continue; }
  console.log(`${left > 15 * 60e3 ? 'Đã hẹn giờ' : 'Đã đăng'} Fanpage: ${meta.title || f} (${json.id})`);
  done.push({ slug, postId: json.id, at: new Date().toISOString(), ...(left > 15 * 60e3 ? { scheduled: new Date(when).toISOString() } : {}) });
  save();
}

if (!todo.length) { console.log('Không có bài web mới cần đăng Facebook.'); process.exit(failed ? 1 : 0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitLive(url) {
  // Chờ Vercel deploy xong để Facebook lấy được ảnh và tiêu đề xem trước
  for (let i = 0; i < 30; i++) { try { if ((await fetch(url, { method: 'HEAD' })).ok) return true; } catch {} await sleep(10000); }
  return false;
}

for (const p of todo) {
  if (!(await waitLive(p.url))) { console.error(`Trang chưa lên sau 5 phút, để lần sau: ${p.url}`); failed++; continue; }
  const body = new URLSearchParams({ message: p.facebook, link: p.url, access_token: FB_PAGE_TOKEN });
  const res = await fetch(API, { method: 'POST', body });
  const json = await res.json();
  if (!res.ok) { console.error(`Lỗi đăng "${p.title}":`, JSON.stringify(json.error || json)); failed++; continue; }
  console.log(`Đã đăng Facebook: ${p.title} (${json.id})`);
  done.push({ slug: p.slug, postId: json.id, at: new Date().toISOString() });
  save();
}
process.exit(failed ? 1 : 0);
