/* PMCrypto: all encryption for Nodle. Runs in the browser (WebCrypto) and in Node 18+ for the tests.
   Nothing here talks to the network. The server only ever receives what these functions output.

   Design (plain version):
   - Your vault passphrase + a random salt  --PBKDF2-SHA256 (600,000 rounds)-->  a 256-bit key.
   - That key encrypts the whole map as ONE blob with AES-256-GCM (fresh random IV every save).
   - The PIN (optional, per device) wraps that same key with its own PBKDF2 key and lives in localStorage.
     5 wrong PINs wipes it. */
(function(root){
'use strict';
var subtle=(root.crypto&&root.crypto.subtle)||null;
if(!subtle&&typeof require==='function'){try{var wc=require('node:crypto').webcrypto;subtle=wc.subtle;root.__pmcrypto=wc}catch(e){}}
function rng(){return (root.crypto&&root.crypto.getRandomValues)?root.crypto:root.__pmcrypto}
var enc=new TextEncoder(),dec=new TextDecoder();

var KDF_ITER=600000;          // passphrase -> key (OWASP 2023 guidance for PBKDF2-SHA256)
var PIN_ITER=600000;          // PIN -> key
var MAX_PIN_FAILS=5;
var MIN_PASSPHRASE=10;
var VAULT_VERSION=1;

function ok(){return !!subtle}
function randomBytes(n){var a=new Uint8Array(n);rng().getRandomValues(a);return a}
function b64(buf){var a=new Uint8Array(buf),t='';for(var i=0;i<a.length;i+=0x8000)t+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000));return btoa(t)}
function unb64(s){var t=atob(s),a=new Uint8Array(t.length);for(var i=0;i<t.length;i++)a[i]=t.charCodeAt(i);return a}

/* passphrase + salt -> AES-GCM key. extractable=true so the key can be wrapped by a PIN. */
function deriveKey(secret,saltBytes,iter,extractable){
  return subtle.importKey('raw',enc.encode(String(secret).normalize('NFKC')),'PBKDF2',false,['deriveKey']).then(function(base){
    return subtle.deriveKey({name:'PBKDF2',salt:saltBytes,iterations:iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},!!extractable,['encrypt','decrypt']);
  });
}
function aadBytes(aad){return aad?enc.encode(aad):undefined}
/* encrypt any JSON value. Fresh random 12-byte IV on every call. */
function encryptJSON(key,obj,aad){
  var iv=randomBytes(12),params={name:'AES-GCM',iv:iv};if(aad)params.additionalData=aadBytes(aad);
  return subtle.encrypt(params,key,enc.encode(JSON.stringify(obj))).then(function(ct){return {iv:b64(iv),ct:b64(ct)}});
}
/* throws if the key is wrong or the data was changed */
function decryptJSON(key,blob,aad){
  var params={name:'AES-GCM',iv:unb64(blob.iv)};if(aad)params.additionalData=aadBytes(aad);
  return subtle.decrypt(params,key,unb64(blob.ct)).then(function(pt){return JSON.parse(dec.decode(pt))});
}
function vaultAad(userId){return 'peoplemap:v'+VAULT_VERSION+':'+userId}

/* ---- the cloud vault row: exactly { ciphertext, iv, salt, kdf_iter } ---- */
function newVault(passphrase,data,userId){
  var salt=randomBytes(16);
  return deriveKey(passphrase,salt,KDF_ITER,true).then(function(key){
    return sealRow(key,b64(salt),KDF_ITER,data,userId).then(function(row){return {key:key,row:row}});
  });
}
function sealRow(key,saltB64,iter,data,userId){
  return encryptJSON(key,data,vaultAad(userId)).then(function(e){return {ciphertext:e.ct,iv:e.iv,salt:saltB64,kdf_iter:iter}});
}
function openVault(passphrase,row,userId){
  return deriveKey(passphrase,unb64(row.salt),row.kdf_iter||KDF_ITER,true).then(function(key){
    return openRowWithKey(key,row,userId).then(function(data){return {key:key,data:data}});
  });
}
function openRowWithKey(key,row,userId){return decryptJSON(key,{iv:row.iv,ct:row.ciphertext},vaultAad(userId))}

/* ---- encrypted backup file (its own password, readable without the cloud) ---- */
function encryptBackup(password,data){
  var salt=randomBytes(16);
  return deriveKey(password,salt,KDF_ITER,false).then(function(key){
    return encryptJSON(key,data).then(function(e){return {peoplemapEnc:1,kdf:'PBKDF2-SHA256',iter:KDF_ITER,salt:b64(salt),iv:e.iv,ct:e.ct}});
  });
}
function decryptBackup(env,password){
  return deriveKey(password,unb64(env.salt),+env.iter||300000,false).then(function(key){return decryptJSON(key,{iv:env.iv,ct:env.ct})});
}

/* ---- PIN: wraps the vault key on this device only ---- */
function validPin(pin){return /^\d{4,6}$/.test(String(pin))}
function pinKeyName(userId){return 'pm.pin.'+userId}
function readRec(store,userId){try{var r=store.getItem(pinKeyName(userId));return r?JSON.parse(r):null}catch(e){return null}}
function writeRec(store,userId,rec){store.setItem(pinKeyName(userId),JSON.stringify(rec))}
function pinExists(store,userId){var r=readRec(store,userId);return !!(r&&r.ct)}
function pinClear(store,userId){try{store.removeItem(pinKeyName(userId))}catch(e){}}
function pinSetup(store,userId,key,pin){
  if(!validPin(pin))return Promise.reject(new Error('PIN must be 4 to 6 digits'));
  var salt=randomBytes(16);
  return subtle.exportKey('raw',key).then(function(raw){
    return deriveKey(pin,salt,PIN_ITER,false).then(function(pk){
      return encryptJSON(pk,b64(raw),'pin:'+userId).then(function(e){
        writeRec(store,userId,{v:1,iter:PIN_ITER,salt:b64(salt),iv:e.iv,ct:e.ct,fails:0});
      });
    });
  });
}
/* resolves {ok:true,key} or {ok:false,remaining,wiped}. The failure is counted BEFORE trying, so closing the tab mid-attempt does not help. */
function pinUnlock(store,userId,pin){
  var rec=readRec(store,userId);
  if(!rec||!rec.ct)return Promise.resolve({ok:false,remaining:0,wiped:true});
  var fails=(rec.fails||0)+1;
  if(fails>MAX_PIN_FAILS){pinClear(store,userId);return Promise.resolve({ok:false,remaining:0,wiped:true})}
  rec.fails=fails;writeRec(store,userId,rec);
  function bad(){
    if(fails>=MAX_PIN_FAILS){pinClear(store,userId);return {ok:false,remaining:0,wiped:true}}
    return {ok:false,remaining:MAX_PIN_FAILS-fails,wiped:false};
  }
  if(!validPin(pin))return Promise.resolve(bad());
  return deriveKey(pin,unb64(rec.salt),rec.iter||PIN_ITER,false).then(function(pk){
    return decryptJSON(pk,{iv:rec.iv,ct:rec.ct},'pin:'+userId);
  }).then(function(rawB64){
    return subtle.importKey('raw',unb64(rawB64),{name:'AES-GCM',length:256},true,['encrypt','decrypt']);
  }).then(function(key){
    var r2=readRec(store,userId);if(r2){r2.fails=0;writeRec(store,userId,r2)}
    return {ok:true,key:key};
  },function(){return bad()});
}

var api={KDF_ITER:KDF_ITER,PIN_ITER:PIN_ITER,MAX_PIN_FAILS:MAX_PIN_FAILS,MIN_PASSPHRASE:MIN_PASSPHRASE,ok:ok,randomBytes:randomBytes,b64:b64,unb64:unb64,
  deriveKey:deriveKey,encryptJSON:encryptJSON,decryptJSON:decryptJSON,vaultAad:vaultAad,newVault:newVault,sealRow:sealRow,openVault:openVault,openRowWithKey:openRowWithKey,
  encryptBackup:encryptBackup,decryptBackup:decryptBackup,validPin:validPin,pinExists:pinExists,pinClear:pinClear,pinSetup:pinSetup,pinUnlock:pinUnlock};
root.PMCrypto=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
