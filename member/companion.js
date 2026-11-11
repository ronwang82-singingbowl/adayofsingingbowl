/* Administrator-only companion journal. Uses separate Firebase paths; never dbSet/localStorage. */
(function () {
  'use strict';
  const C = window.BoriCompanionCore;
  let owner = '', generation = 0, allowed = false, ready = false, connected = false;
  let records = [], memberList = [], bookingList = [], listeners = [], privateListeners = [];
  let mode = 'history', memberKey = '', pending = null, editor = null, dirty = false, saving = false;
  const $ = id => document.getElementById(id);
  const escText = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const choiceContainers = {before:'companionBeforeChoices',after:'companionAfterChoices',tags:'companionFeelingChoices'};
  function fillChoices(kind, selected) {
    const container=$(choiceContainers[kind]);container.replaceChildren();
    for(const value of new Set([...C.CHOICES[kind],...selected])) {
      const label=document.createElement('label');label.className='companion-choice';
      const input=document.createElement('input');input.type='checkbox';input.name=kind+'Choice';input.value=value;input.checked=selected.includes(value);
      const caption=document.createElement('span');caption.textContent=value;label.append(input,caption);container.append(label);
    }
  }
  function selectedChoices(kind) { return [...$(choiceContainers[kind]).querySelectorAll('input:checked')].map(input=>input.value); }
  function noteHtml(value) {
    const note=C.splitNote(value);
    return (note.selected.length?'<div class="companion-note-chips">'+note.selected.map(s=>'<span>'+escText(s)+'</span>').join('')+'</div>':'') + (note.extra?'<p>'+escText(note.extra)+'</p>':note.selected.length?'':'<p>尚未記錄</p>');
  }
  function message(text, error=false) { const el=$('companionMessage'); el.textContent=text; el.setAttribute('role',error?'alert':'status'); el.classList.toggle('is-error',error); }
  function detach(list) { list.splice(0).forEach(([ref,cb]) => ref.off('value',cb)); }
  function watch(ref, cb, list, onError) { ref.on('value',cb,onError); list.push([ref,cb]); }
  function authorized() { return allowed && owner && auth.currentUser?.uid === owner && currentUser?.role === 'admin'; }
  function hideEditor() { $('companionDialog').close(); $('companionForm').reset(); editor=null; dirty=false; }
  function clearPrivate() { detach(privateListeners); records=[];memberList=[];bookingList=[];ready=false; pending=null; hideEditor(); $('companionList').replaceChildren(); $('companionTags').replaceChildren(); }
  function stop() { generation++; detach(listeners); clearPrivate(); owner='';allowed=false;connected=false; updateControls(); }
  function start() {
    if (!auth.currentUser || currentUser?.role !== 'admin') { stop(); return; }
    if (owner === auth.currentUser.uid && listeners.length) return;
    stop(); owner=auth.currentUser.uid; const token=generation;
    message('正在確認私人紀錄存取權限…');
    watch(database.ref('.info/connected'), snap=>{if(token!==generation)return;connected=snap.val()===true;updateControls();},listeners);
    watch(database.ref('companionAdmins/'+owner), snap=>{
      if(token!==generation)return;
      const grant=snap.val()===true;
      if(grant===allowed) {if(!grant)showSetup();return;}
      allowed=grant;
      if(!grant){clearPrivate();showSetup();return;}
      $('companionSetup').hidden=true;
      let loaded=new Set();
      function done(key){loaded.add(key);ready=loaded.size===3;if(ready){message('私人紀錄已載入・追蹤日期以台灣時間顯示');if(pending){const p=pending;pending=null;p();}}render();updateControls();}
      function failed(){if(token!==generation)return;allowed=false;clearPrivate();showSetup();}
      watch(database.ref('users'),snap=>{if(token!==generation||!allowed)return;memberList=C.members(snap.val());done('members');},privateListeners,failed);
      watch(database.ref('bookings'),snap=>{if(token!==generation||!allowed)return;bookingList=Object.entries(snap.val()||{}).filter(([,b])=>b).map(([key,b])=>({...b,key}));done('bookings');},privateListeners,failed);
      watch(database.ref('companionRecords'),snap=>{if(token!==generation||!allowed)return;records=Object.entries(snap.val()||{}).map(([id,r])=>({...r,id}));done('records');},privateListeners,failed);
    },listeners,()=>{if(token!==generation)return;allowed=false;clearPrivate();showSetup();});
  }
  function showSetup(){ $('companionSetup').hidden=false; $('companionUid').textContent=owner;message('私人紀錄尚未啟用，或目前帳號沒有權限。原有會員與預約功能可繼續使用。',true);updateControls(); }
  function updateControls(){
    for(const id of ['companionNew','companionExport']) $(id).disabled=!authorized()||!ready;
    $('companionSave').disabled=!authorized()||!ready||!connected||saving;
    $('companionSave').textContent=saving?'等待雲端確認…':connected?'儲存紀錄':'離線中，請保留視窗';
    $('companionConnection').textContent=connected?'已連線':'連線中斷・暫停儲存';
  }
  function openPane(){navigateTo('admin');renderAdminDashboard('companion');start();}
  function afterReady(fn){openPane();if(authorized()&&ready)fn();else pending=fn;}
  function openForMember(id){afterReady(()=>{const matches=memberList.filter(m=>String(m.id)===String(id));if(matches.length!==1){message('會員編號重複或不存在，請先確認會員資料',true);return;} memberKey=matches[0].key;mode='history';$('companionQuery').value='';$('companionDate').value='';render();});}
  function openForBooking(id){afterReady(()=>{try{const matches=bookingList.filter(b=>String(b.id)===String(id));if(matches.length!==1)throw Error('預約不存在或編號重複，請重新整理後確認');const b=matches[0],m=C.resolveMember(memberList,b);memberKey=m.key;const existing=records.find(r=>r.bookingId===b.key);edit(existing||null,b); }catch(e){message(e.message,true);}});}
  function render(){
    if(!authorized()){updateControls();return;}
    const filter=$('companionMember');filter.replaceChildren(new Option('所有個案',''));
    memberList.forEach(m=>filter.add(new Option(m.name+' · #'+m.id,m.key)));
    if(memberKey&&!memberList.some(m=>m.key===memberKey)){filter.add(new Option('已移除會員的歷程',memberKey));}filter.value=memberKey;
    document.querySelectorAll('[data-companion-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.companionMode===mode);b.setAttribute('aria-pressed',String(b.dataset.companionMode===mode));});
    const rows=C.filter(records,{memberKey,query:$('companionQuery').value.trim(),date:$('companionDate').value,mode});
    const due=records.filter(r=>!r.archived&&r.followDate&&!r.followDone&&r.status!=='已取消'&&r.followDate<=C.today());
    $('companionDueCount').textContent=String(due.length);
    $('companionList').replaceChildren();
    if(!rows.length){const p=document.createElement('p');p.className='companion-empty';p.textContent=ready?'目前沒有符合條件的紀錄。可以選一位會員，留下第一段陪伴。':'正在載入…';$('companionList').append(p);}
    rows.forEach(r=>{
      const card=document.createElement('article');card.className='companion-card';
      const member=memberList.find(m=>m.key===r.memberKey);
      card.innerHTML=`<div class="companion-card-head"><div><small>${escText(r.date)} ${escText(r.time)} ${r.bookingId?'・預約 #'+escText(r.bookingId):'・獨立服務紀錄'}</small><h3>${escText(member?.name||r.memberName)} <span>${escText(r.service)}</span></h3></div><span class="companion-badge">${escText(r.status)}</span></div>${r.plan?'<p class="companion-plan">陪伴方案：'+escText(r.plan)+'</p>':''}<div class="companion-notes">${[['對談前',r.before],['對談後與下一步',r.after],['體驗回饋',r.feedback]].map(([label,value])=>`<section><h4>${label}</h4>${label==='體驗回饋'?'<p>'+escText(value||'尚未記錄')+'</p>':noteHtml(value)}</section>`).join('')}</div><p class="companion-tagline">${C.tags(r.tags).map(t=>'<span>'+escText(t)+'</span>').join('')}</p>${r.followDate?`<p class="companion-follow">${r.followDone?'✓ 已完成關心':r.followDate<=C.today()?'待關心':'預定關心'} · ${escText(r.followDate)}<br>${escText(r.followNote)}</p>`:''}<div class="companion-card-actions"></div>`;
      const actions=card.querySelector('.companion-card-actions');
      function button(label,fn){const el=document.createElement('button');el.type='button';el.className='table-action-btn secondary';el.textContent=label;el.onclick=fn;actions.append(el);}
      button('查看／編輯',()=>edit(r));
      if(r.followDate&&!r.archived)button(r.followDone?'重新開啟追蹤':'完成關心',()=>persist(r,{...r,followDone:!r.followDone}));
      button(r.archived?'還原紀錄':'封存',()=>persist(r,{...r,archived:!r.archived}));
      $('companionList').append(card);
    });
    $('companionTags').replaceChildren();
    if(mode==='feedback') C.tagCounts(C.filter(records,{memberKey,date:$('companionDate').value})).forEach(([tag,n])=>{const b=document.createElement('button');b.type='button';b.textContent=tag+' · '+n+' 次';b.onclick=()=>{$('companionQuery').value=tag;render();};$('companionTags').append(b);});
    updateControls();
  }
  function edit(record=null,booking=null){
    if(!authorized()||!ready)return;
    const form=$('companionForm');form.reset();dirty=false;
    const initial=record?{...record}:{id:database.ref('companionRecords').push().key,revision:0,memberKey,bookingId:booking?.key||'',date:booking?.date||C.today(),time:booking?.time||'',service:booking?.type==='group'?'團體頌缽':'深度對談＋頌缽',plan:'',status:'待開始',before:'',after:'',feedback:'',tags:'',followDate:'',followNote:'',followDone:false,archived:false};
    if(booking)initial.memberKey=C.resolveMember(memberList,booking).key;
    editor=initial;
    const sel=form.elements.memberKey;sel.replaceChildren(new Option('請選擇會員',''));memberList.forEach(m=>sel.add(new Option(m.name+' · #'+m.id,m.key)));
    if(initial.memberKey&&!memberList.some(m=>m.key===initial.memberKey))sel.add(new Option(initial.memberName+'（已移除會員）',initial.memberKey));
    ['memberKey','date','time','service','plan','status','feedback','followDate','followNote'].forEach(k=>form.elements[k].value=initial[k]||'');
    for(const kind of ['before','after']) { const note=C.splitNote(initial[kind]);fillChoices(kind,note.selected);form.elements[kind].value=note.extra; }
    const feelings=C.tags(initial.tags);fillChoices('tags',feelings.filter(tag=>C.CHOICES.tags.includes(tag)));form.elements.tags.value=feelings.filter(tag=>!C.CHOICES.tags.includes(tag)).join('、');
    form.elements.followDone.checked=initial.followDone;sel.disabled=!!record||!!booking;
    $('companionBookingInfo').textContent=initial.bookingId?'連結預約 #'+initial.bookingId+' · 個案紀錄進度不會更動預約狀態或扣點':'獨立服務紀錄・不會新增預約或扣點';
    $('companionFormMessage').textContent='';updateControls();$('companionDialog').showModal();sel.focus();
  }
  async function persist(base, values, fromEditor=false){
    if(!authorized()||!ready||!connected||saving){message('請確認已連線且私人紀錄已載入',true);return;}
    const session=generation, uid=owner;let committedRecord;
    try{
      const clean=C.draft(values);
      const member=memberList.find(m=>m.key===values.memberKey);
      if(!base.revision&&!member)throw Error('請選擇現有會員');
      if(base.revision&&values.memberKey!==base.memberKey)throw Error('已建立的紀錄不可改掛會員');
      const payload={...clean,memberKey:values.memberKey,memberId:String(base.revision?base.memberId:member.id),memberName:base.revision?base.memberName:member.name,bookingId:base.bookingId||'',createdAt:base.createdAt||firebase.database.ServerValue.TIMESTAMP,createdBy:base.createdBy||uid,updatedAt:firebase.database.ServerValue.TIMESTAMP,updatedBy:uid};
      saving=true;updateControls();if(fromEditor)$('companionFormMessage').textContent='正在等待雲端確認，請先保留此視窗…';
      const result=await database.ref('companionRecords/'+base.id).transaction(current=>C.nextRevision(current,base.revision||0,payload),undefined,false);
      if(!result.committed)throw Error('這筆紀錄已有較新版本，未覆蓋雲端資料。請先複製本次文字，再關閉並重新開啟紀錄');
      committedRecord=result.snapshot.val();
      if(session!==generation||auth.currentUser?.uid!==uid)return;
      records=[...records.filter(r=>r.id!==base.id),{...committedRecord,id:base.id}];
      if(fromEditor)hideEditor();message('已確認儲存至雲端');render();
    }catch(e){if(session!==generation)return;const text=/permission|denied/i.test(e.message||'')?'雲端拒絕儲存，請確認私人紀錄權限；本次內容仍保留在表單':e.message||'儲存失敗，請重試';if(fromEditor)$('companionFormMessage').textContent=text;else message(text,true);}
    finally{saving=false;updateControls();}
  }
  function close(){if(saving)return;if(dirty&&!confirm('這次修改尚未儲存，要放棄修改嗎？'))return;hideEditor();}
  function init(){
    $('btnAdminMenuCompanion').onclick=()=>{openPane();render();};
    $('companionNew').onclick=()=>edit();
    $('companionMember').onchange=e=>{memberKey=e.target.value;render();};
    $('companionQuery').oninput=render;$('companionDate').onchange=render;
    $('companionReset').onclick=()=>{memberKey='';$('companionQuery').value='';$('companionDate').value='';render();};
    document.querySelectorAll('[data-companion-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.companionMode;render();});
    $('companionClose').onclick=close;$('companionDialog').addEventListener('cancel',e=>{e.preventDefault();close();});
    $('companionForm').oninput=()=>{dirty=true;};
    $('companionForm').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;if(!f.reportValidity()||!editor)return;const values={...editor};['memberKey','date','time','service','plan','status','feedback','followDate','followNote'].forEach(k=>values[k]=f.elements[k].value);for(const kind of ['before','after'])values[kind]=C.joinNote(selectedChoices(kind),f.elements[kind].value);values.tags=C.tags([...selectedChoices('tags'),...C.tags(f.elements.tags.value)].join('、')).join('、');values.followDone=f.elements.followDone.checked;if(values.followDate!==editor.followDate)values.followDone=false;persist(editor,values,true);};
    $('companionRetry').onclick=()=>{stop();start();};
    $('companionExport').onclick=()=>{if(!authorized()||!ready)return;const url=URL.createObjectURL(new Blob([JSON.stringify({format:'bori-companion',version:1,exportedAt:new Date().toISOString(),records},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='BORI-私人陪伴紀錄-'+C.today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    window.addEventListener('beforeunload',e=>{if(dirty||saving){e.preventDefault();e.returnValue='';}});
    auth.onAuthStateChanged(u=>{if(!u||u.uid!==owner)stop();});
    C.SERVICES.forEach(s=>$('companionServiceOptions').append(new Option(s,s)));
    updateControls();
  }
  window.BoriCompanion={start,stop,render,openForMember,openForBooking};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
