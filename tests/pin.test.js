const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/lib/pmcrypto.js');
const {memStore}=require('./mock_supabase.js');
const UID='00000000-0000-4000-8000-000000000001';

async function setup(){
  const v=await C.newVault('correct horse battery staple',{x:1},UID);
  const store=memStore();await C.pinSetup(store,UID,v.key,'4821');
  return {v,store};
}
test('PIN wraps the vault key and unwraps it again (key decrypts the vault)',async()=>{
  const {v,store}=await setup();
  assert.ok(C.pinExists(store,UID));
  const r=await C.pinUnlock(store,UID,'4821');
  assert.equal(r.ok,true);
  assert.deepEqual(await C.openRowWithKey(r.key,v.row,UID),{x:1});
});
test('stored PIN record holds no raw key and no PIN',async()=>{
  const {v,store}=await setup();
  const raw=store.getItem(C.pinExists&&'pm.pin.'+UID);
  assert.ok(raw);assert.ok(!raw.includes('4821'));
  const rawKey=C.b64(await require('node:crypto').webcrypto.subtle.exportKey('raw',v.key));
  assert.ok(!raw.includes(rawKey));
});
test('wrong PIN is refused and counted; the right PIN resets the counter',async()=>{
  const {store}=await setup();
  let r=await C.pinUnlock(store,UID,'0000');assert.equal(r.ok,false);assert.equal(r.remaining,4);
  r=await C.pinUnlock(store,UID,'1111');assert.equal(r.remaining,3);
  r=await C.pinUnlock(store,UID,'4821');assert.equal(r.ok,true);
  r=await C.pinUnlock(store,UID,'0000');assert.equal(r.remaining,4);
});
test('5 wrong PINs wipe the wrapped key; even the right PIN then fails',async()=>{
  const {store}=await setup();
  let r;
  for(let i=1;i<=4;i++){r=await C.pinUnlock(store,UID,'0000');assert.equal(r.ok,false);assert.equal(r.wiped,false);assert.equal(r.remaining,5-i)}
  r=await C.pinUnlock(store,UID,'0000');
  assert.equal(r.ok,false);assert.equal(r.wiped,true);
  assert.equal(C.pinExists(store,UID),false);
  assert.equal(store.getItem('pm.pin.'+UID),null);
  r=await C.pinUnlock(store,UID,'4821');assert.equal(r.ok,false);assert.equal(r.wiped,true);
});
test('attempts are counted before trying (tab closed mid-attempt cannot dodge the limit)',async()=>{
  const {store}=await setup();
  await C.pinUnlock(store,UID,'0000');await C.pinUnlock(store,UID,'0000');
  assert.equal(JSON.parse(store.getItem('pm.pin.'+UID)).fails,2);
});
test('PIN must be 4 to 6 digits',async()=>{
  const v=await C.newVault('correct horse battery staple',{},UID),store=memStore();
  for(const bad of['123','1234567','12ab','','abcd'])await assert.rejects(C.pinSetup(store,UID,v.key,bad));
  await C.pinSetup(store,UID,v.key,'123456');assert.ok(C.pinExists(store,UID));
});
test('a PIN for one user does not unlock another',async()=>{
  const {store}=await setup();
  const r=await C.pinUnlock(store,'someone-else','4821');assert.equal(r.ok,false);
});
