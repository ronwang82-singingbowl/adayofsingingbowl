/* Pure helpers shared by the admin interface and Node tests. No network or storage. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BoriCompanionCore = api;
})(typeof window === 'undefined' ? this : window, function () {
  'use strict';
  const SERVICES = ['深度對談＋頌缽', '一對一深度對談', '頌缽體驗', '團體頌缽', '季度深度陪伴', '生命數字解讀'];
  const STATES = ['待開始', '陪伴中', '已完成', '已取消'];
  const textFields = ['service', 'plan', 'before', 'after', 'feedback', 'tags', 'followNote'];
  function today(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  }
  function validDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }
  function members(raw) {
    return Object.entries(raw || {}).filter(([,u]) => u && typeof u === 'object' && u.role !== 'admin').map(([key,u]) => ({key, id: u.id, name: String(u.name || '未命名會員')}));
  }
  function resolveMember(list, booking) {
    const byUid = list.filter(m => m.key === booking.firebaseUid);
    if (byUid.length === 1) return byUid[0];
    const byId = list.filter(m => String(m.id) === String(booking.userId));
    if (byId.length !== 1) throw new Error('會員編號無法唯一對應，請先在會員管理確認資料，避免記到另一位個案名下');
    return byId[0];
  }
  function tags(value) { return [...new Set(String(value || '').split(/[,，、\n]/).map(t => t.trim()).filter(Boolean))]; }
  function tagCounts(records) {
    const counts = new Map();
    records.filter(r => !r.archived && r.feedback.trim()).forEach(r => tags(r.tags).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
    return [...counts].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
  function filter(records, {memberKey='', date='', query='', mode='history', today: day=today()} = {}) {
    return records.filter(r => (mode === 'archive' ? r.archived : !r.archived) && (!memberKey || r.memberKey === memberKey) && (!date || r.date === date) && (!query || [r.memberName, ...textFields.map(k=>r[k])].join('\n').toLowerCase().includes(query.toLowerCase())) && (mode !== 'follow' || (r.followDate && !r.followDone && r.status !== '已取消')) && (mode !== 'feedback' || r.feedback.trim())).sort((a,b) => mode === 'follow' ? a.followDate.localeCompare(b.followDate) : (b.date+b.time).localeCompare(a.date+a.time));
  }
  function draft(input) {
    const out = {};
    for (const k of textFields) {
      if (typeof input[k] !== 'string') throw new Error('欄位格式不正確');
      out[k] = input[k].trim();
      if (out[k].length > (['service','plan','tags'].includes(k) ? 300 : 10000)) throw new Error('文字超過欄位長度限制');
    }
    if (!out.service) throw new Error('請填寫服務類型');
    if (!validDate(input.date) || (input.followDate && !validDate(input.followDate))) throw new Error('請填寫有效日期');
    if (input.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error('時間格式不正確');
    if (!STATES.includes(input.status)) throw new Error('請選擇服務進度');
    return {...out,date:input.date,time:input.time,status:input.status,followDate:input.followDate,followDone:!!input.followDone,archived:!!input.archived};
  }
  function nextRevision(current, expected, record) {
    // Firebase can first invoke a transaction with an empty local cache. Send the
    // expected revision; server rules enforce +1 and a retry compares actual data.
    if (current && current.revision !== expected) return;
    return {...record,revision:expected+1};
  }
  return {SERVICES,STATES,today,validDate,members,resolveMember,tags,tagCounts,filter,draft,nextRevision};
});
