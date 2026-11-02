/* PMIntro: the opening animation (boot text -> glyphs fly out and become the dots of the map -> lines draw in).
   It draws a made-up decorative map only. It never touches your data and never talks to the network.
   Any key, a click, or the SKIP button ends it. If the device asks for reduced motion it is skipped. */
(function(root){
'use strict';
var NS='http://www.w3.org/2000/svg';
var cols=['#ffb000','#38bdf8','#a78bfa','#f472b6','#94a3b8'];
var ids=['A01','A02','B07','B11','C03','C14','D05','D09','E02','E08','F04','F12'];
var subs=['FAM','WORK','INV','FRIEND','WORK','FRIEND','INV','FAM','WORK','FRIEND','INV','WORK'];
var pos=[[250,90],[500,60],[760,95],[900,230],[880,410],[680,470],[440,460],[220,430],[100,300],[120,160],[340,200],[660,200]];
var P=[['ME',500,260,'YOU']];ids.forEach(function(d,i){P.push([d,pos[i][0],pos[i][1],subs[i]])});
var E=[];for(var i=1;i<P.length;i++)E.push([0,i,i%5]);
[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,1],[10,11],[10,1],[11,3],[12,2],[12,4]].forEach(function(e,k){E.push([e[0],e[1],(k+2)%5,1])});

function el(n,a,p){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e}
function ease(k){return 1-Math.pow(1-k,3)}

var inst=null;
function start(opts){
  opts=opts||{};
  stop();
  var reduced=opts.reduced!==undefined?opts.reduced:(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var rootEl=document.createElement('div');rootEl.id='intro';rootEl.setAttribute('aria-hidden','true');
  rootEl.innerHTML='<div class="ihdr"><b>NODLE</b><span class="isp"></span><span class="ilbl">CLOUD SYNC · E2E ENCRYPTED</span></div>'+
    '<div class="istage"><div class="imap"><div class="igrid"></div><svg viewBox="0 0 1000 520" preserveAspectRatio="xMidYMid meet"><g class="ilines"></g><g class="inodes"></g></svg></div>'+
    '<div class="iboot"></div><div class="ihy"></div></div><button type="button" class="iskip" aria-label="Skip the intro">SKIP ›</button>';
  document.body.appendChild(rootEl);
  var Q=function(s){return rootEl.querySelector(s)};
  var stage=Q('.istage'),map=Q('.imap'),svg=Q('svg'),grid=Q('.igrid'),bootEl=Q('.iboot'),hy=Q('.ihy');
  var LN=[],ND=[],tok=0,dead=false,finished=false,resolveDone;
  var done=new Promise(function(r){resolveDone=r});
  E.forEach(function(e){var a=P[e[0]],b=P[e[1]];
    var p=el('path',{d:'M'+a[1]+' '+a[2]+' L'+b[1]+' '+b[2],'class':'ilk',stroke:cols[e[2]],pathLength:1,'stroke-dasharray':e[3]?'0.02 0.012':'1','stroke-opacity':e[3]?.55:.8},Q('.ilines'));
    LN.push({el:p,dash:!e[3],a:e[0],b:e[1]})});
  P.forEach(function(p,i){var g=el('g',{'class':'ind'+(i?'':' me'),transform:'translate('+p[1]+' '+p[2]+')'},Q('.inodes'));var w=i?58:70;
    el('rect',{x:-w/2,y:-17,width:w,height:34},g);var t=el('text',{y:1},g);t.textContent=p[0];var s=el('text',{y:12,'class':'isub'},g);s.textContent=p[3];ND.push(g)});

  function sleep(ms){var t=tok;return new Promise(function(r,j){setTimeout(function(){t===tok?r():j('x')},ms)})}
  function frames(ms,fn){var t=tok;return new Promise(function(r,j){var s=performance.now();(function f(n){if(t!==tok){j('x');return}var k=Math.min(1,(n-s)/ms);fn(k);k<1?requestAnimationFrame(f):r()})(s)})}

  function showFinal(){
    map.style.opacity=1;grid.style.opacity='';
    bootEl.style.display='none';hy.style.display='none';hy.innerHTML='';bootEl.style.visibility='';
    ND.forEach(function(g,i){g.style.opacity=1;g.setAttribute('transform','translate('+P[i][1]+' '+P[i][2]+')')});
    LN.forEach(function(l){l.el.style.strokeDashoffset=0;l.el.style.opacity='';l.el.style.strokeDasharray=l.dash?'1':'0.02 0.012'});
  }
  function finish(){
    if(finished)return;finished=true;tok++;showFinal();
    rootEl.setAttribute('data-state','done');
    var sk=Q('.iskip');if(sk)sk.style.display='none';
    removeEvents();resolveDone();
  }
  function skip(){finish()}
  function onKey(e){if(e.metaKey||e.ctrlKey||e.altKey)return;skip()}
  function removeEvents(){document.removeEventListener('keydown',onKey,true);rootEl.removeEventListener('click',skip)}
  document.addEventListener('keydown',onKey,true);
  rootEl.addEventListener('click',skip);
  Q('.iskip').addEventListener('click',function(e){e.stopPropagation();skip()});

  async function hybrid(){
    var b=bootEl,H=hy;H.style.display='block';b.style.display='block';b.innerHTML='';b.style.background='#050505';
    map.style.opacity=1;grid.style.opacity=0;
    ND.forEach(function(g){g.style.opacity=0});LN.forEach(function(l){l.el.style.strokeDashoffset=1;l.el.style.strokeDasharray='1';l.el.style.opacity=1});
    var t0=performance.now();function ts(){var s=(performance.now()-t0)/1000;return '['+('00'+s.toFixed(3)).slice(-6)+']'}
    var d0=document.createElement('div');d0.className='ln';
    d0.innerHTML='<span class="ts">'+ts()+'</span>  <span class="t">NODLE</span>  <span class="ts">· CLOUD · ENCRYPTED</span>';b.appendChild(d0);await sleep(90);
    var L=['SYNCING SECURE VAULT','AES-256-GCM · KEY STAYS HERE','DRAWING THE MAP'];
    for(var i=0;i<L.length;i++){
      var d=document.createElement('div');d.className='ln';b.appendChild(d);
      var pre='<span class="ts">'+ts()+'</span>  ',txt=L[i];
      await frames(130,function(k){d.innerHTML=pre+txt.slice(0,Math.ceil(txt.length*k))+'<span class="icur"></span>'});
      d.innerHTML=pre+txt+' <span class="ts">'+'.'.repeat(Math.max(3,32-txt.length))+'</span> <span class="ok">OK</span>';
      await sleep(70);
    }
    await sleep(100);
    var cu=Q('.icur');if(cu)cu.remove();
    var sr=stage.getBoundingClientRect(),chars=[];
    var wk=document.createTreeWalker(b,NodeFilter.SHOW_TEXT),nd,bfont=getComputedStyle(b).fontFamily;
    while((nd=wk.nextNode())){var t=nd.nodeValue,cs=getComputedStyle(nd.parentNode).color;
      for(var c=0;c<t.length;c++){if(/\s/.test(t[c]))continue;var r=document.createRange();r.setStart(nd,c);r.setEnd(nd,c+1);var q=r.getBoundingClientRect();
        var e=document.createElement('div');e.textContent=t[c];
        e.style.cssText='position:absolute;left:'+(q.left-sr.left)+'px;top:'+(q.top-sr.top)+'px;font:13px/'+q.height+'px '+bfont+';color:'+cs+';white-space:pre;will-change:transform,opacity';
        H.appendChild(e);chars.push({e:e,x:q.left-sr.left+q.width/2,y:q.top-sr.top+q.height/2,c:t[c],keep:false})}}
    var cand=chars.filter(function(o){return /[A-Z0-9]/.test(o.c)});
    var m=ND.length,pick=[];for(var j=0;j<m;j++){var o=cand[Math.floor((j+.5)*cand.length/m)];o.keep=true;pick.push(o)}
    var ctm=svg.getScreenCTM();
    var tg=P.map(function(p){var pt=svg.createSVGPoint();pt.x=p[1];pt.y=p[2];var r=pt.matrixTransform(ctm);return [r.x-sr.left,r.y-sr.top]});
    var dots=pick.map(function(o){o.e.style.visibility='hidden';var d=document.createElement('div');d.className='idot';H.appendChild(d);return d});
    b.style.visibility='hidden';b.style.background='transparent';
    chars.forEach(function(o){o.vx=(Math.random()-.5)*160;o.vy=-20-Math.random()*90;o.d=Math.random()*90});
    var FLY=620,STG=18,NFD=260,LD=380;
    var nodeAt=function(i){return i*STG+FLY};
    var lineAt=function(l){return Math.max(nodeAt(l.a),nodeAt(l.b))+NFD};
    var T=0;LN.forEach(function(l){T=Math.max(T,lineAt(l)+LD)});
    var s0=performance.now(),tk=tok;
    await new Promise(function(res,rej){(function f(now){if(tk!==tok){rej('x');return}var t=now-s0;
      chars.forEach(function(o){if(o.keep)return;var k=Math.min(1,Math.max(0,(t-o.d)/520)),e=ease(k);o.e.style.transform='translate('+o.vx*e+'px,'+o.vy*e+'px) scale('+(1-.7*e)+')';o.e.style.opacity=1-k;if(k>0)o.e.style.color='#ffb000'});
      dots.forEach(function(d,j){var k=Math.min(1,Math.max(0,(t-j*STG)/FLY)),e=ease(k),o=pick[j],X=o.x+(tg[j][0]-o.x)*e,Y=o.y+(tg[j][1]-o.y)*e;
        var dx=tg[j][0]-o.x,dy=tg[j][1]-o.y,Ln=Math.hypot(dx,dy)||1,arc=Math.sin(Math.PI*k)*Math.min(40,Ln*.12);X+=-dy/Ln*arc;Y+=dx/Ln*arc;
        var f2=Math.min(1,Math.max(0,(t-nodeAt(j))/NFD));
        d.style.transform='translate('+X+'px,'+Y+'px)';d.style.opacity=1-f2;
        ND[j].style.opacity=ease(f2)});
      LN.forEach(function(l){var p=Math.min(1,Math.max(0,(t-lineAt(l))/LD));l.el.style.strokeDashoffset=1-ease(p)});
      grid.style.opacity=.15*Math.min(1,t/400);
      t<T?requestAnimationFrame(f):res()})(s0)});
    b.style.visibility='';hy.innerHTML='';
  }

  if(reduced){finish()}
  else{
    showFinal();
    hybrid().then(function(){return sleep(650)}).then(function(){finish()},function(x){if(x!=='x')console.error(x)});
  }
  inst={root:rootEl,done:done,stop:function(){dead=true;tok++;removeEvents();if(rootEl.parentNode)rootEl.parentNode.removeChild(rootEl)}};
  return inst;
}
function stop(){if(inst){inst.stop();inst=null}}
var api={start:start,stop:stop,current:function(){return inst}};
root.PMIntro=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
