#!/usr/bin/env node
/* Builds the static site into dist/. Vercel runs this ("npm run build").
   Reads SUPABASE_URL and SUPABASE_ANON_KEY from the environment and writes them into dist/config.js.
   Nothing secret is ever put in the source files. */
'use strict';
var fs=require('fs'),path=require('path'),crypto=require('crypto');
var ROOT=__dirname,SRC=path.join(ROOT,'src'),OUT=path.join(ROOT,'dist');
function rd(p){return fs.readFileSync(path.join(SRC,p),'utf8')}
function die(m){console.error('\nBUILD FAILED: '+m+'\n');process.exit(1)}

var url=(process.env.SUPABASE_URL||'').trim().replace(/\/+$/,'');
var key=(process.env.SUPABASE_ANON_KEY||'').trim();
if(!url)die('SUPABASE_URL is not set. In Vercel: Project → Settings → Environment Variables. (Looks like https://abcdxyz.supabase.co)');
if(!key)die('SUPABASE_ANON_KEY is not set. In Vercel: Project → Settings → Environment Variables. Use the "anon / public" key, never the service_role key.');
var u;try{u=new URL(url)}catch(e){die('SUPABASE_URL is not a valid address: '+url)}
if(u.protocol!=='https:'&&!(u.protocol==='http:'&&(u.hostname==='localhost'||u.hostname==='127.0.0.1')))die('SUPABASE_URL must start with https://');
if(/^sb_secret_/.test(key))die('That is a SECRET key. Use the anon (public) key only.');
if(key.split('.').length===3){
  try{var pl=JSON.parse(Buffer.from(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'));
    if(pl.role&&pl.role!=='anon')die('That key has role "'+pl.role+'". Only the anon (public) key may go in the website.');
  }catch(e){}
}

/* the browser may talk to this site and to the Supabase project, nothing else */
var origin=u.origin,wsOrigin=(u.protocol==='https:'?'wss://':'ws://')+u.host;
var CSP=["default-src 'none'","script-src 'self'","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self'",
  "connect-src 'self' "+origin+" "+wsOrigin,"base-uri 'none'","form-action 'none'"].join('; ');

/* app.js = the libraries, then all of src/app/*.js (in file-name order) inside one function */
var LIBS=['pmlib.js','pmcrypto.js','pmrisk.js','pmvault.js','intro.js'];
var appFiles=fs.readdirSync(path.join(SRC,'app')).filter(function(f){return /\.js$/.test(f)}).sort();
var appJs=LIBS.map(function(f){return rd('lib/'+f)}).join('\n;\n')+'\n;\n(function(){\n\'use strict\';\n'+appFiles.map(function(f){return rd('app/'+f)}).join('\n')+'\n})();\n';
if(/<\/script/i.test(appJs))die('app.js contains </script');

var theme=rd('theme.css').replace(/\{\{ACCENT\}\}/g,'#ffb000').replace(/\{\{RGB\}\}/g,'255,176,0');
var css=rd('style.css')+'\n'+theme+'\n'+rd('extra.css');
var vendor=fs.readFileSync(path.join(SRC,'vendor','supabase.js'));
var cfg='window.PM_CONFIG='+JSON.stringify({url:url,anonKey:key})+';\n';

function sha(b){return crypto.createHash('sha256').update(b).digest('hex').slice(0,10)}
var html=rd('index.html').replace('{{CSP}}',CSP.replace(/"/g,'&quot;'))
  .replace('href="style.css"','href="style.css?v='+sha(css)+'"')
  .replace('src="app.js"','src="app.js?v='+sha(appJs)+'"')
  .replace('src="config.js"','src="config.js?v='+sha(cfg)+'"')
  .replace('src="vendor/supabase.js"','src="vendor/supabase.js?v='+sha(vendor)+'"');
if(/\{\{[A-Z]+\}\}/.test(html))die('index.html still has an unfilled {{placeholder}}');

fs.rmSync(OUT,{recursive:true,force:true});
fs.mkdirSync(path.join(OUT,'vendor'),{recursive:true});
fs.writeFileSync(path.join(OUT,'index.html'),html);
fs.writeFileSync(path.join(OUT,'style.css'),css);
fs.writeFileSync(path.join(OUT,'app.js'),appJs);
fs.writeFileSync(path.join(OUT,'config.js'),cfg);
fs.writeFileSync(path.join(OUT,'vendor','supabase.js'),vendor);
console.log('built dist/ for '+origin+' ('+(appJs.length/1024).toFixed(0)+' KB app, '+(vendor.length/1024).toFixed(0)+' KB supabase-js)');
