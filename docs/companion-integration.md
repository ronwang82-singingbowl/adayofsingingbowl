# BORI 陪伴紀錄：整合與啟用

本次把「陪伴紀錄」加進既有會員網站的管理員後台，沿用會員與預約識別資料。這是待啟用版本；GitHub 程式碼更新不會自動更新 Firebase 規則。完成以下設定與實際驗收前，請勿填入真實私人筆記。

## 使用方式

1. 用原有管理員帳號登入會員網站，開啟「管理員後台 → 陪伴紀錄」。使用者不需要登入 ChatGPT。
2. 從「會員管理 → 陪伴歷程」查看該會員；從預約列表的「陪伴紀錄」開啟對應預約紀錄。
3. 「新增紀錄」可登記沒有連結預約的獨立服務。新個案先經原有會員登記流程建立會員，再選取該會員。
4. 記下對談前後重點、體驗回饋、感受標籤及下一次關心日期；服務類型可自訂，也可填入季度方案／期別。
5. 按「儲存紀錄」，等候「已確認儲存至雲端」。儲存遭拒時表單保留輸入；發生版本衝突時，先複製文字再重新開啟。
6. 用日期、個案或文字篩選歷程。「回饋札記」彙整標籤次數；「追蹤提醒」依日期顯示待關心事項。提醒只在站內顯示，沒有背景推播或 LINE 自動訊息。
7. 「封存」可將紀錄收起，在「已封存」還原；「匯出私人紀錄備份」下載 JSON，目前沒有一鍵匯入還原功能。

陪伴進度與原有預約狀態分開處理，不會因儲存筆記扣點、變更付款或取消預約。會員端不顯示內部筆記。這次沒有搬移另一個 Sites 網站的既有紀錄。

## Firebase 啟用順序

### 1. 備份目前正式設定

- 在 Firebase Console 選擇正確專案的 Realtime Database，匯出／複製**當下正式規則**為 `firebase-live-before.json`，另外備份正式資料。
- 記錄備份日期與目前網站 commit。儲存庫的 `firebase-rules.json` 是舊備份，不可當作目前正式規則直接覆蓋。
- 規則與備份含營運資料時，保存在私人位置，不要提交至公開 GitHub。

### 2. 產生候選規則

```sh
python3 tools/merge-companion-rules.py /私人位置/firebase-live-before.json /私人位置/firebase-live-candidate.json
```

工具只加入 `companionAdmins` 與 `companionRecords` 節點，不發布，也不覆寫原檔。輸出檔若已存在、根層已有讀寫授權，或新節點已有不同規則，工具會停止；此時應先逐條確認，不能直接放寬權限。

比對候選檔與備份，確認既有會員、預約、點數、課程規則均未變動。用候選檔重跑下方 Emulator 測試，再將候選規則發布到同一個正式資料庫。

### 3. 授權管理員

在 Firebase Authentication 查到 Ron **實際用來登入後台的 UID**，由可信任的 Firebase Console 操作人員設定：

```text
companionAdmins
  <管理員的 Firebase Authentication UID>: true
```

值為布林值 `true`，不是字串。不要使用會員流水號、LINE ID 或電子郵件代替 UID。新頁面的未啟用提示也會顯示當次登入 UID，方便核對。

私人筆記的資料庫權限只依這個獨立授權清單判定；一般用戶端（包括管理員）不能改寫清單。既有 `users.role` 不作為私人筆記的唯一權限依據。本次沒有調整舊會員系統的角色權限設計。

### 4. 發布程式並實際驗收

規則與授權確認後，合併程式碼、等待 GitHub Pages 部署，再重新整理會員網站。先用標明「測試」的資料確認：

- Ron 管理員可新增、重開、修改、完成追蹤、封存與還原，重新整理後仍可讀取。
- 既有會員／預約入口能找到正確個案；不同裝置能看到同一筆紀錄。
- 第二位一般會員與未登入視窗無法讀取或改寫 `companionRecords`，不能自行授權；同時公開時段仍可讀取，避免把整站斷線誤認為權限正確。
- 會員原本的登入、預約、點數、優惠券、付款與課程流程照常；實際手機與桌機版都操作一次。
- 兩個管理員視窗同時編輯同一筆時，舊版本應被拒絕覆寫；離線不可宣告儲存成功。

正式規則的外部權限驗證與 Ron 的實際內部操作驗收都完成後，才開始輸入真實筆記。

## 資料與回復方式

- 新筆記存在 Firebase `companionRecords`；既有 `users` 與 `bookings` 僅被此模組讀取。
- 不把私人筆記放進公開程式碼或 localStorage；登出時清除本模組的畫面與監聽。這不表示原網站其他模組沒有自己的快取。
- 暫停使用：撤銷該 UID 的 `companionAdmins` 授權，新模組會停止私人資料存取，既有紀錄仍保留。
- 回退網站：還原本 PR 的程式碼變更。不要刪除 `companionRecords`；恢復程式不需要刪資料。
- 回退規則：先比對啟用後是否另有正式變更，再使用自己的啟用前備份。不要盲目用舊檔覆蓋別人後來的設定。
- JSON 匯出目前僅提供資料備份；需要復原時另行檢查欄位、會員識別與衝突，再由有權限的管理者處理。

## 已完成的驗證與限制

2026-11-10，本機測試使用 Node 測試執行器、jsdom 與 Firebase Realtime Database Emulator：

| 範圍 | 結果 |
| --- | --- |
| 日期、識別對應、篩選、標籤及版本等核心測試 | 9 項通過 |
| 模擬介面新增／修改／追蹤／封存／拒絕儲存／登出等情境 | 4 項通過 |
| 資料庫權限、身分隔離、欄位驗證、版本與禁止硬刪除 | 6 項通過 |
| 桌面瀏覽器虛構資料預覽 | 已目視檢查，新增紀錄可顯示 |

Emulator 當次使用「儲存庫備份規則＋新節點」，**不是已確認的正式現行規則**。尚未執行正式 Firebase 登入／寫入、跨裝置同步、實體手機及既有付款全流程驗收，因此不可把上述結果當成正式上線完成或整站安全認證。

## 重跑測試

將測試相依套件安裝於儲存庫以外的暫存目錄；當次使用 `@firebase/rules-unit-testing@6.0.0`、`firebase@13.2.0`、`firebase-tools@15.35.0`、`jsdom@31.0.0`，並需要相容 Node.js 及 Java 21。

```sh
mkdir -p /tmp/bori-companion-test
npm install --prefix /tmp/bori-companion-test @firebase/rules-unit-testing@6.0.0 firebase@13.2.0 firebase-tools@15.35.0 jsdom@31.0.0
BORI_TEST_MODULES=/tmp/bori-companion-test/node_modules node --test tests/companion-core.test.cjs tests/companion-ui.test.cjs
```

將要驗證的候選規則複製為暫存目錄的 `combined.json`，建立該目錄的 `firebase.json`：

```json
{"database":{"rules":"combined.json"},"emulators":{"database":{"port":9000},"ui":{"enabled":false}},"singleProjectMode":true}
```

在儲存庫根目錄執行（僅 Emulator，不是正式部署指令）：

```sh
BORI_TEST_MODULES=/tmp/bori-companion-test/node_modules BORI_RULES_FILE=/tmp/bori-companion-test/combined.json /tmp/bori-companion-test/node_modules/.bin/firebase emulators:exec --only database --project demo-bori-companion --config /tmp/bori-companion-test/firebase.json 'node --test tests/companion-rules.test.cjs'
python3 tools/sync-version.py
git diff --check
```

若環境將 localhost 轉送給 HTTP 代理，請僅對此本機 Emulator 指令排除該代理；不需連線正式專案，也不需 Firebase 正式憑證。
