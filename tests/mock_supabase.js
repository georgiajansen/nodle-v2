/* A tiny fake of the parts of supabase-js that Nodle uses. FOR TESTS ONLY (never shipped: build.js does not copy tests/).
   It enforces the same rules as supabase/schema.sql: row-level security (own row only), one row per user,
   and "version must go up by exactly 1" on update.
   Used two ways:
     - node tests:   const { createMock } = require('./mock_supabase.js')
     - browser e2e:  this same file is served in place of vendor/supabase.js and defines window.supabase */
(function(root){
'use strict';
var USER={id:'00000000-0000-4000-8000-000000000001',email:'georgia@example.test',password:'test-password-123'};
var TOTP_CODE='123456';

function memStore(){var m={};return {getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]}}}

function createMock(opts){
  opts=opts||{};
  var persist=opts.persist;                // optional storage (browser: localStorage) so the fake DB survives page reloads
  var DBKEY='mock.db';
  var db={rows:[],mfa:{enrolled:false,factorId:'f-1',verified:false},netDown:false,beforeWrite:null,log:[],signedOutGlobal:0,signedOutLocal:0,signIns:0,failSignIn:false,users:[],signupsOpen:true,confirmEmail:false,signUps:0,signUpError:null};
  if(persist){try{var raw=persist.getItem(DBKEY);if(raw){var o=JSON.parse(raw);db.rows=o.rows||[];db.mfa=o.mfa||db.mfa;db.users=o.users||[];db.signupsOpen=o.signupsOpen!==false;db.confirmEmail=!!o.confirmEmail}}catch(e){}}
  function save(){if(persist)persist.setItem(DBKEY,JSON.stringify({rows:db.rows,mfa:db.mfa,users:db.users,signupsOpen:db.signupsOpen,confirmEmail:db.confirmEmail}))}
  function clone(x){return JSON.parse(JSON.stringify(x))}

  function createClient(url,key,options){
    options=options||{};
    var a=options.auth||{},storage=a.storage||memStore(),skey=a.storageKey||'mock.auth';
    var listeners=[];
    function readSession(){var r=storage.getItem(skey);if(!r)return null;try{return JSON.parse(r)}catch(e){return null}}
    function emit(ev,s){listeners.forEach(function(l){try{l(ev,s)}catch(e){}})}
    /* the assurance level lives inside the session (like the real access-token), so it survives page reloads */
    var aal={get current(){var x=readSession();return x&&x.aal||'aal1'},set current(v){var x=readSession();if(x){x.aal=v;storage.setItem(skey,JSON.stringify(x))}}};
    var auth={
      signInWithPassword:function(c){
        db.signIns++;
        if(db.netDown)return Promise.resolve({data:{},error:{message:'Failed to fetch',name:'AuthRetryableFetchError'}});
        var u=c.email===USER.email&&c.password===USER.password?{id:USER.id,email:USER.email,confirmed:true}:db.users.filter(function(x){return x.email===c.email&&x.password===c.password})[0];
        if(db.failSignIn||!u)return Promise.resolve({data:{user:null,session:null},error:{message:'Invalid login credentials',status:400,code:'invalid_credentials'}});
        if(!u.confirmed)return Promise.resolve({data:{user:null,session:null},error:{message:'Email not confirmed',status:400,code:'email_not_confirmed'}});
        var s={access_token:'mock-token',user:{id:u.id,email:u.email}};
        storage.setItem(skey,JSON.stringify(s));aal.current='aal1';
        setTimeout(function(){emit('SIGNED_IN',s)},0);
        return Promise.resolve({data:{user:s.user,session:s},error:null});
      },
      signUp:function(c){
        db.signUps++;
        if(db.netDown)return Promise.resolve({data:{user:null,session:null},error:{message:'Failed to fetch',name:'AuthRetryableFetchError'}});
        if(db.signUpError)return Promise.resolve({data:{user:null,session:null},error:db.signUpError});
        if(!db.signupsOpen)return Promise.resolve({data:{user:null,session:null},error:{message:'Signups not allowed for this instance',status:422,code:'signup_disabled'}});
        if((c.password||'').length<6)return Promise.resolve({data:{user:null,session:null},error:{message:'Password should be at least 6 characters.',status:422,code:'weak_password'}});
        if(c.email===USER.email||db.users.some(function(x){return x.email===c.email}))
          return Promise.resolve({data:{user:{id:'fake',email:c.email,identities:[]},session:null},error:null});   // like real Supabase with email confirmation: no error, empty identities
        var u={id:'00000000-0000-4000-8000-'+('000000000000'+(db.users.length+2)).slice(-12),email:c.email,password:c.password,confirmed:!db.confirmEmail};
        db.users.push(u);save();
        var user={id:u.id,email:u.email,identities:[{provider:'email'}]};
        if(db.confirmEmail)return Promise.resolve({data:{user:user,session:null},error:null});
        var s={access_token:'mock-token',user:{id:u.id,email:u.email}};
        storage.setItem(skey,JSON.stringify(s));aal.current='aal1';
        setTimeout(function(){emit('SIGNED_IN',s)},0);
        return Promise.resolve({data:{user:user,session:s},error:null});
      },
      getSession:function(){return Promise.resolve({data:{session:readSession()},error:null})},
      getUser:function(){var s=readSession();return Promise.resolve(s?{data:{user:s.user},error:null}:{data:{user:null},error:{message:'no session'}})},
      signOut:function(o){
        o=o||{};if(o.scope==='global')db.signedOutGlobal++;else db.signedOutLocal++;
        storage.removeItem(skey);setTimeout(function(){emit('SIGNED_OUT',null)},0);
        return Promise.resolve({error:null});
      },
      onAuthStateChange:function(cb){listeners.push(cb);return {data:{subscription:{unsubscribe:function(){listeners=listeners.filter(function(x){return x!==cb})}}}}},
      mfa:{
        getAuthenticatorAssuranceLevel:function(){return Promise.resolve({data:{currentLevel:aal.current,nextLevel:db.mfa.enrolled&&db.mfa.verified?'aal2':'aal1'},error:null})},
        listFactors:function(){return Promise.resolve({data:{totp:db.mfa.enrolled&&db.mfa.verified?[{id:db.mfa.factorId,status:'verified',factor_type:'totp'}]:[],all:[]},error:null})},
        enroll:function(){db.mfa.enrolled=true;db.mfa.verified=false;save();return Promise.resolve({data:{id:db.mfa.factorId,type:'totp',totp:{qr_code:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="white"/></svg>',secret:'MOCKSECRET234567',uri:'otpauth://totp/x'}},error:null})},
        challengeAndVerify:function(p){
          if(p.code!==TOTP_CODE)return Promise.resolve({data:null,error:{message:'Invalid TOTP code entered'}});
          db.mfa.verified=true;aal.current='aal2';save();return Promise.resolve({data:{},error:null});
        },
        unenroll:function(){db.mfa.enrolled=false;db.mfa.verified=false;save();return Promise.resolve({data:{},error:null})}
      }
    };
    function from(table){return new Query(table)}
    function Query(table){this.table=table;this.op='select';this.filters=[];this.payload=null;this.ret=false;this.mode='many'}
    Query.prototype.select=function(){if(this.op!=='select')this.ret=true;return this};
    Query.prototype.insert=function(r){this.op='insert';this.payload=r;return this};
    Query.prototype.update=function(r){this.op='update';this.payload=r;return this};
    Query.prototype.delete=function(){this.op='delete';return this};
    Query.prototype.eq=function(c,v){this.filters.push([c,v]);return this};
    Query.prototype.maybeSingle=function(){this.mode='maybe';return this};
    Query.prototype.single=function(){this.mode='single';return this};
    Query.prototype.then=function(res,rej){return this._run().then(res,rej)};
    Query.prototype._run=function(){
      var q=this,s=readSession();
      db.log.push({op:q.op,table:q.table,payload:q.payload?clone(q.payload):null});
      return new Promise(function(resolve){
        setTimeout(function(){
          if(db.netDown)return resolve({data:null,error:{message:'Failed to fetch'}});
          var uid=s&&s.user.id;
          function match(r){return q.filters.every(function(f){return r[f[0]]===f[1]})}
          function shape(rows){
            if(q.mode==='many')return {data:rows,error:null};
            if(rows.length>1)return {data:null,error:{message:'multiple rows'}};
            if(!rows.length)return q.mode==='single'?{data:null,error:{code:'PGRST116',message:'no rows'}}:{data:null,error:null};
            return {data:rows[0],error:null};
          }
          if(q.table!=='vaults')return resolve({data:null,error:{message:'unknown table'}});
          if(q.op==='select'){return resolve(shape(db.rows.filter(function(r){return uid&&r.user_id===uid&&match(r)}).map(clone)))}
          if(!uid)return resolve({data:null,error:{code:'42501',message:'new row violates row-level security policy'}});
          if(db.beforeWrite){var hook=db.beforeWrite;db.beforeWrite=null;hook(db)}
          if(q.op==='insert'){
            var row=clone(q.payload);
            if(row.user_id!==uid)return resolve({data:null,error:{code:'42501',message:'new row violates row-level security policy'}});
            if(db.rows.some(function(r){return r.user_id===uid}))return resolve({data:null,error:{code:'23505',message:'duplicate key value violates unique constraint'}});
            row.version=1;row.updated_at=new Date().toISOString();db.rows.push(row);save();
            return resolve(q.ret?shape([clone(row)]):{data:null,error:null});
          }
          if(q.op==='update'){
            var hit=db.rows.filter(function(r){return r.user_id===uid&&match(r)});
            var out=[];
            for(var i=0;i<hit.length;i++){
              var f=clone(q.payload);
              if('user_id' in f&&f.user_id!==uid)return resolve({data:null,error:{code:'42501',message:'rls'}});
              if('version' in f&&f.version!==hit[i].version+1)return resolve({data:null,error:{code:'40001',message:'version conflict'}});
              Object.assign(hit[i],f);hit[i].updated_at=new Date().toISOString();out.push(clone(hit[i]));
            }
            save();
            return resolve(q.ret?shape(out):{data:null,error:null});
          }
          return resolve({data:null,error:{code:'42501',message:'delete is not allowed'}});
        },0);
      });
    };
    return {auth:auth,from:from};
  }
  return {createClient:createClient,db:db,USER:USER,TOTP_CODE:TOTP_CODE,save:save};
}

if(typeof module!=='undefined'&&module.exports)module.exports={createMock:createMock,USER:USER,TOTP_CODE:TOTP_CODE,memStore:memStore};
if(typeof window!=='undefined'){
  var m=createMock({persist:window.localStorage});
  window.supabase={createClient:m.createClient};
  window.__mock=m;
}
})(typeof window!=='undefined'?window:globalThis);
