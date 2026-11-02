const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/lib/pmcrypto.js');
const {VaultSync}=require('../src/lib/pmvault.js');
const {createMock,USER}=require('./mock_supabase.js');
const PASS='correct horse battery staple';

async function client(mock){
  const c=mock.createClient('https://x.supabase.co','anon',{auth:{}});
  const r=await c.auth.signInWithPassword({email:USER.email,password:USER.password});assert.equal(r.error,null);
  return c;
}
async function twoDevices(){
  const mock=createMock();
  const a=new VaultSync(await client(mock),USER.id);
  assert.deepEqual(await a.create(PASS,{n:1}),{status:'ok',version:1});
  const b=new VaultSync(await client(mock),USER.id);
  const row=await b.fetchRow();assert.ok(row);
  assert.deepEqual(await b.unlockPassphrase(PASS,row),{n:1});
  return {mock,a,b};
}
test('first save creates version 1, later saves go up by one',async()=>{
  const {a}=await twoDevices();
  assert.equal(a.version,1);
  assert.deepEqual(await a.push({n:2}),{status:'ok',version:2});
  assert.deepEqual(await a.push({n:3}),{status:'ok',version:3});
});
test('the server only ever sees ciphertext',async()=>{
  const mock=createMock(),a=new VaultSync(await client(mock),USER.id);
  await a.create(PASS,{people:[{name:'Very Secret Name'}]});await a.push({people:[{name:'Very Secret Name 2'}]});
  assert.ok(!JSON.stringify(mock.db.rows).includes('Secret'));
  assert.ok(!JSON.stringify(mock.db.log).includes('Secret'));
});
test('second device saving from an old version is refused, nothing is overwritten',async()=>{
  const {mock,a,b}=await twoDevices();
  assert.equal((await a.push({n:'from A'})).status,'ok');
  const res=await b.push({n:'from B (stale)'});
  assert.equal(res.status,'conflict');
  const pulled=await a.pullRemote();
  assert.deepEqual(pulled.data,{n:'from A'});assert.equal(mock.db.rows[0].version,2);
});
test('after a conflict: "use theirs" loads the server copy and the next save works',async()=>{
  const {a,b}=await twoDevices();
  await a.push({n:'from A'});
  assert.equal((await b.push({n:'B'})).status,'conflict');
  const remote=await b.pullRemote();assert.equal(remote.status,'ok');b.adopt(remote);
  assert.equal((await b.push({n:'B after merge'})).status,'ok');
  assert.equal(b.version,3);
});
test('after a conflict: "keep mine" overwrites on purpose',async()=>{
  const {a,b}=await twoDevices();
  await a.push({n:'from A'});
  assert.equal((await b.push({n:'B'})).status,'conflict');
  assert.equal((await b.overwrite({n:'B wins'})).status,'ok');
  assert.deepEqual((await a.pullRemote()).data,{n:'B wins'});
});
test('write that races in between is caught by the server check',async()=>{
  const {mock,a,b}=await twoDevices();
  mock.db.beforeWrite=()=>{const r=mock.db.rows[0];r.version+=1};   // someone else saved just before our write lands
  assert.equal((await a.push({n:'late'})).status,'conflict');
});
test('two saves started together are applied one after the other, not both with the same version',async()=>{
  const {a}=await twoDevices();
  const [r1,r2]=await Promise.all([a.push({n:'one'}),a.push({n:'two'})]);
  assert.equal(r1.status,'ok');assert.equal(r2.status,'ok');assert.equal(a.version,3);
});
test('creating a second vault for the same user is a conflict, not an overwrite',async()=>{
  const {mock}=await twoDevices();
  const c=new VaultSync(await client(mock),USER.id);
  assert.equal((await c.create('another passphrase here',{n:9})).status,'conflict');
  assert.equal(mock.db.rows.length,1);
});
test('no session: reads see nothing and writes are refused (row level security)',async()=>{
  const {mock}=await twoDevices();
  const anon=mock.createClient('u','k',{auth:{}});
  const s=new VaultSync(anon,USER.id);
  assert.equal(await s.fetchRow(),null);
  assert.equal(mock.db.rows.length,1);
  await assert.rejects(s.create(PASS,{n:1}));
});
test('network down: save reports error and keeps the version; later save works',async()=>{
  const {mock,a}=await twoDevices();
  mock.db.netDown=true;
  const r=await a.push({n:'offline'});assert.equal(r.status,'error');assert.equal(a.version,1);
  mock.db.netDown=false;assert.equal((await a.push({n:'online'})).status,'ok');
});
test('changing the passphrase: new key works, old passphrase does not; other device is told (keychanged)',async()=>{
  const {a,b}=await twoDevices();
  assert.equal((await a.changePassphrase('a brand new passphrase',{n:5})).status,'ok');
  const row=await b.fetchRow();
  await assert.rejects(new VaultSync(b.client,USER.id).unlockPassphrase(PASS,row));
  const c=new VaultSync(b.client,USER.id);assert.deepEqual(await c.unlockPassphrase('a brand new passphrase',row),{n:5});
  const p=await b.pullRemote();assert.equal(p.status,'keychanged');
});
test('wrong passphrase on unlock throws and leaves the vault locked',async()=>{
  const {b}=await twoDevices();
  const v=new VaultSync(b.client,USER.id),row=await b.fetchRow();
  await assert.rejects(v.unlockPassphrase('wrong passphrase!!',row));assert.equal(v.hasKey(),false);
});
