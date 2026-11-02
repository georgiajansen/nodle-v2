/* ---------- header stats, clock, ticker ---------- */
function avgChar(){
  var r=S.people.filter(function(p){return !p.isMe&&p.rating>0});
  if(!r.length)return '—';
  return (r.reduce(function(a,p){return a+p.rating},0)/r.length).toFixed(1);
}
function renderStats(){
  var el=$('#stats');if(!el)return;
  el.textContent='';
  var items=[['People',S.people.length-1],['Lines',allLinks().length],['Avg char',avgChar()],['Drifting',driftingList().length],['Bdays 30d',upcomingItems(30).filter(function(x){return x.kind==='Birthday'}).length],['Open favours',openFavourCount()]];
  if(riskVisible()){items.push(['High risk',riskCount(['high'])]);items.push(['Critical',riskCount(['critical'])])}
  items.forEach(function(it){el.append(h('div',{class:'st','data-k':it[0]},h('span',{class:'k'},it[0]),h('span',{class:'v mono num'},String(it[1]))))});
  renderTicker();
}
function renderTicker(){
  var mv=$('#tickmove');if(!mv)return;
  var parts=[],ups=upcomingItems(90).filter(function(x){return x.kind==='Birthday'});
  if(ups.length){var u=ups[0];parts.push('NEXT BDAY '+plainName(u.p).toUpperCase()+' '+(u.days===0?'TODAY':'IN '+u.days+'D'))}
  var dr=driftingList();
  if(dr.length)parts.push('DRIFTING '+dr.slice(0,3).map(function(p){return plainName(p).toUpperCase()+' '+PM.agoShort(daysSince(p))}).join(' · '));
  var lastP=S.people.length>1?S.people[S.people.length-1]:null;
  if(lastP)parts.push('LAST ADDED '+plainName(lastP).toUpperCase()+' '+lastP.code);
  parts.push('OPEN FAVOURS '+openFavourCount());
  if(riskVisible()){var hr=riskCount(['high','critical']);if(hr)parts.push('HIGH RISK '+hr)}
  parts.push('/ SEARCH   N NEW   U UPCOMING   F FIT   R RISK   L LOCK   ? HELP');
  var txt=parts.join('   //   ');
  mv.textContent='';
  mv.append(h('span',{},txt+'   //   '),h('span',{},txt+'   //   '));
  var k=$('#keys');if(k&&!k.firstChild){[['/','Search'],['N','New'],['Esc','Close'],['?','Help']].forEach(function(x){k.append(h('span',{},h('span',{class:'kbd'},x[0]),' '+x[1]))})}
}
var clockT=null;
function tickClock(){
  var d=new Date(),c=$('#clock');if(!c)return;
  c.textContent=PM.fmtFull(d.getFullYear(),d.getMonth()+1,d.getDate()).toUpperCase()+'  '+pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds());
}
function startClock(){if(!THEME.terminal||clockT)return;tickClock();clockT=setInterval(tickClock,1000)}

/* ---------- web growth timeline ---------- */
var tlOn=false,tlTimer=null;
function metRange(){
  var nums=S.people.map(function(p){return PM.parseISO(p.metDate)}).filter(Boolean).map(function(q){return q.num});
  if(nums.length<2)return null;
  return {min:Math.min.apply(null,nums),max:Math.max(TN(),Math.max.apply(null,nums))};
}
function syncTimeline(){
  var r=metRange();
  if(!r){tlOn=false;if(timeCut!==null){timeCut=null}}
  $('#timeline').classList.toggle('on',tlOn&&!!r);
}
function setTimeline(v){
  var r=metRange();if(!r)return;
  $('#tlrange').value=String(v);
  if(v>=100){timeCut=null;$('#tllabel').textContent='all time'}
  else{timeCut=r.min+Math.round((r.max-r.min)*v/100);var q=PM.fromDayNum(timeCut);$('#tllabel').textContent=PM.toISO(q.y,q.m,q.d)}
  renderGraph();reheat(.5);
}
function stopPlay(){if(tlTimer){clearInterval(tlTimer);tlTimer=null}$('#tlplay').textContent='Play'}
$('#tlrange').addEventListener('input',function(){stopPlay();setTimeline(+this.value)});
$('#tlplay').onclick=function(){
  if(tlTimer){stopPlay();return}
  var v=0;setTimeline(0);$('#tlplay').textContent='Stop';
  tlTimer=setInterval(function(){v+=2;if(v>=100){v=100;stopPlay()}setTimeline(v)},120);
};
function legendExtras(box){
  if(!metRange())return;
  box.append(h('div',{class:'chip',id:'tlchip',style:'margin-top:6px',onclick:function(){
    tlOn=!tlOn;if(!tlOn){stopPlay();setTimeline(100)}
    syncTimeline();renderLegend()}},h('span',{class:'dot',style:'border-radius:0;height:4px;background:var(--muted)'}),(tlOn?'Hide':'Show')+' web growth slider'));
}

/* ---------- header buttons ---------- */
function resetLayoutAfterLoad(){
  sel=null;query='';$('#search').value='';timeCut=null;tlOn=false;eventSel=[];pathTarget='';pathRes=null;stopPlay();$('#tlrange').value='100';$('#tllabel').textContent='all time';
  S.people.forEach(function(p){p.vx=p.vy=0;if(p.isMe){p.x=0;p.y=0}});
  syncTimeline();
  if(S.people.some(function(p){return !p.isMe&&p.x===0&&p.y===0})){S.people.forEach(function(p,i){if(!p.isMe&&p.x===0&&p.y===0){var a=i*2.4;p.x=Math.cos(a)*200;p.y=Math.sin(a)*200}});settle(500)}
  renderGraph();fitView();renderPanel();renderStats();save();
}
function focusNew(){
  tab='people';sel=null;newOpen=true;applyFocus();renderPanel();
  var i=$('#newname');if(i)i.focus();
}
$('#btnAdd').onclick=focusNew;
$('#btnTidy').onclick=function(){S.people.forEach(function(p){if(!p.isMe)p.pinned=false});renderGraph();reheat(1);toast('Tidying up…')};
$('#btnBackup').onclick=openBackupDialog;
$('#btnLock').onclick=function(){lockNow()};
$('#btnImport').onclick=function(){$('#file').click()};
$('#file').onchange=function(){
  var f=this.files[0];if(!f)return;var inp=this;
  var r=new FileReader();
  r.onload=function(){loadBackupText(r.result);inp.value=''};
  r.readAsText(f);
};
$('#search').addEventListener('input',function(){query=this.value;applyFocus()});
$('#search').addEventListener('keydown',function(e){
  if(e.key==='Enter'&&query.trim()){
    var q=query.trim().toLowerCase(),m=S.people.filter(function(p){return matchesQuery(p,q)})[0];
    if(m){view.x=-m.x*view.k;view.y=-m.y*view.k;applyView();query='';this.value='';select({kind:'person',id:m.id});this.blur()}
  }else if(e.key==='Escape'){query='';this.value='';applyFocus();this.blur()}
});

/* ---------- keyboard shortcuts ---------- */
function openHelp(){
  var rows=[['/','Search people'],['N','Add a new person'],['U','Open Upcoming'],['F','Fit everyone on screen'],['R','Show or hide risk rings'],['H','Hide risk marks (when someone is looking)'],['L','Lock the map'],['?','This help'],['Esc','Close a window / clear selection']];
  var tb=h('table',{class:'tbl'});
  rows.forEach(function(r){tb.append(h('tr',{},h('td',{},h('span',{class:'kbd'},r[0])),h('td',{},r[1])))});
  openModal('Keyboard shortcuts',h('div',{},tb,h('div',{class:'muted'},'Shortcuts are switched off while you type in a box. Press Esc to leave the box.')),null,{narrow:true});
}
$('#btnHelp').onclick=openHelp;
document.addEventListener('keydown',function(e){
  if(locked||$('#auth').classList.contains('on'))return;
  var t=e.target,typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable);
  if(e.key==='Escape'){
    if(modalOpen()){if(!modalSticky)closeModal();return}
    if(typing){t.blur();return}
    if(sel){select(null);return}
    if(eventSel.length){eventSel=[];applyFocus();if(tab==='events')renderPanel()}
    return;
  }
  if(typing||e.metaKey||e.ctrlKey||e.altKey||modalOpen())return;
  var k=e.key;
  if(k==='/'){e.preventDefault();$('#search').focus()}
  else if(k==='n'||k==='N'){e.preventDefault();focusNew()}
  else if(k==='?'){e.preventDefault();openHelp()}
  else if(k==='f'||k==='F'){fitView()}
  else if(k==='u'||k==='U'){setTab('upcoming')}
  else if(k==='r'||k==='R'){toggleRisk()}
  else if(k==='h'||k==='H'){toggleHide()}
  else if(k==='l'||k==='L'){$('#btnLock').click()}
});

/* ---------- start ---------- */
function startApp(){
  if(S.view&&isFinite(S.view.k)){view=S.view;hadView=true}else hadView=false;
  S.people.forEach(function(p){if(p.isMe){p.x=0;p.y=0}});
  timeCut=null;eventSel=[];pathTarget='';pathRes=null;sel=null;tab='people';
  if(S.people.some(function(p){return !p.isMe&&p.x===0&&p.y===0})){S.people.forEach(function(p,i){if(!p.isMe&&p.x===0&&p.y===0){var a=i*2.4;p.x=Math.cos(a)*200;p.y=Math.sin(a)*200}});settle(500)}
  syncTimeline();
  renderGraph();applyView();
  if(!hadView)fitView();
  renderPanel();renderStats();startClock();
}
