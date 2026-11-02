/* ---------- character + risk screens ---------- */
function afterChar(){save();renderGraph();renderTabs();renderStats();renderPanel()}
function lvTag(level,overridden){var li=PR.LEVELS[level];return h('span',{},h('span',{class:'lv '+li.cls},li.tag),overridden?h('span',{class:'ovmark',style:'margin-left:5px'},'OVR'):null)}
function riskContext(p){
  var c=charOf(p),bad=c.evidence.filter(function(e){return e.effect==='bad'}).sort(function(a,b){return a.date<b.date?1:-1})[0];
  return {redNames:flagsOfKind(p,'red').map(function(f){return f.name.toLowerCase()}),greenNames:flagsOfKind(p,'green').map(function(f){return f.name}),
    latestBadText:bad?bad.text:'',confidence:c.gut.confidence};
}
function ratingSquares(val,onPick){
  var box=h('span',{class:'rd'});
  for(var n=1;n<=5;n++)(function(n){
    box.append(h('span',{class:'rdot'+(val===n?' on':''),'data-v':n,style:'width:20px;height:20px;display:inline-block;background:'+RATING_COLORS[n],title:n+' / 5',onclick:function(){onPick(val===n?0:n)}}));
  })(n);
  return box;
}
/* the red box: level, score, three bars, why-list, overrides */
function riskBox(p){
  var rv=riskOfPerson(p),r=rv.computed,li=PR.LEVELS[rv.level],c=charOf(p);
  var box=h('div',{class:'riskbox','data-level':rv.level,style:'border-top-color:'+li.color});
  box.append(h('div',{class:'rbhead'},
    h('div',{class:'rlevel',style:'color:'+li.color},h('small',{},'Risk if you share things with them'),li.tag),
    h('div',{class:'rscore'},r.score===null?'—':h('span',{},h('b',{},String(r.score)),' / 100'),rv.overridden?h('div',{},'computed: '+PR.LEVELS[r.level].label):null)));
  if(r.score===null){
    box.append(h('div',{class:'muted',style:'margin-top:8px'},'Rate at least 3 character traits above to get a risk level. Until then it shows "not enough info" and is not counted anywhere.'));
  }else{
    var bars=h('div',{class:'bars'});
    [['Character',r.character,'Higher = worse traits and flags'],['Track record',r.track,'Needs a log entry or a favour'],['Exposure',r.exposure,'What they could hurt']].forEach(function(b){
      bars.append(h('div',{class:'rbar'},h('span',{class:'bk'},b[0]),h('span',{class:'bt',title:b[2]},h('i',{style:'width:'+(b[1]===null?0:b[1])+'%;background:'+li.color})),h('span',{class:'bv'},b[1]===null?'n/a':String(b[1]))));
    });
    box.append(bars);
    var ex=PR.explain(riskInput(p),riskContext(p));
    if(ex.up.length){
      box.append(h('div',{class:'mini-h'},'Why this rating'));
      var ul=h('ul',{class:'why','data-why':'up'});
      ex.up.forEach(function(w){ul.append(h('li',{class:w.big?'':'m'},w.text,h('span',{class:'w'},'+'+w.pts)))});
      box.append(ul);
    }
    if(ex.favour.length){
      box.append(h('div',{class:'mini-h ok'},'In their favour'));
      var ul2=h('ul',{class:'why good','data-why':'fav'});
      ex.favour.forEach(function(t){ul2.append(h('li',{},t))});
      box.append(ul2);
    }
    if(ex.note)box.append(h('div',{class:'muted',style:'margin-top:6px'},ex.note));
  }
  // override
  var ol=c.override,sel=h('select',{id:'ovlevel'},h('option',{value:''},'No override (use computed)'));
  ['low','medium','high','critical'].forEach(function(k){sel.append(h('option',{value:k,selected:ol.level===k},PR.LEVELS[k].label))});
  var why=h('input',{type:'text',id:'ovreason',placeholder:'Reason (required, e.g. "knows me from before")',value:ol.reason,maxlength:200});
  var err=h('div',{class:'fl',id:'ovmsg',style:'min-height:16px;font-size:12px'});
  var apply=function(){
    var lv=sel.value,rs=why.value.trim();
    if(lv&&rs.length<3){err.textContent='Please write a reason (at least 3 characters).';return}
    c.override={level:lv,reason:lv?rs:''};afterChar();toast(lv?'Override saved':'Override cleared');
  };
  box.append(h('div',{class:'ovr'},h('span',{class:'ol'},'Override'),sel,why,h('button',{class:'small',id:'ovapply',onclick:apply},'Apply')),err);
  var how=h('details',{class:'howcalc',id:'howcalc'},h('summary',{},'How is this calculated?'));
  PR.HOW_TEXT.forEach(function(t){how.append(h('p',{class:'sub'},t))});
  box.append(how);
  return box;
}
function ptCharacter(b,p){
  var c=charOf(p);
  b.append(h('div',{class:'phead'},h('span',{class:'sq'},p.code.replace(/^P/,'')),h('div',{},h('div',{class:'pn'},plainName(p)),h('div',{class:'ps'},(p.group||'no group')+' · '+linksOf(p.id).length+' lines'))));
  b.append(h('div',{class:'help'},'Private notes for you only (encrypted like everything else). Rate what you have actually seen. Leave a trait empty if you do not know.'));
  // traits
  b.append(h('h3',{},'Character traits'));
  var tt=h('div',{id:'traits'});
  PR.TRAIT_KEYS.forEach(function(k){
    var v=c.traits[k];
    tt.append(h('div',{class:'trait','data-trait':k},h('span',{class:'tn'},PR.TRAIT_LABEL[k]),ratingSquares(v,function(n){c.traits[k]=n;afterChar()}),h('span',{class:'tv'},v?v+' / 5':'—')));
  });
  b.append(tt,h('div',{class:'autoline'},'Average ',h('b',{},traitAvg(p)?traitAvg(p).toFixed(1):'—'),' · rated ',h('b',{},String(PR.TRAIT_KEYS.filter(function(k){return c.traits[k]>0}).length+' of 6'))));
  // flags
  b.append(h('h3',{},'Flags'));
  var fg=h('div',{class:'flags'}),gcol=h('div',{class:'g'},h('h4',{},'Green flags')),rcol=h('div',{class:'r'},h('h4',{},'Red flags'));
  allFlags().forEach(function(f){
    var on=c.flags.indexOf(f.id)>=0;
    var cb=h('input',{type:'checkbox',checked:on,'data-flag':f.id,onchange:function(){
      var i=c.flags.indexOf(f.id);if(cb.checked&&i<0)c.flags.push(f.id);else if(!cb.checked&&i>=0)c.flags.splice(i,1);afterChar();
    }});
    (f.kind==='green'?gcol:rcol).append(h('label',{class:'cfl'+(on?' hit':'')},cb,f.name));
  });
  fg.append(gcol,rcol);b.append(fg);
  var nf=h('input',{type:'text',placeholder:'Your own flag, e.g. "Always late"',maxlength:60,id:'newflag'}),nk=h('select',{id:'newflagkind'},h('option',{value:'red'},'Red'),h('option',{value:'green'},'Green'));
  b.append(h('div',{class:'row addflag'},nf,h('span',{class:'fixed'},nk),h('button',{class:'small fixed',id:'addflag',onclick:function(){
    var nm=nf.value.trim();if(!nm){toast('Type a name for the flag');return}
    var f={id:uid('cf'),name:nm,kind:nk.value};S.customFlags.push(f);c.flags.push(f.id);afterChar();
  }},'Add')));
  // evidence
  b.append(h('h3',{},'Evidence log'),h('div',{class:'muted'},'Things that actually happened. Recent entries count more.'));
  var ev=c.evidence.slice().sort(function(a,b2){return a.date<b2.date?1:-1});
  var elist=h('div',{id:'evlist'});
  if(!ev.length)elist.append(h('div',{class:'muted',style:'padding:4px 0'},'Nothing logged yet.'));
  ev.forEach(function(e){
    elist.append(h('div',{class:'evrow'},h('span',{class:e.effect==='good'?'good':'bad'},e.effect==='good'?'GOOD':'BAD'),h('span',{class:'mono sub fixed'},e.date),h('span',{class:'grow'},e.text),
      h('button',{class:'small danger fixed',title:'Remove entry',onclick:function(){c.evidence=c.evidence.filter(function(x){return x!==e});afterChar()}},'✕')));
  });
  b.append(elist);
  var eff='good',seg=h('div',{class:'seg',id:'evseg'}),sg=h('span',{class:'on','data-e':'good'},'Good'),sb2=h('span',{'data-e':'bad'},'Bad');
  sg.onclick=function(){eff='good';sg.classList.add('on');sb2.classList.remove('on')};
  sb2.onclick=function(){eff='bad';sb2.classList.add('on');sg.classList.remove('on')};
  seg.append(sg,sb2);
  var ed=h('input',{type:'date',value:todayISO(),id:'evdate'}),et=h('input',{type:'text',placeholder:'What happened?',maxlength:400,id:'evtext'});
  b.append(h('div',{class:'row',style:'margin-top:6px'},h('span',{class:'fixed',style:'width:110px'},seg),ed),h('div',{class:'row',style:'margin-top:4px'},et,h('button',{class:'small fixed',id:'addev',onclick:function(){
    var t=et.value.trim();if(!t){toast('Write what happened first');return}
    c.evidence.push({id:uid('v'),date:isoOk(ed.value)||todayISO(),effect:eff,text:t});afterChar();
  }},'Add')));
  // gut feel
  b.append(h('h3',{},'Gut feel'));
  var gt=h('input',{type:'text',value:c.gut.text,maxlength:300,id:'guttext',placeholder:'One line, your own words',oninput:function(){c.gut.text=gt.value;save()}});
  var cf=h('div',{class:'seg',id:'confseg'});
  [['new','Just met'],['months','Months'],['years','Years']].forEach(function(x){cf.append(h('span',{class:c.gut.confidence===x[0]?'on':'','data-conf':x[0],onclick:function(){c.gut.confidence=c.gut.confidence===x[0]?'':x[0];afterChar()}},x[1]))});
  b.append(gt,h('div',{class:'muted',style:'margin:6px 0 3px'},'How long have you known them?'),cf);
  // exposure
  b.append(h('h3',{},'Exposure'));
  var cp=h('input',{type:'checkbox',checked:c.exposure.private,id:'expPriv',onchange:function(){c.exposure.private=cp.checked;afterChar()}}),cm=h('input',{type:'checkbox',checked:c.exposure.money,id:'expMoney',onchange:function(){c.exposure.money=cm.checked;afterChar()}});
  b.append(h('div',{class:'autoline'},'Knows ',h('b',{},String(contactsOf(p.id))),' of your people (worked out from the lines)'),
    h('label',{class:'cfl'},cp,'Knows private things about you'),h('label',{class:'cfl'},cm,'Is in your money or deals'));
  b.append(riskBox(p));
}
function panelRisk(b){
  b.append(h('h2',{},'Risk'));
  if(!S.showRisk){b.append(h('div',{class:'help'},'Risk marks are switched off. Press R or use "Show risk" in the key to turn them back on.'));return}
  if(S.hideSens){b.append(h('div',{class:'help'},'Risk marks are hidden (press H to show them). Handy if someone is looking at your screen.'));return}
  b.append(h('div',{class:'help'},'A private decision aid: how much could go wrong if you share things with each person. Click a row to open their Character tab.'));
  var rows=S.people.filter(function(p){return !p.isMe}).map(function(p){return {p:p,rv:riskOfPerson(p)}});
  rows.sort(function(a,c){var ra=PR.LEVELS[a.rv.level].rank,rc=PR.LEVELS[c.rv.level].rank;return rc-ra||(c.rv.score||0)-(a.rv.score||0)||a.p.name.localeCompare(c.p.name)});
  var tb=h('table',{class:'tbl wl',id:'risktbl'},h('tr',{},h('th',{},'Person'),h('th',{},'Risk'),h('th',{class:'r'},'Score'),h('th',{},'Main reason')));
  rows.forEach(function(x){
    var li=PR.LEVELS[x.rv.level],ex=PR.explain(riskInput(x.p),riskContext(x.p)),top=ex.up[0];
    tb.append(h('tr',{class:'click','data-pid':x.p.id,onclick:function(){tab='people';select({kind:'person',id:x.p.id});ptab='character';renderTabs();renderPanel()}},
      h('td',{},plainName(x.p)),h('td',{},lvTag(x.rv.level,x.rv.overridden)),
      h('td',{class:'r num','data-score':x.rv.score===null?'':x.rv.score},x.rv.score===null?'—':String(x.rv.score)),
      h('td',{class:'sub'},top?top.text:x.rv.score===null?'Rate 3+ traits':'')));
  });
  b.append(tb);
}
function meetWarnings(sg){
  var out=[];
  [[sg.a,sg.b],[sg.b,sg.a]].forEach(function(pr){
    var rv=riskOfPerson(pr[0]);
    if(!riskVisible()||(rv.level!=='high'&&rv.level!=='critical'))return;
    var ex=PR.explain(riskInput(pr[0]),riskContext(pr[0]));
    out.push({p:pr[0],other:pr[1],level:rv.level,why:ex.up.slice(0,2).map(function(x){return x.text})});
  });
  return out;
}
