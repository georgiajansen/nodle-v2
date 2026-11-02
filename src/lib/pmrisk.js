/* PMRisk: the Character -> Risk level formula (brief section 12). Plain arithmetic, no AI, no network. */
(function(root){
'use strict';
var TRAIT_W={honest:2,reliable:1.5,discreet:1.5,generous:1,steady:1,boundaries:1};
var TRAIT_KEYS=['honest','reliable','discreet','generous','steady','boundaries'];
var TRAIT_LABEL={honest:'Honest',reliable:'Reliable',discreet:'Discreet',generous:'Generous',steady:'Emotionally steady',boundaries:'Respects boundaries'};
var TRAIT_NOUN={honest:'honesty',reliable:'reliability',discreet:'discretion',generous:'generosity',steady:'emotional steadiness',boundaries:'respect for boundaries'};
var BUILTIN_FLAGS=[
  {id:'keeps_promises',name:'Keeps promises',kind:'green'},{id:'introduces',name:'Introduces you to people',kind:'green'},{id:'pays_back',name:'Pays back',kind:'green'},
  {id:'gossips',name:'Gossips',kind:'red'},{id:'lies',name:'Lies',kind:'red'},{id:'only_when_need',name:'Only calls when they need something',kind:'red'},
  {id:'pushy_money',name:'Pushy about money',kind:'red'},{id:'badmouths',name:'Bad-mouths others',kind:'red'}];
var LEVELS={
  critical:{label:'Critical',tag:'CRITICAL',cls:'crit',color:'#e5484d',rank:5},
  high:{label:'High',tag:'HIGH',cls:'high',color:'#e5845c',rank:4},
  medium:{label:'Medium',tag:'MEDIUM',cls:'med',color:'#d9a441',rank:3},
  low:{label:'Low',tag:'LOW',cls:'low',color:'#58b27f',rank:2},
  none:{label:'Not enough info',tag:'NOT ENOUGH INFO',cls:'none',color:'#7d7d7d',rank:1}};
function clamp(x,lo,hi){return Math.max(lo,Math.min(hi,x))}

// i = { traits:{honest:0..5,...}, red:n, green:n, evidence:[{ageDays,effect:'good'|'bad'}], exposure:{priv,money}, contacts:n, favThey:n, favMine:n }
function riskOf(i){
  var keys=Object.keys(TRAIT_W),sw=0,s=0,rated=0;
  keys.forEach(function(k){var v=i.traits[k]||0;if(v>=1){rated++;sw+=TRAIT_W[k];s+=TRAIT_W[k]*v}});
  var avg=rated?s/sw:null;
  if(rated<3)return {level:'none',score:null,rated:rated,avg:avg};
  var base=(5-avg)/4*100;
  var character=clamp(Math.round(base+Math.min(32,i.red*8)-Math.min(15,i.green*5)),0,100);
  var exposure=clamp((i.exposure.priv?35:0)+(i.exposure.money?35:0)+Math.min(30,i.contacts*3),0,100);
  var track=null,net=0,ev=i.evidence||[];
  ev.forEach(function(e){var w=e.ageDays<=180?1:e.ageDays<=365?0.6:0.35;net+=(e.effect==='bad'?w:-w)});
  var fav=clamp((i.favMine-i.favThey)*5,-10,15);
  if(ev.length||i.favThey||i.favMine){track=clamp(Math.round(50+clamp(net,-3,3)/3*40+fav),0,100)}
  var L=track===null?character:0.7*character+0.3*track;
  var score=Math.round(L*(0.4+0.6*exposure/100));
  var level=score>=55?'critical':score>=35?'high':score>=20?'medium':'low';
  return {level:level,score:score,character:character,exposure:exposure,track:track,avg:avg,rated:rated};
}
function clone(i){return {traits:Object.assign({},i.traits),red:i.red,green:i.green,evidence:(i.evidence||[]).slice(),exposure:{priv:i.exposure.priv,money:i.exposure.money},contacts:i.contacts,favThey:i.favThey,favMine:i.favMine}}
function effective(computedLevel,override){return override&&override.level&&LEVELS[override.level]&&override.level!=='none'?override.level:computedLevel}

/* "Why this rating". ctx: { redNames:[], greenNames:[], latestBadText:'', confidence:'' } */
function explain(i,ctx){
  ctx=ctx||{};
  var r=riskOf(i);
  if(r.score===null)return {up:[],favour:[],note:ctx.confidence==='new'?"You've only just met — treat this as provisional.":''};
  var up=[];
  function add(text,mod){var j=clone(i);mod(j);var d=r.score-riskOf(j).score;if(d>=2)up.push({text:text,pts:d,big:d>=10})}
  var NOUN=TRAIT_NOUN;
  TRAIT_KEYS.forEach(function(k){var v=i.traits[k]||0;if(v>=1&&v<=2)add('Low '+NOUN[k]+' ('+v+'/5)',function(j){j.traits[k]=4})});
  if(i.red>0){var names=(ctx.redNames||[]).join(', ');add(i.red+' red flag'+(i.red>1?'s':'')+(names?': '+names:''),function(j){j.red=0})}
  if(i.exposure.money)add('In your money or deals',function(j){j.exposure.money=false});
  if(i.exposure.priv)add('Knows private things about you',function(j){j.exposure.priv=false});
  if(i.contacts>0)add('Knows '+i.contacts+' of your people',function(j){j.contacts=0});
  if(i.favMine>i.favThey){var n=i.favMine-i.favThey;add('Mostly takes: owes you '+n+' favour'+(n>1?'s':''),function(j){j.favMine=j.favThey})}
  var bad=(i.evidence||[]).filter(function(e){return e.effect==='bad'});
  if(bad.length){
    var lt=ctx.latestBadText?ctx.latestBadText:'';if(lt.length>44)lt=lt.slice(0,43)+'…';
    add(bad.length+' bad entr'+(bad.length>1?'ies':'y')+' in the log'+(lt?', latest: "'+lt+'"':''),function(j){j.evidence=j.evidence.filter(function(e){return e.effect!=='bad'})});
  }
  up.sort(function(a,b){return b.pts-a.pts});
  var favour=[];
  (ctx.greenNames||[]).forEach(function(n){favour.push(n)});
  var good=(i.evidence||[]).filter(function(e){return e.effect==='good'}).length;
  if(good)favour.push(good+' good entr'+(good>1?'ies':'y')+' in the log');
  if(i.favThey>i.favMine)favour.push('They help you more than you help them');
  if(i.red===0)favour.push('No red flags');
  return {up:up.slice(0,6),favour:favour,note:ctx.confidence==='new'?"You've only just met — treat this as provisional.":''};
}
var HOW_TEXT=[
  'Character score: the weighted average of the traits you rated (honest counts most, then reliable and discreet), turned into 0–100 where higher is riskier. Each red flag adds 8 (up to 32); each green flag takes off 5 (up to 15).',
  'Exposure score: 35 if they know private things about you, 35 if they are in your money or deals, plus 3 for every one of your people they are connected to (up to 30).',
  'Track record: only when there is a log entry or a favour. Recent bad entries count fully, older ones less; good entries count against risk. If you have helped them much more than they helped you, it adds a little.',
  'Risk = (70% character + 30% track record, or character alone with no track record) × (0.4 + 0.6 × exposure). Low 0–19 · Medium 20–34 · High 35–54 · Critical 55+. With fewer than 3 traits rated there is not enough information.',
  'This is your private decision aid, not a verdict. You can always override the level, with a reason.'];

var api={TRAIT_W:TRAIT_W,TRAIT_KEYS:TRAIT_KEYS,TRAIT_LABEL:TRAIT_LABEL,BUILTIN_FLAGS:BUILTIN_FLAGS,LEVELS:LEVELS,HOW_TEXT:HOW_TEXT,riskOf:riskOf,effective:effective,explain:explain};
root.PMRisk=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
