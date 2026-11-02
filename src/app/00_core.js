var DRIFT_DAYS=90;
var THEME={ratings:{0:'#5c5c5c',1:'#c0504d',2:'#c98a3a',3:'#c9b84a',4:'#8cbf6a',5:'#1f8f55'},me:'#262626',meGlyph:'ME',initialColor:'#fff',initialStroke:'none',scale:0.56,spread:0.82,lineScale:0.5,glow:false,badges:null,cake:null,terminal:true,shape:'square',codes:true,drift:true,corner:0,
 types:[
 {id:'family',name:'Family',color:'#e6e6e6'},
 {id:'friend',name:'Friend',color:'#4a90e2'},
 {id:'work',name:'Work',color:'#2bb3c0'},
 {id:'business',name:'Investor / business',color:'#8b7bdc'},
 {id:'mentor',name:'Mentor',color:'#a9b4ff'},
 {id:'partner',name:'Romantic / partner',color:'#c77dd8'},
 {id:'introduced',name:'Introduced by Georgia',color:'#e6e6e6',dashed:true},
 {id:'metvia',name:'Met through someone',color:'#2bb3c0',dotted:true}]};
var DEFAULT_TYPES=THEME.types||[
 {id:'family',name:'Family',color:'#8a5a3c'},
 {id:'friend',name:'Friend',color:'#2f80ed'},
 {id:'work',name:'Work',color:'#0891b2'},
 {id:'business',name:'Investor / business',color:'#4f46e5'},
 {id:'mentor',name:'Mentor',color:'#9333ea'},
 {id:'partner',name:'Romantic / partner',color:'#ec4899'},
 {id:'introduced',name:'Introduced by Georgia',color:'#1e3a8a',dashed:true},
 {id:'metvia',name:'Met through someone',color:'#c026d3',dotted:true}
];
var OLD_TYPE_COLORS={family:['#e4572e'],friend:['#2fa84f'],work:['#3a7bd5'],business:['#8e44ad'],mentor:['#e0a100'],partner:['#e83e8c'],introduced:['#00a6b8']};
var RATING_COLORS=THEME.ratings;
var DEFAULT_RATING_LABELS={0:'Not rated',1:"Can't trust",2:'Careful',3:'Okay',4:'Good',5:'Excellent person'};
var PR=window.PMRisk;
var PM=window.PMLib;

/* ---------- helpers ---------- */
function $(s){return document.querySelector(s)}
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function h(tag,props){
  var e=document.createElement(tag),kids=Array.prototype.slice.call(arguments,2).flat(Infinity);
  kids.forEach(function(c){if(c===null||c===undefined||c===false)return;e.append(c instanceof Node?c:document.createTextNode(String(c)))});
  for(var k in (props||{})){var v=props[k];
    if(k==='class')e.className=v;
    else if(k==='style')e.style.cssText=v;
    else if(k.slice(0,2)==='on')e.addEventListener(k.slice(2),v);
    else if(k==='for')e.htmlFor=v;
    else if(k in e&&k!=='list')e[k]=v;
    else e.setAttribute(k,v);
  }
  return e;
}
var NS='http://www.w3.org/2000/svg';
function s(tag,attrs){var e=document.createElementNS(NS,tag);for(var k in (attrs||{}))e.setAttribute(k,attrs[k]);return e}
function toast(msg){var t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(function(){t.classList.remove('on')},2800)}
function splitList(str){return String(str||'').split(',').map(function(x){return x.trim()}).filter(Boolean)}
function norm(w){w=String(w).toLowerCase().replace(/\s+/g,' ').trim();if(w.length>4&&w.slice(-1)==='s')w=w.slice(0,-1);return w}
function trunc(t,n){return t.length>n?t.slice(0,n-1)+'…':t}
function plainName(p){return p.name.replace(/^Example:\s*/,'')}
function pad2(n){return (n<10?'0':'')+n}
function clampInt(v,lo,hi,dflt){v=Math.round(+v);return isFinite(v)&&v>=lo&&v<=hi?v:dflt}
function strOf(v,max){return String(v===undefined||v===null?'':v).slice(0,max||2000)}
function isoOk(v){return PM.parseISO(v)?String(v):''}
function todayISO(){var t=PM.fromDayNum(PM.todayNum(new Date()));return PM.toISO(t.y,t.m,t.d)}
function TN(){return PM.todayNum(new Date())}

/* ---------- data ---------- */
function newMe(){return {id:'me',name:'Georgia',isMe:true,code:'ME',note:'',group:'',rating:0,offers:[],needs:[],x:0,y:0,vx:0,vy:0,pinned:true,lastTalked:'',bday:null,dates:[],likes:'',gifts:[],ideas:'',metBy:'',metHow:'',metDate:'',events:[]}}
function fresh(){return {people:[newMe()],links:[],types:JSON.parse(JSON.stringify(DEFAULT_TYPES)),hidden:{},hiddenRatings:{},ratingLabels:JSON.parse(JSON.stringify(DEFAULT_RATING_LABELS)),favours:[],lastBackup:'',nextCode:1,typesV:2,view:null,customFlags:[],showRisk:true,circleFrom:'rating',hideSens:false}}
function sanitizeBday(b){
  if(!b||typeof b!=='object')return null;
  var m=clampInt(b.m,1,12,0),d=clampInt(b.d,1,31,0);if(!m||!d||d>PM.daysInMonth(m,0))return null;
  var y=clampInt(b.y,1900,2200,0);return {m:m,d:d,y:y||0};
}
var CONFIDENCES=['','new','months','years'];
function sanitizeChar(c){
  c=c&&typeof c==='object'?c:{};
  var out={traits:{},flags:[],evidence:[],gut:{text:'',confidence:''},exposure:{private:false,money:false},override:{level:'',reason:''}};
  PR.TRAIT_KEYS.forEach(function(k){out.traits[k]=clampInt(c.traits&&c.traits[k],0,5,0)});
  var seen={};
  (Array.isArray(c.flags)?c.flags:[]).forEach(function(f){f=strOf(f,60);if(f&&!seen[f]){seen[f]=1;out.flags.push(f)}});
  (Array.isArray(c.evidence)?c.evidence:[]).forEach(function(e){
    if(!e||(e.effect!=='good'&&e.effect!=='bad'))return;
    var t=strOf(e.text,400).trim();if(!t)return;
    out.evidence.push({id:strOf(e.id||uid('v'),40),date:isoOk(e.date)||todayISO(),effect:e.effect,text:t});
  });
  if(c.gut&&typeof c.gut==='object'){out.gut.text=strOf(c.gut.text,300);out.gut.confidence=CONFIDENCES.indexOf(c.gut.confidence)>=0?c.gut.confidence:''}
  if(c.exposure&&typeof c.exposure==='object'){out.exposure.private=!!c.exposure.private;out.exposure.money=!!c.exposure.money}
  if(c.override&&typeof c.override==='object'){
    var lv=c.override.level,rs=strOf(c.override.reason,200).trim();
    if(['low','medium','high','critical'].indexOf(lv)>=0&&rs.length>=3){out.override.level=lv;out.override.reason=rs}
  }
  return out;
}
function sanitizeFlags(a){
  var out=[],seen={};
  (Array.isArray(a)?a:[]).forEach(function(f){
    if(!f||!f.id)return;var id=strOf(f.id,60);if(seen[id])return;seen[id]=1;
    out.push({id:id,name:strOf(f.name||'Flag',60),kind:f.kind==='green'?'green':'red'});
  });
  return out;
}
function sanitize(d){
  if(!d||!Array.isArray(d.people)||!Array.isArray(d.links))throw new Error('This does not look like a Nodle backup.');
  var out=fresh();
  out.types=Array.isArray(d.types)&&d.types.length?d.types.map(function(t){return {id:strOf(t.id,60),name:strOf(t.name||'Type',60),color:/^#[0-9a-f]{6}$/i.test(t.color)?t.color:'#888888',dashed:!!t.dashed,dotted:!!t.dotted}}):out.types;
  // old versions used red/green/orange line colours that looked like the circle colours: move them to the new palette
  if(!d.typesV||d.typesV<2){
    out.types.forEach(function(t){
      var olds=OLD_TYPE_COLORS[t.id];
      if(olds&&olds.indexOf(String(t.color).toLowerCase())>=0){
        var def=DEFAULT_TYPES.filter(function(x){return x.id===t.id})[0];
        if(def){t.color=def.color;t.dashed=!!def.dashed;t.dotted=!!def.dotted}
      }
    });
  }
  if(!out.types.some(function(t){return t.id==='metvia'})){var mv=DEFAULT_TYPES.filter(function(x){return x.id==='metvia'})[0];if(mv)out.types.push({id:mv.id,name:mv.name,color:mv.color,dashed:false,dotted:true})}
  var ids={};
  out.people=[];
  var maxCode=0;
  d.people.forEach(function(p){
    if(!p||!p.id||ids[p.id])return;ids[p.id]=1;
    var cm=/^P(\d+)$/.exec(String(p.code||''));if(cm)maxCode=Math.max(maxCode,+cm[1]);
    out.people.push({id:strOf(p.id,60),name:strOf(p.name||'Unnamed',120),isMe:p.id==='me',code:p.id==='me'?'ME':(cm?String(p.code):''),note:strOf(p.note),group:strOf(p.group,80),rating:p.id==='me'?0:clampInt(p.rating,0,5,0),
      offers:Array.isArray(p.offers)?p.offers.map(String):[],needs:Array.isArray(p.needs)?p.needs.map(String):[],
      x:+p.x||0,y:+p.y||0,vx:0,vy:0,pinned:p.id==='me'||!!p.pinned,
      lastTalked:isoOk(p.lastTalked),bday:sanitizeBday(p.bday),
      dates:Array.isArray(p.dates)?p.dates.map(function(k){var m=clampInt(k&&k.m,1,12,0),dd=clampInt(k&&k.d,1,31,0);if(!m||!dd||dd>PM.daysInMonth(m,0))return null;return {id:strOf(k.id||uid('k'),40),label:strOf(k.label||'Key date',60),m:m,d:dd,y:clampInt(k.y,1900,2200,0)}}).filter(Boolean):[],
      likes:strOf(p.likes),ideas:strOf(p.ideas),
      gifts:Array.isArray(p.gifts)?p.gifts.map(function(g){return g?{id:strOf(g.id||uid('g'),40),date:isoOk(g.date),what:strOf(g.what,200)}:null}).filter(Boolean):[],
      metBy:strOf(p.metBy,60),metHow:strOf(p.metHow,300),metDate:isoOk(p.metDate),
      events:Array.isArray(p.events)?p.events.map(function(e){return strOf(e,40).trim()}).filter(Boolean):[],character:p.id==='me'?null:sanitizeChar(p.character)});
  });
  if(!ids.me)out.people.unshift(newMe());
  out.people.forEach(function(p){if(p.metBy&&(!ids[p.metBy]&&p.metBy!=='me'||p.metBy===p.id))p.metBy=''});
  out.people.forEach(function(p){if(!p.code){p.code='P'+pad2(++maxCode)}});
  out.nextCode=maxCode+1;
  var tids={};out.types.forEach(function(t){tids[t.id]=1});
  out.links=[];
  d.links.forEach(function(l){
    if(!l||!ids[l.a]&&l.a!=='me'||!ids[l.b]&&l.b!=='me'||l.a===l.b)return;
    if(!tids[l.type])return;
    out.links.push({id:strOf(l.id||uid('l'),40),a:l.a,b:l.b,type:l.type,note:strOf(l.note,300),strength:clampInt(l.strength,1,3,2)});
  });
  out.favours=[];
  (Array.isArray(d.favours)?d.favours:[]).forEach(function(f){
    if(!f||(f.from!=='me'&&!ids[f.from])||(f.to!=='me'&&!ids[f.to])||f.from===f.to)return;
    if(f.from!=='me'&&f.to!=='me')return;
    out.favours.push({id:strOf(f.id||uid('f'),40),from:f.from,to:f.to,what:strOf(f.what,200),date:isoOk(f.date)});
  });
  out.hidden=d.hidden&&typeof d.hidden==='object'?d.hidden:{};
  out.hiddenRatings=d.hiddenRatings&&typeof d.hiddenRatings==='object'?d.hiddenRatings:{};
  for(var rk=0;rk<=5;rk++){var lb=d.ratingLabels&&d.ratingLabels[rk];if(typeof lb==='string'&&lb.trim())out.ratingLabels[rk]=lb.trim().slice(0,40)}
  out.lastBackup=isoOk(d.lastBackup);
  out.view=null;
  out.customFlags=sanitizeFlags(d.customFlags);
  out.showRisk=d.showRisk!==false;
  out.circleFrom=d.circleFrom==='traits'?'traits':'rating';
  out.hideSens=!!d.hideSens;
  return out;
}

