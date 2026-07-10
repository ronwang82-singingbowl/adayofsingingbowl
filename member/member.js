// ============ 缽日會員預約系統 - 狀態管理 & 頁面邏輯 ============

// ==========================================
// 1. 初始化本地模擬資料庫 (LocalStorage)
// ==========================================

const DEFAULT_USERS = [
  { id: 1, email: "admin@singbowl.com", name: "管理員", phone: "0900-000-000", gender: "其他", role: "admin", points: 0, joinDate: "2026-07-01" },
  { id: 2, email: "test@singbowl.com", name: "王小明", phone: "0912-345-678", gender: "生理男", role: "member", points: 15, joinDate: "2026-07-05" },
  { id: 3, email: "beauty@singbowl.com", name: "李美麗", phone: "0928-888-888", gender: "生理女", role: "member", points: 30, joinDate: "2026-07-06" },
  { id: 4, email: "david@singbowl.com", name: "陳大衛", phone: "0933-111-222", gender: "生理男", role: "member", points: 5, joinDate: "2026-07-07" }
];

const DEFAULT_VOUCHERS = [
  { id: 1, userId: 2, name: "新會員優惠", bonusPoints: 50, status: "used", code: "NEW50" },
  { id: 2, userId: 2, name: "月度優惠", bonusPoints: 30, status: "available", code: "MON30" },
  { id: 3, userId: 3, name: "推薦優惠", bonusPoints: 100, status: "available", code: "REF100" },
  { id: 4, userId: 4, name: "生日優惠", bonusPoints: 60, status: "available", code: "BDAY60" }
];

const DEFAULT_GROUP_SESSIONS = [
  { id: 1, title: "週一晚間頌缽冥想", time: "每週一 19:30 - 20:30", maxCapacity: 10, currentCapacity: 8, pointCost: 3 },
  { id: 2, title: "週三午間放鬆療癒", time: "每週三 12:30 - 13:30", maxCapacity: 10, currentCapacity: 10, pointCost: 3 }, // 預設已額滿
  { id: 3, title: "週五晚間身心平衡", time: "每週五 19:00 - 20:00", maxCapacity: 10, currentCapacity: 5, pointCost: 3 },
  { id: 4, title: "週六早晨能量提升", time: "每週六 10:00 - 11:00", maxCapacity: 10, currentCapacity: 2, pointCost: 3 }
];

const DEFAULT_BOOKINGS = [
  { id: 1001, userId: 2, type: "1on1", date: "2026-07-12", time: "14:00", duration: 60, cost: 6, notes: "最近睡眠品質不佳，希望能加強頭部釋壓。", status: "已確認", timestamp: "2026-07-08 14:32" },
  { id: 1002, userId: 3, type: "group", sessionId: 1, title: "週一晚間頌缽冥想", date: "2026-07-13", time: "19:30 - 20:30", cost: 3, notes: "", status: "已確認", timestamp: "2026-07-08 16:15" },
  { id: 1003, userId: 4, type: "1on1", date: "2026-07-15", time: "10:30", duration: 30, cost: 3, notes: "", status: "待確認", timestamp: "2026-07-09 11:20" }
];

const DEFAULT_TRANSACTIONS = [
  { id: 5001, userId: 2, amount: 50, type: "add", reason: "註冊送新會員優惠券點數", date: "2026-07-05 10:00", balance: 50 },
  { id: 5002, userId: 2, amount: 35, type: "deduct", reason: "預約 1 對 1 療癒 (新制前)", date: "2026-07-06 14:00", balance: 15 },
  { id: 5003, userId: 3, amount: 30, type: "add", reason: "後台調整點數", date: "2026-07-06 12:00", balance: 30 },
  { id: 5004, userId: 4, amount: 5, type: "add", reason: "手動充值", date: "2026-07-07 15:30", balance: 5 }
];

// Helper functions for LocalStorage persistence
function dbGet(key, defaultData) {
  const data = localStorage.getItem(`singbowl_${key}`);
  return data ? JSON.parse(data) : defaultData;
}

// Cloud Database Config (kvdb.io)
const BLOB_URL = "https://kvdb.io/NdSgaATgf9EmqYBaKLQumM/db_state";
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
let currentUser = null;

// Save initial database state (local-only, do not write to cloud on load)
dbSet("users", users, false);
dbSet("bookings", bookings, false);
dbSet("vouchers", vouchers, false);
dbSet("groupSessions", groupSessions, false);
dbSet("transactions", transactions, false);

// ==========================================
// 2. 視圖切換與路由 (Router)
// ==========================================

const VIEWS = [
  "landing", "auth", "register", "member", "edit-profile", "book-1on1", "book-group", 
  "admin", "admin-points", "admin-add-member"
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

  // Update navigation items state
  updateNavState(viewId);

  // Trigger page-specific renders
  if (viewId === "member") renderDashboard();
  if (viewId === "book-1on1") render1on1Form();
  if (viewId === "book-group") renderGroupForm();
  if (viewId === "admin") renderAdminDashboard("overview");
}

function updateNavState(viewId) {
  // Highlight navigation item
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  if (viewId === "landing") document.getElementById("btnNavHome")?.classList.add("active");
  if (viewId === "member") document.getElementById("btnNavMember")?.classList.add("active");
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
  
  // 2. 異步向雲端資料庫請求最新資料並進行同步
  fetchCloudData();
}

function onUserLoginSuccess() {
  // Show header user state
  document.getElementById("btnHeaderLogin").style.display = "none";
  document.getElementById("headerUserMenu").style.display = "flex";
  document.getElementById("headerUserName").textContent = currentUser.name;
  
  // Show nav links based on role
  document.getElementById("btnNavMember").style.display = "block";
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
  document.getElementById("btnNavAdmin").style.display = "none";
  
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
        <div class="voucher-bonus ${v.status === "used" ? "used" : ""}">+${v.bonusPoints} 點</div>
      `;
      vouchersContainer.appendChild(item);
    });
  }
  
  // Point transactions
  const txContainer = document.getElementById("memberTxList");
  const userTxs = transactions.filter(t => t.userId === currentUser.id).sort((a,b) => b.id - a.id);
  txContainer.innerHTML = "";
  
  if (userTxs.length === 0) {
    txContainer.innerHTML = `<tr><td colspan="4" class="tx-empty">尚無任何交易明細</td></tr>`;
  } else {
    userTxs.forEach(t => {
      const row = document.createElement("tr");
      const isAdd = t.type === "add";
      const changeClass = isAdd ? "tx-add" : "tx-deduct";
      const sign = isAdd ? "+" : "-";
      
      row.innerHTML = `
        <td>${t.date.split(" ")[0]}</td>
        <td>${isAdd ? "調整增加" : "預約扣點"}</td>
        <td class="${changeClass}">${sign}${t.amount}</td>
        <td>${t.reason} (結餘: ${t.balance}點)</td>
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
      
      const typeLabel = b.type === "1on1" ? `1 對 1 頌缽療癒 (${b.duration} 分鐘)` : `團體課程 - ${b.title}`;
      let detailRow = "";
      if (b.type === "1on1") {
        detailRow = `
          <div class="res-detail-row"><i data-lucide="calendar"></i> <span>預約時間：${b.date} ${b.time}</span></div>
          <div class="res-detail-row"><i data-lucide="clock"></i> <span>療程長度：${b.duration} 分鐘</span></div>
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
          <div class="res-detail-row"><i data-lucide="coins"></i> <span>消耗點數：${b.cost} 點</span></div>
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
  
  if (confirm("確定要取消此預約嗎？\n您的預約點數將自動全額退款。")) {
    // 1. Update booking status
    booking.status = "已取消";
    dbSet("bookings", bookings);
    
    // 2. Refund points to user
    const member = users.find(u => u.id === booking.userId);
    if (member) {
      member.points += booking.cost;
      dbSet("users", users);
      
      // 3. Log point transaction
      const newTxId = transactions.length > 0 ? transactions[transactions.length - 1].id + 1 : 5001;
      const nowStr = getNowDateTimeString();
      transactions.push({
        id: newTxId,
        userId: member.id,
        amount: booking.cost,
        type: "add",
        reason: `取消預約退款：ID ${booking.id}`,
        date: nowStr,
        balance: member.points
      });
      dbSet("transactions", transactions);
    }
    
    alert("預約已取消，點數已全額退款！");
    renderDashboard();
  }
};

// Render 1on1 booking variables
function render1on1Form() {
  if (!currentUser) return;
  document.getElementById("lblBook1on1UserPoints").textContent = currentUser.points;
  
  // Set default date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById("book1on1Date").value = tomorrow.toISOString().split("T")[0];
  document.getElementById("book1on1Time").value = "14:00";
  
  // Trigger update points
  update1on1Cost();
}

function update1on1Cost() {
  const duration = parseInt(document.getElementById("book1on1Duration").value);
  const costMap = { "30": 3, "60": 6, "90": 9, "120": 12 };
  const cost = costMap[duration] || 6;
  
  document.getElementById("lblBook1on1Cost").textContent = cost;
  
  // Warning display
  const warning = document.getElementById("lblBook1on1Warning");
  const submitBtn = document.getElementById("btnSubmit1on1");
  
  if (currentUser.points < cost) {
    warning.style.display = "flex";
    submitBtn.disabled = true;
    submitBtn.classList.add("disabled");
  } else {
    warning.style.display = "none";
    submitBtn.disabled = false;
    submitBtn.classList.remove("disabled");
  }
}

// Render Group Session booking cards
let selectedGroupId = null;

function renderGroupForm() {
  if (!currentUser) return;
  document.getElementById("lblBookGroupUserPoints").textContent = currentUser.points;
  
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
        <span class="group-item-points">${session.pointCost} 點</span>
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
  
  if (currentUser.points < session.pointCost) {
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
// 4. 管理後台渲染 (Admin UI Rendering)
// ==========================================

let activeAdminPane = "overview";

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
    "coupons": "btnAdminMenuCoupons"
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
        <td><strong class="text-brass">${u.points}</strong> 點</td>
        <td>
          <div class="action-btn-group">
            <button class="table-action-btn success" onclick="openAdjustPoints(${u.id})">調整點數</button>
          </div>
        </td>
      `;
      container.appendChild(row);
    });
  }
}

// Adjust Points Modal
window.openAdjustPoints = function(memberId) {
  const member = users.find(u => u.id === memberId);
  if (!member) return;
  
  document.getElementById("adjustMemberId").value = member.id;
  document.getElementById("lblAdjustTargetName").textContent = member.name;
  document.getElementById("lblAdjustTargetPoints").textContent = member.points;
  document.getElementById("adjustAmount").value = "";
  document.getElementById("adjustReason").value = "";
  
  navigateTo("admin-points");
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
      const label = b.type === "1on1" ? `1對1 (${b.duration}分鐘)` : "團體頌缽";
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
            <button class="table-action-btn danger" onclick="adminRejectBooking(${b.id})">取消並退點</button>
          </div>
        `;
      }
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span style="font-family:'JetBrains Mono';font-size:11px;">#${b.id}</span></td>
        <td><strong>${memberName}</strong></td>
        <td>${label}</td>
        <td>${timeDetail}</td>
        <td>${b.cost} 點</td>
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
  alert("預約已確認！");
  renderAdminDashboard(activeAdminPane);
};

window.adminRejectBooking = function(bookingId) {
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return;
  
  const actionText = booking.status === "已確認" ? "取消該預約" : "拒絕該預約申請";
  if (confirm(`確認要${actionText}嗎？\n會員的預約點數將自動全額退還。`)) {
    // 1. Update Booking
    booking.status = "已取消";
    dbSet("bookings", bookings);
    
    // 2. Refund user points
    const member = users.find(u => u.id === booking.userId);
    if (member) {
      member.points += booking.cost;
      dbSet("users", users);
      
      // 3. Log points
      const newTxId = transactions.length > 0 ? transactions[transactions.length - 1].id + 1 : 5001;
      const nowStr = getNowDateTimeString();
      transactions.push({
        id: newTxId,
        userId: member.id,
        amount: booking.cost,
        type: "add",
        reason: `${booking.status === "已確認" ? "管理員取消退款" : "預約被拒退款"}：ID ${booking.id}`,
        date: nowStr,
        balance: member.points
      });
      dbSet("transactions", transactions);
    }
    
    alert("已成功處理，點數已全額退還給會員。");
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
    opt.textContent = `${u.name} (剩餘: ${u.points}點)`;
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


// ==========================================
// 5. 事件監聽設定 (Event Listeners & Form Submissions)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  
  // 1. Navigation click bindings
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
    
    // Save users list
    dbSet("users", users);
    
    // Update local variables
    document.getElementById("headerUserName").textContent = currentUser.name;
    
    alert("個人資料已更新！");
    navigateTo("member");
  });
  
  document.getElementById("btnCancelEditProfile").addEventListener("click", () => navigateTo("member"));

  // Form: 1-on-1 Duration change
  document.getElementById("book1on1Duration").addEventListener("change", update1on1Cost);
  document.getElementById("btnCancel1on1").addEventListener("click", () => navigateTo("member"));
  
  // Submit: 1-on-1 reservation
  document.getElementById("formBook1on1").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const duration = parseInt(document.getElementById("book1on1Duration").value);
    const costMap = { "30": 3, "60": 6, "90": 9, "120": 12 };
    const cost = costMap[duration] || 6;
    
    if (currentUser.points < cost) {
      alert("點數不足，請購買點數後再進行預約。");
      return;
    }
    
    const date = document.getElementById("book1on1Date").value;
    const time = document.getElementById("book1on1Time").value;
    const notes = document.getElementById("book1on1Notes").value;
    
    // 1. Create booking entry
    const newBookingId = bookings.length > 0 ? bookings[bookings.length - 1].id + 1 : 1001;
    const timestamp = getNowDateTimeString();
    
    const newBooking = {
      id: newBookingId,
      userId: currentUser.id,
      type: "1on1",
      date: date,
      time: time,
      duration: duration,
      cost: cost,
      notes: notes,
      status: "待確認",
      timestamp: timestamp
    };
    
    bookings.push(newBooking);
    dbSet("bookings", bookings);
    
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
      reason: `預約 1 對 1 身心整合 (${duration}分鐘)`,
      date: timestamp,
      balance: currentUser.points
    });
    dbSet("transactions", transactions);
    
    alert("預約申請已提交，點數已暫扣，請等待管理員確認。");
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
    
    if (currentUser.points < session.pointCost) {
      alert("點數不足，請購買點數後再進行報名。");
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
    currentUser.points -= session.pointCost;
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
      balance: currentUser.points
    });
    dbSet("transactions", transactions);
    
    alert(`報名成功！已扣除 ${session.pointCost} 點。\n期待與您共同體驗頌缽的頻率。`);
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
      document.getElementById("formRegisterProfile").dataset.tempEmail = email;
      navigateTo("register");
    }
  });

  // Form: Complete Profile submission (Registration)
  document.getElementById("formRegisterProfile").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const regForm = document.getElementById("formRegisterProfile");
    const email = regForm.dataset.tempEmail || "temp@user.com";
    const lineUserId = regForm.dataset.lineUserId || null;
    const name = document.getElementById("regName").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const gender = document.querySelector('input[name="regGender"]:checked').value;
    
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
      points: 50, // Default gift 50 points to new users
      joinDate: dateStr,
      lineUserId: lineUserId
    };
    
    users.push(newUser);
    dbSet("users", users);
    
    // Log registration points gift
    const timestamp = getNowDateTimeString();
    const newTxId = transactions.length > 0 ? transactions[transactions.length - 1].id + 1 : 5001;
    transactions.push({
      id: newTxId,
      userId: newUser.id,
      amount: 50,
      type: "add",
      reason: "註冊成為缽日會員贈禮",
      date: timestamp,
      balance: 50
    });
    dbSet("transactions", transactions);
    
    // Automatically issue a coupon
    const nextCpnId = vouchers.length > 0 ? vouchers[vouchers.length - 1].id + 1 : 1;
    vouchers.push({
      id: nextCpnId,
      userId: newUser.id,
      name: "新會員優惠",
      bonusPoints: 50,
      status: "used", // points already processed above
      code: "NEW50"
    });
    dbSet("vouchers", vouchers);
    
    // Set Login state
    currentUser = newUser;
    localStorage.setItem("singbowl_current_user_id", currentUser.id);
    onUserLoginSuccess();
    
    alert(`恭喜您註冊成功！我們已發放新會員禮 50 點預約點數給您 🎵`);
  });

  // Admin Sidebar Nav bindings
  document.getElementById("btnAdminMenuOverview").addEventListener("click", () => renderAdminDashboard("overview"));
  document.getElementById("btnAdminMenuMembers").addEventListener("click", () => renderAdminDashboard("members"));
  document.getElementById("btnAdminMenuBookings").addEventListener("click", () => renderAdminDashboard("bookings"));
  document.getElementById("btnAdminMenuCoupons").addEventListener("click", () => renderAdminDashboard("coupons"));
  document.getElementById("btnAdminBackToMember").addEventListener("click", () => navigateTo("member"));

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
    const adjustType = document.querySelector('input[name="adjustType"]:checked').value;
    const amount = parseInt(document.getElementById("adjustAmount").value);
    const reason = document.getElementById("adjustReason").value.trim();
    
    const member = users.find(u => u.id === targetUserId);
    if (!member) return;
    
    const timestamp = getNowDateTimeString();
    const newTxId = transactions.length > 0 ? transactions[transactions.length - 1].id + 1 : 5001;
    
    if (adjustType === "add") {
      member.points += amount;
      transactions.push({
        id: newTxId,
        userId: member.id,
        amount: amount,
        type: "add",
        reason: `管理員調整：${reason}`,
        date: timestamp,
        balance: member.points
      });
    } else {
      // prevent negative points
      member.points = Math.max(0, member.points - amount);
      transactions.push({
        id: newTxId,
        userId: member.id,
        amount: amount,
        type: "deduct",
        reason: `管理員扣除：${reason}`,
        date: timestamp,
        balance: member.points
      });
    }
    
    dbSet("users", users);
    dbSet("transactions", transactions);
    
    alert(`成功更新會員「${member.name}」的點數！目前餘額：${member.points} 點。`);
    renderAdminDashboard("members");
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
    member.points += bonus;
    dbSet("users", users);
    
    // Log points transaction
    const timestamp = getNowDateTimeString();
    const newTxId = transactions.length > 0 ? transactions[transactions.length - 1].id + 1 : 5001;
    transactions.push({
      id: newTxId,
      userId: member.id,
      amount: bonus,
      type: "add",
      reason: `獲贈票券優惠點數 (${couponName})`,
      date: timestamp,
      balance: member.points
    });
    dbSet("transactions", transactions);
    
    alert(`已成功發放「${couponName}」票券並贈送 ${bonus} 點給會員「${member.name}」！`);
    renderAdminDashboard("coupons");
  });

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
      
      const regForm = document.getElementById("formRegisterProfile");
      regForm.dataset.tempEmail = lineEmail;
      regForm.dataset.lineUserId = lineUserId;
      regForm.dataset.lineName = lineName;
      
      navigateTo("register");
      alert("請填寫您的基本聯絡資料，即可完成 LINE 帳號綁定並領取 50 點會員禮！");
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
    
    const regForm = document.getElementById("formRegisterProfile");
    regForm.dataset.tempEmail = mockEmail;
    regForm.dataset.lineUserId = "";
    
    navigateTo("register");
  }
}

// 從雲端資料庫 (kvdb.io) 讀取最新狀態並同步
async function fetchCloudData() {
  try {
    const response = await fetch(BLOB_URL);
    if (response.status === 404) {
      console.log("雲端資料庫尚未初始化，正在寫入預設資料...");
      pushCloudData();
      return;
    }
    if (!response.ok) throw new Error("讀取雲端資料庫失敗");
    const cloudData = await response.json();
    
    if (cloudData) {
      if (cloudData.users) { users = cloudData.users; dbSet("users", users, false); }
      if (cloudData.bookings) { bookings = cloudData.bookings; dbSet("bookings", bookings, false); }
      if (cloudData.vouchers) { vouchers = cloudData.vouchers; dbSet("vouchers", vouchers, false); }
      if (cloudData.groupSessions) { groupSessions = cloudData.groupSessions; dbSet("groupSessions", groupSessions, false); }
      if (cloudData.transactions) { transactions = cloudData.transactions; dbSet("transactions", transactions, false); }
      
      console.log("雲端資料同步完成！");
      
      // 更新當前使用者狀態並重新渲染 UI
      const savedUserId = localStorage.getItem("singbowl_current_user_id");
      if (savedUserId) {
        const updatedUser = users.find(u => u.id === parseInt(savedUserId));
        if (updatedUser) {
          currentUser = updatedUser;
          if (currentUser.role === "admin") {
            renderAdminDashboard(activeAdminPane);
          } else {
            renderDashboard();
          }
        } else {
          // 找不到此用戶（如資料庫重建），強制登出並清除無效的本地 Session
          currentUser = null;
          localStorage.removeItem("singbowl_current_user_id");
          onUserLogoutSuccess();
        }
      }
    }
  } catch (err) {
    console.error("雲端讀取錯誤:", err);
  }
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
      transactions
    };
    try {
      const response = await fetch(BLOB_URL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("寫入雲端資料庫失敗");
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
