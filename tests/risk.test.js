const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../src/lib/pmrisk.js');
const T=a=>({honest:a[0],reliable:a[1],discreet:a[2],generous:a[3],steady:a[4],boundaries:a[5]});
const V=(traits,red,green,evidence,priv,money,contacts,favThey,favMine)=>({traits:T(traits),red,green,evidence,exposure:{priv,money},contacts,favThey,favMine});
const cases=[
 ['A1 low honesty, in deals, 10 contacts',V([2,3,3,3,3,3],0,0,[],false,true,10,0,0),44,'high'],
 ['A2 kind friend, one red flag',V([5,4,5,4,4,5],1,0,[],false,false,3,0,0),9,'low'],
 ['A3 critical',V([1,2,2,2,2,2],3,0,[{ageDays:20,effect:'bad'},{ageDays:60,effect:'bad'}],true,true,12,0,3),null,'critical'],
 ['A4 trusted mentor, high exposure',V([5,5,5,4,5,5],0,3,[{ageDays:30,effect:'good'}],true,true,10,3,0),null,'low'],
 ['A5 mediocre, no exposure',V([3,3,3,3,3,3],0,0,[],false,false,0,0,0),null,'medium'],
 ['A6 two traits only',V([2,3,0,0,0,0],0,0,[],true,true,10,0,0),null,'none'],
 ['A9 dishonest, zero exposure',V([1,2,2,2,2,2],0,0,[],false,false,0,0,0),null,'medium'],
];
for(const [n,i,score,level] of cases)test(n,()=>{const r=R.riskOf(i);assert.equal(r.level,level);if(score!==null)assert.equal(r.score,score)});

// the example people from the brief (section 8): 53 / 83 / 42 / 24 / 12 / 5 / 0 / not enough info
const EX=[
 ['Marcus',V([2,3,3,4,3,3],1,0,[{ageDays:25,effect:'bad'},{ageDays:60,effect:'good'}],true,true,3,0,2),53,'high'],
 ['Raj',V([2,2,2,3,2,2],3,0,[{ageDays:20,effect:'bad'},{ageDays:70,effect:'bad'}],true,true,3,0,3),83,'critical'],
 ['Kenji',V([3,2,3,3,3,3],1,0,[{ageDays:90,effect:'bad'}],false,true,2,0,1),42,'high'],
 ['Ben',V([3,3,3,3,3,3],1,0,[],false,false,1,0,0),24,'medium'],
 ['Helen',V([4,4,4,4,4,4],0,2,[{ageDays:40,effect:'good'}],false,true,2,2,0),12,'low'],
 ['Priya',V([5,5,5,4,5,5],0,3,[{ageDays:30,effect:'good'}],true,false,1,2,0),5,'low'],
 ['Mum',V([5,5,5,5,4,4],0,2,[],true,false,1,0,0),0,'low'],
 ['Nina',V([4,0,0,0,0,0],0,0,[],false,false,1,0,0),null,'none']];
for(const [n,i,score,level] of EX)test('example: '+n,()=>{const r=R.riskOf(i);assert.equal(r.level,level);assert.equal(r.score,score)});

test('levels use the right thresholds',()=>{
  assert.equal(R.effective('high',{level:'low',reason:'x'}),'low');
  assert.equal(R.effective('high',{level:'',reason:''}),'high');
  assert.equal(R.effective('none',null),'none');
});
test('explain: biggest factors first, at most 6, each worth at least 2 points',()=>{
  const w=R.explain(EX[1][1],{redNames:['gossips','lies','pushy about money'],latestBadText:'Told other people about my plan after I asked him to keep it private, which was a lot'});
  assert.ok(w.up.length>0&&w.up.length<=6);
  for(let k=1;k<w.up.length;k++)assert.ok(w.up[k-1].pts>=w.up[k].pts);
  assert.ok(w.up.every(x=>x.pts>=2));
  assert.ok(w.up.some(x=>/^3 red flags: gossips, lies, pushy about money$/.test(x.text)));
  assert.ok(w.up.length===6);
  assert.ok(R.explain(EX[0][1],{}).up.some(x=>/^Mostly takes: owes you 2 favours$/.test(x.text)));
  assert.ok(w.up.some(x=>/Low honesty \(2\/5\)/.test(x.text)));
});
test('explain: provisional note for just-met, nothing for not-enough-info numbers',()=>{
  assert.match(R.explain(EX[0][1],{confidence:'new'}).note,/only just met/);
  assert.deepEqual(R.explain(EX[7][1],{}).up,[]);
});
