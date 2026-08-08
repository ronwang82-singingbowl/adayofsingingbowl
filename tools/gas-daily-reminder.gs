/**
 * 缽日 BORI｜每日自動提醒（Google Apps Script）
 * ================================================
 * 兩件事，每天各跑一次：
 *   1. 明日預約提醒 —— 通知會員本人，另外寄一份彙總清單給管理員
 *   2. 點數到期通知 —— 到期日在一個月內的批次，通知會員
 *
 * 為什麼要放在 GAS：
 *   會員系統是 GitHub Pages 靜態網站，沒有後端。member.js 裡的通知只有在
 *   有人開著瀏覽器時才會執行。GAS 的「時間驅動觸發器」是這個架構下唯一
 *   不需要任何人開網頁、也會準時跑的地方。
 *
 * 與 member.js 的關係：
 *   member.js 的 runReminderSweep() 是同一套規則的保險絲 —— 管理員開後台時
 *   會補跑一次。兩邊都先查 notifyLog 再送，所以同一則通知只會送出一次。
 *   notifyLog 的 key 命名兩邊必須一致，改這裡就要一起改 member.js。
 *
 * ── 安裝步驟 ───────────────────────────────────────────
 * 1. 打開你現有的 Apps Script 專案（就是 LINE Webhook 代理那一支）
 * 2. 新增一個檔案，把這份程式碼整段貼進去
 * 3. 填好下面 REMINDER_CONFIG 的三個值
 * 4. 左側「觸發條件」→ 新增觸發條件
 *      執行的函式：dailyReminder
 *      事件來源：時間驅動
 *      類型：日計時器
 *      時間：上午 9 點到 10 點（或你想要的時段）
 * 5. 先手動執行一次 dailyReminder，看執行記錄確認沒有錯誤
 *
 * 建議先用 DRY_RUN = true 跑一次，只看記錄不真的發送。
 */

// ── REMINDER_CONFIG ────────────────────────────────────────────
var REMINDER_CONFIG = {
  // Firebase Realtime Database 網址（結尾不要加斜線）
  DB_URL: 'https://adayofsingingbowl-default-rtdb.firebaseio.com',

  // Firebase 資料庫密鑰。取得方式：
  //   Firebase Console → 專案設定 → 服務帳戶 → 資料庫密鑰 → 顯示 / 建立
  // 這把密鑰有完整讀寫權限，只放在這支 GAS 裡，不要外流、不要放進網站程式碼。
  DB_SECRET: '請填入 Firebase 資料庫密鑰',

  // LINE Messaging API 的 Channel Access Token
  // 如果你這個 GAS 專案裡已經有一份（Webhook 代理在用），直接沿用同一個值即可。
  LINE_TOKEN: '請填入 LINE Channel Access Token',

  // true = 只寫執行記錄、不真的發送也不寫 notifyLog。
  // 預設開著，讓第一次手動執行不會誤發給全體會員。
  // 確認執行記錄的名單正確後，改成 false 才會真的開始發送。
  DRY_RUN: true
};

var REMIND_BEFORE_DAYS = 1;         // 預約提醒：前一天
var POINT_EXPIRY_NOTICE_MONTHS = 1; // 點數到期通知：到期日 1 個月前
var TZ = 'Asia/Taipei';             // 用台灣時間算「明天」，不要用 GAS 預設時區


// ── 主流程 ────────────────────────────────────────────
function dailyReminder() {
  var today = dateStr(0);
  var target = dateStr(REMIND_BEFORE_DAYS);
  var expiryDeadline = addMonths(today, POINT_EXPIRY_NOTICE_MONTHS);
  rlog('=== 開始 === 今天 ' + today + '，提醒目標日 ' + target + '，到期門檻 ' + expiryDeadline);

  var users = toArray(fbGet('users'));
  var bookings = toArray(fbGet('bookings'));
  var remittances = toArray(fbGet('remittances'));
  var settings = fbGet('settings') || {};
  var notifyLog = fbGet('notifyLog') || {};
  var sentBooking = notifyLog.booking || {};
  var sentExpiry = notifyLog.pointExpiry || {};
  var sentDigest = notifyLog.adminDigest || {};

  var userById = {};
  users.forEach(function (u) { if (u && u.id !== undefined) userById[u.id] = u; });

  var writes = {};
  var sentCount = 0;

  // ── 1. 明日預約：通知會員 ──
  // 只提醒「已確認」的。還沒確認的不該叫會員準時到，那些留在管理員清單裡待處理。
  var confirmed = bookings.filter(function (b) {
    return b && b.date === target && b.status === '已確認';
  });
  var pending = bookings.filter(function (b) {
    return b && b.date === target && b.status === '待確認';
  });
  rlog('明日預約：已確認 ' + confirmed.length + ' 筆、待確認 ' + pending.length + ' 筆');

  confirmed.forEach(function (b) {
    if (sentBooking[b.id]) { rlog('  預約 #' + b.id + ' 已送過，跳過'); return; }
    var m = userById[b.userId];
    if (!m || !m.lineUserId) { rlog('  預約 #' + b.id + ' 的會員沒有綁定 LINE，跳過'); return; }
    pushLine(m.lineUserId, memberBookingReminder(b));
    writes['booking/' + b.id] = target;
    sentCount++;
  });

  // ── 2. 明日預約：管理員彙總（每天一則，含未確認的＋匯款待審核筆數）──
  var pendingRemits = remittances.filter(function (r) {
    return r && r.status === 'pending';
  }).length;
  rlog('匯款待審核：' + pendingRemits + ' 筆');

  if (!sentDigest[target]) {
    var adminId = settings.adminLineUserId;
    if (adminId) {
      pushLine(adminId, adminDigest(target, confirmed, pending, userById, pendingRemits));
      writes['adminDigest/' + target] = new Date().getTime();
      sentCount++;
    } else {
      // 不寫 log，這樣設定好之後下次執行還會補送
      rlog('  未設定 settings/adminLineUserId，管理員彙總未發送');
    }
  }

  // ── 3. 點數到期：到期日在一個月內、尚未通知過的批次 ──
  users.forEach(function (m) {
    if (!m || !m.lineUserId) return;
    var batches = toArray(m.pointBatches).filter(function (b) {
      return b && b.expiresAt &&
             String(b.expiresAt) >= today &&              // 還沒過期
             String(b.expiresAt) <= expiryDeadline &&     // 但一個月內會到期
             (Number(b.remaining) || 0) > 0 &&
             !sentExpiry[m.id + '_' + b.id];
    });
    if (batches.length === 0) return;
    pushLine(m.lineUserId, pointExpiryNotice(m, batches, today));
    batches.forEach(function (b) { writes['pointExpiry/' + m.id + '_' + b.id] = today; });
    sentCount++;
  });

  // ── 寫回已發送紀錄 ──
  if (Object.keys(writes).length > 0 && !REMINDER_CONFIG.DRY_RUN) {
    fbPatch('notifyLog', writes);
  }
  rlog('=== 結束 === 共發送 ' + sentCount + ' 則' + (REMINDER_CONFIG.DRY_RUN ? '（DRY_RUN，實際未送出）' : ''));
}


// ── 訊息內容（措辭與 member.js 保持一致）────────────────
function bookingLabel(b) {
  return b.type === 'group' ? (b.title || '團體頌缽') : '1對1 頌缽體驗';
}

function memberBookingReminder(b) {
  return '🔔 明日預約提醒\n\n' +
         '親愛的會員，提醒您明天有一場預約：\n\n' +
         '📅 日期：' + b.date + '\n' +
         '⏰ 時間：' + b.time + '\n' +
         '🧘 項目：' + bookingLabel(b) + '\n\n' +
         '期待明天與您見面。若需調整時間，請儘早私訊官方 LINE 讓我們知道。';
}

/* 匯款待審核筆數。會員送出回條時的即時推播是瀏覽器用 no-cors 送的，
   送不到也不會回報錯誤，所以每天再報一次數字當安全網。
   member.js 的 remittancePendingTail() 是同一份，改這裡要一起改那邊。 */
function remittancePendingTail(n) {
  return n > 0
    ? '\n\n💰 另有 ' + n + ' 筆匯款待審核，請到後台處理。'
    : '\n\n💰 目前沒有待審核的匯款。';
}

function adminDigest(target, confirmed, pending, userById, pendingRemits) {
  var msg = '📋 明日預約清單（' + target + '）\n\n';
  if (confirmed.length === 0 && pending.length === 0) {
    msg += '明天沒有任何預約，可以安心休息。';
  } else {
    if (confirmed.length > 0) {
      msg += '✅ 已確認 ' + confirmed.length + ' 筆\n';
      confirmed.forEach(function (b) {
        var m = userById[b.userId];
        msg += '　' + b.time + '｜' + (m ? m.name : '未知會員') + '｜' + bookingLabel(b) + '\n';
        if (b.notes) msg += '　　備註：' + b.notes + '\n';
      });
    }
    if (pending.length > 0) {
      msg += '\n⚠️ 尚未確認 ' + pending.length + ' 筆（會員不會收到提醒）\n';
      pending.forEach(function (b) {
        var m = userById[b.userId];
        msg += '　' + b.time + '｜' + (m ? m.name : '未知會員') + '｜' + bookingLabel(b) + '\n';
      });
    }
  }
  // 預約清單每行結尾都有 \n，尾巴自己也帶 \n\n，不去掉會多空一行
  return msg.replace(/\n+$/, '') + remittancePendingTail(pendingRemits || 0);
}

function pointExpiryNotice(m, batches, today) {
  var LABEL = { points: '通用點數', giftedPoints: '贈送-1對1', giftedGroupPoints: '贈送-團體' };
  var lines = batches.map(function (b) {
    return '　' + (LABEL[b.type] || b.type) + ' ' + b.remaining + ' 次 — ' +
           b.expiresAt + '（剩 ' + daysBetween(today, b.expiresAt) + ' 天）';
  }).join('\n');
  return '⏳ 點數即將到期提醒\n\n' +
         m.name + ' 您好，您有點數將在一個月內到期：\n\n' +
         lines + '\n\n' +
         '到期後將自動失效，系統會「先到期的先扣」。\n' +
         '若想在期限內使用，歡迎到會員中心預約時段。\n\n' +
         '如對效期有疑問，請詢問官方 LINE，我們會協助確認。';
}


// ── Firebase REST ─────────────────────────────────────
function fbGet(path) {
  var url = REMINDER_CONFIG.DB_URL + '/' + path + '.json?auth=' + encodeURIComponent(REMINDER_CONFIG.DB_SECRET);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('讀取 ' + path + ' 失敗（' + res.getResponseCode() + '）：' + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

function fbPatch(path, obj) {
  var url = REMINDER_CONFIG.DB_URL + '/' + path + '.json?auth=' + encodeURIComponent(REMINDER_CONFIG.DB_SECRET);
  var res = UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(obj),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('寫入 ' + path + ' 失敗（' + res.getResponseCode() + '）：' + res.getContentText());
  }
}


// ── LINE Push ─────────────────────────────────────────
function pushLine(lineUserId, text) {
  if (REMINDER_CONFIG.DRY_RUN) {
    rlog('  [DRY_RUN] → ' + lineUserId + '\n' + text);
    return;
  }
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + REMINDER_CONFIG.LINE_TOKEN },
    payload: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    // 單一則失敗不中斷整批 —— 記下來就好，避免一個壞掉的 LINE ID 擋住其他人的通知
    rlog('  ❌ 發送失敗（' + res.getResponseCode() + '）→ ' + lineUserId + '：' + res.getContentText());
  } else {
    rlog('  ✅ 已發送 → ' + lineUserId);
  }
}


// ── 小工具 ────────────────────────────────────────────
function dateStr(offsetDays) {
  var d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

// 加 N 個月，自動處理月底（1/31 加 1 個月 → 2/28），與 member.js 的 addMonthsStr 同邏輯
function addMonths(dateString, months) {
  var p = String(dateString).split('-').map(Number);
  var target = new Date(p[0], p[1] - 1 + months, 1);
  var lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(p[2], lastDay));
  return Utilities.formatDate(target, TZ, 'yyyy-MM-dd');
}

function daysBetween(fromStr, toStr) {
  var a = String(fromStr).split('-').map(Number);
  var b = String(toStr).split('-').map(Number);
  return Math.round((new Date(b[0], b[1] - 1, b[2]) - new Date(a[0], a[1] - 1, a[2])) / 86400000);
}

// Firebase 可能回傳陣列或物件（key 不連續時會變物件），統一轉成陣列
function toArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  return Object.keys(v).map(function (k) { return v[k]; }).filter(Boolean);
}

// 只用 console.log —— 新版 Apps Script 執行環境會把 Logger.log 與 console.log
// 導到同一份執行記錄，兩個都呼叫會讓每一行重複出現。
function rlog(msg) {
  console.log(msg);
}


// ── 維護工具（平常不會執行，需要時從下拉選單手動選）─────────────
// 這幾支是 2026-08-06 排查通知失效時做出來的，留著以後好用。

/* 檢查 settings 節點的內容。通知怪怪的時候先跑這支。 */
function checkSettings() {
  var s = fbGet('settings') || {};
  var keys = Object.keys(s);
  rlog('settings 底下實際存在的節點：' + (keys.length ? keys.join('、') : '（整個是空的）'));

  var url = s.lineWebhookUrl ? String(s.lineWebhookUrl) : '';
  if (!url) {
    rlog('lineWebhookUrl：❌ 不存在');
  } else if (url.indexOf('https://script.google.com/') !== 0 || url.indexOf('/exec') === -1) {
    // 2026-08-06 就是這裡被填成了 LINE User ID，導致所有通知靜默失效
    rlog('lineWebhookUrl：⚠️ 格式不對！應為 https://script.google.com/…/exec，目前是 ' + url.slice(0, 40) + '…');
  } else {
    rlog('lineWebhookUrl：✅ 格式正確');
  }

  var id = s.adminLineUserId ? String(s.adminLineUserId) : '';
  if (!id) rlog('adminLineUserId：❌ 不存在');
  else if (id.charAt(0) !== 'U' || id.length !== 33) rlog('adminLineUserId：⚠️ 格式不對（應為 U 開頭 33 碼），目前長度 ' + id.length);
  else rlog('adminLineUserId：✅ 格式正確（' + id.slice(0, 2) + '…）');
}

/* 列出所有會員與他們的 LINE 綁定狀態（只印前 6 碼）。 */
function listLineIds() {
  toArray(fbGet('users')).forEach(function (u) {
    if (!u) return;
    rlog((u.name || '?') + '｜' + (u.email || '') + '｜lineUserId: ' +
      (u.lineUserId ? String(u.lineUserId).slice(0, 6) + '…（' + String(u.lineUserId).length + ' 碼）' : '無'));
  });
}

/* 設定「明日預約清單」的收件人。TARGET_EMAIL 要填有綁 LINE 的那個帳號，
   不是 admin@singbowl.com —— 純 Email 建立的管理帳號沒有 lineUserId。 */
function setAdminLineUserId() {
  var TARGET_EMAIL = 'azsxdc30502@gmail.com';
  var me = toArray(fbGet('users')).filter(function (u) {
    return u && u.email === TARGET_EMAIL && u.lineUserId;
  })[0];
  if (!me) { rlog('❌ 找不到 email 為 ' + TARGET_EMAIL + ' 且有 lineUserId 的會員'); return; }
  fbPut('settings/adminLineUserId', me.lineUserId);
  rlog('✅ 已寫入 settings/adminLineUserId（' + me.name + '，開頭 ' + String(me.lineUserId).slice(0, 2) + '…）');
}

/* 還原 webhook 網址。網址從「部署 → 管理部署作業」複製，結尾必須是 /exec。
   注意不能用 ScriptApp.getService().getUrl() —— 那取到的是 /dev 開發網址，
   只有你自己呼叫得動，member.js 打不通。 */
function setWebhookUrl() {
  var EXEC_URL = '貼上部署網址（/exec 結尾）';
  if (EXEC_URL.indexOf('https://script.google.com/') !== 0 || EXEC_URL.indexOf('/exec') === -1) {
    rlog('❌ 這不是有效的 /exec 部署網址');
    return;
  }
  fbPut('settings/lineWebhookUrl', EXEC_URL);
  rlog('✅ 已還原 lineWebhookUrl = ' + EXEC_URL);
}

function fbPut(path, value) {
  var url = REMINDER_CONFIG.DB_URL + '/' + path + '.json?auth=' + encodeURIComponent(REMINDER_CONFIG.DB_SECRET);
  var res = UrlFetchApp.fetch(url, {
    method: 'put', contentType: 'application/json',
    payload: JSON.stringify(value), muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('寫入 ' + path + ' 失敗：' + res.getContentText());
}
