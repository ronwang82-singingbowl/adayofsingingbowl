#!/usr/bin/env python3
"""
把 index.html 裡內嵌的 base64 圖片抽成 assets/ 底下的外部檔，順便重新壓縮。

為什麼可以這樣做（一開始我以為要改發布管線，結果不用）：
  editor.html 的 initEditor() 會 fetch 線上的 index.html，
  再用 parseStateFromHTML() 把狀態解析回來——圖片是用
  getAttribute("src") 讀的，拿到的是原始屬性值。
  輸出範本又是 <img src="${esc(t.src)}">，原樣寫回去。

  所以只要 index.html 裡放的是相對路徑，這個「解析→再輸出」的來回
  就會原封不動保留路徑，publishSite() 一行都不用改。

  （如果 Ron 之後在編輯器上傳新圖，那張會變成 base64 存進 state，
   發布時就會是內嵌的。其餘已經是外部檔的不受影響。要讓新圖也自動
   變成外部檔，才需要動 publishSite()——目前先不做。）

用法：
  python3 tools/extract-images.py            # 實際執行
  python3 tools/extract-images.py --dry-run  # 只看會怎麼做
"""

import base64
import hashlib
import io
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")

# 首頁的圖最寬用不到 1200px（見證圖是方形縮圖、人像約半版），
# 統一限制長邊並用 JPEG 品質 82，肉眼幾乎看不出差別。
MAX_EDGE = 1200
QUALITY = 82

PATTERN = re.compile(r'data:image/(\w+);base64,([A-Za-z0-9+/=]+)')


def process(fmt, b64, dry):
    raw = base64.b64decode(b64)
    im = Image.open(io.BytesIO(raw))
    w, h = im.size

    if max(w, h) > MAX_EDGE:
        s = MAX_EDGE / max(w, h)
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)

    buf = io.BytesIO()
    if im.mode in ("RGBA", "P") and fmt.lower() == "png":
        im.save(buf, "PNG", optimize=True)
        ext = "png"
    else:
        im.convert("RGB").save(buf, "JPEG", quality=QUALITY,
                               optimize=True, progressive=True)
        ext = "jpg"
    out = buf.getvalue()

    # 重壓沒有變小就用原檔。QR code 這種本來就壓過的圖再壓一次只會
    # 多一層雜訊（可能影響掃描），沒必要為了「有處理過」而處理。
    if len(out) >= len(raw) and im.size == (w, h):
        out = raw
        ext = "png" if fmt.lower() == "png" else "jpg"

    name = f"img-{hashlib.sha256(out).hexdigest()[:10]}.{ext}"
    if not dry:
        os.makedirs(ASSETS, exist_ok=True)
        with open(os.path.join(ASSETS, name), "wb") as f:
            f.write(out)

    return name, len(raw), len(out), (w, h), im.size


def main():
    dry = "--dry-run" in sys.argv
    path = os.path.join(ROOT, "index.html")
    src = open(path, encoding="utf-8").read()

    matches = list(PATTERN.finditer(src))
    if not matches:
        sys.exit("index.html 裡找不到內嵌圖片（可能已經抽過了）")

    print(f"index.html 原始大小 {len(src.encode()):,} bytes，找到 {len(matches)} 張內嵌圖\n")

    seen, out, last, tot_before, tot_after = {}, [], 0, 0, 0
    for i, m in enumerate(matches, 1):
        fmt, b64 = m.group(1), m.group(2)
        key = hashlib.sha256(b64.encode()).hexdigest()
        if key in seen:
            name = seen[key]
            print(f"  {i}. 與前面某張相同 → 共用 {name}")
        else:
            name, before, after, dim0, dim1 = process(fmt, b64, dry)
            seen[key] = name
            tot_before += before
            tot_after += after
            print(f"  {i}. {dim0[0]}x{dim0[1]} → {dim1[0]}x{dim1[1]}   "
                  f"{before/1024:>6.0f} KB → {after/1024:>5.0f} KB   {name}")
        out.append(src[last:m.start()])
        out.append(f"assets/{name}")
        last = m.end()
    out.append(src[last:])

    new = "".join(out)
    print(f"\n圖片總量 {tot_before/1024:,.0f} KB → {tot_after/1024:,.0f} KB"
          f"（省 {100 - tot_after/tot_before*100:.0f}%）")
    print(f"index.html {len(src.encode()):,} → {len(new.encode()):,} bytes")

    if dry:
        print("\n(--dry-run，沒有寫入任何檔案)")
        return
    open(path, "w", encoding="utf-8").write(new)
    print(f"\n✓ 已更新 index.html，圖片寫入 {ASSETS}")


if __name__ == "__main__":
    main()
