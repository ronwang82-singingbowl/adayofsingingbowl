#!/usr/bin/env python3
"""
產生社群分享用的 OG 預覽圖（og-image.jpg，1200x630）。

為什麼需要這張圖：
  首頁的 og:title / og:description 本來就有，但一直沒有 og:image。
  貼到 LINE、Facebook、Threads 時只會出現一條沒有縮圖的裸連結，
  點擊率差很多。twitter:card 又設成 summary_large_image（大圖卡片），
  沒有圖等於宣告了一張畫不出來的卡片。

用法：
  python3 tools/make-og-image.py              # 產生首頁用的 og-image.jpg
  python3 tools/make-og-image.py quiz         # 產生「內在天氣」測驗用的 og-image-quiz.jpg

改了文案或配色後重跑即可，會直接覆蓋輸出檔。
記得跟著更新 index.html 與 editor.html 輸出範本裡的 og:image 網址版號（?v=）。

注意：測驗站（bori-quiz）是另一個 repo，og-image-quiz.jpg 要手動複製過去。
"""

import os
from PIL import Image, ImageDraw, ImageFont

# ── 品牌配色（取自線上首頁的 computed style，不是憑印象填的）──────────────
INK        = (248, 245, 238)   # #F8F5EE 背景奶油色
PAPER      = (78, 94, 72)      # #4E5E48 主標深綠
BRASS      = (115, 132, 107)   # #73846B CTA 綠
BRASS_SOFT = (228, 199, 120)   # #E4C778 金
BRASS_DIM  = (138, 106, 73)    # #8A6A49 深棕
HAIRLINE   = (216, 212, 204)   # #D8D4CC 細線

W, H = 1200, 630
FONT = "/System/Library/Fonts/Supplemental/Songti.ttc"
BOLD, LIGHT, REG = 2, 5, 7      # Songti TC 的 Bold / Light / Regular

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def font(size, index=BOLD):
    return ImageFont.truetype(FONT, size, index=index)


def draw_tracked(draw, xy, text, fnt, fill, tracking=0):
    """PIL 沒有字距設定，中文標題沒有字距會擠在一起，所以逐字畫。"""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return x


def tracked_width(draw, text, fnt, tracking=0):
    if not text:
        return 0
    return sum(draw.textlength(c, font=fnt) for c in text) + tracking * (len(text) - 1)


def circle_mask(size):
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * 4, size * 4), fill=255)
    return m.resize((size, size), Image.LANCZOS)


# 兩張分享圖只有文案不同，版面與配色共用
VARIANTS = {
    "home": {
        "eyebrow":  "頌缽 · 對話 · 覺察",
        "headline": ("用聲音陪你梳理", "找回內在平衡"),
        "sub":      "台北 · 頌缽身心整合體驗 · 一對一深度對話",
        "url":      "ronwang82-singingbowl.github.io/adayofsingingbowl",
        "out":      "og-image.jpg",
    },
    "quiz": {
        "eyebrow":  "缽日 · 內在天氣",
        "headline": ("屬於你現在的", "內在天氣"),
        "sub":      "4 題，找出你這陣子正在用哪種方式流動",
        "url":      "ronwang82-singingbowl.github.io/bori-quiz",
        "out":      "og-image-quiz.jpg",
    },
}


def main(variant="home"):
    cfg = VARIANTS[variant]
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)

    # 首頁 hero 有一圈淡淡的同心圓，這裡沿用，讓分享圖跟網站是同一個世界
    for cx, cy, r in ((905, 300, 250), (905, 300, 330)):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=HAIRLINE, width=2)

    L = 90          # 左邊界
    y = 74

    # ── 圓形 logo ────────────────────────────────────────────────
    logo_path = os.path.join(ROOT, "logo.jpg")
    logo_size = 84
    if os.path.exists(logo_path):
        logo = Image.open(logo_path).convert("RGB")
        s = min(logo.size)
        logo = logo.crop(((logo.width - s) // 2, (logo.height - s) // 2,
                          (logo.width + s) // 2, (logo.height + s) // 2))
        logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
        img.paste(logo, (L, y), circle_mask(logo_size))

    # 「缽日」字標，跟 logo 同一條基線
    wordmark = font(40, BOLD)
    d.text((L + logo_size + 22, y + 18), "缽日", font=wordmark, fill=PAPER)

    # ── eyebrow：頌缽 · 對話 · 覺察 ──────────────────────────────
    y += logo_size + 46
    eb = font(23, REG)
    d.line((L, y + 13, L + 42, y + 13), fill=BRASS_DIM, width=2)
    draw_tracked(d, (L + 58, y), cfg["eyebrow"], eb, BRASS_DIM, tracking=5)

    # ── 主標（分享圖的重點，字要大到縮圖也讀得到）────────────────
    y += 58
    big = font(72, BOLD)
    for line in cfg["headline"]:
        draw_tracked(d, (L, y), line, big, PAPER, tracking=4)
        y += 92

    # ── 金色細線 ────────────────────────────────────────────────
    y += 16
    d.line((L, y, L + 108, y), fill=BRASS_SOFT, width=4)

    # ── 副標 ────────────────────────────────────────────────────
    y += 34
    sub = font(27, REG)
    draw_tracked(d, (L, y), cfg["sub"], sub, BRASS, tracking=2)

    # ── 左下角網址 ──────────────────────────────────────────────
    # 靠左對齊內容邊界，避開右側的同心圓；顏色用 BRASS 而非 HAIRLINE，
    # 縮圖尺寸下 HAIRLINE 在奶油底上幾乎看不見。
    url = font(19, REG)
    d.text((L, H - 60), cfg["url"], font=url, fill=BRASS)

    out = os.path.join(ROOT, cfg["out"])
    img.save(out, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"✓ 已產生 {out}")
    print(f"  {W}x{H}, {os.path.getsize(out) / 1024:.0f} KB")


if __name__ == "__main__":
    import sys
    v = sys.argv[1] if len(sys.argv) > 1 else "home"
    if v not in VARIANTS:
        sys.exit(f"未知的版本 '{v}'，可用：{', '.join(VARIANTS)}")
    main(v)
