/* ---------- start ---------- */
$('#lockbadge').onclick=function(){
  if(locked)return;
  if(syncState==='conflict'){showConflict();return}
  if(syncState==='offline'){saveNow();toast('Trying to save again…');return}
  setTab('settings');settingsOpen='sec-security';renderPanel();
};
function boot(){
  document.body.classList.add('preauth');
  var cfg=window.PM_CONFIG||{};
  if(!PMCrypto.ok()){showAuth('This browser cannot be used','Secure encryption is not available. Open the app over https in an up-to-date browser.',null);return}
  if(!cfg.url||!cfg.anonKey||!window.supabase){showAuth('Not set up yet','The cloud address is missing. The site owner needs to set SUPABASE_URL and SUPABASE_ANON_KEY and rebuild.',null);return}
  sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{storage:authStorage,storageKey:'pm.auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  sb.auth.onAuthStateChange(function(ev){
    if(ev==='SIGNED_OUT'&&!signingOut&&authUser)setTimeout(function(){
      if(signingOut||!authUser)return;
      authUser=null;locked=true;if(vsync)vsync.lock();vsync=null;wipeUI();screenLogin('You were signed out (on another device, or the session ended). Sign in again.');
    },0);
  });
  startIdleWatch();
  var reduced=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var intro=PMIntro.start({reduced:reduced});
  var sess=sb.auth.getSession().then(function(r){return r&&r.data&&r.data.session},function(){return null});
  Promise.all([intro.done,sess]).then(function(a){
    if(a[1])afterAuth();else screenLogin();
  });
}
boot();
