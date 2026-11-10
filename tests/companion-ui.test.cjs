const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
// Install jsdom in a separate test runtime; no production dependency.
const {JSDOM}=require(process.env.BORI_TEST_MODULES?path.join(process.env.BORI_TEST_MODULES,'jsdom'):'jsdom');
const root=path.join(__dirname,'..');
function setup({grant=true}={}) {
 const dom=new JSDOM(fs.readFileSync(root+'/member/index.html','utf8'),{url:'https://example.test/member/',runScripts:'outside-only'});const w=dom.window;
 const store={companionAdmins:{owner:grant},users:{memberA:{id:1,name:'測試甲',role:'member'},memberB:{id:2,name:'測試乙',role:'member'}},bookings:{one:{id:1,userId:1,firebaseUid:'memberA',date:'2026-11-10',time:'14:00',type:'1on1',status:'已確認'}},companionRecords:{}};
 const callbacks=new Map();let counter=0,rejectWrite=false;
 function value(p){if(p==='.info/connected')return true;return p.split('/').reduce((v,k)=>v?.[k],store)??null;}
 function snapshot(p){return {val:()=>structuredClone(value(p))};}
 function emit(p){for(const [key,set]of callbacks)if(p===key||p.startsWith(key+'/'))for(const cb of [...set])cb(snapshot(key));}
 const database={ref(p){return {on(type,cb){if(!callbacks.has(p))callbacks.set(p,new Set());callbacks.get(p).add(cb);cb(snapshot(p));},off(type,cb){callbacks.get(p)?.delete(cb);},push(){return {key:'new-'+(++counter)}},async transaction(fn){if(rejectWrite)throw Error('PERMISSION_DENIED');const next=fn(value(p));if(!next)return {committed:false,snapshot:snapshot(p)};const parts=p.split('/');let parent=store;for(const part of parts.slice(0,-1))parent=parent[part]??={};parent[parts.at(-1)]=structuredClone(next);emit(p);return {committed:true,snapshot:snapshot(p)};}}}};
 Object.assign(w,{database,auth:{currentUser:{uid:'owner'},onAuthStateChanged(cb){/* production callback tested via stop */}},currentUser:{id:0,role:'admin'},firebase:{database:{ServerValue:{TIMESTAMP:1234}}},navigateTo(){},renderAdminDashboard(){w.BoriCompanion?.render()},confirm(){return true}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
 w.eval(fs.readFileSync(root+'/member/companion-core.js','utf8'));w.eval(fs.readFileSync(root+'/member/companion.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.BoriCompanion.start();
 const el=id=>w.document.getElementById(id), button=label=>[...el('companionList').querySelectorAll('button')].find(b=>b.textContent===label);
 async function submit(){el('companionForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));}
 return {dom,w,store,el,button,submit,emit,setReject(v){rejectWrite=v}};
}
test('UI: booking link, save, reopen, follow, feedback, archive/restore, logout cleanup',async()=>{const x=setup();try{
 x.w.BoriCompanion.openForBooking(1);const f=x.el('companionForm');assert.equal(f.elements.memberKey.value,'memberA');assert.equal(f.elements.memberKey.disabled,true);
 f.elements.before.value='原本的困惑';f.elements.after.value='一個小步驟';f.elements.feedback.value='<img src=x onerror=alert(1)> 放鬆';f.elements.tags.value='放鬆，放鬆';f.elements.followDate.value='2026-11-09';f.elements.status.value='已完成';await x.submit();
 assert.equal(x.store.companionRecords['new-1'].bookingId,'one');assert.equal(x.store.bookings.one.status,'已確認');assert.equal(x.el('companionDialog').open,false);assert.equal(x.el('companionList').querySelector('img'),null);assert.match(x.el('companionList').textContent,/原本的困惑/);
 x.w.BoriCompanion.openForBooking(1);assert.equal(f.elements.after.value,'一個小步驟');x.el('companionClose').click();
 x.button('完成關心').click();await new Promise(r=>setImmediate(r));assert.equal(x.store.companionRecords['new-1'].followDone,true);
 x.w.document.querySelector('[data-companion-mode="feedback"]').click();assert.match(x.el('companionTags').textContent,/放鬆 · 1 次/);
 x.button('封存').click();await new Promise(r=>setImmediate(r));assert.equal(x.store.companionRecords['new-1'].archived,true);
 x.w.document.querySelector('[data-companion-mode="archive"]').click();x.button('還原紀錄').click();await new Promise(r=>setImmediate(r));assert.equal(x.store.companionRecords['new-1'].archived,false);
 assert.equal(x.w.localStorage.length,0);x.w.BoriCompanion.stop();assert.equal(x.el('companionList').textContent,'');assert.equal(f.elements.after.value,'');
 }finally{x.dom.window.close();}});
test('UI: rejected cloud save keeps typed notes and does not report success',async()=>{const x=setup();try{x.w.BoriCompanion.openForBooking(1);x.el('companionForm').elements.before.value='保留內容';x.setReject(true);await x.submit();assert.equal(x.el('companionForm').elements.before.value,'保留內容');assert.equal(x.el('companionDialog').open,true);assert.match(x.el('companionFormMessage').textContent,/拒絕儲存/);assert.deepEqual(x.store.companionRecords,{});}finally{x.dom.window.close();}});
test('UI: missing grant disables creation and never loads private records',()=>{const x=setup({grant:false});try{assert.equal(x.el('companionSetup').hidden,false);assert.equal(x.el('companionNew').disabled,true);assert.equal(x.el('companionList').textContent,'');}finally{x.dom.window.close();}});
test('UI: stale edit cannot overwrite newer saved content',async()=>{const x=setup();try{x.w.BoriCompanion.openForBooking(1);await x.submit();x.w.BoriCompanion.openForBooking(1);x.store.companionRecords['new-1'].revision=2;x.store.companionRecords['new-1'].after='另一裝置';x.el('companionForm').elements.after.value='舊視窗';await x.submit();assert.match(x.el('companionFormMessage').textContent,/較新版本/);assert.equal(x.store.companionRecords['new-1'].after,'另一裝置');}finally{x.dom.window.close();}});
