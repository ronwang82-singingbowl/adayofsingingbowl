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
let pushTimeout = null;

function dbSet(key, data, syncToCloud = true) {
  localStorage.setItem(`singbowl_${key}`, JSON.stringify(data));
  if (syncToCloud) {
    pushCloudData();
  }
}

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

// Restore user session on load
function initSession() {
  // 1. 先用本地快取快速加載畫面，提升 UX 體驗
  const savedUserId = localStorage.getItem("singbowl_current_user_id");
  if (savedUserId) {
    currentUser = users.find(u => u.id === parseInt(savedUserId));
    if (currentUser) {
      onUserLoginSuccess();
    } else {
      onUserLogoutSuccess();
    }
  } else {
    onUserLogoutSuccess();
  }
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
  
  navigateTo("landing");
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
  document.getElementById("lblMemberPoints").textContent = currentUser.points;
  document.getElementById("lblMemberGroupPoints").textContent = currentUser.groupPoints || 0;
  
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
      if (booking.type === "1on1") {
        member.points += booking.cost;
        currentBal = member.points;
      } else {
        member.groupPoints = (member.groupPoints || 0) + booking.cost;
        currentBal = member.groupPoints;
      }
      dbSet("users", users);
      
      // 3. Log point transaction
      const newTxId = transactions.length > 0 ? transactions[transactions.length - 1].id + 1 : 5001;
      const nowStr = getNowDateTimeString();
      const typeNameStr = booking.type === "1on1" ? "1對1" : "團體";
      transactions.push({
        id: newTxId,
        userId: member.id,
        amount: booking.cost,
        type: "add",
        reason: `取消預約退還(${typeNameStr})：ID ${booking.id}`,
        date: nowStr,
        balance: currentBal
      });
      dbSet("transactions", transactions);
    }
    
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
  document.getElementById("lblBook1on1UserPoints").textContent = currentUser.points;
  
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
  document.getElementById("lblBookGroupUserPoints").textContent = currentUser.groupPoints || 0;
  
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

  // Show/Hide warning if bank info not set
  const bankWarning = document.getElementById("buyPointsBankWarning");
  if (bankWarning) {
    if (!currentUser.paymentBankName || !currentUser.paymentBankLast5) {
      bankWarning.style.display = "flex";
    } else {
      bankWarning.style.display = "none";
    }
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
  const monthlyBookings = bookings.length; // Simple count for mock dataset
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
  
  // 5. Coupon management lists
  if (paneId === "coupons") {
    renderAdminCouponsPanel();
  }
  
  // 6. Slots management lists
  if (paneId === "slots") {
    renderAdminSlotsPanel();
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
    if (u.role === "admin") return false;
    if (memberSearchQuery === "") return true;
    return u.name.includes(memberSearchQuery) || 
           u.phone.includes(memberSearchQuery) || 
           u.email.includes(memberSearchQuery);
  });
  
  document.getElementById("lblAdminMemberCount").textContent = filteredMembers.length;
  
  if (filteredMembers.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="tx-empty" style="text-align:center;">找不到符合的會員</td></tr>`;
  } else {
    filteredMembers.forEach(u => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${u.name}</strong></td>
        <td>${u.phone}<br><span style="font-size:11px;color:var(--mist);">${u.email}</span></td>
        <td>${u.gender}</td>
        <td>${u.joinDate}</td>
        <td>1對1: <strong class="text-brass">${u.points}</strong> 次<br>團體: <strong class="text-brass">${u.groupPoints || 0}</strong> 次</td>
        <td>
          <div class="action-btn-group">
            <button class="table-action-btn success" onclick="openAdjustPoints(${u.id})">調整次數</button>
            <button class="table-action-btn secondary" onclick="openEditMember(${u.id})">編輯資料</button>
            <button class="table-action-btn danger" onclick="deleteMember(${u.id})">刪除會員</button>
          </div>
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
  document.getElementById("lblAdjustTargetGroupPoints").textContent = member.groupPoints || 0;
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
  
  const genderRadios = document.getElementsByName("editMemGender");
  genderRadios.forEach(radio => {
    radio.checked = (radio.value === member.gender);
  });
  
  navigateTo("admin-edit-member");
};

// 4.3 Booking List rendering with filter state
let bookingFilter = "all";

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
      if (booking.type === "1on1") {
        member.points += booking.cost;
        currentBal = member.points;
      } else {
        member.groupPoints = (member.groupPoints || 0) + booking.cost;
        currentBal = member.groupPoints;
      }
      dbSet("users", users);
      
      // 3. Log points
      const newTxId = transactions.length > 0 ? transactions[transactions.length - 1].id + 1 : 5001;
      const nowStr = getNowDateTimeString();
      const typeNameStr = booking.type === "1on1" ? "1對1" : "團體";
      transactions.push({
        id: newTxId,
        userId: member.id,
        amount: booking.cost,
        type: "add",
        reason: `${booking.status === "已確認" ? "管理員取消退還" : "預約被拒退還"}(${typeNameStr})：ID ${booking.id}`,
        date: nowStr,
        balance: currentBal
      });
      dbSet("transactions", transactions);
    }
    
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
  
  vouchers.sort((a,b) => b.id - a.id).forEach(v => {
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
    `;
    container.appendChild(row);
  });
}

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
  
  const nextSlotId = slots.length > 0 ? slots[slots.length - 1].id + 1 : 1;
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
  document.getElementById("btnHeaderLogout").addEventListener("click", onUserLogoutSuccess);
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

      // Dynamic virtual account generation
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
    const newBookingId = bookings.length > 0 ? bookings[bookings.length - 1].id + 1 : 1001;
    const timestamp = getNowDateTimeString();
    
    const newBooking = {
      id: newBookingId,
      userId: currentUser.id,
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
    
    // 2. Deduct points from user
    currentUser.points -= cost;
    dbSet("users", users);
    
    // 3. Log point transaction
    const newTxId = transactions.length > 0 ? transactions[transactions.length - 1].id + 1 : 5001;
    transactions.push({
      id: newTxId,
      userId: currentUser.id,
      amount: cost,
      type: "deduct",
      reason: `預約 1 對 1 頌缽療癒 (${newBooking.duration}分鐘)`,
      date: timestamp,
      balance: currentUser.points
    });
    dbSet("transactions", transactions);
    
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
    const newBookingId = bookings.length > 0 ? bookings[bookings.length - 1].id + 1 : 1001;
    const timestamp = getNowDateTimeString();
    
    // Set date to next occurrence (just mock today + 2 days for simplified logic)
    const today = new Date();
    today.setDate(today.getDate() + 2);
    const dateStr = today.toISOString().split("T")[0];
    
    const notes = document.getElementById("bookGroupNotes").value;
    
    const newBooking = {
      id: newBookingId,
      userId: currentUser.id,
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
    
    // Deduct user points
    currentUser.groupPoints = (currentUser.groupPoints || 0) - session.pointCost;
    dbSet("users", users);
    
    // Increment session booking count
    session.currentCapacity += 1;
    dbSet("groupSessions", groupSessions);
    
    // Log transaction
    const newTxId = transactions.length > 0 ? transactions[transactions.length - 1].id + 1 : 5001;
    transactions.push({
      id: newTxId,
      userId: currentUser.id,
      amount: session.pointCost,
      type: "deduct",
      reason: `報名團體頌缽課：${session.title}`,
      date: timestamp,
      balance: currentUser.groupPoints
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

  // Mock Authentication: Email Auth Flow
  document.getElementById("formEmailAuth").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("authEmail").value.trim().toLowerCase();
    
    const existing = users.find(u => u.email === email);
    if (existing) {
      // User exists, login
      currentUser = existing;
      localStorage.setItem("singbowl_current_user_id", currentUser.id);
      onUserLoginSuccess();
      alert(`歡迎回來，${currentUser.name}！`);
    } else {
      // User doesn't exist, navigate to Registration to complete profile
      document.getElementById("regName").value = "";
      document.getElementById("regPhone").value = "";
      document.getElementById("regEmail").value = email;
      document.getElementById("formRegisterProfile").dataset.tempEmail = email;
      navigateTo("register");
    }
  });

  // Form: Complete Profile submission (Registration)
  document.getElementById("formRegisterProfile").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const regForm = document.getElementById("formRegisterProfile");
    const email = document.getElementById("regEmail").value.trim().toLowerCase();
    const lineUserId = regForm.dataset.lineUserId || null;
    const name = document.getElementById("regName").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const gender = document.querySelector('input[name="regGender"]:checked').value;
    
    // 驗證電子郵件是否已被註冊
    const existing = users.find(u => u.email === email);
    if (existing) {
      alert("此電子郵件已被註冊，請使用其他電子郵件！");
      return;
    }
    
    // 1. Create User
    const nextUserId = users.length > 0 ? users[users.length - 1].id + 1 : 1;
    const dateStr = new Date().toISOString().split("T")[0];
    
    const newUser = {
      id: nextUserId,
      email: email,
      name: name,
      phone: phone,
      gender: gender,
      role: "member",
      points: 0, // 預設新註冊會員起步次數為 0
      joinDate: dateStr,
      lineUserId: lineUserId
    };
    
    users.push(newUser);
    dbSet("users", users);
    
    // Set Login state
    currentUser = newUser;
    localStorage.setItem("singbowl_current_user_id", currentUser.id);
    onUserLoginSuccess();
    
    alert(`恭喜您註冊成功！🎵`);
  });

  // Admin Sidebar Nav bindings
  document.getElementById("btnAdminMenuOverview").addEventListener("click", () => renderAdminDashboard("overview"));
  document.getElementById("btnAdminMenuMembers").addEventListener("click", () => renderAdminDashboard("members"));
  document.getElementById("btnAdminMenuBookings").addEventListener("click", () => renderAdminDashboard("bookings"));
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
    
    if (member.groupPoints === undefined) member.groupPoints = 0;
    
    const timestamp = getNowDateTimeString();
    const newTxId = transactions.length > 0 ? transactions[transactions.length - 1].id + 1 : 5001;
    
    const targetNameStr = targetType === "1on1" ? "1對1" : "團體";
    
    if (adjustType === "add") {
      let currentBal = 0;
      if (targetType === "1on1") {
        member.points += amount;
        currentBal = member.points;
      } else {
        member.groupPoints += amount;
        currentBal = member.groupPoints;
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
      if (targetType === "1on1") {
        member.points = Math.max(0, member.points - amount);
        currentBal = member.points;
      } else {
        member.groupPoints = Math.max(0, member.groupPoints - amount);
        currentBal = member.groupPoints;
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
    
    alert(`成功更新會員「${member.name}」的可約次數！目前餘額：1對1 ${member.points} 次 / 團體 ${member.groupPoints} 次。`);
    renderAdminDashboard("members");
  });

  // Admin Form Edit Member submit & cancel
  document.getElementById("btnCancelEditMember").addEventListener("click", () => navigateTo("admin"));
  document.getElementById("formAdminEditMember").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const memberId = parseInt(document.getElementById("editMemberId").value);
    const memberIndex = users.findIndex(u => u.id === memberId);
    if (memberIndex === -1) return;
    
    const newName = document.getElementById("editMemName").value.trim();
    const newEmail = document.getElementById("editMemEmail").value.trim().toLowerCase();
    const newPhone = document.getElementById("editMemPhone").value.trim();
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
    
    dbSet("users", users);
    
    alert("會員資料已更新成功！");
    renderAdminDashboard("members");
    navigateTo("admin");
  });

  // Admin Manual Add Member modal toggle
  document.getElementById("btnAdminAddMember").addEventListener("click", () => navigateTo("admin-add-member"));
  document.getElementById("btnCancelAddMem").addEventListener("click", () => navigateTo("admin"));
  
  // Admin Form Manual Add Member submit
  document.getElementById("formAdminAddMember").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const name = document.getElementById("addMemName").value.trim();
    const email = document.getElementById("addMemEmail").value.trim().toLowerCase();
    const phone = document.getElementById("addMemPhone").value.trim();
    const gender = document.querySelector('input[name="addMemGender"]:checked').value;
    
    // Check if email unique
    if (users.find(u => u.email === email)) {
      alert("此 Email 已被其他會員註冊！");
      return;
    }
    
    const nextUserId = users.length > 0 ? users[users.length - 1].id + 1 : 1;
    const dateStr = new Date().toISOString().split("T")[0];
    
    const newUser = {
      id: nextUserId,
      email: email,
      name: name,
      phone: phone,
      gender: gender,
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
    
    alert(`會員「${name}」已成功新增！`);
    renderAdminDashboard("members");
  });

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
    const nextCpnId = vouchers.length > 0 ? vouchers[vouchers.length - 1].id + 1 : 1;
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
    if (member.groupPoints === undefined) member.groupPoints = 0;
    
    let currentBal = 0;
    const is1on1 = couponName === "生日優惠贈送次數";
    if (is1on1) {
      member.points += bonus;
      currentBal = member.points;
    } else {
      member.groupPoints += bonus;
      currentBal = member.groupPoints;
    }
    dbSet("users", users);
    
    // Log points transaction
    const timestamp = getNowDateTimeString();
    const newTxId = transactions.length > 0 ? transactions[transactions.length - 1].id + 1 : 5001;
    const targetNameStr = is1on1 ? "1對1" : "團體";
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

  // Start Firebase Realtime Synchronization globally on load
  startRealtimeSync();

  // Initialize Session (LINE LIFF 優先)
  if (typeof liff !== "undefined") {
    liff.init({ liffId: "2010665706-wxtkVO4B" })
      .then(() => {
        console.log("LINE LIFF 初始化成功");
        if (liff.isLoggedIn()) {
          handleLiffLogin();
        } else {
          initSession();
        }
      })
      .catch(err => {
        console.error("LINE LIFF 初始化失敗:", err);
        initSession();
      });
  } else {
    initSession();
  }
});

// ==========================================
// 6. LINE LIFF 登入處理與輔助函數
// ==========================================

// LINE 官方授權登入處理
function handleLiffLogin() {
  if (typeof liff === "undefined") return;

  Promise.all([
    liff.getProfile(),
    liff.getDecodedIDToken()
  ]).then(([profile, idToken]) => {
    const lineUserId = profile.userId;
    const lineName = profile.displayName;
    
    // 優先取得 LINE 綁定的 Email，若無授權則使用專屬的虛擬 LINE 信箱
    const lineEmail = (idToken && idToken.email) ? idToken.email : `line_${lineUserId}@line.com`;

    // 在模擬資料庫中尋找是否已有此 LINE 帳號
    let existing = users.find(u => u.lineUserId === lineUserId || u.email === lineEmail);

    if (existing) {
      // 帳號已存在，直接自動登入
      if (!existing.lineUserId) {
        existing.lineUserId = lineUserId;
        dbSet("users", users);
      }
      currentUser = existing;
      localStorage.setItem("singbowl_current_user_id", currentUser.id);
      onUserLoginSuccess();
      alert(`歡迎回來，${currentUser.name}！ (LINE 登入)`);
    } else {
      // 帳號不存在，導向填寫個人資料頁面完成註冊
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
  }).catch(err => {
    console.error("取得 LINE 個人資料失敗", err);
    initSession();
  });
}

// 本地模擬登入的 Fallback 邏輯
function runMockLineLogin() {
  window.open("https://line.me/R/ti/p/%40197nfdme", "_blank");

  const mockEmail = `line_user_${Math.floor(Math.random() * 90000 + 10000)}@line.com`;
  const existing = users.find(u => u.email === mockEmail);
  if (existing) {
    currentUser = existing;
    localStorage.setItem("singbowl_current_user_id", currentUser.id);
    onUserLoginSuccess();
  } else {
    document.getElementById("regName").value = "LINE 用戶";
    document.getElementById("regPhone").value = "";
    document.getElementById("regEmail").value = "";
    
    const regForm = document.getElementById("formRegisterProfile");
    regForm.dataset.tempEmail = "";
    regForm.dataset.lineUserId = "";
    
    navigateTo("register");
  }
}

// 從雲端資料庫 (Firebase) 監聽最新狀態並即時同步
let isInitialSyncDone = false;
function startRealtimeSync() {
  database.ref("db_state").on("value", (snapshot) => {
    const cloudData = snapshot.val();
    
    if (!cloudData) {
      if (!isInitialSyncDone) {
        console.log("雲端資料庫尚未初始化，正在寫入預設資料...");
        pushCloudData();
        isInitialSyncDone = true;
      }
      return;
    }
    
    isInitialSyncDone = true;
    
    if (cloudData.users) { users = cloudData.users; dbSet("users", users, false); }
    if (cloudData.bookings) { bookings = cloudData.bookings; dbSet("bookings", bookings, false); }
    if (cloudData.vouchers) { vouchers = cloudData.vouchers; dbSet("vouchers", vouchers, false); }
    if (cloudData.groupSessions) { groupSessions = cloudData.groupSessions; dbSet("groupSessions", groupSessions, false); }
    if (cloudData.transactions) { transactions = cloudData.transactions; dbSet("transactions", transactions, false); }
    if (cloudData.slots) { slots = cloudData.slots; dbSet("slots", slots, false); }
    if (cloudData.remittances) { remittances = cloudData.remittances; dbSet("remittances", remittances, false); }
    
    console.log("雲端資料庫即時同步更新！");
    
    // 更新當前使用者狀態並重新渲染 UI
    const savedUserId = localStorage.getItem("singbowl_current_user_id");
    if (savedUserId) {
      const updatedUser = users.find(u => u.id === parseInt(savedUserId));
      if (updatedUser) {
        currentUser = updatedUser;
        // 根據當前作用中的分頁重新渲染
        const activeSection = document.querySelector(".view-section.active");
        if (activeSection) {
          const viewId = activeSection.id.replace("view-", "");
          if (viewId === "member") renderDashboard();
          if (viewId === "admin") renderAdminDashboard(activeAdminPane);
          if (viewId === "buy-points") renderBuyPointsPage();
          if (viewId === "book-1on1") render1on1Form();
          if (viewId === "book-group") renderGroupForm();
        }
      } else {
        // 找不到此用戶，強制登出並清除無效的本地 Session
        currentUser = null;
        localStorage.removeItem("singbowl_current_user_id");
        onUserLogoutSuccess();
      }
    }
  }, (err) => {
    console.error("雲端監聽錯誤:", err);
  });
}

// 異步將最新狀態寫入雲端資料庫 (帶有 300ms 防抖優化)
function pushCloudData() {
  if (pushTimeout) clearTimeout(pushTimeout);
  pushTimeout = setTimeout(async () => {
    const payload = {
      users,
      bookings,
      vouchers,
      groupSessions,
      transactions,
      slots,
      remittances
    };
    try {
      await database.ref("db_state").set(payload);
      console.log("雲端資料同步寫入成功！");
    } catch (err) {
      console.error("雲端寫入錯誤:", err);
    }
  }, 300);
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
