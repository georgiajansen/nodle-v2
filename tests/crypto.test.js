// Run: node --test tests/     (Node 18+, no libraries)
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/lib/pmcrypto.js');
const UID='00000000-0000-4000-8000-000000000001';
const DATA={people:[{id:'me',name:'Georgia'},{id:'e1',name:'Secret Person Name'}],links:[]};

test('round trip: what goes in comes out',async()=>{
  const v=await C.newVault('correct horse battery staple',DATA,UID);
  const o=await C.openVault('correct horse battery staple',v.row,UID);
  assert.deepEqual(o.data,DATA);
});
test('the stored row has only ciphertext, iv, salt, kdf_iter and no plain text',async()=>{
  const v=await C.newVault('correct horse battery staple',DATA,UID);
  assert.deepEqual(Object.keys(v.row).sort(),['ciphertext','iv','kdf_iter','salt']);
  const all=JSON.stringify(v.row);
  assert.ok(!all.includes('Secret Person Name'));assert.ok(!all.includes('Georgia'));
  assert.equal(v.row.kdf_iter,600000);
});
test('wrong passphrase fails',async()=>{
  const v=await C.newVault('correct horse battery staple',DATA,UID);
  await assert.rejects(C.openVault('correct horse battery stapl3',v.row,UID));
  await assert.rejects(C.openVault('',v.row,UID));
});
test('two saves of the same data differ (fresh IV every time)',async()=>{
  const v=await C.newVault('correct horse battery staple',DATA,UID);
  const a=await C.sealRow(v.key,v.row.salt,v.row.kdf_iter,DATA,UID),b=await C.sealRow(v.key,v.row.salt,v.row.kdf_iter,DATA,UID);
  assert.notEqual(a.iv,b.iv);assert.notEqual(a.ciphertext,b.ciphertext);
});
test('tampering is detected',async()=>{
  const v=await C.newVault('correct horse battery staple',DATA,UID);
  const bytes=C.unb64(v.row.ciphertext);bytes[5]^=1;
  await assert.rejects(C.openVault('correct horse battery staple',Object.assign({},v.row,{ciphertext:C.b64(bytes)}),UID));
});
test("a row copied into another user's account does not open (bound to user id)",async()=>{
  const v=await C.newVault('correct horse battery staple',DATA,UID);
  await assert.rejects(C.openVault('correct horse battery staple',v.row,'11111111-1111-4111-8111-111111111111'));
});
test('encrypted backup round trip and wrong password',async()=>{
  const env=await C.encryptBackup('backup pass 123',DATA);
  assert.equal(env.peoplemapEnc,1);assert.ok(!JSON.stringify(env).includes('Secret Person Name'));
  assert.deepEqual(await C.decryptBackup(env,'backup pass 123'),DATA);
  await assert.rejects(C.decryptBackup(env,'nope nope nope'));
});
test('unicode passphrase works',async()=>{
  const v=await C.newVault('pässwörd-日本語-🔑-long',DATA,UID);
  assert.deepEqual((await C.openVault('pässwörd-日本語-🔑-long',v.row,UID)).data,DATA);
});
