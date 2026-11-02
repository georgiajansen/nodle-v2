/* PMVault: saves and loads the ONE encrypted blob in Supabase (table "vaults").
   It never sees plain text of your contacts except in memory, and it only sends output of PMCrypto to the server.
   Version check ("optimistic concurrency"): every save says "I am replacing version N". If another device already
   saved N+1, the save is refused with status "conflict" and nothing is overwritten. */
(function(root){
'use strict';
var C=root.PMCrypto||(typeof require==='function'?require('./pmcrypto.js'):null);
var COLS='user_id,ciphertext,iv,salt,kdf_iter,version,updated_at';

function VaultSync(client,userId){
  this.client=client;this.userId=userId;
  this.key=null;this.saltB64='';this.iter=C.KDF_ITER;
  this.version=0;            // the server version we last loaded or saved (0 = no row yet)
  this._chain=Promise.resolve();
}
function isConflict(err){
  if(!err)return false;
  var m=String(err.message||'')+' '+String(err.details||'');
  return err.code==='23505'||err.code==='40001'||/version conflict/i.test(m);
}
function netErr(e){var x=new Error(e&&e.message?e.message:'Network problem');x.kind='network';return x}

VaultSync.prototype.fetchRow=function(){
  var self=this;
  return Promise.resolve().then(function(){
    return self.client.from('vaults').select(COLS).eq('user_id',self.userId).maybeSingle();
  }).then(function(r){
    if(r.error)throw netErr(r.error);
    return r.data||null;
  },function(e){throw netErr(e)});
};
VaultSync.prototype.hasKey=function(){return !!this.key};
VaultSync.prototype._adopt=function(key,row){this.key=key;this.saltB64=row.salt;this.iter=row.kdf_iter||C.KDF_ITER;this.version=row.version};
/* first run: make a brand-new vault from a new passphrase */
VaultSync.prototype.create=function(passphrase,data){
  var self=this;
  return C.newVault(passphrase,data,self.userId).then(function(v){
    var row=v.row;row.user_id=self.userId;row.version=1;
    return self.client.from('vaults').insert(row).select('version,updated_at').then(function(r){
      if(r.error){if(isConflict(r.error))return {status:'conflict'};throw netErr(r.error)}
      self._adopt(v.key,row);self.version=1;return {status:'ok',version:1};
    });
  });
};
/* unlock with passphrase (throws if wrong) */
VaultSync.prototype.unlockPassphrase=function(passphrase,row){
  var self=this;
  return C.openVault(passphrase,row,self.userId).then(function(o){self._adopt(o.key,row);return o.data});
};
/* unlock with an already-known key (PIN path). throws if the key no longer matches the stored vault */
VaultSync.prototype.unlockKey=function(key,row){
  var self=this;
  return C.openRowWithKey(key,row,self.userId).then(function(d){self._adopt(key,row);return d});
};
VaultSync.prototype._write=function(rowFields,expected){
  var self=this;
  var fields=Object.assign({},rowFields,{version:expected+1});
  return self.client.from('vaults').update(fields).eq('user_id',self.userId).eq('version',expected).select('version,updated_at').then(function(r){
    if(r.error){if(isConflict(r.error))return {status:'conflict'};throw netErr(r.error)}
    if(!r.data||!r.data.length)return {status:'conflict'};
    self.version=expected+1;return {status:'ok',version:self.version};
  });
};
/* save the current data. One at a time. Returns {status:'ok'|'conflict'|'error', ...} and never throws. */
VaultSync.prototype.push=function(data){
  var self=this;
  var job=self._chain.then(function(){
    if(!self.key)return {status:'error',error:new Error('locked')};
    var key=self.key,salt=self.saltB64,iter=self.iter,expected=self.version;
    return C.sealRow(key,salt,iter,data,self.userId).then(function(row){return self._write(row,expected)});
  }).catch(function(e){return {status:'error',error:e}});
  self._chain=job.then(function(){},function(){});
  return job;
};
/* read what is on the server now and open it with the key we hold. */
VaultSync.prototype.pullRemote=function(){
  var self=this;
  return self.fetchRow().then(function(row){
    if(!row)return {status:'missing'};
    return C.openRowWithKey(self.key,row,self.userId).then(function(data){return {status:'ok',data:data,version:row.version,row:row}},
      function(){return {status:'keychanged',row:row}});
  });
};
/* user chose "keep mine": replace whatever is on the server with my data */
VaultSync.prototype.overwrite=function(data){
  var self=this;
  return self.fetchRow().then(function(row){
    if(!row)return {status:'error',error:new Error('vault missing')};
    self.version=row.version;
    return self.push(data);
  });
};
/* user chose "use theirs" */
VaultSync.prototype.adopt=function(remote){this.version=remote.version};
/* new passphrase: new salt, new key, whole blob re-encrypted, written with the version check. */
VaultSync.prototype.changePassphrase=function(newPass,data){
  var self=this,salt=C.randomBytes(16);
  return C.deriveKey(newPass,salt,C.KDF_ITER,true).then(function(key){
    return C.sealRow(key,C.b64(salt),C.KDF_ITER,data,self.userId).then(function(row){
      return self._write(row,self.version).then(function(res){
        if(res.status==='ok'){self.key=key;self.saltB64=row.salt;self.iter=C.KDF_ITER}
        return res;
      });
    });
  });
};
VaultSync.prototype.lock=function(){this.key=null};

var api={VaultSync:VaultSync,isConflict:isConflict};
root.PMVault=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
