/* ---------- cloud saving (everything is encrypted in this browser before it leaves) ---------- */
var locked=true;                 // true until a vault has been unlocked
var sb=null;                     // supabase client
var vsync=null;                  // PMVault.VaultSync for the signed-in user
var authUser=null;               // {id,email}
var syncState='idle',lastSavedAt=0,lastPushedJSON='',saveTimer=null,pushing=false,again=false,pushPromise=Promise.resolve(),retryTimer=null;

function snapshot(){
  return {app:'nodle',version:3,typesV:2,
    people:S.people.map(function(p){var o={id:p.id,name:p.name,code:p.code,note:p.note,group:p.group,rating:p.rating,offers:p.offers,needs:p.needs,x:Math.round(p.x),y:Math.round(p.y),pinned:p.pinned,
      lastTalked:p.lastTalked,bday:p.bday,dates:p.dates,likes:p.likes,gifts:p.gifts,ideas:p.ideas,metBy:p.metBy,metHow:p.metHow,metDate:p.metDate,events:p.events};
      if(!p.isMe)o.character=charOf(p);return o}),
    links:S.links,types:S.types,hidden:S.hidden,hiddenRatings:S.hiddenRatings,ratingLabels:S.ratingLabels,favours:S.favours,lastBackup:S.lastBackup,
    customFlags:S.customFlags,showRisk:S.showRisk,circleFrom:S.circleFrom,hideSens:S.hideSens};
}
function setSync(st){
  syncState=st;if(st==='saved')lastSavedAt=Date.now();
  var l=$('#lockbadge');if(!l)return;
  var txt={idle:'CLOUD · ENCRYPTED',saved:'CLOUD · SAVED · ENCRYPTED',saving:'CLOUD · SAVING…',dirty:'CLOUD · SAVING…',offline:'!! OFFLINE · NOT SAVED · RETRYING',conflict:'!! CHANGED ON ANOTHER DEVICE'}[st]||'';
  l.textContent=txt;l.classList.toggle('bad',st==='offline'||st==='conflict');
  l.title=st==='saved'?'Saved to the cloud, scrambled so only your passphrase opens it. Press to see details.':st==='offline'?'Could not reach the cloud. Your changes stay in this tab and are retried automatically. Do not close the tab.':'Everything is encrypted in this browser before it is sent.';
}
function save(){
  if(locked)return;
  clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,700);
}
function saveNow(){
  clearTimeout(saveTimer);
  if(locked||!vsync||!vsync.hasKey())return Promise.resolve();
  if(syncState==='conflict')return Promise.resolve();
  if(pushing){again=true;return pushPromise}
  var snap=snapshot(),js=JSON.stringify(snap);
  if(js===lastPushedJSON)return Promise.resolve();
  pushing=true;setSync('saving');
  pushPromise=vsync.push(snap).then(function(r){
    pushing=false;
    if(r.status==='ok'){lastPushedJSON=js;setSync('saved');clearTimeout(retryTimer);if(again){again=false;return saveNow()}}
    else if(r.status==='conflict'){again=false;setSync('conflict');showConflict()}
    else{again=false;setSync('offline');clearTimeout(retryTimer);retryTimer=setTimeout(saveNow,15000)}
  });
  return pushPromise;
}
window.addEventListener('online',function(){if(syncState==='offline')saveNow()});

/* someone else (another device) saved a newer version */
function showConflict(){
  if(!locked&&modalOpen())closeModal();
  var msg=h('div',{id:'conflictmsg'},
    h('div',{class:'warnbox'},'Another device saved changes to your map after you opened it here. Nothing has been overwritten yet. Choose what to keep.'),
    h('div',{class:'muted',style:'margin:8px 0'},'"Use the other version" loads what the other device saved (changes you made here since then are lost). "Keep mine" replaces the other device\'s changes with what you see here.'),
    h('div',{id:'conflicterr',class:'fl',style:'min-height:18px;font-size:13px'}));
  var errEl=function(t){var e=$('#conflicterr');if(e)e.textContent=t};
  var foot=[h('button',{id:'cfdl',onclick:function(){downloadText(JSON.stringify(snapshot(),null,2),'nodle-my-version-'+todayISO()+'.json');errEl('Saved a plain file of your version to your downloads.')}},'Download my version first'),h('span',{class:'grow'}),
    h('button',{id:'cftheirs',onclick:function(){
      errEl('Loading…');
      vsync.pullRemote().then(function(r){
        if(r.status==='keychanged'){closeModal();setSync('idle');lockNow('The passphrase was changed on another device. Unlock again with the new one.');return}
        if(r.status!=='ok'){errEl('Could not load it. Try again.');return}
        vsync.adopt(r);var d=sanitize(r.data);S=d;closeModal();resetLayoutAfterLoad();lastPushedJSON=JSON.stringify(snapshot());setSync('saved');toast('Loaded the other device\'s version');
      },function(){errEl('Could not reach the cloud. Try again.')});
    }},'Use the other version'),
    h('button',{class:'primary',id:'cfmine',onclick:function(){
      errEl('Saving…');
      vsync.overwrite(snapshot()).then(function(r){
        if(r.status==='ok'){lastPushedJSON=JSON.stringify(snapshot());setSync('saved');closeModal();toast('Kept your version')}
        else errEl(r.status==='conflict'?'It changed again. Press once more.':'Could not save. Try again.');
      },function(){errEl('Could not reach the cloud. Try again.')});
    }},'Keep mine')];
  openModal('Changed on another device',msg,foot,{sticky:true,narrow:true});
}

/* quietly pick up changes made on another device when you come back to this tab */
var remoteTimer=null;
function checkRemote(){
  if(locked||!vsync||!vsync.hasKey()||pushing||syncState==='conflict'||syncState==='offline')return;
  vsync.fetchRow().then(function(row){
    if(!row||locked||pushing)return;
    if(row.version<=vsync.version)return;
    if(JSON.stringify(snapshot())!==lastPushedJSON)return;          // I have unsaved edits: the next save will show the conflict dialog
    vsync.pullRemote().then(function(r){
      if(r.status==='keychanged'){lockNow('The passphrase was changed on another device. Unlock again with the new one.');return}
      if(r.status!=='ok'||pushing||locked)return;
      if(JSON.stringify(snapshot())!==lastPushedJSON)return;
      vsync.adopt(r);S=sanitize(r.data);resetLayoutAfterLoad();lastPushedJSON=JSON.stringify(snapshot());toast('Updated from another device');
    });
  },function(){});
}
function startRemoteWatch(){clearInterval(remoteTimer);remoteTimer=setInterval(checkRemote,60000)}
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden')saveNow();else checkRemote();
});
window.addEventListener('pagehide',function(){saveNow()});
window.addEventListener('beforeunload',function(e){
  if(locked||!vsync||!vsync.hasKey())return;
  if(pushing||syncState==='offline'||syncState==='conflict'||JSON.stringify(snapshot())!==lastPushedJSON){e.preventDefault();e.returnValue='';saveNow()}
});
