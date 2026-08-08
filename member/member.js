// ============ 缽日會員預約系統 - 狀態管理 & 頁面邏輯 ============

// ==========================================
// 1. 初始化本地模擬資料庫 (LocalStorage)
// ==========================================

const DEFAULT_SLOTS = [
  { id: 1, date: "2026-07-12", time: "10:00", status: "open", bookingId: null },
  { id: 2, date: "2026-07-12", time: "14:00", status: "booked", bookingId: 1001 },
  { id: 3, date: "2026-07-13", time: "15:00", status: "open", bookingId: null },
  { id: 4, date: "2026-07-15", time: "10:30", status: "pending", bookingId: 1003 },
  { id: 5, date: "2026-07-16", time: "16:00", status: "closed", bookingId: null }
];

const DEFAULT_USERS = [
  { id: 1, email: "admin@singbowl.com", name: "管理員", phone: "0900-000-000", gender: "其他", role: "admin", points: 0, groupPoints: 0, joinDate: "2026-07-01" },
  { id: 2, email: "test@singbowl.com", name: "王小明", phone: "0912-345-678", gender: "生理男", role: "member", points: 7, groupPoints: 3, joinDate: "2026-07-05" },
  { id: 3, email: "beauty@singbowl.com", name: "李美麗", phone: "0928-888-888", gender: "生理女", role: "member", points: 5, groupPoints: 2, joinDate: "2026-07-06" },
  { id: 4, email: "david@singbowl.com", name: "陳大衛", phone: "0933-111-222", gender: "生理男", role: "member", points: 1, groupPoints: 0, joinDate: "2026-07-07" }
];

const DEFAULT_VOUCHERS = [
  { id: 1, userId: 2, name: "生日優惠贈送次數", bonusPoints: 1, status: "used", code: "BDAY1" },
  { id: 2, userId: 2, name: "團體頌缽1次", bonusPoints: 1, status: "available", code: "GRP05" },
  { id: 3, userId: 3, name: "生日優惠贈送次數", bonusPoints: 1, status: "available", code: "BDAY1" },
  { id: 4, userId: 4, name: "團體頌缽1次", bonusPoints: 1, status: "available", code: "GRP05" }
];

/* 優惠票券「類型」範本 — 管理員可自行新增/刪除，用於促銷活動
   pointType: giftedPoints(贈送-1對1) / giftedGroupPoints(贈送-團體) / points(通用)
   validMonths: 發放後幾個月到期；填 0 代表永不過期 */
const DEFAULT_COUPON_TEMPLATES = [
  { id: 1, name: "生日優惠贈送次數", bonusPoints: 1, pointType: "giftedPoints", validMonths: 2 },
  { id: 2, name: "團體頌缽1次", bonusPoints: 1, pointType: "giftedGroupPoints", validMonths: 2 }
];

const DEFAULT_GROUP_SESSIONS = [
  { id: 1, title: "週一晚間頌缽冥想", time: "每週一 19:30 - 20:30", maxCapacity: 10, currentCapacity: 8, pointCost: 1 },
  { id: 2, title: "週三午間放鬆療癒", time: "每週開課 12:30 - 13:30", maxCapacity: 10, currentCapacity: 10, pointCost: 1 }, // 預設已額滿
  { id: 3, title: "週五晚間身心平衡", time: "每週五 19:00 - 20:00", maxCapacity: 10, currentCapacity: 5, pointCost: 1 },
  { id: 4, title: "週六早晨能量提升", time: "每週六 10:00 - 11:00", maxCapacity: 10, currentCapacity: 2, pointCost: 1 }
];

const DEFAULT_BOOKINGS = [
  { id: 1001, userId: 2, type: "1on1", slotId: 2, date: "2026-07-12", time: "14:00", duration: 60, cost: 1, notes: "最近睡眠品質不佳，希望能加強頭部釋壓。", status: "已確認", timestamp: "2026-07-08 14:32" },
  { id: 1002, userId: 3, type: "group", sessionId: 1, title: "週一晚間頌缽冥想", date: "2026-07-13", time: "19:30 - 20:30", cost: 1, notes: "", status: "已確認", timestamp: "2026-07-08 16:15" },
  { id: 1003, userId: 4, type: "1on1", slotId: 4, date: "2026-07-15", time: "10:30", duration: 60, cost: 1, notes: "", status: "待確認", timestamp: "2026-07-09 11:20" }
];

const DEFAULT_TRANSACTIONS = [
  { id: 5001, userId: 2, amount: 8, type: "add", reason: "生日優惠贈送次數", date: "2026-07-05 10:00", balance: 8 },
  { id: 5002, userId: 2, amount: 1, type: "deduct", reason: "預約 1 對 1 療癒", date: "2026-07-06 14:00", balance: 7 },
  { id: 5003, userId: 3, amount: 5, type: "add", reason: "後台調整可約次數", date: "2026-07-06 12:00", balance: 5 },
  { id: 5004, userId: 4, amount: 1, type: "add", reason: "手動充值次數", date: "2026-07-07 15:30", balance: 1 }
];

// Secure SHA-256 Hashing helper
/* 已停用：登入密碼全部交由 Firebase Authentication 保管，本系統不再自行雜湊或儲存密碼。
   保留這個函式只是為了避免舊資料處理時意外報錯，正常流程不會呼叫到它。 */
async function hashPassword(password) {
  if (!password) return "";
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ============================================================
   ID 配號機制（防撞號）

   背景：這套系統的 id 是「拿本機那份陣列算最大值 +1」。如果本機快取比雲端舊，
   就會算出別人已經用過的號碼；而寫入時是用 id 當 key 覆蓋，撞號 = 有一筆資料被靜默蓋掉。
   （實際發生過：測試帳號與真實會員都拿到 users id=5。）

   兩道防線：
   1. _idFloor —— 同步的「發號地板」。記住每個集合這台裝置已知配發過的最大 id，
      即使本機陣列之後變舊/變短，也絕不會再發回已用過的號碼。存在 localStorage，重整後仍有效。
   2. getFreshNextId() —— 非同步，在真正建立資料前先向 Firebase 拉一次最新快照再算號，
      擋掉「另一台裝置剛剛才建立、我這邊還沒同步到」的跨裝置撞號。
   ============================================================ */
let _idFloor = {};
try {
  _idFloor = JSON.parse(localStorage.getItem("singbowl_id_floor") || "{}") || {};
} catch (e) {
  _idFloor = {};
}
function _saveIdFloor() {
  try {
    localStorage.setItem("singbowl_id_floor", JSON.stringify(_idFloor));
  } catch (e) { /* 隱私模式等寫不進去就算了，不影響功能 */ }
}
function _bumpIdFloor(ns, id) {
  if (!ns || !id) return;
  if (!_idFloor[ns] || id > _idFloor[ns]) {
    _idFloor[ns] = id;
    _saveIdFloor();
  }
}

/* ns（集合名稱，如 "bookings"）為選填；有帶就會啟用發號地板保護 */
function getNextId(array, startId, ns) {
  let next = Array.isArray(array)
    ? array.reduce((max, item) => item && item.id ? Math.max(max, item.id) : max, startId - 1) + 1
    : startId;
  if (ns && _idFloor[ns] && next <= _idFloor[ns]) {
    next = _idFloor[ns] + 1;
  }
  _bumpIdFloor(ns, next);
  return next;
}

/* 建立資料前先向 Firebase 拉最新快照再算號。
   離線或讀取失敗時退回本機計算（跟舊行為一致，不會讓功能整個掛掉）。 */
async function getFreshNextId(node, localArray, startId) {
  const localNext = getNextId(localArray, startId, node);
  try {
    const snap = await database.ref(node).once("value");
    const val = snap.val();
    const fresh = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)) : [];
    const remoteNext = getNextId(fresh, startId, node);
    const next = Math.max(localNext, remoteNext);
    _bumpIdFloor(node, next);
    return next;
  } catch (e) {
    console.error(`getFreshNextId("${node}") 讀取雲端最新資料失敗，退回本機快取計算:`, e);
    return localNext;
  }
}

/* 會員專用捷徑（維持既有呼叫方式） */
async function getFreshNextUserId(localArray, startId) {
  return getFreshNextId("users", localArray, startId);
}

// HTML escape helper (避免使用者輸入的姓名/銀行名稱等資料被當成 HTML 標籤解析)
function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ============================================================
   點數效期系統（批次制：先到期的先扣）
   ------------------------------------------------------------
   設計說明：
   - 每一筆加值/贈送都會產生一個「批次」，各自帶自己的到期日
   - 扣點時「快到期的先扣」，最不容易讓會員的點數白白過期
   - user.points / giftedPoints / giftedGroupPoints 三個整數欄位
     一律由批次總和自動算出（保持與舊程式碼相容，不用改讀取端）
   ============================================================ */

// 【設定】點數預設效期（月）。想改全站預設效期，改這個數字就好。
const POINT_VALIDITY_MONTHS = 3;

// 官方 LINE（點數相關疑問請洽此處）
const POINT_HELP_LINE_URL = "https://line.me/R/ti/p/%40197nfdme";

const POINT_TYPES = ["points", "giftedPoints", "giftedGroupPoints"];
const POINT_TYPE_LABEL = {
  points: "通用點數",
  giftedPoints: "贈送-1對1",
  giftedGroupPoints: "贈送-團體"
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 加 N 個月（自動處理月底，例如 1/31 加 1 個月 => 2/28）
function addMonthsStr(dateStr, months) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}

// 預設到期日 = 今天 + POINT_VALIDITY_MONTHS 個月
function defaultExpiryStr() {
  return addMonthsStr(todayStr(), POINT_VALIDITY_MONTHS);
}

// 到期日是否已過（expiresAt 為空 = 永不過期）
function isExpired(expiresAt, refDate) {
  if (!expiresAt) return false;
  return String(expiresAt) < String(refDate || todayStr());
}

// 距離到期還有幾天（永不過期回傳 null）
function daysUntil(expiresAt) {
  if (!expiresAt) return null;
  const [y, m, d] = String(expiresAt).split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

/* 舊資料轉換：既有會員只有整數點數、沒有批次。
   一律轉成「永不過期」的批次，避免既有客戶的點數被追溯砍掉。 */
function ensureBatches(user) {
  if (!user) return;
  if (!Array.isArray(user.pointBatches)) user.pointBatches = [];

  POINT_TYPES.forEach(type => {
    if (user[type] === undefined) user[type] = 0;
    const legacy = Number(user[type]) || 0;
    const batchSum = user.pointBatches
      .filter(b => b.type === type && !isExpired(b.expiresAt))
      .reduce((sum, b) => sum + (Number(b.remaining) || 0), 0);

    /* 整數欄位比批次總和「多」出來的部分，代表是還沒建立批次的點數
       （舊資料，或 Firebase 非同步載入後才進來的雲端資料）。
       一律補成「永不過期」的批次 —— 只會補、不會扣，
       確保任何載入順序下都不可能把會員既有的點數弄不見。 */
    if (legacy > batchSum) {
      user.pointBatches.push({
        id: `legacy-${type}-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: type,
        remaining: legacy - batchSum,
        expiresAt: null,           // 既有點數不追溯設效期
        grantedAt: user.joinDate || todayStr(),
        note: "系統轉換（原有點數，無期限）"
      });
    }
  });
}

/* 依批次重算三個整數欄位。
   注意：這裡刻意「不」呼叫 ensureBatches —— 因為到期掃描剛把過期批次移除後
   會呼叫本函式，若在此重新對帳會把剛過期的點數又補回來。 */
function syncPointTotals(user) {
  if (!user || !Array.isArray(user.pointBatches)) return;
  POINT_TYPES.forEach(type => {
    user[type] = user.pointBatches
      .filter(b => b.type === type && !isExpired(b.expiresAt))
      .reduce((sum, b) => sum + (Number(b.remaining) || 0), 0);
  });
}

/* 掃描並清除已過期的批次。回傳被清掉的明細（供寫入交易紀錄用） */
function expireUserBatches(user) {
  ensureBatches(user);
  const expired = user.pointBatches.filter(b => isExpired(b.expiresAt) && (Number(b.remaining) || 0) > 0);
  if (expired.length === 0) {
    syncPointTotals(user);
    return [];
  }
  user.pointBatches = user.pointBatches.filter(b => !isExpired(b.expiresAt));
  syncPointTotals(user);
  return expired.map(b => ({ type: b.type, amount: Number(b.remaining) || 0, expiresAt: b.expiresAt }));
}

/* 全體會員到期掃描：登入/載入時跑一次，把過期點數歸零並留下交易紀錄 */
function runExpirySweep() {
  let changed = false;
  users.forEach(user => {
    const expired = expireUserBatches(user);
    expired.forEach(e => {
      changed = true;
      transactions.push({
        // 到期掃描在同步流程中執行（雲端監聽器會立刻用到結果），故沿用同步配號，
        // 但帶入 ns 讓「發號地板」生效，避免本機快取變舊後發回已用過的號碼。
        id: getNextId(transactions, 5001, "transactions"),
        userId: user.id,
        date: todayStr(),
        type: "點數到期",
        item: `${POINT_TYPE_LABEL[e.type] || e.type} ${e.amount} 點已於 ${e.expiresAt} 到期`,
        amount: -e.amount,
        balance: user[e.type] || 0
      });
    });
  });
  if (changed) {
    dbSet("users", users);
    dbSet("transactions", transactions);
  }
  return changed;
}

/* 發放點數（唯一的加點入口）
   expiresAt 傳 null 代表永不過期；不傳則採用預設效期 */
function grantPoints(user, type, amount, expiresAt, note) {
  ensureBatches(user);
  amount = Number(amount) || 0;
  if (amount <= 0) return;
  user.pointBatches.push({
    id: `b${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: type,
    remaining: amount,
    expiresAt: expiresAt === undefined ? defaultExpiryStr() : (expiresAt || null),
    grantedAt: todayStr(),
    note: note || ""
  });
  syncPointTotals(user);
}

/* 扣點（唯一的扣點入口）：快到期的先扣。
   回傳消耗明細，退點時可原封不動還回去，不會偷偷延長效期。 */
function consumePoints(user, type, amount) {
  ensureBatches(user);
  amount = Number(amount) || 0;
  const consumed = [];
  const pool = user.pointBatches
    .filter(b => b.type === type && !isExpired(b.expiresAt) && (Number(b.remaining) || 0) > 0)
    .sort((a, b) => {
      // 永不過期的排最後，其餘照到期日由近到遠
      if (!a.expiresAt && !b.expiresAt) return 0;
      if (!a.expiresAt) return 1;
      if (!b.expiresAt) return -1;
      return a.expiresAt < b.expiresAt ? -1 : 1;
    });
  let left = amount;
  for (const batch of pool) {
    if (left <= 0) break;
    const take = Math.min(batch.remaining, left);
    batch.remaining -= take;
    left -= take;
    consumed.push({ type: type, amount: take, expiresAt: batch.expiresAt, note: batch.note || "" });
  }
  user.pointBatches = user.pointBatches.filter(b => (Number(b.remaining) || 0) > 0);
  syncPointTotals(user);
  return consumed;
}

/* 退點：把當初扣掉的批次原樣還回去（保留原到期日） */
function restorePoints(user, consumedRecord, note) {
  ensureBatches(user);
  if (!Array.isArray(consumedRecord) || consumedRecord.length === 0) return false;
  consumedRecord.forEach(c => {
    // 原批次若已過期就不還了，避免還回一批立刻消失的點數造成困惑
    if (isExpired(c.expiresAt)) return;
    grantPoints(user, c.type, c.amount, c.expiresAt, note || "預約取消退回");
  });
  syncPointTotals(user);
  return true;
}

// 取得某會員各類點數的到期明細（會員中心顯示用）
function getExpiryBreakdown(user) {
  ensureBatches(user);
  return user.pointBatches
    .filter(b => !isExpired(b.expiresAt) && (Number(b.remaining) || 0) > 0)
    .sort((a, b) => {
      if (!a.expiresAt && !b.expiresAt) return 0;
      if (!a.expiresAt) return 1;
      if (!b.expiresAt) return -1;
      return a.expiresAt < b.expiresAt ? -1 : 1;
    });
}

// Helper to get user Firebase path key (UID or manual_email or numeric_id)
function getUserPathKey(user) {
  if (!user) return "";
  if (user.firebaseUid) return user.firebaseUid;
  if (user.email) {
    if (user.email === "admin@singbowl.com") return "0";
    if (currentUser && currentUser.email === user.email && auth.currentUser) {
      return auth.currentUser.uid;
    }
    return "manual_" + user.email.trim().toLowerCase().replace(/[@.]/g, "_");
  }
  return String(user.id);
}

/* 讀取 LINE 推播需要的兩個設定。回傳 {webhookUrl, apiSecret}，缺任一個就回傳 null。
   抽出來是因為自動提醒要一次送很多則，不該每一則都重讀一次 Firebase。 */
function getLineConfig(alertOnMissing) {
  return Promise.all([
    database.ref("settings/lineWebhookUrl").once("value"),
    database.ref("settings/lineApiSecret").once("value"),
    database.ref("settings/adminLineUserId").once("value")
  ]).then(([urlSnap, secretSnap, adminSnap]) => {
    const webhookUrl = urlSnap.val();
    const apiSecret = secretSnap.val();
    if (!webhookUrl) {
      console.warn("[LINE通知] 未設定 LINE Webhook URL，跳過通知。");
      if (alertOnMissing) alert("⚠️ LINE 通知發送失敗：尚未設定 LINE Webhook 代理 URL。\n\n請至管理後台 > 時段開放設定 > 展開 LINE 通知設定，貼上您的 Google Apps Script 部署網址。");
      return null;
    }
    if (!apiSecret) {
      console.warn("[LINE通知] 未設定 lineApiSecret，跳過通知。");
      if (alertOnMissing) alert("⚠️ LINE 通知發送失敗：Firebase 資料庫中尚未設定 lineApiSecret。\n\n請至 Firebase Console > Realtime Database > Data，在 settings 節點下新增 lineApiSecret（值需與 GAS 後端設定的密鑰一致）。");
      return null;
    }
    // adminLineUserId 只有自動提醒的管理員彙總會用到，沒設定不影響一般通知
    return { webhookUrl, apiSecret, adminLineUserId: adminSnap.val() || null };
  }).catch(err => {
    console.error("[LINE通知] ❌ 無法讀取 Firebase settings:", err);
    if (alertOnMissing) alert("⚠️ 無法讀取 LINE 通知設定。請確認 Firebase 安全規則已正確部署（settings 節點需允許 auth != null 讀取）。");
    return null;
  });
}

/* 直接對某個 LINE User ID 推播。cfg 由 getLineConfig() 取得。
   注意 no-cors 模式下讀不到回應內容，送出成功不代表 LINE 端收到。 */
function pushLineMessage(lineUserId, message, cfg, alertOnFail) {
  if (!cfg || !lineUserId) return Promise.resolve(false);
  return fetch(cfg.webhookUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ lineUserId: lineUserId, message: message, apiSecret: cfg.apiSecret })
  })
  .then(res => {
    console.log("[LINE通知] ✅ 請求已成功送出（no-cors 模式，回應類型:", res.type, "）");
    return true;
  })
  .catch(err => {
    console.error("[LINE通知] ❌ 網路請求失敗:", err);
    if (alertOnFail) alert("⚠️ LINE 通知發送失敗：網路請求錯誤。請確認 GAS 部署網址是否正確。");
    return false;
  });
}

// LINE Push Notification Sender Helper (含 API 密鑰驗證)
function sendLineNotification(userId, message) {
  const member = users.find(u => u.id === userId);
  if (!member || !member.lineUserId) {
    console.warn("[LINE通知] 此會員無 LINE User ID，userId:", userId);
    return;
  }

  const isAdmin = currentUser && currentUser.role === "admin";
  console.log(`[LINE通知] 準備發送給 ${member.name} (lineUserId: ${member.lineUserId})...`);

  getLineConfig(isAdmin).then(cfg => {
    if (!cfg) return;
    console.log(`[LINE通知] 正在發送至 GAS Webhook...`);
    pushLineMessage(member.lineUserId, message, cfg, isAdmin);
  });
}

/* 會員送出匯款對帳回條時，立刻通知管理員。
   沒設定 adminLineUserId 就靜靜跳過 —— 這是附加通知，不該影響會員送出流程，
   所以全程不對會員跳任何錯誤訊息。 */
function notifyAdminNewRemittance(remit) {
  getLineConfig(false).then(cfg => {
    if (!cfg || !cfg.adminLineUserId) {
      console.warn("[匯款通知] 未設定 settings/adminLineUserId，略過管理員通知。");
      return;
    }
    const msg =
      `💰 有新的匯款待審核\n\n` +
      `👤 會員：${remit.userName}（${remit.userPhone || "無電話"}）\n` +
      `💵 金額：$${remit.amount}\n` +
      `🏦 匯出：${remit.bankName} / 後五碼 ${remit.last5}\n` +
      `🕒 匯款時間：${remit.remittedAt || "未填"}\n` +
      (remit.note ? `📝 備註：${remit.note}\n` : "") +
      `\n請到管理後台 →「匯款對帳審核」核對款項後發放點數。`;
    pushLineMessage(cfg.adminLineUserId, msg, cfg, false);
  }).catch(err => console.error("[匯款通知] 發送失敗:", err));
}

// ==========================================
// 2.5 自動提醒（明日預約 ＋ 點數即將到期）
// ==========================================
/* 這是 GitHub Pages 靜態網站，沒有後端，所以同一套規則有兩個執行點：
     1. tools/gas-daily-reminder.gs —— GAS 每日觸發器，沒人開網頁也會跑（主力）
     2. 本檔的 runReminderSweep() —— 管理員開後台時補跑一次（保險）
   兩邊都先查 notifyLog 再送，同一則通知只會送出一次，所以重複執行是安全的。
   notifyLog 的 key 設計與 GAS 端必須一致，改這裡就要一起改那支。 */

const REMIND_BEFORE_DAYS = 1;          // 預約提醒：前一天
const POINT_EXPIRY_NOTICE_MONTHS = 1;  // 點數到期通知：到期日 1 個月前
let reminderSweepDone = false;         // 同一次登入只掃一次
/* 兩個雲端監聽器各自回來的時間不固定，而 bookings 初始就是空陣列 ——
   若只看「是不是陣列」，users 先到時會在零筆預約的狀態下掃完並標記完成，
   當天的預約提醒就整批漏掉。所以要等兩邊都真的回報過一次才動。 */
const reminderDataReady = { users: false, bookings: false };

function dateStrOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 提醒只送已確認的預約 —— 還沒確認的不該叫會員準時到，那些改列在管理員清單裡待處理
function isRemindableBooking(b, targetDate) {
  return b && b.date === targetDate && b.status === "已確認";
}

function bookingLabel(b) {
  return b.type === "group" ? (b.title || "團體頌缽") : "1對1 頌缽體驗";
}

function buildMemberBookingReminder(b) {
  return `🔔 明日預約提醒\n\n` +
         `親愛的會員，提醒您明天有一場預約：\n\n` +
         `📅 日期：${b.date}\n` +
         `⏰ 時間：${b.time}\n` +
         `🧘 項目：${bookingLabel(b)}\n\n` +
         `期待明天與您見面。若需調整時間，請儘早私訊官方 LINE 讓我們知道。`;
}

function buildAdminDailyDigest(targetDate, confirmed, pending) {
  let msg = `📋 明日預約清單（${targetDate}）\n\n`;
  if (confirmed.length === 0 && pending.length === 0) {
    return msg + `明天沒有任何預約，可以安心休息。`;
  }
  if (confirmed.length > 0) {
    msg += `✅ 已確認 ${confirmed.length} 筆\n`;
    confirmed.forEach(b => {
      const m = users.find(u => u.id === b.userId);
      msg += `　${b.time}｜${m ? m.name : "未知會員"}｜${bookingLabel(b)}\n`;
      if (b.notes) msg += `　　備註：${b.notes}\n`;
    });
  }
  if (pending.length > 0) {
    msg += `\n⚠️ 尚未確認 ${pending.length} 筆（會員不會收到提醒）\n`;
    pending.forEach(b => {
      const m = users.find(u => u.id === b.userId);
      msg += `　${b.time}｜${m ? m.name : "未知會員"}｜${bookingLabel(b)}\n`;
    });
  }
  return msg;
}

function buildPointExpiryNotice(member, batches) {
  const lines = batches.map(b =>
    `　${POINT_TYPE_LABEL[b.type] || b.type} ${b.remaining} 次 — ${b.expiresAt}（剩 ${daysUntil(b.expiresAt)} 天）`
  ).join("\n");
  return `⏳ 點數即將到期提醒\n\n` +
         `${member.name} 您好，您有點數將在一個月內到期：\n\n` +
         `${lines}\n\n` +
         `到期後將自動失效，系統會「先到期的先扣」。\n` +
         `若想在期限內使用，歡迎到會員中心預約時段。\n\n` +
         `如對效期有疑問，請詢問官方 LINE，我們會協助確認。`;
}

/* 管理員開後台時補跑一次。GAS 若已送過，這裡會因 notifyLog 有紀錄而跳過。 */
function runReminderSweep(source) {
  if (source) reminderDataReady[source] = true;
  if (reminderSweepDone) return;
  if (!currentUser || currentUser.role !== "admin") return;
  if (!reminderDataReady.users || !reminderDataReady.bookings) return;
  reminderSweepDone = true;

  const target = dateStrOffset(REMIND_BEFORE_DAYS);
  const today = todayStr();
  const expiryDeadline = addMonthsStr(today, POINT_EXPIRY_NOTICE_MONTHS);

  getLineConfig(false).then(cfg => {
    if (!cfg) {
      console.warn("[自動提醒] LINE 設定不完整，略過本次掃描。");
      return;
    }
    return database.ref("notifyLog").once("value").then(snap => {
      const log = snap.val() || {};
      const sentBooking = log.booking || {};
      const sentExpiry = log.pointExpiry || {};
      const sentDigest = log.adminDigest || {};
      const writes = {};
      let count = 0;

      // ── 1. 明日預約：通知會員 ──
      const confirmed = bookings.filter(b => isRemindableBooking(b, target));
      const pending = bookings.filter(b => b && b.date === target && b.status === "待確認");

      confirmed.forEach(b => {
        if (sentBooking[b.id]) return;                 // GAS 或先前已送過
        const member = users.find(u => u.id === b.userId);
        if (!member || !member.lineUserId) return;      // 沒綁 LINE 的送不了
        pushLineMessage(member.lineUserId, buildMemberBookingReminder(b), cfg, false);
        writes[`booking/${b.id}`] = target;
        count++;
      });

      // ── 2. 明日預約：通知管理員（每天一則彙總，含未確認的）──
      // 沒設定 adminLineUserId 時不寫 log，這樣設定好之後下次進後台還會補送。
      if (!sentDigest[target] && cfg.adminLineUserId) {
        pushLineMessage(cfg.adminLineUserId, buildAdminDailyDigest(target, confirmed, pending), cfg, false);
        writes[`adminDigest/${target}`] = Date.now();
        count++;
      } else if (!sentDigest[target]) {
        console.warn("[自動提醒] 未設定 settings/adminLineUserId，管理員彙總未發送。");
      }

      // ── 3. 點數到期：到期日在一個月內、且尚未通知過的批次 ──
      users.forEach(member => {
        if (!member.lineUserId) return;
        ensureBatches(member);
        const due = (member.pointBatches || []).filter(b =>
          b.expiresAt &&
          !isExpired(b.expiresAt) &&
          String(b.expiresAt) <= expiryDeadline &&
          (Number(b.remaining) || 0) > 0 &&
          !sentExpiry[`${member.id}_${b.id}`]
        );
        if (due.length === 0) return;
        pushLineMessage(member.lineUserId, buildPointExpiryNotice(member, due), cfg, false);
        due.forEach(b => { writes[`pointExpiry/${member.id}_${b.id}`] = today; });
        count++;
      });

      if (Object.keys(writes).length > 0) {
        return database.ref("notifyLog").update(writes)
          .then(() => console.log(`[自動提醒] 本次補送 ${count} 則通知。`));
      }
      console.log("[自動提醒] 沒有需要補送的通知（GAS 應已處理）。");
    });
  }).catch(err => console.error("[自動提醒] 掃描失敗:", err));
}

// Google Calendar URL Generator
function generateGoogleCalendarUrl(booking) {
  const typeName = booking.type === "1on1" ? "1對1 頌缽療癒" : (booking.title || "團體頌缽");
  
  // Parse date and time
  const dateParts = booking.date.split('-'); // e.g. 2026-07-20
  const dateStr = dateParts.join(''); // e.g. 20260720
  
  const timeParts = (booking.time || "10:00").split(':');
  const hour = timeParts[0];
  const minute = timeParts[1] || '00';
  const timeStr = hour + minute; // e.g. 1600
  
  const typeFlag = booking.type === "1on1" ? "1" : "2";
  
  // Format: YYYYMMDD|HHMM|type|title
  const rawString = `${dateStr}|${timeStr}|${typeFlag}|${typeName}`;
  // Encode in UTF-8 base64
  const base64 = btoa(unescape(encodeURIComponent(rawString)));
  
  // Return redirector URL
  return `https://ronwang82-singingbowl.github.io/adayofsingingbowl/member/r.html?c=${base64}`;
}

// Helper functions for LocalStorage persistence
function dbGet(key, defaultData) {
  try {
    const data = localStorage.getItem(`singbowl_${key}`);
    if (!data || data === "undefined" || data === "null") return defaultData;
    const parsed = JSON.parse(data);
    return parsed !== null ? parsed : defaultData;
  } catch (e) {
    console.error(`dbGet error for key ${key}:`, e);
    return defaultData;
  }
}

// Firebase Realtime Database Config
const firebaseConfig = {
  apiKey: "AIzaSyBHHHTPJuNcuDtaXDwbxHiudt92bdo2ecA",
  authDomain: "adayofsingingbowl.firebaseapp.com",
  databaseURL: "https://adayofsingingbowl-default-rtdb.firebaseio.com",
  projectId: "adayofsingingbowl",
  storageBucket: "adayofsingingbowl.firebasestorage.app",
  messagingSenderId: "233780083777",
  appId: "1:233780083777:web:5040b756a6877282c85ac0",
  measurementId: "G-GQ9VXG0GH0"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
let pushTimeout = null;

// 統一的雲端寫入失敗處理：一律記錄到 console 方便排查；管理員登入時另外跳警示視窗
// （會員端不跳窗是為了避免暫時性網路問題嚇到一般使用者，但錯誤都會被記下來）
function handleDbWriteError(err, context) {
  console.error(`[雲端資料寫入失敗] ${context || "未指定操作"}:`, err);
  if (currentUser && currentUser.role === "admin") {
    alert(`⚠️ 資料庫寫入失敗（${context || "未指定操作"}）：${err && err.message ? err.message : err}\n\n請確認 Firebase 安全規則設定正確，或稍後再試一次。`);
  }
}

function dbSet(key, data, syncToCloud = true) {
  localStorage.setItem(`singbowl_${key}`, JSON.stringify(data));
  if (syncToCloud) {
    pushNode(key, data);
  }
}

// Google API Integration variables
let googleTokenClient = null;
let googleAccessToken = null;
let googleClientId = "";

// Global state variables
let users = dbGet("users", DEFAULT_USERS);
let bookings = dbGet("bookings", DEFAULT_BOOKINGS);
let vouchers = dbGet("vouchers", DEFAULT_VOUCHERS);
let couponTemplates = dbGet("couponTemplates", DEFAULT_COUPON_TEMPLATES);
let groupSessions = dbGet("groupSessions", DEFAULT_GROUP_SESSIONS);
let transactions = dbGet("transactions", DEFAULT_TRANSACTIONS);
let slots = dbGet("slots", DEFAULT_SLOTS);
let remittances = dbGet("remittances", []);
let courses = dbGet("courses", []);
let activeCourse = null;
let activeLesson = null;
let currentUser = null;

// Save initial database state (local-only, do not write to cloud on load)
dbSet("users", users, false);
dbSet("bookings", bookings, false);
dbSet("vouchers", vouchers, false);
dbSet("couponTemplates", couponTemplates, false);
dbSet("groupSessions", groupSessions, false);
dbSet("transactions", transactions, false);
dbSet("slots", slots, false);
dbSet("remittances", remittances, false);
dbSet("courses", courses, false);

/* 載入時先把所有會員的點數批次補齊（舊資料轉換），
   再跑一次到期掃描，把已過期的點數自動歸零並留下交易紀錄。 */
users.forEach(u => ensureBatches(u));
runExpirySweep();

// ==========================================
// 2. 視圖切換與路由 (Router)
// ==========================================

const VIEWS = [
  "landing", "auth", "register", "member", "edit-profile", "book",
  "admin", "admin-points", "admin-add-member", "admin-edit-member", "buy-points",
  "admin-approve-remittance", "admin-reject-remittance", "admin-reschedule",
  "courses", "course-detail", "lesson-player", "admin-edit-course"
];

/* 手機的滑動返回 / 上一頁
   ------------------------------------------------------------------
   這是單頁式網站，navigateTo() 只是把區塊顯示／隱藏，本來完全沒有寫入
   瀏覽器歷史。所以從 LINE 開啟時，整站在歷史上只有「一頁」，使用者一按
   上一頁就直接離開網站、跳回 LINE 對話 —— 而不是回到站內的前一頁。

   作法：每次切換頁面就 pushState 留一筆，並監聽 popstate 在返回時切回去。
   fromPopstate 是為了避免「返回時又推一筆新紀錄」造成上一頁按不動。 */
let fromPopstate = false;

function navigateTo(viewId) {
  // 返回造成的切換不能再推一筆，否則上一頁會按不動（推一筆、退一筆，原地打轉）
  if (!fromPopstate && (!history.state || history.state.view !== viewId)) {
    history.pushState({ view: viewId }, "", "#" + viewId);
  }

  if (viewId === "auth") {
    const optionsContainer = document.getElementById("authOptionsContainer");
    const emailForm = document.getElementById("formEmailAuth");
    const backBtn = document.getElementById("btnAuthBack");
    const emailInput = document.getElementById("authEmail");
    const passwordInput = document.getElementById("authPassword");
    
    if (optionsContainer) optionsContainer.style.display = "block";
    if (backBtn) backBtn.style.display = "block";
    if (emailForm) emailForm.style.display = "none";
    if (emailInput) {
      emailInput.readOnly = false;
      emailInput.value = "";
    }
    if (passwordInput) {
      passwordInput.value = "";
    }
  }
  
  VIEWS.forEach(view => {
    const el = document.getElementById(`view-${view}`);
    if (el) {
      if (view === viewId) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    }
  });

  // Scroll to top of view
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Hide ripple soundwave animation on buy-points view to avoid performance lag
  const rippleField = document.querySelector(".ripple-field");
  if (rippleField) {
    if (viewId === "buy-points") {
      rippleField.style.display = "none";
    } else {
      rippleField.style.display = "";
    }
  }

  // Update navigation items state
  updateNavState(viewId);

  // Trigger page-specific renders
  if (viewId === "member") renderDashboard();
  if (viewId === "book") switchBookingTab("1on1");
  if (viewId === "buy-points") renderBuyPointsPage();
  if (viewId === "courses") renderCoursesPage();
  if (viewId === "course-detail") renderCourseDetailPage();
  if (viewId === "lesson-player") renderLessonPlayerPage();
  if (viewId === "admin") renderAdminDashboard("overview");
}

/* 按下手機返回 / 上一頁時切回站內的前一頁。
   已登出卻返回到會員專屬頁面時，導回首頁而不是顯示空白內容。 */
window.addEventListener("popstate", (e) => {
  const viewId = (e.state && e.state.view) || "landing";
  const el = document.getElementById("view-" + viewId);
  if (!el) return;

  const memberOnly = ["member", "admin", "buy-points", "book", "edit-profile",
                      "admin-points", "admin-add-member", "admin-edit-member",
                      "admin-reschedule", "courses", "course-detail",
                      "lesson-player", "admin-edit-course"];
  const target = (!currentUser && memberOnly.includes(viewId)) ? "landing" : viewId;

  fromPopstate = true;
  try { navigateTo(target); } finally { fromPopstate = false; }
});

function updateNavState(viewId) {
  // Highlight navigation item
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  if (viewId === "landing") document.getElementById("btnNavHome")?.classList.add("active");
  if (viewId === "member") document.getElementById("btnNavMember")?.classList.add("active");
  if (viewId === "buy-points") document.getElementById("btnNavBuyPoints")?.classList.add("active");
  if (viewId === "courses") document.getElementById("btnNavCourses")?.classList.add("active");
  if (viewId === "admin") document.getElementById("btnNavAdmin")?.classList.add("active");
}

// Restore user session on load using Firebase Auth
function initSession() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      console.log("Firebase Auth 登入狀態變更: 已登入", user.email, user.uid);
      try {
        // 1. 讀取最新安全 UID 的用戶資料
        const snapshot = await database.ref(`users/${user.uid}`).once("value");
        const profile = snapshot.val();
        
        if (profile) {
          currentUser = profile;
          localStorage.setItem("singbowl_current_user_id", currentUser.id);
          onUserLoginSuccess();
        } else {
          // 2. 找不到 UID 的資料，進行「舊帳號安全搬遷 (Migration)」檢查
          const email = user.email ? user.email.toLowerCase() : "";
          if (email) {
            console.log("啟動帳號安全資料搬遷偵測: ", email);
            const usersSnapshot = await database.ref("users").orderByChild("email").equalTo(email).once("value");
            const allUsers = usersSnapshot.val();
            let foundOldUser = null;
            let oldKey = null;
            
            if (allUsers) {
              if (Array.isArray(allUsers)) {
                for (let i = 0; i < allUsers.length; i++) {
                  if (allUsers[i] && allUsers[i].email && allUsers[i].email.toLowerCase() === email) {
                    foundOldUser = allUsers[i];
                    oldKey = i;
                    break;
                  }
                }
              } else {
                for (const key in allUsers) {
                  if (allUsers[key] && allUsers[key].email && allUsers[key].email.toLowerCase() === email) {
                    foundOldUser = allUsers[key];
                    oldKey = key;
                    break;
                  }
                }
              }
            }
            
            if (foundOldUser) {
              console.log("找到符合遷移條件的舊帳號，搬遷中...", foundOldUser.name);
              // 寫入新安全路徑，並標記與清除舊路徑
              foundOldUser.firebaseUid = user.uid;
              await database.ref(`users/${user.uid}`).set(foundOldUser);
              
              // 刪除舊路徑
              await database.ref(`users/${oldKey}`).remove();
              
              currentUser = foundOldUser;
              localStorage.setItem("singbowl_current_user_id", currentUser.id);
              onUserLoginSuccess();
              return;
            }
          }
          
          // 3. 全新註冊流程：若找不到舊帳號，待註冊寫入
          console.log("未找到舊帳號資料，待註冊寫入");
        }
      } catch (err) {
        console.error("載入使用者安全 Profile 失敗", err);
        auth.signOut();
      }
    } else {
      console.log("Firebase Auth 登入狀態變更: 未登入");
      onUserLogoutSuccess();
    }
  });
}

function onUserLoginSuccess() {
  // Show header user state
  document.getElementById("btnHeaderLogin").style.display = "none";
  document.getElementById("headerUserMenu").style.display = "flex";
  document.getElementById("headerUserName").textContent = currentUser.name;
  
  // Hide Home button when logged in
  document.getElementById("btnNavHome").style.display = "none";
  
  // Show nav links based on role
  document.getElementById("btnNavMember").style.display = "block";
  const navBuyPoints = document.getElementById("btnNavBuyPoints");
  if (navBuyPoints) navBuyPoints.style.display = "block";
  document.getElementById("btnNavCourses").style.display = "block";
  if (currentUser.role === "admin") {
    document.getElementById("btnNavAdmin").style.display = "block";
    localStorage.setItem("singbowl_debug_banner", "1"); // 管理員登入後才顯示除錯錯誤橫幅
    navigateTo("admin");
  } else {
    document.getElementById("btnNavAdmin").style.display = "none";
    localStorage.removeItem("singbowl_debug_banner");
    navigateTo("member");
  }

  // 註冊該用戶專屬的即時監聽器
  startRealtimeSync();
}

function onUserLogoutSuccess() {
  currentUser = null;
  localStorage.removeItem("singbowl_current_user_id");
  localStorage.removeItem("singbowl_debug_banner");
  
  // Hide headers
  document.getElementById("btnHeaderLogin").style.display = "block";
  document.getElementById("headerUserMenu").style.display = "none";
  document.getElementById("btnNavMember").style.display = "none";
  const navBuyPoints = document.getElementById("btnNavBuyPoints");
  if (navBuyPoints) navBuyPoints.style.display = "none";
  document.getElementById("btnNavCourses").style.display = "none";
  document.getElementById("btnNavAdmin").style.display = "none";
  
  // Show Home button when logged out
  document.getElementById("btnNavHome").style.display = "block";
  
  // 重新註冊訪客級即時監聽器
  startRealtimeSync();
  
  const activeSection = document.querySelector(".view-section.active");
  const activeView = activeSection ? activeSection.id.replace("view-", "") : "landing";
  const memberOnlyViews = ["member", "admin", "buy-points", "book", "edit-profile", "admin-points", "admin-add-member", "admin-edit-member", "admin-reschedule", "courses", "course-detail", "lesson-player", "admin-edit-course"];
  if (memberOnlyViews.includes(activeView)) {
    navigateTo("landing");
  }
}

// ==========================================
// 3. 前台頁面渲染 (Member UI Rendering)
// ==========================================

function renderDashboard() {
  if (!currentUser) return;
  
  // Profile Meta
  document.getElementById("lblMemberName").textContent = currentUser.name;
  document.getElementById("memberAvatar").textContent = currentUser.name.charAt(0);
  document.getElementById("lblMemberEmail").textContent = currentUser.email;
  document.getElementById("lblMemberPhone").textContent = currentUser.phone;
  document.getElementById("lblMemberGender").textContent = currentUser.gender;
  document.getElementById("lblMemberJoinDate").textContent = currentUser.joinDate;
  
  // Points Display — 先掃描到期，確保顯示的是真正還能用的點數
  expireUserBatches(currentUser);

  const total1on1 = currentUser.points + currentUser.giftedPoints;
  const totalGroup = currentUser.points + currentUser.giftedGroupPoints;

  document.getElementById("lblMemberPoints").textContent = total1on1;
  document.getElementById("lblMemberGroupPoints").textContent = totalGroup;

  const pointsTip = document.querySelector(".points-tip");
  if (pointsTip) {
    // 各批點數的到期明細
    const batches = getExpiryBreakdown(currentUser);
    let expiryHtml = "";
    if (batches.length > 0) {
      const rows = batches.map(b => {
        const label = POINT_TYPE_LABEL[b.type] || b.type;
        if (!b.expiresAt) {
          return `<li>${label} <strong>${b.remaining}</strong> 次 — 無使用期限</li>`;
        }
        const d = daysUntil(b.expiresAt);
        const urgent = d !== null && d <= 14;
        return `<li>${label} <strong>${b.remaining}</strong> 次 — 效期至 <strong>${esc(b.expiresAt)}</strong>` +
               (urgent ? ` <span style="color:#C0392B;font-weight:600;">（剩 ${d} 天，即將到期）</span>` : ` <span style="color:var(--mist);">（剩 ${d} 天）</span>`) +
               `</li>`;
      }).join("");
      expiryHtml =
        `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--hairline);">` +
        `<div style="font-weight:600;margin-bottom:6px;">⏳ 點數使用期限</div>` +
        `<ul style="margin:0;padding-left:18px;line-height:1.9;">${rows}</ul>` +
        `<div style="margin-top:8px;color:var(--mist);font-size:12.5px;line-height:1.7;">` +
        `點數到期後將自動失效，系統會依「先到期的先扣」自動使用。<br>` +
        `如對點數效期有任何疑問，歡迎詢問<a href="${POINT_HELP_LINE_URL}" target="_blank" rel="noopener" style="color:var(--brass-dim);text-decoration:underline;">官方 LINE</a>，我們會協助您確認。` +
        `</div></div>`;
    } else {
      expiryHtml =
        `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--hairline);color:var(--mist);font-size:12.5px;line-height:1.7;">` +
        `如對點數效期有任何疑問，歡迎詢問<a href="${POINT_HELP_LINE_URL}" target="_blank" rel="noopener" style="color:var(--brass-dim);text-decoration:underline;">官方 LINE</a>，我們會協助您確認。` +
        `</div>`;
    }

    pointsTip.innerHTML = `💡 您擁有的額度明細：通用點數：<strong>${currentUser.points}</strong> 次（1對1及團體皆可折抵）<br>` +
                          `贈送-1對1：<strong>${currentUser.giftedPoints}</strong> 次（限1對1）/ 贈送-團體：<strong>${currentUser.giftedGroupPoints}</strong> 次（限團體）。` +
                          expiryHtml;
  }

  // Vouchers List
  const vouchersContainer = document.getElementById("memberVouchersList");
  const userVouchers = vouchers.filter(v => v.userId === currentUser.id);
  vouchersContainer.innerHTML = "";
  
  if (userVouchers.length === 0) {
    vouchersContainer.innerHTML = `<div class="no-vouchers">目前沒有可用優惠票券</div>`;
  } else {
    userVouchers.forEach(v => {
      const item = document.createElement("div");
      item.className = "voucher-item";
      const vExpired = isExpired(v.expiresAt);
      let expiryLine = "";
      if (v.expiresAt) {
        const d = daysUntil(v.expiresAt);
        expiryLine = vExpired
          ? `<p style="color:#C0392B;">已於 ${esc(v.expiresAt)} 到期</p>`
          : `<p style="color:${d <= 14 ? '#C0392B' : 'var(--mist)'};">效期至 ${esc(v.expiresAt)}（剩 ${d} 天）</p>`;
      }
      item.innerHTML = `
        <div class="voucher-info">
          <h4>${esc(v.name)}</h4>
          <p>代碼：${esc(v.code)} (${v.status === "used" ? "已使用" : "未使用"})</p>
          ${expiryLine}
        </div>
        <div class="voucher-bonus ${(v.status === "used" || vExpired) ? "used" : ""}">+${v.bonusPoints} 次</div>
      `;
      vouchersContainer.appendChild(item);
    });
  }
  
  // Point transactions
  const txContainer = document.getElementById("memberTxList");
  const userTxs = transactions.filter(t => t.userId === currentUser.id).sort((a,b) => b.id - a.id);
  txContainer.innerHTML = "";
  
  if (userTxs.length === 0) {
    txContainer.innerHTML = `<tr><td colspan="4" class="tx-empty">尚無任何增減明細</td></tr>`;
  } else {
    userTxs.forEach(t => {
      const row = document.createElement("tr");
      const isAdd = t.type === "add";
      const changeClass = isAdd ? "tx-add" : "tx-deduct";
      const sign = isAdd ? "+" : "-";
      
      row.innerHTML = `
        <td>${t.date.split(" ")[0]}</td>
        <td>${isAdd ? "額度增加" : "預約扣除"}</td>
        <td class="${changeClass}">${sign}${t.amount}</td>
        <td>${t.reason} (結餘: ${t.balance}次)</td>
      `;
      txContainer.appendChild(row);
    });
  }
  
  // Reservation History
  const reservationsContainer = document.getElementById("memberReservationsList");
  const userBookings = bookings.filter(b => b.userId === currentUser.id).sort((a,b) => b.id - a.id);
  reservationsContainer.innerHTML = "";
  
  if (userBookings.length === 0) {
    reservationsContainer.innerHTML = `
      <div class="no-reservations">
        <p>您目前沒有任何預約紀錄</p>
        <button class="cta-btn secondary-btn small-btn mt-12" id="btnDashBookNow">立即預約</button>
      </div>`;
    document.getElementById("btnDashBookNow")?.addEventListener("click", () => navigateTo("book"));
  } else {
    userBookings.forEach(b => {
      const resItem = document.createElement("div");
      resItem.className = "res-item";
      
      const typeLabel = b.type === "1on1" ? "1 對 1 頌缽療癒" : `團體課程 - ${b.title}`;
      let detailRow = "";
      if (b.type === "1on1") {
        detailRow = `
          <div class="res-detail-row"><i data-lucide="calendar"></i> <span>預約時間：${b.date} ${b.time}</span></div>
        `;
      } else {
        detailRow = `
          <div class="res-detail-row"><i data-lucide="calendar"></i> <span>上課時間：${b.date} ${b.time}</span></div>
        `;
      }
      
      const statusClass = b.status === "待確認" ? "status-pending" : 
                          b.status === "已確認" ? "status-confirmed" : 
                          b.status === "已完成" ? "status-completed" : "status-cancelled";
      
      // Allow cancellation if pending or confirmed
      const allowCancel = b.status === "待確認" || b.status === "已確認";
      const actionHtml = allowCancel ? `
        <div class="res-actions">
          <button class="cancel-txt-btn" onclick="cancelBooking(${b.id})"><i data-lucide="x-circle"></i> 取消預約</button>
        </div>
      ` : "";
      
      resItem.innerHTML = `
        <div class="res-item-header">
          <span class="res-type-badge">${typeLabel}</span>
          <span class="status-badge ${statusClass}">${b.status}</span>
        </div>
        <div class="res-details">
          ${detailRow}
          <div class="res-detail-row"><i data-lucide="coins"></i> <span>消耗次數：${b.cost} 次</span></div>
          ${b.notes ? `<div class="res-detail-row"><i data-lucide="message-square"></i> <span>備註需求：${b.notes}</span></div>` : ""}
        </div>
        ${actionHtml}
      `;
      reservationsContainer.appendChild(resItem);
    });
    // Re-initialize dynamic icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
}

// Handle Cancel Booking
window.cancelBooking = async function(bookingId) {
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return;
  
  // 5 天內預約限制規則：計算距離預約日期的天數差
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const bookingDate = new Date(booking.date);
  bookingDate.setHours(0, 0, 0, 0);
  
  const diffTime = bookingDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 5) {
    alert("⚠️ 很抱歉，本預約距離現在已不足 5 天，無法直接線上取消。\n\n如需取消預約，請私訊官方 LINE 帳號告知原因，由小編為您人工處理。\n\n官方 LINE: https://lin.ee/5FUzEjg");
    return;
  }
  
  if (confirm("確定要取消此預約嗎？\n您的預約額度將自動全額退還。")) {
    // 1. Update booking status
    booking.status = "已取消";
    dbSet("bookings", bookings);
    
    // Free up associated slot if exists
    if (booking.slotId) {
      const slot = slots.find(s => s.id === booking.slotId);
      if (slot) {
        slot.status = "open";
        slot.bookingId = null;
        dbSet("slots", slots);
      }
    }
    
    // 2. Refund points to user
    const member = users.find(u => u.id === booking.userId);
    if (member) {
      let currentBal = 0;
      const refundType = booking.paidBy || "common";
      const refundField = refundType === "gifted"
        ? (booking.type === "1on1" ? "giftedPoints" : "giftedGroupPoints")
        : "points";
      // 優先原樣退回當初扣掉的批次（保留原到期日）；舊資料沒記批次才退成預設效期
      if (Array.isArray(booking.consumedBatches) && booking.consumedBatches.length > 0) {
        restorePoints(member, booking.consumedBatches, "預約取消退回");
      } else {
        grantPoints(member, refundField, booking.cost, defaultExpiryStr(), "預約取消退回");
      }
      currentBal = member[refundField] || 0;
      dbSet("users", users);
      
      // 3. Log point transaction
      const newTxId = await getFreshNextId("transactions", transactions, 5001);
      const nowStr = getNowDateTimeString();
      const typeNameStr = booking.type === "1on1" ? "1對1" : "團體";
      const targetNameStr = refundType === "gifted" ? "贈送" : "通用";
      transactions.push({
        id: newTxId,
        userId: member.id,
        firebaseUid: auth.currentUser ? auth.currentUser.uid : null,
        amount: booking.cost,
        type: "add",
        reason: `取消預約退還(${typeNameStr})：ID ${booking.id} - 退回${targetNameStr}額度`,
        date: nowStr,
        balance: currentBal
      });
      dbSet("transactions", transactions);
    }
    
    const typeName = booking.type === "1on1" ? "1對1 頌缽療癒" : booking.title;
    sendLineNotification(booking.userId, `⚠️ 預約取消通知\n\n親愛的會員，您已成功取消原定於 ${booking.date} ${booking.time} 的【${typeName}】。\n\n您的預約次數已全額退還，期待您的下一次預約！`);

    alert("預約已取消，額度已全額退還！");
    renderDashboard();
  }
};

// Calendar state variables
let calCurrentYear = new Date().getFullYear();
let calCurrentMonth = new Date().getMonth();
let calSelectedDateStr = null;

// 團體頌缽預約日曆狀態 (與 1對1 日曆機制相同，但只挑選 type === "group" 的開放時段)
let groupCalCurrentYear = new Date().getFullYear();
let groupCalCurrentMonth = new Date().getMonth();
let groupCalSelectedDateStr = null;

// 「療癒預約」頁面內的頁籤切換：1對1 / 團體頌缽 共用同一個 view，只切換顯示哪個 panel
let activeBookingTab = "1on1";

function switchBookingTab(tab) {
  activeBookingTab = tab === "group" ? "group" : "1on1";

  document.querySelectorAll("#bookingTypeTabs .booking-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === activeBookingTab);
  });

  const panel1on1 = document.getElementById("bookPanel1on1");
  const panelGroup = document.getElementById("bookPanelGroup");
  if (panel1on1) panel1on1.style.display = activeBookingTab === "1on1" ? "block" : "none";
  if (panelGroup) panelGroup.style.display = activeBookingTab === "group" ? "block" : "none";

  if (activeBookingTab === "1on1") {
    render1on1Form();
  } else {
    renderGroupForm();
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Render 1on1 booking variables
function render1on1Form() {
  if (!currentUser) return;
  if (currentUser.points === undefined) currentUser.points = 0;
  if (currentUser.giftedPoints === undefined) currentUser.giftedPoints = 0;
  const total1on1 = currentUser.points + currentUser.giftedPoints;
  let pointsDisplay = total1on1 + " 次";
  if (currentUser.giftedPoints > 0) {
    pointsDisplay += ` (通用 ${currentUser.points} / 贈送 ${currentUser.giftedPoints})`;
  }
  document.getElementById("lblBook1on1UserPoints").textContent = pointsDisplay;
  
  calCurrentYear = new Date().getFullYear();
  calCurrentMonth = new Date().getMonth();
  calSelectedDateStr = null;
  
  document.getElementById("selectedSlotId").value = "";
  document.getElementById("bookingSlotsGrid").innerHTML = "";
  document.getElementById("lblSelectedDaySlots").textContent = "時段選擇 (請先點選上方日期)";
  
  renderBookingCalendar();
  update1on1Cost();
}

function renderBookingCalendar() {
  const lblMonthYear = document.getElementById("lblCalendarMonthYear");
  const daysGrid = document.getElementById("calendarDaysGrid");
  if (!lblMonthYear || !daysGrid) return;
  
  lblMonthYear.textContent = `${calCurrentYear} 年 ${calCurrentMonth + 1} 月`;
  daysGrid.innerHTML = "";
  
  const firstDay = new Date(calCurrentYear, calCurrentMonth, 1);
  const startDayOfWeek = firstDay.getDay();
  const totalDays = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();
  
  // Empty slots before first day
  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-day-cell empty-cell";
    daysGrid.appendChild(emptyCell);
  }
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  // Generate calendar days
  for (let d = 1; d <= totalDays; d++) {
    const cellDate = new Date(calCurrentYear, calCurrentMonth, d);
    const dateStr = `${calCurrentYear}-${String(calCurrentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell";
    cell.textContent = d;
    
    if (cellDate < today) {
      cell.classList.add("past-cell");
    } else {
      const hasOpenSlots = slots.some(s => s.date === dateStr && s.status === "open");
      if (hasOpenSlots) {
        const dot = document.createElement("span");
        dot.className = "dot-indicator";
        cell.appendChild(dot);
      }
      
      if (calSelectedDateStr === dateStr) {
        cell.classList.add("active-selected");
      }
      
      cell.addEventListener("click", () => {
        document.querySelectorAll(".calendar-day-cell").forEach(c => c.classList.remove("active-selected"));
        cell.classList.add("active-selected");
        calSelectedDateStr = dateStr;
        renderBookingTimeSlots(dateStr);
      });
    }
    daysGrid.appendChild(cell);
  }
}

function renderBookingTimeSlots(dateStr) {
  const lblSelected = document.getElementById("lblSelectedDaySlots");
  const grid = document.getElementById("bookingSlotsGrid");
  const hiddenInput = document.getElementById("selectedSlotId");
  if (!lblSelected || !grid || !hiddenInput) return;
  
  lblSelected.textContent = `選擇 ${dateStr} 的時段`;
  grid.innerHTML = "";
  hiddenInput.value = "";
  
  const daySlots = slots.filter(s => s.date === dateStr).sort((a,b) => a.time.localeCompare(b.time));
  
  if (daySlots.length === 0) {
    grid.innerHTML = `<div style="grid-column: span 7; color: var(--mist); font-size: 13px; text-align: center; padding: 10px 0;">當日無開放預約的時段</div>`;
    update1on1Cost();
    return;
  }
  
  const openSlots = daySlots.filter(s => s.status === "open");
  if (openSlots.length === 0) {
    grid.innerHTML = `<div style="grid-column: span 7; color: var(--mist); font-size: 13px; text-align: center; padding: 10px 0;">當日時段已被約滿或暫不開放</div>`;
    update1on1Cost();
    return;
  }
  
  openSlots.forEach(s => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot-btn";
    btn.textContent = s.time;
    
    btn.addEventListener("click", () => {
      document.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      hiddenInput.value = s.id;
      update1on1Cost();
    });
    grid.appendChild(btn);
  });
  
  update1on1Cost();
}

function update1on1Cost() {
  const cost = 1;
  document.getElementById("lblBook1on1Cost").textContent = cost;
  
  const warning = document.getElementById("lblBook1on1Warning");
  const submitBtn = document.getElementById("btnSubmit1on1");
  const selectedSlotId = document.getElementById("selectedSlotId").value;
  
  const hasPoints = currentUser.points >= cost;
  
  if (!hasPoints) {
    warning.style.display = "flex";
    warning.innerHTML = `<i data-lucide="alert-triangle"></i> ⚠️ 次數不足，請先<a href="#buy-points" style="color:var(--brass-dim);text-decoration:underline;">購買點數</a>，並截圖購買證明到官方LINE上，請小幫手為您新增點數唷！`;
    submitBtn.disabled = true;
    submitBtn.classList.add("disabled");
  } else if (!selectedSlotId) {
    warning.style.display = "flex";
    warning.innerHTML = `<i data-lucide="info"></i> 💡 請先選擇日期與預約時段。`;
    submitBtn.disabled = true;
    submitBtn.classList.add("disabled");
  } else {
    warning.style.display = "none";
    submitBtn.disabled = false;
    submitBtn.classList.remove("disabled");
  }
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Render Group Session booking (團體頌缽 - 與 1對1 相同的日曆+時段機制，僅類型不同且顏色區隔)
function renderGroupForm() {
  if (!currentUser) return;
  if (currentUser.points === undefined) currentUser.points = 0;
  if (currentUser.giftedGroupPoints === undefined) currentUser.giftedGroupPoints = 0;
  const totalGroup = currentUser.points + currentUser.giftedGroupPoints;
  let pointsDisplay = totalGroup + " 次";
  if (currentUser.giftedGroupPoints > 0) {
    pointsDisplay += ` (通用 ${currentUser.points} / 贈送-團體 ${currentUser.giftedGroupPoints})`;
  }
  document.getElementById("lblBookGroupUserPoints").textContent = pointsDisplay;

  groupCalCurrentYear = new Date().getFullYear();
  groupCalCurrentMonth = new Date().getMonth();
  groupCalSelectedDateStr = null;

  document.getElementById("selectedGroupSlotId").value = "";
  document.getElementById("groupBookingSlotsGrid").innerHTML = "";
  document.getElementById("lblSelectedGroupDaySlots").textContent = "團體場次選擇 (請先點選上方日期)";

  renderGroupBookingCalendar();
  updateGroupCost();
}

function renderGroupBookingCalendar() {
  const lblMonthYear = document.getElementById("lblGroupCalendarMonthYear");
  const daysGrid = document.getElementById("groupCalendarDaysGrid");
  if (!lblMonthYear || !daysGrid) return;

  lblMonthYear.textContent = `${groupCalCurrentYear} 年 ${groupCalCurrentMonth + 1} 月`;
  daysGrid.innerHTML = "";

  const firstDay = new Date(groupCalCurrentYear, groupCalCurrentMonth, 1);
  const startDayOfWeek = firstDay.getDay();
  const totalDays = new Date(groupCalCurrentYear, groupCalCurrentMonth + 1, 0).getDate();

  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-day-cell empty-cell";
    daysGrid.appendChild(emptyCell);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 1; d <= totalDays; d++) {
    const cellDate = new Date(groupCalCurrentYear, groupCalCurrentMonth, d);
    const dateStr = `${groupCalCurrentYear}-${String(groupCalCurrentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const cell = document.createElement("div");
    cell.className = "calendar-day-cell";
    cell.textContent = d;

    if (cellDate < today) {
      cell.classList.add("past-cell");
    } else {
      const hasOpenGroupSlots = slots.some(s => s.date === dateStr && s.type === "group" && s.status === "open" && (s.currentCapacity || 0) < s.maxCapacity);
      if (hasOpenGroupSlots) {
        const dot = document.createElement("span");
        dot.className = "dot-indicator dot-group";
        cell.appendChild(dot);
      }

      if (groupCalSelectedDateStr === dateStr) {
        cell.classList.add("active-selected");
      }

      cell.addEventListener("click", () => {
        document.querySelectorAll("#groupCalendarDaysGrid .calendar-day-cell").forEach(c => c.classList.remove("active-selected"));
        cell.classList.add("active-selected");
        groupCalSelectedDateStr = dateStr;
        renderGroupTimeSlots(dateStr);
      });
    }
    daysGrid.appendChild(cell);
  }
}

function renderGroupTimeSlots(dateStr) {
  const lblSelected = document.getElementById("lblSelectedGroupDaySlots");
  const grid = document.getElementById("groupBookingSlotsGrid");
  const hiddenInput = document.getElementById("selectedGroupSlotId");
  if (!lblSelected || !grid || !hiddenInput) return;

  lblSelected.textContent = `選擇 ${dateStr} 的團體頌缽場次`;
  grid.innerHTML = "";
  hiddenInput.value = "";

  const daySlots = slots.filter(s => s.date === dateStr && s.type === "group").sort((a, b) => a.time.localeCompare(b.time));

  if (daySlots.length === 0) {
    grid.innerHTML = `<div style="grid-column: span 7; color: var(--mist); font-size: 13px; text-align: center; padding: 10px 0;">當日無開放的團體頌缽場次</div>`;
    updateGroupCost();
    return;
  }

  const bookableSlots = daySlots.filter(s => s.status === "open");
  if (bookableSlots.length === 0) {
    grid.innerHTML = `<div style="grid-column: span 7; color: var(--mist); font-size: 13px; text-align: center; padding: 10px 0;">當日場次已額滿或暫不開放</div>`;
    updateGroupCost();
    return;
  }

  bookableSlots.forEach(s => {
    const isFull = (s.currentCapacity || 0) >= s.maxCapacity;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `slot-btn group-type${isFull ? " disabled-slot" : ""}`;
    btn.innerHTML = `${s.time}<span class="slot-cap-text">${s.title || "團體頌缽"} · ${s.currentCapacity || 0}/${s.maxCapacity}</span>`;

    if (!isFull) {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#groupBookingSlotsGrid .slot-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        hiddenInput.value = s.id;
        updateGroupCost();
      });
    }
    grid.appendChild(btn);
  });

  updateGroupCost();
}

function updateGroupCost() {
  const cost = 1;
  const costLbl = document.getElementById("lblBookGroupCost");
  if (costLbl) costLbl.textContent = cost;

  const warning = document.getElementById("lblBookGroupWarning");
  const submitBtn = document.getElementById("btnSubmitGroup");
  const selectedSlotId = document.getElementById("selectedGroupSlotId").value;

  if (currentUser.points === undefined) currentUser.points = 0;
  if (currentUser.giftedGroupPoints === undefined) currentUser.giftedGroupPoints = 0;
  const hasPoints = (currentUser.points + currentUser.giftedGroupPoints) >= cost;

  if (!hasPoints) {
    warning.style.display = "flex";
    warning.innerHTML = `<i data-lucide="alert-triangle"></i> ⚠️ 次數不足，請先<a href="#buy-points" style="color:var(--brass-dim);text-decoration:underline;">購買點數</a>，並截圖購買證明到官方LINE上，請小幫手為您新增點數唷！`;
    submitBtn.disabled = true;
    submitBtn.classList.add("disabled");
  } else if (!selectedSlotId) {
    warning.style.display = "flex";
    warning.innerHTML = `<i data-lucide="info"></i> 💡 請先選擇日期與團體場次。`;
    submitBtn.disabled = true;
    submitBtn.classList.add("disabled");
  } else {
    warning.style.display = "none";
    submitBtn.disabled = false;
    submitBtn.classList.remove("disabled");
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ==========================================
// 3.5 購買點數與對帳渲染 (Buy Points Page Rendering)
// ==========================================

function renderBuyPointsPage() {
  if (!currentUser) return;
  
  /* 匯出銀行與後五碼改成在對帳回條裡直接填，不再要求先去個人資料綁定 ——
     原本沒綁就整個擋住送不出去，客人得跳到別頁填完再走回來。
     填過的自動帶入，之後只要確認即可。 */
  document.getElementById("buyUserBankName").value = currentUser.paymentBankName || "";
  document.getElementById("buyUserBankLast5").value = currentUser.paymentBankLast5 || "";
  document.getElementById("buyActualAmount").value = "";

  // Render user remittance history
  renderRemittanceHistory();
}

function renderRemittanceHistory() {
  const userRemits = remittances.filter(r => r.userId === currentUser.id);
  const listEl = document.getElementById("buyPointsHistoryList");
  if (!listEl) return;
  
  if (userRemits.length === 0) {
    listEl.innerHTML = `<tr><td colspan="5" class="text-center text-muted">目前尚無儲值紀錄。</td></tr>`;
    return;
  }
  
  // Sort by date descending
  userRemits.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  
  listEl.innerHTML = userRemits.map(r => {
    let statusClass = "status-badge status-pending";
    let statusText = "待對帳";
    let extraInfo = "";
    
    if (r.status === "approved") {
      statusClass = "status-badge status-confirmed";
      statusText = "已核准";
    } else if (r.status === "rejected") {
      statusClass = "status-badge status-cancelled";
      statusText = "已駁回";
      extraInfo = `<div class="text-muted mt-1" style="font-size: 11px;">原因: ${esc(r.rejectReason || "款項未核對屬實")}</div>`;
    }
    
    const packageName = getPackageName(r.packageId);
    
    return `
      <tr>
        <td>${r.createdAt}</td>
        <td><strong>${packageName}</strong> (${r.points} 點)</td>
        <td>$${r.amount}</td>
        <td>${r.last5} (${r.bankName})</td>
        <td>
          <span class="${statusClass}">${statusText}</span>
          ${extraInfo}
        </td>
      </tr>
    `;
  }).join("");
}

/* 固定方案（1/8/15 點）已取消，金額改為逐筆議定。
   保留這個函式是為了讓「取消之前」送出的舊紀錄仍顯示得出原本的方案名稱；
   新紀錄的 packageId 是 null，顯示成「自訂金額」。 */
function getPackageName(packageId) {
  if (packageId === 1 || packageId === "1") return "加購 1 點";
  if (packageId === 8 || packageId === "8") return "加購 8 點 (加贈1次團體)";
  if (packageId === 15 || packageId === "15") return "加購 15 點 (加贈2次團體)";
  return "自訂金額";
}

// ==========================================
// 4. 管理後台渲染 (Admin UI Rendering)
// ==========================================

let activeAdminPane = "overview";
let adminSlotCurrentYear = new Date().getFullYear();
let adminSlotCurrentMonth = new Date().getMonth();
let adminSlotSelectedDateStr = null;
let adminSelectedSlotType = "1on1"; // 目前在「開放時段」表單中選擇的類型：1on1 或 group

function renderAdminDashboard(paneId) {
  activeAdminPane = paneId;
  
  // Toggle sidebar items active
  document.querySelectorAll(".sidebar-item").forEach(item => {
    item.classList.remove("active");
  });
  
  const paneToMenuMap = {
    "overview": "btnAdminMenuOverview",
    "members": "btnAdminMenuMembers",
    "bookings": "btnAdminMenuBookings",
    "schedule": "btnAdminMenuSchedule",
    "coupons": "btnAdminMenuCoupons",
    "slots": "btnAdminMenuSlots",
    "remittances": "btnAdminMenuRemittances",
    "courses": "btnAdminMenuCourses"
  };
  document.getElementById(paneToMenuMap[paneId])?.classList.add("active");
  
  // Show active main pane
  document.querySelectorAll(".admin-main-pane > .admin-pane-section").forEach(pane => {
    pane.classList.remove("active");
  });
  document.getElementById(`pane-admin-${paneId}`).classList.add("active");
  
  // 1. Calculate General Stats
  const totalMembers = users.filter(u => u.role !== "admin").length;
  const pendingBookings = bookings.filter(b => b.status === "待確認").length;
  const monthlyBookings = bookings.filter(b => b.status === "已確認" || b.status === "已完成").length; // Only count confirmed/completed bookings
  const totalCouponsIssued = vouchers.length;
  
  document.getElementById("lblAdminStatMembers").textContent = totalMembers;
  document.getElementById("lblAdminStatPending").textContent = pendingBookings;
  document.getElementById("lblAdminStatTotalBookings").textContent = monthlyBookings;
  document.getElementById("lblAdminStatCoupons").textContent = totalCouponsIssued;
  
  // 2. Overview Panel Pending list
  if (paneId === "overview") {
    const list = document.getElementById("adminOverviewPendingList");
    const pendings = bookings.filter(b => b.status === "待確認");
    list.innerHTML = "";
    
    if (pendings.length === 0) {
      list.innerHTML = `<tr><td colspan="5" class="tx-empty" style="text-align:center;">目前沒有任何待確認的預約</td></tr>`;
    } else {
      pendings.forEach(b => {
        const row = document.createElement("tr");
        const member = users.find(u => u.id === b.userId);
        const name = member ? member.name : "未知會員";
        const itemType = b.type === "1on1" ? "1對1" : "團體";
        const detail = b.type === "1on1" ? `${b.date} ${b.time} (${b.duration}分)` : `${b.date} ${b.title}`;
        
        row.innerHTML = `
          <td><strong>${name}</strong></td>
          <td>${itemType}</td>
          <td>${detail}</td>
          <td><span class="status-badge status-pending">${b.status}</span></td>
          <td>
            <div class="action-btn-group">
              <button class="table-action-btn success" onclick="adminApproveBooking(${b.id})">確認</button>
              <button class="table-action-btn danger" onclick="adminRejectBooking(${b.id})">拒絕</button>
            </div>
          </td>
        `;
        list.appendChild(row);
      });
    }
  }
  
  // 3. Member Management List
  if (paneId === "members") {
    renderAdminMemberList();
  }
  
  // 4. Booking list (with Filter logic)
  if (paneId === "bookings") {
    const inputDate = document.getElementById("adminBookingDateFilter");
    if (inputDate) inputDate.value = adminBookingDateFilterValue || "";
    renderAdminBookingList();
  }
  
  // 4b. Schedule calendar pane
  if (paneId === "schedule") {
    renderAdminCalendar();
  }
  
  // 5. Coupon management lists
  if (paneId === "coupons") {
    renderAdminCouponsPanel();
  }
  
  // 6. Slots management lists
  if (paneId === "slots") {
    renderAdminSlotsPanel();
    updateGoogleSyncUI(!!googleAccessToken);
  }
  
  // 7. Remittance management lists
  if (paneId === "remittances") {
    renderAdminRemittancesPanel();
  }
  
  // 8. Courses management lists
  if (paneId === "courses") {
    renderAdminCoursesPanel();
  }
  
  // Refresh icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// 4.2 Member List View
let memberSearchQuery = "";

function renderAdminMemberList() {
  const container = document.getElementById("adminMemberList");
  container.innerHTML = "";
  
  const filteredMembers = users.filter(u => {
    // 允許管理員在列表中看到自己，以便點選編輯修改密碼
    if (u.role === "admin" && (!currentUser || u.email !== currentUser.email)) return false;
    if (memberSearchQuery === "") return true;
    return u.name.includes(memberSearchQuery) || 
           u.phone.includes(memberSearchQuery) || 
           u.email.includes(memberSearchQuery);
  });
  
  // 置頂管理員帳號
  filteredMembers.sort((a, b) => {
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (a.role !== "admin" && b.role === "admin") return 1;
    return 0;
  });
  
  document.getElementById("lblAdminMemberCount").textContent = filteredMembers.length;
  
  if (filteredMembers.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="tx-empty" style="text-align:center;">找不到符合的會員</td></tr>`;
  } else {
    filteredMembers.forEach(u => {
      const row = document.createElement("tr");
      // 登入方式（不再顯示密碼 —— 密碼由 Firebase Authentication 保管，後台看不到也不需要看到）
      const loginText = u.lineUserId ? "LINE 登入" : "Email 登入";

      const isTargetAdmin = u.role === "admin";
      // 最近一筆到期資訊（讓管理員一眼看出誰的點數快過期）
      let soonestNote = "";
      if (!isTargetAdmin) {
        const bs = getExpiryBreakdown(u).filter(b => b.expiresAt);
        if (bs.length > 0) {
          const d = daysUntil(bs[0].expiresAt);
          soonestNote = `<br><span style="font-size:11px;color:${d <= 14 ? '#C0392B' : 'var(--mist)'};">最近到期：${esc(bs[0].expiresAt)}（${d} 天）</span>`;
        } else if (getExpiryBreakdown(u).length > 0) {
          soonestNote = `<br><span style="font-size:11px;color:var(--mist);">無期限</span>`;
        }
      }
      const pointsText = isTargetAdmin ? `<span class="badge status-pending">管理員帳號</span>` : `通用: <strong class="text-brass">${u.points || 0}</strong> 次<br>贈送1對1: <strong class="text-brass">${u.giftedPoints || 0}</strong> 次<br>贈送團體: <strong class="text-brass">${u.giftedGroupPoints || 0}</strong> 次${soonestNote}`;
      
      const actionsHtml = isTargetAdmin ? `
        <div class="action-btn-group">
          <button class="table-action-btn secondary" onclick="openEditMember(${u.id})">編輯資料/密碼</button>
        </div>
      ` : `
        <div class="action-btn-group">
          <button class="table-action-btn success" onclick="openAdjustPoints(${u.id})">調整次數</button>
          <button class="table-action-btn secondary" onclick="openEditMember(${u.id})">編輯資料</button>
          <button class="table-action-btn danger" onclick="deleteMember(${u.id})">刪除會員</button>
        </div>
      `;
      
      row.innerHTML = `
        <td><strong>${u.name}</strong> ${isTargetAdmin ? '<span class="status-badge status-approved" style="font-size:10px;padding:2px 4px;margin-left:4px;">管理員</span>' : ''}<br><span style="font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--mist);">ID: ${u.id}</span></td>
        <td>${u.phone}<br><span style="font-size:11px;color:var(--mist);">${u.email}</span><br><span style="font-size:11px;color:var(--brass-dim);font-weight:500;">${loginText}</span></td>
        <td>${u.gender}</td>
        <td>${u.joinDate}</td>
        <td>${pointsText}</td>
        <td>
          ${actionsHtml}
        </td>
      `;
      container.appendChild(row);
    });
  }
}

window.deleteMember = function(memberId) {
  const member = users.find(u => u.id === memberId);
  if (!member) return;
  
  if (confirm(`確定要刪除會員「${member.name}」嗎？此動作將會清除該會員的所有資料且無法復原。`)) {
    // 0. 從 Firebase 中移除使用者節點
    const pathKey = getUserPathKey(member);
    database.ref(`users/${pathKey}`).remove();
    
    // 1. 從 users 陣列中移除
    users = users.filter(u => u.id !== memberId);
    
    // 2. 從 bookings 陣列中移除該會員的相關預約
    bookings = bookings.filter(b => b.userId !== memberId);
    
    // 3. 從 vouchers 陣列中移除該會員的相關優惠券
    vouchers = vouchers.filter(v => v.userId !== memberId);
    
    // 4. 從 transactions 陣列中移除該會員的相關交易紀錄
    transactions = transactions.filter(t => t.userId !== memberId);
    
    // 5. 更新本地存儲與同步到雲端
    dbSet("users", users);
    dbSet("bookings", bookings);
    dbSet("vouchers", vouchers);
    dbSet("transactions", transactions);
    
    // 6. 重新渲染畫面
    renderAdminMemberList();
    
    alert(`已成功刪除會員「${member.name}」及其相關資料！`);
  }
};

// Adjust Points Modal
window.openAdjustPoints = function(memberId) {
  const member = users.find(u => u.id === memberId);
  if (!member) return;
  
  // 開窗前先掃一次到期，避免顯示到已過期的點數
  expireUserBatches(member);

  document.getElementById("adjustMemberId").value = member.id;
  document.getElementById("lblAdjustTargetName").textContent = member.name;
  document.getElementById("lblAdjustTargetPoints").textContent = member.points;

  // 預填預設到期日
  const adjExpiry = document.getElementById("adjustExpiry");
  const adjNoExpiry = document.getElementById("adjustNoExpiry");
  if (adjExpiry) { adjExpiry.value = defaultExpiryStr(); adjExpiry.disabled = false; }
  if (adjNoExpiry) adjNoExpiry.checked = false;
  const lblGifted = document.getElementById("lblAdjustTargetGifted");
  if (lblGifted) lblGifted.textContent = member.giftedPoints || 0;
  const lblGiftedGroup = document.getElementById("lblAdjustTargetGiftedGroup");
  if (lblGiftedGroup) lblGiftedGroup.textContent = member.giftedGroupPoints || 0;
  document.getElementById("adjustAmount").value = "";
  document.getElementById("adjustReason").value = "";
  
  navigateTo("admin-points");
};

window.openEditMember = function(memberId) {
  const member = users.find(u => u.id === memberId);
  if (!member) return;
  
  document.getElementById("editMemberId").value = member.id;
  document.getElementById("editMemName").value = member.name;
  document.getElementById("editMemEmail").value = member.email;
  document.getElementById("editMemPhone").value = member.phone;
  if (member.lineUserId) {
    document.getElementById("editMemPassword").value = "";
    document.getElementById("editMemPassword").disabled = true;
    document.getElementById("editMemPassword").placeholder = "LINE快速註冊用戶無法設定密碼";
  } else {
    // 檢查是否正在編輯管理員自己
    const isSelf = (currentUser && member.email === currentUser.email);
    const isTargetAdmin = member.role === "admin";
    
    if (isTargetAdmin && !isSelf) {
      document.getElementById("editMemPassword").value = "";
      document.getElementById("editMemPassword").disabled = true;
      document.getElementById("editMemPassword").placeholder = "您無法直接修改其他管理員的密碼";
    } else {
      document.getElementById("editMemPassword").value = "";
      document.getElementById("editMemPassword").disabled = false;
      document.getElementById("editMemPassword").placeholder = isSelf ? "輸入新密碼以重設您的管理員密碼" : "留空代表不修改密碼，輸入以重設密碼";
    }
  }
  
  const genderRadios = document.getElementsByName("editMemGender");
  genderRadios.forEach(radio => {
    radio.checked = (radio.value === member.gender);
  });
  
  // 動態加載課程開通授權 Checkbox
  const coursesContainer = document.getElementById("editMemCoursesContainer");
  if (coursesContainer) {
    coursesContainer.innerHTML = "";
    if (!courses || courses.length === 0) {
      coursesContainer.innerHTML = `<div style="font-size: 12px; color: var(--mist);">尚未建立任何課程</div>`;
    } else {
      courses.forEach(c => {
        const hasAccess = member.unlockedCourses && member.unlockedCourses[c.id] === true;
        const div = document.createElement("div");
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.gap = "8px";
        div.innerHTML = `
          <input type="checkbox" name="editMemCourseGrant" value="${c.id}" ${hasAccess ? "checked" : ""} style="cursor: pointer; width: auto; height: auto;">
          <label style="font-size: 13px; color: var(--paper); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
            ${c.title} <span style="font-size: 11px; color: var(--brass); font-weight:500;">(${c.lecturer})</span>
          </label>
        `;
        const checkbox = div.querySelector('input');
        div.querySelector('label').addEventListener('click', () => { checkbox.click(); });
        coursesContainer.appendChild(div);
      });
    }
  }
  
  navigateTo("admin-edit-member");
};

// 4.3 Booking List rendering with filter state
let bookingFilter = "all";
let adminBookingDateFilterValue = "";
// 是否隱藏已取消／已拒絕的預約（純畫面過濾，不會動到資料），選擇會記住
let hideCancelledBookings = localStorage.getItem("singbowl_hide_cancelled") === "1";

// Admin Booking Calendar Variables
let adminCalendarCurrentYear = new Date().getFullYear();
let adminCalendarCurrentMonth = new Date().getMonth(); // 0-indexed
let adminCalendarSelectedDate = "";

function renderAdminCalendar() {
  const lblMonth = document.getElementById("lblAdminCalendarMonth");
  const grid = document.getElementById("adminCalendarDaysGrid");
  if (!lblMonth || !grid) return;
  
  lblMonth.textContent = `${adminCalendarCurrentYear} 年 ${adminCalendarCurrentMonth + 1} 月`;
  grid.innerHTML = "";
  
  const firstDayIndex = new Date(adminCalendarCurrentYear, adminCalendarCurrentMonth, 1).getDay();
  const totalDays = new Date(adminCalendarCurrentYear, adminCalendarCurrentMonth + 1, 0).getDate();
  const prevMonthTotalDays = new Date(adminCalendarCurrentYear, adminCalendarCurrentMonth, 0).getDate();
  
  // 1. Prev Month padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayVal = prevMonthTotalDays - i;
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell empty-cell past-cell";
    cell.style.opacity = "0.2";
    cell.innerHTML = `<span>${dayVal}</span>`;
    grid.appendChild(cell);
  }
  
  // 2. Current Month days
  for (let d = 1; d <= totalDays; d++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell";
    
    const dateStr = `${adminCalendarCurrentYear}-${String(adminCalendarCurrentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const activeBookings = bookings.filter(b => b.date === dateStr && b.status !== "已取消" && b.status !== "已拒絕");
    const pendingCount = activeBookings.filter(b => b.status === "待確認").length;
    
    cell.innerHTML = `<span>${d}</span>`;
    
    if (activeBookings.length > 0) {
      const badge = document.createElement("span");
      badge.style.fontSize = "15px";
      badge.style.marginTop = "2px";
      badge.style.fontWeight = "700";
      badge.style.color = "#ffffff";
      badge.style.textShadow = "0 1px 2px rgba(0,0,0,0.4)";

      if (pendingCount > 0) {
        badge.textContent = `${activeBookings.length}人 (待)`;
      } else {
        badge.textContent = `${activeBookings.length}人`;
      }
      cell.appendChild(badge);
      
      const dot = document.createElement("span");
      dot.className = "dot-indicator";
      if (pendingCount > 0) {
        dot.style.background = "#ff9800";
      }
      cell.appendChild(dot);
    }
    
    if (adminCalendarSelectedDate === dateStr) {
      cell.classList.add("active-selected");
    }
    
    cell.addEventListener("click", () => {
      document.querySelectorAll("#adminCalendarDaysGrid .calendar-day-cell").forEach(c => {
        c.classList.remove("active-selected");
      });
      cell.classList.add("active-selected");
      adminCalendarSelectedDate = dateStr;
      showAdminCalendarDayDetail(dateStr);
    });
    
    grid.appendChild(cell);
  }
  
  // 3. Next Month padding days
  const totalCellsUsed = firstDayIndex + totalDays;
  const remainingCells = 42 - totalCellsUsed;
  for (let i = 1; i <= remainingCells; i++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell empty-cell past-cell";
    cell.style.opacity = "0.2";
    cell.innerHTML = `<span>${i}</span>`;
    grid.appendChild(cell);
  }
  
  if (adminCalendarSelectedDate) {
    showAdminCalendarDayDetail(adminCalendarSelectedDate);
  } else {
    document.getElementById("divAdminCalendarDayDetail").style.display = "none";
  }
}

function showAdminCalendarDayDetail(dateStr) {
  const panel = document.getElementById("divAdminCalendarDayDetail");
  const title = document.getElementById("lblAdminCalendarSelectedDate");
  const list = document.getElementById("adminCalendarDayBookingsList");
  if (!panel || !title || !list) return;
  
  title.textContent = `📅 ${dateStr} 預約詳情`;
  list.innerHTML = "";
  
  const dayBookings = bookings.filter(b => b.date === dateStr && b.status !== "已取消" && b.status !== "已拒絕");
  
  if (dayBookings.length === 0) {
    list.innerHTML = `<div style="font-size: 12px; color: var(--mist); text-align: center; padding: 10px 0;">當日無任何預約紀錄</div>`;
  } else {
    dayBookings.forEach(b => {
      const item = document.createElement("div");
      item.style.background = "rgba(255,255,255,0.03)";
      item.style.padding = "10px";
      item.style.borderRadius = "6px";
      item.style.border = "1px solid var(--hairline)";
      item.style.display = "flex";
      item.style.justifyContent = "space-between";
      item.style.alignItems = "center";
      item.style.gap = "10px";
      
      const member = users.find(u => u.id === b.userId);
      const name = member ? member.name : "未知";
      const label = b.type === "1on1" ? "1對1 頌缽" : b.title;
      
      const statusClass = b.status === "待確認" ? "status-pending" : 
                          b.status === "已確認" ? "status-confirmed" : 
                          b.status === "已完成" ? "status-completed" : "status-cancelled";
                          
      let actionButtons = "";
      if (b.status === "待確認") {
        actionButtons = `
          <div style="display: flex; gap: 4px;">
            <button class="table-action-btn success" style="padding: 2px 6px; font-size: 11px; height: auto;" onclick="adminApproveBooking(${b.id}); event.stopPropagation();">確認</button>
            <button class="table-action-btn" style="padding: 2px 6px; font-size: 11px; height: auto;" onclick="openRescheduleBooking(${b.id}); event.stopPropagation();">改期</button>
            <button class="table-action-btn danger" style="padding: 2px 6px; font-size: 11px; height: auto;" onclick="adminRejectBooking(${b.id}); event.stopPropagation();">拒絕</button>
          </div>
        `;
      } else if (b.status === "已確認") {
        actionButtons = `
          <div style="display: flex; gap: 4px;">
            <button class="table-action-btn" style="padding: 2px 6px; font-size: 11px; height: auto;" onclick="openRescheduleBooking(${b.id}); event.stopPropagation();">改期</button>
            <button class="table-action-btn danger" style="padding: 2px 6px; font-size: 11px; height: auto;" onclick="adminRejectBooking(${b.id}); event.stopPropagation();">取消並退次</button>
          </div>
        `;
      }
      
      item.innerHTML = `
        <div style="text-align: left;">
          <div style="font-weight: 600; font-size: 13px; color: var(--paper);">${b.time} - ${name}</div>
          <div style="font-size: 11px; color: var(--mist); margin-top: 2px;">項目: ${label} | #ID: ${b.id}</div>
          ${b.notes ? `<div style="font-size: 11px; color:var(--brass-dim); margin-top: 4px; border-left: 2px solid var(--brass); padding-left: 6px;">備註: ${b.notes}</div>` : ''}
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <span class="status-badge ${statusClass}" style="margin: 0; padding: 2px 6px; font-size: 10px;">${b.status}</span>
          ${actionButtons}
        </div>
      `;
      list.appendChild(item);
    });
  }
  
  panel.style.display = "block";
}

function renderAdminBookingList() {
  const container = document.getElementById("adminBookingList");
  container.innerHTML = "";
  
  // 同步「隱藏已取消」勾選框的狀態（重整後仍記得上次的選擇）
  const hideChk = document.getElementById("chkHideCancelledBookings");
  if (hideChk) hideChk.checked = hideCancelledBookings;

  // 1. Filter bookings
  const filteredBookings = bookings.filter(b => {
    // Status filter
    if (bookingFilter !== "all" && b.status !== bookingFilter) return false;

    // 隱藏已取消／已拒絕（僅在「所有預約」等非取消頁籤生效，避免點了「已取消」頁籤卻空白）
    if (hideCancelledBookings && bookingFilter !== "已取消" &&
        (b.status === "已取消" || b.status === "已拒絕")) return false;

    // Date filter
    if (adminBookingDateFilterValue && b.date !== adminBookingDateFilterValue) return false;

    return true;
  });
  
  // 2. Sort: Cancelled/Rejected go to bottom
  filteredBookings.sort((a, b) => {
    const isACancelled = (a.status === "已取消" || a.status === "已拒絕");
    const isBCancelled = (b.status === "已取消" || b.status === "已拒絕");
    
    if (isACancelled && !isBCancelled) return 1;
    if (!isACancelled && isBCancelled) return -1;
    
    // Fallback: sort by date descending (latest first)
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return (b.time || "").localeCompare(a.time || "");
  });
  
  if (filteredBookings.length === 0) {
    container.innerHTML = `<tr><td colspan="7" class="tx-empty" style="text-align:center;">目前無符合預約紀錄</td></tr>`;
  } else {
    filteredBookings.forEach(b => {
      const member = users.find(u => u.id === b.userId);
      const memberName = member ? member.name : "未知";
      const label = b.type === "1on1" ? "1對1 頌缽" : "團體頌缽";
      const timeDetail = b.type === "1on1" ? `${b.date} ${b.time}` : `${b.date} ${b.title}`;
      
      const statusClass = b.status === "待確認" ? "status-pending" : 
                          b.status === "已確認" ? "status-confirmed" : 
                          b.status === "已完成" ? "status-completed" : "status-cancelled";
                          
      let actions = "-";
      if (b.status === "待確認") {
        actions = `
          <div class="action-btn-group">
            <button class="table-action-btn success" onclick="adminApproveBooking(${b.id})">確認</button>
            <button class="table-action-btn" onclick="openRescheduleBooking(${b.id})">改期</button>
            <button class="table-action-btn danger" onclick="adminRejectBooking(${b.id})">拒絕</button>
          </div>
        `;
      } else if (b.status === "已確認") {
        actions = `
          <div class="action-btn-group">
            <button class="table-action-btn" onclick="openRescheduleBooking(${b.id})">改期</button>
            <button class="table-action-btn danger" onclick="adminRejectBooking(${b.id})">取消並退次數</button>
          </div>
        `;
      }
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span style="font-family:'JetBrains Mono';font-size:11px;">#${b.id}</span></td>
        <td><strong>${memberName}</strong></td>
        <td>${label}</td>
        <td>${timeDetail}${Array.isArray(b.rescheduleHistory) && b.rescheduleHistory.length > 0
          ? `<br><span style="font-size:11px;color:var(--brass-dim);">🔄 已改期 ${b.rescheduleHistory.length} 次（原 ${esc(b.rescheduleHistory[0].from)}）</span>`
          : ""}</td>
        <td>${b.cost} 次</td>
        <td><span class="status-badge ${statusClass}">${b.status}</span></td>
        <td>${actions}</td>
      `;
      container.appendChild(row);
    });
  }
}

// Admin Action on Bookings
/* ============================================================
   管理員代為改期
   ------------------------------------------------------------
   兩種模式：
   (A) 從已開放且還有空位的時段挑（安全，不會撞期）
   (B) 手動指定任意日期時間（彈性，會跳提醒）
   改期會自動：釋放舊時段 → 佔用新時段 → 通知會員
   點數不變動（同一筆預約，只是換時間）
   ============================================================ */
let rescheduleTargetBookingId = null;

// 釋放某筆預約目前佔用的時段
function releaseSlotForBooking(booking) {
  if (!booking || !booking.slotId) return;
  const slot = slots.find(s => s.id === booking.slotId);
  if (!slot) return;
  if (booking.type === "group" || slot.type === "group") {
    slot.currentCapacity = Math.max(0, (slot.currentCapacity || 0) - 1);
    if (slot.status === "full") slot.status = "open";
  } else {
    slot.status = "open";
    slot.bookingId = null;
  }
}

// 讓某筆預約佔用指定時段
function occupySlotForBooking(booking, slot) {
  if (!slot) return;
  if (booking.type === "group" || slot.type === "group") {
    slot.currentCapacity = (slot.currentCapacity || 0) + 1;
    if (slot.currentCapacity >= (slot.maxCapacity || 0)) slot.status = "full";
  } else {
    slot.status = booking.status === "已確認" ? "booked" : "pending";
    slot.bookingId = booking.id;
  }
}

// 取得可改期的候選時段（排除該筆預約目前佔用的那個）
function getReschedulableSlots(booking) {
  const isGroup = booking.type === "group";
  const today = todayStr();
  return slots
    .filter(s => {
      if (s.id === booking.slotId) return false;
      if (s.date < today) return false;                       // 不列過去的時段
      const slotIsGroup = (s.type === "group");
      if (isGroup !== slotIsGroup) return false;              // 類型要一致
      if (isGroup) {
        return (s.currentCapacity || 0) < (s.maxCapacity || 0);
      }
      return s.status === "open";
    })
    .sort((a, b) => a.date === b.date ? String(a.time).localeCompare(String(b.time)) : a.date.localeCompare(b.date));
}

window.openRescheduleBooking = function(bookingId) {
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return;
  rescheduleTargetBookingId = bookingId;

  const member = users.find(u => u.id === booking.userId);
  const typeName = booking.type === "1on1" ? "1對1 頌缽" : (booking.title || "團體頌缽");

  const info = document.getElementById("rescheduleInfo");
  if (info) {
    info.innerHTML =
      `<div style="line-height:1.9;">` +
      `<strong>${esc(member ? member.name : "未知會員")}</strong>　<span class="status-badge status-confirmed">${esc(booking.status)}</span><br>` +
      `項目：${esc(typeName)}<br>` +
      `目前時間：<strong>${esc(booking.date)} ${esc(booking.time || "")}</strong>` +
      `</div>`;
  }

  // 填入可選時段
  const sel = document.getElementById("rescheduleSlotSelect");
  if (sel) {
    const candidates = getReschedulableSlots(booking);
    sel.innerHTML = "";
    if (candidates.length === 0) {
      sel.innerHTML = `<option value="">（目前沒有其他可用時段，請改用手動指定）</option>`;
    } else {
      candidates.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.type === "group"
          ? `${s.date} ${s.time}　${s.title || "團體頌缽"}（尚有 ${(s.maxCapacity || 0) - (s.currentCapacity || 0)} 位）`
          : `${s.date} ${s.time}`;
        sel.appendChild(opt);
      });
    }
  }

  // 預設回到「從開放時段選」模式
  const modeSlot = document.getElementById("rescheduleModeSlot");
  if (modeSlot) modeSlot.checked = true;
  const md = document.getElementById("rescheduleManualDate");
  const mt = document.getElementById("rescheduleManualTime");
  if (md) md.value = booking.date || "";
  if (mt) mt.value = (booking.time || "").split(" ")[0] || "";
  const notify = document.getElementById("rescheduleNotify");
  if (notify) notify.checked = true;
  syncRescheduleMode();

  navigateTo("admin-reschedule");
};

// 依選擇的模式切換顯示區塊
function syncRescheduleMode() {
  const isSlotMode = document.getElementById("rescheduleModeSlot")?.checked;
  const slotBox = document.getElementById("rescheduleSlotBox");
  const manualBox = document.getElementById("rescheduleManualBox");
  if (slotBox) slotBox.style.display = isSlotMode ? "block" : "none";
  if (manualBox) manualBox.style.display = isSlotMode ? "none" : "block";
}

window.closeRescheduleModal = function() {
  rescheduleTargetBookingId = null;
  navigateTo("admin");
};

window.confirmReschedule = function() {
  const booking = bookings.find(b => b.id === rescheduleTargetBookingId);
  if (!booking) return;

  const isSlotMode = document.getElementById("rescheduleModeSlot").checked;
  const oldDate = booking.date;
  const oldTime = booking.time;
  let newSlot = null;
  let newDate, newTime;

  if (isSlotMode) {
    const slotId = parseInt(document.getElementById("rescheduleSlotSelect").value);
    if (!slotId) { alert("請選擇一個時段，或改用手動指定時間。"); return; }
    newSlot = slots.find(s => s.id === slotId);
    if (!newSlot) { alert("找不到該時段，請重新整理後再試。"); return; }
    newDate = newSlot.date;
    newTime = newSlot.time;
  } else {
    newDate = document.getElementById("rescheduleManualDate").value;
    newTime = document.getElementById("rescheduleManualTime").value;
    if (!newDate || !newTime) { alert("請填寫新的日期與時間。"); return; }

    // 手動模式：提醒可能撞到既有預約
    const clash = bookings.find(b =>
      b.id !== booking.id &&
      b.date === newDate &&
      (b.time || "").startsWith(newTime) &&
      (b.status === "已確認" || b.status === "待確認")
    );
    let warn = `確定將此預約改為 ${newDate} ${newTime} 嗎？\n\n⚠️ 手動指定的時間不受「時段開放設定」限制。`;
    if (clash) {
      const cm = users.find(u => u.id === clash.userId);
      warn += `\n\n🔴 注意：這個時間已經有另一筆預約（${cm ? cm.name : "未知會員"}，#${clash.id}），確定仍要排入嗎？`;
    }
    if (!confirm(warn)) return;
  }

  if (isSlotMode) {
    const label = newSlot.type === "group" ? `${newDate} ${newTime}　${newSlot.title || "團體頌缽"}` : `${newDate} ${newTime}`;
    if (!confirm(`確定將此預約從\n${oldDate} ${oldTime}\n改為\n${label}\n嗎？`)) return;
  }

  // 1. 釋放舊時段
  releaseSlotForBooking(booking);

  // 2. 更新預約內容
  booking.date = newDate;
  booking.time = newTime;
  if (isSlotMode) {
    booking.slotId = newSlot.id;
    if (newSlot.type === "group" && newSlot.title) booking.title = newSlot.title;
    occupySlotForBooking(booking, newSlot);
  } else {
    // 手動指定：不綁任何已開放時段
    booking.slotId = null;
  }

  // 3. 留下改期紀錄，之後查得到誰在什麼時候改的
  if (!Array.isArray(booking.rescheduleHistory)) booking.rescheduleHistory = [];
  booking.rescheduleHistory.push({
    from: `${oldDate} ${oldTime || ""}`.trim(),
    to: `${newDate} ${newTime}`,
    at: getNowDateTimeString(),
    by: currentUser ? currentUser.name : "管理員",
    mode: isSlotMode ? "開放時段" : "手動指定"
  });

  dbSet("bookings", bookings);
  dbSet("slots", slots);

  // 4. 通知會員
  const notify = document.getElementById("rescheduleNotify");
  if (notify && notify.checked) {
    const typeName = booking.type === "1on1" ? "1對1 頌缽療癒" : (booking.title || "團體頌缽");
    const calendarUrl = generateGoogleCalendarUrl(booking);
    sendLineNotification(
      booking.userId,
      `🔄 預約改期通知\n\n親愛的會員，您的預約時間已更新：\n\n` +
      `原時間：${oldDate} ${oldTime || ""}\n` +
      `✅ 新時間：${newDate} ${newTime}\n` +
      `✨ 項目：${typeName}\n\n` +
      `📌 一鍵加入 Google 日曆：\n${calendarUrl}\n\n` +
      `如有任何問題，歡迎直接回覆此訊息與我們聯絡。`
    );
  }

  closeRescheduleModal();
  alert(`改期完成！\n\n${oldDate} ${oldTime || ""}　→　${newDate} ${newTime}`);
  renderAdminDashboard(activeAdminPane);
};

window.adminApproveBooking = function(bookingId) {
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return;
  
  booking.status = "已確認";
  dbSet("bookings", bookings);

  // Update slot status to booked (1對1 為單一座位；團體頌缽共用同一時段，名額由報名時已即時扣除，這裡不重複佔用)
  if (booking.slotId && booking.type === "1on1") {
    const slot = slots.find(s => s.id === booking.slotId);
    if (slot) {
      slot.status = "booked";
      dbSet("slots", slots);
    }
  }
  
  const typeName = booking.type === "1on1" ? "1對1 頌缽療癒" : booking.title;
  const calendarUrl = generateGoogleCalendarUrl(booking);
  sendLineNotification(booking.userId, `🔔 預約確認通知\n\n親愛的會員，您的預約已被確認！\n\n📅 日期：${booking.date}\n⏰ 時間：${booking.time}\n✨ 項目：${typeName}\n\n📌 一鍵加入 Google 日曆：\n${calendarUrl}\n\n期待與您相見！`);

  alert("預約已確認！");
  renderAdminDashboard(activeAdminPane);
};

window.adminRejectBooking = async function(bookingId) {
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return;
  
  const actionText = booking.status === "已確認" ? "取消該預約" : "拒絕該預約申請";
  if (confirm(`確認要${actionText}嗎？\n會員的預約次數將自動全額退還。`)) {
    // 1. Update Booking
    booking.status = "已取消";
    dbSet("bookings", bookings);
    
    // Free up associated slot
    if (booking.slotId) {
      const slot = slots.find(s => s.id === booking.slotId);
      if (slot) {
        if (booking.type === "group") {
          // 團體頌缽時段是多人共用，取消/拒絕一筆報名只釋放一個名額，不影響其他已報名的會員
          slot.currentCapacity = Math.max(0, (slot.currentCapacity || 0) - 1);
          if (slot.status === "full") slot.status = "open";
        } else {
          slot.status = "open";
          slot.bookingId = null;
        }
        dbSet("slots", slots);
      }
    }
    
    // 2. Refund user points
    const member = users.find(u => u.id === booking.userId);
    if (member) {
      let currentBal = 0;
      const refundType = booking.paidBy || "common";
      const refundField = refundType === "gifted"
        ? (booking.type === "1on1" ? "giftedPoints" : "giftedGroupPoints")
        : "points";
      // 優先原樣退回當初扣掉的批次（保留原到期日）；舊資料沒記批次才退成預設效期
      if (Array.isArray(booking.consumedBatches) && booking.consumedBatches.length > 0) {
        restorePoints(member, booking.consumedBatches, "預約取消退回");
      } else {
        grantPoints(member, refundField, booking.cost, defaultExpiryStr(), "預約取消退回");
      }
      currentBal = member[refundField] || 0;
      dbSet("users", users);
      
      // 3. Log points
      const newTxId = await getFreshNextId("transactions", transactions, 5001);
      const nowStr = getNowDateTimeString();
      const typeNameStr = booking.type === "1on1" ? "1對1" : "團體";
      const targetNameStr = refundType === "gifted" ? "贈送" : "通用";
      transactions.push({
        id: newTxId,
        userId: member.id,
        amount: booking.cost,
        type: "add",
        reason: `${booking.status === "已確認" ? "管理員取消退還" : "預約被拒退還"}(${typeNameStr})：ID ${booking.id} - 退回${targetNameStr}額度`,
        date: nowStr,
        balance: currentBal
      });
      dbSet("transactions", transactions);
    }
    
    const typeName = booking.type === "1on1" ? "1對1 頌缽療癒" : booking.title;
    const notificationText = booking.status === "已確認" ? "已取消" : "已被拒絕";
    sendLineNotification(booking.userId, `⚠️ 預約取消/拒絕通知\n\n親愛的會員，您於 ${booking.date} ${booking.time} 預約的【${typeName}】${notificationText}。\n\n您的預約次數已全額退還至帳戶，如有疑問請私訊與我們聯絡。`);

    alert("已成功處理，次數已全額退還給會員。");
    renderAdminDashboard(activeAdminPane);
  }
};

// 4.4 Coupons Panel (Issue form & list)
/* 依目前選到的票券類型，把到期日欄位預填成算出來的日期 */
function syncCouponExpiryDefault() {
  const tplSelect = document.getElementById("selCouponTemplate");
  const expiryEl = document.getElementById("couponExpiry");
  const noExpiryEl = document.getElementById("couponNoExpiry");
  if (!tplSelect || !expiryEl) return;
  const tpl = couponTemplates.find(t => String(t.id) === String(tplSelect.value));
  if (!tpl) return;
  const vm = Number(tpl.validMonths);
  if (vm > 0) {
    expiryEl.value = addMonthsStr(todayStr(), vm);
    if (noExpiryEl) noExpiryEl.checked = false;
    expiryEl.disabled = false;
  } else {
    expiryEl.value = "";
    if (noExpiryEl) noExpiryEl.checked = true;
    expiryEl.disabled = true;
  }
}

/* 票券類型管理列表 */
function renderCouponTemplateList() {
  const box = document.getElementById("couponTemplateList");
  if (!box) return;
  box.innerHTML = "";
  if (couponTemplates.length === 0) {
    box.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--mist);padding:16px;">尚未建立任何票券類型</td></tr>`;
    return;
  }
  couponTemplates.forEach(t => {
    const vm = Number(t.validMonths);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${esc(t.name)}</strong></td>
      <td><span class="tx-add">+${t.bonusPoints}</span> ${esc(POINT_TYPE_LABEL[t.pointType] || t.pointType)}</td>
      <td>${vm > 0 ? vm + " 個月" : "<strong style='color:var(--terra)'>永久</strong>"}</td>
      <td style="white-space:nowrap;">
        <button type="button" class="table-action-btn" onclick="editCouponTemplateExpiry(${t.id})">改效期</button>
        <button type="button" class="table-action-btn danger" onclick="deleteCouponTemplate(${t.id})">刪除</button>
      </td>
    `;
    box.appendChild(tr);
  });
}

/* 修改既有票券類型的效期。
   原本建立後完全不能改，填錯只能刪掉重建 —— 而「填 0 代表永不過期」很容易誤觸，
   實際上就發生過（把 3 個月的類型建成了永久）。 */
window.editCouponTemplateExpiry = function (id) {
  const tpl = couponTemplates.find(t => t.id === id);
  if (!tpl) return;
  const now = Number(tpl.validMonths) || 0;
  const input = prompt(
    `「${tpl.name}」目前的效期：${now > 0 ? now + " 個月" : "永久"}\n\n` +
    `請輸入新的有效月數（填 0 代表永不過期）：`,
    now
  );
  if (input === null) return;
  const months = parseInt(input, 10);
  if (isNaN(months) || months < 0) { alert("請輸入 0 或正整數。"); return; }
  if (months === 0 && !confirm(`確定要把「${tpl.name}」設成「永不過期」嗎？\n\n這批發出去的點數將永遠不會失效。`)) return;

  tpl.validMonths = months;
  dbSet("couponTemplates", couponTemplates);
  renderAdminCouponsPanel();
  alert(`已將「${tpl.name}」的效期改為 ${months > 0 ? months + " 個月" : "永不過期"}。`);
};

/* 刪除票券類型（已發出去的票券不受影響） */
function deleteCouponTemplate(id) {
  const tpl = couponTemplates.find(t => t.id === id);
  if (!tpl) return;
  if (!confirm(`確定要刪除票券類型「${tpl.name}」嗎？\n\n（已經發放出去的票券與點數不受影響，只是之後不能再用這個類型發放）`)) return;
  couponTemplates = couponTemplates.filter(t => t.id !== id);
  dbSet("couponTemplates", couponTemplates);
  renderAdminCouponsPanel();
}

function renderAdminCouponsPanel() {
  // Populate member dropdown list
  const memberSelect = document.getElementById("selCouponTarget");
  memberSelect.innerHTML = "";
  
  users.filter(u => u.role !== "admin").forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = `${u.name} (剩餘: ${u.points}次)`;
    memberSelect.appendChild(opt);
  });

  // 票券類型下拉：由可自訂的 couponTemplates 產生
  const tplSelect = document.getElementById("selCouponTemplate");
  if (tplSelect) {
    tplSelect.innerHTML = "";
    if (couponTemplates.length === 0) {
      tplSelect.innerHTML = `<option value="">（尚未建立票券類型）</option>`;
    } else {
      couponTemplates.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        const vm = Number(t.validMonths);
        opt.textContent = `${t.name} (${t.bonusPoints} 次・${POINT_TYPE_LABEL[t.pointType] || t.pointType}・${vm > 0 ? vm + "個月效期" : "永久"})`;
        tplSelect.appendChild(opt);
      });
    }
  }
  // 預設帶入該票券類型算出的到期日
  syncCouponExpiryDefault();

  // 票券類型管理列表
  renderCouponTemplateList();

  // Render issued coupons log
  const container = document.getElementById("adminCouponList");
  container.innerHTML = "";
  
  [...vouchers].sort((a,b) => b.id - a.id).forEach(v => {
    const member = users.find(u => u.id === v.userId);
    const mName = member ? member.name : "未知";
    const row = document.createElement("tr");
    const isUsed = v.status === "used";
    
    row.innerHTML = `
      <td><strong>${mName}</strong></td>
      <td>${esc(v.name)}<br><span style="font-family:'JetBrains Mono';font-size:10.5px;color:var(--mist)">Code: ${esc(v.code)}</span></td>
      <td><span class="tx-add">+${v.bonusPoints}</span></td>
      <td>${v.expiresAt ? `<span style="font-size:12px;">${esc(v.expiresAt)}</span>` : `<span style="font-size:12px;color:var(--mist)">永久</span>`}</td>
      <td>
        <span class="status-badge ${isUsed ? 'status-completed' : 'status-confirmed'}">
          ${isUsed ? '已使用' : '未使用'}
        </span>
      </td>
      <td>
        <button type="button" class="table-action-btn danger" onclick="deleteAdminCoupon(${v.id})">取消發放</button>
      </td>
    `;
    container.appendChild(row);
  });
}

window.deleteAdminCoupon = async function(couponId) {
  const vIndex = vouchers.findIndex(v => v.id === couponId);
  if (vIndex === -1) return;
  
  const voucher = vouchers[vIndex];
  const member = users.find(u => u.id === voucher.userId);
  
  if (!member) {
    if (confirm("確定要刪除此票券記錄嗎？")) {
      vouchers.splice(vIndex, 1);
      dbSet("vouchers", vouchers);
      renderAdminCouponsPanel();
    }
    return;
  }
  
  // 優先用票券自身記錄的點數種類；舊資料才回退到用名稱判斷
  const is1on1 = voucher.pointType
    ? voucher.pointType === "giftedPoints"
    : voucher.name === "生日優惠贈送次數";
  const targetNameStr = is1on1 ? "贈送-1對1" : "贈送-團體";
  const userPoints = is1on1 ? (member.giftedPoints || 0) : (member.giftedGroupPoints || 0);
  
  let confirmMsg = `確定要取消發放此票券嗎？\n取消後，將自會員「${member.name}」帳戶中扣除已贈送的 ${voucher.bonusPoints} 次 ${targetNameStr} 額度。`;
  if (userPoints < voucher.bonusPoints) {
    confirmMsg += `\n\n⚠️ 警告：該會員目前的 ${targetNameStr} 餘額 (${userPoints}次) 低於票券額度 (${voucher.bonusPoints}次)，取消後餘額將扣減至 0 次。`;
  }
  
  if (confirm(confirmMsg)) {
    consumePoints(member, is1on1 ? "giftedPoints" : "giftedGroupPoints", voucher.bonusPoints);
    dbSet("users", users);
    
    const timestamp = getNowDateTimeString();
    const newTxId = await getFreshNextId("transactions", transactions, 5001);
    transactions.push({
      id: newTxId,
      userId: member.id,
      amount: voucher.bonusPoints,
      type: "deduct",
      reason: `取消發放票券(${targetNameStr})：${voucher.name}`,
      date: timestamp,
      balance: is1on1 ? member.giftedPoints : member.giftedGroupPoints
    });
    dbSet("transactions", transactions);
    
    vouchers.splice(vIndex, 1);
    dbSet("vouchers", vouchers);
    
    alert(`成功取消票券，已扣除會員「${member.name}」相關贈送額度！`);
    renderAdminCouponsPanel();
  }
};

// 4.5 Booking Slots Panel
function renderAdminSlotsPanel() {
  renderAdminSlotsCalendar();
  if (adminSlotSelectedDateStr) {
    renderAdminDateSlots(adminSlotSelectedDateStr);
  } else {
    const contentPanel = document.getElementById("adminSlotSettingsContent");
    const placeholder = document.getElementById("adminSlotSettingsPlaceholder");
    if (contentPanel) contentPanel.style.display = "none";
    if (placeholder) placeholder.style.display = "block";
    
    const lblSelected = document.getElementById("lblAdminSelectedSlotDate");
    if (lblSelected) lblSelected.textContent = "選擇日期開放時段";
  }
}

function renderAdminSlotsCalendar() {
  const lblMonthYear = document.getElementById("lblAdminSlotCalendarMonthYear");
  const daysGrid = document.getElementById("adminSlotCalendarDaysGrid");
  if (!lblMonthYear || !daysGrid) return;
  
  lblMonthYear.textContent = `${adminSlotCurrentYear} 年 ${adminSlotCurrentMonth + 1} 月`;
  daysGrid.innerHTML = "";
  
  const firstDay = new Date(adminSlotCurrentYear, adminSlotCurrentMonth, 1);
  const startDayOfWeek = firstDay.getDay();
  const totalDays = new Date(adminSlotCurrentYear, adminSlotCurrentMonth + 1, 0).getDate();
  
  // Empty slots before first day
  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-day-cell empty-cell";
    daysGrid.appendChild(emptyCell);
  }
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  // Generate calendar days
  for (let d = 1; d <= totalDays; d++) {
    const cellDate = new Date(adminSlotCurrentYear, adminSlotCurrentMonth, d);
    const dateStr = `${adminSlotCurrentYear}-${String(adminSlotCurrentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell";
    cell.textContent = d;
    
    // Check if slots exist on this day, split by type so 1對1 與 團體頌缽 各自有專屬顏色圓點
    const daySlots = slots.filter(s => s.date === dateStr);
    const has1on1 = daySlots.some(s => (s.type || "1on1") === "1on1");
    const hasGroup = daySlots.some(s => s.type === "group");

    if (has1on1 && hasGroup) {
      const dot1 = document.createElement("span");
      dot1.className = "dot-indicator dot-offset-left";
      cell.appendChild(dot1);
      const dot2 = document.createElement("span");
      dot2.className = "dot-indicator dot-group dot-offset-right";
      cell.appendChild(dot2);
    } else if (hasGroup) {
      const dot = document.createElement("span");
      dot.className = "dot-indicator dot-group";
      cell.appendChild(dot);
    } else if (has1on1) {
      const dot = document.createElement("span");
      dot.className = "dot-indicator";
      cell.appendChild(dot);
    }
    
    if (adminSlotSelectedDateStr === dateStr) {
      cell.classList.add("active-selected");
    }
    
    cell.addEventListener("click", () => {
      document.querySelectorAll("#adminSlotCalendarDaysGrid .calendar-day-cell").forEach(c => c.classList.remove("active-selected"));
      cell.classList.add("active-selected");
      adminSlotSelectedDateStr = dateStr;
      renderAdminDateSlots(dateStr);
    });
    
    daysGrid.appendChild(cell);
  }
}

function renderAdminDateSlots(dateStr) {
  const contentPanel = document.getElementById("adminSlotSettingsContent");
  const placeholder = document.getElementById("adminSlotSettingsPlaceholder");
  const lblSelected = document.getElementById("lblAdminSelectedSlotDate");
  const gridContainer = document.getElementById("adminDaySlotList");
  
  if (!contentPanel || !placeholder || !lblSelected || !gridContainer) return;
  
  // Set selected date in hidden input of custom time form
  const txtSlotDate = document.getElementById("txtSlotDate");
  if (txtSlotDate) txtSlotDate.value = dateStr;
  
  lblSelected.textContent = `設定 ${dateStr} 的開放時段`;
  placeholder.style.display = "none";
  contentPanel.style.display = "block";
  
  gridContainer.innerHTML = "";
  
  const daySlots = slots.filter(s => s.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));

  if (daySlots.length === 0) {
    gridContainer.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding:15px 0;">本日尚未開放任何時段。</td></tr>`;
    return;
  }

  daySlots.forEach(s => {
    const row = document.createElement("tr");
    const isGroup = s.type === "group";

    const typeBadge = isGroup
      ? `<span class="slot-type-badge type-group">🧑‍🤝‍🧑 ${s.title || "團體頌缽"}</span>`
      : `<span class="slot-type-badge type-1on1">🧘 1對1</span>`;

    let statusText = "";
    let statusClass = "";
    if (isGroup && (s.status === "open" || s.status === "full") && (s.currentCapacity || 0) >= (s.maxCapacity || 0)) {
      statusText = `已額滿 (${s.currentCapacity}/${s.maxCapacity})`;
      statusClass = "status-full";
    } else if (s.status === "open") {
      statusText = isGroup ? `開放中 (${s.currentCapacity || 0}/${s.maxCapacity})` : "開放中";
      statusClass = "status-confirmed";
    } else if (s.status === "pending") {
      statusText = "待對帳/確認";
      statusClass = "status-pending";
    } else if (s.status === "booked") {
      statusText = "已預約";
      statusClass = "status-completed";
    } else if (s.status === "closed") {
      statusText = isGroup ? `手動關閉 (${s.currentCapacity || 0}/${s.maxCapacity})` : "手動關閉";
      statusClass = "status-cancelled";
    }

    const isFull = isGroup && (s.currentCapacity || 0) >= (s.maxCapacity || 0);

    let actionBtn = "";
    if (s.status === "open" && !isFull) {
      actionBtn = `<button type="button" class="table-action-btn danger" onclick="toggleSlotStatus(${s.id}, 'closed')">關閉</button>`;
    } else if (s.status === "closed") {
      actionBtn = `<button type="button" class="table-action-btn success" onclick="toggleSlotStatus(${s.id}, 'open')">開啟</button>`;
    } else if (s.status === "pending") {
      actionBtn = `<span style="font-size:12px;color:var(--mist)">待預約審核</span>`;
    } else if (s.status === "booked" || isFull) {
      actionBtn = `<span style="font-size:12px;color:var(--mist)">${isGroup ? "名額已滿" : "已確認預約"}</span>`;
    }

    let deleteBtn = "";
    const canDelete = isGroup ? ((s.currentCapacity || 0) === 0) : (s.status === "open" || s.status === "closed");
    if (canDelete) {
      deleteBtn = `<button type="button" class="table-action-btn secondary" style="margin-left: 8px;" onclick="deleteSlot(${s.id})">刪除</button>`;
    }

    row.innerHTML = `
      <td><span style="font-family:'JetBrains Mono';font-size:14px;font-weight:bold;">${s.time}</span></td>
      <td>${typeBadge}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td>
        <div class="action-btn-group" style="justify-content: flex-start;">
          ${actionBtn}
          ${deleteBtn}
        </div>
      </td>
    `;
    gridContainer.appendChild(row);
  });
}

async function addAdminSlot(dateVal, timeVal, opts = {}) {
  if (!dateVal || !timeVal) {
    alert("日期與時間無效！");
    return;
  }

  const slotType = opts.type === "group" ? "group" : "1on1";

  // 同一天同一時間、同一種類型的時段才視為重複 (1對1 與 團體頌缽 可以並存於同一時間)
  const duplicate = slots.find(s => s.date === dateVal && s.time === timeVal && (s.type || "1on1") === slotType);
  if (duplicate) {
    alert("此日期與時段已在列表中！");
    return;
  }

  const nextSlotId = await getFreshNextId("slots", slots, 1);
  const newSlot = {
    id: nextSlotId,
    date: dateVal,
    time: timeVal,
    status: "open",
    bookingId: null,
    type: slotType
  };

  if (slotType === "group") {
    newSlot.title = (opts.title || "").trim() || "團體頌缽";
    newSlot.maxCapacity = Math.max(1, parseInt(opts.maxCapacity, 10) || 10);
    newSlot.currentCapacity = 0;
    newSlot.pointCost = 1;
  }

  slots.push(newSlot);
  dbSet("slots", slots);

  renderAdminSlotsPanel();
}

window.toggleSlotStatus = function(slotId, newStatus) {
  const slot = slots.find(s => s.id === slotId);
  if (!slot) return;
  
  slot.status = newStatus;
  dbSet("slots", slots);
  renderAdminSlotsPanel();
};

window.deleteSlot = function(slotId) {
  const slotIndex = slots.findIndex(s => s.id === slotId);
  if (slotIndex === -1) return;
  
  if (confirm("確定要刪除此開放時段嗎？")) {
    slots.splice(slotIndex, 1);
    dbSet("slots", slots);
    renderAdminSlotsPanel();
  }
};


// 4.6 Remittance Verification Panel
function renderAdminRemittancesPanel() {
  const pendingContainer = document.getElementById("adminPendingRemittanceList");
  const historyContainer = document.getElementById("adminHistoryRemittanceList");
  if (!pendingContainer || !historyContainer) return;
  
  pendingContainer.innerHTML = "";
  historyContainer.innerHTML = "";
  
  const pendings = remittances.filter(r => r.status === "pending");
  const histories = remittances.filter(r => r.status !== "pending");
  
  document.getElementById("lblAdminPendingRemittanceCount").textContent = pendings.length;
  
  // Render Pending List
  if (pendings.length === 0) {
    pendingContainer.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="text-align:center;">目前沒有待審核的匯款申請。</td></tr>`;
  } else {
    // Sort oldest first for pending so admin processes in order
    const sortedPendings = [...pendings].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    sortedPendings.forEach(r => {
      const row = document.createElement("tr");
      const packageName = getPackageName(r.packageId);
      
      row.innerHTML = `
        <td>${r.createdAt}</td>
        <td><strong>${esc(r.userName)}</strong><br><span style="font-size:11px;color:var(--mist);">${esc(r.userPhone)}</span></td>
        <td><strong>${packageName}</strong> (${r.points} 點)</td>
        <td>$${r.amount}</td>
        <td>${esc(r.bankName)}</td>
        <td><strong class="text-brass" style="font-family:'JetBrains Mono';font-size:14px;">${r.last5}</strong></td>
        <td>${r.remittedAt}</td>
        <td>
          <div class="action-btn-group">
            <button class="table-action-btn success" onclick="adminApproveRemittance(${r.id})">確認</button>
            <button class="table-action-btn danger" onclick="openAdminRejectRemittance(${r.id})">駁回</button>
          </div>
        </td>
      `;
      pendingContainer.appendChild(row);
    });
  }
  
  // Render History List
  if (histories.length === 0) {
    historyContainer.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="text-align:center;">尚無歷史審核紀錄。</td></tr>`;
  } else {
    // Sort newest first for histories
    const sortedHistories = [...histories].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    sortedHistories.forEach(r => {
      const row = document.createElement("tr");
      const packageName = getPackageName(r.packageId);
      
      let statusBadge = "";
      let detailCell = "";
      if (r.status === "approved") {
        statusBadge = `<span class="status-badge status-confirmed">已核准</span>`;
        detailCell = `<span style="font-size:11px;color:var(--mist);">核准完成</span>`;
      } else if (r.status === "rejected") {
        statusBadge = `<span class="status-badge status-cancelled">已駁回</span>`;
        detailCell = `<span style="font-size:11px;color:var(--mist);">原因: ${esc(r.rejectReason || "資料不符")}</span>`;
      }
      
      row.innerHTML = `
        <td>${r.createdAt}</td>
        <td><strong>${esc(r.userName)}</strong></td>
        <td>${packageName} (${r.points} 點)</td>
        <td>$${r.amount}</td>
        <td>${r.last5} (${esc(r.bankName)})</td>
        <td>${statusBadge}</td>
        <td>${detailCell}</td>
      `;
      historyContainer.appendChild(row);
    });
  }
}

/* 開啟核准畫面。方案清單直接讀 couponTemplates —— 跟「票券發放」共用同一份，
   你在那邊新增票券類型，這裡的下拉就會同步出現，不用維護兩份。 */
window.adminApproveRemittance = function(remittanceId) {
  const remit = remittances.find(r => r.id === remittanceId);
  if (!remit) return;
  const member = users.find(u => u.id === remit.userId);
  if (!member) { alert("找不到對應的會員，核准失敗。"); return; }

  document.getElementById("approveRemittanceId").value = remittanceId;
  document.getElementById("lblApproveRemitInfo").textContent =
    `${member.name}｜匯款 $${remit.amount}｜${remit.bankName} 後五碼 ${remit.last5}｜匯款時間 ${remit.remittedAt || "未填"}`;

  const sel = document.getElementById("approveTemplate");
  sel.innerHTML = '<option value="">自訂（自行輸入下方欄位）</option>' +
    couponTemplates.map(t =>
      `<option value="${t.id}">${esc(t.name)}（${t.bonusPoints} 點・${POINT_TYPE_LABEL[t.pointType] || t.pointType}・${t.validMonths} 個月）</option>`
    ).join("");
  sel.value = "";

  document.getElementById("approvePoints").value = Number(remit.points) || "";
  document.getElementById("approvePointType").value = "points";
  document.getElementById("approveNoExpiry").checked = false;
  document.getElementById("approveExpiry").value = defaultExpiryStr();

  navigateTo("admin-approve-remittance");
};

/* 真正執行發放。pts / pointType / expiry 由核准表單決定。 */
async function doApproveRemittance(remittanceId, pts, pointType, expiry) {
  const remit = remittances.find(r => r.id === remittanceId);
  if (!remit) return;
  const member = users.find(u => u.id === remit.userId);
  if (!member) { alert("找不到對應的會員，核准失敗。"); return; }

  {
    remit.points = pts;
    remit.pointType = pointType;
    remit.expiresAt = expiry;
    const bonusInput = 0;
    const remitExpiry = expiry;
    grantPoints(member, pointType, pts, remitExpiry, `加購點數（匯款 $${remit.amount}）`);

    // Write point transaction log
    const newTx = {
      // 原本是 transactions.length + 1，會產生跟現有 id 完全不同區段、且極易撞號的號碼
      id: await getFreshNextId("transactions", transactions, 5001),
      userId: member.id,
      type: "add",
      amount: pts,
      reason: `加購點數審核通過（匯款 $${remit.amount}）`,
      date: getNowDateTimeString(),
      balance: member.points
    };
    transactions.push(newTx);

    /* 發放的若是「贈送-團體」，額外建立對應的票券紀錄，讓會員在票券列表看得到。
       可預約的額度在上面 grantPoints 時就已經加進 giftedGroupPoints，
       這裡只補票券的顯示用紀錄，不再重複加點。 */
    const bonusGroupVouchers = (pointType === "giftedGroupPoints") ? pts : 0;

    if (bonusGroupVouchers > 0) {
      for (let i = 0; i < bonusGroupVouchers; i++) {
        const nextVoucherId = await getFreshNextId("vouchers", vouchers, 1);
        const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        vouchers.push({
          id: nextVoucherId,
          userId: member.id,
          name: "團體頌缽1次",
          bonusPoints: 1,
          status: "available",
          code: randomCode
        });
      }

      dbSet("vouchers", vouchers, false);
    }

    // Update remittance status
    remit.status = "approved";

    // Save to database
    dbSet("transactions", transactions, false);
    dbSet("users", users, false);
    dbSet("remittances", remittances, true); // Trigger cloud sync here

    const expiryMsg = expiry ? `，效期至 ${expiry}` : "，永不過期";
    alert(`成功核准！已發放 ${pts} 點「${POINT_TYPE_LABEL[pointType] || pointType}」給 ${member.name}${expiryMsg}。`);
    renderAdminDashboard("remittances");
  }
}

window.openAdminRejectRemittance = function(remittanceId) {
  document.getElementById("rejectRemittanceId").value = remittanceId;
  document.getElementById("txtRejectReason").value = "";
  navigateTo("admin-reject-remittance");
};

// ==========================================
// 5. 事件監聽設定 (Event Listeners & Form Submissions)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

  /* 種下第一筆歷史狀態。view-landing 在 HTML 裡預設就是 active，載入時不會
     經過 navigateTo()，history.state 會是 null —— 少了這一筆，第一次切頁時
     popstate 拿不到 view，返回就會直接離站。
     這裡只帶兩個參數（不動 URL），避免影響 LINE LIFF 的登入導轉。 */
  if (!history.state) history.replaceState({ view: "landing" }, "");

  // 0. 先把首屏（未登入的會員中心介紹頁）的 lucide 圖示畫出來。
  // 登入後的各個 render 函式各自也會再呼叫一次；缺了這一次，未登入畫面上的
  // 圖示會全部是空白，日曆的上／下月按鈕更會變成沒有任何標示的空按鈕。
  if (typeof lucide !== "undefined") lucide.createIcons();

  // 1. Navigation click bindings
  document.getElementById("btnPrevMonth").addEventListener("click", () => {
    calCurrentMonth--;
    if (calCurrentMonth < 0) {
      calCurrentMonth = 11;
      calCurrentYear--;
    }
    renderBookingCalendar();
  });
  document.getElementById("btnNextMonth").addEventListener("click", () => {
    calCurrentMonth++;
    if (calCurrentMonth > 11) {
      calCurrentMonth = 0;
      calCurrentYear++;
    }
    renderBookingCalendar();
  });

  // 團體頌缽預約日曆的月份切換
  document.getElementById("btnGroupPrevMonth")?.addEventListener("click", () => {
    groupCalCurrentMonth--;
    if (groupCalCurrentMonth < 0) {
      groupCalCurrentMonth = 11;
      groupCalCurrentYear--;
    }
    renderGroupBookingCalendar();
  });
  document.getElementById("btnGroupNextMonth")?.addEventListener("click", () => {
    groupCalCurrentMonth++;
    if (groupCalCurrentMonth > 11) {
      groupCalCurrentMonth = 0;
      groupCalCurrentYear++;
    }
    renderGroupBookingCalendar();
  });

  document.getElementById("navLogo").addEventListener("click", (e) => {
    e.preventDefault();
    navigateTo("landing");
  });
  document.getElementById("btnNavHome").addEventListener("click", (e) => {
    e.preventDefault();
    navigateTo("landing");
  });
  document.getElementById("btnNavMember").addEventListener("click", (e) => {
    e.preventDefault();
    navigateTo("member");
  });
  // 購買點數改回站內頁面 —— 收款連結無法預先產生（中信社群收款是逐筆開的），
  // 所以站內頁的角色是「說明方案 + 匯款後回報對帳」，不是導購到外部商店。
  document.getElementById("btnNavBuyPoints").addEventListener("click", (e) => {
    e.preventDefault();
    navigateTo("buy-points");
  });

  /* 「次數不足，請先加購點數」那類提示是動態塞進 innerHTML 的行內連結，
     沒辦法一個個綁事件；這個站也沒有 hash 路由，單純改 #hash 不會切頁。
     所以用事件委派統一接手所有 <a href="#view-id">。 */
  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const viewId = link.getAttribute("href").slice(1);
    if (!viewId || !document.getElementById("view-" + viewId)) return;
    e.preventDefault();
    navigateTo(viewId);
  });
  document.getElementById("btnNavAdmin").addEventListener("click", (e) => {
    e.preventDefault();
    navigateTo("admin");
  });
  
  // Auth navigation
  const showLogin = () => navigateTo("auth");
  document.getElementById("btnHeaderLogin").addEventListener("click", showLogin);
  document.getElementById("btnLandingCta").addEventListener("click", showLogin);
  document.getElementById("btnHeaderLogout").addEventListener("click", () => auth.signOut());
  document.getElementById("btnAuthBack").addEventListener("click", () => navigateTo("landing"));

  // Dashboard shortcuts
  document.getElementById("btnEditProfile").addEventListener("click", () => {
    if (!currentUser) return;
    document.getElementById("editName").value = currentUser.name;
    document.getElementById("editPhone").value = currentUser.phone;
    document.querySelector(`input[name="editGender"][value="${currentUser.gender}"]`).checked = true;
    
    const bankInput = document.getElementById("editBankName");
    if (bankInput) bankInput.value = currentUser.paymentBankName || "";
    const last5Input = document.getElementById("editBankLast5");
    if (last5Input) last5Input.value = currentUser.paymentBankLast5 || "";
    
    navigateTo("edit-profile");
  });
  
  document.getElementById("btnBook1on1").addEventListener("click", () => navigateTo("book"));

  // 療癒預約頁面內的頁籤切換 (1對1 / 團體頌缽)
  document.querySelectorAll("#bookingTypeTabs .booking-tab-btn").forEach(tabBtn => {
    tabBtn.addEventListener("click", () => {
      switchBookingTab(tabBtn.getAttribute("data-tab"));
    });
  });

  // Form: Edit Profile Submission
  document.getElementById("formEditProfile").addEventListener("submit", (e) => {
    e.preventDefault();
    currentUser.name = document.getElementById("editName").value;
    currentUser.phone = document.getElementById("editPhone").value;
    currentUser.gender = document.querySelector('input[name="editGender"]:checked').value;
    
    const bankInput = document.getElementById("editBankName");
    if (bankInput) currentUser.paymentBankName = bankInput.value.trim();
    const last5Input = document.getElementById("editBankLast5");
    if (last5Input) currentUser.paymentBankLast5 = last5Input.value.trim();
    
    // Save users list
    dbSet("users", users);
    
    // Update local variables
    document.getElementById("headerUserName").textContent = currentUser.name;
    
    alert("個人資料已更新！");
    navigateTo("member");
  });
  
  document.getElementById("btnCancelEditProfile").addEventListener("click", () => navigateTo("member"));

  /* 原本這裡有 1/8/15 點三張方案卡的選取邏輯（順帶產生一組假的「虛擬帳號」）。
     收款改成中信社群收款、連結逐筆開立、金額逐筆談，固定方案已不適用，
     所以方案卡整組移除，發放幾點改由管理員在核准時輸入。 */


  // Remittance Slip Submit Listener
  document.getElementById("formSubmitRemittance")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const bankName = document.getElementById("buyUserBankName").value.trim();
    const last5 = document.getElementById("buyUserBankLast5").value.trim();
    if (!bankName || !/^\d{5}$/.test(last5)) {
      alert("請填寫您的匯出銀行名稱，以及帳號後五碼（五位數字）。");
      return;
    }

    const chkAgree = document.getElementById("chkAgreeTerms").checked;
    if (!chkAgree) {
      alert("您必須同意消費者購買與服務契約以進行交易。");
      return;
    }
    
    const amount = parseInt(document.getElementById("buyActualAmount").value);
    if (!amount || amount <= 0) {
      alert("請填寫實際匯款金額。");
      return;
    }
    const remitTime = document.getElementById("buyRemitTime").value.replace("T", " ");
    const note = document.getElementById("buyRemitNote").value.trim();

    // 順手存回個人資料，下次填對帳回條會自動帶入
    currentUser.paymentBankName = bankName;
    currentUser.paymentBankLast5 = last5;
    dbSet("users", users);

    const newRemit = {
      // 原本是 remittances.length + 1，兩位會員同時回報匯款就會撞號、其中一筆被靜默蓋掉
      id: await getFreshNextId("remittances", remittances, 1),
      userId: currentUser.id,
      firebaseUid: auth.currentUser ? auth.currentUser.uid : null,
      userName: currentUser.name,
      userPhone: currentUser.phone,
      // 已無固定方案（收款連結逐筆開立），要發幾點由管理員核准時輸入
      packageId: null,
      points: 0,
      amount: amount,
      bankName: bankName,
      last5: last5,
      note: note,
      remittedAt: remitTime,
      status: "pending",
      rejectReason: "",
      createdAt: getNowDateTimeString()
    };
    
    remittances.push(newRemit);
    dbSet("remittances", remittances);

    /* 通知管理員有新的待審核匯款。收件人是 settings/adminLineUserId，
       跟每日提醒共用同一個設定；沒設定就只是不送，不影響會員送出。
       這裡是會員身分在送，讀得到 settings 是因為該節點對登入者開放讀取。 */
    notifyAdminNewRemittance(newRemit);

    alert("匯款對帳回條已提交，管理員將儘速進行審核，感謝您的耐心等待。");
    
    // Clear form inputs
    document.getElementById("buyActualAmount").value = "";
    document.getElementById("buyRemitTime").value = "";
    document.getElementById("buyRemitNote").value = "";
    document.getElementById("chkAgreeTerms").checked = false;
    
    renderBuyPointsPage();
  });

  document.getElementById("btnCancel1on1").addEventListener("click", () => navigateTo("member"));
  
  // Submit: 1-on-1 reservation
  document.getElementById("formBook1on1").addEventListener("submit", async (e) => {
    e.preventDefault();

    const cost = 1;
    if (currentUser.points < cost) {
      alert("可約次數不足，請加購次數後再進行預約。");
      return;
    }
    
    const slotId = parseInt(document.getElementById("selectedSlotId").value);
    if (!slotId) {
      alert("請先選擇預約日期與時段！");
      return;
    }
    
    const slot = slots.find(s => s.id === slotId);
    if (!slot || slot.status !== "open") {
      alert("該時段已不可選，請選擇其他時段！");
      return;
    }

    // 重複預約提醒：同一位會員若已有同一天同一時段的有效預約（非已取消/已拒絕），先跳出確認提示
    const existingDuplicate = bookings.find(b =>
      b.userId === currentUser.id &&
      b.date === slot.date &&
      b.time === slot.time &&
      b.status !== "已取消" &&
      b.status !== "已拒絕"
    );
    if (existingDuplicate) {
      const proceedAnyway = confirm(`您已經預約過此時段（${slot.date} ${slot.time}，狀態：${existingDuplicate.status}），請確認是否要重複預約。\n\n如有疑問，請洽詢官方 LINE 帳號。\n\n點選「確定」將繼續送出這筆新的預約；點選「取消」則不會送出。`);
      if (!proceedAnyway) return;
    }

    // 1. Create booking entry
    const newBookingId = await getFreshNextId("bookings", bookings, 1001);
    const timestamp = getNowDateTimeString();

    const newBooking = {
      id: newBookingId,
      userId: currentUser.id,
      firebaseUid: auth.currentUser ? auth.currentUser.uid : null,
      type: "1on1",
      slotId: slot.id,
      date: slot.date,
      time: slot.time,
      duration: 60, // default standard duration
      cost: cost,
      notes: document.getElementById("book1on1Notes").value,
      status: "待確認",
      timestamp: timestamp
    };
    
    bookings.push(newBooking);
    dbSet("bookings", bookings);
    
    // 2. Lock slot status to pending
    slot.status = "pending";
    slot.bookingId = newBookingId;
    dbSet("slots", slots);
    
    // 3. Deduct points from user (prefer giftedPoints, fallback to common points)
    let paidBy = "common";
    if (currentUser.giftedPoints === undefined) currentUser.giftedPoints = 0;
    if (currentUser.points === undefined) currentUser.points = 0;
    
    let consumedRecord = [];
    if (currentUser.giftedPoints >= cost) {
      consumedRecord = consumePoints(currentUser, "giftedPoints", cost);
      paidBy = "gifted";
    } else {
      consumedRecord = consumePoints(currentUser, "points", cost);
      paidBy = "common";
    }
    // 記下實際扣掉哪幾批，取消時可原樣退回（不會偷偷延長效期）
    newBooking.consumedBatches = consumedRecord;
    dbSet("users", users);

    // Save payment method tag to booking
    newBooking.paidBy = paidBy;
    dbSet("bookings", bookings); // overwrite to save paidBy field
    
    // 4. Log point transaction
    const newTxId = await getFreshNextId("transactions", transactions, 5001);
    const targetNameStr = paidBy === "gifted" ? "贈送" : "通用";
    transactions.push({
      id: newTxId,
      userId: currentUser.id,
      firebaseUid: auth.currentUser ? auth.currentUser.uid : null,
      amount: cost,
      type: "deduct",
      reason: `預約 1 對 1 頌缽療癒 (${newBooking.duration}分鐘) - 扣除${targetNameStr}額度`,
      date: timestamp,
      balance: paidBy === "gifted" ? currentUser.giftedPoints : currentUser.points
    });
    dbSet("transactions", transactions);
    
    sendLineNotification(currentUser.id, `✉️ 預約申請已提交\n\n親愛的會員，您的預約申請已成功送出！\n\n📅 日期：${newBooking.date}\n⏰ 時間：${newBooking.time}\n✨ 項目：1對1 頌缽療癒\n\n請等待管理員審核確認，確認後將會發送通知通知您！`);

    alert("預約申請已提交，預約額度已暫扣，請等待管理員確認。");
    navigateTo("member");
  });

  // Submit: Group booking (團體頌缽 - 使用與 1對1 相同的 slots 開放時段機制)
  document.getElementById("btnCancelGroup").addEventListener("click", () => navigateTo("member"));
  document.getElementById("formBookGroup").addEventListener("submit", async (e) => {
    e.preventDefault();

    const slotId = parseInt(document.getElementById("selectedGroupSlotId").value);
    if (!slotId) {
      alert("請先選擇日期與團體場次！");
      return;
    }

    const slot = slots.find(s => s.id === slotId);
    if (!slot || slot.type !== "group" || slot.status !== "open") {
      alert("該場次已不可選，請選擇其他場次！");
      return;
    }

    const cost = slot.pointCost || 1;

    // Safety check for capacity
    if ((slot.currentCapacity || 0) >= slot.maxCapacity) {
      alert("該場次已額滿，請選擇其他場次！");
      return;
    }

    if (currentUser.points === undefined) currentUser.points = 0;
    if (currentUser.giftedGroupPoints === undefined) currentUser.giftedGroupPoints = 0;
    if ((currentUser.points + currentUser.giftedGroupPoints) < cost) {
      alert("可約次數不足，請加購次數後再進行報名。");
      return;
    }

    // 重複報名提醒：同一位會員若已報名過同一場次（非已取消/已拒絕），先跳出確認提示
    const existingDuplicate = bookings.find(b =>
      b.userId === currentUser.id &&
      b.slotId === slot.id &&
      b.type === "group" &&
      b.status !== "已取消" &&
      b.status !== "已拒絕"
    );
    if (existingDuplicate) {
      const proceedAnyway = confirm(`您已經報名過此場次（${slot.date} ${slot.time}），請確認是否要重複報名。\n\n如有疑問，請洽詢官方 LINE 帳號。\n\n點選「確定」將繼續送出這筆新的報名；點選「取消」則不會送出。`);
      if (!proceedAnyway) return;
    }

    // 1. Create group booking
    const newBookingId = await getFreshNextId("bookings", bookings, 1001);
    const timestamp = getNowDateTimeString();
    const notes = document.getElementById("bookGroupNotes").value;

    const newBooking = {
      id: newBookingId,
      userId: currentUser.id,
      firebaseUid: auth.currentUser ? auth.currentUser.uid : null,
      type: "group",
      slotId: slot.id,
      title: slot.title || "團體頌缽",
      date: slot.date,
      time: slot.time,
      cost: cost,
      notes: notes,
      status: "已確認", // Group bookings are auto-confirmed in this template
      timestamp: timestamp
    };

    bookings.push(newBooking);
    dbSet("bookings", bookings);

    // 2. Deduct user points (prefer giftedGroupPoints, fallback to common points — never gifted-1on1 points)
    let paidBy = "common";
    let consumedRecord = [];
    if (currentUser.giftedGroupPoints >= cost) {
      consumedRecord = consumePoints(currentUser, "giftedGroupPoints", cost);
      paidBy = "gifted";
    } else {
      consumedRecord = consumePoints(currentUser, "points", cost);
      paidBy = "common";
    }
    // 記下實際扣掉哪幾批，取消時可原樣退回
    newBooking.consumedBatches = consumedRecord;
    dbSet("users", users);

    // Save payment method tag to booking
    newBooking.paidBy = paidBy;
    dbSet("bookings", bookings); // overwrite to save paidBy field

    // 3. Increment slot occupancy, auto-close (full) once capacity is reached
    slot.currentCapacity = (slot.currentCapacity || 0) + 1;
    if (slot.currentCapacity >= slot.maxCapacity) {
      slot.status = "full";
    }
    dbSet("slots", slots);

    // 4. Log point transaction
    const newTxId = await getFreshNextId("transactions", transactions, 5001);
    const targetNameStr = paidBy === "gifted" ? "贈送" : "通用";
    transactions.push({
      id: newTxId,
      userId: currentUser.id,
      firebaseUid: auth.currentUser ? auth.currentUser.uid : null,
      amount: cost,
      type: "deduct",
      reason: `報名團體頌缽：${slot.title || "團體頌缽"} (${slot.date} ${slot.time}) - 扣除${targetNameStr}額度`,
      date: timestamp,
      balance: paidBy === "gifted" ? currentUser.giftedGroupPoints : currentUser.points
    });
    dbSet("transactions", transactions);

    sendLineNotification(currentUser.id, `✉️ 團體頌缽報名成功\n\n親愛的會員，您已成功報名團體場次！\n\n📅 日期：${slot.date}\n⏰ 時間：${slot.time}\n✨ 項目：${slot.title || "團體頌缽"}\n\n期待與您共同體驗頌缽的頻率。`);

    alert(`報名成功！已扣除 ${cost} 次預約額度。\n期待與您共同體驗頌缽的頻率。`);
    navigateTo("member");
  });

  // Authentication: LINE Login (LIFF)
  document.getElementById("btnLineLogin").addEventListener("click", () => {
    if (typeof liff !== "undefined" && liff.isInClient !== undefined) {
      try {
        if (!liff.isLoggedIn()) {
          liff.login();
        } else {
          handleLiffLogin();
        }
      } catch (err) {
        console.error("LIFF 登入失敗，降級使用模擬登入:", err);
        runMockLineLogin();
      }
    } else {
      // 離線或本地測試 Fallback
      runMockLineLogin();
    }
  });

  // General Email Login UI Navigation
  document.getElementById("btnGeneralLogin").addEventListener("click", () => {
    document.getElementById("authOptionsContainer").style.display = "none";
    const bottomLinks = document.getElementById("divAuthBottomLinks");
    if (bottomLinks) bottomLinks.style.display = "none";
    document.getElementById("formEmailAuth").style.display = "block";
    document.getElementById("authEmail").focus();
  });
  
  document.getElementById("btnBackToAuthOptions").addEventListener("click", () => {
    document.getElementById("authOptionsContainer").style.display = "block";
    const bottomLinks = document.getElementById("divAuthBottomLinks");
    if (bottomLinks) bottomLinks.style.display = "flex";
    document.getElementById("formEmailAuth").style.display = "none";
  });

  // Firebase Authentication Email/Password Login & Migration Flow
  document.getElementById("formEmailAuth").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("authEmail").value.trim().toLowerCase();
    const passwordInput = document.getElementById("authPassword");
    const password = passwordInput.value.trim();
    const btnSubmit = document.getElementById("btnEmailSubmit");
    
    if (!email) {
      alert("請輸入電子郵件！");
      return;
    }
    if (!password) {
      alert("請輸入密碼！");
      return;
    }
    
    btnSubmit.disabled = true;
    btnSubmit.textContent = "驗證中...";
    
    try {
      // 1. 嘗試以 Firebase Auth 登入
      await auth.signInWithEmailAndPassword(email, password);
      // 成功登入後，onAuthStateChanged 會自動觸發 profile 載入與畫面渲染，不需手動呼叫 onUserLoginSuccess
    } catch (err) {
      console.warn("Firebase Auth 登入失敗:", err.code);

      /* 【已移除的舊帳號遷移流程】
         這裡原本有一段「Firebase Auth 找不到帳號時，改用資料庫裡的 password 欄位驗證」的相容邏輯。
         移除原因有三：
         1. 它已經是死程式 —— 那段邏輯要先未登入讀取整個 users 節點，但安全規則已封閉未登入讀取，必定失敗。
         2. 它有一行 `|| (!matchedUser.password)`：只要某筆會員資料沒有 password 欄位，
            任何密碼都會通過驗證。這是實質的登入後門。
         3. 所有現存會員都已經有 Firebase Auth 帳號，不再需要遷移。
         現在登入完全交給 Firebase Authentication，資料庫不再參與密碼驗證。 */
      if (err.code === "auth/user-not-found") {
        // 這個 email 還沒有帳號 —— 引導去註冊，不透露「這個 email 是否已註冊」以外的資訊
        document.getElementById("regName").value = "";
        document.getElementById("regPhone").value = "";
        document.getElementById("regEmail").value = email;
        document.getElementById("formRegisterProfile").dataset.tempEmail = email;
        alert("查無此帳號，將帶您前往註冊。");
        navigateTo("register");
      } else if (err.code === "auth/too-many-requests") {
        alert("嘗試次數過多，請稍候幾分鐘再試一次。");
      } else {
        alert("登入失敗：電子郵件或密碼不正確。");
        passwordInput.focus();
      }
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "確認登入";
    }
  });

  // Form: Complete Profile submission (Registration)
  document.getElementById("formRegisterProfile").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const regForm = document.getElementById("formRegisterProfile");
    const email = document.getElementById("regEmail").value.trim().toLowerCase();
    const lineUserId = regForm.dataset.lineUserId || null;
    const name = document.getElementById("regName").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const gender = document.querySelector('input[name="regGender"]:checked').value;
    
    const password = document.getElementById("regPassword").value.trim();

    // 驗證電子郵件是否已被註冊
    const existing = users.find(u => u.email === email);
    if (existing) {
      alert("此電子郵件已被註冊，請使用其他電子郵件！");
      return;
    }
    
    try {
      const finalEmail = lineUserId ? `line_${lineUserId}@singbowl.com` : email;
      const finalPassword = lineUserId ? `line_${lineUserId}_secure` : password;
      
      let authUser = auth.currentUser;
      if (!authUser || authUser.email !== finalEmail) {
        const userCredential = await auth.createUserWithEmailAndPassword(finalEmail, finalPassword);
        authUser = userCredential.user;
      }
      
      const nextUserId = await getFreshNextUserId(users, 1);
      const dateStr = new Date().toISOString().split("T")[0];

      const newUser = {
        id: nextUserId,
        email: email,
        name: name,
        phone: phone,
        gender: gender,
        // 不儲存密碼：登入由 Firebase Authentication 全權負責，資料庫不該保存任何密碼資訊
        role: "member",
        points: 0, // 預設新註冊會員起步次數為 0
        joinDate: dateStr,
        lineUserId: lineUserId,
        firebaseUid: authUser.uid
      };
      
      await database.ref(`users/${authUser.uid}`).set(newUser);
      
      // Update local cache
      users.push(newUser);
      dbSet("users", users, false);
      
      currentUser = newUser;
      localStorage.setItem("singbowl_current_user_id", currentUser.id);
      onUserLoginSuccess();
      
      alert(`恭喜您註冊成功！🎵`);
    } catch (err) {
      console.error("註冊失敗:", err);
      alert(`註冊失敗：${err.message}`);
    }
  });

  // Admin Sidebar Nav bindings
  document.getElementById("btnAdminMenuOverview").addEventListener("click", () => renderAdminDashboard("overview"));
  document.getElementById("btnAdminMenuMembers").addEventListener("click", () => renderAdminDashboard("members"));
  document.getElementById("btnAdminMenuBookings").addEventListener("click", () => renderAdminDashboard("bookings"));
  document.getElementById("btnAdminMenuSchedule")?.addEventListener("click", () => renderAdminDashboard("schedule"));
  document.getElementById("btnAdminMenuCoupons").addEventListener("click", () => renderAdminDashboard("coupons"));
  document.getElementById("btnAdminMenuSlots").addEventListener("click", () => renderAdminDashboard("slots"));
  document.getElementById("btnAdminMenuRemittances")?.addEventListener("click", () => renderAdminDashboard("remittances"));
  document.getElementById("btnAdminBackToMember").addEventListener("click", () => navigateTo("member"));

  // Booking date filter listeners
  document.getElementById("adminBookingDateFilter")?.addEventListener("change", (e) => {
    adminBookingDateFilterValue = e.target.value;
    renderAdminBookingList();
  });
  document.getElementById("btnClearAdminBookingDateFilter")?.addEventListener("click", () => {
    adminBookingDateFilterValue = "";
    const inputDate = document.getElementById("adminBookingDateFilter");
    if (inputDate) inputDate.value = "";
    renderAdminBookingList();
  });

  // 隱藏已取消紀錄（純畫面過濾，資料不動）
  document.getElementById("chkHideCancelledBookings")?.addEventListener("change", (e) => {
    hideCancelledBookings = e.target.checked;
    localStorage.setItem("singbowl_hide_cancelled", hideCancelledBookings ? "1" : "0");
    renderAdminBookingList();
  });

  // 永久刪除已取消／已拒絕的預約紀錄
  document.getElementById("btnPurgeCancelledBookings")?.addEventListener("click", () => {
    const doomed = bookings.filter(b => b && (b.status === "已取消" || b.status === "已拒絕"));
    if (doomed.length === 0) {
      alert("目前沒有已取消或已拒絕的預約紀錄。");
      return;
    }

    // 依會員分組列出，讓你刪之前看得到「刪掉的是誰的紀錄」
    const byMember = {};
    doomed.forEach(b => {
      const m = users.find(u => u.id === b.userId);
      const key = m ? `${m.name}（ID ${m.id}）` : `未知會員（userId ${b.userId}）`;
      byMember[key] = (byMember[key] || 0) + 1;
    });
    const breakdown = Object.keys(byMember).map(k => `  ・${k}：${byMember[k]} 筆`).join("\n");

    if (!confirm(
      `確定要永久刪除 ${doomed.length} 筆「已取消 / 已拒絕」的預約紀錄嗎？\n\n${breakdown}\n\n` +
      `⚠️ 此動作無法復原。\n` +
      `※ 只刪除預約紀錄本身，會員的點數與點數異動紀錄都不會受影響。\n` +
      `※ 如果只是覺得畫面太亂，建議改用上方的「隱藏已取消」勾選框，不必真的刪掉。`
    )) return;

    // 二次確認：這是不可逆的操作，值得多按一次
    if (!confirm(`最後確認：真的要刪掉這 ${doomed.length} 筆紀錄嗎？`)) return;

    bookings = bookings.filter(b => !(b && (b.status === "已取消" || b.status === "已拒絕")));
    dbSet("bookings", bookings);
    renderAdminBookingList();
    renderAdminDashboard("bookings");
    alert(`已刪除 ${doomed.length} 筆已取消 / 已拒絕的預約紀錄。`);
  });

  // 核准匯款：選票券類型自動帶入點數／種類／到期日
  document.getElementById("approveTemplate")?.addEventListener("change", (e) => {
    const tpl = couponTemplates.find(t => String(t.id) === String(e.target.value));
    if (!tpl) return;                       // 選「自訂」就保留目前欄位不動
    document.getElementById("approvePoints").value = tpl.bonusPoints;
    document.getElementById("approvePointType").value = tpl.pointType;
    const months = Number(tpl.validMonths);
    const noExp = document.getElementById("approveNoExpiry");
    noExp.checked = (months === 0);
    document.getElementById("approveExpiry").value = months === 0 ? "" : addMonthsStr(todayStr(), months);
  });

  document.getElementById("approveNoExpiry")?.addEventListener("change", (e) => {
    const d = document.getElementById("approveExpiry");
    d.disabled = e.target.checked;
    if (e.target.checked) d.value = "";
    else if (!d.value) d.value = defaultExpiryStr();
  });

  document.getElementById("btnCancelApproveRemittance")?.addEventListener("click", () => {
    navigateTo("admin");
    renderAdminDashboard("remittances");
  });

  document.getElementById("formAdminApproveRemittance")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById("approveRemittanceId").value, 10);
    const pts = parseInt(document.getElementById("approvePoints").value, 10);
    if (!pts || pts <= 0) { alert("發放點數必須大於 0。"); return; }
    const pointType = document.getElementById("approvePointType").value;
    const noExpiry = document.getElementById("approveNoExpiry").checked;
    const expiry = noExpiry ? null : (document.getElementById("approveExpiry").value || defaultExpiryStr());
    await doApproveRemittance(id, pts, pointType, expiry);
  });

  // Submit: Admin reject remittance slip
  document.getElementById("formAdminRejectRemittance")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const remitId = parseInt(document.getElementById("rejectRemittanceId").value);
    const reason = document.getElementById("txtRejectReason").value.trim();
    
    const remit = remittances.find(r => r.id === remitId);
    if (!remit) return;
    
    remit.status = "rejected";
    remit.rejectReason = reason;
    
    dbSet("remittances", remittances, true); // Trigger cloud sync
    
    alert("已成功駁回該筆申請。");
    navigateTo("admin");
    renderAdminDashboard("remittances");
  });
  
  document.getElementById("btnCancelRejectRemittance")?.addEventListener("click", () => {
    navigateTo("admin");
    renderAdminDashboard("remittances");
  });
  
  // Admin Slot Calendar Navigations
  document.getElementById("btnAdminSlotPrevMonth")?.addEventListener("click", () => {
    adminSlotCurrentMonth--;
    if (adminSlotCurrentMonth < 0) {
      adminSlotCurrentMonth = 11;
      adminSlotCurrentYear--;
    }
    renderAdminSlotsCalendar();
  });
  
  document.getElementById("btnAdminSlotNextMonth")?.addEventListener("click", () => {
    adminSlotCurrentMonth++;
    if (adminSlotCurrentMonth > 11) {
      adminSlotCurrentMonth = 0;
      adminSlotCurrentYear++;
    }
    renderAdminSlotsCalendar();
  });

  // Admin: 開放時段類型切換 (1對1 / 團體頌缽)
  document.querySelectorAll("#adminSlotTypeToggle .type-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      adminSelectedSlotType = btn.getAttribute("data-type");
      document.querySelectorAll("#adminSlotTypeToggle .type-toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const groupFields = document.getElementById("adminGroupSlotFields");
      if (groupFields) groupFields.style.display = adminSelectedSlotType === "group" ? "block" : "none";

      // 快速新增時段按鈕也跟著切換顏色，讓管理員在下手前就能看出目前要開的是哪種類型
      document.querySelectorAll(".btn-quick-time").forEach(qb => {
        qb.classList.toggle("group-type", adminSelectedSlotType === "group");
      });
    });
  });

  function getAdminSlotOpts() {
    if (adminSelectedSlotType !== "group") return { type: "1on1" };
    return {
      type: "group",
      title: document.getElementById("txtGroupSlotTitle")?.value || "團體頌缽",
      maxCapacity: document.getElementById("txtGroupSlotCapacity")?.value || 10
    };
  }

  // Admin Quick Slots buttons
  document.querySelectorAll(".btn-quick-time").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!adminSlotSelectedDateStr) {
        alert("請先點選左側日曆選擇日期！");
        return;
      }
      const timeVal = btn.getAttribute("data-time");
      addAdminSlot(adminSlotSelectedDateStr, timeVal, getAdminSlotOpts());
    });
  });

  // Submit: Admin open a new slot
  document.getElementById("formAdminCreateSlot")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!adminSlotSelectedDateStr) {
      alert("請先點選左側日曆選擇日期！");
      return;
    }
    const timeVal = document.getElementById("txtSlotTime").value;
    addAdminSlot(adminSlotSelectedDateStr, timeVal, getAdminSlotOpts());
    document.getElementById("txtSlotTime").value = "";
  });

  // Admin Search filter
  document.getElementById("txtSearchMembers").addEventListener("input", (e) => {
    memberSearchQuery = e.target.value.trim();
    renderAdminMemberList();
  });
  
  // Admin Booking filter tabs
  document.querySelectorAll(".filter-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      bookingFilter = tab.dataset.filter;
      renderAdminBookingList();
    });
  });

  // Admin Form Points Adjust submit
  document.getElementById("btnCancelAdjustPoints").addEventListener("click", () => navigateTo("admin"));
  document.getElementById("formAdminAdjustPoints").addEventListener("submit", async (e) => {
    e.preventDefault();

    const targetUserId = parseInt(document.getElementById("adjustMemberId").value);
    const targetType = document.getElementById("adjustPointTargetType").value;
    const adjustType = document.querySelector('input[name="adjustType"]:checked').value;
    const amount = parseInt(document.getElementById("adjustAmount").value);
    const rawReason = document.getElementById("adjustReason").value.trim();
    const reason = rawReason ? rawReason : "手動調整";
    
    const member = users.find(u => u.id === targetUserId);
    if (!member) return;
    
    if (member.points === undefined) member.points = 0;
    if (member.giftedPoints === undefined) member.giftedPoints = 0;
    if (member.giftedGroupPoints === undefined) member.giftedGroupPoints = 0;
    
    const timestamp = getNowDateTimeString();
    const newTxId = await getFreshNextId("transactions", transactions, 5001);

    let targetNameStr = "通用";
    if (targetType === "gifted_1on1") targetNameStr = "贈送-1對1";
    if (targetType === "gifted_group") targetNameStr = "贈送-團體";
    
    // 對應到批次系統的欄位名稱
    const fieldName = targetType === "common" ? "points"
      : targetType === "gifted_1on1" ? "giftedPoints"
      : "giftedGroupPoints";

    if (adjustType === "add") {
      // 讀取效期欄位；勾選「永不過期」則不設到期日
      const noExpiryEl = document.getElementById("adjustNoExpiry");
      const expiryInputEl = document.getElementById("adjustExpiry");
      let expiry;
      if (noExpiryEl && noExpiryEl.checked) {
        expiry = null;
      } else {
        expiry = (expiryInputEl && expiryInputEl.value) ? expiryInputEl.value : defaultExpiryStr();
      }
      grantPoints(member, fieldName, amount, expiry, `管理員調整：${reason}`);
      const currentBal = member[fieldName] || 0;
      transactions.push({
        id: newTxId,
        userId: member.id,
        amount: amount,
        type: "add",
        reason: `管理員調整(${targetNameStr})：${reason}${expiry ? `（效期至 ${expiry}）` : "（永不過期）"}`,
        date: timestamp,
        balance: currentBal
      });
    } else {
      consumePoints(member, fieldName, amount);
      const currentBal = member[fieldName] || 0;
      transactions.push({
        id: newTxId,
        userId: member.id,
        amount: amount,
        type: "deduct",
        reason: `管理員扣除(${targetNameStr})：${reason}`,
        date: timestamp,
        balance: currentBal
      });
    }
    
    dbSet("users", users);
    dbSet("transactions", transactions);
    
    alert(`成功更新會員「${member.name}」的可約次數！目前餘額：通用 ${member.points} 次 / 贈送-1對1 ${member.giftedPoints} 次 / 贈送-團體 ${member.giftedGroupPoints} 次。`);
    renderAdminDashboard("members");
  });

  // Admin Form Edit Member submit & cancel
  document.getElementById("btnCancelEditMember").addEventListener("click", () => navigateTo("admin"));
  document.getElementById("formAdminEditMember").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const memberId = parseInt(document.getElementById("editMemberId").value);
    const memberIndex = users.findIndex(u => u.id === memberId);
    if (memberIndex === -1) return;
    
    const newName = document.getElementById("editMemName").value.trim();
    const newEmail = document.getElementById("editMemEmail").value.trim().toLowerCase();
    const newPhone = document.getElementById("editMemPhone").value.trim();
    const newPassword = document.getElementById("editMemPassword").value.trim();
    const newGender = document.querySelector('input[name="editMemGender"]:checked').value;
    
    // 檢查 Email 是否與其他會員衝突
    const emailConflict = users.find(u => u.email === newEmail && u.id !== memberId);
    if (emailConflict) {
      alert("此電子郵件已被其他會員註冊，請換一個電子郵件！");
      return;
    }
    
    // 更新會員資料
    users[memberIndex].name = newName;
    users[memberIndex].email = newEmail;
    users[memberIndex].phone = newPhone;
    users[memberIndex].gender = newGender;
    
    /* 密碼處理
       重要：真正的登入密碼由 Firebase Authentication 保管，網站沒有權限直接改別人的密碼。
       以前這裡只是把雜湊寫進資料庫的 password 欄位，但登入根本不看那個欄位 ——
       也就是說「幫會員改密碼」其實從來沒有生效過，會員仍然只能用舊密碼登入。
       現在改成：自己的密碼可以直接改；別人的則寄出官方密碼重設信（這是唯一正確且安全的做法）。 */
    if (newPassword && !users[memberIndex].lineUserId) {
      const isSelf = (currentUser && users[memberIndex].email === currentUser.email);
      if (isSelf && auth.currentUser) {
        try {
          await auth.currentUser.updatePassword(newPassword);
          console.log("管理員自己更新 Firebase Auth 密碼成功");
        } catch (authErr) {
          console.error("更新 Firebase Auth 密碼失敗:", authErr);
          alert("修改密碼失敗：基於 Firebase 安全限制，可能需要您登出重新登入以驗證身分，然後再試一次！\n錯誤原因：" + authErr.message);
          return;
        }
      } else {
        const wantReset = confirm(
          `基於安全設計，網站無法直接替其他會員設定密碼（這是 Firebase 的保護機制，不是故障）。\n\n` +
          `要改為寄送「密碼重設信」到 ${newEmail} 嗎？\n會員點信中連結後可自行設定新密碼。`
        );
        if (wantReset) {
          try {
            await auth.sendPasswordResetEmail(newEmail);
            alert(`已寄出密碼重設信到 ${newEmail}，請提醒會員收信（也請他們看一下垃圾郵件匣）。`);
          } catch (resetErr) {
            console.error("寄送密碼重設信失敗:", resetErr);
            alert("寄送失敗：" + resetErr.message);
          }
        }
      }
    }
    // 不再把密碼寫進資料庫：登入完全交給 Firebase Authentication，資料庫不該保存密碼
    delete users[memberIndex].password;
    
    // 收集開通的課程 ID
    const unlockedCourses = {};
    const checkedBoxes = document.querySelectorAll('input[name="editMemCourseGrant"]:checked');
    checkedBoxes.forEach(box => {
      unlockedCourses[box.value] = true;
    });
    users[memberIndex].unlockedCourses = unlockedCourses;
    
    dbSet("users", users);
    
    alert("會員資料已更新成功！");
    renderAdminDashboard("members");
    navigateTo("admin");
  });

  // Admin Manual Add Member modal toggle
  document.getElementById("btnAdminAddMember").addEventListener("click", () => navigateTo("admin-add-member"));
  document.getElementById("btnCancelAddMem").addEventListener("click", () => navigateTo("admin"));
  
  // Admin Export Members Data to Excel (.xls)
  document.getElementById("btnExportMembers").addEventListener("click", () => {
    const memberUsers = users.filter(u => u.role === "member");
    if (memberUsers.length === 0) {
      alert("目前沒有任何會員資料可供匯出！");
      return;
    }
    
    // 匯出檔不再包含密碼欄 —— 匯出的 Excel 常常會被轉寄、存在雲端硬碟，
    // 那是客戶資料最容易外流的地方，密碼絕對不該出現在裡面。
    const headers = [
      "會員ID", "姓名", "電子郵件", "手機號碼", "生理性別",
      "加入日期", "登入方式", "通用點數", "贈送-1對1點數", "贈送-團體點數", "是否LINE帳號"
    ];

    let tableRows = "";
    memberUsers.forEach(u => {
      const isLineStr = u.lineUserId ? "是" : "否";
      const loginText = u.lineUserId ? "LINE 登入" : "Email 登入";
      tableRows += `
        <tr>
          <td>${u.id}</td>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td>${u.phone}</td>
          <td>${u.gender}</td>
          <td>${u.joinDate}</td>
          <td>${loginText}</td>
          <td>${u.points || 0}</td>
          <td>${u.giftedPoints || 0}</td>
          <td>${u.giftedGroupPoints || 0}</td>
          <td>${isLineStr}</td>
        </tr>`;
    });
    
    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>缽日會員資料</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; }
          th { background-color: #C9A063; color: #FFFFFF; font-weight: bold; }
          th, td { border: 1px solid #DDDDDD; padding: 8px; text-align: left; font-family: sans-serif; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    const blob = new Blob([excelTemplate], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const dateStr = new Date().toISOString().split("T")[0];
    const fileName = `缽日會員資料_${dateStr}.xls`;
    
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  });
  
  // Admin Form Manual Add Member submit
  document.getElementById("formAdminAddMember").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const name = document.getElementById("addMemName").value.trim();
    const email = document.getElementById("addMemEmail").value.trim().toLowerCase();
    const phone = document.getElementById("addMemPhone").value.trim();
    const password = document.getElementById("addMemPassword").value.trim();
    const gender = document.querySelector('input[name="addMemGender"]:checked').value;
    
    // Check if email unique
    if (users.find(u => u.email === email)) {
      alert("此 Email 已被其他會員註冊！");
      return;
    }
    
    if (password.length < 6) {
      alert("密碼至少需要 6 個字元（這是 Firebase 的規定）。");
      return;
    }

    /* 真正建立一個可以登入的帳號。
       以前這裡只寫入資料庫、沒有建立 Firebase Authentication 帳號，
       導致手動新增的會員拿到帳密卻「怎麼樣都登不進去」。

       這裡用第二個 Firebase App 實例來建立帳號 —— 因為 createUserWithEmailAndPassword()
       會把「目前登入者」切換成新建立的那個人，直接用主實例會把管理員自己登出。 */
    let secondaryApp;
    try {
      secondaryApp = firebase.app("secondary");
    } catch (e) {
      secondaryApp = firebase.initializeApp(firebaseConfig, "secondary");
    }

    let newUid = null;
    try {
      const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
      newUid = cred.user.uid;
      await secondaryApp.auth().signOut();
    } catch (authErr) {
      console.error("建立會員登入帳號失敗:", authErr);
      if (authErr.code === "auth/email-already-in-use") {
        alert("這個 Email 已經有登入帳號了（可能是之前註冊過但資料被刪除）。\n請改用其他 Email，或到 Firebase 主控台 → Authentication 確認。");
      } else {
        alert("建立會員登入帳號失敗：" + authErr.message);
      }
      return;
    }

    const nextUserId = await getFreshNextUserId(users, 1);
    const dateStr = new Date().toISOString().split("T")[0];

    const newUser = {
      id: nextUserId,
      email: email,
      name: name,
      phone: phone,
      gender: gender,
      // 不儲存密碼：密碼由 Firebase Authentication 保管
      role: "member",
      points: 0, // Starts at 0 points
      joinDate: dateStr,
      firebaseUid: newUid
    };

    users.push(newUser);
    dbSet("users", users);

    // Clean inputs
    document.getElementById("addMemName").value = "";
    document.getElementById("addMemEmail").value = "";
    document.getElementById("addMemPhone").value = "";
    document.getElementById("addMemPassword").value = "";

    alert(`會員「${name}」已成功新增，並且可以用這組帳密登入了！\n\n請把以下資訊給他：\n帳號：${email}\n密碼：${password}\n\n（提醒他登入後可自行修改密碼）`);
    renderAdminDashboard("members");
  });

// LINE 官方授權登入處理
function handleLiffLogin() {
  if (typeof liff === "undefined") return;

  Promise.all([
    liff.getProfile(),
    liff.getDecodedIDToken()
  ]).then(async ([profile, idToken]) => {
    const lineUserId = profile.userId;
    const lineName = profile.displayName;
    
    const finalEmail = `line_${lineUserId}@singbowl.com`;
    const finalPassword = `line_${lineUserId}_secure`;

    try {
      // 1. 嘗試以該 LINE 虛擬帳密登入 Firebase Auth
      await auth.signInWithEmailAndPassword(finalEmail, finalPassword);
      alert(`歡迎回來，${lineName}！ (LINE 登入)`);
    } catch (err) {
      console.warn("LINE Firebase Auth 登入失敗，檢查是否需要註冊或遷移:", err.code);
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        // 檢查舊資料庫是否已有此 LINE 用戶明細，有的話進行遷移
        try {
          const snapshot = await database.ref("users").orderByChild("lineUserId").equalTo(lineUserId).once("value");
          const allUsers = snapshot.val();
          let matchedKey = null;
          let matchedUser = null;
          
          if (allUsers) {
            if (Array.isArray(allUsers)) {
              for (let i = 0; i < allUsers.length; i++) {
                if (allUsers[i] && (allUsers[i].lineUserId === lineUserId || allUsers[i].email === `line_${lineUserId}@line.com`)) {
                  matchedUser = allUsers[i];
                  matchedKey = i;
                  break;
                }
              }
            } else {
              for (const key in allUsers) {
                if (allUsers[key] && (allUsers[key].lineUserId === lineUserId || allUsers[key].email === `line_${lineUserId}@line.com`)) {
                  matchedUser = allUsers[key];
                  matchedKey = key;
                  break;
                }
              }
            }
          }
          
          if (matchedUser) {
            // 進行遷移：在 Auth 建立此帳號並寫入安全路徑
            const userCredential = await auth.createUserWithEmailAndPassword(finalEmail, finalPassword);
            const newUser = userCredential.user;
            
            matchedUser.firebaseUid = newUser.uid;
            matchedUser.lineUserId = lineUserId;
            
            await database.ref(`users/${newUser.uid}`).set(matchedUser);
            await database.ref(`users/${matchedKey}`).remove();
            
            console.log("LINE 用戶資料安全遷移成功！", matchedUser.name);
            alert(`歡迎回來，${matchedUser.name}！ (LINE 登入)`);
          } else {
            // 引導新註冊
            document.getElementById("regName").value = lineName;
            document.getElementById("regPhone").value = "";
            document.getElementById("regEmail").value = "";
            
            const regForm = document.getElementById("formRegisterProfile");
            regForm.dataset.tempEmail = "";
            regForm.dataset.lineUserId = lineUserId;
            regForm.dataset.lineName = lineName;
            
            navigateTo("register");
            alert("請填寫您的基本聯絡資料，即可完成 LINE 帳號綁定！");
          }
        } catch (dbErr) {
          console.error("LINE 會員資料庫驗證出錯:", dbErr);
          alert("LINE 驗證登入出錯，請稍後再試！");
        }
      } else {
        alert(`LINE 認證登入失敗：${err.message}`);
      }
    }
  }).catch(err => {
    console.error("取得 LINE 個人資料失敗", err);
    initSession();
  });
}

// 本地模擬登入的 Fallback 邏輯
async function runMockLineLogin() {
  window.open("https://lin.ee/5FUzEjg", "_blank");

  const mockLineUserId = "U_mock_line_user_99999";
  const mockName = "LINE 測試訪客";
  
  const finalEmail = `line_${mockLineUserId}@singbowl.com`;
  const finalPassword = `line_${mockLineUserId}_secure`;
  
  try {
    await auth.signInWithEmailAndPassword(finalEmail, finalPassword);
    alert("測試：模擬 LINE 登入成功！");
  } catch (err) {
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
      try {
        const snapshot = await database.ref("users").orderByChild("lineUserId").equalTo(mockLineUserId).once("value");
        const allUsers = snapshot.val();
        let matchedKey = null;
        let matchedUser = null;
        
        if (allUsers) {
          if (Array.isArray(allUsers)) {
            for (let i = 0; i < allUsers.length; i++) {
              if (allUsers[i] && allUsers[i].lineUserId === mockLineUserId) {
                matchedUser = allUsers[i];
                matchedKey = i;
                break;
              }
            }
          } else {
            for (const key in allUsers) {
              if (allUsers[key] && allUsers[key].lineUserId === mockLineUserId) {
                matchedUser = allUsers[key];
                matchedKey = key;
                break;
              }
            }
          }
        }
        
        if (matchedUser) {
          const userCredential = await auth.createUserWithEmailAndPassword(finalEmail, finalPassword);
          const newUser = userCredential.user;
          matchedUser.firebaseUid = newUser.uid;
          await database.ref(`users/${newUser.uid}`).set(matchedUser);
          await database.ref(`users/${matchedKey}`).remove();
          alert(`測試：模擬 LINE 舊會員遷移成功！`);
        } else {
          document.getElementById("regName").value = mockName;
          document.getElementById("regPhone").value = "";
          document.getElementById("regEmail").value = "";
          
          const regForm = document.getElementById("formRegisterProfile");
          regForm.dataset.tempEmail = "";
          regForm.dataset.lineUserId = mockLineUserId;
          regForm.dataset.lineName = mockName;
          
          navigateTo("register");
        }
      } catch (dbErr) {
        console.error("模擬 LINE 登入資料庫出錯:", dbErr);
      }
    } else {
      alert(`模擬 LINE 登入失敗：${err.message}`);
    }
  }
}

  // Admin Form Issue Coupon submit
  // 改期：切換「開放時段 / 手動指定」模式
  ["rescheduleModeSlot", "rescheduleModeManual"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", syncRescheduleMode);
  });

  // 新增票券類型
  const formNewTpl = document.getElementById("formNewCouponTemplate");
  if (formNewTpl) {
    formNewTpl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("tplName").value.trim();
      const bonusPoints = parseInt(document.getElementById("tplPoints").value);
      const pointType = document.getElementById("tplPointType").value;
      const validMonths = parseInt(document.getElementById("tplValidMonths").value);

      if (!name) { alert("請輸入票券名稱。"); return; }
      if (!(bonusPoints > 0)) { alert("點數必須大於 0。"); return; }
      // 0 = 永不過期，是很容易誤觸的值（實際發生過），送出前先確認一次
      if (validMonths === 0 &&
          !confirm(`有效期限填的是 0，代表這個票券類型發出去的點數「永不過期」。\n\n確定要這樣設定嗎？\n（想設 3 個月請取消後改成 3）`)) {
        return;
      }
      if (couponTemplates.some(t => t.name === name)) {
        alert("已經有同名的票券類型了，請換一個名稱。");
        return;
      }
      couponTemplates.push({
        id: await getFreshNextId("couponTemplates", couponTemplates, 1),
        name: name,
        bonusPoints: bonusPoints,
        pointType: pointType,
        validMonths: isNaN(validMonths) ? POINT_VALIDITY_MONTHS : validMonths
      });
      dbSet("couponTemplates", couponTemplates);
      formNewTpl.reset();
      document.getElementById("tplValidMonths").value = POINT_VALIDITY_MONTHS;
      renderAdminCouponsPanel();
      alert(`票券類型「${name}」已新增，現在可以在上方發放了。`);
    });
  }

  // 切換票券類型時，自動更新到期日預設值
  const tplSel = document.getElementById("selCouponTemplate");
  if (tplSel) tplSel.addEventListener("change", syncCouponExpiryDefault);
  const cpnNoExp = document.getElementById("couponNoExpiry");
  if (cpnNoExp) cpnNoExp.addEventListener("change", () => {
    const el = document.getElementById("couponExpiry");
    if (el) el.disabled = cpnNoExp.checked;
  });
  const adjNoExp = document.getElementById("adjustNoExpiry");
  if (adjNoExp) adjNoExp.addEventListener("change", () => {
    const el = document.getElementById("adjustExpiry");
    if (el) el.disabled = adjNoExp.checked;
  });

  document.getElementById("formAdminIssueCoupon").addEventListener("submit", async (e) => {
    e.preventDefault();

    const userId = parseInt(document.getElementById("selCouponTarget").value);
    const templateSelect = document.getElementById("selCouponTemplate");
    const tpl = couponTemplates.find(t => String(t.id) === String(templateSelect.value));
    if (!tpl) { alert("請先選擇票券類型。"); return; }
    const couponName = tpl.name;
    const bonus = Number(tpl.bonusPoints) || 0;

    // 到期日：可在發放表單覆寫，否則依票券類型的有效月數計算
    const cpnNoExpiryEl = document.getElementById("couponNoExpiry");
    const cpnExpiryEl = document.getElementById("couponExpiry");
    let couponExpiry;
    if (cpnNoExpiryEl && cpnNoExpiryEl.checked) {
      couponExpiry = null;
    } else if (cpnExpiryEl && cpnExpiryEl.value) {
      couponExpiry = cpnExpiryEl.value;
    } else {
      const vm = Number(tpl.validMonths);
      couponExpiry = (vm > 0) ? addMonthsStr(todayStr(), vm) : null;
    }

    const member = users.find(u => u.id === userId);
    if (!member) return;
    
    // Add coupon to vouchers list（改用統一的防撞號配號機制）
    const nextCpnId = await getFreshNextId("vouchers", vouchers, 1);
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const newCoupon = {
      id: nextCpnId,
      userId: member.id,
      name: couponName,
      bonusPoints: bonus,
      pointType: tpl.pointType || "giftedGroupPoints",
      expiresAt: couponExpiry,
      status: "available",
      code: randomCode
    };

    vouchers.push(newCoupon);
    dbSet("vouchers", vouchers);

    // 依票券類型設定的點數種類入帳，並帶入到期日
    const cpnField = tpl.pointType || "giftedGroupPoints";
    grantPoints(member, cpnField, bonus, couponExpiry, `票券：${couponName}`);
    const currentBal = member[cpnField] || 0;
    const is1on1 = cpnField === "giftedPoints";
    dbSet("users", users);
    
    // Log points transaction
    const timestamp = getNowDateTimeString();
    const newTxId = await getFreshNextId("transactions", transactions, 5001);
    const targetNameStr = is1on1 ? "贈送-1對1" : "贈送-團體";
    transactions.push({
      id: newTxId,
      userId: member.id,
      amount: bonus,
      type: "add",
      reason: `獲贈票券優惠次數(${targetNameStr})：${couponName}`,
      date: timestamp,
      balance: currentBal
    });
    dbSet("transactions", transactions);
    
    alert(`已成功發放「${couponName}」票券並贈送 ${bonus} 次給會員「${member.name}」！`);
    renderAdminDashboard("coupons");
  });

  // Google Calendar Integration DOM binds
  document.getElementById("btnGoogleAuth")?.addEventListener("click", () => {
    if (!googleTokenClient) {
      alert("請先填寫並儲存 Google Client ID！");
      document.getElementById("divGoogleConfigForm").style.display = "block";
      return;
    }
    // Launch GIS Auth Popup
    googleTokenClient.requestAccessToken({ prompt: "consent" });
  });

  document.getElementById("btnGoogleSync")?.addEventListener("click", () => {
    syncGoogleCalendarEvents();
  });

  document.getElementById("btnToggleGoogleConfig")?.addEventListener("click", (e) => {
    const form = document.getElementById("divGoogleConfigForm");
    const btn = document.getElementById("btnToggleGoogleConfig");
    if (!form || !btn) return;
    
    if (form.style.display === "none") {
      form.style.display = "block";
      btn.innerHTML = '<i data-lucide="settings"></i> 收合 Client ID 設定';
    } else {
      form.style.display = "none";
      btn.innerHTML = '<i data-lucide="settings"></i> 展開 Client ID 設定';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  document.getElementById("btnSaveGoogleConfig")?.addEventListener("click", () => {
    const clientId = document.getElementById("txtGoogleClientId").value.trim();
    if (!clientId) {
      alert("請輸入有效的 Client ID！");
      return;
    }
    database.ref("settings/googleClientId").set(clientId)
      .then(() => {
        alert("🎉 Google Client ID 設定已成功儲存！");
        document.getElementById("divGoogleConfigForm").style.display = "none";
        const btn = document.getElementById("btnToggleGoogleConfig");
        if (btn) btn.innerHTML = '<i data-lucide="settings"></i> 展開 Client ID 設定';
        if (typeof lucide !== 'undefined') lucide.createIcons();
      })
      .catch(err => {
        console.error("儲存設定失敗:", err);
        alert("❌ 儲存設定失敗，請確認網路連線。");
      });
  });

  document.getElementById("btnToggleLineConfig")?.addEventListener("click", (e) => {
    const form = document.getElementById("divLineConfigForm");
    const btn = document.getElementById("btnToggleLineConfig");
    if (!form || !btn) return;
    
    if (form.style.display === "none") {
      form.style.display = "block";
      btn.innerHTML = '<i data-lucide="message-square"></i> 收合 LINE 通知設定';
    } else {
      form.style.display = "none";
      btn.innerHTML = '<i data-lucide="message-square"></i> 展開 LINE 通知設定';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  document.getElementById("btnSaveLineConfig")?.addEventListener("click", () => {
    const webhookUrl = document.getElementById("txtLineWebhookUrl").value.trim();
    if (!webhookUrl) {
      alert("請輸入有效的 LINE Webhook 代理 URL！");
      return;
    }
    const adminLineId = (document.getElementById("txtAdminLineUserId")?.value || "").trim();
    Promise.all([
      database.ref("settings/lineWebhookUrl").set(webhookUrl),
      // 留空代表不要管理員通知，寫 null 讓節點消失
      database.ref("settings/adminLineUserId").set(adminLineId || null)
    ])
      .then(() => {
        alert("🎉 LINE 通知設定已成功儲存！");
        document.getElementById("divLineConfigForm").style.display = "none";
        const btn = document.getElementById("btnToggleLineConfig");
        if (btn) btn.innerHTML = '<i data-lucide="message-square"></i> 展開 LINE 通知設定';
        if (typeof lucide !== 'undefined') lucide.createIcons();
      })
      .catch(err => {
        console.error("儲存 LINE 設定失敗:", err);
        alert("❌ 儲存 LINE 設定失敗，請確認網路連線。");
      });
  });

  document.getElementById("btnAdminPrevMonth")?.addEventListener("click", () => {
    adminCalendarCurrentMonth--;
    if (adminCalendarCurrentMonth < 0) {
      adminCalendarCurrentMonth = 11;
      adminCalendarCurrentYear--;
    }
    renderAdminCalendar();
  });

  document.getElementById("btnAdminNextMonth")?.addEventListener("click", () => {
    adminCalendarCurrentMonth++;
    if (adminCalendarCurrentMonth > 11) {
      adminCalendarCurrentMonth = 0;
      adminCalendarCurrentYear++;
    }
    renderAdminCalendar();
  });

  // Start Firebase Realtime Synchronization globally on load
  startRealtimeSync();

  // 智慧型資料遷移 (自動將舊版 db_state 移至新分級節點，防止舊會員資料丟失)
  migrateDatabaseIfNecessary();

  // Always initialize session and listen to Auth state changes on load
  initSession();

  // Initialize Session (LINE LIFF 優先)
  if (typeof liff !== "undefined") {
    liff.init({ liffId: "2010665706-wxtkVO4B" })
      .then(() => {
        console.log("LINE LIFF 初始化成功");
        if (liff.isLoggedIn()) {
          handleLiffLogin();
        }
      })
      .catch(err => {
        console.error("LINE LIFF 初始化失敗:", err);
      });
  }

  // --- E-Learning / Course System Event Listeners ---
  document.getElementById("btnNavCourses")?.addEventListener("click", () => navigateTo("courses"));
  document.getElementById("btnBackToCourses")?.addEventListener("click", () => navigateTo("courses"));
  document.getElementById("btnBackToCourseDetail")?.addEventListener("click", () => navigateTo("course-detail"));
  
  // Admin course panel triggers
  document.getElementById("btnAdminMenuCourses")?.addEventListener("click", () => renderAdminDashboard("courses"));
  document.getElementById("btnAdminAddCourse")?.addEventListener("click", () => renderAdminEditCourseForm());
  document.getElementById("btnCancelEditCourse")?.addEventListener("click", () => {
    navigateTo("admin");
    renderAdminDashboard("courses");
  });
  document.getElementById("btnAdminAddLessonToForm")?.addEventListener("click", () => adminFormAddLessonRow());
  
  // Form Submit Edit Course
  document.getElementById("formAdminEditCourse")?.addEventListener("submit", (e) => {
    e.preventDefault();
    adminSaveCourse();
  });
});


// ==========================================
// E-Learning / Video Course System Logic
// ==========================================

function parseYoutubeEmbedUrl(url) {
  if (!url) return "";
  let videoId = "";
  
  // Mobile short URL style: https://youtu.be/dQw4w9WgXcQ
  if (url.indexOf("youtu.be/") !== -1) {
    videoId = url.split("youtu.be/")[1].split(/[?#]/)[0];
  }
  // Standard watch style: https://www.youtube.com/watch?v=dQw4w9WgXcQ
  else if (url.indexOf("v=") !== -1) {
    videoId = url.split("v=")[1].split("&")[0].split(/[?#]/)[0];
  }
  // Embed style: https://www.youtube.com/embed/dQw4w9WgXcQ
  else if (url.indexOf("embed/") !== -1) {
    videoId = url.split("embed/")[1].split(/[?#]/)[0];
  }
  
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }
  return url;
}

function renderCoursesPage() {
  const container = document.getElementById("courseGridContainer");
  if (!container) return;
  container.innerHTML = "";

  if (!courses || courses.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--mist); font-size: 14px;">目前尚無任何線上影音課程。</div>`;
    return;
  }

  courses.forEach(c => {
    const hasAccess = (currentUser && currentUser.unlockedCourses && currentUser.unlockedCourses[c.id] === true) || (currentUser && currentUser.role === "admin");
    const totalLessons = c.lessons ? c.lessons.length : 0;
    
    // 計算學習進度
    let completedCount = 0;
    if (c.lessons && currentUser && currentUser.completedLessons) {
      c.lessons.forEach(l => {
        if (currentUser.completedLessons[`${c.id}_${l.id}`]) {
          completedCount++;
        }
      });
    }
    const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    const card = document.createElement("div");
    card.className = `course-card ${hasAccess ? "" : "locked"}`;
    
    const coverImage = c.coverUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600";
    
    if (hasAccess) {
      card.innerHTML = `
        <div class="course-cover-wrap">
          <img src="${coverImage}" class="course-cover" alt="${c.title}">
        </div>
        <div class="course-body">
          <h3 class="course-title">${c.title}</h3>
          <div class="course-lecturer">講師：${c.lecturer || "匿名"} | 共 ${totalLessons} 堂課</div>
          <p class="course-desc">${c.description || "尚無簡介"}</p>
          <div class="course-progress-bar-container">
            <div class="course-progress-bar" style="width: ${percent}%;"></div>
          </div>
          <div class="course-progress-text">學習進度 ${completedCount}/${totalLessons} 堂 (${percent}%)</div>
          <button class="course-card-btn">開始學習 →</button>
        </div>
      `;
      card.addEventListener("click", () => {
        activeCourse = c;
        navigateTo("course-detail");
      });
    } else {
      card.innerHTML = `
        <div class="course-cover-wrap">
          <img src="${coverImage}" class="course-cover" alt="${c.title}">
          <div class="course-locked-overlay">
            <i data-lucide="lock"></i>
            <span class="course-locked-badge">尚未開通</span>
          </div>
        </div>
        <div class="course-body">
          <h3 class="course-title">${c.title}</h3>
          <div class="course-lecturer">講師：${c.lecturer || "匿名"} | 共 ${totalLessons} 堂課</div>
          <p class="course-desc">${c.description || "尚無簡介"}</p>
          <div class="course-locked-note">
            <i data-lucide="lock"></i> 此為付費課程，請聯絡管理員開通
          </div>
        </div>
      `;
      card.addEventListener("click", () => {
        alert("此為付費課程，請先聯絡療癒師開通課程權限喔！🎵");
      });
    }
    container.appendChild(card);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderCourseDetailPage() {
  if (!activeCourse) {
    navigateTo("courses");
    return;
  }
  
  document.getElementById("detailCourseCover").src = activeCourse.coverUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600";
  document.getElementById("detailCourseTitle").textContent = activeCourse.title;
  document.getElementById("detailCourseLecturer").textContent = `講師：${activeCourse.lecturer || "匿名"}`;
  document.getElementById("detailCourseDesc").textContent = activeCourse.description || "尚無簡介。";

  const container = document.getElementById("lessonGridContainer");
  container.innerHTML = "";

  const lessonsList = activeCourse.lessons || [];
  if (lessonsList.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--mist);">本課程目前尚無任何單元影片。</div>`;
    return;
  }

  lessonsList.forEach((lesson, index) => {
    const isCompleted = currentUser && currentUser.completedLessons && currentUser.completedLessons[`${activeCourse.id}_${lesson.id}`];
    const card = document.createElement("div");
    card.className = "lesson-card";
    
    card.innerHTML = `
      <div class="lesson-badge">第 ${index + 1} 堂</div>
      <h4 class="lesson-title">${lesson.title}</h4>
      <p class="lesson-desc">${lesson.description || "尚無單元簡介。"}</p>
      <div class="lesson-footer">
        <div class="lesson-duration">
          <i data-lucide="play" style="width:12px; height:12px;"></i>
          <span>${lesson.duration || "00:00"}</span>
        </div>
        <span class="lesson-btn-start" style="color: ${isCompleted ? 'var(--success)' : 'var(--brass-soft)'};">
          ${isCompleted ? '已完成 ✓' : '開始上課 →'}
        </span>
      </div>
    `;
    card.addEventListener("click", () => {
      activeLesson = lesson;
      navigateTo("lesson-player");
    });
    container.appendChild(card);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderLessonPlayerPage() {
  if (!activeCourse || !activeLesson) {
    navigateTo("courses");
    return;
  }

  const badgeEl = document.getElementById("playerLessonBadge");
  const titleEl = document.getElementById("playerLessonTitle");
  const durationEl = document.getElementById("playerLessonDuration");
  const descEl = document.getElementById("playerLessonDesc");
  const iframeEl = document.getElementById("lessonVideoIframe");

  badgeEl.textContent = `第 ${activeLesson.id} 堂`;
  titleEl.textContent = activeLesson.title;
  durationEl.textContent = activeLesson.duration || "00:00";
  descEl.textContent = activeLesson.description || "無單元說明。";

  // Checkbox / button for completion state
  const isCompleted = currentUser && currentUser.completedLessons && currentUser.completedLessons[`${activeCourse.id}_${activeLesson.id}`];
  
  // Clear old completion button if any
  const oldBtn = document.getElementById("btnToggleLessonCompletion");
  if (oldBtn) oldBtn.remove();
  
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "btnToggleLessonCompletion";
  toggleBtn.className = `cta-btn ${isCompleted ? 'secondary-btn' : 'primary-btn'}`;
  toggleBtn.style.marginTop = "20px";
  toggleBtn.style.width = "auto";
  toggleBtn.textContent = isCompleted ? "標記為未完成" : "✓ 標記本堂為已完成";
  toggleBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    if (!currentUser.completedLessons) currentUser.completedLessons = {};
    
    const key = `${activeCourse.id}_${activeLesson.id}`;
    if (isCompleted) {
      delete currentUser.completedLessons[key];
    } else {
      currentUser.completedLessons[key] = true;
    }
    
    // Sync to Firebase
    const pathKey = getUserPathKey(currentUser);
    await database.ref(`users/${pathKey}/completedLessons`).set(currentUser.completedLessons || null).catch(err => handleDbWriteError(err, "completedLessons"));
    
    // Update local data copy
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx !== -1) {
      users[idx].completedLessons = currentUser.completedLessons;
      dbSet("users", users, false);
    }
    
    renderLessonPlayerPage();
  });
  descEl.parentNode.appendChild(toggleBtn);

  // Set Video Src
  iframeEl.src = parseYoutubeEmbedUrl(activeLesson.videoUrl);
}

function renderAdminCoursesPanel() {
  const container = document.getElementById("adminCourseList");
  if (!container) return;
  container.innerHTML = "";

  if (!courses || courses.length === 0) {
    container.innerHTML = `<tr><td colspan="7" class="tx-empty" style="text-align:center;">目前無課程資料，請點選「新增課程」</td></tr>`;
    return;
  }

  courses.forEach(c => {
    const totalLessons = c.lessons ? c.lessons.length : 0;
    const coverImage = c.coverUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600";
    
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span style="font-family:'JetBrains Mono';font-size:11px;">#${c.id}</span></td>
      <td><img src="${coverImage}" style="width: 50px; height: 30px; object-fit: cover; border-radius: 4px; border:1px solid var(--hairline);" alt="封面"></td>
      <td><strong>${c.title}</strong></td>
      <td>${c.lecturer || "無講師"}</td>
      <td>${totalLessons} 堂</td>
      <td><span style="font-size:12px; color:var(--mist); display:inline-block; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.description || "無簡介"}</span></td>
      <td>
        <div class="action-btn-group">
          <button class="table-action-btn success" onclick="renderAdminEditCourseForm(${c.id})">編輯</button>
          <button class="table-action-btn danger" onclick="adminDeleteCourse(${c.id})">刪除</button>
        </div>
      </td>
    `;
    container.appendChild(row);
  });
}

window.renderAdminEditCourseForm = function(courseId = null) {
  const formList = document.getElementById("adminFormLessonsList");
  formList.innerHTML = "";
  document.getElementById("txtCourseQuickVideoUrl").value = "";

  if (courseId) {
    const courseObj = courses.find(c => c.id === courseId);
    if (!courseObj) return;

    document.getElementById("lblAdminEditCourseTitle").textContent = "編輯課程資訊";
    document.getElementById("editCourseId").value = courseObj.id;
    document.getElementById("txtCourseTitle").value = courseObj.title;
    document.getElementById("txtCourseLecturer").value = courseObj.lecturer || "";
    document.getElementById("txtCourseCoverUrl").value = courseObj.coverUrl || "";
    document.getElementById("txtCourseDesc").value = courseObj.description || "";

    if (courseObj.lessons && courseObj.lessons.length > 0) {
      courseObj.lessons.forEach(l => adminFormAddLessonRow(l));
    }
  } else {
    document.getElementById("lblAdminEditCourseTitle").textContent = "新增課程";
    document.getElementById("editCourseId").value = "";
    document.getElementById("txtCourseTitle").value = "";
    document.getElementById("txtCourseLecturer").value = "";
    document.getElementById("txtCourseCoverUrl").value = "";
    document.getElementById("txtCourseDesc").value = "";
  }

  navigateTo("admin-edit-course");
};

function adminFormAddLessonRow(lesson = null) {
  const container = document.getElementById("adminFormLessonsList");
  if (!container) return;

  const count = container.children.length + 1;
  const div = document.createElement("div");
  div.className = "admin-lesson-item";
  div.innerHTML = `
    <button type="button" class="admin-lesson-remove-btn" onclick="this.parentNode.remove()">✕ 刪除</button>
    <div style="font-size:11px; font-weight:600; color:var(--paper); margin-bottom:8px;">單元 ${count}</div>
    <div style="display:grid; grid-template-columns: 1fr 120px; gap:10px; margin-bottom:8px;">
      <div>
        <label style="font-size:11px; color:var(--brass-dim); display:block; margin-bottom:4px;">單元影片標題 *</label>
        <input type="text" class="form-input" name="formLessonTitle" placeholder="例：第1堂 基礎入門" required value="${lesson ? lesson.title : ''}">
      </div>
      <div>
        <label style="font-size:11px; color:var(--brass-dim); display:block; margin-bottom:4px;">時長 *</label>
        <input type="text" class="form-input" name="formLessonDuration" placeholder="例：40:00" required value="${lesson ? lesson.duration : ''}">
      </div>
    </div>
    <div style="margin-bottom:8px;">
      <label style="font-size:11px; color:var(--brass-dim); display:block; margin-bottom:4px;">YouTube 影片連結 *</label>
      <input type="url" class="form-input" name="formLessonVideoUrl" placeholder="貼上 YouTube 影片網址" required value="${lesson ? lesson.videoUrl : ''}">
    </div>
    <div>
      <label style="font-size:11px; color:var(--brass-dim); display:block; margin-bottom:4px;">單元簡介 (選填)</label>
      <textarea class="form-input textarea-input" name="formLessonDesc" rows="2" placeholder="這堂單元的簡短介紹...">${lesson ? (lesson.description || '') : ''}</textarea>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function adminSaveCourse() {
  const courseIdInput = document.getElementById("editCourseId").value;
  const title = document.getElementById("txtCourseTitle").value.trim();
  const lecturer = document.getElementById("txtCourseLecturer").value.trim();
  const coverUrl = document.getElementById("txtCourseCoverUrl").value.trim();
  const description = document.getElementById("txtCourseDesc").value.trim();

  // Validate & build lessons list
  const lessonItems = document.querySelectorAll("#adminFormLessonsList .admin-lesson-item");
  const lessons = [];
  
  for (let i = 0; i < lessonItems.length; i++) {
    const item = lessonItems[i];
    const lTitle = item.querySelector('input[name="formLessonTitle"]').value.trim();
    const lDuration = item.querySelector('input[name="formLessonDuration"]').value.trim();
    const lVideoUrl = item.querySelector('input[name="formLessonVideoUrl"]').value.trim();
    const lDesc = item.querySelector('textarea[name="formLessonDesc"]').value.trim();
    
    if (!lTitle || !lDuration || !lVideoUrl) {
      alert("請完整填寫所有單元的標題、時長和影片網址！");
      return;
    }
    
    lessons.push({
      id: i + 1,
      title: lTitle,
      duration: lDuration,
      videoUrl: parseYoutubeEmbedUrl(lVideoUrl),
      description: lDesc
    });
  }

  // Quick single-video shortcut: only applies when no lesson units were manually added.
  const quickVideoUrl = document.getElementById("txtCourseQuickVideoUrl")?.value.trim();
  if (lessons.length === 0 && quickVideoUrl) {
    lessons.push({
      id: 1,
      title: title || "課程影片",
      duration: "00:00",
      videoUrl: parseYoutubeEmbedUrl(quickVideoUrl),
      description: description
    });
  }

  let courseId = courseIdInput ? parseInt(courseIdInput) : null;
  const isAdding = !courseId;
  
  if (isAdding) {
    courseId = await getFreshNextId("courses", courses, 1001);
  }

  const courseObj = {
    id: courseId,
    title: title,
    lecturer: lecturer,
    coverUrl: coverUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600",
    description: description,
    lessons: lessons
  };

  if (isAdding) {
    courses.push(courseObj);
  } else {
    const idx = courses.findIndex(c => c.id === courseId);
    if (idx !== -1) {
      courses[idx] = courseObj;
    }
  }

  dbSet("courses", courses);
  alert("課程儲存成功！🎉");
  navigateTo("admin");
  renderAdminDashboard("courses");
}

window.adminDeleteCourse = function(courseId) {
  const courseObj = courses.find(c => c.id === courseId);
  if (!courseObj) return;

  if (confirm(`⚠️ 確定要永久刪除課程「${courseObj.title}」嗎？\n刪除後將無法恢復此課程及其單元影片！`)) {
    const idx = courses.findIndex(c => c.id === courseId);
    if (idx !== -1) {
      courses.splice(idx, 1);
      dbSet("courses", courses);
      alert("課程已成功刪除！");
      renderAdminDashboard("courses");
    }
  }
};


// 從雲端資料庫 (Firebase) 監聽最新狀態並即時同步 (智慧型角色分權隔離與全域防重聽)
let activeListeners = [];

function clearActiveListeners() {
  activeListeners.forEach(ref => ref.off());
  activeListeners = [];
}

function startRealtimeSync() {
  clearActiveListeners();
  
  const savedUserId = localStorage.getItem("singbowl_current_user_id");
  const currentUserId = currentUser ? currentUser.id : (savedUserId ? parseInt(savedUserId) : null);
  const isAdmin = currentUser ? (currentUser.role === "admin") : false;
  const userPathKey = (auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid : (currentUser ? getUserPathKey(currentUser) : currentUserId);
  
  console.log(`啟動雲端即時同步監聽... (用戶ID: ${currentUserId}, 路徑金鑰: ${userPathKey}, 管理員權限: ${isAdmin})`);
  
  // 1. 公共節點：所有人 (含未登入訪客) 皆監聽預約時段 slots 與團體課程 groupSessions
  const slotsRef = database.ref("slots");
  slotsRef.on("value", (snapshot) => {
    const val = snapshot.val();
    slots = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)) : [];
    dbSet("slots", slots, false);
    triggerViewRender();
  });
  activeListeners.push(slotsRef);
  
  const groupSessionsRef = database.ref("groupSessions");
  groupSessionsRef.on("value", (snapshot) => {
    const val = snapshot.val();
    groupSessions = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)) : [];
    dbSet("groupSessions", groupSessions, false);
    triggerViewRender();
  });
  activeListeners.push(groupSessionsRef);
  
  const coursesRef = database.ref("courses");
  coursesRef.on("value", (snapshot) => {
    const val = snapshot.val();
    courses = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)).sort((a,b) => a.id - b.id) : [];
    dbSet("courses", courses, false);
    triggerViewRender();
  });
  activeListeners.push(coursesRef);
  
  // 1.1 監聽 Google Client ID 設定
  const googleClientIdRef = database.ref("settings/googleClientId");
  googleClientIdRef.on("value", (snapshot) => {
    googleClientId = snapshot.val() || "";
    const input = document.getElementById("txtGoogleClientId");
    if (input) input.value = googleClientId;
    initGoogleGis();
  });
  activeListeners.push(googleClientIdRef);

  // 1.2 監聽 LINE Webhook Proxy URL 設定
  const lineWebhookUrlRef = database.ref("settings/lineWebhookUrl");
  lineWebhookUrlRef.on("value", (snapshot) => {
    const lineWebhookUrl = snapshot.val() || "";
    const input = document.getElementById("txtLineWebhookUrl");
    if (input) input.value = lineWebhookUrl;
  });
  activeListeners.push(lineWebhookUrlRef);

  // 1.3 監聽管理員 LINE User ID（自動提醒的「明日預約清單」收件人）
  const adminLineUserIdRef = database.ref("settings/adminLineUserId");
  adminLineUserIdRef.on("value", (snapshot) => {
    const input = document.getElementById("txtAdminLineUserId");
    if (input) input.value = snapshot.val() || "";
  });
  activeListeners.push(adminLineUserIdRef);
  
  // 2. 角色權限隔離節點監聽
  if (currentUserId) {
    if (isAdmin) {
      // 管理員：監聽/下載所有人的完整明細
      const usersRef = database.ref("users");
      usersRef.on("value", (snapshot) => {
        const val = snapshot.val();
        users = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)) : [];
        // 雲端資料進來後補齊批次結構，再掃一次到期（順序很重要，避免點數對不上）
        users.forEach(u => ensureBatches(u));
        runExpirySweep();
        dbSet("users", users, false);
        syncCurrentUser();
        triggerViewRender();
        runReminderSweep("users");   // 兩邊都回報過才會真的開跑
      });
      activeListeners.push(usersRef);

      const bookingsRef = database.ref("bookings");
      bookingsRef.on("value", (snapshot) => {
        const val = snapshot.val();
        bookings = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)).sort((a,b) => a.id - b.id) : [];
        dbSet("bookings", bookings, false);
        triggerViewRender();
        runReminderSweep("bookings");
      });
      activeListeners.push(bookingsRef);
      
      const vouchersRef = database.ref("vouchers");
      vouchersRef.on("value", (snapshot) => {
        const val = snapshot.val();
        vouchers = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)).sort((a,b) => a.id - b.id) : [];
        dbSet("vouchers", vouchers, false);
        triggerViewRender();
      });
      activeListeners.push(vouchersRef);
      
      const transactionsRef = database.ref("transactions");
      transactionsRef.on("value", (snapshot) => {
        const val = snapshot.val();
        transactions = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)).sort((a,b) => a.id - b.id) : [];
        dbSet("transactions", transactions, false);
        triggerViewRender();
      });
      activeListeners.push(transactionsRef);
      
      const remittancesRef = database.ref("remittances");
      remittancesRef.on("value", (snapshot) => {
        const val = snapshot.val();
        remittances = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)).sort((a,b) => a.id - b.id) : [];
        dbSet("remittances", remittances, false);
        triggerViewRender();
      });
      activeListeners.push(remittancesRef);
      
    } else {
      // 一般會員：只下載並監聽屬於自己的數據，保護隱私安全 (OrderByChild + EqualTo)
      
      // 監聽自己的用戶帳戶資料
      const userRef = database.ref(`users/${userPathKey}`);
      userRef.on("value", (snapshot) => {
        const val = snapshot.val();
        if (val) {
          const idx = users.findIndex(u => u.id === currentUserId);
          if (idx !== -1) {
            users[idx] = val;
          } else {
            users.push(val);
          }
          dbSet("users", users, false);
          currentUser = val;
          syncCurrentUser();
          triggerViewRender();
        }
      });
      activeListeners.push(userRef);
      
      // 監聽自己的預約明細
      const myBookingsRef = database.ref("bookings").orderByChild("userId").equalTo(currentUserId);
      myBookingsRef.on("value", (snapshot) => {
        const val = snapshot.val();
        bookings = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)).sort((a,b) => a.id - b.id) : [];
        dbSet("bookings", bookings, false);
        triggerViewRender();
      });
      activeListeners.push(myBookingsRef);
      
      // 監聽自己的優惠券
      const myVouchersRef = database.ref("vouchers").orderByChild("userId").equalTo(currentUserId);
      myVouchersRef.on("value", (snapshot) => {
        const val = snapshot.val();
        vouchers = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)).sort((a,b) => a.id - b.id) : [];
        dbSet("vouchers", vouchers, false);
        triggerViewRender();
      });
      activeListeners.push(myVouchersRef);
      
      // 監聽自己的點數歷史帳本
      const myTransactionsRef = database.ref("transactions").orderByChild("userId").equalTo(currentUserId);
      myTransactionsRef.on("value", (snapshot) => {
        const val = snapshot.val();
        transactions = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)).sort((a,b) => a.id - b.id) : [];
        dbSet("transactions", transactions, false);
        triggerViewRender();
      });
      activeListeners.push(myTransactionsRef);
      
      // 監聽自己的匯款對帳單
      const myRemittancesRef = database.ref("remittances").orderByChild("userId").equalTo(currentUserId);
      myRemittancesRef.on("value", (snapshot) => {
        const val = snapshot.val();
        remittances = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)).sort((a,b) => a.id - b.id) : [];
        dbSet("remittances", remittances, false);
        triggerViewRender();
      });
      activeListeners.push(myRemittancesRef);
    }
  }
}

function syncCurrentUser() {
  const savedUserId = localStorage.getItem("singbowl_current_user_id");
  if (savedUserId) {
    const updatedUser = users.find(u => u.id === parseInt(savedUserId));
    if (updatedUser) {
      currentUser = updatedUser;
    }
  }
}

function triggerViewRender() {
  const activeSection = document.querySelector(".view-section.active");
  if (activeSection) {
    const viewId = activeSection.id.replace("view-", "");
    if (viewId === "member") renderDashboard();
    if (viewId === "admin") renderAdminDashboard(activeAdminPane);
    if (viewId === "buy-points") renderBuyPointsPage();
    if (viewId === "book") switchBookingTab(activeBookingTab);
  }
}

/* ============================================================
   一次性修復工具（管理員專用，從瀏覽器 Console 呼叫）
   用途：處理歷史上因 id 撞號造成的重複會員 id。
   使用方式（登入管理員後按 F12 開 Console）：
     boriRepair.list()                          // 檢視所有重複 id
     boriRepair.reassign("你的email")            // 幫該帳號換一個全新且唯一的 id
     boriRepair.reassign("你的email", true)      // 同時把該 id 底下的預約/點數紀錄一起搬過去
   ============================================================ */
window.boriRepair = {
  list() {
    const byId = {};
    users.forEach(u => {
      if (!u) return;
      (byId[u.id] = byId[u.id] || []).push(`${u.name}（${u.email}，加入 ${u.joinDate}）`);
    });
    const dups = Object.keys(byId).filter(id => byId[id].length > 1);
    if (!dups.length) {
      console.log("✅ 目前沒有重複的會員 id。");
      return;
    }
    dups.forEach(id => {
      console.warn(`⚠️ id = ${id} 有 ${byId[id].length} 個帳號共用：`);
      byId[id].forEach(s => console.log("   ・" + s));
    });
    console.log('\n修復方式：boriRepair.reassign("要換 id 的那個 email")');
  },

  async reassign(email, moveRecords = false) {
    if (!currentUser || currentUser.role !== "admin") {
      console.error("❌ 請先以管理員身分登入再執行。");
      return;
    }
    const target = users.find(u => u && u.email === String(email).trim().toLowerCase());
    if (!target) {
      console.error(`❌ 找不到 email 為 ${email} 的會員。`);
      return;
    }
    const oldId = target.id;
    const newId = await getFreshNextUserId(users, 1);
    if (users.some(u => u && u.id === newId)) {
      console.error(`❌ 新 id ${newId} 已被佔用，請稍後再試。`);
      return;
    }

    const relatedBookings = bookings.filter(b => b && b.userId === oldId).length;
    const relatedTx = transactions.filter(t => t && t.userId === oldId).length;
    const relatedVouchers = vouchers.filter(v => v && v.userId === oldId).length;
    const msg =
      `要把「${target.name}（${target.email}）」的 id 從 ${oldId} 改成 ${newId} 嗎？\n\n` +
      `目前掛在 id=${oldId} 底下的紀錄：預約 ${relatedBookings} 筆、點數異動 ${relatedTx} 筆、優惠券 ${relatedVouchers} 筆\n` +
      (moveRecords
        ? `⚠️ 這些紀錄「會」一起搬到新 id（注意：若這些紀錄其實屬於另一個共用同 id 的人，會被誤搬）。`
        : `這些紀錄「不會」被搬動，會留在 id=${oldId}（也就是留給另一個帳號）。`);
    if (!confirm(msg)) {
      console.log("已取消。");
      return;
    }

    target.id = newId;
    dbSet("users", users);

    if (moveRecords) {
      bookings.forEach(b => { if (b && b.userId === oldId) b.userId = newId; });
      transactions.forEach(t => { if (t && t.userId === oldId) t.userId = newId; });
      vouchers.forEach(v => { if (v && v.userId === oldId) v.userId = newId; });
      dbSet("bookings", bookings);
      dbSet("transactions", transactions);
      dbSet("vouchers", vouchers);
    }

    console.log(`✅ 完成：${target.name} 的 id 已由 ${oldId} 改為 ${newId}。請重新整理頁面確認。`);
    if (typeof renderAdminDashboard === "function") renderAdminDashboard("members");
  },

  /* 檢視某個 userId 底下的所有預約，含「建立時間」——
     建立時間是判斷「這筆到底是誰約的」最可靠的線索（會員加入之前的預約不可能是他的）。 */
  bookingsOf(userId) {
    const list = bookings.filter(b => b && b.userId === Number(userId));
    if (!list.length) {
      console.log(`userId ${userId} 底下沒有任何預約。`);
      return;
    }
    const owner = users.find(u => u.id === Number(userId));
    console.log(`userId ${userId}${owner ? `（目前對應到：${owner.name}，加入日期 ${owner.joinDate}）` : "（找不到對應會員）"} 共有 ${list.length} 筆預約：`);
    console.table(list.map(b => ({
      預約ID: b.id,
      項目: b.type === "1on1" ? "1對1" : "團體",
      預約時間: `${b.date} ${b.time || ""}`.trim(),
      狀態: b.status,
      建立於: b.timestamp || "（舊資料無記錄）"
    })));
  },

  /* 把預約紀錄從一個 userId 搬到另一個 userId。
     用於修正「因為 id 撞號而掛錯人」的歷史預約。
     onlyCancelled 預設 true —— 只搬已取消/已拒絕的，避免動到還在進行中的預約。 */
  async moveBookings(fromUserId, toUserId, onlyCancelled = true) {
    if (!currentUser || currentUser.role !== "admin") {
      console.error("❌ 請先以管理員身分登入再執行。");
      return;
    }
    const from = Number(fromUserId), to = Number(toUserId);
    const toUser = users.find(u => u.id === to);
    if (!toUser) {
      console.error(`❌ 找不到 id 為 ${to} 的會員，請先確認搬過去的對象存在。`);
      return;
    }
    const fromUser = users.find(u => u.id === from);

    const targets = bookings.filter(b =>
      b && b.userId === from &&
      (!onlyCancelled || b.status === "已取消" || b.status === "已拒絕")
    );
    if (!targets.length) {
      console.log("沒有符合條件的預約需要搬動。");
      return;
    }

    console.log(`即將把以下 ${targets.length} 筆預約從 userId ${from}${fromUser ? `（${fromUser.name}）` : ""} 搬到 userId ${to}（${toUser.name}）：`);
    console.table(targets.map(b => ({
      預約ID: b.id, 預約時間: `${b.date} ${b.time || ""}`.trim(), 狀態: b.status, 建立於: b.timestamp || "（無）"
    })));

    if (!confirm(
      `確定要把這 ${targets.length} 筆預約改成「${toUser.name}」的嗎？\n\n` +
      `⚠️ 請先看 Console 上方表格的「建立於」欄位確認：\n` +
      `這些預約如果是在別的會員加入之前建立的，就一定不是他的，可以放心搬。\n\n` +
      (onlyCancelled ? `目前只會搬「已取消 / 已拒絕」的紀錄，進行中的預約不會被動到。` : `⚠️ 你關閉了「只搬已取消」的保護，進行中的預約也會被搬動。`)
    )) {
      console.log("已取消，沒有搬動任何資料。");
      return;
    }

    targets.forEach(b => { b.userId = to; });
    dbSet("bookings", bookings);
    console.log(`✅ 已把 ${targets.length} 筆預約改掛到「${toUser.name}」（id ${to}）。`);
    if (typeof renderAdminBookingList === "function") renderAdminBookingList();
  },

  /* 清除資料庫裡殘留的 password 欄位。
     登入已完全交由 Firebase Authentication 處理，資料庫不需要、也不該保存任何密碼。
     舊資料用的是沒加鹽的 SHA-256（甚至可能有明文），留著只是風險，沒有任何用途。 */
  async purgePasswords() {
    if (!currentUser || currentUser.role !== "admin") {
      console.error("❌ 請先以管理員身分登入再執行。");
      return;
    }
    const affected = users.filter(u => u && u.password !== undefined);
    if (!affected.length) {
      console.log("✅ 資料庫裡已經沒有任何 password 欄位了，很乾淨。");
      return;
    }
    console.log(`找到 ${affected.length} 筆還帶著 password 欄位的會員資料：`);
    console.table(affected.map(u => ({
      id: u.id, 姓名: u.name, email: u.email,
      密碼型態: (typeof u.password === "string" && u.password.length === 64 && /^[0-9a-f]+$/.test(u.password)) ? "SHA-256 雜湊" : "⚠️ 疑似明文"
    })));
    if (!confirm(
      `要清除這 ${affected.length} 筆資料裡的 password 欄位嗎？\n\n` +
      `✅ 不會影響任何人登入 —— 密碼是由 Firebase Authentication 保管的，這個欄位早就沒在用了。\n` +
      `✅ 不會影響點數、預約或任何其他資料。`
    )) {
      console.log("已取消。");
      return;
    }
    for (const u of affected) {
      delete u.password;
      try {
        await database.ref(`users/${getUserPathKey(u)}/password`).remove();
      } catch (e) {
        console.error(`清除 ${u.email} 的密碼欄位失敗：`, e);
      }
    }
    dbSet("users", users);
    console.log(`✅ 已清除 ${affected.length} 筆密碼欄位。資料庫裡不再保存任何密碼。`);
    if (typeof renderAdminDashboard === "function") renderAdminDashboard("members");
  },

  /* 列出所有管理員權限的帳號，方便定期稽核「後台有幾把鑰匙」 */
  admins() {
    const list = users.filter(u => u && u.role === "admin");
    console.log(`目前共有 ${list.length} 個管理員帳號：`);
    console.table(list.map(u => ({ id: u.id, 姓名: u.name, email: u.email, 加入日期: u.joinDate || "（無，可能是程式建立的）" })));
    return list.length;
  },

  /* 依 email 精準刪除單一帳號（用 email 而非 id，才能正確處理 id 撞號的情況）。
     注意：這只會刪掉資料庫裡的會員資料，Firebase Authentication 的登入憑證要另外到
     Firebase 主控台 → Authentication → Users 手動刪除，否則該帳號仍可登入。 */
  async purgeUser(email) {
    if (!currentUser || currentUser.role !== "admin") {
      console.error("❌ 請先以管理員身分登入再執行。");
      return;
    }
    const key = String(email).trim().toLowerCase();
    if (currentUser.email === key) {
      console.error("❌ 不能刪除你自己正在使用的帳號。");
      return;
    }
    const target = users.find(u => u && u.email === key);
    if (!target) {
      console.error(`❌ 找不到 email 為 ${email} 的帳號。`);
      return;
    }
    const hasBookings = bookings.filter(b => b && b.userId === target.id).length;
    const sharesId = users.filter(u => u && u.id === target.id).length > 1;
    let msg = `確定要刪除帳號「${target.name}（${target.email}）」嗎？\n權限：${target.role}\n此動作無法復原。`;
    if (hasBookings) {
      msg += `\n\n⚠️ 這個 id（${target.id}）底下有 ${hasBookings} 筆預約` +
        (sharesId ? `，而且有其他帳號共用同一個 id —— 這些預約不會被刪除，以免誤刪別人的資料。` : `，將一併保留，請自行確認。`);
    }
    if (!confirm(msg)) {
      console.log("已取消。");
      return;
    }
    const pathKey = getUserPathKey(target);
    try {
      await database.ref(`users/${pathKey}`).remove();
    } catch (e) {
      console.error("刪除雲端節點失敗：", e);
      return;
    }
    users = users.filter(u => u !== target);
    dbSet("users", users);
    console.log(`✅ 已刪除「${target.name}」（${target.email}）。`);
    console.warn("⚠️ 建議收尾：到 Firebase 主控台 → Authentication → Users 把這個 email 的登入憑證也刪掉（詳見 boriRepair 說明）。");
    if (typeof renderAdminDashboard === "function") renderAdminDashboard("members");
  },

  /* 一鍵清除「程式建立的臨時管理員帳號」。
     判定條件（必須同時成立，避免誤刪真人帳號）：
       1. role 是 admin
       2. email 以 temp_ 或 test_ 開頭，或完全沒有 joinDate（真人註冊一定會寫入日期）
       3. 不是你正在使用的帳號，也不是主管理員 admin@singbowl.com */
  async purgeAllTempAdmins() {
    if (!currentUser || currentUser.role !== "admin") {
      console.error("❌ 請先以管理員身分登入再執行。");
      return;
    }
    const suspects = users.filter(u =>
      u &&
      u.role === "admin" &&
      u.email !== currentUser.email &&
      u.email !== "admin@singbowl.com" &&
      (/^(temp_|test_)/i.test(u.email || "") || !u.joinDate)
    );

    if (suspects.length === 0) {
      console.log("✅ 沒有找到需要清除的臨時管理員帳號，後台是乾淨的。");
      return;
    }

    console.log(`找到 ${suspects.length} 個疑似程式建立的管理員帳號：`);
    console.table(suspects.map(u => ({ id: u.id, 姓名: u.name, email: u.email, 加入日期: u.joinDate || "（無）" })));

    const listStr = suspects.map(u => `  ・${u.name}（${u.email}）`).join("\n");
    if (!confirm(`確定要刪除以下 ${suspects.length} 個管理員帳號嗎？\n\n${listStr}\n\n你自己的帳號（${currentUser.email}）不會被動到。\n此動作無法復原。`)) {
      console.log("已取消，沒有刪除任何東西。");
      return;
    }

    const removed = [];
    const failed = [];
    for (const u of suspects) {
      try {
        await database.ref(`users/${getUserPathKey(u)}`).remove();
        removed.push(u);
      } catch (e) {
        console.error(`刪除 ${u.email} 失敗：`, e);
        failed.push(u);
      }
    }
    users = users.filter(u => !removed.includes(u));
    dbSet("users", users);

    console.log(`✅ 已刪除 ${removed.length} 個帳號：`, removed.map(u => u.email).join("、"));
    if (failed.length) console.error(`❌ 有 ${failed.length} 個刪除失敗：`, failed.map(u => u.email).join("、"));
    console.log("\n目前剩下的管理員：");
    this.admins();
    console.warn(
      "\n⚠️ 建議收尾（非緊急）：這些帳號在 Firebase Authentication 裡的登入憑證還在。\n" +
      "   資料已刪除，所以就算用那些帳密登入也拿不到管理員權限（系統找不到對應資料，不會授權）。\n" +
      "   但為了乾淨，仍建議到 Firebase 主控台 → Authentication → Users 把它們刪掉。"
    );
    if (typeof renderAdminDashboard === "function") renderAdminDashboard("members");
  }
};

// 雲端增量/段點寫入 (防止會員端覆蓋其他會員的資料)
function pushNode(key, data) {
  const isAdmin = currentUser && currentUser.role === "admin";
  const currentUserId = currentUser ? currentUser.id : null;
  
  if (key === "users") {
    if (Array.isArray(data)) {
      data.forEach(item => {
        if (item) {
          const pathKey = getUserPathKey(item);
          if (isAdmin || item.id === currentUserId) {
            database.ref(`users/${pathKey}`).set(item).catch(err => handleDbWriteError(err, "users"));
          }
        }
      });
    }
    return;
  }
  
  // Helper to convert array to map
  function arrayToMap(arr) {
    const map = {};
    if (Array.isArray(arr)) {
      arr.forEach(item => {
        if (item && item.id) {
          map[item.id] = item;
        }
      });
    }
    return map;
  }

  // 管理員：直接寫入其他節點的全量 node
  if (isAdmin) {
    if (["bookings", "vouchers", "transactions", "remittances", "groupSessions", "slots"].includes(key) && Array.isArray(data)) {
      database.ref(key).set(arrayToMap(data)).catch(err => handleDbWriteError(err, key));
    } else {
      database.ref(key).set(data).catch(err => handleDbWriteError(err, key));
    }
    return;
  }

  // 一般會員：採用增量寫入 (個別 ID 的段點寫入)，保護其他使用者記錄不被複寫
  if (key === "bookings") {
    data.forEach(item => {
      if (item && item.userId === currentUserId) {
        database.ref(`bookings/${item.id}`).set(item).catch(err => handleDbWriteError(err, "bookings"));
      }
    });
  } else if (key === "remittances") {
    data.forEach(item => {
      if (item && item.userId === currentUserId) {
        database.ref(`remittances/${item.id}`).set(item).catch(err => handleDbWriteError(err, "remittances"));
      }
    });
  } else if (key === "transactions") {
    data.forEach(item => {
      if (item && item.userId === currentUserId) {
        database.ref(`transactions/${item.id}`).set(item).catch(err => handleDbWriteError(err, "transactions"));
      }
    });
  } else {
    // slots, groupSessions, vouchers 等公共節點 (唯讀)
    if (["bookings", "vouchers", "transactions", "remittances", "groupSessions", "slots"].includes(key) && Array.isArray(data)) {
      database.ref(key).set(arrayToMap(data)).catch(err => handleDbWriteError(err, key));
    } else {
      database.ref(key).set(data).catch(err => handleDbWriteError(err, key));
    }
  }
}

// 全量資料初始推送 (僅管理員可用或未初始化時備用，帶 300ms 防抖)
function pushCloudData() {
  if (pushTimeout) clearTimeout(pushTimeout);
  pushTimeout = setTimeout(async () => {
    try {
      function arrayToMap(arr) {
        const map = {};
        if (Array.isArray(arr)) {
          arr.forEach(item => {
            if (item && item.id) {
              map[item.id] = item;
            }
          });
        }
        return map;
      }
      
      const usersMap = {};
      users.forEach(u => {
        if (u) {
          usersMap[getUserPathKey(u)] = u;
        }
      });

      await database.ref("users").set(usersMap);
      await database.ref("bookings").set(arrayToMap(bookings));
      await database.ref("vouchers").set(arrayToMap(vouchers));
      await database.ref("groupSessions").set(arrayToMap(groupSessions));
      await database.ref("transactions").set(arrayToMap(transactions));
      await database.ref("slots").set(arrayToMap(slots));
      await database.ref("remittances").set(arrayToMap(remittances));
      console.log("雲端全量資料同步寫入成功！");
    } catch (err) {
      console.error("雲端全量寫入錯誤:", err);
    }
  }, 300);
}

// 智慧型資料遷移 (自動將舊版 db_state 移至新分級節點，防止舊會員資料丟失)
async function migrateDatabaseIfNecessary() {
  try {
    const oldSnapshot = await database.ref("db_state").once("value");
    const oldData = oldSnapshot.val();
    
    if (oldData) {
      console.log("發現舊版 db_state 資料，正在檢查是否需要遷移...");
      const usersSnapshot = await database.ref("users").once("value");
      const currentUsers = usersSnapshot.val();
      
      // 如果新 users 節點不存在，或比舊版資料少，就進行一鍵遷移
      const shouldMigrate = !currentUsers || Object.keys(currentUsers).length <= DEFAULT_USERS.length;
      
      if (shouldMigrate) {
        console.log("正在執行一鍵無痛遷移...");
        if (oldData.users) await database.ref("users").set(oldData.users);
        if (oldData.bookings) await database.ref("bookings").set(oldData.bookings);
        if (oldData.vouchers) await database.ref("vouchers").set(oldData.vouchers);
        if (oldData.groupSessions) await database.ref("groupSessions").set(oldData.groupSessions);
        if (oldData.transactions) await database.ref("transactions").set(oldData.transactions);
        if (oldData.slots) await database.ref("slots").set(oldData.slots);
        if (oldData.remittances) await database.ref("remittances").set(oldData.remittances);
        console.log("一鍵無痛資料遷移完成！");
        
        // 遷移成功後，重新啟動監聽以加載最新搬遷過來的資料
        startRealtimeSync();
      }
    }
  } catch (err) {
    // db_state 是很早期的舊資料節點，資料早就搬完了，安全規則現在也不開放讀取。
    // 讀不到是「正常且預期」的結果，不該每次載入都在 Console 噴紅字嚇人。
    if (err && (err.code === "PERMISSION_DENIED" || /permission_denied/i.test(err.message || ""))) {
      console.log("（略過舊版 db_state 檢查：安全規則已封閉該節點，資料早已遷移完成，屬正常情況）");
      return;
    }
    console.error("資料遷移錯誤:", err);
  }
}

function getNowDateTimeString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// ==========================================
// 8. Google 日曆整合與智慧防衝突同步函數
// ==========================================

function initGoogleGis() {
  if (typeof google === "undefined" || !googleClientId) {
    updateGoogleSyncUI(false);
    return;
  }
  try {
    googleTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          console.error("Google 授權失敗:", tokenResponse);
          alert("⚠️ Google 授權失敗，請確認 Client ID 是否填寫正確！");
          return;
        }
        googleAccessToken = tokenResponse.access_token;
        updateGoogleSyncUI(true);
        alert("🎉 Google 帳戶授權成功，現在可以點選「立即同步」了！");
      }
    });
    console.log("Google GIS 授權客戶端初始化成功");
  } catch (err) {
    console.error("Google GIS 初始化失敗:", err);
  }
}

function updateGoogleSyncUI(isLinked) {
  const dot = document.getElementById("googleSyncDot");
  const label = document.getElementById("lblGoogleSyncStatus");
  const btnSync = document.getElementById("btnGoogleSync");
  const btnAuth = document.getElementById("btnGoogleAuth");
  
  if (!dot || !label) return;
  
  if (isLinked && googleAccessToken) {
    dot.className = "status-indicator-dot green";
    dot.style.background = "#52c41a";
    label.textContent = "狀態：已授權連結";
    label.style.color = "#52c41a";
    if (btnSync) btnSync.disabled = false;
    if (btnAuth) btnAuth.innerHTML = '<i data-lucide="link"></i> 重新連結';
  } else {
    dot.className = "status-indicator-dot red";
    dot.style.background = "#ff4d4f";
    label.textContent = googleClientId ? "狀態：未連結" : "狀態：未設定 Client ID";
    label.style.color = "var(--mist)";
    if (btnSync) btnSync.disabled = true;
    if (btnAuth) btnAuth.innerHTML = '<i data-lucide="link"></i> 連結 Google';
  }
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function syncGoogleCalendarEvents() {
  if (!googleAccessToken) {
    alert("請先完成 Google 帳戶授權連結！");
    return;
  }
  
  const btnSync = document.getElementById("btnGoogleSync");
  const originalHtml = btnSync.innerHTML;
  btnSync.disabled = true;
  btnSync.innerHTML = '<i data-lucide="refresh-cw" class="spin"></i> 同步中...';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  // 設定時間範圍：今天到 30 天後
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
  
  fetch(url, {
    headers: {
      Authorization: `Bearer ${googleAccessToken}`
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      console.error("日曆 API 傳回錯誤:", data.error);
      alert("❌ 行程同步失敗，原因：" + data.error.message);
      return;
    }
    const events = data.items || [];
    processGoogleEventsConflict(events);
  })
  .catch(err => {
    console.error("同步連線錯誤:", err);
    alert("❌ 行程同步連線失敗，請檢查網路狀態。");
  })
  .finally(() => {
    btnSync.disabled = false;
    btnSync.innerHTML = originalHtml;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });
}

function processGoogleEventsConflict(events) {
  if (!events || events.length === 0) {
    alert("📝 同步報告：您的 Google 日曆未來 30 天內沒有安排任何行程，無任何預約衝突！");
    return;
  }
  
  const deletedSlots = [];
  const bookingConflicts = [];
  
  // 遍歷 Google 行程
  events.forEach(event => {
    const startStr = event.start.dateTime || event.start.date;
    const endStr = event.end.dateTime || event.end.date;
    if (!startStr || !endStr) return;
    
    const eventStart = new Date(startStr);
    const eventEnd = new Date(endStr);
    const eventTitle = event.summary || "無標題行程";
    
    // 與系統現有開放時段 slots 比對
    slots.forEach(slot => {
      // 轉換 slot 開放時間為 Date 物件 (假設預約時長 60 分鐘)
      const slotStart = new Date(`${slot.date}T${slot.time}:00`);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
      
      // 判斷時間區間是否有重疊 Overlap
      const isOverlap = slotStart < eventEnd && slotEnd > eventStart;
      
      if (isOverlap) {
        if (slot.status === "open") {
          // 情況 A：還是可約的開放狀態，直接自動刪除該時段！
          deletedSlots.push(slot);
        } else if (slot.bookingId) {
          // 情況 B：該時段已經有會員預約 (不論待確認還是已確認)，收集起來警告提醒
          const booking = bookings.find(b => b.id === slot.bookingId);
          if (booking && !bookingConflicts.some(c => c.bookingId === booking.id)) {
            const member = users.find(u => u.id === booking.userId);
            bookingConflicts.push({
              bookingId: booking.id,
              memberName: member ? member.name : "未知會員",
              date: slot.date,
              time: slot.time,
              eventTitle: eventTitle
            });
          }
        }
      }
    });
  });
  
  // 1. 執行時段刪除與寫入
  if (deletedSlots.length > 0) {
    deletedSlots.forEach(targetSlot => {
      const idx = slots.findIndex(s => s.id === targetSlot.id);
      if (idx !== -1) {
        slots.splice(idx, 1);
        // 同步從 Firebase 資料庫刪除
        database.ref(`slots/${targetSlot.id}`).remove();
      }
    });
    // 更新本地儲存
    dbSet("slots", slots, true);
    renderAdminSlotsPanel();
  }
  
  // 2. 彙整顯示同步報告
  let reportMsg = "🎉 Google 日曆同步防衝突比對完成！\n\n";
  
  if (deletedSlots.length > 0) {
    reportMsg += `✅ 已為您「自動刪除」以下與行程衝突的開放時段：\n`;
    deletedSlots.forEach(s => {
      reportMsg += `- ${s.date} ${s.time}\n`;
    });
    reportMsg += `\n`;
  } else {
    reportMsg += `🔹 本次同步沒有需要被關閉的空閒開放時段。\n\n`;
  }
  
  if (bookingConflicts.length > 0) {
    reportMsg += `⚠️ 警示：以下時段已有會員預訂，但與您的 Google 日曆行程重疊，請儘速與會員取得聯繫確認：\n`;
    bookingConflicts.forEach(c => {
      reportMsg += `- [${c.date} ${c.time}] 會員: ${c.memberName} (衝突行程: ${c.eventTitle})\n`;
    });
  }
  
  alert(reportMsg);
}

// 監聽跨分頁 LocalStorage 變動，實現跨分頁即時同步
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('singbowl_')) {
    // 重新載入最新資料
    users = dbGet("users", DEFAULT_USERS);
    bookings = dbGet("bookings", DEFAULT_BOOKINGS);
    vouchers = dbGet("vouchers", DEFAULT_VOUCHERS);
    groupSessions = dbGet("groupSessions", DEFAULT_GROUP_SESSIONS);
    transactions = dbGet("transactions", DEFAULT_TRANSACTIONS);
    slots = dbGet("slots", DEFAULT_SLOTS);
    
    // 如果當前有登入，更新當前使用者資料並重新渲染
    const savedUserId = localStorage.getItem("singbowl_current_user_id");
    if (savedUserId) {
      currentUser = users.find(u => u.id === parseInt(savedUserId));
      if (currentUser) {
        if (currentUser.role === "admin") {
          renderAdminDashboard(activeAdminPane);
        } else {
          renderDashboard();
        }
      }
    } else {
      currentUser = null;
      onUserLogoutSuccess();
    }
  }
});
