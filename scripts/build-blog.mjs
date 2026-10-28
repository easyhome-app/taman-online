// Dựng mục Bài viết từ noi-dung/bai-viet/*.md thành HTML tĩnh, kèm sitemap.xml.
// Chạy: node scripts/build-blog.mjs   (không cần cài gì thêm)
// Bài có ngày (date) sau hôm nay theo giờ Việt Nam sẽ chưa được đăng, nên có thể soạn trước.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'noi-dung', 'bai-viet');
const OUT = path.join(ROOT, 'bai-viet');
const SITE = 'https://tamtri.vn';
const FB_MARK = '<!-- facebook -->';

const todayVN = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fmtDate = (d) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const ext = /^https?:/.test(u) && !u.startsWith(SITE);
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
    });
}
const plain = (s) => s.replace(/\*\*|\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

// Markdown tối giản: tiêu đề ##/###, đoạn văn, danh sách -, 1., trích dẫn >, đậm, nghiêng, liên kết
function markdown(md) {
  const lines = md.split('\n');
  const html = []; const toc = []; const faq = [];
  let para = [], list = null, quote = [], inFaq = false, q = null;
  const flushPara = () => { if (para.length) { const t = para.join(' '); html.push(`<p>${inline(t)}</p>`); if (q) q.a.push(plain(t)); para = []; } };
  const flushList = () => { if (list) { html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); if (q) q.a.push(list.items.map(plain).join('; ')); list = null; } };
  const flushQuote = () => { if (quote.length) { html.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };
  const endQ = () => { if (q) { faq.push(q); q = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    if (!line) { flushAll(); continue; }
    if ((m = line.match(/^(#{2,3})\s+(.+)$/))) {
      flushAll();
      const level = m[1].length, text = m[2], id = slugify(plain(text));
      if (level === 2) { endQ(); inFaq = /câu hỏi thường gặp/i.test(text); toc.push({ id, text: plain(text) }); }
      else if (inFaq) { endQ(); q = { q: plain(text), a: [] }; }
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    if ((m = line.match(/^[-*]\s+(.+)$/)) || (m = line.match(/^\d+[.)]\s+(.+)$/))) {
      flushPara(); flushQuote();
      const tag = /^\d/.test(line) ? 'ol' : 'ul';
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push(m[1]); continue;
    }
    flushList(); flushQuote(); para.push(line);
  }
  flushAll(); endQ();
  return { html: html.join('\n'), toc, faq };
}

function parse(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: thiếu phần đầu --- ... ---`);
  const meta = {};
  for (const l of m[1].split('\n')) { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"(.*)"$/, '$1'); }
  for (const k of ['title', 'description', 'date']) if (!meta[k]) throw new Error(`${file}: thiếu "${k}"`);
  const [body, fb = ''] = m[2].split(FB_MARK);
  return { ...meta, slug: meta.slug || slugify(meta.title), updated: meta.updated || meta.date, body, facebook: fb.trim(), file };
}

const NAV = (rel) => `<nav class="nav" aria-label="Điều hướng">
  <div class="wrap">
    <a class="brand" href="${rel}">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="14" fill="none" stroke="var(--lamp)" stroke-width="2"/><path d="M19 8a8 8 0 1 0 3 11 6.5 6.5 0 0 1-3-11z" fill="var(--lamp)"/></svg>
      Tâm Trí
    </a>
    <div class="nav-links">
      <a href="${rel}bai-viet/">Bài viết</a>
      <a class="btn small" href="${rel}dat-lich/">Đặt lịch</a>
    </div>
  </div>
</nav>`;

const FOOT = `<footer>
  <div class="wrap">
    <p><b>Tâm Trí Online</b> · Nói chuyện cùng bác sĩ về sức khỏe tinh thần, online, cho người trẻ.</p>
    <p>Thông tin trên trang không thay thế cho lời khuyên trực tiếp của bác sĩ.</p>
  </div>
</footer>`;

const HEAD = ({ title, description, url, image, type, rel, jsonld }) => `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Tâm Trí Online">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${rel}favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Lora:ital,wght@0,500;0,600;1,500&display=swap">
<link rel="stylesheet" href="${rel}assets/blog.css">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>`;

function articlePage(p, all) {
  const url = `${SITE}/bai-viet/${p.slug}/`;
  const image = p.image ? (p.image.startsWith('http') ? p.image : SITE + '/' + p.image.replace(/^\//, '')) : `${SITE}/bac-si-thu-hang.jpg`;
  const { html, toc, faq } = markdown(p.body);
  const org = { '@type': 'Organization', name: 'Tâm Trí Online', url: SITE + '/' };
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.description, image, datePublished: p.date, dateModified: p.updated,
      inLanguage: 'vi', mainEntityOfPage: url, author: org, publisher: { ...org, logo: { '@type': 'ImageObject', url: SITE + '/favicon.svg' } },
      ...(p.keywords ? { keywords: p.keywords } : {}) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Bài viết', item: SITE + '/bai-viet/' },
      { '@type': 'ListItem', position: 3, name: p.title, item: url }] },
  ];
  if (faq.length) jsonld.push({ '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a.join(' ') } })) });
  const related = all.filter((x) => x.slug !== p.slug).slice(0, 3);
  return `${HEAD({ title: `${p.title} | Tâm Trí Online`, description: p.description, url, image, type: 'article', rel: '../../', jsonld })}
${NAV('../../')}
<main class="wrap narrow">
  <div class="crumbs"><a href="../../">Trang chủ</a> › <a href="../">Bài viết</a></div>
  <article>
    <h1>${esc(p.title)}</h1>
    <p class="meta">Tâm Trí Online · <time datetime="${p.date}">${fmtDate(p.date)}</time>${p.updated !== p.date ? ` · cập nhật ${fmtDate(p.updated)}` : ''}</p>
    <p class="sapo">${esc(p.description)}</p>
${toc.length > 2 ? `    <nav class="toc" aria-label="Mục lục"><b>Trong bài này</b><ol>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></nav>` : ''}
${html}
    <div class="sos" role="note"><b>Nếu bạn đang nghĩ đến việc làm hại bản thân, đừng chờ.</b> Gọi Cấp cứu 115 hoặc Đường dây nóng Ngày Mai 096 306 1414, hoặc nhờ một người bạn tin tưởng ở cạnh bạn.</div>
    <div class="nudge"><p>Muốn nói chuyện với bác sĩ về điều bạn đang trải qua? Buổi tư vấn diễn ra qua video Zalo, 45 phút, ngay tại phòng của bạn.</p><a class="btn" href="../../dat-lich/">Xem lịch còn trống</a></div>
    <div class="author"><img src="../../bac-si-thu-hang-vuong.jpg" alt="" width="56" height="56"><p>Tâm Trí Online là nơi bạn nói chuyện online về sức khỏe tinh thần với ThS. BSNT Nguyễn Thị Thu Hằng, Bác sĩ nội trú Tâm thần ĐH Y Hà Nội, từng nội trú tại Viện Sức khỏe Tâm thần Quốc gia, BV Bạch Mai.</p></div>
    <p class="disclaimer">Bài viết mang tính tham khảo, không thay thế cho lời tư vấn trực tiếp của bác sĩ.</p>
${related.length ? `    <section class="related"><h2>Bài viết khác</h2><div class="list">${related.map(card).join('')}</div></section>` : ''}
  </article>
</main>
${FOOT}
</body>
</html>
`;
}

const card = (p) => `<a class="card" href="${SITE}/bai-viet/${p.slug}/"><h2>${esc(p.title)}</h2><p>${esc(p.description)}</p><p class="meta">${fmtDate(p.date)}</p></a>`;

function indexPage(all) {
  const url = `${SITE}/bai-viet/`;
  const description = 'Bài viết về giấc ngủ, lo âu, trầm cảm và sức khỏe tinh thần cho người trẻ, viết dễ hiểu, kèm dấu hiệu khi nào nên nói chuyện với bác sĩ.';
  const jsonld = [{ '@context': 'https://schema.org', '@type': 'Blog', name: 'Bài viết Tâm Trí Online', url, inLanguage: 'vi',
    blogPost: all.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/bai-viet/${p.slug}/`, datePublished: p.date })) }];
  return `${HEAD({ title: 'Bài viết về sức khỏe tinh thần cho người trẻ | Tâm Trí Online', description, url, image: `${SITE}/bac-si-thu-hang.jpg`, type: 'website', rel: '../', jsonld })}
${NAV('../')}
<main class="wrap narrow">
  <div class="crumbs"><a href="../">Trang chủ</a> › Bài viết</div>
  <h1>Bài viết về sức khỏe tinh thần</h1>
  <p class="sapo">${esc(description)}</p>
  <div class="list" style="margin-top:24px">${all.map(card).join('\n')}</div>
</main>
${FOOT}
</body>
</html>
`;
}

function sitemap(all) {
  const urls = [
    { loc: `${SITE}/`, lastmod: todayVN },
    { loc: `${SITE}/dat-lich/` },
    { loc: `${SITE}/bai-viet/`, lastmod: all[0]?.updated },
    ...all.map((p) => ({ loc: `${SITE}/bai-viet/${p.slug}/`, lastmod: p.updated })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}

const posts = fs.readdirSync(SRC).filter((f) => f.endsWith('.md')).map((f) => parse(path.join(SRC, f)));
// Bác sĩ dặn: không dùng từ ngữ khám, chữa, điều trị trên web và Fanpage. Dùng "nói chuyện cùng bác sĩ", "tư vấn", "hỗ trợ".
const BANNED = /khám|chữa|điều trị|chẩn đoán|kê đơn/i;
for (const p of posts) for (const k of ['title', 'description', 'keywords', 'body', 'facebook']) {
  const m = String(p[k] || '').match(BANNED);
  if (m) throw new Error(`${path.basename(p.file)}: mục "${k}" có từ "${m[0]}", hãy đổi sang "nói chuyện cùng bác sĩ", "tư vấn" hoặc "hỗ trợ"`);
}
const slugs = new Set();
for (const p of posts) { if (slugs.has(p.slug)) throw new Error(`Trùng slug: ${p.slug}`); slugs.add(p.slug); }
const live = posts.filter((p) => p.date <= todayVN).sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

// Xóa trang của bài đã gỡ khỏi noi-dung, rồi dựng lại toàn bộ
if (fs.existsSync(OUT)) for (const d of fs.readdirSync(OUT)) {
  const full = path.join(OUT, d);
  if (fs.statSync(full).isDirectory() && !live.some((p) => p.slug === d)) fs.rmSync(full, { recursive: true });
}
fs.mkdirSync(OUT, { recursive: true });
for (const p of live) {
  fs.mkdirSync(path.join(OUT, p.slug), { recursive: true });
  fs.writeFileSync(path.join(OUT, p.slug, 'index.html'), articlePage(p, live));
}
fs.writeFileSync(path.join(OUT, 'index.html'), indexPage(live));
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap(live));
// Danh sách bài đang hiển thị, để workflow đăng Facebook biết bài nào mới
fs.writeFileSync(path.join(ROOT, 'noi-dung', 'da-xuat-ban.json'), JSON.stringify(live.map((p) => ({
  slug: p.slug, date: p.date, title: p.title, url: `${SITE}/bai-viet/${p.slug}/`, facebook: p.facebook,
})), null, 2) + '\n');

console.log(`Đã dựng ${live.length} bài (${posts.length - live.length} bài hẹn ngày sau). Hôm nay: ${todayVN}`);
