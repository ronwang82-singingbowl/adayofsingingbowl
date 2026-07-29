#!/usr/bin/env python3
"""
會員系統快取版號自動同步工具
================================================================

【這個工具在解決什麼問題】
member/index.html 裡用 ?v=數字 來讓瀏覽器知道「程式更新了，請重新下載」。
如果改了 member.js 卻忘記把版號加一，會員的瀏覽器就會繼續跑舊程式，
造成「明明修好了、使用者卻說沒改」的鬼打牆狀況。

【解法】
版號不再靠人工遞增，改成直接由檔案內容算出的雜湊值。
內容有變 → 版號自動變；內容沒變 → 版號不變（快取繼續生效）。
這樣就不可能忘記，也不會多做無謂的快取失效。

【用法】
  python3 tools/sync-version.py           # 自動修正版號
  python3 tools/sync-version.py --check   # 只檢查不修改；不同步時回傳錯誤碼 1

部署前請務必跑過一次（或用 --check 確認）。
"""

import hashlib
import re
import sys
from pathlib import Path

# 專案根目錄（本檔案的上一層）
ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "member" / "index.html"

# 要掛版號的靜態檔案
ASSETS = ["member.js", "member.css"]


def short_hash(path: Path) -> str:
    """取檔案內容的短雜湊當版號（8 碼足以避免碰撞，又不會太長）"""
    return hashlib.sha256(path.read_bytes()).hexdigest()[:8]


def main() -> int:
    check_only = "--check" in sys.argv

    if not INDEX.exists():
        print(f"✗ 找不到 {INDEX}")
        return 2

    html = INDEX.read_text(encoding="utf-8")
    original = html
    report = []

    for asset in ASSETS:
        asset_path = ROOT / "member" / asset
        if not asset_path.exists():
            print(f"✗ 找不到 {asset_path}")
            return 2

        new_v = short_hash(asset_path)
        # 比對現況：抓 member.js?v=xxx 這種寫法
        pattern = re.compile(re.escape(asset) + r"\?v=([A-Za-z0-9._-]+)")
        found = pattern.search(html)

        if not found:
            print(f"✗ {INDEX.name} 裡找不到 {asset}?v=... 的引用，請確認是否被改寫過")
            return 2

        old_v = found.group(1)
        if old_v == new_v:
            report.append(f"  = {asset:<12} v={new_v}（未變動）")
        else:
            html = pattern.sub(f"{asset}?v={new_v}", html)
            report.append(f"  ↻ {asset:<12} v={old_v} → v={new_v}")

    changed = html != original

    print("會員系統快取版號檢查")
    print("-" * 46)
    for line in report:
        print(line)
    print("-" * 46)

    if not changed:
        print("✓ 版號與檔案內容一致，不需更新")
        return 0

    if check_only:
        print("✗ 版號與檔案內容不同步！")
        print("  請先執行：python3 tools/sync-version.py")
        return 1

    INDEX.write_text(html, encoding="utf-8")
    print("✓ 已更新版號，會員的瀏覽器會取得最新程式")
    return 0


if __name__ == "__main__":
    sys.exit(main())
