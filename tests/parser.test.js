// Run: node tests/parser.test.js   (plain asserts, no libraries)
const L=require('../src/lib/pmlib.js');
const NOW=new Date(2026,10,2);   // 2 Nov 2026
let pass=0,fail=0;const fails=[];
function row(line,opts){const r=L.parseList(line,Object.assign({now:NOW},opts||{}));return r.rows}
function eq(label,a,b){if(JSON.stringify(a)===JSON.stringify(b))pass++;else{fail++;fails.push(label+'\n   got  '+JSON.stringify(a)+'\n   want '+JSON.stringify(b))}}
// [input, [name,day,month,year,status], opts?]
const OK='ok',FL='flagged';
const cases=[
 // --- the formats from the brief
 ['Mum - 3rd March',['Mum',3,3,null,OK]],
 ['jan 14',['',14,1,null,FL]],                     // no name -> flagged
 ['14/1',['',14,1,null,FL]],
 ['14/01/03',['',14,1,2003,FL]],
 ['14.1.2003',['',14,1,2003,FL]],
 ['3 mar',['',3,3,null,FL]],
 ['march3',['',3,3,null,FL]],
 ['Sam bday 12 Feb',['Sam',12,2,null,OK]],
 ['jess: 5/6',['Jess',5,6,null,OK]],
 ['🎂 Sam 12/2',['Sam',12,2,null,OK]],
 ['• Priya - 1 Sept',['Priya',1,9,null,OK]],
 ['- Priya 1st sept',['Priya',1,9,null,OK]],
 ['* Tom birthday 25 December',['Tom',25,12,null,OK]],
 ['Tom b-day 25 Dec',['Tom',25,12,null,OK]],
 ["Tom b'day 25 Dec",['Tom',25,12,null,OK]],
 ["Tom's birthday 25 Dec",['Tom',25,12,null,OK]],
 ["Chris’s birthday: 25 Dec",['Chris',25,12,null,OK]],
 ['Birthday: Tom 25 Dec',['Tom',25,12,null,OK]],
 ['Tom BDAY 25/12',['Tom',25,12,null,OK]],
 // --- name positions
 ['12 Feb Sam',['Sam',12,2,null,OK]],
 ['12 Feb - Sam',['Sam',12,2,null,OK]],
 ['Feb 12: Sam',['Sam',12,2,null,OK]],
 ['Feb 12th Sam',['Sam',12,2,null,OK]],
 ['12/02 Sam',['Sam',12,2,null,OK]],
 ['Sam (12 Feb)',['Sam',12,2,null,OK]],
 ['Sam – 12 Feb',['Sam',12,2,null,OK]],
 ['Sam — 12 Feb',['Sam',12,2,null,OK]],
 ['Sam\t12 Feb',['Sam',12,2,null,OK]],
 ['Sam    12    Feb',['Sam',12,2,null,OK]],
 ['SAM 12 FEB',['SAM',12,2,null,OK]],
 ['sam 12 feb',['Sam',12,2,null,OK]],
 ['sam tan 12 feb',['Sam Tan',12,2,null,OK]],
 ['Anne-Marie 3/5',['Anne-Marie',3,5,null,OK]],
 ['Anne-Marie - 3 May',['Anne-Marie',3,5,null,OK]],
 ["Sean O'Brien 3 May",["Sean O'Brien",3,5,null,OK]],
 ['Dr. Lim 5 May',['Dr. Lim',5,5,null,OK]],
 ['Auntie Lin - 1st of Sept',['Auntie Lin',1,9,null,OK]],
 ['Auntie Lin on the 1st of September',['Auntie Lin',1,9,null,OK]],
 ['José 7 Aug',['José',7,8,null,OK]],
 ['李明 7 Aug',['李明',7,8,null,OK]],
 ['Sam on 12 Feb',['Sam',12,2,null,OK]],
 ['Sam is 12 Feb',['Sam',12,2,null,OK]],
 // --- month names
 ['Sam 3 January',['Sam',3,1,null,OK]],['Sam 3 Jan',['Sam',3,1,null,OK]],['Sam 3 february',['Sam',3,2,null,OK]],
 ['Sam 3 March',['Sam',3,3,null,OK]],['Sam 3 Apr',['Sam',3,4,null,OK]],['Sam 3 April',['Sam',3,4,null,OK]],['Sam 3 May',['Sam',3,5,null,OK]],
 ['Sam 3 Jun',['Sam',3,6,null,OK]],['Sam 3 June',['Sam',3,6,null,OK]],['Sam 3 Jul',['Sam',3,7,null,OK]],['Sam 3 July',['Sam',3,7,null,OK]],
 ['Sam 3 Aug',['Sam',3,8,null,OK]],['Sam 3 Sep',['Sam',3,9,null,OK]],['Sam 3 Sept',['Sam',3,9,null,OK]],['Sam 3 Sept.',['Sam',3,9,null,OK]],
 ['Sam 3 Oct',['Sam',3,10,null,OK]],['Sam 3 Nov',['Sam',3,11,null,OK]],['Sam 3 December',['Sam',3,12,null,OK]],
 ['Sam Dec 3',['Sam',3,12,null,OK]],['Sam December 3rd',['Sam',3,12,null,OK]],['Sam sept 3',['Sam',3,9,null,OK]],
 ['Mark 3 May',['Mark',3,5,null,OK]],            // "Mar" inside Mark must not be a month
 ['Jan Smith 3 March',['Jan Smith',3,3,null,OK]],
 ['Jun 3 Sam',['Sam',3,6,null,OK]],
 ['Augustine 3 Aug',['Augustine',3,8,null,OK]],
 ['Decker 3 Dec',['Decker',3,12,null,OK]],
 ['Sam 3rd Mar',['Sam',3,3,null,OK]],['Sam 22nd Mar',['Sam',22,3,null,OK]],['Sam 23rd Mar',['Sam',23,3,null,OK]],['Sam 11th Mar',['Sam',11,3,null,OK]],
 ['Sam 3rdmarch',['Sam',3,3,null,OK]],
 ['Sam 3-mar',['Sam',3,3,null,OK]],
 ['Sam 3-mar-1990',['Sam',3,3,1990,OK]],
 ['Sam march3',['Sam',3,3,null,OK]],['Sam mar3',['Sam',3,3,null,OK]],['Sam 3mar',['Sam',3,3,null,OK]],
 // --- years
 ['Sam 12 Feb 1990',['Sam',12,2,1990,OK]],
 ['Sam 12 Feb, 1990',['Sam',12,2,1990,OK]],
 ['Sam 12 February 2003',['Sam',12,2,2003,OK]],
 ["Sam 12 Feb '90",['Sam',12,2,1990,OK]],
 ["Sam 12 Feb '03",['Sam',12,2,2003,OK]],
 ['Sam 12 Feb 90',['Sam',12,2,1990,OK]],
 ['Sam Feb 12 1990',['Sam',12,2,1990,OK]],
 ['Sam Feb 12, 1990',['Sam',12,2,1990,OK]],
 ['Sam (1990) 12 Feb',['Sam',12,2,1990,OK]],
 ['Sam 12 Feb (turning 36)',['Sam',12,2,null,OK]],
 ['Sam 12/02/1990',['Sam',12,2,1990,OK]],
 ['Sam 12/02/90',['Sam',12,2,1990,OK]],
 ['Sam 12/02/03',['Sam',12,2,2003,OK]],
 ['Sam 12/02/26',['Sam',12,2,2026,OK]],
 ['Sam 12/02/27',['Sam',12,2,1927,OK]],
 ['Sam 12-02-1990',['Sam',12,2,1990,OK]],
 ['Sam 12-02-90',['Sam',12,2,1990,OK]],
 ['Sam 12.02.1990',['Sam',12,2,1990,OK]],
 ['Sam 12.2.90',['Sam',12,2,1990,OK]],
 ['Sam 1990-02-12',['Sam',12,2,1990,OK]],
 ['Sam 1990/02/12',['Sam',12,2,1990,OK]],
 ['Sam 14/1',['Sam',14,1,null,OK]],
 ['Sam 1/14',['Sam',14,1,null,OK]],           // 14 cannot be a month -> swapped
 ['Sam 25/12',['Sam',25,12,null,OK]],
 ['Sam 31/12',['Sam',31,12,null,OK]],
 ['Sam 29/2',['Sam',29,2,null,OK]],            // leap day allowed without year
 ['Sam 29/2/1992',['Sam',29,2,1992,OK]],
 ['Sam 01/01',['Sam',1,1,null,OK]],
 ['Sam 7/7',['Sam',7,7,null,OK]],
 // --- day/month order toggle
 ['Sam 5/6',['Sam',5,6,null,OK]],
 ['Sam 5/6',['Sam',6,5,null,OK],{order:'MDY'}],
 ['Sam 5/6/90',['Sam',6,5,1990,OK],{order:'MDY'}],
 ['Sam 14/1',['Sam',14,1,null,OK],{order:'MDY'}],   // 14 cannot be a month, still understood
 ['Sam 1/14',['Sam',14,1,null,OK],{order:'MDY'}],
 // --- invalid / flagged
 ['Sam 31/2',['Sam',31,2,null,FL]],
 ['Sam 30 Feb',['Sam',30,2,null,FL]],
 ['Sam 31 Apr',['Sam',31,4,null,FL]],
 ['Sam 31/11',['Sam',31,11,null,FL]],
 ['Sam 29/2/1993',['Sam',29,2,1993,FL]],
 ['Sam 32/1',['Sam',32,1,null,FL]],
 ['Sam 0/5',['Sam',0,5,null,FL]],
 ['Sam 12 Feb 2031',['Sam',12,2,2031,FL]],
 ['Sam 12/13',['Sam',13,12,null,OK]],            // month 13 impossible -> swapped
 ['Sam 40/50',['Sam 40/50',null,null,null,FL]],
 ['Sam',['Sam',null,null,null,FL]],
 ['Just some words',['Just some words',null,null,null,FL]],
 ['12 Feb',['',12,2,null,FL]],
 ['??',null],
 ['Sam 12 Feb 2026',['Sam',12,2,2026,OK]],
 ['Sam 3 Nov 2026',['Sam',3,11,2026,FL]],         // later today = future
 // --- bullets, numbering, emoji
 ['1. Mum 3 March',['Mum',3,3,null,OK]],
 ['2) Dad 5 April',['Dad',5,4,null,OK]],
 ['(3) Dad 5 April',['Dad',5,4,null,OK]],
 ['✅ Sam 12 Feb',['Sam',12,2,null,OK]],
 ['☐ Sam 12 Feb',['Sam',12,2,null,OK]],
 ['👉 Sam 12 Feb 🎉',['Sam',12,2,null,OK]],
 ['🎂🎂 Sam 12 Feb 🎂',['Sam',12,2,null,OK]],
 ['—  Sam 12 Feb',['Sam',12,2,null,OK]],
 ['> Sam 12 Feb',['Sam',12,2,null,OK]],
 ['   • Sam 12 Feb   ',['Sam',12,2,null,OK]],
 ['\u00a0Sam\u00a012\u00a0Feb',['Sam',12,2,null,OK]],
 ['14. Sam 12 Feb',['Sam',12,2,null,OK]],
 // --- trailing notes are ignored, not mixed into the name
 ['Sam 12 Feb - loves wine',['Sam',12,2,null,OK]],
 ['Sam 12 Feb (colleague)',['Sam',12,2,null,OK]],
 // --- weekdays / filler
 ['Sam Sat 12 Feb',['Sam',12,2,null,OK]],
 ['Sam, Saturday 12th February',['Sam',12,2,null,OK]],
 ['Sam born 12 Feb 1990',['Sam',12,2,1990,OK]],
 ['Sam DOB 12/02/1990',['Sam',12,2,1990,OK]],
 ['Sam date of birth: 12/02/1990',['Sam',12,2,1990,OK]],
 ['Sam turns 12 Feb',['Sam',12,2,null,OK]],
 ['Sam bday: 12 Feb',['Sam',12,2,null,OK]],
 ['Sam - bday - 12 Feb',['Sam',12,2,null,OK]],
 ['Sam birthday on 12 Feb',['Sam',12,2,null,OK]],
 ['Sam birthdays 12 Feb',['Sam',12,2,null,OK]],
 // --- family names
 ['Mum 3/3',['Mum',3,3,null,OK]],['MUM 3/3',['MUM',3,3,null,OK]],['mum 3/3',['Mum',3,3,null,OK]],['Mom - 3 Mar',['Mom',3,3,null,OK]],
 ['Dad: 14 Jan 1960',['Dad',14,1,1960,OK]],
 ['Grandma 1 Jan',['Grandma',1,1,null,OK]],
];
cases.forEach(c=>{
  const [inp,exp,opts]=c;const rs=row(inp,opts);
  if(exp===null){eq('"'+inp+'" should yield no row or a flagged one',rs.length===0||rs[0].status==='flagged',true);return}
  const r=rs[0];
  if(!r){eq('"'+inp+'" produced a row',false,true);return}
  eq('"'+inp+'"'+(opts?' '+JSON.stringify(opts):''),[r.name,r.day,r.month,r.year,r.status],exp);
});
// --- heading context
(function(){
  const t='January\n14 - Kai\n20 Lena\nMay Tan 3rd\n\nFebruary\nLeo 2nd\n3rd: Mia\n\n📅 March\n9. Noor';
  const r=L.parseList(t,{now:NOW}).rows.map(x=>[x.name,x.day,x.month,x.status]);
  eq('month headings',r,[['Kai',14,1,'ok'],['Lena',20,1,'ok'],['May Tan',3,1,'ok'],['Leo',2,2,'ok'],['Mia',3,2,'ok'],['Noor',9,3,'ok']]);
})();
// --- headings and titles are skipped, not flagged
(function(){
  const res=L.parseList('Birthdays\nBirthday list 🎂\n2026\n---\n\nSam 12 Feb',{now:NOW});
  eq('titles skipped',[res.rows.length,res.skipped>=3],[1,true]);
})();
// --- several people on one line
(function(){
  let r=L.parseList('Mum 3/3, Dad 5/4, Sam 12/6',{now:NOW}).rows.map(x=>[x.name,x.day,x.month]);
  eq('comma list',r,[['Mum',3,3],['Dad',5,4],['Sam',12,6]]);
  r=L.parseList('Mum 3 Mar; Dad 5 Apr',{now:NOW}).rows.map(x=>[x.name,x.day,x.month]);
  eq('semicolon list',r,[['Mum',3,3],['Dad',5,4]]);
  r=L.parseList('Mum 3 Mar & Dad 5 Apr',{now:NOW}).rows.map(x=>[x.name,x.day,x.month]);
  eq('ampersand list',r,[['Mum',3,3],['Dad',5,4]]);
  r=L.parseList('Anna, 7 Aug 1990',{now:NOW}).rows;
  eq('comma inside one entry stays one row',[r.length,r[0].name,r[0].year],[1,'Anna',1990]);
  r=L.parseList('March 3, 1985 Bob',{now:NOW}).rows;
  eq('month day, year then name',[r.length,r[0].name,r[0].year],[1,'Bob',1985]);
})();
// --- mixed day/month styles are flagged, consistent ones are not
(function(){
  let r=L.parseList('Ann 25/12\nBen 5/6',{now:NOW}); // 25/12 proves day/month
  eq('consistent DMY',r.rows.map(x=>x.status),['ok','ok']);
  r=L.parseList('Ann 12/25\nBen 5/6',{now:NOW}); // 12/25 proves month/day, but default is day/month
  eq('mixed/opposite style is flagged + hint',[r.rows[1].status,r.hint.length>0],['flagged',true]);
  r=L.parseList('Ann 12/25\nBen 5/6',{now:NOW,order:'MDY'});
  eq('switching to month/day fixes it',[r.rows[0].day,r.rows[0].month,r.rows[1].day,r.rows[1].month,r.rows[1].status],[25,12,6,5,'ok']);
  r=L.parseList('Ann 25/12\nCal 12/25\nBen 5/6',{now:NOW});
  eq('both styles in one list are flagged',r.rows[2].status,'flagged');
})();
// --- skipped / robustness
(function(){
  eq('empty text',L.parseList('',{now:NOW}).rows.length,0);
  eq('only blanks',L.parseList('\n\n   \n',{now:NOW}).rows.length,0);
  eq('windows line endings',L.parseList('Sam 12 Feb\r\nTom 3 Mar\r\n',{now:NOW}).rows.length,2);
  eq('weird input does not throw',(function(){try{L.parseList('((((\n))))\n12//\n//12\n.....\n-\n99999999999\n1/\n/1\n"""',{now:NOW});return true}catch(e){return e.message}})(),true);
  const long='Sam '+'x'.repeat(5000)+' 12 Feb';
  eq('very long line',L.parseList(long,{now:NOW}).rows.length,1);
})();
// --- date helpers
(function(){
  const t=L.dayNum(2026,11,2);
  eq('todayNum',L.todayNum(NOW),t);
  eq('days until 3 Nov',L.nextOccurrence(11,3,t).days,1);
  eq('days until 2 Nov (today)',L.nextOccurrence(11,2,t).days,0);
  eq('days until 1 Nov (next year)',L.nextOccurrence(11,1,t).days,364);
  eq('29 Feb in a non-leap year -> 28 Feb',L.fromDayNum(L.nextOccurrence(2,29,t).num),{y:2027,m:2,d:28});
  eq('leap year next',L.fromDayNum(L.nextOccurrence(2,29,L.dayNum(2027,3,1)).num).y,2028);
  eq('year turn',L.nextOccurrence(1,5,L.dayNum(2026,12,30)).days,6);
  eq('daysInMonth feb leap',[L.daysInMonth(2,2024),L.daysInMonth(2,2026),L.daysInMonth(2,0)],[29,28,29]);
  eq('parseISO',L.parseISO('2026-02-30'),null);
  eq('ago',[L.ago(0),L.ago(1),L.ago(5),L.ago(21),L.ago(95)],['today','yesterday','5 days ago','3 weeks ago','3 months ago']);
})();
// --- matching names to existing people
(function(){
  const P=[{id:'1',name:'Example: Mum'},{id:'2',name:'Example: Brother Sam'},{id:'3',name:'Example: Alex (polo club)'},{id:'4',name:'Jessica Tan'},{id:'5',name:'Sam Lee'},{id:'6',name:'Priya Nair'},{id:'7',name:'Zoë Müller'}];
  const best=n=>{const m=L.matchPeople(n,P);return m.best?m.best.id:null};
  eq('exact',best('Mum'),'1');
  eq('synonym mom=mum',best('Mom'),'1');
  eq('synonym mummy',best('MUMMY'),'1');
  eq('case-insens',best('alex'),'3');
  eq('with extra words',best('Alex polo'),'3');
  eq('prefix first name',best('Jess'),'4');
  eq('full name',best('jessica tan'),'4');
  eq('typo',best('Priyaa'),'6');
  eq('typo 2',best('Pria Nair'),'6');
  eq('accents',best('Zoe Muller'),'7');
  eq('unknown name',best('Zebediah'),null);
  eq('short word is not fuzzy matched',best('Al'),null);
  const amb=L.matchPeople('Sam',P);
  eq('Sam matches two people -> ambiguous',[amb.ambiguous,amb.list.length>=2],[true,true]);
  eq('Brother Sam picks Brother Sam',best('Brother Sam'),'2');
  eq('Sam Lee picks Sam Lee',best('Sam Lee'),'5');
})();

console.log(pass+' passed, '+fail+' failed');
fails.forEach(f=>console.log('FAIL '+f));
process.exit(fail?1:0);
