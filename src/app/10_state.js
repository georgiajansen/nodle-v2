/* ---------- state ---------- */
var S=fresh();
var view={x:0,y:0,k:1};
var hadView=false;
var sel=null;           // {kind:'person'|'link', id}
var tab='people';
var ptab='basics';
var query='';
var timeCut=null;       // day number: hide people met after this
var eventSel=[];        // event tags currently picked in the Events tab
var pathTarget='';
var pathRes=null;
var upRange=30;

function person(id){for(var i=0;i<S.people.length;i++)if(S.people[i].id===id)return S.people[i];return null}
function typeOf(id){for(var i=0;i<S.types.length;i++)if(S.types[i].id===id)return S.types[i];return null}
function me(){return person('me')}
function personShown(p){
  if(p.isMe)return true;
  if(S.hiddenRatings[p.rating])return false;
  if(timeCut!==null){var q=PM.parseISO(p.metDate);if(q&&q.num>timeCut)return false}
  return true;
}
function visiblePeople(){return S.people.filter(personShown)}
function metLinks(){
  var out=[];
  S.people.forEach(function(p){
    var o=p.metBy?person(p.metBy):null;
    if(o&&o.id!==p.id)out.push({id:'mv:'+p.id,a:o.id,b:p.id,type:'metvia',strength:1,note:plainName(o)+' introduced Georgia to '+plainName(p),virtual:true});
  });
  return out;
}
function allLinks(){return S.links.concat(metLinks())}
function linksOf(id){return allLinks().filter(function(l){return l.a===id||l.b===id})}
function connected(a,b){return allLinks().some(function(l){return (l.a===a&&l.b===b)||(l.a===b&&l.b===a)})}
function visibleLinks(){return allLinks().filter(function(l){var a=person(l.a),b=person(l.b);return !S.hidden[l.type]&&a&&b&&personShown(a)&&personShown(b)})}
function fillRating(p){return S.circleFrom==='traits'?Math.round(traitAvg(p)):(p.rating||0)}
function ratingColor(p){return p.isMe?THEME.me:RATING_COLORS[fillRating(p)]}
function ratingLabel(r){return S.ratingLabels[r]||DEFAULT_RATING_LABELS[r]}
function ensureIntroType(){
  var t=typeOf('introduced');
  if(!t){var d=DEFAULT_TYPES.filter(function(x){return x.id==='introduced'})[0]||{color:'#1e3a8a'};t={id:'introduced',name:'Introduced by Georgia',color:d.color,dashed:true};S.types.push(t)}
  S.hidden.introduced=false;
  return t;
}

/* ---------- derived: last talked, birthdays, favours ---------- */
function daysSince(p){var q=PM.parseISO(p.lastTalked);return q?TN()-q.num:null}
function fadeOf(p){
  if(p.isMe)return 1;
  var ds=daysSince(p);
  if(ds===null||ds<=DRIFT_DAYS)return 1;
  return Math.max(0.35,1-(ds-DRIFT_DAYS)/(365-DRIFT_DAYS)*0.65);
}
function isDrifting(p){if(p.isMe)return false;var ds=daysSince(p);return ds!==null&&ds>=DRIFT_DAYS}
function driftingList(){
  return S.people.filter(isDrifting).sort(function(a,b){return daysSince(b)-daysSince(a)});
}
function upcomingItems(range){
  var t=TN(),out=[];
  S.people.forEach(function(p){
    if(p.bday){
      var o=PM.nextOccurrence(p.bday.m,p.bday.d,t);
      if(o.days<=range)out.push({p:p,kind:'Birthday',label:'Birthday',m:p.bday.m,d:p.bday.d,days:o.days,year:o.year,age:p.bday.y?o.year-p.bday.y:null});
    }
    p.dates.forEach(function(k){
      var o=PM.nextOccurrence(k.m,k.d,t);
      if(o.days<=range)out.push({p:p,kind:'Date',label:k.label,m:k.m,d:k.d,days:o.days,year:o.year,age:k.y?o.year-k.y:null});
    });
  });
  out.sort(function(a,b){return a.days-b.days||a.p.name.localeCompare(b.p.name)});
  return out;
}
function favoursOf(id){
  var they=0,mine=0,list=[];
  S.favours.forEach(function(f){
    if(f.from===id&&f.to==='me'){they++;list.push(f)}
    else if(f.from==='me'&&f.to===id){mine++;list.push(f)}
  });
  return {they:they,mine:mine,net:they-mine,list:list};
}
function balanceText(net,any){
  if(!any)return 'No favours logged';
  if(net>0)return 'You owe them '+net;
  if(net<0)return 'They owe you '+(-net);
  return 'Even';
}
function openFavourCount(){
  var n=0;S.people.forEach(function(p){if(!p.isMe&&favoursOf(p.id).net!==0)n++});return n;
}
function allEventTags(){
  var map={};
  S.people.forEach(function(p){p.events.forEach(function(e){var k=e.toLowerCase();(map[k]=map[k]||{tag:e,people:[]}).people.push(p)})});
  return Object.keys(map).sort().map(function(k){return map[k]});
}
function peopleWithTags(tags){
  var set={};tags.forEach(function(t){set[t.toLowerCase()]=1});
  return S.people.filter(function(p){return p.events.some(function(e){return set[e.toLowerCase()]})});
}

/* ---------- path finder: shortest chain from Georgia (plain Dijkstra, no AI) ---------- */
function findPath(targetId){
  var links=allLinks(),adj={};
  links.forEach(function(l){
    if(!person(l.a)||!person(l.b))return;
    var c=1+(3-l.strength)*0.05;
    (adj[l.a]=adj[l.a]||[]).push({to:l.b,l:l,c:c});(adj[l.b]=adj[l.b]||[]).push({to:l.a,l:l,c:c});
  });
  var dist={me:0},prev={},done={},q=['me'];
  while(q.length){
    var best=0;for(var i=1;i<q.length;i++)if(dist[q[i]]<dist[q[best]])best=i;
    var u=q.splice(best,1)[0];if(done[u])continue;done[u]=1;
    if(u===targetId)break;
    (adj[u]||[]).forEach(function(e){
      var nd=dist[u]+e.c;
      if(dist[e.to]===undefined||nd<dist[e.to]-1e-9){dist[e.to]=nd;prev[e.to]={from:u,l:e.l};q.push(e.to)}
    });
  }
  if(dist[targetId]===undefined)return null;
  var steps=[],cur=targetId;
  while(cur!=='me'){var pv=prev[cur];steps.unshift({from:pv.from,to:cur,link:pv.l});cur=pv.from}
  return {steps:steps};
}

/* ---------- example data (all made up; dates are relative to today so the example always has something coming up) ---------- */
function exampleData(){
  var d=fresh(),t=TN(),code=0;
  function dt(off){var x=PM.fromDayNum(t+off);return PM.toISO(x.y,x.m,x.d)}
  function bd(off,age){var x=PM.fromDayNum(t+off);return {m:x.m,d:x.d,y:age?x.y-age:0}}
  function P(id,name,group,note,offers,needs,rating,extra){
    var p={id:id,name:name,isMe:false,code:'P'+pad2(++code),note:note,group:group,rating:rating||0,offers:offers,needs:needs,x:0,y:0,vx:0,vy:0,pinned:false,lastTalked:'',bday:null,dates:[],likes:'',gifts:[],ideas:'',metBy:'',metHow:'',metDate:'',events:[],character:sanitizeChar(null)};
    for(var k in extra)p[k]=extra[k];
    d.people.push(p);return p;
  }
  function G(off,what){return {id:uid('g'),date:dt(off),what:what}}
  P('e1','Example: Mum','Family','Fake example person.',[],[],5,{bday:bd(3,64),lastTalked:dt(-2),likes:'Orchids, jasmine tea, long Sunday lunches',gifts:[G(-300,'Silk scarf'),G(-665,'Tea set')],ideas:'Pottery class voucher',metHow:'Family',events:['family']});
  P('e2','Example: Brother Sam','Family','Fake example person.',['hiring'],['career advice'],4,{bday:bd(9,33),lastTalked:dt(-10),likes:'Craft beer, trail running',gifts:[G(-340,'Running shoes')],ideas:'Running watch, concert tickets',metHow:'Family'});
  P('e3','Example: Cousin Ivy','Family','Fake example person.',[],['funding'],3,{bday:bd(17,0),lastTalked:dt(-40),likes:'Illustration, bubble tea',ideas:'Sketchbook and brush pens',metHow:'Family'});
  P('e4','Example: Alex (polo club)','Polo','Fake. Plays polo most weekends.',['polo','horses'],['sponsors'],4,{bday:bd(29,0),lastTalked:dt(-20),likes:'Single malt, vintage watches',gifts:[G(-150,'Leather polo gloves')],ideas:'Club tie, whisky tasting',metBy:'e12',metHow:'Introduced at a charity dinner',metDate:'2017-06-10',events:['polo']});
  P('e5','Example: Wei (polo coach)','Polo','Fake. Coaches beginners.',['polo'],['sponsors'],5,{bday:bd(45,41),lastTalked:dt(-70),likes:'Tea, ponies',metBy:'e4',metHow:'Alex brought him to the club',metDate:'2018-03-04',events:['polo']});
  P('e6','Example: Priya (school friend)','Friends','Fake example person.',[],['career advice'],5,{bday:bd(120,34),lastTalked:dt(-15),dates:[{id:uid('k'),label:'Friendship anniversary',m:PM.fromDayNum(t+11).m,d:PM.fromDayNum(t+11).d,y:2012}],likes:'Hiking, natural wine',gifts:[G(-420,'Hiking boots')],ideas:'Weekend away voucher',metHow:'Same class at school',metDate:'2012-09-03',events:['charity gala']});
  P('e7','Example: Nina (student)','Friends','Fake. Wants to try polo.',[],['polo','career advice'],3,{bday:bd(200,22),lastTalked:dt(-130),likes:'Anime, ramen',metBy:'e6',metHow:'Priya\'s younger cousin',metDate:'2019-05-20',events:['polo']});
  P('e8','Example: Marcus (commodities trader)','Finance','Fake. Trades oil and metals.',['commodities','trading advice'],['hiring'],2,{bday:bd(12,48),lastTalked:dt(-100),likes:'Cigars, golf, sailing',gifts:[G(-380,'Bottle of rum')],ideas:'Golf lesson',metBy:'e12',metHow:'Lunch arranged by Dr Lim',metDate:'2015-11-18',events:['commodities']});
  P('e9','Example: Helen (angel investor)','Finance','Fake. Invests in early startups.',['funding'],['deal ideas'],4,{bday:bd(80,52),lastTalked:dt(-200),likes:'Opera, modern art',gifts:[G(-500,'Opera tickets')],ideas:'Book on venture history',metBy:'e8',metHow:'Marcus\'s dinner party',metDate:'2020-02-12',events:['startups','charity gala']});
  P('e10','Example: Omar (art gallery owner)','Arts','Fake. Runs a small gallery.',['art','event venue'],['sponsors'],3,{bday:bd(24,45),lastTalked:dt(-60),likes:'Espresso, ceramics',ideas:'Limited-edition print',metBy:'e11',metHow:'Gallery opening',metDate:'2022-04-22',events:['art','charity gala']});
  P('e11','Example: Tara (event organiser)','Arts','Fake. Runs charity events.',['events','sponsors'],['art','event venue'],4,{bday:bd(1,38),lastTalked:dt(-5),likes:'Champagne, jazz, linen notebooks',gifts:[G(-365,'Jazz festival tickets'),G(-730,'Fountain pen')],ideas:'Signed jazz vinyl',metBy:'e12',metHow:'Dr Lim\'s charity table',metDate:'2021-09-30',events:['art','charity gala']});
  P('e12','Example: Dr Lim (mentor)','Finance','Fake. Retired bank director.',['career advice','commodities'],[],5,{bday:bd(250,67),lastTalked:dt(-25),likes:'Chess, oolong tea',gifts:[G(-200,'Chess clock')],ideas:'First-edition economics book',metHow:'Speaker at a university talk',metDate:'2014-03-15',events:['commodities']});
  P('e13','Example: Chloe (startup founder)','Startups','Fake. Building an app.',['design'],['funding','commodities'],2,{bday:bd(300,29),lastTalked:dt(-300),likes:'Oat flat whites, board games',metBy:'e12',metHow:'Pitch evening Dr Lim hosted',metDate:'2023-06-08',events:['startups','commodities']});
  P('e14','Example: Ben (recruiter)','Startups','Fake. Finds people for jobs.',['hiring','jobs'],[],1,{bday:bd(150,36),lastTalked:dt(-400),metBy:'e13',metHow:'Chloe\'s hiring round',metDate:'2024-01-16',events:['startups']});
  P('e15','Example: Jordan (partner)','Friends','Fake example person.',[],[],0,{bday:bd(60,35),lastTalked:dt(-1),dates:[{id:uid('k'),label:'Anniversary',m:PM.fromDayNum(t+21).m,d:PM.fromDayNum(t+21).d,y:2019}],likes:'Dark chocolate, sailing, old films',gifts:[G(-250,'Weekend in Penang')],ideas:'Framed star map',metHow:'Mutual friends',metDate:'2019-08-17'});
  P('e16','Example: Raj (polo sponsor)','Polo','Fake. Looking for teams to back.',['sponsors'],['polo'],3,{bday:bd(95,44),lastTalked:dt(-35),likes:'Cricket, cars',metBy:'e4',metHow:'Alex introduced him at a match',metDate:'2025-03-09',events:['polo']});
  P('e17','Example: Sofia (gallery curator)','Arts','Fake. Curates touring shows.',['art','event venue'],[],0,{bday:bd(180,40),events:['art']});
  P('e18','Example: Kenji (commodities broker)','Finance','Fake. Runs a small brokerage.',['commodities'],['deal ideas'],0,{bday:bd(70,50),events:['commodities']});
  P('e19','Example: Ana (fund manager)','Finance','Fake. Manages a family fund.',['funding'],['commodities'],0,{bday:bd(220,46),events:['startups']});
  function L(a,b,type,strength,note){d.links.push({id:uid('l'),a:a,b:b,type:type,strength:strength,note:note||''})}
  L('me','e1','family',3);L('me','e2','family',3);L('me','e3','family',2);
  L('me','e4','friend',2,'Met at the polo club');L('me','e5','friend',2);L('me','e6','friend',3,'Since school');L('me','e7','friend',1);
  L('me','e8','work',2);L('me','e9','business',2,'Might invest');L('me','e10','business',1);L('me','e11','work',2);
  L('me','e12','mentor',3,'Monthly coffee');L('me','e13','business',2);L('me','e14','work',1);L('me','e15','partner',3);L('me','e16','friend',1);
  L('e1','e2','family',3);
  L('e4','e5','friend',3);L('e6','e7','friend',2);L('e8','e12','mentor',2,'Dr Lim taught him');
  L('e10','e11','work',2);L('e9','e10','introduced',2,'Georgia introduced them');L('e13','e12','mentor',1);
  L('e10','e17','work',2,'Hosts her shows');L('e11','e17','friend',2);
  L('e8','e18','business',2,'Uses him as a broker');L('e18','e19','business',2);L('e16','e11','work',1,'Sponsors her events');L('e16','e10','business',1);
  function F(from,to,what,off){d.favours.push({id:uid('f'),from:from,to:to,what:what,date:dt(off)})}
  F('me','e8','Introduced him to a client',-170);F('me','e8','Lent him my contacts list',-80);
  F('me','e16','Wrote him a reference',-200);F('me','e16','Hosted him at a match',-110);F('me','e16','Lent him money (small)',-50);
  F('me','e18','Passed him a lead',-95);
  F('e9','me','Investor introduction',-210);F('e9','me','Reviewed my plan',-130);
  F('e6','me','Helped me move house',-300);F('e6','me','Lent me her car',-100);
  F('me','e13','Reviewed her pitch deck',-90);F('me','e13','Introduced her to Helen',-75);
  F('e4','me','Lent me a polo mallet set',-45);
  F('me','e11','Gave her a speaking slot',-30);
  /* character profiles for some of the example people (all made up) */
  function C(id,traits,red,green,ev,exp,gut){
    var c=sanitizeChar(null);
    PR.TRAIT_KEYS.forEach(function(k,i){c.traits[k]=traits[i]});
    c.flags=red.concat(green);
    c.evidence=ev.map(function(e){return {id:uid('v'),date:dt(-e[0]),effect:e[1],text:e[2]}});
    c.exposure={private:!!exp[0],money:!!exp[1]};
    if(gut)c.gut=gut;
    person(id).character=c;
  }
  function person(id){return d.people.filter(function(p){return p.id===id})[0]}
  C('e8',[2,3,3,4,3,3],['gossips'],[],[[25,'bad','Repeated what I told him about my plans at a dinner.'],[60,'good','Sent a useful market note, no strings.']],[1,1],{text:'Charming, but I never feel quite sure of him.',confidence:'years'});
  C('e16',[2,2,2,3,2,2],['gossips','lies','pushy_money'],[],[[20,'bad','Told two people about my plan after I asked him to keep it private.'],[70,'bad','Said he had paid the invoice; he had not.']],[1,1],{text:'Fast talker. Check everything.',confidence:'months'});
  C('e18',[3,2,3,3,3,3],['only_when_need'],[],[[90,'bad','Only called when he wanted a favour.']],[0,1]);
  C('e14',[3,3,3,3,3,3],['gossips'],[],[],[0,0]);
  C('e9',[4,4,4,4,4,4],[],['keeps_promises','pays_back'],[[40,'good','Paid me back early.']],[0,1]);
  C('e6',[5,5,5,4,5,5],[],['keeps_promises','introduces','pays_back'],[[30,'good','Kept a secret I asked her to keep.']],[1,0]);
  C('e1',[5,5,5,5,4,4],[],['keeps_promises','pays_back'],[],[1,0]);
  C('e7',[4,0,0,0,0,0],[],[],[],[0,0]);
  d.lastBackup='';
  d.nextCode=code+1;
  var ang=0;d.people.forEach(function(p,i){if(p.isMe)return;ang=(i-1)/(d.people.length-1)*Math.PI*2;p.x=Math.cos(ang)*240+Math.random()*30;p.y=Math.sin(ang)*240+Math.random()*30});
  return d;
}

/* ---------- character and risk (what the numbers mean is in pmrisk.js) ---------- */
function charOf(p){if(!p.character)p.character=sanitizeChar(null);return p.character}
function allFlags(){return PR.BUILTIN_FLAGS.concat(S.customFlags)}
function flagInfo(id){var l=allFlags();for(var i=0;i<l.length;i++)if(l[i].id===id)return l[i];return null}
/* a flag is stored by id for built-in ones and by id for custom ones; unknown ids are ignored */
function flagsOfKind(p,kind){return charOf(p).flags.map(flagInfo).filter(function(f){return f&&f.kind===kind})}
function contactsOf(id){
  var seen={},n=0;
  allLinks().forEach(function(l){
    var o=l.a===id?l.b:l.b===id?l.a:null;
    if(o&&o!=='me'&&o!==id&&person(o)&&!seen[o]){seen[o]=1;n++}
  });
  return n;
}
function riskInput(p){
  var c=charOf(p),fv=favoursOf(p.id),t=TN();
  return {traits:c.traits,red:flagsOfKind(p,'red').length,green:flagsOfKind(p,'green').length,
    evidence:c.evidence.map(function(e){var q=PM.parseISO(e.date);return {ageDays:q?Math.max(0,t-q.num):0,effect:e.effect}}),
    exposure:{priv:c.exposure.private,money:c.exposure.money},contacts:contactsOf(p.id),favThey:fv.they,favMine:fv.mine};
}
function riskOfPerson(p){
  if(p.isMe)return {computed:{score:null,level:'none'},level:'none',overridden:false,score:null};
  var r=PR.riskOf(riskInput(p)),ov=charOf(p).override,lv=PR.effective(r.level,ov);
  return {computed:r,level:lv,overridden:lv!==r.level,score:r.score,input:null};
}
function riskLevelInfo(p){return PR.LEVELS[riskOfPerson(p).level]}
function riskCount(levels){return S.people.filter(function(p){return !p.isMe&&levels.indexOf(riskOfPerson(p).level)>=0}).length}
function traitAvg(p){
  var c=charOf(p),v=PR.TRAIT_KEYS.map(function(k){return c.traits[k]}).filter(function(x){return x>0});
  return v.length?v.reduce(function(a,b){return a+b},0)/v.length:0;
}
