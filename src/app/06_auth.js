/* ---------- sign-in, vault unlock, lock, log out ---------- */
var authEl=$('#auth'),aboxEl=$('#abox');
var STAY_KEY='pm.stay',IDLE_KEY='pm.idle',EMAIL_KEY='pm.email';
var signingOut=false,pendingSeed=null,lastAct=Date.now();

function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function delay(ms){return new Promise(function(r){setTimeout(r,ms)})}

/* the sign-in session lives in localStorage ("stay logged in") or sessionStorage (until the tab closes) */
function authStore(){return lsGet(STAY_KEY)==='1'?localStorage:sessionStorage}
var authStorage={
  getItem:function(k){try{return authStore().getItem(k)}catch(e){return null}},
  setItem:function(k,v){try{authStore().setItem(k,v)}catch(e){}},
  removeItem:function(k){try{localStorage.removeItem(k);sessionStorage.removeItem(k)}catch(e){}}
};
function purgeAuthStores(){
  [localStorage,sessionStorage].forEach(function(st){
    try{Object.keys(st).filter(function(k){return k.indexOf('pm.auth')===0}).forEach(function(k){st.removeItem(k)})}catch(e){}
  });
}

/* ---------- the sign-in overlay ---------- */
function showAuth(title,sub,nodes){
  closeModal();
  aboxEl.textContent='';
  aboxEl.append(h('div',{class:'abrand'},'NODLE'),h('h2',{id:'atitle'},title),sub?h('div',{class:'asub'},sub):null,nodes);
  authEl.classList.add('on');
  var f=aboxEl.querySelector('input:not([type=checkbox]):not([type=file])');if(f)setTimeout(function(){f.focus()},30);
}
function hideAuth(){authEl.classList.remove('on');aboxEl.textContent=''}
function lab(text,input,id){input.id=id;return h('div',{class:'afield'},h('label',{for:id},text),input)}
function errBox(){return h('div',{class:'err',id:'aerr',role:'alert'})}
function setErr(t){var e=$('#aerr');if(e)e.textContent=t||''}
function busy(btn,on){btn.disabled=!!on}
function link(text,fn,id){return h('button',{class:'alink',id:id||'',type:'button',onclick:fn},text)}
function screenError(msg,retry){
  showAuth('Something went wrong',null,h('div',{},h('div',{class:'err',id:'aerr'},msg),
    h('div',{class:'arow'},retry?h('button',{class:'primary',id:'aretry',onclick:retry},'Try again'):null,authUser?link('Sign out',function(){logout('local')},'asignout'):null)));
}

/* 1. email + password */
function screenLogin(msg){
  var em=h('input',{type:'email',autocomplete:'username',value:lsGet(EMAIL_KEY)||'',required:true}),
      pw=h('input',{type:'password',autocomplete:'current-password',required:true}),
      stay=h('input',{type:'checkbox',id:'astay',checked:lsGet(STAY_KEY)!=='0'}),
      go=h('button',{class:'primary',id:'alogin',type:'submit'},'Sign in'),err=errBox();
  if(msg)err.textContent=msg;
  var form=h('form',{id:'loginform',onsubmit:function(e){
    e.preventDefault();
    if(!em.value.trim()||!pw.value){setErr('Enter your email and password.');return}
    busy(go,true);setErr('');
    lsSet(STAY_KEY,stay.checked?'1':'0');purgeAuthStores();lsSet(EMAIL_KEY,em.value.trim());
    sb.auth.signInWithPassword({email:em.value.trim(),password:pw.value}).then(function(r){
      pw.value='';
      if(r.error){busy(go,false);setErr(/network|fetch/i.test(r.error.message||'')?'Cannot reach the cloud. Check your internet and try again.':'Wrong email or password.');return}
      afterAuth();
    },function(){busy(go,false);setErr('Cannot reach the cloud. Check your internet and try again.')});
  }},
    lab('Email',em,'aemail'),lab('Password',pw,'apass'),
    h('label',{class:'acheck'},stay,h('span',{},'Stay logged in on this device'),h('small',{},'You will still need your vault passphrase (or PIN) to open the map.')),
    err,go);
  showAuth('Sign in','Step 1 of 2: your account. Then you unlock the map with your vault passphrase.',form);
}

/* 2. after sign-in: check the server still accepts this session, then two-step code if switched on */
function afterAuth(){
  return sb.auth.getUser().then(function(r){
    if(r.error||!r.data||!r.data.user){
      var st=r.error&&r.error.status;
      if(!r.error||st===401||st===403||/session|jwt|token/i.test((r.error.name||'')+' '+(r.error.message||'')))return screenLogin();
      return screenError('Cannot reach the cloud. Check your internet connection.',afterAuth);
    }
    authUser={id:r.data.user.id,email:r.data.user.email};
    return sb.auth.mfa.getAuthenticatorAssuranceLevel().then(function(a){
      var d=a&&a.data;
      if(d&&d.nextLevel==='aal2'&&d.currentLevel!=='aal2')return screenMfa();
      return startVault();
    },function(){return startVault()});
  },function(){screenError('Cannot reach the cloud. Check your internet connection.',afterAuth)});
}
function screenMfa(msg){
  sb.auth.mfa.listFactors().then(function(r){
    var f=r.data&&(r.data.totp||[])[0];
    if(!f){startVault();return}
    var code=h('input',{type:'text',inputMode:'numeric',autocomplete:'one-time-code',maxlength:6,placeholder:'123456'}),go=h('button',{class:'primary',id:'amfago',type:'submit'},'Check code'),err=errBox();
    if(msg)err.textContent=msg;
    showAuth('Two-step code','Open your authenticator app and type the 6-digit code for Nodle.',
      h('form',{id:'mfaform',onsubmit:function(e){
        e.preventDefault();busy(go,true);setErr('');
        sb.auth.mfa.challengeAndVerify({factorId:f.id,code:code.value.trim()}).then(function(v){
          if(v.error){busy(go,false);code.value='';setErr('That code did not work. Wait for a new one and try again.');code.focus();return}
          startVault();
        },function(){busy(go,false);setErr('Cannot reach the cloud.')});
      }},lab('6-digit code',code,'amfa'),err,go,h('div',{class:'arow'},link('Sign out',function(){logout('local')},'asignout'))));
  },function(){screenError('Cannot reach the cloud.',screenMfa)});
}

/* 3. find the vault row: none yet = first run, otherwise unlock */
function startVault(msg){
  hideAuth();
  vsync=new PMVault.VaultSync(sb,authUser.id);
  return vsync.fetchRow().then(function(row){
    if(row)screenUnlock(row,msg);else screenCreate();
  },function(){screenError('Cannot reach the cloud. Check your internet connection.',function(){startVault(msg)})});
}

/* first run: make the vault passphrase */
function screenCreate(){
  var p1=h('input',{type:'password',autocomplete:'new-password'}),p2=h('input',{type:'password',autocomplete:'new-password'}),
      ack=h('input',{type:'checkbox',id:'aack'}),go=h('button',{class:'primary',id:'acreate',type:'submit'},'Create my vault'),err=errBox(),
      imp=h('div',{class:'muted',id:'aimpmsg'}),file=h('input',{type:'file',id:'afile',accept:'.json,application/json',style:'display:none'});
  if(pendingSeed)imp.textContent='Backup ready: '+(pendingSeed.people.length-1)+' people will be your starting map.';
  file.onchange=function(){
    var f=file.files[0];if(!f)return;var r=new FileReader();
    r.onload=function(){readBackupText(r.result,function(raw){
      try{pendingSeed=sanitize(raw);imp.textContent='Backup ready: '+(pendingSeed.people.length-1)+' people will be your starting map.'}catch(e){setErr('Could not read that backup: '+e.message)}
    });file.value=''};
    r.readAsText(f);
  };
  var form=h('form',{id:'createform',onsubmit:function(e){
    e.preventDefault();setErr('');
    if(p1.value.length<PMCrypto.MIN_PASSPHRASE){setErr('Use at least '+PMCrypto.MIN_PASSPHRASE+' characters. A sentence or four random words works well.');return}
    if(p1.value!==p2.value){setErr('The two passphrases do not match.');return}
    if(!ack.checked){setErr('Please tick the box to show you understand.');return}
    busy(go,true);go.textContent='Creating…';
    var seed=pendingSeed||fresh();S=seed;var data=snapshot();S=fresh();
    vsync.create(p1.value,data).then(function(r){
      if(r.status==='conflict'){go.textContent='Create my vault';busy(go,false);startVault();return}
      pendingSeed=null;p1.value=p2.value='';enterApp(data,true);
    },function(){busy(go,false);go.textContent='Create my vault';setErr('Cannot reach the cloud, or it refused. Check your internet and try again.')});
  }},
    lab('Vault passphrase',p1,'apass1'),lab('Type it again',p2,'apass2'),
    h('div',{class:'warnbox',id:'awarn'},h('b',{},'This passphrase cannot be recovered. '),'Your map is scrambled in this browser before it is saved, with a key made from this passphrase. Nobody else has the key: not the app maker, not the cloud company, not your helper. If you forget it, your data is gone for good. Write it down somewhere safe, and keep an encrypted backup file.'),
    h('label',{class:'acheck'},ack,h('span',{},'I understand: if I forget it, nobody can get my data back.')),
    err,go,
    h('div',{class:'asep'},'Moving from another copy?'),
    h('div',{class:'arow'},h('button',{type:'button',id:'aimport',onclick:function(){file.click()}},'Import a backup file'),file),imp,
    h('div',{class:'arow'},link('Sign out',function(){logout('local')},'asignout')));
  showAuth('Make your vault passphrase','Step 2 of 2: the key that locks your map. This is separate from your account password.',form);
}

/* the unlock screen (PIN first if this device has one) */
function screenUnlock(row,msg,forcePass){
  var uidv=authUser.id,hasPin=!forcePass&&PMCrypto.pinExists(localStorage,uidv);
  var foot=h('div',{class:'arow'},link('Sign out',function(){logout('local')},'asignout'));
  function fresher(){return vsync.fetchRow().then(function(r){return r||row},function(){return row})}
  function opened(data){enterApp(data,false)}
  if(hasPin){
    var pin=h('input',{type:'password',inputMode:'numeric',autocomplete:'off',maxlength:6,placeholder:'PIN'}),go=h('button',{class:'primary',id:'apingo',type:'submit'},'Unlock'),err=errBox();
    if(msg)err.textContent=msg;
    showAuth('Unlock','Signed in as '+authUser.email+'. Enter your PIN.',
      h('form',{id:'pinform',onsubmit:function(e){
        e.preventDefault();var v=pin.value;pin.value='';
        if(!PMCrypto.validPin(v)){setErr('A PIN is 4 to 6 digits.');return}
        busy(go,true);setErr('Checking…');
        PMCrypto.pinUnlock(localStorage,uidv,v).then(function(r){
          if(!r.ok){
            busy(go,false);
            if(r.wiped){screenUnlock(row,'Too many wrong PINs. The PIN was erased from this device. Use your passphrase.',true);return}
            setErr('Wrong PIN. '+r.remaining+' '+(r.remaining===1?'try':'tries')+' left before it is erased.');pin.focus();return;
          }
          return fresher().then(function(rw){return vsync.unlockKey(r.key,rw)}).then(opened,function(){
            PMCrypto.pinClear(localStorage,uidv);screenUnlock(row,'Your passphrase was changed. Use the new passphrase.',true);
          });
        },function(){busy(go,false);setErr('Could not check the PIN.')});
      }},lab('PIN',pin,'apin'),err,go,h('div',{class:'arow'},link('Use passphrase instead',function(){screenUnlock(row,'',true)},'ausepass')),foot));
    return;
  }
  var pp=h('input',{type:'password',autocomplete:'current-password'}),go2=h('button',{class:'primary',id:'aunlock',type:'submit'},'Unlock'),err2=errBox();
  if(msg)err2.textContent=msg;
  showAuth('Unlock your map','Signed in as '+authUser.email+'. Enter your vault passphrase.',
    h('form',{id:'unlockform',onsubmit:function(e){
      e.preventDefault();if(!pp.value){setErr('Type your vault passphrase.');return}
      var v=pp.value;busy(go2,true);setErr('Unlocking…');
      fresher().then(function(rw){return vsync.unlockPassphrase(v,rw)}).then(function(data){pp.value='';opened(data)},function(e2){
        busy(go2,false);
        setErr(e2&&e2.kind==='network'?'Cannot reach the cloud.':'Wrong passphrase. Try again.');pp.select();
      });
    }},lab('Vault passphrase',pp,'apass'),err2,go2,
      PMCrypto.pinExists(localStorage,uidv)?h('div',{class:'arow'},link('Use PIN instead',function(){screenUnlock(row,'')},'ausepin')):null,
      h('div',{class:'ahint'},'Forgotten it? It cannot be reset. Your encrypted backup file is the only other way back.'),foot));
}

/* ---------- the map is open ---------- */
function enterApp(data,firstRun){
  S=sanitize(data);locked=false;
  hideAuth();PMIntro.stop();document.body.classList.remove('preauth');
  startApp();
  lastPushedJSON=JSON.stringify(snapshot());pushing=false;again=false;setSync('saved');
  startRemoteWatch();lastAct=Date.now();
  if(firstRun){
    openModal('Your vault is ready',h('div',{},h('div',{class:'help'},'Your map is now saved in the cloud, scrambled so only your passphrase can open it. One safety net is worth doing today: download an encrypted backup file.'),
      h('div',{class:'muted'},'If you ever lose your passphrase, that file (opened with its own password) is the only way back.')),
      [h('span',{class:'grow'}),h('button',{id:'later',onclick:closeModal},'Later'),h('button',{class:'primary',id:'bkfirst',onclick:openBackupDialog},'Download encrypted backup')],{narrow:true});
  }
}

/* ---------- locking ---------- */
function clearEl(sel){var e=$(sel);if(e)e.textContent=''}
function wipeUI(){
  clearTimeout(saveTimer);clearTimeout(retryTimer);clearInterval(remoteTimer);
  if(raf){cancelAnimationFrame(raf);raf=null}alpha=0;
  stopPlay();tlOn=false;timeCut=null;
  S=fresh();sel=null;query='';nodeEls={};linkEls={};linkMeta=[];eventSel=[];pathTarget='';pathRes=null;
  ['#links','#nodes','#body','#tabs','#readout','#legend','#stats','#tickmove','#keys'].forEach(clearEl);
  $('#search').value='';$('#timeline').classList.remove('on');
  lastPushedJSON='';syncState='idle';pushing=false;again=false;
  closeModal();
}
function lockNow(msg,auto){
  if(locked)return;
  Promise.race([saveNow(),delay(6000)]).then(function(){
    var unsaved=syncState==='offline'||syncState==='conflict'||(vsync&&vsync.hasKey()&&JSON.stringify(snapshot())!==lastPushedJSON);
    if(unsaved&&!auto&&!msg&&!confirm('Your latest changes are not saved yet (the cloud cannot be reached). Lock anyway and lose them?'))return;
    locked=true;if(vsync)vsync.lock();
    wipeUI();
    if(authUser)startVault(msg);else screenLogin(msg);
  });
}
function logout(scope,msg){
  signingOut=true;
  var first=locked?Promise.resolve():Promise.race([saveNow(),delay(6000)]);
  first.then(function(){return sb.auth.signOut({scope:scope})}).catch(function(){}).then(function(){
    if(authUser)PMCrypto.pinClear(localStorage,authUser.id);
    purgeAuthStores();
    authUser=null;locked=true;if(vsync)vsync.lock();vsync=null;pendingSeed=null;
    wipeUI();signingOut=false;
    screenLogin(msg||(scope==='global'?'Logged out of every device.':'Signed out.'));
  });
}
function idleMinutes(){var v=lsGet(IDLE_KEY);return v===null?5:Math.max(0,parseInt(v,10)||0)}
function startIdleWatch(){
  ['pointerdown','keydown','wheel','touchstart','pointermove'].forEach(function(ev){document.addEventListener(ev,function(){lastAct=Date.now()},{capture:true,passive:true})});
  function check(){var m=idleMinutes();if(!locked&&m>0&&Date.now()-lastAct>m*60000)lockNow('Locked after '+m+' minute'+(m===1?'':'s')+' of no use.',true)}
  setInterval(check,5000);
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')check()});
}

/* ---------- security settings (inside Settings) ---------- */
function pinDialog(){
  var p1=h('input',{type:'password',inputMode:'numeric',maxlength:6,autocomplete:'off',id:'pin1'}),p2=h('input',{type:'password',inputMode:'numeric',maxlength:6,autocomplete:'off',id:'pin2'}),err=h('div',{class:'fl',id:'pinerr',style:'min-height:18px;font-size:13px'});
  var go=function(){
    if(!PMCrypto.validPin(p1.value)){err.textContent='A PIN is 4 to 6 digits.';return}
    if(p1.value!==p2.value){err.textContent='The two PINs do not match.';return}
    PMCrypto.pinSetup(localStorage,authUser.id,vsync.key,p1.value).then(function(){closeModal();renderPanel();toast('PIN set for this device')},function(e){err.textContent=e.message||'Could not set the PIN.'});
  };
  openModal('PIN for this device',h('div',{},
    h('div',{class:'muted'},'A PIN lets you reopen the map on this device without typing the long passphrase. It only works here. After 5 wrong tries it is erased and you use the passphrase.'),
    h('div',{class:'warnbox'},'A PIN is weaker than a passphrase. If someone copies this browser\'s stored data, a 4 to 6 digit PIN can be guessed offline. Use it on your own devices only.'),
    field('New PIN (4 to 6 digits)',p1),field('Type it again',p2),err),
    [h('span',{class:'grow'}),h('button',{onclick:closeModal},'Cancel'),h('button',{class:'primary',id:'pinsave',onclick:go},'Save PIN')],{narrow:true});
  setTimeout(function(){p1.focus()},30);
}
function passphraseDialog(){
  var p1=h('input',{type:'password',autocomplete:'new-password',id:'np1'}),p2=h('input',{type:'password',autocomplete:'new-password',id:'np2'}),ack=h('input',{type:'checkbox',id:'npack'}),err=h('div',{class:'fl',id:'nperr',style:'min-height:18px;font-size:13px'});
  var go=h('button',{class:'primary',id:'npsave'},'Change passphrase');
  go.onclick=function(){
    if(p1.value.length<PMCrypto.MIN_PASSPHRASE){err.textContent='Use at least '+PMCrypto.MIN_PASSPHRASE+' characters.';return}
    if(p1.value!==p2.value){err.textContent='The two passphrases do not match.';return}
    if(!ack.checked){err.textContent='Please tick the box.';return}
    go.disabled=true;err.textContent='Re-encrypting…';
    vsync.changePassphrase(p1.value,snapshot()).then(function(r){
      go.disabled=false;
      if(r.status==='ok'){PMCrypto.pinClear(localStorage,authUser.id);lastPushedJSON=JSON.stringify(snapshot());setSync('saved');closeModal();renderPanel();toast('Passphrase changed. Other devices will ask for the new one.')}
      else if(r.status==='conflict'){closeModal();setSync('conflict');showConflict()}
      else err.textContent='Could not save. Try again.';
    },function(){go.disabled=false;err.textContent='Cannot reach the cloud. Try again.'});
  };
  openModal('Change vault passphrase',h('div',{},
    h('div',{class:'warnbox'},h('b',{},'The new passphrase cannot be recovered either. '),'Your PIN on this device will be removed. Other devices must unlock with the new passphrase.'),
    field('New passphrase',p1),field('Type it again',p2),h('label',{class:'acheck'},ack,h('span',{},'I understand: if I forget it, nobody can get my data back.')),err),
    [h('span',{class:'grow'}),h('button',{onclick:closeModal},'Cancel'),go],{narrow:true});
}
function mfaEnrolDialog(){
  sb.auth.mfa.listFactors().then(function(r){
    var stale=((r.data&&r.data.all)||[]).filter(function(f){return f.factor_type==='totp'&&f.status!=='verified'});
    return Promise.all(stale.map(function(f){return sb.auth.mfa.unenroll({factorId:f.id})}));
  }).then(function(){return sb.auth.mfa.enroll({factorType:'totp',friendlyName:'Nodle '+Date.now().toString(36)})}).then(function(r){
    if(r.error||!r.data){toast('Could not start two-step sign-in: '+((r.error&&r.error.message)||'turned off for this project'));return}
    var f=r.data,code=h('input',{type:'text',inputMode:'numeric',maxlength:6,autocomplete:'off',id:'mfacode'}),err=h('div',{class:'fl',id:'mfaerr',style:'min-height:18px;font-size:13px'});
    var cancel=function(){sb.auth.mfa.unenroll({factorId:f.id});closeModal()};
    var go=function(){
      sb.auth.mfa.challengeAndVerify({factorId:f.id,code:code.value.trim()}).then(function(v){
        if(v.error){err.textContent='That code did not work. Try the next one.';return}
        closeModal();renderPanel();toast('Two-step sign-in is on');
      });
    };
    openModal('Turn on two-step sign-in',h('div',{},
      h('div',{class:'muted'},'1. Open an authenticator app (Google Authenticator, Authy, 1Password…). 2. Scan this picture, or type the secret in. 3. Type the 6-digit code it shows.'),
      h('div',{style:'text-align:center;margin:10px 0;background:#fff;padding:8px;border-radius:6px'},h('img',{src:f.totp.qr_code,alt:'QR code',id:'mfaqr',style:'width:180px;height:180px'})),
      h('div',{class:'muted',style:'word-break:break-all'},'Secret: ',h('span',{class:'mono',id:'mfasecret'},f.totp.secret)),
      field('6-digit code',code),err),
      [h('span',{class:'grow'}),h('button',{onclick:cancel},'Cancel'),h('button',{class:'primary',id:'mfaverify',onclick:go},'Turn on')],{narrow:true,sticky:true});
  },function(){toast('Could not reach the cloud')});
}
function mfaBox(){
  var box=h('div',{id:'mfabox'},h('div',{class:'muted'},'Checking two-step sign-in…'));
  sb.auth.mfa.listFactors().then(function(r){
    box.textContent='';
    var f=r.data&&(r.data.totp||[]).filter(function(x){return x.status==='verified'})[0];
    if(f){
      box.append(h('div',{class:'okc'},'Two-step sign-in is ON (authenticator app).'),
        h('button',{id:'mfaoff',class:'danger small',onclick:function(){
          if(!confirm('Turn off two-step sign-in?'))return;
          sb.auth.mfa.unenroll({factorId:f.id}).then(function(u){if(u.error)toast('Could not turn it off: '+u.error.message);else{renderPanel();toast('Two-step sign-in is off')}});
        }},'Turn off'));
    }else box.append(h('div',{class:'muted'},'Off. Adds a 6-digit code from your phone when you sign in.'),h('button',{id:'mfaon',onclick:mfaEnrolDialog},'Turn on two-step sign-in…'));
  },function(){box.textContent='Could not check (offline).'});
  return box;
}
function securityBox(){
  var box=h('div',{id:'secbox'});
  var hasPin=PMCrypto.pinExists(localStorage,authUser.id);
  var idle=h('select',{id:'setIdle',onchange:function(){lsSet(IDLE_KEY,idle.value);lastAct=Date.now();toast(idle.value==='0'?'Auto-lock is off':'Auto-lock set')}});
  var cur=idleMinutes();
  [1,2,5,10,15,30,60,0].forEach(function(m){idle.append(h('option',{value:String(m),selected:m===cur},m===0?'Never':m+' minute'+(m===1?'':'s')))});
  box.append(
    h('div',{class:'help'},'Your map is encrypted in this browser before it is saved. The key is made from your vault passphrase and is never sent anywhere, so nobody else can read your data.'),
    h('div',{class:'muted'},'Signed in as ',h('b',{},authUser.email),'. Status: ',h('span',{id:'syncword'},{saved:'saved',saving:'saving…',idle:'ready',dirty:'saving…',offline:'offline, retrying',conflict:'changed on another device'}[syncState]||syncState),'.'),
    h('h3',{},'Auto-lock'),h('div',{class:'muted'},'Lock the map after this much time with no use. You unlock again with your passphrase or PIN.'),idle,
    h('div',{style:'margin-top:8px'},h('button',{id:'setLockNow',onclick:function(){lockNow()}},'Lock now')),
    h('h3',{},'PIN for this device'),
    h('div',{class:'muted'},hasPin?'A PIN is set on this device.':'No PIN on this device. Optional: unlock with 4 to 6 digits instead of the passphrase.'),
    h('div',{style:'margin-top:6px'},h('button',{id:'setPin',onclick:pinDialog},hasPin?'Change PIN…':'Set a PIN…'),' ',hasPin?h('button',{id:'removePin',class:'danger',onclick:function(){PMCrypto.pinClear(localStorage,authUser.id);renderPanel();toast('PIN removed from this device')}},'Remove PIN'):null),
    h('h3',{},'Vault passphrase'),h('div',{class:'muted'},'Changing it re-encrypts everything. It cannot be recovered if forgotten.'),
    h('div',{style:'margin-top:6px'},h('button',{id:'setPass',onclick:passphraseDialog},'Change passphrase…')),
    h('h3',{},'Two-step sign-in'),mfaBox(),
    h('h3',{},'Sign out'),
    h('div',{class:'muted'},'"Log out this device" keeps your data safe in the cloud. "Log out all devices" ends every signed-in session, everywhere.'),
    h('div',{style:'margin-top:6px'},h('button',{id:'logoutHere',onclick:function(){logout('local')}},'Log out this device'),' ',
      h('button',{id:'logoutAll',class:'danger',onclick:function(){if(confirm('Log out of every device, including this one?'))logout('global')}},'Log out ALL devices')));
  return box;
}
