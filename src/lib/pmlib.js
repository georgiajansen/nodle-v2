/* PMLib: plain-code helpers (dates, birthday-list parser, fuzzy name matching). No network, no AI. */
(function(root){
'use strict';
var MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
var MONTH_RE='(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
function monthIndex(s){var k=String(s).slice(0,3).toLowerCase();for(var i=0;i<12;i++)if(MONTH_NAMES[i].slice(0,3).toLowerCase()===k)return i+1;return 0}

/* ---------- dates ---------- */
function isLeap(y){return (y%4===0&&y%100!==0)||y%400===0}
function daysInMonth(m,y){return [31,(y===null||y===undefined||y===0?true:isLeap(y))?29:28,31,30,31,30,31,31,30,31,30,31][m-1]}
function dayNum(y,m,d){return Math.round(Date.UTC(y,m-1,d)/86400000)}
function todayNum(now){now=now||new Date();return dayNum(now.getFullYear(),now.getMonth()+1,now.getDate())}
function fromDayNum(n){var dt=new Date(n*86400000);return {y:dt.getUTCFullYear(),m:dt.getUTCMonth()+1,d:dt.getUTCDate()}}
function parseISO(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));if(!m)return null;var y=+m[1],mo=+m[2],d=+m[3];if(mo<1||mo>12||d<1||d>daysInMonth(mo,y))return null;return {y:y,m:mo,d:d,num:dayNum(y,mo,d)}}
function toISO(y,m,d){return y+'-'+(m<10?'0':'')+m+'-'+(d<10?'0':'')+d}
/* next time month/day comes round, counting today as 0 */
function nextOccurrence(m,d,tNum){
  var t=fromDayNum(tNum),y=t.y;
  function mk(yy){var dd=d;if(m===2&&d===29&&!isLeap(yy))dd=28;return dayNum(yy,m,dd)}
  var n=mk(y);if(n<tNum){y++;n=mk(y)}
  return {num:n,year:y,days:n-tNum};
}
function fmtMD(m,d){return d+' '+MONTH_NAMES[m-1].slice(0,3)}
function fmtFull(y,m,d){return d+' '+MONTH_NAMES[m-1].slice(0,3)+' '+y}
function ago(days){
  if(days<0)return 'in the future';
  if(days===0)return 'today';
  if(days===1)return 'yesterday';
  if(days<14)return days+' days ago';
  if(days<60)return Math.round(days/7)+' weeks ago';
  if(days<700)return Math.round(days/30.4)+' months ago';
  return (Math.round(days/36.5)/10)+' years ago';
}
function agoShort(days){
  if(days<0)return '—';
  if(days<100)return days+'d';
  if(days<700)return Math.round(days/30.4)+'mo';
  return (Math.round(days/36.5)/10)+'y';
}
function ordinal(n){var s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}

/* ---------- parsing a messy birthday list ---------- */
var EMOJI_RE=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;
var NOISE_RE=/(?:^|[^a-z])(?:birthdays?|bdays?|b-days?|b'days?|born|dob|d\.o\.b\.?|date of birth|turns|turning)(?![a-z])/gi;
var WEEKDAY_RE=/(?:^|[^a-z])(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?![a-z])[,.]?/gi;
var HEADING_RE=/^(?:birthdays?|bdays?|b-days?|birthday list|list of birthdays|birthdays? list|dates|important dates|name|names)$/i;

function year2(yy,now){var cur=(now||new Date()).getFullYear()%100;return yy<=cur?2000+yy:1900+yy}

function normalizeLine(s){
  s=String(s).replace(/[\u00a0\u2007\u202f\t]/g,' ').replace(/[\u2018\u2019\u02bc]/g,"'").replace(/[\u201c\u201d]/g,'"');
  s=s.replace(EMOJI_RE,' ');
  s=s.replace(/(\d)[\u2013\u2014\u2212](\d)/g,'$1-$2');
  s=s.replace(/(\d)\s*(?:st|nd|rd|th)(?=[^a-z]|$|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/gi,'$1');
  s=s.replace(/\s+/g,' ');
  return s;
}
function stripMarkers(s){
  return s.replace(/^[\s\-\u2013\u2014\u2212\u2022\u00b7\u25cf\u25cb\u25e6\u25aa\u25ab\u25a0\u25a1*+>#~\u2713\u2714\u2610\u2611\u2192]+/,'').trim();
}
function hasLetter(s){return /[A-Za-z\u00c0-\u024f\u0370-\u03ff\u0400-\u04ff\u0590-\u06ff\u3040-\u30ff\u3400-\u9fff]/.test(s)}

function candidates(t){
  var out=[],m,re;
  re=/(^|[^0-9])(\d{4})([-\/.])(\d{1,2})\3(\d{1,2})(?![0-9])/g;
  while((m=re.exec(t))){out.push({kind:'iso',pri:5,start:m.index+m[1].length,end:m.index+m[0].length,y:+m[2],a:+m[4],b:+m[5],iso:true});re.lastIndex=m.index+m[0].length-0}
  re=/(^|[^0-9])(\d{1,2})([\/.\-])(\d{1,2})(?:\3(\d{4}|\d{2}))?(?![0-9])/g;
  while((m=re.exec(t))){
    var y=null;if(m[5]!==undefined)y=m[5].length===4?+m[5]:-(+m[5])-1; // negative marks 2-digit
    out.push({kind:'num',pri:4,start:m.index+m[1].length,end:m.index+m[0].length,a:+m[2],b:+m[4],y:y});
    re.lastIndex=m.index+m[0].length;
  }
  var YR="(?:[\\s,\\-\\/.]*(?:'(\\d{2})|(\\d{4})(?![0-9])|(\\d{2})\\s*$))?";
  re=new RegExp("(^|[^0-9])(\\d{1,2})\\s*[-\\/.]?\\s*(?:of\\s+)?"+MONTH_RE+"\\.?(?![a-z])"+YR,'gi');
  while((m=re.exec(t))){
    var yy=null;if(m[4]!==undefined)yy=-(+m[4])-1;else if(m[5]!==undefined)yy=+m[5];else if(m[6]!==undefined)yy=-(+m[6])-1;
    out.push({kind:'dm',pri:4,start:m.index+m[1].length,end:m.index+m[0].length,day:+m[2],month:monthIndex(m[3]),y:yy});
    re.lastIndex=m.index+m[0].length;
  }
  re=new RegExp("(^|[^a-z0-9])"+MONTH_RE+"\\.?\\s*(?:the\\s+)?(\\d{1,2})(?![0-9])"+YR,'gi');
  while((m=re.exec(t))){
    var yz=null;if(m[4]!==undefined)yz=-(+m[4])-1;else if(m[5]!==undefined)yz=+m[5];else if(m[6]!==undefined)yz=-(+m[6])-1;
    out.push({kind:'md',pri:4,start:m.index+m[1].length,end:m.index+m[0].length,day:+m[3],month:monthIndex(m[2]),y:yz});
    re.lastIndex=m.index+m[0].length;
  }
  return out;
}

function titleCase(s){
  if(s!==s.toLowerCase()&&!(s===s.toUpperCase()&&s.length>4))return s;
  return s.replace(/(^|[\s\-'(])([a-z\u00e0-\u024f])/g,function(_,a,b){return a+b.toUpperCase()});
}
function cleanName(s){
  s=' '+s+' ';
  s=s.replace(/\([^)]*\b(?:turn|turns|turning|age|aged|yrs|years|y\/o|yo)\b[^)]*\)/gi,' ');
  s=s.replace(NOISE_RE,function(m){return m.charAt(0).match(/[a-z]/i)?' ':m.charAt(0)+' '});
  s=s.replace(WEEKDAY_RE,function(m){return m.charAt(0).match(/[a-z]/i)?' ':m.charAt(0)+' '});
  s=s.replace(/\(\s*\)/g,' ').replace(/\s+/g,' ').trim();
  var prev;
  do{prev=s;
    s=s.replace(/^[\s:;,.)\-\u2013\u2014|\/\\@#&+*=>~"]+/,'').replace(/[\s:;,\-\u2013\u2014|\/\\@#&+*=<~"]+$/,'');
    s=s.replace(/^(?:on|is|the|of|at|his|her|their|my|for|-)\s+/i,'').replace(/\s+(?:on|is|the|of|at|in|for)$/i,'');
    if(/\($/.test(s))s=s.slice(0,-1);
    if(/^\)/.test(s))s=s.slice(1);
    s=s.replace(/['\u2019]s$/i,'').trim();
  }while(s!==prev);
  return s;
}

function validateDate(day,month,year,now){
  var r=[],cur=(now||new Date()).getFullYear();
  if(!month||month<1||month>12){r.push('Month is not valid');return r}
  if(!day||day<1||day>31||day!==Math.floor(day)){r.push('Day is not valid');return r}
  if(day>daysInMonth(month,year||0))r.push(MONTH_NAMES[month-1]+' does not have '+day+' days');
  if(year!==null&&year!==undefined&&year!==''){
    if(year<1900)r.push('Year '+year+' looks too early');
    else if(year>cur)r.push('Year '+year+' is in the future');
    else if(!r.length&&dayNum(year,month,day)>todayNum(now))r.push('That date is in the future');
  }
  return r;
}

function resolveNumeric(a,b,order){
  // returns {day,month,swapped,ambiguous} or null
  var d,m;
  if(order==='MDY'){m=a;d=b}else{d=a;m=b}
  var swapped=false;
  if(m>12&&d<=12){var t=d;d=m;m=t;swapped=true}
  if(m<1||m>12||d<1||d>31)return {day:d,month:m,swapped:swapped,invalid:true};
  return {day:d,month:m,swapped:swapped,ambiguous:(a<=12&&b<=12&&a!==b)};
}

function buildFromCandidate(t,c,opts,evidence){
  var order=opts.order||'DMY',now=opts.now||new Date(),day,month,year=null,notes=[],reasons=[],amb=false;
  if(c.kind==='iso'){day=c.b;month=c.a;year=c.y;
    if(month>12&&day<=12){var tt=day;day=month;month=tt}
  }
  else if(c.kind==='num'){
    var r=resolveNumeric(c.a,c.b,order);
    day=r.day;month=r.month;
    if(r.swapped)notes.push('Read as '+fmtMD(month,day)+' (the other order is not a real date)');
    if(r.ambiguous){
      amb=true;
      var bad=(order==='DMY'&&evidence&&evidence.mdy>0)||(order==='MDY'&&evidence&&evidence.dmy>0);
      if(bad)reasons.push('Day/month order unclear: your list mixes styles');
      else notes.push('Read as '+(order==='MDY'?'month/day':'day/month'));
    }
    if(c.y!==null){year=c.y<0?year2(-c.y-1,now):c.y}
  }else{
    day=c.day;month=c.month;
    if(c.y!==null){year=c.y<0?year2(-c.y-1,now):c.y}
  }
  var pre=t.slice(0,c.start),post=t.slice(c.end);
  // year in leftover, e.g. "Sam (1985) 12 Feb"
  if(year===null){
    var ym=/(^|[^0-9])((?:19|20)\d{2})(?![0-9])/.exec(pre+' | '+post);
    if(ym){year=+ym[2];pre=pre.replace(ym[2],' ');post=post.replace(ym[2],' ')}
  }
  var preN=cleanName(pre),postN=cleanName(post),name='',extra='';
  if(hasLetter(preN)){name=preN;extra=postN}else if(hasLetter(postN)){name=postN}
  return {name:name,extra:extra,day:day,month:month,year:year,reasons:reasons,notes:notes,ambiguous:amb,score:c.pri+(hasLetter(name)?4:0)+(year!==null?2:0),kind:c.kind};
}

function bestRow(t,opts,evidence){
  var cs=candidates(t),best=null;
  for(var i=0;i<cs.length;i++){
    var c=cs[i];
    if(c.kind==='num'&&(c.a===0&&c.b===0))continue;
    var r=buildFromCandidate(t,c,opts,evidence);
    if(r.month<1||r.month>12)continue;
    if(!best||r.score>best.score)best=r;
  }
  return best;
}

function parseOne(raw,opts,ctx,evidence){
  var now=opts.now||new Date();
  var norm=normalizeLine(raw),line=stripMarkers(norm);
  var row={raw:raw,name:'',day:null,month:null,year:null,status:'flagged',reasons:[],notes:[],extra:''};
  if(!line.trim())return null;
  // numbered list, e.g. "3. Mum 5 May" (only if a date is still found afterwards)
  var variants=[line];
  var nm=/^\(?\d{1,2}[.)]\s+(?=\S)/.exec(line);
  if(nm)variants.unshift(line.slice(nm[0].length));
  var found=null;
  for(var v=0;v<variants.length&&!found;v++){
    var b=bestRow(variants[v],opts,evidence);
    if(b){found=b;found.line=variants[v]}
  }
  if(!found&&ctx&&ctx.month){
    // heading month + "14 Sam" / "Sam 14th"
    var base=line,nums=[],m2,re=/(^|[^0-9])(\d{1,2})(?![0-9])/g;
    while((m2=re.exec(base)))nums.push({n:+m2[2],start:m2.index+m2[1].length,end:m2.index+m2[0].length});
    if(nums.length===1&&nums[0].n>=1&&nums[0].n<=31){
      var nmv=titleCase(cleanName(base.slice(0,nums[0].start)+' '+base.slice(nums[0].end)));
      found={name:nmv,extra:'',day:nums[0].n,month:ctx.month,year:null,reasons:[],notes:['Month taken from heading "'+MONTH_NAMES[ctx.month-1]+'"'],kind:'ctx'};
    }else if(nums.length>1){
      row.name=titleCase(cleanName(base.replace(/\d+/g,' ')));row.reasons.push('Several numbers: which one is the day?');return row;
    }
  }
  if(!found){
    row.name=titleCase(cleanName(line));
    row.reasons.push('No date found');
    if(!hasLetter(row.name))row.name='';
    return row;
  }
  row.name=found.name?titleCase(found.name):'';
  row.extra=found.extra||'';
  row.day=found.day;row.month=found.month;row.year=found.year;
  row.notes=found.notes||[];
  row.reasons=(found.reasons||[]).slice();
  if(!row.name)row.reasons.push('No name found');
  validateDate(row.day,row.month,row.year,now).forEach(function(x){row.reasons.push(x)});
  row.status=row.reasons.length?'flagged':'ok';
  return row;
}

function isMonthHeading(line){
  var t=stripMarkers(normalizeLine(line)).replace(/[:\-\u2013\u2014.]+$/,'').trim();
  var m=new RegExp('^(?:the\\s+)?'+MONTH_RE+'(?:\\s+(?:19|20)\\d{2})?$','i').exec(t);
  return m?monthIndex(m[1]):0;
}

function splitSegments(line,opts,evidence){
  var segs=line.split(/[;|]/).map(function(x){return x.trim()}).filter(Boolean);
  if(segs.length>1)return segs;
  var tryParts=function(parts){
    if(parts.length<2)return null;
    var ok=parts.every(function(p){var s=stripMarkers(normalizeLine(p));return bestRow(s,opts,evidence)!==null});
    return ok?parts:null;
  };
  var byComma=tryParts(line.split(/,\s*/).map(function(x){return x.trim()}).filter(Boolean));
  if(byComma)return byComma;
  var byAnd=tryParts(line.split(/\s+(?:&|and|\+)\s+/i).map(function(x){return x.trim()}).filter(Boolean));
  if(byAnd)return byAnd;
  return [line];
}

function scanEvidence(text){
  var ev={dmy:0,mdy:0};
  String(text).split(/\r?\n/).forEach(function(l){
    var t=stripMarkers(normalizeLine(l)),re=/(^|[^0-9])(\d{1,2})([\/.\-])(\d{1,2})(?:\3(?:\d{4}|\d{2}))?(?![0-9])/g,m;
    while((m=re.exec(t))){var a=+m[2],b=+m[4];if(a>12&&b<=12)ev.dmy++;else if(b>12&&a<=12)ev.mdy++;re.lastIndex=m.index+m[0].length}
  });
  return ev;
}

function parseList(text,opts){
  opts=opts||{};
  var evidence=scanEvidence(text),ctx={month:0},rows=[],skipped=0,lines=String(text||'').split(/\r?\n/);
  lines.forEach(function(raw,idx){
    var plain=stripMarkers(normalizeLine(raw)).trim();
    if(!plain){if(String(raw).trim())skipped++;return}
    var mh=isMonthHeading(raw);
    if(mh){ctx.month=mh;skipped++;return}
    var onlyWords=cleanName(plain).trim();
    if(!onlyWords||HEADING_RE.test(onlyWords)||HEADING_RE.test(plain.replace(/[:\-\s]+$/,''))||/^(?:19|20)\d{2}$/.test(plain)||(!hasLetter(plain)&&!/\d/.test(plain))){skipped++;return}
    var segs=splitSegments(plain,opts,evidence);
    segs.forEach(function(sg){
      var r=parseOne(sg,opts,ctx,evidence);
      if(r){r.lineNo=idx+1;r.raw=segs.length>1?sg:raw.trim();rows.push(r)}
    });
  });
  var hint='';
  if((opts.order||'DMY')==='DMY'&&evidence.mdy>0&&evidence.dmy===0)hint='Your list looks like month/day (for example 1/14). Try switching to month/day.';
  if(opts.order==='MDY'&&evidence.dmy>0&&evidence.mdy===0)hint='Your list looks like day/month (for example 14/1). Try switching to day/month.';
  return {rows:rows,skipped:skipped,hint:hint,evidence:evidence};
}

/* ---------- matching names to existing people ---------- */
var SYN={mom:'mum',mother:'mum',mummy:'mum',mama:'mum',mommy:'mum',ma:'mum',mum:'mum',dad:'dad',father:'dad',papa:'dad',daddy:'dad',pa:'dad',pop:'dad',granny:'gran',grandma:'gran',gran:'gran',nan:'gran',nana:'gran',grandmother:'gran',grandpa:'grandpa',grandad:'grandpa',granddad:'grandpa',grandfather:'grandpa',bro:'brother',sis:'sister'};
function stripAccents(s){try{return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch(e){return s}}
function tokens(s,dropParens){
  s=stripAccents(String(s)).toLowerCase().replace(/^example:\s*/,'');
  if(dropParens)s=s.replace(/\([^)]*\)/g,' ');
  s=s.replace(/['\u2019]s\b/g,'').replace(/[^a-z0-9\s]/g,' ');
  return s.split(/\s+/).filter(Boolean).map(function(w){return SYN[w]||w});
}
function lev(a,b){
  if(a===b)return 0;var m=a.length,n=b.length;if(!m)return n;if(!n)return m;
  var prev=[],cur=[],i,j;for(j=0;j<=n;j++)prev[j]=j;
  for(i=1;i<=m;i++){cur[0]=i;for(j=1;j<=n;j++){cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1))}prev=cur.slice()}
  return prev[n];
}
function tokScore(a,b){
  if(a===b)return 1;
  if(a.length>=3&&b.length>=3&&(a.indexOf(b)===0||b.indexOf(a)===0))return 0.82;
  var d=lev(a,b),L=Math.max(a.length,b.length);
  if(L>=4&&d===1)return 0.8;
  if(L>=7&&d===2)return 0.75;
  return 0;
}
function nameScore(importName,personName){
  var best=0;
  [true,false].forEach(function(drop){
    var A=tokens(importName,true),B=tokens(personName,drop);
    if(!A.length||!B.length)return;
    var sa=A.join(' '),sb=B.join(' ');
    if(sa===sb){best=Math.max(best,1);return}
    var sub=A.every(function(x){return B.indexOf(x)>=0});
    if(sub){best=Math.max(best,B.length>A.length?0.92:1)}
    var rsub=B.every(function(x){return A.indexOf(x)>=0});
    if(rsub)best=Math.max(best,0.88);
    // fuzzy per token: every import token has a close token in the person's name
    var tot=0,ok=true;
    A.forEach(function(x){var m=0;B.forEach(function(y){m=Math.max(m,tokScore(x,y))});if(m===0)ok=false;tot+=m});
    if(ok)best=Math.max(best,(tot/A.length)*(B.length>A.length?0.95:1));
    // first names equal
    if(A.length>1&&B.length>1&&A[0]===B[0])best=Math.max(best,0.7);
  });
  return best;
}
function matchPeople(name,people){
  var out=[];
  people.forEach(function(p){var s=nameScore(name,p.name);if(s>0.5)out.push({id:p.id,name:p.name,score:s})});
  out.sort(function(a,b){return b.score-a.score||a.name.localeCompare(b.name)});
  var ambiguous=out.length>1&&out[0].score>=0.75&&out[1].score>=0.75&&(out[0].score-out[1].score)<0.1;
  return {list:out,best:out.length&&out[0].score>=0.75?out[0]:null,ambiguous:ambiguous};
}

root.PMLib={MONTH_NAMES:MONTH_NAMES,monthIndex:monthIndex,isLeap:isLeap,daysInMonth:daysInMonth,dayNum:dayNum,todayNum:todayNum,fromDayNum:fromDayNum,parseISO:parseISO,toISO:toISO,nextOccurrence:nextOccurrence,fmtMD:fmtMD,fmtFull:fmtFull,ago:ago,agoShort:agoShort,ordinal:ordinal,
  parseList:parseList,parseLine:function(l,o){var r=parseList(l,o);return r.rows[0]||null},validateDate:validateDate,matchPeople:matchPeople,nameScore:nameScore,titleCase:titleCase,cleanName:cleanName,isMonthHeading:isMonthHeading,year2:year2};
if(typeof module!=='undefined'&&module.exports)module.exports=root.PMLib;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
