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
async function hashPassword(password) {
  if (!password) return "";
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function getNextId(array, startId) {
  if (!Array.isArray(array)) return startId;
  return array.reduce((max, item) => item && item.id ? Math.max(max, item.id) : max, startId - 1) + 1;
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

// LINE Push Notification Sender Helper (含 API 密鑰驗證)
function sendLineNotification(userId, message) {
  const member = users.find(u => u.id === userId);
  if (!member || !member.lineUserId) {
    console.warn("[LINE通知] 此會員無 LINE User ID，userId:", userId);
    return;
  }
  
  const isAdmin = currentUser && currentUser.role === "admin";
  console.log(`[LINE通知] 準備發送給 ${member.name} (lineUserId: ${member.lineUserId})...`);
  
  // 同時讀取 Webhook URL 與 API 密鑰
  Promise.all([
    database.ref("settings/lineWebhookUrl").once("value"),
    database.ref("settings/lineApiSecret").once("value")
  ]).then(([urlSnap, secretSnap]) => {
    const webhookUrl = urlSnap.val();
    const apiSecret = secretSnap.val();
    
    console.log(`[LINE通知] webhookUrl: ${webhookUrl ? '已設定' : '❌ 未設定'}, apiSecret: ${apiSecret ? '已設定' : '❌ 未設定'}`);
    
    if (!webhookUrl) {
      console.warn("[LINE通知] 未設定 LINE Webhook URL，跳過通知。");
      if (isAdmin) alert("⚠️ LINE 通知發送失敗：尚未設定 LINE Webhook 代理 URL。\n\n請至管理後台 > 時段開放設定 > 展開 LINE 通知設定，貼上您的 Google Apps Script 部署網址。");
      return;
    }
    if (!apiSecret) {
      console.warn("[LINE通知] 未設定 lineApiSecret，跳過通知。");
      if (isAdmin) alert("⚠️ LINE 通知發送失敗：Firebase 資料庫中尚未設定 lineApiSecret。\n\n請至 Firebase Console > Realtime Database > Data，在 settings 節點下新增 lineApiSecret，值為：4f6996c01dc91d3fbcd9c925aa75f68f");
      return;
    }
    
    console.log(`[LINE通知] 正在發送至 GAS Webhook...`);
    const payload = {
      lineUserId: member.lineUserId,
      message: message,
      apiSecret: apiSecret
    };
    
    fetch(webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain"
      },
      body: JSON.stringify(payload)
    })
    .then(res => {
      console.log("[LINE通知] ✅ 請求已成功送出（no-cors 模式，回應類型:", res.type, "）");
    })
    .catch(err => {
      console.error("[LINE通知] ❌ 網路請求失敗:", err);
      if (isAdmin) alert("⚠️ LINE 通知發送失敗：網路請求錯誤。請確認 GAS 部署網址是否正確。");
    });
  }).catch(err => {
    console.error("[LINE通知] ❌ 無法讀取 Firebase settings:", err);
    if (isAdmin) alert("⚠️ 無法讀取 LINE 通知設定。請確認 Firebase 安全規則已正確部署（settings 節點需允許 auth != null 讀取）。");
  });
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
let groupSessions = dbGet("groupSessions", DEFAULT_GROUP_SESSIONS);
let transactions = dbGet("transactions", DEFAULT_TRANSACTIONS);
let slots = dbGet("slots", DEFAULT_SLOTS);
let remittances = dbGet("remittances", []);
let currentUser = null;

// Save initial database state (local-only, do not write to cloud on load)
dbSet("users", users, false);
dbSet("bookings", bookings, false);
dbSet("vouchers", vouchers, false);
dbSet("groupSessions", groupSessions, false);
dbSet("transactions", transactions, false);
dbSet("slots", slots, false);
dbSet("remittances", remittances, false);

// ==========================================
// 2. 視圖切換與路由 (Router)
// ==========================================

const VIEWS = [
  "landing", "auth", "register", "member", "edit-profile", "book-1on1", "book-group", 
  "admin", "admin-points", "admin-add-member", "admin-edit-member", "buy-points", "admin-reject-remittance"
];

function navigateTo(viewId) {
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
  if (viewId === "book-1on1") render1on1Form();
  if (viewId === "book-group") renderGroupForm();
  if (viewId === "buy-points") renderBuyPointsPage();
  if (viewId === "admin") renderAdminDashboard("overview");
}

function updateNavState(viewId) {
  // Highlight navigation item
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  if (viewId === "landing") document.getElementById("btnNavHome")?.classList.add("active");
  if (viewId === "member") document.getElementById("btnNavMember")?.classList.add("active");
  if (viewId === "buy-points") document.getElementById("btnNavBuyPoints")?.classList.add("active");
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
  if (currentUser.role === "admin") {
    document.getElementById("btnNavAdmin").style.display = "block";
    navigateTo("admin");
  } else {
    document.getElementById("btnNavAdmin").style.display = "none";
    navigateTo("member");
  }

  // 註冊該用戶專屬的即時監聽器
  startRealtimeSync();
}

function onUserLogoutSuccess() {
  currentUser = null;
  localStorage.removeItem("singbowl_current_user_id");
  
  // Hide headers
  document.getElementById("btnHeaderLogin").style.display = "block";
  document.getElementById("headerUserMenu").style.display = "none";
  document.getElementById("btnNavMember").style.display = "none";
  const navBuyPoints = document.getElementById("btnNavBuyPoints");
  if (navBuyPoints) navBuyPoints.style.display = "none";
  document.getElementById("btnNavAdmin").style.display = "none";
  
  // Show Home button when logged out
  document.getElementById("btnNavHome").style.display = "block";
  
  // 重新註冊訪客級即時監聽器
  startRealtimeSync();
  
  const activeSection = document.querySelector(".view-section.active");
  const activeView = activeSection ? activeSection.id.replace("view-", "") : "landing";
  const memberOnlyViews = ["member", "admin", "buy-points", "book-1on1", "book-group", "edit-profile", "admin-points", "admin-add-member", "admin-edit-member"];
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
  
  // Points Display
  if (currentUser.points === undefined) currentUser.points = 0;
  if (currentUser.giftedPoints === undefined) currentUser.giftedPoints = 0;
  if (currentUser.giftedGroupPoints === undefined) currentUser.giftedGroupPoints = 0;
  
  const total1on1 = currentUser.points + currentUser.giftedPoints;
  const totalGroup = currentUser.points + currentUser.giftedGroupPoints;
  
  document.getElementById("lblMemberPoints").textContent = total1on1;
  document.getElementById("lblMemberGroupPoints").textContent = totalGroup;
  
  const pointsTip = document.querySelector(".points-tip");
  if (pointsTip) {
    pointsTip.innerHTML = `💡 您擁有的額度明細：通用點數：<strong>${currentUser.points}</strong> 次（1對1及團體皆可折抵）<br>` +
                          `贈送-1對1：<strong>${currentUser.giftedPoints}</strong> 次（限1對1）/ 贈送-團體：<strong>${currentUser.giftedGroupPoints}</strong> 次（限團體）。`;
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
      item.innerHTML = `
        <div class="voucher-info">
          <h4>${v.name}</h4>
          <p>代碼：${v.code} (${v.status === "used" ? "已使用" : "未使用"})</p>
        </div>
        <div class="voucher-bonus ${v.status === "used" ? "used" : ""}">+${v.bonusPoints} 次</div>
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
    document.getElementById("btnDashBookNow")?.addEventListener("click", () => navigateTo("book-1on1"));
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
window.cancelBooking = function(bookingId) {
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
    alert("⚠️ 很抱歉，本預約距離現在已不足 5 天，無法直接線上取消。\n\n如需取消預約，請私訊官方 LINE 帳號告知原因，由小編為您人工處理。\n\n官方 LINE: https://line.me/R/ti/p/%40197nfdme");
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
      if (refundType === "gifted") {
        if (booking.type === "1on1") {
          member.giftedPoints = (member.giftedPoints || 0) + booking.cost;
          currentBal = member.giftedPoints;
        } else {
          member.giftedGroupPoints = (member.giftedGroupPoints || 0) + booking.cost;
          currentBal = member.giftedGroupPoints;
        }
      } else {
        member.points = (member.points || 0) + booking.cost;
        currentBal = member.points;
      }
      dbSet("users", users);
      
      // 3. Log point transaction
      const newTxId = getNextId(transactions, 5001);
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
    warning.innerHTML = `<i data-lucide="alert-triangle"></i> ⚠️ 次數不足，請先<a href="https://line.me/R/ti/p/%40197nfdme" target="_blank" style="color:var(--brass-soft);text-decoration:underline;">聯絡療癒師加購次數</a>。`;
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

// Render Group Session booking cards
let selectedGroupId = null;

function renderGroupForm() {
  if (!currentUser) return;
  if (currentUser.points === undefined) currentUser.points = 0;
  if (currentUser.giftedGroupPoints === undefined) currentUser.giftedGroupPoints = 0;
  const totalGroup = currentUser.points + currentUser.giftedGroupPoints;
  let pointsDisplay = totalGroup + " 次";
  if (currentUser.giftedGroupPoints > 0) {
    pointsDisplay += ` (通用 ${currentUser.points} / 贈送 ${currentUser.giftedGroupPoints})`;
  }
  document.getElementById("lblBookGroupUserPoints").textContent = pointsDisplay;
  
  const container = document.getElementById("groupSessionsContainer");
  container.innerHTML = "";
  
  groupSessions.forEach(session => {
    const card = document.createElement("div");
    card.className = `group-session-item ${selectedGroupId === session.id ? "selected" : ""}`;
    const isFull = session.currentCapacity >= session.maxCapacity;
    
    let capClass = "";
    let capText = `👥 已報名 ${session.currentCapacity} / ${session.maxCapacity} 人`;
    if (isFull) {
      capClass = "cap-full";
      capText = "👥 已額滿";
    } else if (session.maxCapacity - session.currentCapacity <= 3) {
      capClass = "cap-warning";
      capText = `👥 緊張 ${session.currentCapacity} / ${session.maxCapacity} 人`;
    }
    
    card.innerHTML = `
      <div class="group-item-info">
        <h4>${session.title}</h4>
        <span class="group-item-time">${session.time}</span>
      </div>
      <div class="group-item-meta">
        <span class="group-item-cap ${capClass}">${capText}</span>
        <span class="group-item-points">${session.pointCost} 次</span>
      </div>
    `;
    
    if (!isFull) {
      card.addEventListener("click", () => {
        selectedGroupId = session.id;
        document.querySelectorAll(".group-session-item").forEach(item => item.classList.remove("selected"));
        card.classList.add("selected");
        updateGroupCost(session);
      });
    } else {
      card.style.opacity = "0.5";
      card.style.cursor = "not-allowed";
    }
    
    container.appendChild(card);
  });
  
  // Default select first available if none selected
  const available = groupSessions.find(s => s.currentCapacity < s.maxCapacity);
  if (available && selectedGroupId === null) {
    selectedGroupId = available.id;
    // Trigger render state
    setTimeout(() => {
      const cards = container.querySelectorAll(".group-session-item");
      const idx = groupSessions.findIndex(s => s.id === available.id);
      if (cards[idx]) cards[idx].click();
    }, 50);
  }
}

function updateGroupCost(session) {
  document.getElementById("lblBookGroupCost").textContent = session.pointCost;
  
  const warning = document.getElementById("lblBookGroupWarning");
  const submitBtn = document.getElementById("btnSubmitGroup");
  
  if ((currentUser.groupPoints || 0) < session.pointCost) {
    warning.style.display = "flex";
    submitBtn.disabled = true;
    submitBtn.classList.add("disabled");
  } else {
    warning.style.display = "none";
    submitBtn.disabled = false;
    submitBtn.classList.remove("disabled");
  }
}

// ==========================================
// 3.5 購買點數與對帳渲染 (Buy Points Page Rendering)
// ==========================================

function renderBuyPointsPage() {
  if (!currentUser) return;
  
  // Update user bank info display
  const bankName = currentUser.paymentBankName || "";
  const bankLast5 = currentUser.paymentBankLast5 || "";
  
  document.getElementById("buyUserBankName").value = bankName || "尚未設定 (請先至個人資料填寫並綁定)";
  document.getElementById("buyUserBankLast5").value = bankLast5 || "尚未設定 (請先至個人資料填寫並綁定)";

  // Show/Hide warning if bank info not set (Disabled, since payment/remittance info is hidden)
  const bankWarning = document.getElementById("buyPointsBankWarning");
  if (bankWarning) {
    bankWarning.style.display = "none";
  }
  
  // Reset selected package
  document.querySelectorAll(".package-card").forEach(c => c.classList.remove("selected"));
  document.getElementById("buyPackageId").value = "";
  document.getElementById("buyPointsCount").value = "";
  document.getElementById("buyPointsAmount").value = "";
  document.getElementById("buyActualAmount").value = "";
  
  const lblVirtual = document.getElementById("lblVirtualAccount");
  if (lblVirtual) lblVirtual.textContent = "請點選上方方案自動分配帳號";
  
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

function getPackageName(packageId) {
  if (packageId === 1 || packageId === "1") return "加購 1 點";
  if (packageId === 8 || packageId === "8") return "加購 8 點 (加贈1次團體)";
  if (packageId === 15 || packageId === "15") return "加購 15 點 (加贈2次團體)";
  return "未知方案";
}

function generateVirtualAccount(userId, packageId) {
  const padUser = String(userId).padStart(3, '0');
  const padPack = String(packageId).padStart(2, '0');
  const hash = String((userId * 17 + packageId * 31 + 47) % 100000).padStart(5, '0');
  return `9527-${padUser}-${padPack}${hash}`;
}

// ==========================================
// 4. 管理後台渲染 (Admin UI Rendering)
// ==========================================

let activeAdminPane = "overview";
let adminSlotCurrentYear = new Date().getFullYear();
let adminSlotCurrentMonth = new Date().getMonth();
let adminSlotSelectedDateStr = null;

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
    "remittances": "btnAdminMenuRemittances"
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
      let pwdText = "未設定";
      if (u.lineUserId) {
        pwdText = "LINE註冊";
      } else if (u.password) {
        const isHashed = u.password.length === 64 && /^[0-9a-f]+$/.test(u.password);
        pwdText = isHashed ? "已設定 (安全加密)" : u.password;
      }
      
      const isTargetAdmin = u.role === "admin";
      const pointsText = isTargetAdmin ? `<span class="badge status-pending">管理員帳號</span>` : `通用: <strong class="text-brass">${u.points || 0}</strong> 次<br>贈送1對1: <strong class="text-brass">${u.giftedPoints || 0}</strong> 次<br>贈送團體: <strong class="text-brass">${u.giftedGroupPoints || 0}</strong> 次`;
      
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
        <td><strong>${u.name}</strong> ${isTargetAdmin ? '<span class="status-badge status-approved" style="font-size:10px;padding:2px 4px;margin-left:4px;">管理員</span>' : ''}</td>
        <td>${u.phone}<br><span style="font-size:11px;color:var(--mist);">${u.email}</span><br><span style="font-size:11px;color:var(--brass-soft);font-weight:500;">密碼: ${pwdText}</span></td>
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
  
  document.getElementById("adjustMemberId").value = member.id;
  document.getElementById("lblAdjustTargetName").textContent = member.name;
  document.getElementById("lblAdjustTargetPoints").textContent = member.points;
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
  
  navigateTo("admin-edit-member");
};

// 4.3 Booking List rendering with filter state
let bookingFilter = "all";

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
      badge.style.fontSize = "9px";
      badge.style.marginTop = "2px";
      badge.style.fontWeight = "600";
      
      if (pendingCount > 0) {
        badge.style.color = "#ff9800";
        badge.textContent = `${activeBookings.length}人 (待)`;
      } else {
        badge.style.color = "var(--brass-soft)";
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
  
  const dayBookings = bookings.filter(b => b.date === dateStr);
  
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
            <button class="table-action-btn danger" style="padding: 2px 6px; font-size: 11px; height: auto;" onclick="adminRejectBooking(${b.id}); event.stopPropagation();">拒絕</button>
          </div>
        `;
      } else if (b.status === "已確認") {
        actionButtons = `
          <button class="table-action-btn danger" style="padding: 2px 6px; font-size: 11px; height: auto;" onclick="adminRejectBooking(${b.id}); event.stopPropagation();">取消並退次</button>
        `;
      }
      
      item.innerHTML = `
        <div style="text-align: left;">
          <div style="font-weight: 600; font-size: 13px; color: var(--paper);">${b.time} - ${name}</div>
          <div style="font-size: 11px; color: var(--mist); margin-top: 2px;">項目: ${label} | #ID: ${b.id}</div>
          ${b.notes ? `<div style="font-size: 11px; color: var(--brass-soft); margin-top: 4px; border-left: 2px solid var(--brass); padding-left: 6px;">備註: ${b.notes}</div>` : ''}
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
  
  const filteredBookings = bookings.filter(b => {
    if (bookingFilter === "all") return true;
    return b.status === bookingFilter;
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
            <button class="table-action-btn danger" onclick="adminRejectBooking(${b.id})">拒絕</button>
          </div>
        `;
      } else if (b.status === "已確認") {
        actions = `
          <div class="action-btn-group">
            <button class="table-action-btn danger" onclick="adminRejectBooking(${b.id})">取消並退次數</button>
          </div>
        `;
      }
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span style="font-family:'JetBrains Mono';font-size:11px;">#${b.id}</span></td>
        <td><strong>${memberName}</strong></td>
        <td>${label}</td>
        <td>${timeDetail}</td>
        <td>${b.cost} 次</td>
        <td><span class="status-badge ${statusClass}">${b.status}</span></td>
        <td>${actions}</td>
      `;
      container.appendChild(row);
    });
  }
}

// Admin Action on Bookings
window.adminApproveBooking = function(bookingId) {
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return;
  
  booking.status = "已確認";
  dbSet("bookings", bookings);
  
  // Update slot status to booked
  if (booking.slotId) {
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

window.adminRejectBooking = function(bookingId) {
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
        slot.status = "open";
        slot.bookingId = null;
        dbSet("slots", slots);
      }
    }
    
    // 2. Refund user points
    const member = users.find(u => u.id === booking.userId);
    if (member) {
      let currentBal = 0;
      const refundType = booking.paidBy || "common";
      if (refundType === "gifted") {
        if (booking.type === "1on1") {
          member.giftedPoints = (member.giftedPoints || 0) + booking.cost;
          currentBal = member.giftedPoints;
        } else {
          member.giftedGroupPoints = (member.giftedGroupPoints || 0) + booking.cost;
          currentBal = member.giftedGroupPoints;
        }
      } else {
        member.points = (member.points || 0) + booking.cost;
        currentBal = member.points;
      }
      dbSet("users", users);
      
      // 3. Log points
      const newTxId = getNextId(transactions, 5001);
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
      <td>${v.name}<br><span style="font-family:'JetBrains Mono';font-size:10.5px;color:var(--mist)">Code: ${v.code}</span></td>
      <td><span class="tx-add">+${v.bonusPoints}</span></td>
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

window.deleteAdminCoupon = function(couponId) {
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
  
  const is1on1 = voucher.name === "生日優惠贈送次數";
  const targetNameStr = is1on1 ? "贈送-1對1" : "贈送-團體";
  const userPoints = is1on1 ? (member.giftedPoints || 0) : (member.giftedGroupPoints || 0);
  
  let confirmMsg = `確定要取消發放此票券嗎？\n取消後，將自會員「${member.name}」帳戶中扣除已贈送的 ${voucher.bonusPoints} 次 ${targetNameStr} 額度。`;
  if (userPoints < voucher.bonusPoints) {
    confirmMsg += `\n\n⚠️ 警告：該會員目前的 ${targetNameStr} 餘額 (${userPoints}次) 低於票券額度 (${voucher.bonusPoints}次)，取消後餘額將扣減至 0 次。`;
  }
  
  if (confirm(confirmMsg)) {
    if (is1on1) {
      member.giftedPoints = Math.max(0, (member.giftedPoints || 0) - voucher.bonusPoints);
    } else {
      member.giftedGroupPoints = Math.max(0, (member.giftedGroupPoints || 0) - voucher.bonusPoints);
    }
    dbSet("users", users);
    
    const timestamp = getNowDateTimeString();
    const newTxId = getNextId(transactions, 5001);
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
    
    // Check if slots exist on this day
    const hasSlots = slots.some(s => s.date === dateStr);
    if (hasSlots) {
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
    gridContainer.innerHTML = `<tr><td colspan="3" class="text-center text-muted" style="padding:15px 0;">本日尚未開放任何時段。</td></tr>`;
    return;
  }
  
  daySlots.forEach(s => {
    const row = document.createElement("tr");
    
    let statusText = "";
    let statusClass = "";
    if (s.status === "open") {
      statusText = "開放中";
      statusClass = "status-confirmed";
    } else if (s.status === "pending") {
      statusText = "待對帳/確認";
      statusClass = "status-pending";
    } else if (s.status === "booked") {
      statusText = "已預約";
      statusClass = "status-completed";
    } else if (s.status === "closed") {
      statusText = "手動關閉";
      statusClass = "status-cancelled";
    }
    
    let actionBtn = "";
    if (s.status === "open") {
      actionBtn = `<button type="button" class="table-action-btn danger" onclick="toggleSlotStatus(${s.id}, 'closed')">關閉</button>`;
    } else if (s.status === "closed") {
      actionBtn = `<button type="button" class="table-action-btn success" onclick="toggleSlotStatus(${s.id}, 'open')">開啟</button>`;
    } else if (s.status === "pending") {
      actionBtn = `<span style="font-size:12px;color:var(--mist)">待預約審核</span>`;
    } else if (s.status === "booked") {
      actionBtn = `<span style="font-size:12px;color:var(--mist)">已確認預約</span>`;
    }
    
    let deleteBtn = "";
    if (s.status === "open" || s.status === "closed") {
      deleteBtn = `<button type="button" class="table-action-btn secondary" style="margin-left: 8px;" onclick="deleteSlot(${s.id})">刪除</button>`;
    }
    
    row.innerHTML = `
      <td><span style="font-family:'JetBrains Mono';font-size:14px;font-weight:bold;">${s.time}</span></td>
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

function addAdminSlot(dateVal, timeVal) {
  if (!dateVal || !timeVal) {
    alert("日期與時間無效！");
    return;
  }
  
  const duplicate = slots.find(s => s.date === dateVal && s.time === timeVal);
  if (duplicate) {
    alert("此日期與時段已在列表中！");
    return;
  }
  
  const nextSlotId = getNextId(slots, 1);
  const newSlot = {
    id: nextSlotId,
    date: dateVal,
    time: timeVal,
    status: "open",
    bookingId: null
  };
  
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

window.adminApproveRemittance = function(remittanceId) {
  const remit = remittances.find(r => r.id === remittanceId);
  if (!remit) return;
  
  const member = users.find(u => u.id === remit.userId);
  if (!member) {
    alert("找不到對應的會員，核准失敗。");
    return;
  }
  
  if (confirm(`確定已收到會員 ${member.name} 的匯款，並發放 ${remit.points} 點數嗎？`)) {
    // Grant points (1on1 points)
    member.points = (member.points || 0) + remit.points;
    
    // Write point transaction log
    const newTx = {
      id: transactions.length + 1,
      userId: member.id,
      type: "add",
      amount: remit.points,
      reason: `加購點數審核通過 (方案: ${getPackageName(remit.packageId)})`,
      date: getNowDateTimeString(),
      balance: member.points
    };
    transactions.push(newTx);

    // Add group session vouchers if applicable
    let bonusGroupVouchers = 0;
    if (remit.packageId === 8 || remit.packageId === "8") {
      bonusGroupVouchers = 1;
    } else if (remit.packageId === 15 || remit.packageId === "15") {
      bonusGroupVouchers = 2;
    }

    if (bonusGroupVouchers > 0) {
      if (member.groupPoints === undefined) member.groupPoints = 0;
      member.groupPoints = (member.groupPoints || 0) + bonusGroupVouchers;
      
      // Push bonus group session voucher(s)
      for (let i = 0; i < bonusGroupVouchers; i++) {
        const nextVoucherId = vouchers.length > 0 ? Math.max(...vouchers.map(v => v.id)) + 1 : 1;
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
      
      // Log group transaction
      const nextTxId = transactions.length + 1;
      transactions.push({
        id: nextTxId,
        userId: member.id,
        type: "add",
        amount: bonusGroupVouchers,
        reason: `加購套票加贈 - 團體頌缽次數`,
        date: getNowDateTimeString(),
        balance: member.groupPoints
      });
      
      dbSet("vouchers", vouchers, false);
    }
    
    // Update remittance status
    remit.status = "approved";
    
    // Save to database
    dbSet("transactions", transactions, false);
    dbSet("users", users, false);
    dbSet("remittances", remittances, true); // Trigger cloud sync here
    
    let bonusMsg = bonusGroupVouchers > 0 ? `，並加贈 ${bonusGroupVouchers} 次團體頌缽次數` : "";
    alert(`成功核准！已將 ${remit.points} 點數加至 ${member.name} 的帳戶中${bonusMsg}。`);
    renderAdminDashboard("remittances");
  }
};

window.openAdminRejectRemittance = function(remittanceId) {
  document.getElementById("rejectRemittanceId").value = remittanceId;
  document.getElementById("txtRejectReason").value = "";
  navigateTo("admin-reject-remittance");
};

// ==========================================
// 5. 事件監聽設定 (Event Listeners & Form Submissions)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  
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
  document.getElementById("btnNavBuyPoints")?.addEventListener("click", (e) => {
    e.preventDefault();
    navigateTo("buy-points");
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
  
  document.getElementById("btnBook1on1").addEventListener("click", () => navigateTo("book-1on1"));
  document.getElementById("btnBookGroup").addEventListener("click", () => navigateTo("book-group"));

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

  // Package Card Selection Listeners
  document.querySelectorAll(".package-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".package-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      
      const packageId = card.getAttribute("data-package-id");
      const points = card.getAttribute("data-points");
      const amount = card.getAttribute("data-amount");
      
      document.getElementById("buyPackageId").value = packageId;
      document.getElementById("buyPointsCount").value = points;
      document.getElementById("buyPointsAmount").value = amount;
      document.getElementById("buyActualAmount").value = amount;

      // 預留：將來您可以將不同的方案對應到不同的購買連結
      const btnGo = document.getElementById("btnGoToPurchase");
      if (btnGo) {
        if (packageId === "1") {
          btnGo.href = "https://line.me/R/ti/p/%40197nfdme"; // 1點 購買連結 (目前預設官方 LINE)
        } else if (packageId === "8") {
          btnGo.href = "https://line.me/R/ti/p/%40197nfdme"; // 8點 購買連結 (目前預設官方 LINE)
        } else if (packageId === "15") {
          btnGo.href = "https://line.me/R/ti/p/%40197nfdme"; // 15點 購買連結 (目前預設官方 LINE)
        }
      }

      // Dynamic virtual account generation (kept for DB compatibility)
      if (currentUser) {
        const vAcc = generateVirtualAccount(currentUser.id, parseInt(packageId));
        const lblVirtual = document.getElementById("lblVirtualAccount");
        if (lblVirtual) lblVirtual.textContent = vAcc;
      }
    });
  });

  // Warning banner click jump to edit profile
  document.getElementById("buyPointsBankWarning")?.addEventListener("click", () => {
    document.getElementById("btnEditProfile")?.click();
  });

  // Remittance Slip Submit Listener
  document.getElementById("formSubmitRemittance")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    // Check bank binding first
    if (!currentUser.paymentBankName || !currentUser.paymentBankLast5) {
      alert("儲值前請先至「個人資料」填寫常用匯款銀行名稱與帳號後五碼以進行防詐綁定。");
      return;
    }
    
    const packageId = document.getElementById("buyPackageId").value;
    if (!packageId) {
      alert("請先選擇您欲加購的點數套票方案。");
      return;
    }
    
    const chkAgree = document.getElementById("chkAgreeTerms").checked;
    if (!chkAgree) {
      alert("您必須同意消費者購買與服務契約以進行交易。");
      return;
    }
    
    const amount = parseInt(document.getElementById("buyActualAmount").value);
    const remitTime = document.getElementById("buyRemitTime").value.replace("T", " ");
    const note = document.getElementById("buyRemitNote").value.trim();
    
    const newRemit = {
      id: remittances.length + 1,
      userId: currentUser.id,
      firebaseUid: auth.currentUser ? auth.currentUser.uid : null,
      userName: currentUser.name,
      userPhone: currentUser.phone,
      packageId: parseInt(packageId),
      points: parseInt(document.getElementById("buyPointsCount").value),
      amount: amount,
      bankName: currentUser.paymentBankName,
      last5: currentUser.paymentBankLast5,
      remittedAt: remitTime,
      status: "pending",
      rejectReason: "",
      createdAt: getNowDateTimeString()
    };
    
    remittances.push(newRemit);
    dbSet("remittances", remittances);
    
    alert("匯款對帳回條已提交，管理員將儘速進行審核，感謝您的耐心等待。");
    
    // Clear form inputs
    document.getElementById("buyRemitTime").value = "";
    document.getElementById("buyRemitNote").value = "";
    document.getElementById("chkAgreeTerms").checked = false;
    
    renderBuyPointsPage();
  });

  document.getElementById("btnCancel1on1").addEventListener("click", () => navigateTo("member"));
  
  // Submit: 1-on-1 reservation
  document.getElementById("formBook1on1").addEventListener("submit", (e) => {
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
    
    // 1. Create booking entry
    const newBookingId = getNextId(bookings, 1001);
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
    
    if (currentUser.giftedPoints >= cost) {
      currentUser.giftedPoints -= cost;
      paidBy = "gifted";
    } else {
      currentUser.points -= cost;
      paidBy = "common";
    }
    dbSet("users", users);
    
    // Save payment method tag to booking
    newBooking.paidBy = paidBy;
    dbSet("bookings", bookings); // overwrite to save paidBy field
    
    // 4. Log point transaction
    const newTxId = getNextId(transactions, 5001);
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

  // Submit: Group booking
  document.getElementById("btnCancelGroup").addEventListener("click", () => navigateTo("member"));
  document.getElementById("formBookGroup").addEventListener("submit", (e) => {
    e.preventDefault();
    
    if (!selectedGroupId) {
      alert("請先選擇要報名的課程！");
      return;
    }
    
    const session = groupSessions.find(s => s.id === selectedGroupId);
    if (!session) return;
    
    // Safety check for capacity
    if (session.currentCapacity >= session.maxCapacity) {
      alert("該課程已額滿，請選擇其他班次！");
      return;
    }
    
    if ((currentUser.groupPoints || 0) < session.pointCost) {
      alert("可約次數不足，請加購次數後再進行報名。");
      return;
    }
    
    // Create group booking
    const newBookingId = getNextId(bookings, 1001);
    const timestamp = getNowDateTimeString();
    
    // Set date to next occurrence (just mock today + 2 days for simplified logic)
    const today = new Date();
    today.setDate(today.getDate() + 2);
    const dateStr = today.toISOString().split("T")[0];
    
    const notes = document.getElementById("bookGroupNotes").value;
    
    const newBooking = {
      id: newBookingId,
      userId: currentUser.id,
      firebaseUid: auth.currentUser ? auth.currentUser.uid : null,
      type: "group",
      sessionId: session.id,
      title: session.title,
      date: dateStr,
      time: session.time.replace("每週一 ", "").replace("每週三 ", "").replace("每週五 ", "").replace("每週六 ", ""),
      cost: session.pointCost,
      notes: notes,
      status: "已確認", // Group bookings are auto-confirmed in this template
      timestamp: timestamp
    };
    
    bookings.push(newBooking);
    dbSet("bookings", bookings);
    
    // Deduct user points (prefer giftedGroupPoints, fallback to common points)
    let paidBy = "common";
    if (currentUser.giftedGroupPoints === undefined) currentUser.giftedGroupPoints = 0;
    if (currentUser.points === undefined) currentUser.points = 0;
    
    if (currentUser.giftedGroupPoints >= session.pointCost) {
      currentUser.giftedGroupPoints -= session.pointCost;
      paidBy = "gifted";
    } else {
      currentUser.points -= session.pointCost;
      paidBy = "common";
    }
    dbSet("users", users);
    
    // Save payment method tag to booking
    newBooking.paidBy = paidBy;
    dbSet("bookings", bookings); // overwrite to save paidBy field
    
    // Increment session booking count
    session.currentCapacity += 1;
    dbSet("groupSessions", groupSessions);
    
    // Log transaction
    const newTxId = getNextId(transactions, 5001);
    const targetNameStr = paidBy === "gifted" ? "贈送" : "通用";
    transactions.push({
      id: newTxId,
      userId: currentUser.id,
      amount: session.pointCost,
      type: "deduct",
      reason: `報名團體頌缽課：${session.title} - 扣除${targetNameStr}額度`,
      date: timestamp,
      balance: paidBy === "gifted" ? currentUser.giftedGroupPoints : currentUser.points
    });
    dbSet("transactions", transactions);
    
    alert(`報名成功！已扣除 ${session.pointCost} 次預約額度。\n期待與您共同體驗頌缽的頻率。`);
    // Clear selection
    selectedGroupId = null;
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
      console.warn("Firebase Auth 登入失敗，檢查是否需要進行帳號安全遷移:", err.code);
      
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        // 2. 帳號可能還沒建立在 Firebase Auth（但舊資料庫有），啟動遷移與驗證
        try {
          const snapshot = await database.ref("users").orderByChild("email").equalTo(email).once("value");
          const allUsers = snapshot.val();
          let matchedKey = null;
          let matchedUser = null;
          
          if (allUsers) {
            if (Array.isArray(allUsers)) {
              for (let i = 0; i < allUsers.length; i++) {
                if (allUsers[i] && allUsers[i].email && allUsers[i].email.toLowerCase() === email) {
                  matchedUser = allUsers[i];
                  matchedKey = i;
                  break;
                }
              }
            } else {
              for (const key in allUsers) {
                if (allUsers[key] && allUsers[key].email && allUsers[key].email.toLowerCase() === email) {
                  matchedUser = allUsers[key];
                  matchedKey = key;
                  break;
                }
              }
            }
          }
          
          if (matchedUser) {
            // 驗證密碼是否正確 (比對舊有 SHA-256 雜湊或明文)
            const enteredHash = await hashPassword(password);
            const isPasswordCorrect = (matchedUser.password === enteredHash) || (matchedUser.password === password) || (!matchedUser.password);
            
            if (isPasswordCorrect) {
              btnSubmit.textContent = "建立安全帳號中...";
              // 在 Firebase Auth 建立該帳號
              const userCredential = await auth.createUserWithEmailAndPassword(email, password);
              const newUser = userCredential.user;
              
              // 搬遷 Profile 資料到新的安全 UID 路徑下
              matchedUser.firebaseUid = newUser.uid;
              if (!matchedUser.password) {
                matchedUser.password = enteredHash;
              } else if (matchedUser.password !== enteredHash) {
                matchedUser.password = enteredHash; // 確保儲存為雜湊
              }
              
              await database.ref(`users/${newUser.uid}`).set(matchedUser);
              
              // 移除舊的路徑資料
              await database.ref(`users/${matchedKey}`).remove();
              
              console.log("舊會員帳號遷移與驗證成功！", matchedUser.name);
            } else {
              alert("密碼不正確！\n輸入雜湊: " + enteredHash + "\n資料庫密碼: " + (matchedUser ? matchedUser.password : "未找到"));
              passwordInput.focus();
            }
          } else {
            // 用戶不存在，引導至註冊頁面並預帶欄位
            document.getElementById("regName").value = "";
            document.getElementById("regPhone").value = "";
            document.getElementById("regEmail").value = email;
            document.getElementById("regPassword").value = password; // 預填密碼
            document.getElementById("formRegisterProfile").dataset.tempEmail = email;
            navigateTo("register");
          }
        } catch (dbErr) {
          console.error("資料庫驗證遷移出錯", dbErr);
          alert("登入驗證時出錯，原因：" + dbErr.message);
        }
      } else {
        // 其他驗證錯誤（例如密碼錯誤）
        alert("登入驗證失敗：密碼不正確或帳號格式有誤！");
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
    const hashedPassword = await hashPassword(password);
    
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
      
      const nextUserId = getNextId(users, 1);
      const dateStr = new Date().toISOString().split("T")[0];
      
      const newUser = {
        id: nextUserId,
        email: email,
        name: name,
        phone: phone,
        gender: gender,
        password: hashedPassword, // Store set login password (hashed)
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

  // Admin Quick Slots buttons
  document.querySelectorAll(".btn-quick-time").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!adminSlotSelectedDateStr) {
        alert("請先點選左側日曆選擇日期！");
        return;
      }
      const timeVal = btn.getAttribute("data-time");
      addAdminSlot(adminSlotSelectedDateStr, timeVal);
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
    addAdminSlot(adminSlotSelectedDateStr, timeVal);
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
  document.getElementById("formAdminAdjustPoints").addEventListener("submit", (e) => {
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
    const newTxId = getNextId(transactions, 5001);
    
    let targetNameStr = "通用";
    if (targetType === "gifted_1on1") targetNameStr = "贈送-1對1";
    if (targetType === "gifted_group") targetNameStr = "贈送-團體";
    
    if (adjustType === "add") {
      let currentBal = 0;
      if (targetType === "common") {
        member.points += amount;
        currentBal = member.points;
      } else if (targetType === "gifted_1on1") {
        member.giftedPoints += amount;
        currentBal = member.giftedPoints;
      } else if (targetType === "gifted_group") {
        member.giftedGroupPoints += amount;
        currentBal = member.giftedGroupPoints;
      }
      transactions.push({
        id: newTxId,
        userId: member.id,
        amount: amount,
        type: "add",
        reason: `管理員調整(${targetNameStr})：${reason}`,
        date: timestamp,
        balance: currentBal
      });
    } else {
      let currentBal = 0;
      if (targetType === "common") {
        member.points = Math.max(0, member.points - amount);
        currentBal = member.points;
      } else if (targetType === "gifted_1on1") {
        member.giftedPoints = Math.max(0, member.giftedPoints - amount);
        currentBal = member.giftedPoints;
      } else if (targetType === "gifted_group") {
        member.giftedGroupPoints = Math.max(0, member.giftedGroupPoints - amount);
        currentBal = member.giftedGroupPoints;
      }
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
      }
      const hashedPassword = await hashPassword(newPassword);
      users[memberIndex].password = hashedPassword;
    }
    
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
    
    const headers = [
      "會員ID", "姓名", "電子郵件", "手機號碼", "生理性別", 
      "加入日期", "登入密碼", "通用點數", "贈送-1對1點數", "贈送-團體點數", "是否LINE帳號"
    ];
    
    let tableRows = "";
    memberUsers.forEach(u => {
      const isLineStr = u.lineUserId ? "是" : "否";
      const pwdText = u.lineUserId ? "LINE註冊" : (u.password || "未設定");
      tableRows += `
        <tr>
          <td>${u.id}</td>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td>${u.phone}</td>
          <td>${u.gender}</td>
          <td>${u.joinDate}</td>
          <td>${pwdText}</td>
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
    
    const hashedPassword = await hashPassword(password);
    const nextUserId = getNextId(users, 1);
    const dateStr = new Date().toISOString().split("T")[0];
    
    const newUser = {
      id: nextUserId,
      email: email,
      name: name,
      phone: phone,
      gender: gender,
      password: hashedPassword, // Save initial password (hashed)
      role: "member",
      points: 0, // Starts at 0 points
      joinDate: dateStr
    };
    
    users.push(newUser);
    dbSet("users", users);
    
    // Clean inputs
    document.getElementById("addMemName").value = "";
    document.getElementById("addMemEmail").value = "";
    document.getElementById("addMemPhone").value = "";
    document.getElementById("addMemPassword").value = "";
    
    alert(`會員「${name}」已成功新增！`);
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
  window.open("https://line.me/R/ti/p/%40197nfdme", "_blank");

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
  document.getElementById("formAdminIssueCoupon").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const userId = parseInt(document.getElementById("selCouponTarget").value);
    const templateSelect = document.getElementById("selCouponTemplate");
    const couponName = templateSelect.value;
    const bonus = parseInt(templateSelect.options[templateSelect.selectedIndex].dataset.points);
    
    const member = users.find(u => u.id === userId);
    if (!member) return;
    
    // Add coupon to vouchers list
    const nextCpnId = vouchers.length > 0 ? Math.max(...vouchers.map(v => v.id)) + 1 : 1;
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const newCoupon = {
      id: nextCpnId,
      userId: member.id,
      name: couponName,
      bonusPoints: bonus,
      status: "available",
      code: randomCode
    };
    
    vouchers.push(newCoupon);
    dbSet("vouchers", vouchers);
    
    // Apply points to member directly (simplification for coupons)
    if (member.points === undefined) member.points = 0;
    if (member.giftedPoints === undefined) member.giftedPoints = 0;
    if (member.giftedGroupPoints === undefined) member.giftedGroupPoints = 0;
    
    let currentBal = 0;
    const is1on1 = couponName === "生日優惠贈送次數";
    if (is1on1) {
      member.giftedPoints += bonus;
      currentBal = member.giftedPoints;
    } else {
      member.giftedGroupPoints += bonus;
      currentBal = member.giftedGroupPoints;
    }
    dbSet("users", users);
    
    // Log points transaction
    const timestamp = getNowDateTimeString();
    const newTxId = getNextId(transactions, 5001);
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
    database.ref("settings/lineWebhookUrl").set(webhookUrl)
      .then(() => {
        alert("🎉 LINE Webhook 代理 URL 設定已成功儲存！");
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
});


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
  
  // 2. 角色權限隔離節點監聽
  if (currentUserId) {
    if (isAdmin) {
      // 管理員：監聽/下載所有人的完整明細
      const usersRef = database.ref("users");
      usersRef.on("value", (snapshot) => {
        const val = snapshot.val();
        users = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)) : [];
        dbSet("users", users, false);
        syncCurrentUser();
        triggerViewRender();
      });
      activeListeners.push(usersRef);
      
      const bookingsRef = database.ref("bookings");
      bookingsRef.on("value", (snapshot) => {
        const val = snapshot.val();
        bookings = val ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val)).sort((a,b) => a.id - b.id) : [];
        dbSet("bookings", bookings, false);
        triggerViewRender();
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
    if (viewId === "book-1on1") render1on1Form();
    if (viewId === "book-group") renderGroupForm();
  }
}

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
            database.ref(`users/${pathKey}`).set(item);
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
      database.ref(key).set(arrayToMap(data));
    } else {
      database.ref(key).set(data);
    }
    return;
  }
  
  // 一般會員：採用增量寫入 (個別 ID 的段點寫入)，保護其他使用者記錄不被複寫
  if (key === "bookings") {
    data.forEach(item => {
      if (item && item.userId === currentUserId) {
        database.ref(`bookings/${item.id}`).set(item);
      }
    });
  } else if (key === "remittances") {
    data.forEach(item => {
      if (item && item.userId === currentUserId) {
        database.ref(`remittances/${item.id}`).set(item);
      }
    });
  } else if (key === "transactions") {
    data.forEach(item => {
      if (item && item.userId === currentUserId) {
        database.ref(`transactions/${item.id}`).set(item);
      }
    });
  } else {
    // slots, groupSessions, vouchers 等公共節點 (唯讀)
    if (["bookings", "vouchers", "transactions", "remittances", "groupSessions", "slots"].includes(key) && Array.isArray(data)) {
      database.ref(key).set(arrayToMap(data));
    } else {
      database.ref(key).set(data);
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
