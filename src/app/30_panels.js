/* ---------- who should meet (plain word matching) ---------- */
function suggestions(){
  var out={},P=S.people.filter(function(p){return !p.isMe});
  P.forEach(function(a){a.offers.forEach(function(o){
    var no=norm(o);if(!no)return;
    P.forEach(function(b){
      if(a===b||connected(a.id,b.id))return;
      b.needs.forEach(function(nd){
        if(norm(nd)===no){
          var k=[a.id,b.id].sort().join('|');
          var s0=out[k]=out[k]||{a:a,b:b,why:[]};
          s0.why.push({from:a,to:b,word:o});
        }
      });
    });
  })});
  var arr=Object.keys(out).map(function(k){return out[k]});
  arr.forEach(function(x){var seen={};x.why=x.why.filter(function(w){var kk=w.from.id+'>'+norm(w.word);if(seen[kk])return false;seen[kk]=1;return true})});
  arr.sort(function(x,y){return y.why.length-x.why.length||x.a.name.localeCompare(y.a.name)});
  return arr;
}
function markIntroduced(sg){
  ensureIntroType();
  var note='Introduced by Georgia ('+sg.why.map(function(w){return w.word}).filter(function(v,i,a){return a.indexOf(v)===i}).join(', ')+')';
  S.links.push({id:uid('l'),a:sg.a.id,b:sg.b.id,type:'introduced',strength:2,note:note});
  save();renderGraph();reheat(.5);renderPanel();
  toast('Added a line between '+plainName(sg.a)+' and '+plainName(sg.b));
}

/* ---------- small UI helpers ---------- */
function field(label,input,hint){return h('div',{},h('label',{},label,hint?h('small',{},' '+hint):null),input)}
function typeSelect(val,allowNone,noneLabel,skipAuto){
  var sl=h('select',{});
  if(allowNone)sl.append(h('option',{value:''},noneLabel||'(none)'));
  S.types.forEach(function(t){if(skipAuto&&t.id==='metvia')return;sl.append(h('option',{value:t.id},t.name))});
  sl.value=val||'';return sl;
}
function strengthSelect(val){
  var sl=h('select',{},h('option',{value:'1'},'1 – loosely connected (thin line)'),h('option',{value:'2'},'2 – good connection'),h('option',{value:'3'},'3 – very close (thick line)'));
  sl.value=String(val||2);return sl;
}
function ratingPicker(val,onChange){
  var cur=val,wrap=h('div',{class:'rating'}),lab=h('div',{class:'ratinglabel'});
  function paint(){
    Array.prototype.forEach.call(wrap.querySelectorAll('button'),function(b){b.classList.toggle('on',+b.getAttribute('data-r')===cur)});
    lab.textContent=cur?cur+' – '+ratingLabel(cur):'Not rated yet';
  }
  [1,2,3,4,5].forEach(function(r){
    wrap.append(h('button',{type:'button','data-r':r,class:'rdot',title:r+' – '+ratingLabel(r),style:'background:'+RATING_COLORS[r],onclick:function(){cur=r;paint();onChange(r)}},r));
  });
  wrap.append(h('button',{type:'button','data-r':0,class:'rnone',title:'Not rated',onclick:function(){cur=0;paint();onChange(0)}},'Not rated'));
  paint();
  return h('div',{},wrap,lab);
}
function groupList(){
  var d=h('datalist',{id:'groups'}),seen={};
  S.people.forEach(function(p){if(p.group&&!seen[p.group]){seen[p.group]=1;d.append(h('option',{value:p.group}))}});
  var e=h('datalist',{id:'evtags'});allEventTags().forEach(function(t){e.append(h('option',{value:t.tag}))});
  return h('span',{},d,e);
}
function personSelect(val,opts){
  opts=opts||{};
  var sl=h('select',{});
  if(opts.none)sl.append(h('option',{value:''},opts.none));
  S.people.filter(function(p){return (opts.includeMe||!p.isMe)&&p.id!==opts.except}).sort(function(a,b){return plainName(a).localeCompare(plainName(b))}).forEach(function(p){sl.append(h('option',{value:p.id},plainName(p)))});
  sl.value=val||'';if(sl.value!==(val||''))sl.selectedIndex=0;return sl;
}
function monthSelect(val){
  var sl=h('select',{},h('option',{value:''},'Month'));
  PM.MONTH_NAMES.forEach(function(n,i){sl.append(h('option',{value:i+1},n))});
  sl.value=val?String(val):'';return sl;
}
function dayInput(val){return h('input',{type:'number',min:1,max:31,placeholder:'Day',value:val||''})}
function yearInput(val,ph){return h('input',{type:'number',min:1900,max:2200,placeholder:ph||'Year (optional)',value:val||''})}
function backBtn(){return h('button',{class:'small fixed',onclick:function(){select(null)}},'← Back')}
function balPill(p){
  var fv=favoursOf(p.id);
  if(!fv.list.length)return h('span',{class:'muted'},'—');
  return h('span',{class:'bal '+(fv.net>0?'owe':fv.net<0?'owed':'')},balanceText(fv.net,true));
}
function whoLink(p){return h('span',{class:'who',onclick:function(e){e.stopPropagation();select({kind:'person',id:p.id})}},plainName(p))}
function dateInputToday(){return h('input',{type:'date',value:todayISO()})}
function afterEdit(){save();renderGraph();renderTabs();renderStats()}

/* ---------- panel shell ---------- */
var TABS=[['people','People'],['meet','Who should meet?'],['risk','Risk'],['upcoming','Upcoming'],['events','Events'],['path','Path'],['favours','Favours'],['settings','Settings']];
function setTab(t){tab=t;if(t!=='people'&&sel&&sel.kind==='link')sel=null;applyFocus();renderPanel()}
function renderTabs(){
  var t=$('#tabs');t.textContent='';
  var nm=suggestions().length,nu=upcomingItems(30).length;
  TABS.forEach(function(x){
    var badge=x[0]==='risk'&&riskVisible()&&riskCount(['high','critical'])?riskCount(['high','critical']):x[0]==='meet'&&nm?nm:x[0]==='upcoming'&&nu?nu:null;
    t.append(h('div',{class:'tab'+(tab===x[0]?' on':''),'data-tab':x[0],onclick:function(){setTab(x[0])}},x[1],badge?h('span',{class:'badge'},badge):null));
  });
}
function renderPanel(){
  renderTabs();
  var b=$('#body');b.textContent='';
  if(tab==='meet')panelMeet(b);
  else if(tab==='risk')panelRisk(b);
  else if(tab==='upcoming')panelUpcoming(b);
  else if(tab==='events')panelEvents(b);
  else if(tab==='path')panelPath(b);
  else if(tab==='favours')panelFavours(b);
  else if(tab==='settings')panelSettings(b);
  else if(sel&&sel.kind==='person'&&person(sel.id))panelPerson(b,person(sel.id));
  else if(sel&&sel.kind==='link')panelLink(b);
  else panelNew(b);
}
function peopleList(b){
  b.append(h('h3',{},'Everyone ('+S.people.length+')'));
  S.people.slice().sort(function(a,c){return (a.isMe?-1:c.isMe?1:a.name.localeCompare(c.name))}).forEach(function(p){
    b.append(h('div',{class:'item','data-pid':p.id,onclick:function(){select({kind:'person',id:p.id})}},
      h('span',{class:'dot',style:'background:'+ratingColor(p)}),
      h('div',{class:'grow'},h('div',{},p.name),h('div',{class:'sub'},(p.isMe?'':ratingLabel(p.rating)+' · ')+(p.group||'no group')+' · '+linksOf(p.id).length+' lines')),
      h('span',{class:'mono sub'},p.code)));
  });
}
function backupReminder(){
  if(S.people.length<4)return null;
  var lb=PM.parseISO(S.lastBackup),d=lb?TN()-lb.num:null;
  if(d!==null&&d<=30)return null;
  return h('div',{class:'help'},d===null?'You have not saved a backup file yet. Your map is saved (encrypted) in the cloud, but a backup file is a good safety net: press "Save backup" now and then.':'Your last backup was '+PM.ago(d)+'. Press "Save backup" to make a fresh copy.');
}
var newOpen=false;
function panelNew(b){
  if(S.people.length<=1)b.append(h('div',{class:'help'},'This map is empty. Add your first person with the form below, or open Settings → "Load demo data" to try it out with made-up people.'));
  var br=backupReminder();if(br)b.append(br);
  var box=h('div',{});
  var name=h('input',{type:'text',id:'newname',placeholder:'e.g. Sam Tan'}),group=h('input',{type:'text',list:'groups',placeholder:'e.g. Polo club, School, Work'}),
      note=h('textarea',{placeholder:'Anything you want to remember'}),offers=h('input',{type:'text',placeholder:'e.g. funding, polo, hiring'}),needs=h('input',{type:'text',placeholder:'e.g. funding, career advice'}),
      rel=typeSelect('friend',true,'(not connected to Georgia yet)',true),st=strengthSelect(2),newRating=0;
  box.append(groupList(),field('Name',name),field('Character','','(how highly you rate them as a person – sets their circle colour)'),ratingPicker(0,function(r){newRating=r}),field('Group','' ,'(optional small tag, e.g. Polo club)'),group,
    field('How are they connected to Georgia?',rel),field('How close?',st),
    field('Note',note),field('Can offer','','(things they can help with, separate with commas)'),offers,field('Needs','','(things they are looking for, separate with commas)'),needs);
  var go=function(){
    var nm=name.value.trim();if(!nm){toast('Please type a name first');name.focus();return}
    var ang=Math.random()*Math.PI*2;
    var p={id:uid('p'),name:nm,isMe:false,code:'P'+pad2(S.nextCode++),note:note.value.trim(),group:group.value.trim(),rating:newRating,offers:splitList(offers.value),needs:splitList(needs.value),x:Math.cos(ang)*160,y:Math.sin(ang)*160,vx:0,vy:0,pinned:false,
      lastTalked:'',bday:null,dates:[],likes:'',gifts:[],ideas:'',metBy:'',metHow:'',metDate:'',events:[]};
    S.people.push(p);
    if(rel.value)S.links.push({id:uid('l'),a:'me',b:p.id,type:rel.value,strength:+st.value,note:''});
    save();sel={kind:'person',id:p.id};ptab='basics';renderGraph();reheat(.8);renderPanel();renderStats();toast('Added '+nm);
  };
  box.append(h('div',{style:'margin-top:12px'},h('button',{class:'primary',id:'addgo',onclick:go},'Add person')));
  name.addEventListener('keydown',function(e){if(e.key==='Enter')go()});
  var det=h('details',{id:'newbox'},h('summary',{},'Add a person'),box);
  det.open=S.people.length<=1||newOpen;newOpen=false;
  b.append(det);
  peopleList(b);
}

/* ---------- person panel (with sub-tabs) ---------- */
function deletePerson(p){
  if(!confirm('Delete '+p.name+' and all their lines?'))return;
  S.people=S.people.filter(function(x){return x!==p});
  S.links=S.links.filter(function(l){return l.a!==p.id&&l.b!==p.id});
  S.favours=S.favours.filter(function(f){return f.from!==p.id&&f.to!==p.id});
  S.people.forEach(function(x){if(x.metBy===p.id)x.metBy=''});
  sel=null;save();renderGraph();reheat(.5);renderPanel();renderStats();toast('Deleted');
}
function panelPerson(b,p){
  b.append(h('div',{class:'row',style:'margin-bottom:6px'},h('h2',{style:'margin:0'},p.isMe?'You (centre of the map)':'Edit person'),h('span',{class:'mono muted fixed'},p.code),backBtn()));
  var subs=p.isMe?[['basics','Basics'],['lines','Lines']]:[['basics','Basics'],['character','Character'],['dates','Dates'],['gifts','Gifts'],['met','How we met'],['favours','Favours'],['lines','Lines']];
  if(!subs.some(function(x){return x[0]===ptab}))ptab='basics';
  var st=h('div',{class:'subtabs'});
  subs.forEach(function(x){st.append(h('span',{class:'stab'+(ptab===x[0]?' on':''),'data-st':x[0],onclick:function(){ptab=x[0];renderPanel()}},x[1]))});
  b.append(st,groupList());
  ({basics:ptBasics,character:ptCharacter,dates:ptDates,gifts:ptGifts,met:ptMet,favours:ptFavours,lines:ptLines})[ptab](b,p);
}
function ptBasics(b,p){
  var name=h('input',{type:'text',value:p.name,id:'pname'}),group=h('input',{type:'text',list:'groups',value:p.group}),note=h('textarea',{value:p.note}),
      offers=h('input',{type:'text',value:p.offers.join(', ')}),needs=h('input',{type:'text',value:p.needs.join(', ')}),
      evs=h('input',{type:'text',list:'evtags',value:p.events.join(', '),placeholder:'e.g. polo, commodities, art'});
  var upd=function(){p.name=name.value||'Unnamed';p.group=group.value.trim();p.note=note.value;p.offers=splitList(offers.value);p.needs=splitList(needs.value);p.events=splitList(evs.value);afterEdit()};
  [name,group,note,offers,needs,evs].forEach(function(i){i.addEventListener('input',upd)});
  b.append(field('Name',name));
  if(!p.isMe)b.append(field('Character','','(how highly you rate them as a person – sets their circle colour)'),ratingPicker(p.rating,function(r){p.rating=r;afterEdit()}),field('Group','','(optional small tag)'),group);
  b.append(field('Note',note));
  if(p.isMe)return;
  b.append(field('Events and interests','','(tags, separate with commas – used for guest lists)'),evs);
  var ds=daysSince(p);
  var lt=h('input',{type:'date',value:p.lastTalked,id:'lasttalked',onchange:function(){p.lastTalked=isoOk(lt.value);afterEdit();renderPanel()}});
  b.append(field('Last talked','','(drives the fading circle and the Drifting list)'),
    h('div',{class:'row'},lt,h('button',{class:'fixed',id:'talktoday',onclick:function(){p.lastTalked=todayISO();afterEdit();renderPanel();toast('Marked: talked today')}},'Talked today')),
    h('div',{class:'muted',style:'margin-top:3px'},ds===null?'No date yet.':'You last talked '+PM.ago(ds)+(ds>=DRIFT_DAYS?' — drifting.':'.')));
  b.append(field('Can offer','','(things they can help with, separate with commas)'),offers,field('Needs','','(things they are looking for, separate with commas)'),needs);
  b.append(h('div',{style:'margin-top:10px'},
    h('button',{class:'small',onclick:function(){p.pinned=!p.pinned;save();renderGraph();reheat(.5);renderPanel()}},p.pinned?'Un-pin (let the map move them)':'Pin in place'),' ',
    h('button',{class:'small danger',id:'delperson',onclick:function(){deletePerson(p)}},'Delete person')));
}
function ptDates(b,p){
  var dd=dayInput(p.bday&&p.bday.d),mm=monthSelect(p.bday&&p.bday.m),yy=yearInput(p.bday&&p.bday.y||'');
  var info=h('div',{class:'muted',style:'margin-top:4px'});
  function paintInfo(){
    info.textContent='';
    if(!p.bday){info.textContent='No birthday saved yet.';return}
    var o=PM.nextOccurrence(p.bday.m,p.bday.d,TN());
    info.textContent=PM.fmtMD(p.bday.m,p.bday.d)+(p.bday.y?' '+p.bday.y:'')+' · '+(o.days===0?'today!':'in '+o.days+' day'+(o.days===1?'':'s'))+(p.bday.y?' · turns '+(o.year-p.bday.y):'');
  }
  function upd(){
    var d=+dd.value,m=+mm.value,y=+yy.value;
    if(!dd.value&&!m){p.bday=null}
    else if(d>=1&&m>=1&&d<=PM.daysInMonth(m,0)){p.bday={m:m,d:d,y:y>=1900&&y<=2200?y:0}}
    else{info.textContent='That day does not exist in that month.';return}
    paintInfo();afterEdit();
  }
  [dd,mm,yy].forEach(function(i){i.addEventListener('change',upd)});
  b.append(h('h3',{style:'margin-top:4px'},'Birthday'),h('div',{class:'row'},dd,mm,yy),info);
  paintInfo();
  b.append(h('h3',{},'Other key dates'),h('div',{class:'muted'},'Anniversaries, first met, a launch date… they appear in Upcoming each year.'));
  p.dates.forEach(function(k){
    var lab=h('input',{type:'text',value:k.label}),d2=dayInput(k.d),m2=monthSelect(k.m),y2=yearInput(k.y||'','Year');
    function u2(){var d=+d2.value,m=+m2.value;k.label=lab.value||'Key date';if(d>=1&&m>=1&&d<=PM.daysInMonth(m,0)){k.d=d;k.m=m}k.y=+y2.value>=1900?+y2.value:0;save();renderTabs();renderStats()}
    [lab,d2,m2,y2].forEach(function(i){i.addEventListener('change',u2)});
    b.append(h('div',{class:'card'},lab,h('div',{class:'row',style:'margin-top:5px'},d2,m2,y2,h('button',{class:'small danger fixed',title:'Remove',onclick:function(){p.dates=p.dates.filter(function(x){return x!==k});save();renderPanel();renderTabs();renderStats()}},'✕'))));
  });
  var nl=h('input',{type:'text',id:'kdlabel',placeholder:'e.g. Anniversary'}),nd=dayInput(''),nm=monthSelect(''),ny=yearInput('','Year');
  b.append(h('h3',{},'Add a key date'),nl,h('div',{class:'row',style:'margin-top:5px'},nd,nm,ny),h('div',{style:'margin-top:8px'},h('button',{class:'primary',id:'kdadd',onclick:function(){
    var d=+nd.value,m=+nm.value;
    if(!nl.value.trim()){toast('Give the date a name first');return}
    if(!(d>=1&&m>=1&&d<=PM.daysInMonth(m,0))){toast('Pick a real day and month');return}
    p.dates.push({id:uid('k'),label:nl.value.trim(),m:m,d:d,y:+ny.value>=1900?+ny.value:0});save();renderPanel();renderTabs();renderStats();toast('Date added');
  }},'Add date')));
}
function ptGifts(b,p){
  var likes=h('textarea',{value:p.likes,placeholder:'What they like: foods, hobbies, brands, sizes…'}),ideas=h('textarea',{value:p.ideas,placeholder:'Ideas for next time'});
  likes.addEventListener('input',function(){p.likes=likes.value;save()});
  ideas.addEventListener('input',function(){p.ideas=ideas.value;save()});
  b.append(field('Likes',likes),field('Ideas for next time','','(shown next to their birthday in Upcoming)'),ideas,h('h3',{},'Gifts given'));
  if(!p.gifts.length)b.append(h('div',{class:'muted'},'Nothing logged yet.'));
  p.gifts.slice().sort(function(a,c){return (c.date||'').localeCompare(a.date||'')}).forEach(function(g){
    b.append(h('div',{class:'item'},h('span',{class:'mono sub',style:'min-width:76px'},g.date||'no date'),h('div',{class:'grow'},g.what),h('button',{class:'small danger fixed',title:'Remove',onclick:function(e){e.stopPropagation();p.gifts=p.gifts.filter(function(x){return x!==g});save();renderPanel()}},'✕')));
  });
  var gd=dateInputToday(),gw=h('input',{type:'text',id:'giftwhat',placeholder:'What did you give?'});
  b.append(h('h3',{},'Log a gift'),h('div',{class:'row'},gd,gw),h('div',{style:'margin-top:8px'},h('button',{class:'primary',id:'giftadd',onclick:function(){
    if(!gw.value.trim()){toast('Type what you gave first');return}
    p.gifts.push({id:uid('g'),date:isoOk(gd.value),what:gw.value.trim()});save();renderPanel();toast('Gift logged');
  }},'Add gift')));
}
function ptMet(b,p){
  var by=personSelect(p.metBy,{none:'(nobody / not recorded)',except:p.id,includeMe:false}),how=h('input',{type:'text',value:p.metHow,placeholder:'e.g. charity dinner, Alex\'s wedding'}),when=h('input',{type:'date',value:p.metDate});
  by.id='metby';
  by.addEventListener('change',function(){p.metBy=by.value;save();renderGraph();reheat(.4);renderPanel();renderStats()});
  how.addEventListener('input',function(){p.metHow=how.value;save()});
  when.addEventListener('change',function(){p.metDate=isoOk(when.value);save();syncTimeline()});
  b.append(field('Introduced by','','(a dotted line is drawn from them to '+plainName(p)+')'),by,field('How / where we met',how),field('When we met','','(used by the "web growth" slider)'),when);
  var intro=S.people.filter(function(x){return x.metBy===p.id});
  b.append(h('h3',{},'People '+plainName(p)+' introduced to Georgia ('+intro.length+')'));
  if(!intro.length)b.append(h('div',{class:'muted'},'Nobody yet. On another person\'s "How we met" tab, choose '+plainName(p)+' as the introducer.'));
  intro.forEach(function(x){b.append(h('div',{class:'item',onclick:function(){select({kind:'person',id:x.id})}},h('span',{class:'dot',style:'background:'+ratingColor(x)}),h('div',{class:'grow'},plainName(x),h('div',{class:'sub'},(x.metDate||'date unknown')+(x.metHow?' · '+x.metHow:'')))))});
}
function favourRow(f){
  var from=f.from==='me'?'You':plainName(person(f.from)),to=f.to==='me'?'you':plainName(person(f.to));
  return h('div',{class:'item'},h('span',{class:'mono sub',style:'min-width:76px'},f.date||'no date'),
    h('div',{class:'grow'},h('b',{},from),' helped ',h('b',{},to),h('div',{class:'sub'},f.what||'(no description)')),
    h('button',{class:'small danger fixed',title:'Remove',onclick:function(e){e.stopPropagation();S.favours=S.favours.filter(function(x){return x!==f});save();renderPanel();renderStats()}},'✕'));
}
function ptFavours(b,p){
  var fv=favoursOf(p.id);
  b.append(h('div',{class:'row'},h('div',{},h('div',{class:'muted'},'Balance'),balPill(p)),h('div',{},h('div',{class:'muted'},'They helped me'),h('b',{class:'mono'},String(fv.they))),h('div',{},h('div',{class:'muted'},'I helped them'),h('b',{class:'mono'},String(fv.mine)))));
  b.append(h('h3',{},'Favours with '+plainName(p)));
  if(!fv.list.length)b.append(h('div',{class:'muted'},'None logged yet.'));
  fv.list.slice().sort(function(a,c){return (c.date||'').localeCompare(a.date||'')}).forEach(function(f){b.append(favourRow(f))});
  var dir=h('select',{id:'favdir'},h('option',{value:'they'},plainName(p)+' helped me'),h('option',{value:'me'},'I helped '+plainName(p))),what=h('input',{type:'text',id:'favwhat',placeholder:'What was the favour?'}),dt=dateInputToday();
  b.append(h('h3',{},'Log a favour'),dir,h('div',{class:'row',style:'margin-top:5px'},dt,what),h('div',{style:'margin-top:8px'},h('button',{class:'primary',id:'favadd',onclick:function(){
    if(!what.value.trim()){toast('Say what the favour was');return}
    S.favours.push({id:uid('f'),from:dir.value==='they'?p.id:'me',to:dir.value==='they'?'me':p.id,what:what.value.trim(),date:isoOk(dt.value)});
    save();renderPanel();renderTabs();renderStats();toast('Favour logged');
  }},'Add favour')));
}
function linkRow(p,l){
  var o=person(l.a===p.id?l.b:l.a),t=typeOf(l.type)||{name:'?',color:'#888'};
  return h('div',{class:'item',onclick:function(){select({kind:'link',id:l.id})}},
    h('span',{class:'dot',style:'background:'+t.color+';border-radius:0;height:4px'}),
    h('div',{class:'grow'},h('div',{},plainName(o)),h('div',{class:'sub'},t.name+(l.virtual?' (automatic)':' · strength '+l.strength)+(l.note?' · '+l.note:''))));
}
function ptLines(b,p){
  var ls=linksOf(p.id);
  b.append(h('h3',{style:'margin-top:4px'},'Lines to other people ('+ls.length+')'));
  if(!ls.length)b.append(h('div',{class:'muted'},'No lines yet. Add one below.'));
  ls.forEach(function(l){b.append(linkRow(p,l))});
  b.append(h('h3',{},'Add a line'));
  var others=S.people.filter(function(x){return x!==p});
  if(!others.length){b.append(h('div',{class:'muted'},'Add another person first.'));return}
  var to=personSelect('',{includeMe:true,except:p.id});
  var ty=typeSelect('friend',false,'',true),st=strengthSelect(2),nt=h('input',{type:'text',placeholder:'Short note (optional), e.g. met at a wedding'});
  b.append(field('Connect '+plainName(p)+' with…',to),field('What kind of relationship?',ty),field('How close?',st),field('Note',nt),
    h('div',{style:'margin-top:10px'},h('button',{class:'primary',id:'addline',onclick:function(){
      var dup=S.links.some(function(l){return l.type===ty.value&&((l.a===p.id&&l.b===to.value)||(l.b===p.id&&l.a===to.value))});
      if(dup){toast('They already have a line of that kind');return}
      S.links.push({id:uid('l'),a:p.id,b:to.value,type:ty.value,strength:+st.value,note:nt.value.trim()});
      S.hidden[ty.value]=false;
      save();renderGraph();reheat(.5);renderPanel();renderStats();toast('Line added');
    }},'Add line')));
}
function panelLink(b){
  var l=allLinks().filter(function(x){return x.id===sel.id})[0];
  if(!l){sel=null;return panelNew(b)}
  var A=person(l.a),B=person(l.b);
  b.append(h('div',{class:'row',style:'margin-bottom:6px'},h('h2',{style:'margin:0'},l.virtual?'Line (automatic)':'Edit line'),backBtn()));
  b.append(h('p',{},h('span',{class:'who',onclick:function(){select({kind:'person',id:A.id})}},plainName(A)),' ↔ ',h('span',{class:'who',onclick:function(){select({kind:'person',id:B.id})}},plainName(B))));
  if(l.virtual){
    b.append(h('div',{class:'help'},'This dotted line comes from "How we met": '+l.note+'. To change or remove it, open '+plainName(B)+' → How we met.'),
      h('button',{class:'small',onclick:function(){select({kind:'person',id:B.id});ptab='met';renderPanel()}},'Open How we met'));
    return;
  }
  var ty=typeSelect(l.type,false,'',true),st=strengthSelect(l.strength),nt=h('input',{type:'text',value:l.note,placeholder:'Short note (optional)'});
  ty.addEventListener('change',function(){l.type=ty.value;S.hidden[l.type]=false;save();renderGraph();renderLegend()});
  st.addEventListener('change',function(){l.strength=+st.value;save();renderGraph()});
  nt.addEventListener('input',function(){l.note=nt.value;save()});
  b.append(field('What kind of relationship?',ty),field('How close?',st),field('Note',nt),
    h('div',{style:'margin-top:12px'},h('button',{class:'danger',onclick:function(){
      if(!confirm('Delete this line?'))return;
      S.links=S.links.filter(function(x){return x!==l});sel={kind:'person',id:A.id};save();renderGraph();reheat(.4);renderPanel();renderStats()}},'Delete this line')));
}

/* ---------- who should meet ---------- */
function panelMeet(b){
  b.append(h('h2',{},'Who should meet?'));
  b.append(h('div',{class:'help'},'Give people "Can offer" and "Needs" words (on the People tab). When one person offers something another needs, and they don\'t know each other yet, it shows up here. It is just word-matching, no AI.'));
  var list=suggestions();
  var anyTags=S.people.some(function(p){return p.offers.length||p.needs.length});
  if(!list.length){b.append(h('div',{class:'muted'},anyTags?'No matches right now. Everyone who could help each other is already connected, or the words don\'t match yet (try the exact same word, like "funding").':'Nobody has "Can offer" or "Needs" words yet. Click a person and fill those in, or load the example people.'));return}
  b.append(h('div',{class:'muted'},list.length+' possible introduction'+(list.length>1?'s':'')+':'));
  var tb=h('table',{class:'tbl',id:'meettbl'},h('tr',{},h('th',{},'Pair'),h('th',{},'Why'),h('th',{})));
  list.forEach(function(sg){
    var wn=meetWarnings(sg);
    tb.append(h('tr',{},h('td',{},whoLink(sg.a),' + ',whoLink(sg.b)),
      h('td',{},sg.why.map(function(w){return h('div',{class:'sub'},plainName(w.from),' offers ',h('span',{class:'tag'},w.word),' → ',plainName(w.to),' needs it')})),
      h('td',{class:'r'},h('button',{class:'small'+(wn.length?'':' primary'),'data-introduce':wn.length?'warn':'ok',onclick:function(){
        if(wn.length&&!confirm(wn.map(function(w){return plainName(w.p)+' is rated '+PR.LEVELS[w.level].label.toUpperCase()+' risk. Introducing them could put '+plainName(w.other)+' at risk.'}).join('\n')+'\n\nIntroduce anyway?'))return;
        markIntroduced(sg)}},wn.length?'Introduce anyway':'Mark introduced'))));
    if(wn.length)tb.append(h('tr',{class:'warnrow'},h('td',{colspan:3},wn.map(function(w){return h('div',{class:'mrow warn'},h('span',{class:'warnbadge'},'▲ '+PR.LEVELS[w.level].tag),h('div',{},h('b',{},plainName(w.p)),' is rated ',PR.LEVELS[w.level].label.toLowerCase(),' risk. Introducing them could put ',plainName(w.other),' at risk.',w.why.length?h('div',{class:'warntxt'},'Because: '+w.why.join('; ')):null))}))));
  });
  b.append(tb);
}

/* ---------- upcoming + drifting ---------- */
function panelUpcoming(b){
  b.append(h('div',{class:'row',style:'margin-bottom:6px'},h('h2',{style:'margin:0'},'Upcoming'),
    (function(){var sl=h('select',{class:'fixed',id:'uprange'},h('option',{value:30},'Next 30 days'),h('option',{value:60},'Next 60 days'),h('option',{value:90},'Next 90 days'));sl.value=String(upRange);sl.onchange=function(){upRange=+sl.value;renderPanel()};return sl})()));
  var items=upcomingItems(upRange);
  if(!items.length)b.append(h('div',{class:'muted'},'Nothing in the next '+upRange+' days. Add birthdays on a person\'s Dates tab, or paste a list from your Notes below.'));
  else{
    var tb=h('table',{class:'tbl',id:'uptbl'},h('tr',{},h('th',{},'In'),h('th',{},'Who'),h('th',{},'Detail')));
    items.forEach(function(it){
      var detail=h('td',{},h('div',{},it.label+(it.age!==null?' · '+(it.kind==='Birthday'?'turns '+it.age:PM.ordinal(it.age)):'')));
      if(it.kind==='Birthday'&&it.p.ideas)detail.append(h('div',{class:'sub'},'Gift idea: '+trunc(it.p.ideas.replace(/\s+/g,' '),70)));
      if(it.kind==='Birthday'&&!it.p.ideas&&it.p.likes)detail.append(h('div',{class:'sub'},'Likes: '+trunc(it.p.likes.replace(/\s+/g,' '),70)));
      tb.append(h('tr',{class:'click','data-days':it.days,onclick:function(){select({kind:'person',id:it.p.id});ptab=it.kind==='Birthday'?'gifts':'dates';renderPanel()}},
        h('td',{class:'num '+(it.days<=7?'soon':'')},it.days===0?h('span',{class:'today'},'TODAY'):it.days+'d'),
        h('td',{},h('b',{},plainName(it.p)),h('div',{class:'sub mono'},PM.fmtMD(it.m,it.d))),detail));
    });
    b.append(tb);
  }
  b.append(h('div',{style:'margin:8px 0'},h('button',{id:'upimport',onclick:openImporter},'Paste birthdays from Notes…')));
  var dr=driftingList();
  b.append(h('h3',{},'Drifting ('+dr.length+')'),h('div',{class:'muted'},'People you have not talked to for 3 months or more.'));
  if(!dr.length)b.append(h('div',{class:'muted',style:'margin-top:4px'},'Nobody is drifting. (People with no "last talked" date are not counted.)'));
  else{
    var t2=h('table',{class:'tbl',id:'drifttbl'},h('tr',{},h('th',{},'Who'),h('th',{class:'r'},'Last talked'),h('th',{})));
    dr.forEach(function(p){
      t2.append(h('tr',{class:'click',onclick:function(){select({kind:'person',id:p.id})}},h('td',{},h('b',{},plainName(p)),h('div',{class:'sub'},p.group||'')),h('td',{class:'r num'},PM.ago(daysSince(p))),
        h('td',{class:'r'},h('button',{class:'small',onclick:function(e){e.stopPropagation();p.lastTalked=todayISO();save();renderGraph();renderPanel();renderStats();toast('Marked: talked to '+plainName(p)+' today')}},'Talked today'))));
    });
    b.append(t2);
  }
}

/* ---------- events ---------- */
function guestListText(){return peopleWithTags(eventSel).filter(function(p){return !p.isMe}).map(plainName).sort().join('\n')}
function copyText(text){
  function fallback(){
    var ta=h('textarea',{style:'position:fixed;left:-999px;top:0'});ta.value=text;document.body.append(ta);ta.select();
    var ok=false;try{ok=document.execCommand('copy')}catch(e){}ta.remove();return ok;
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){return navigator.clipboard.writeText(text).then(function(){return true},function(){return fallback()})}
  return Promise.resolve(fallback());
}
function panelEvents(b){
  b.append(h('h2',{},'Events and interests'));
  var tags=allEventTags();
  if(!tags.length){b.append(h('div',{class:'help'},'Tag people on their Basics tab (for example "polo, commodities, art"). Then pick tags here to see who belongs to each and to copy a guest list.'));return}
  b.append(h('div',{class:'muted'},'Pick one or more tags. The map shows only people with any of them.'));
  var chips=h('div',{class:'chips',id:'evchips'});
  tags.forEach(function(t){
    var on=eventSel.some(function(x){return x.toLowerCase()===t.tag.toLowerCase()});
    chips.append(h('span',{class:'echip'+(on?' on':''),'data-tag':t.tag,onclick:function(){
      if(on)eventSel=eventSel.filter(function(x){return x.toLowerCase()!==t.tag.toLowerCase()});else eventSel.push(t.tag);
      applyFocus();renderPanel()}},t.tag,h('b',{},String(t.people.length))));
  });
  b.append(chips);
  if(!eventSel.length){b.append(h('div',{class:'muted'},'No tag picked yet.'));return}
  var ps=peopleWithTags(eventSel).filter(function(p){return !p.isMe});
  b.append(h('div',{class:'row',style:'margin:6px 0'},h('b',{},ps.length+' '+(ps.length===1?'person':'people')),h('button',{class:'small fixed',onclick:function(){eventSel=[];applyFocus();renderPanel()}},'Clear'),
    h('button',{class:'primary small fixed',id:'copyguests',onclick:function(){copyText(guestListText()).then(function(ok){toast(ok?'Guest list copied ('+ps.length+' names)':'Could not copy: select the text below and copy it yourself')})}},'Copy guest list')));
  var tb=h('table',{class:'tbl',id:'evtbl'},h('tr',{},h('th',{},'Name'),h('th',{},'Tags'),h('th',{class:'r'},'Last talked')));
  ps.sort(function(a,c){return plainName(a).localeCompare(plainName(c))}).forEach(function(p){
    var ds=daysSince(p);
    tb.append(h('tr',{class:'click',onclick:function(){select({kind:'person',id:p.id},true);tab='people';renderPanel()}},h('td',{},h('b',{},plainName(p)),h('div',{class:'sub'},p.group||'')),h('td',{},p.events.map(function(e){return h('span',{class:'tag',style:'margin:0 3px 3px 0'},e)})),h('td',{class:'r num'},ds===null?'—':PM.agoShort(ds))));
  });
  b.append(tb,h('label',{},'Guest list (names only)'),h('textarea',{id:'guesttext',readOnly:true,style:'height:'+Math.min(180,40+ps.length*18)+'px',value:guestListText()}));
}

/* ---------- path finder ---------- */
function panelPath(b){
  b.append(h('h2',{},'Path finder'),h('div',{class:'muted'},'Pick someone you want to reach. It finds the shortest chain of people, starting from Georgia, who could introduce you.'));
  var sel0=personSelect(pathTarget,{none:'(choose a person)'});sel0.id='pathsel';
  sel0.onchange=function(){pathTarget=sel0.value;computePath();applyFocus();renderPanel()};
  b.append(field('I want to reach…',sel0));
  computePath();
  if(!pathTarget)return;
  var t=person(pathTarget);
  if(!pathRes){b.append(h('div',{class:'warnbox'},'No chain found. '+plainName(t)+' is not connected to anyone you can reach yet. Add a line from them to somebody on the map.'));return}
  var steps=pathRes.steps,names=['Georgia'].concat(steps.map(function(s0){return plainName(person(s0.to))}));
  b.append(h('div',{class:'card',id:'pathsummary'},h('div',{},h('b',{},steps.length===1?'You already know '+plainName(t)+' directly.':steps.length+' steps to reach '+plainName(t)+'.')),h('div',{class:'mono',style:'margin-top:4px;word-break:break-word'},names.join(' → '))));
  if(steps.length>1){
    var words=[];
    for(var i=1;i<steps.length;i++)words.push('Ask '+names[i]+' to introduce you to '+names[i+1]);
    b.append(h('div',{class:'muted'},words.join('. ')+'.'));
  }
  var list=h('div',{style:'margin-top:8px',id:'pathsteps'});
  list.append(h('div',{class:'step'},h('span',{class:'n mono'},'0'),h('span',{},'Georgia (you)')));
  steps.forEach(function(st0,i){
    var ty=typeOf(st0.link.type)||{name:'?'};
    list.append(h('div',{class:'arrowline'},ty.name+(st0.link.virtual?' (met through)':'')+(st0.link.note&&!st0.link.virtual?' · '+st0.link.note:'')));
    var tp=person(st0.to);
    list.append(h('div',{class:'step'},h('span',{class:'n mono'},String(i+1)),whoLink(tp),h('span',{class:'muted'},tp.group||'')));
  });
  b.append(list);
}
function computePath(){
  if(pathTarget&&!person(pathTarget))pathTarget='';
  pathRes=pathTarget?findPath(pathTarget):null;
}

/* ---------- favours ---------- */
function panelFavours(b){
  b.append(h('h2',{},'Favour balance'),h('div',{class:'muted'},'Who helped whom. Log a favour, and each person shows whether you owe them, they owe you, or you are even.'));
  var rows=S.people.filter(function(p){return !p.isMe&&favoursOf(p.id).list.length}).sort(function(a,c){return Math.abs(favoursOf(c.id).net)-Math.abs(favoursOf(a.id).net)||plainName(a).localeCompare(plainName(c))});
  if(rows.length){
    var tb=h('table',{class:'tbl',id:'favtbl'},h('tr',{},h('th',{},'Who'),h('th',{},'Balance'),h('th',{class:'r'},'Logged')));
    rows.forEach(function(p){tb.append(h('tr',{class:'click',onclick:function(){select({kind:'person',id:p.id});ptab='favours';renderPanel()}},h('td',{},h('b',{},plainName(p))),h('td',{},balPill(p)),h('td',{class:'r num'},String(favoursOf(p.id).list.length))))});
    b.append(tb);
  }else b.append(h('div',{class:'muted',style:'margin:8px 0'},'No favours logged yet.'));
  var who=personSelect('',{none:'(choose a person)'}),dir=h('select',{},h('option',{value:'they'},'They helped me'),h('option',{value:'me'},'I helped them')),what=h('input',{type:'text',placeholder:'What was the favour?'}),dt=dateInputToday();
  b.append(h('h3',{},'Log a favour'),who,h('div',{class:'row',style:'margin-top:5px'},dir,dt),h('div',{style:'margin-top:5px'},what),h('div',{style:'margin-top:8px'},h('button',{class:'primary',onclick:function(){
    if(!who.value){toast('Choose who it was');return}
    if(!what.value.trim()){toast('Say what the favour was');return}
    S.favours.push({id:uid('f'),from:dir.value==='they'?who.value:'me',to:dir.value==='they'?'me':who.value,what:what.value.trim(),date:isoOk(dt.value)});
    save();renderPanel();renderTabs();renderStats();toast('Favour logged');
  }},'Add favour')));
  b.append(h('h3',{},'All favours ('+S.favours.length+')'));
  S.favours.slice().sort(function(a,c){return (c.date||'').localeCompare(a.date||'')}).forEach(function(f){b.append(favourRow(f))});
}
