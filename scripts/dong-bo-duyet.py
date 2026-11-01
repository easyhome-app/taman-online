#!/usr/bin/env python3
"""Đồng bộ Bảng việc ODAYDI ↔ trang Duyệt bài Tâm Trí ↔ kho bài tự đăng.

Trợ lý chạy lúc 11:30 và 18:30 giờ VN. Script không gọi mạng: Trợ lý tải dữ liệu
hai bảng về thư mục, chạy script, rồi tự ghi các lệnh ghi (batch) mà script in ra.

  python3 scripts/dong-bo-duyet.py <thư mục làm việc>

Thư mục làm việc cần có:
  bang/posts/*.json      bài Tâm Trí (project "taman") tải từ Bảng việc ODAYDI
  bang/ver.txt           mỗi dòng "<id> <version>" của các bài trên
  bacsi/bai/*.json       bài trên trang Duyệt bài (có thể chưa có)
  bacsi/ver.txt          mỗi dòng "<id> <version>"

Script ghi ra:
  ghi-bang.json, ghi-bacsi.json   các lệnh ghi (batch) cho hai bảng
  noi-dung/bai-viet/*.md, noi-dung/fanpage/*.md trong repo (bài đã được bác sĩ duyệt)
  bao-cao.txt                     tóm tắt cho Trợ lý

Nguyên tắc:
  - Chỉ bài có trạng thái "cho_duyet" trên bảng mới được gửi sang bác sĩ.
  - Chỉ nội dung bác sĩ đã duyệt (bản trên trang Duyệt bài) mới được đưa vào kho bài.
  - Có chữ cấm hoặc còn chỗ trống [ ... ] thì không đưa vào kho, báo lại.
"""
import json, os, re, sys, unicodedata
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANNED = re.compile(r"khám|chữa|điều trị|chẩn đoán|kê đơn", re.I)
BLANK = re.compile(r"\[\s*(?:\.\.\.|…)[^\]]*\]")
FB_SPLIT = re.compile(r"^\s*(?:<!--\s*facebook\s*-->|-{2,}\s*fanpage\s*-{2,})\s*$", re.I | re.M)
VN = timezone(timedelta(hours=7))
NOW = datetime.now(VN)
TODAY = NOW.strftime("%Y-%m-%d")
DOCTOR = "Bác sĩ Thu Hằng"


def load_dir(d):
    out = {}
    if os.path.isdir(d):
        for f in sorted(os.listdir(d)):
            if f.endswith(".json"):
                out[f[:-5]] = json.load(open(os.path.join(d, f), encoding="utf-8"))
    return out


def load_ver(p):
    v = {}
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            parts = line.split()
            if len(parts) == 2:
                v[parts[0]] = int(parts[1])
    return v


def slugify(s):
    s = s.replace("đ", "d").replace("Đ", "d")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:80].rstrip("-")


def split_caption(text):
    parts = FB_SPLIT.split(text or "", maxsplit=1)
    return parts[0].strip(), (parts[1].strip() if len(parts) > 1 else "")


def strip_title(body, title):
    lines = body.strip().split("\n")
    if lines and re.match(r"^#\s+", lines[0]):
        lines = lines[1:]
    # bỏ dòng ghi chú nháp kiểu *Bản nháp ...*
    lines = [l for l in lines if not re.match(r"^\*?\s*bản nháp", l.strip(), re.I)]
    return "\n".join(lines).strip()


def first_para(body):
    for para in re.split(r"\n\s*\n", body):
        p = para.strip()
        if p and not p.startswith(("#", "-", "*", ">", "|")) and not re.match(r"^\d+[.)]", p):
            p = re.sub(r"\*\*|\*|\[([^\]]+)\]\([^)]+\)", lambda m: m.group(1) or "", p)
            p = " ".join(p.split())
            if len(p) <= 158:
                return p
            cut = p[:155].rsplit(" ", 1)[0]
            return cut.rstrip(",;:") + "…"
    return ""


def to_doctor(p):
    """Bài trên bảng → bản gửi bác sĩ đọc."""
    ch = p.get("channel")
    if ch == "tiktok_taman":
        content, caption = (p.get("brief") or "").strip(), (p.get("content") or "").strip()
    elif ch == "web_taman":
        content, caption = split_caption(p.get("content"))
    else:
        content, caption = (p.get("content") or "").strip(), ""
    return {"title": p.get("title", ""), "channel": ch, "publishDate": p.get("publishDate", ""),
            "publishTime": p.get("publishTime", ""), "content": content, "caption": caption,
            "keyword": p.get("keyword", "")}


def problems(d):
    text = " ".join([d.get("title", ""), d.get("content", ""), d.get("caption", "")])
    out = []
    m = BANNED.search(text)
    if m:
        out.append(f'có chữ "{m.group(0)}"')
    if BLANK.search(text):
        out.append("còn chỗ trống [ ... ] chưa điền")
    if not d.get("publishDate"):
        out.append("chưa có ngày đăng")
    if d.get("channel") == "web_taman" and not d.get("caption"):
        out.append("thiếu lời đăng Fanpage (Trợ lý cần viết thêm)")
    return out


def write_md(d, slug):
    if d["channel"] == "web_taman":
        body = strip_title(d["content"], d["title"])
        desc = first_para(body).replace("\n", " ")
        kw = d.get("keyword", "")
        md = (f"---\ntitle: {d['title']}\ndescription: {desc}\nslug: {slug}\ndate: {d['publishDate']}\n"
              f"keywords: {kw}\n---\n{body}\n\n<!-- facebook -->\n{d['caption']}\n")
        path = os.path.join(ROOT, "noi-dung", "bai-viet", slug + ".md")
        queued = f"web tamtri.vn/bai-viet/{slug}/ và Fanpage, 7:00 sáng {fmt(d['publishDate'])}"
    else:
        md = (f"---\ntitle: {d['title']}\ndate: {d['publishDate']}\ntime: {d.get('publishTime') or '20:00'}\n---\n"
              f"{d['content']}\n")
        path = os.path.join(ROOT, "noi-dung", "fanpage", slug + ".md")
        queued = f"Fanpage, {d.get('publishTime') or '20:00'} ngày {fmt(d['publishDate'])}"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        return None, None
    open(path, "w", encoding="utf-8").write(md)
    return os.path.relpath(path, ROOT), queued


def fmt(date):
    y, m, d = date.split("-")
    return f"{d}/{m}"


def main(work):
    board = load_dir(os.path.join(work, "bang", "posts"))
    bver = load_ver(os.path.join(work, "bang", "ver.txt"))
    doc = load_dir(os.path.join(work, "bacsi", "bai"))
    dver = load_ver(os.path.join(work, "bacsi", "ver.txt"))
    fb_log = json.load(open(os.path.join(ROOT, "noi-dung", "da-dang-facebook.json"), encoding="utf-8"))
    wb, wd, rep, files = [], [], [], []
    now = NOW.isoformat(timespec="seconds")

    def upd_board(pid, data):
        wb.append({"op": "update", "collection": "posts", "doc_id": pid, "data": data, "if_version": bver[pid]})

    def put_doc(pid, data):
        e = {"op": "update" if pid in doc else "set", "collection": "bai", "doc_id": pid, "data": data}
        if pid in doc:
            e["if_version"] = dver[pid]
        wd.append(e)

    for pid, p in board.items():
        if p.get("project") != "taman":
            continue
        d = doc.get(pid)
        st = p.get("status")
        # 1. Bài nhóm gửi duyệt → sang trang bác sĩ (mới, hoặc gửi lại sau khi sửa)
        if st == "cho_duyet" and (d is None or d.get("status") != "cho_duyet" or bver.get(pid, 0) > d.get("boardVersion", 0)):
            if d is not None and d.get("status") == "cho_duyet" and d.get("boardVersion") == bver.get(pid):
                continue
            nd = to_doctor(p)
            nd.update({"status": "cho_duyet", "note": "", "sentAt": now, "boardVersion": bver.get(pid, 0),
                       "queued": {"__delete__": True} if d else None, "appliedAt": {"__delete__": True} if d else None})
            nd = {k: v for k, v in nd.items() if v is not None}
            put_doc(pid, nd)
            rep.append(f"Gửi bác sĩ duyệt: {p.get('title')}" + (f" (lưu ý: {', '.join(problems(nd))})" if problems(nd) else ""))
            continue
        if d is None:
            continue
        # 2. Bác sĩ đã quyết định → cập nhật bảng
        if d.get("status") in ("da_duyet", "can_sua") and d.get("reviewedAt") and d.get("reviewedAt") != d.get("appliedAt"):
            if d["status"] == "da_duyet":
                upd_board(pid, {"status": "da_duyet", "review": f"{DOCTOR} đã duyệt."})
                rep.append(f"Bác sĩ duyệt: {d.get('title')}")
            else:
                upd_board(pid, {"status": "can_sua", "review": f"{DOCTOR}: {d.get('note', '')}"})
                rep.append(f"Bác sĩ cần sửa: {d.get('title')} ({d.get('note', '')})")
            put_doc(pid, {"appliedAt": d["reviewedAt"], "boardVersion": bver[pid] + 1})
            # boardVersion + 1: lần ghi bảng ở trên tăng version đúng 1
        # 2b. Bác sĩ bỏ duyệt (chưa vào kho) → bảng quay về chờ duyệt
        elif d.get("status") == "cho_duyet" and st == "da_duyet" and d.get("reviewedAt") and d.get("reviewedAt") != d.get("appliedAt"):
            upd_board(pid, {"status": "cho_duyet", "review": f"{DOCTOR} bỏ duyệt, đang xem lại."})
            put_doc(pid, {"appliedAt": d["reviewedAt"], "boardVersion": bver[pid] + 1})
            rep.append(f"Bác sĩ bỏ duyệt: {d.get('title')}")
        # 3. Bài web / Fanpage đã duyệt → vào kho tự đăng
        if d.get("status") == "da_duyet" and d.get("channel") in ("web_taman", "fb_taman") and not d.get("queued"):
            pr = [x for x in problems(d) if not x.startswith("thiếu lời đăng") or d["channel"] == "web_taman"]
            if d.get("publishDate", "") < TODAY:
                pr.append("ngày đăng đã qua")
            if pr:
                rep.append(f"CHƯA đưa vào kho: {d.get('title')} ({', '.join(pr)})")
                continue
            slug = slugify(d["title"])
            rel, queued = write_md(d, slug)
            if not rel:
                rep.append(f"CHƯA đưa vào kho: {d.get('title')} (đã có file trùng tên {slug}.md)")
                continue
            files.append(rel)
            link = f"https://tamtri.vn/bai-viet/{slug}/" if d["channel"] == "web_taman" else ""
            pending = [x for x in wd if x["doc_id"] == pid]
            if pending:
                pending[0]["data"]["queued"] = queued
                pending[0]["data"]["file"] = rel
            else:
                put_doc(pid, {"queued": queued, "file": rel})
            pb = [x for x in wb if x["doc_id"] == pid]
            extra = {"queued": queued, **({"link": link} if link else {})}
            if pb:
                pb[0]["data"].update(extra)
            else:
                upd_board(pid, extra)
                put = [x for x in wd if x["doc_id"] == pid][0]
                put["data"]["boardVersion"] = bver[pid] + 1
            rep.append(f"Đưa vào kho tự đăng: {d.get('title')} → {rel}")
        # 4. Bài đã lên → bảng ghi Đã đăng
        if d.get("queued") and st == "da_duyet" and d.get("file"):
            slug = os.path.basename(d["file"])[:-3]
            url = ""
            if d["channel"] == "web_taman" and d.get("publishDate", "9") <= TODAY and NOW.hour >= 8:
                url = f"https://tamtri.vn/bai-viet/{slug}/"
            if d["channel"] == "fb_taman":
                hit = [x for x in fb_log if x.get("slug") == "fanpage/" + slug]
                due = f"{d.get('publishDate')}T{d.get('publishTime') or '20:00'}"
                if hit and NOW.strftime("%Y-%m-%dT%H:%M") >= due:
                    url = "https://www.facebook.com/" + hit[0]["postId"]
            if url and not [x for x in wb if x["doc_id"] == pid]:
                upd_board(pid, {"status": "da_dang", "postedUrl": url})
                rep.append(f"Đã đăng: {d.get('title')} → {url}")

    # Mỗi lệnh ghi lấy nội dung từ 1 file riêng (ghi/<bảng>-<id>.json) để batch không phải chép lại nội dung dài
    os.makedirs(os.path.join(work, "ghi"), exist_ok=True)
    for name, ws in (("bang", wb), ("bacsi", wd)):
        for w in ws:
            fp = os.path.join(work, "ghi", f"{name}-{w['doc_id']}.json")
            json.dump(w.pop("data"), open(fp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            w["file_path"] = fp
        json.dump(ws, open(os.path.join(work, f"ghi-{name}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    rep_text = "\n".join(rep) or "Không có gì thay đổi."
    if files:
        rep_text += "\nFile mới trong repo: " + ", ".join(files)
    open(os.path.join(work, "bao-cao.txt"), "w", encoding="utf-8").write(rep_text + "\n")
    print(rep_text)
    print(f"Lệnh ghi: bảng {len(wb)}, trang bác sĩ {len(wd)}")


if __name__ == "__main__":
    main(sys.argv[1])
