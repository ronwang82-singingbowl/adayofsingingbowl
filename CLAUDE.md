# 缽日 BORI 網站專案 — 工作守則

這份文件會在每次於此資料夾工作時自動載入。目的是讓每一次協作都不用從頭摸索，
也不用重複踩同樣的坑。

---

## 一、驗證守則（最優先，凡事適用）

> **2026-08-02 立此規則的原因：**
> 當時我測了 `/users` 節點發現有防護，就對 Ron 說「一般會員只能讀取自己的資料」。
> 後來看到完整的 Firebase 規則才發現，`bookings` / `vouchers` / `transactions` / `remittances`
> 四個節點是 `auth != null` —— 任何註冊會員都能下載所有人的姓名、電話、銀行後五碼、
> 以及預約備註裡的身體狀況。**測一個樣本就推論全體，還用很篤定的語氣講出來，這是錯的。**

因此，在此專案中：

1. **說「安全了 / 沒問題了 / 修好了」時，必須同時說明：實際測了哪幾項、哪些沒測。**
   不允許用單一樣本推論全體。

2. **必須有對照組。** 例如驗證「外部讀不到資料」時，要同時測一個「本來就該讀得到」的
   節點（如 `slots`）。若全部都讀不到，無法分辨是防護生效還是工具連不上。

3. **驗證要兩邊做：** 我從外部驗防護、Ron 從內部驗功能沒壞。缺一不可。

4. **改動有風險時，先講清楚風險與回復方式，再動手。**
   例如改 Firebase 規則前，要先提醒備份舊規則。

5. **Ron 有權隨時反問「你實際測了哪幾個？沒測的是哪些？」** 這個問題永遠是合理的。

---

## 二、專案結構

| 路徑 | 說明 |
|---|---|
| `index.html` | 公開首頁。**由 `editor.html` 產生**，不要只改這裡 |
| `editor.html` | Ron 專用的視覺化編輯器 + 一鍵發布工具 |
| `member/` | 會員系統 SPA（`index.html` + `member.js` + `member.css`）|
| `privacy.html` | 隱私權政策 |
| `line-add.html` | 電腦版 LINE 加好友的備援頁 |
| `firebase-rules.json` | Firebase 安全規則備份（**規則被改壞時貼回這份**）|
| `tools/sync-version.py` | 快取版號自動同步工具 |

---

## 三、必守的操作慣例

### 改了 `member.js` 或 `member.css` → 一定要跑

```bash
python3 tools/sync-version.py
```

它用檔案內容雜湊自動更新 `member/index.html` 的 `?v=` 版號。
**不要手動改版號。** 忘了跑 = 會員瀏覽器抓到舊程式。

### 改首頁樣式或內容 → 兩個地方都要改

`editor.html` 裡的 `.stage` CSS 與 `renderPreview()` 範本，決定的是
**「未來重新發布時」**產生的 HTML。改了它**不會**動到目前線上的 `index.html`。

所以：
- 只改 `index.html` → Ron 下次用編輯器發布時會被蓋掉
- 只改 `editor.html` → 現在線上看不到變化
- **兩個都要改**

（隱私權政策頁尾連結就是這樣處理的：`index.html`、`member/index.html`、
`editor.html` 的輸出範本，三處都加。）

### 瀏覽器看不到最新變更時

先懷疑快取，不要急著懷疑程式壞掉。
`Cmd+Shift+R` 只會重抓 `member.js`，**不會重抓 `index.html`**（版號寫在裡面）。
正確做法：DevTools 開著 → 右鍵重新整理鈕 → 「清空快取並硬性重新載入」。

### 部署驗證

`raw.githubusercontent.com` 有自己的快取，剛推完可能仍是舊的。
以 `git ls-remote` 或 `git show origin/main:<file>` 為準，不要只看 raw。

---

## 四、後台維護工具（管理員登入後在 Console 執行）

```js
boriRepair.admins()              // 稽核：後台目前有幾個管理員帳號
boriRepair.list()                // 檢查會員 id 有無重複
boriRepair.bookingsOf(userId)    // 看某個 userId 底下的預約（含建立時間）
boriRepair.moveBookings(from,to) // 把掛錯人的預約搬到正確帳號
boriRepair.reassign(email)       // 幫某帳號換一個唯一的新 id
boriRepair.purgeAllTempAdmins()  // 清除程式建立的臨時管理員帳號
boriRepair.purgePasswords()      // 清除資料庫殘留的 password 欄位
```

**建議 Ron 定期跑 `boriRepair.admins()`** —— 確認後台沒有多出不該有的鑰匙。

---

## 五、已知的設計與取捨（不要「順手修掉」）

- **id 配號**：`getFreshNextId()` 會先向 Firebase 拉最新快照再配號，另有 `_idFloor`
  發號地板存在 localStorage。這是為了修 2026-07 的 id 撞號事故，不要改回 `getNextId()`。

- **密碼**：資料庫**不存密碼**，一律由 Firebase Authentication 保管。
  舊的登入相容流程含有 `|| (!matchedUser.password)` 後門，已整段移除，不要復原。

- **後台新增會員**：必須用第二個 Firebase App 實例（`firebase.initializeApp(config, "secondary")`）
  建立 Auth 帳號，否則會把管理員自己登出。

- **`users` 規則保留 `lineUserId` 查詢分支**（未登入可查）：這是 LINE 登入流程需要的。
  `lineUserId` 是 33 位亂碼、無法列舉，屬有意識的風險取捨。
  同樣的 `email` 查詢分支已移除（email 可猜測，風險等級不同）。

- **`settings` 節點任何登入者可讀**：因為會員端送 LINE 通知時需要讀 webhook URL。
  已知風險（會員可取得 webhook 網址），影響低，目前接受。

---

## 六、資料與法遵事實

- Firebase 專案：`adayofsingingbowl`，Realtime Database 位於 **us-central1（美國）**
- 已在 `privacy.html` 明確揭露跨境傳輸
- 預約備註欄（特殊需求／身體狀況）屬**敏感個資**，政策中已標示為選填
- Ron 為個人工作室形式，未辦商業登記
- **我不是律師**：法遵相關內容僅為誠實說明，重大變更建議請律師複核

---

## 七、Git 操作注意

此資料夾的 `.git` 在沙盒環境中常出現 lock 檔無法刪除的問題。
可行做法：`cp -r` 出一份到 `/tmp`，在副本中 `find .git -iname "*lock*" -delete`
再操作，完成後把新物件與 refs 同步回來。

Token 已改由 **macOS 鑰匙圈**保管（`credential.helper = osxkeychain`），
`.git/config` 中**不應再出現明文 token**。若發現有，立即提醒 Ron 撤銷。
