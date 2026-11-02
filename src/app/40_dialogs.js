/* ---------- modal ---------- */
var modalEl=$('#modal'),mbox=$('#mbox'),modalSticky=false;
function openModal(title,body,foot,opts){
  opts=opts||{};modalSticky=!!opts.sticky;
  mbox.className='mbox'+(opts.narrow?' narrow':'');mbox.textContent='';
  mbox.append(h('div',{class:'mhead'},h('span',{},title),opts.sticky?null:h('button',{class:'small',id:'mclose',onclick:closeModal,title:'Close (Esc)'},'✕')),h('div',{class:'mbody'},body));
  if(foot)mbox.append(h('div',{class:'mfoot'},foot));
  modalEl.classList.add('on');
}
function closeModal(){modalEl.classList.remove('on');mbox.textContent=''}
function modalOpen(){return modalEl.classList.contains('on')}
modalEl.addEventListener('mousedown',function(e){if(e.target===modalEl&&!modalSticky)closeModal()});


/* ---------- backups ---------- */
function downloadText(text,filename){
  var blob=new Blob([text],{type:'application/json'});
  var a=h('a',{href:URL.createObjectURL(blob),download:filename});
  document.body.append(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
}
function backupName(enc){return 'nodle-backup-'+todayISO()+(enc?'-encrypted':'')+'.json'}
function markBackedUp(){S.lastBackup=todayISO();save();if(tab==='settings')renderPanel();renderTabs()}
function exportPlain(){downloadText(JSON.stringify(snapshot(),null,2),backupName(false));markBackedUp();toast('Backup file downloaded (not password-protected)')}
function exportEncrypted(pw){
  return PMCrypto.encryptBackup(pw,snapshot()).then(function(env){
    downloadText(JSON.stringify(env),backupName(true));markBackedUp();toast('Encrypted backup downloaded');
  });
}
function openBackupDialog(){
  saveNow();
  var body=h('div',{});
  body.append(h('div',{class:'muted'},'Your map is saved in the cloud, encrypted so only your vault passphrase can open it. A backup file is a second safety net: if you ever lose your passphrase, a backup with its own password is the only way back.'));
  var pw1=h('input',{type:'password',id:'bkpw1',autocomplete:'new-password'}),pw2=h('input',{type:'password',id:'bkpw2',autocomplete:'new-password'}),err=h('div',{class:'fl',id:'bkerr',style:'min-height:18px;font-size:13px'});
  body.append(h('h3',{},'Option 1 · Encrypted file (recommended)'),h('div',{class:'muted'},'Needs a password to open. Safe to keep in email or cloud storage. Use a different password from your vault passphrase if you like.'),
    field('Password for this file',pw1,'at least '+PMCrypto.MIN_PASSPHRASE+' characters'),field('Type it again',pw2),
    h('div',{class:'warnbox'},'If you forget this password, the file cannot be opened by anyone. There is no reset.'),err,
    h('button',{class:'primary',id:'bkenc',onclick:function(){
      if(pw1.value.length<PMCrypto.MIN_PASSPHRASE){err.textContent='Please use at least '+PMCrypto.MIN_PASSPHRASE+' characters.';return}
      if(pw1.value!==pw2.value){err.textContent='The two passwords do not match.';return}
      err.textContent='Encrypting…';
      exportEncrypted(pw1.value).then(function(){closeModal()},function(){err.textContent='Could not encrypt in this browser.'});
    }},'Download encrypted backup'),
    h('h3',{},'Option 2 · Plain file'),h('div',{class:'muted'},'Anyone who gets the file can read everything in it. Only keep it somewhere private.'),h('div',{style:'margin-top:6px'},h('button',{id:'bkplain',onclick:function(){exportPlain();closeModal()}},'Download plain backup')));
  openModal('Save a backup',body,null,{narrow:true});
}
function applyLoaded(d){
  S=d;S.view=null;resetLayoutAfterLoad();renderStats();toast('Backup loaded');
}
/* reads a backup file's text. Calls onData(rawData) when it is readable (decrypting first when needed). */
function readBackupText(text,onData){
  var o;
  try{o=JSON.parse(text)}catch(e){alert('Could not load that file: it is not a Nodle backup.');return}
  if(o&&o.peoplemapEnc===1){
    var pw=h('input',{type:'password',id:'ldpw'}),err=h('div',{class:'fl',id:'lderr',style:'min-height:18px;font-size:13px'});
    var go=function(){
      err.textContent='Opening…';
      PMCrypto.decryptBackup(o,pw.value).then(function(data){closeModal();onData(data)},function(){err.textContent='Wrong password, or the file is damaged.'});
    };
    pw.addEventListener('keydown',function(e){if(e.key==='Enter')go()});
    openModal('Encrypted backup',h('div',{},h('div',{class:'muted'},'This backup file is password-protected. Enter its password.'),field('Password',pw),err),[h('span',{class:'grow'}),h('button',{onclick:closeModal},'Cancel'),h('button',{class:'primary',id:'ldgo',onclick:go},'Open')],{narrow:true});
    setTimeout(function(){pw.focus()},30);
  }else onData(o);
}
function loadBackupText(text){
  readBackupText(text,function(raw){
    var d;try{d=sanitize(raw)}catch(e){alert('Could not load that file: '+e.message);return}
    if(!confirm('Replace the current map with the backup ('+(d.people.length-1)+' people, '+d.links.length+' lines)?'))return;
    applyLoaded(d);
  });
}

/* ---------- settings ---------- */
function colorDist(a,b){
  function rgb(c){return [parseInt(c.substr(1,2),16),parseInt(c.substr(3,2),16),parseInt(c.substr(5,2),16)]}
  var x=rgb(a),y=rgb(b);return Math.sqrt(Math.pow(x[0]-y[0],2)+Math.pow(x[1]-y[1],2)+Math.pow(x[2]-y[2],2));
}
function clashes(color){
  for(var r=0;r<=5;r++)if(colorDist(color,RATING_COLORS[r])<70)return true;
  return false;
}

function panelSettings(b){
  b.append(h('h2',{},'Settings'));
  var br=backupReminder();if(br)b.append(br);
  // security
  var d1=h('details',{id:'sec-security'},h('summary',{},'Security and sign-in'));
  d1.append(securityBox());
  b.append(d1);
  // backups
  var lb=PM.parseISO(S.lastBackup);
  var d2=h('details',{id:'sec-backup'},h('summary',{},'Backups'),h('div',{},
    h('div',{class:'muted'},lb?'Last backup: '+PM.fmtFull(lb.y,lb.m,lb.d)+' ('+PM.ago(TN()-lb.num)+').':'No backup file saved yet.'),
    h('div',{style:'margin-top:8px'},h('button',{onclick:openBackupDialog},'Save a backup…'),' ',h('button',{onclick:function(){$('#file').click()}},'Load a backup…')),
    h('div',{class:'muted',style:'margin-top:6px'},'Tip: save an encrypted backup after each big update and keep it somewhere other than this device.')));
  b.append(d2);
  // importer
  b.append(h('details',{id:'sec-import'},h('summary',{},'Import birthdays from Notes'),h('div',{},h('div',{class:'muted'},'Paste a messy list and review it before anything is saved.'),h('div',{style:'margin-top:8px'},h('button',{id:'setimport',onclick:openImporter},'Paste a list…')))));
  // appearance and risk
  var d5=h('details',{id:'sec-risk'},h('summary',{},'Risk and flags'));
  var show=h('input',{type:'checkbox',checked:S.showRisk,id:'setShowRisk',onchange:function(){S.showRisk=show.checked;save();renderGraph();renderStats();renderPanel()}}),
      hide=h('input',{type:'checkbox',checked:S.hideSens,id:'setHide',onchange:function(){S.hideSens=hide.checked;save();renderGraph();renderStats();renderPanel()}}),
      cf=h('select',{id:'setCircle',onchange:function(){S.circleFrom=cf.value;save();renderGraph();renderPanel()}},h('option',{value:'rating',selected:S.circleFrom==='rating'},'My rating (1 to 5)'),h('option',{value:'traits',selected:S.circleFrom==='traits'},'Average of the character traits'));
  var c5=h('div',{},h('label',{class:'cfl'},show,'Show risk rings on the map'),h('label',{class:'cfl'},hide,'Hide risk marks for now (key H), for when someone is looking'),field('Circle colour comes from',cf),h('h3',{},'Your own flags'));
  if(!S.customFlags.length)c5.append(h('div',{class:'muted'},'None yet. Add one on any person\'s Character tab.'));
  S.customFlags.forEach(function(f){
    var nm=h('input',{type:'text',value:f.name,maxlength:60,oninput:function(){f.name=nm.value||'Flag';save()}});
    c5.append(h('div',{class:'row',style:'margin:5px 0'},h('span',{class:'tag fixed'},f.kind),nm,h('button',{class:'small danger fixed',title:'Delete this flag everywhere',onclick:function(){
      if(!confirm('Delete the flag "'+f.name+'" from everyone?'))return;
      S.customFlags=S.customFlags.filter(function(x){return x!==f});S.people.forEach(function(p){if(p.character)p.character.flags=p.character.flags.filter(function(x){return x!==f.id})});
      save();renderGraph();renderPanel();renderStats()}},'✕')));
  });
  d5.append(c5);b.append(d5);
  // colours
  var d3=h('details',{id:'sec-colours'},h('summary',{},'Line colours and kinds'));
  var c3=h('div',{},h('div',{class:'muted'},'Each kind of relationship has its own line colour. Lines never use the circle colours (red, orange, yellow, green, grey) so the two cannot be confused.'));
  S.types.forEach(function(t){
    var n=allLinks().filter(function(l){return l.type===t.id}).length,auto=t.id==='metvia';
    var show2=h('input',{type:'checkbox',checked:!S.hidden[t.id],title:'Show on map',onchange:function(){S.hidden[t.id]=!show2.checked;save();renderGraph();reheat(.3)}});
    var warn=h('div',{class:'warnbox',style:'display:none'},'This colour is close to a circle colour. Pick a blue, violet, teal or white to avoid mix-ups.');
    var col=h('input',{type:'color',value:t.color,oninput:function(){t.color=col.value;warn.style.display=clashes(t.color)?'block':'none';save();renderGraph()}});
    var nm=h('input',{type:'text',value:t.name,oninput:function(){t.name=nm.value||'Type';save();renderLegend()}});
    var del=auto||t.id==='introduced'?h('span',{class:'fixed',style:'width:30px'}):h('button',{class:'small danger fixed',title:'Delete this kind',onclick:function(){
      if(!confirm('Delete "'+t.name+'"'+(n?' and its '+n+' line'+(n>1?'s':''):'')+'?'))return;
      S.types=S.types.filter(function(x){return x!==t});S.links=S.links.filter(function(l){return l.type!==t.id});
      if(sel&&sel.kind==='link'&&!allLinks().some(function(l){return l.id===sel.id}))sel=null;
      save();renderGraph();reheat(.3);renderPanel();renderStats()}},'✕');
    c3.append(h('div',{class:'row',style:'margin:6px 0'},h('span',{class:'fixed'},show2),h('span',{class:'fixed'},col),nm,h('span',{class:'muted fixed',style:'width:42px;text-align:right'},n+' line'+(n===1?'':'s')),del),warn);
    warn.style.display=clashes(t.color)?'block':'none';
  });
  var nm0=h('input',{type:'text',placeholder:'e.g. Neighbour, Client, Teammate'}),col0=h('input',{type:'color',value:'#5b8def'}),warn0=h('div',{class:'warnbox',style:'display:none'},'This colour is close to a circle colour.');
  col0.addEventListener('input',function(){warn0.style.display=clashes(col0.value)?'block':'none'});
  c3.append(h('h3',{},'Add your own kind'),h('div',{class:'row'},nm0,h('span',{class:'fixed'},col0)),warn0,h('div',{style:'margin-top:8px'},h('button',{class:'primary',onclick:function(){
    if(!nm0.value.trim()){toast('Type a name first');return}
    S.types.push({id:uid('t'),name:nm0.value.trim(),color:col0.value});save();renderGraph();renderPanel();toast('Added')}},'Add')));
  d3.append(c3);b.append(d3);
  // character labels
  var d4=h('details',{id:'sec-char'},h('summary',{},'Character labels'));
  var c4=h('div',{},h('div',{class:'muted'},'These words go with the circle colours. Rename them however you like.'));
  [5,4,3,2,1].forEach(function(r){
    var inp=h('input',{type:'text',value:ratingLabel(r),oninput:function(){S.ratingLabels[r]=inp.value.trim()||DEFAULT_RATING_LABELS[r];save();renderLegend()}});
    c4.append(h('div',{class:'row',style:'margin:6px 0'},h('span',{class:'dot fixed',style:'background:'+RATING_COLORS[r]}),h('span',{class:'fixed',style:'width:14px'},r),inp));
  });
  d4.append(c4);b.append(d4);
  // data
  b.append(h('details',{id:'sec-data'},h('summary',{},'Demo data and clearing'),h('div',{},
    h('div',{class:'muted'},'The demo people are all made up (19 fake people). Loading them replaces what is on the map.'),
    h('div',{style:'margin-top:8px'},h('button',{id:'btnExample',onclick:function(){
      if(S.people.length>1&&!confirm('This replaces everything on the map with made-up demo people. (Save a backup first if you want to keep your current map.) Continue?'))return;
      loadDemo();
    }},'Load demo data'),' ',h('button',{class:'danger',id:'btnClear',onclick:function(){
      if(!confirm('Delete EVERYONE and all lines from this map? This cannot be undone (unless you saved a backup).'))return;
      S=fresh();resetLayoutAfterLoad();renderStats();toast('Cleared');
    }},'Clear everything')))));
  if(settingsOpen)(document.getElementById(settingsOpen)||{}).open=true;
  Array.prototype.forEach.call(b.querySelectorAll('details'),function(d){d.addEventListener('toggle',function(){if(d.open)settingsOpen=d.id})});
}
var settingsOpen='';
function loadDemo(){S=exampleData();S.view=null;resetLayoutAfterLoad();renderStats();toast('Demo people loaded. They are all fake.')}

/* ---------- birthday paste importer ---------- */
var imp=null;
var IMPORT_SAMPLE=['🎂 Birthdays','- Mum - 3rd March','jan 14','14/1','• Sam bday 12 Feb','jess: 5/6','14.1.2003  Wei','3 mar Priya','march3 Nina','Ken 14/01/03','Dr lim — 8 Sept','Uncle Raj 22 Nov 1958','Ivy ?? sometime in spring','12) Omar 12/10','Tara 25/12'].join('\n');
function openImporter(){imp={order:'DMY',text:'',rows:null,hint:'',skipped:0,connect:''};importStep1()}
function importStep1(){
  var ta=h('textarea',{id:'imptext',placeholder:'Paste your list from Notes here.\n\nMessy is fine, for example:\nMum - 3rd March\njan 14\nSam bday 12 Feb\njess: 5/6',style:'width:100%;height:300px;font-family:var(--mono);font-size:13px'});
  ta.value=imp.text;
  var r1=h('input',{type:'radio',name:'impord',value:'DMY',id:'ordDMY'}),r2=h('input',{type:'radio',name:'impord',value:'MDY',id:'ordMDY'});
  (imp.order==='MDY'?r2:r1).checked=true;
  var body=h('div',{},
    h('div',{class:'muted'},'Paste the whole list. Nothing is saved until you review it and press Confirm. Everything is read in your browser by plain code (no AI).'),
    h('div',{style:'margin:8px 0'},ta),
    h('div',{class:'row',style:'align-items:center'},h('span',{class:'fixed'},'When a date like 5/6 is written, it means:'),
      h('label',{class:'fixed',style:'display:flex;gap:5px;margin:0;text-transform:none;letter-spacing:0;font-weight:400'},r1,'day / month (5 June)'),
      h('label',{class:'fixed',style:'display:flex;gap:5px;margin:0;text-transform:none;letter-spacing:0;font-weight:400'},r2,'month / day (May 6)')));
  function go(){
    imp.text=ta.value;imp.order=r2.checked?'MDY':'DMY';
    if(!imp.text.trim()){toast('Paste your list first');return}
    buildReview();importStep2();
  }
  openModal('Import birthdays from Notes',body,[h('button',{onclick:function(){ta.value=IMPORT_SAMPLE}},'Try a messy example'),h('span',{class:'grow'}),h('button',{onclick:closeModal},'Cancel'),h('button',{class:'primary',id:'impreview',onclick:go},'Review →')],{sticky:true});
  setTimeout(function(){ta.focus()},30);
}
function peopleForMatch(){return S.people.filter(function(p){return !p.isMe}).map(function(p){return {id:p.id,name:plainName(p)}})}
function buildReview(){
  var res=PM.parseList(imp.text,{order:imp.order}),cands=peopleForMatch();
  imp.hint=res.hint;imp.skipped=res.skipped;
  imp.rows=res.rows.map(function(r,i){
    var m=r.name?PM.matchPeople(r.name,cands):{list:[],best:null,ambiguous:false};
    var row={i:i,raw:r.raw,name:r.name,day:r.day||'',month:r.month||'',year:r.year||'',parseReasons:r.reasons.filter(function(x){return !/Year|future|days|Day is|Month is|No name|No date/.test(x)}),notes:r.notes||[],
      cands:m.list,matchId:m.best?(m.ambiguous?'':m.best.id):'new',ambig:!!(m.best&&m.ambiguous),include:false};
    recheckRow(row);row.include=row.status==='ok';return row;
  });
}
function recheckRow(r){
  var reasons=[];
  if(!r.name||!r.name.trim())reasons.push('Name is empty');
  if(r.day===''||r.month==='')reasons.push('Date is missing');
  else reasons=reasons.concat(PM.validateDate(+r.day,+r.month,r.year===''?null:+r.year,new Date()));
  if(!r.dateEdited)r.parseReasons.forEach(function(x){if(reasons.indexOf(x)<0)reasons.push(x)});
  if(r.ambig&&r.matchId==='')reasons.push('Could be more than one person: pick who');
  r.reasons=reasons;r.status=reasons.length?'flagged':'ok';
}
function reviewCounts(){
  var ok=0,fl=0,inc=0;imp.rows.forEach(function(r){if(r.status==='ok')ok++;else fl++;if(r.include&&r.status==='ok')inc++});
  return {ok:ok,fl:fl,inc:inc};
}
function importStep2(){
  var body=h('div',{});
  var sumEl=h('div',{class:'muted',id:'impsummary',style:'margin-bottom:6px'});
  var rowsHolder=h('div',{style:'overflow:auto'});
  var hintEl=imp.hint?h('div',{class:'warnbox',id:'imphint'},imp.hint+' ',h('button',{class:'small',onclick:function(){imp.order=imp.order==='DMY'?'MDY':'DMY';buildReview();importStep2()}},'Switch and re-read')):null;
  var cn=h('select',{id:'impconnect',style:'width:auto;min-width:200px;flex:0 0 auto'},h('option',{value:''},'(don\'t add lines)'));
  S.types.forEach(function(t){if(t.id!=='metvia')cn.append(h('option',{value:t.id},t.name))});
  cn.value=imp.connect;cn.onchange=function(){imp.connect=cn.value};
  var confirmBtn=h('button',{class:'primary',id:'impconfirm'},'Confirm import');
  function paintSummary(){
    var c=reviewCounts();
    sumEl.textContent=imp.rows.length+' entr'+(imp.rows.length===1?'y':'ies')+' found · '+c.ok+' look fine · '+c.fl+' need a look'+(imp.skipped?' · '+imp.skipped+' line'+(imp.skipped===1?'':'s')+' skipped (headings or blanks)':'');
    confirmBtn.textContent='Confirm import ('+c.inc+')';confirmBtn.disabled=c.inc===0;
  }
  function paintRows(){
    rowsHolder.textContent='';
    var tb=h('table',{class:'tbl review',id:'reviewtbl'},h('tr',{},h('th',{},''),h('th',{},'Original line'),h('th',{},'Name'),h('th',{},'Day'),h('th',{},'Month'),h('th',{},'Year'),h('th',{},'Match to'),h('th',{},'Status')));
    imp.rows.forEach(function(r){tb.append(reviewRow(r,function(){paintSummary();pill(r)},function(){paintRows();paintSummary()}))});
    rowsHolder.append(tb);
  }
  var pills={};
  function pill(r){var p=pills[r.i];if(!p)return;p.cell.textContent='';p.cell.append(h('span',{class:'pill '+(r.status==='ok'?'ok':'flag')},r.status==='ok'?'ok':'flagged'));r.reasons.forEach(function(x){p.cell.append(h('div',{class:'sub fl'},x))});p.tr.className=r.status==='ok'?'':'flag';p.chk.checked=r.include&&r.status==='ok';p.chk.disabled=r.status!=='ok'}
  function reviewRow(r,onLive,onFull){
    var chk=h('input',{type:'checkbox',checked:r.include&&r.status==='ok',disabled:r.status!=='ok',onchange:function(){r.include=chk.checked;paintSummary()}});
    var nm=h('input',{type:'text',value:r.name,style:'width:130px','data-f':'name'}),dd=h('input',{type:'number',min:1,max:31,value:r.day,style:'width:54px','data-f':'day'}),
        mm=h('select',{'data-f':'month'},h('option',{value:''},'—')),yy=h('input',{type:'text',value:r.year,placeholder:'—',style:'width:62px','data-f':'year'});
    PM.MONTH_NAMES.forEach(function(n,i){mm.append(h('option',{value:i+1},n.slice(0,3)))});mm.value=r.month===''?'':String(r.month);
    var sl=h('select',{'data-f':'match',style:'max-width:190px'});
    if(r.ambig||r.matchId==='')sl.append(h('option',{value:''},'— pick one —'));
    sl.append(h('option',{value:'new'},'+ New person'));
    var seen={};
    r.cands.forEach(function(c){seen[c.id]=1;sl.append(h('option',{value:c.id},c.name))});
    S.people.filter(function(p){return !p.isMe&&!seen[p.id]}).sort(function(a,c){return plainName(a).localeCompare(plainName(c))}).forEach(function(p){sl.append(h('option',{value:p.id},'· '+plainName(p)))});
    sl.value=r.matchId;
    var cur=h('div',{class:'sub'});
    function paintCur(){
      cur.textContent='';var p=r.matchId&&r.matchId!=='new'?person(r.matchId):null;
      if(p&&p.bday&&(p.bday.d!==+r.day||p.bday.m!==+r.month))cur.textContent='now: '+PM.fmtMD(p.bday.m,p.bday.d);
      else if(p&&p.bday)cur.textContent='same as saved';
    }
    paintCur();
    var cell=h('td',{});
    function edited(dateChanged){
      r.name=nm.value;r.day=dd.value===''?'':+dd.value;r.month=mm.value===''?'':+mm.value;
      var yv=yy.value.trim();
      if(/^\d{2}$/.test(yv))yv=String(PM.year2(+yv));
      r.year=/^\d{4}$/.test(yv)?+yv:'';
      if(dateChanged)r.dateEdited=true;
      r.matchId=sl.value;if(r.matchId!=='')r.ambig=r.ambig&&false;
      recheckRow(r);if(r.status==='ok'&&!r.autoTouched){r.include=true;r.autoTouched=true}
      paintCur();onLive();
    }
    nm.addEventListener('input',function(){edited(false)});
    [dd,yy].forEach(function(i){i.addEventListener('input',function(){edited(true)})});
    mm.addEventListener('change',function(){edited(true)});
    yy.addEventListener('change',function(){if(r.year!==''){yy.value=r.year}});
    sl.addEventListener('change',function(){
      edited(false);
      if(sl.options[0]&&sl.options[0].value===''&&sl.value!=='')sl.remove(0);
    });
    var tr=h('tr',{class:r.status==='ok'?'':'flag','data-row':r.i},h('td',{},chk),h('td',{},h('div',{class:'orig',title:r.raw},r.raw)),h('td',{},nm),h('td',{},dd),h('td',{},mm),h('td',{},yy),h('td',{},sl,cur),cell);
    pills[r.i]={tr:tr,cell:cell,chk:chk};
    pill(r);
    return tr;
  }
  var r1=h('input',{type:'radio',name:'impord2',id:'ordDMY2'}),r2=h('input',{type:'radio',name:'impord2',id:'ordMDY2'});
  (imp.order==='MDY'?r2:r1).checked=true;
  function reorder(){
    var edited=imp.rows.some(function(r){return r.dateEdited});
    if(edited&&!confirm('Switching re-reads the list and resets your changes. Continue?')){(imp.order==='MDY'?r2:r1).checked=true;return}
    imp.order=r2.checked?'MDY':'DMY';buildReview();importStep2();
  }
  r1.onchange=r2.onchange=reorder;
  body.append(h('div',{class:'row',style:'align-items:center;margin-bottom:6px'},h('span',{class:'fixed'},'5/6 means:'),
    h('label',{class:'fixed',style:'display:flex;gap:5px;margin:0;text-transform:none;letter-spacing:0;font-weight:400'},r1,'day / month'),
    h('label',{class:'fixed',style:'display:flex;gap:5px;margin:0;text-transform:none;letter-spacing:0;font-weight:400'},r2,'month / day'),h('span',{})));
  if(hintEl)body.append(hintEl);
  body.append(sumEl,rowsHolder);
  if(!imp.rows.length)rowsHolder.append(h('div',{class:'warnbox'},'No dates were found in that text. Go back and check what you pasted.'));
  else paintRows();
  paintSummary();
  confirmBtn.onclick=function(){commitImport()};
  openModal('Review before importing',body,[h('label',{class:'fixed',style:'margin:0;text-transform:none;letter-spacing:0;font-weight:400;white-space:nowrap'},'Connect new people to Georgia as: '),cn,h('span',{class:'grow'}),h('button',{id:'impback',onclick:function(){importStep1()}},'← Back'),confirmBtn],{sticky:true});
}
function commitImport(){
  var upd=0,add=0,skip=0,base=me();
  imp.rows.forEach(function(r){
    if(!(r.include&&r.status==='ok'))return;
    var m=+r.month,d=+r.day,y=r.year===''?0:+r.year,p=null;
    if(r.matchId&&r.matchId!=='new')p=person(r.matchId);
    if(p){
      if(!y&&p.bday&&p.bday.m===m&&p.bday.d===d)y=p.bday.y||0;
      p.bday={m:m,d:d,y:y};upd++;
    }else{
      var ang=Math.random()*Math.PI*2;
      p={id:uid('p'),name:r.name.trim(),isMe:false,code:'P'+pad2(S.nextCode++),note:'',group:'',rating:0,offers:[],needs:[],x:Math.cos(ang)*(180+Math.random()*60),y:Math.sin(ang)*(180+Math.random()*60),vx:0,vy:0,pinned:false,
        lastTalked:'',bday:{m:m,d:d,y:y},dates:[],likes:'',gifts:[],ideas:'',metBy:'',metHow:'',metDate:'',events:[]};
      S.people.push(p);add++;
      if(imp.connect)S.links.push({id:uid('l'),a:'me',b:p.id,type:imp.connect,strength:2,note:''});
    }
  });
  imp.rows.forEach(function(r){if(!(r.include&&r.status==='ok'))skip++});
  save();closeModal();renderGraph();reheat(.6);renderStats();setTab('upcoming');
  toast('Imported: '+upd+' updated, '+add+' new'+(skip?' · '+skip+' left out':''));
}
