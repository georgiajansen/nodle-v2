/* ---------- force layout ---------- */
var alpha=0,raf=null,dragNode=null,degMap={};
function linkLen(l){return THEME.spread*(l.a==='me'||l.b==='me'?230:170)-(l.strength-1)*14+(l.virtual?25:0)}
function step(){
  var P=visiblePeople(),n=P.length,i,j,a,b,dx,dy,d2,d,f;
  for(i=0;i<n;i++){a=P[i];for(j=i+1;j<n;j++){b=P[j];
    dx=a.x-b.x;dy=a.y-b.y;d2=dx*dx+dy*dy;
    if(d2<1){dx=Math.random()-.5;dy=Math.random()-.5;d2=1}
    d=Math.sqrt(d2);f=(70000*THEME.spread*THEME.spread/d2)*alpha;
    if(d<110*THEME.spread)f+=(110*THEME.spread-d)*0.12;
    dx/=d;dy/=d;
    a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;
  }}
  visibleLinks().forEach(function(l){
    a=person(l.a);b=person(l.b);if(!a||!b)return;
    dx=b.x-a.x;dy=b.y-a.y;d=Math.sqrt(dx*dx+dy*dy)||1;
    f=(d-linkLen(l))*(l.virtual?0.008:0.02)*alpha;dx/=d;dy/=d;
    a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;
  });
  for(i=0;i<n;i++){a=P[i];
    a.vx-=a.x*0.004*alpha;a.vy-=a.y*0.004*alpha;
    if(a.pinned||a===dragNode){a.vx=0;a.vy=0;if(a.isMe){a.x=0;a.y=0}continue}
    a.vx*=0.78;a.vy*=0.78;
    var sp=Math.sqrt(a.vx*a.vx+a.vy*a.vy);if(sp>60){a.vx*=60/sp;a.vy*=60/sp}
    a.x+=a.vx;a.y+=a.vy;
  }
}
function loop(){
  step();updatePositions();
  alpha*=0.985;
  if(alpha>0.03||dragNode){raf=requestAnimationFrame(loop)}else{raf=null;save()}
}
function reheat(a){alpha=Math.max(alpha,a===undefined?0.7:a);if(!raf)raf=requestAnimationFrame(loop)}
function settle(iters){alpha=1;for(var i=0;i<iters;i++){step();alpha*=0.994}alpha=0}

/* ---------- drawing the map ---------- */
var svg=$('#svg'),vp=$('#vp'),linkLayer=$('#links'),nodeLayer=$('#nodes');
var nodeEls={},linkEls={},linkMeta=[];
function computeDeg(){degMap={};visibleLinks().forEach(function(l){degMap[l.a]=(degMap[l.a]||0)+1;degMap[l.b]=(degMap[l.b]||0)+1})}
function radius(p){if(p.isMe)return 30*THEME.scale;return Math.min(26,16+(degMap[p.id]||0)*1.6)*THEME.scale}
function shapeEl(cls,r){
  var e;
  if(THEME.shape==='square'){e=s('rect',{x:-r,y:-r,width:2*r,height:2*r,rx:THEME.corner||0})}
  else e=s('circle',{r:r});
  e.setAttribute('class',cls);return e;
}
function daysToBday(p){return p.bday?PM.nextOccurrence(p.bday.m,p.bday.d,TN()).days:null}
function nodeTitle(p){
  var t=p.name,ds=daysSince(p),db=daysToBday(p);
  if(!p.isMe)t+='\nCharacter: '+ratingLabel(p.rating);
  if(!p.isMe&&riskVisible())t+='\nRisk: '+riskLevelInfo(p).label;
  if(p.group)t+='\nGroup: '+p.group;
  if(ds!==null)t+='\nLast talked: '+PM.ago(ds);
  if(db!==null)t+='\nBirthday in '+db+' day'+(db===1?'':'s');
  if(p.note)t+='\n'+p.note;
  if(p.offers.length)t+='\nOffers: '+p.offers.join(', ');
  if(p.needs.length)t+='\nNeeds: '+p.needs.join(', ');
  return t;
}
function renderGraph(){
  linkLayer.textContent='';nodeLayer.textContent='';nodeEls={};linkEls={};
  computeDeg();
  var vis=visibleLinks(),pairs={};
  vis.forEach(function(l){var k=[l.a,l.b].sort().join('|');(pairs[k]=pairs[k]||[]).push(l)});
  linkMeta=[];
  vis.forEach(function(l){
    var k=[l.a,l.b].sort().join('|'),arr=pairs[k],t=typeOf(l.type)||{color:'#888',name:'?'};
    var g=s('g',{'class':'link'});
    var lw=(1.5+l.strength*1.8)*THEME.lineScale;
    var line=s('path',{'class':'line',stroke:t.color,'stroke-width':lw});
    var halo=THEME.glow?s('path',{'class':'halo',stroke:t.color,'stroke-width':lw+8}):null;
    if(t.dotted){line.setAttribute('stroke-dasharray',(THEME.lineScale<0.7?'1 4':'0.1 7'));line.setAttribute('stroke-linecap',THEME.lineScale<0.7?'butt':'round')}
    else if(t.dashed)line.setAttribute('stroke-dasharray',THEME.lineScale<0.7?'5 4':'7 6');
    var hit=s('path',{'class':'hit','data-link':l.id});
    var title=s('title');title.textContent=plainName(person(l.a))+' ↔ '+plainName(person(l.b))+' · '+t.name+(l.note?' · '+l.note:'');
    if(halo)g.append(halo);
    g.append(line,hit,title);linkLayer.append(g);
    linkEls[l.id]={g:g,line:line,hit:hit,halo:halo};
    linkMeta.push({l:l,off:(arr.indexOf(l)-(arr.length-1)/2)*(THEME.terminal?22:34)});
  });
  visiblePeople().forEach(function(p,idx){
    var r=radius(p);
    var g=s('g',{'class':'node'+(p.isMe?' me':''),'data-id':p.id});
    var inner=s('g',{'class':'in'});
    if(THEME.drift&&!p.isMe){inner.style.animationDuration=(9+((idx*7)%9))+'s';inner.style.animationDelay=(-(idx*1.7)%9)+'s'}
    var ring=shapeEl('ring',r+5);
    var c=shapeEl('body',r);c.setAttribute('fill',ratingColor(p));
    var fd=fadeOf(p);if(fd<1)c.style.opacity=fd.toFixed(2);
    var txName=plainName(p);
    var tx=s('text',{y:r+(THEME.terminal?13:15),'class':'nm'});tx.textContent=trunc(txName,THEME.terminal?18:22);
    var tt=s('title');tt.textContent=nodeTitle(p);
    if(THEME.glow){inner.append(s('circle',{'class':'halo',r:r+16,fill:ratingColor(p),opacity:.10}),s('circle',{'class':'halo',r:r+8,fill:ratingColor(p),opacity:.22}))}
    inner.append(ring,c);
    if(riskVisible()&&!p.isMe){
      var rv=riskOfPerson(p),li=PR.LEVELS[rv.level];
      var rk=shapeEl('rk',r+4);rk.setAttribute('stroke',li.color);if(rv.level==='none')rk.setAttribute('stroke-dasharray','3 3');
      inner.append(rk);
      if(rv.level==='high'||rv.level==='critical'){
        var tri=s('polygon',{'class':'rwarn',points:(r-4)+','+(-r+1)+' '+(r+8)+','+(-r+1)+' '+(r+2)+','+(-r-9)});
        var tq=s('title');tq.textContent=li.label+' risk';tri.append(tq);inner.append(tri);
      }
      if(rv.overridden){var om=s('text',{'class':'ovm',x:r+3,y:r+9});om.textContent='OVR';inner.append(om)}
    }
    var db=daysToBday(p);
    if(THEME.drift&&!p.isMe){
      if(db!==null&&db<=7){var pl=shapeEl('pulse bday',r);inner.append(pl)}
      else if(isDrifting(p)){var pl2=shapeEl('pulse drift',r);inner.append(pl2)}
    }
    inner.append(tx,tt);
    if(p.group&&!p.isMe){var gt=s('text',{y:r+(THEME.terminal?24:28),'class':'grp'});gt.textContent=trunc(p.group,22);inner.append(gt)}
    if(p.isMe){var star=s('text',{y:THEME.terminal?4:6,'class':'glyph'});star.textContent=THEME.meGlyph;star.style.cssText='fill:#fff;stroke:none;font-size:'+(THEME.terminal?11:20)+'px';inner.append(star)}
    else if(THEME.codes){var cd=s('text',{y:3.5,'class':'code'});cd.textContent=p.code.replace(/^P/,'');cd.style.cssText='fill:'+THEME.initialColor+';stroke:none;font-size:'+Math.max(9,Math.round(10*THEME.scale+1))+'px';inner.append(cd)}
    else{var ini=s('text',{y:5});ini.textContent=(txName.charAt(0)||'?').toUpperCase();ini.style.cssText='fill:'+THEME.initialColor+';stroke:'+(THEME.initialStroke||'#0003')+';stroke-width:2.5px;font-size:'+Math.round(14*THEME.scale)+'px;font-weight:700';inner.append(ini)}
    if(THEME.badges&&!p.isMe){var bx=r*0.74,by=r*0.74,bc=s('circle',{'class':'badgebg',cx:bx,cy:by,r:11*THEME.scale}),bt=s('text',{'class':'badge',x:bx,y:by+5*THEME.scale});bt.textContent=THEME.badges[p.rating||0];bt.style.cssText='font-size:'+Math.round(13*THEME.scale)+'px;stroke:none;fill:#000';inner.append(bc,bt)}
    if(THEME.cake&&db!==null&&db<=7&&!p.isMe){var ck=s('text',{'class':'cake',x:-r*0.8,y:-r*0.5});ck.textContent=THEME.cake;inner.append(ck)}
    if(p.pinned&&!p.isMe){inner.append(s('circle',{'class':'pin',r:2.6,cx:r*0.72,cy:-r*0.72}))}
    g.append(inner);
    nodeLayer.append(g);nodeEls[p.id]=g;
  });
  applyFocus();updatePositions();renderLegend();
}
function updatePositions(){
  S.people.forEach(function(p){var e=nodeEls[p.id];if(e)e.setAttribute('transform','translate('+p.x.toFixed(1)+','+p.y.toFixed(1)+')')});
  linkMeta.forEach(function(m){
    var a=person(m.l.a),b=person(m.l.b),e=linkEls[m.l.id];if(!a||!b||!e)return;
    var d;
    if(Math.abs(m.off)<1)d='M'+a.x.toFixed(1)+' '+a.y.toFixed(1)+'L'+b.x.toFixed(1)+' '+b.y.toFixed(1);
    else{
      var dx=b.x-a.x,dy=b.y-a.y,len=Math.sqrt(dx*dx+dy*dy)||1,mx=(a.x+b.x)/2-dy/len*m.off,my=(a.y+b.y)/2+dx/len*m.off;
      d='M'+a.x.toFixed(1)+' '+a.y.toFixed(1)+'Q'+mx.toFixed(1)+' '+my.toFixed(1)+' '+b.x.toFixed(1)+' '+b.y.toFixed(1);
    }
    e.line.setAttribute('d',d);e.hit.setAttribute('d',d);if(e.halo)e.halo.setAttribute('d',d);
  });
}
function applyView(){
  var r=svg.getBoundingClientRect();
  vp.setAttribute('transform','translate('+(r.width/2+view.x)+','+(r.height/2+view.y)+') scale('+view.k+')');
}
function fitView(){
  var r=svg.getBoundingClientRect(),minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
  visiblePeople().forEach(function(p){minx=Math.min(minx,p.x-60);maxx=Math.max(maxx,p.x+60);miny=Math.min(miny,p.y-45);maxy=Math.max(maxy,p.y+55)});
  var w=maxx-minx,hh=maxy-miny;
  var lp=r.width>600?230:0;
  view.k=Math.max(0.25,Math.min(1.6,Math.min((r.width-lp)/w,r.height/hh)*0.95));
  view.x=-((minx+maxx)/2)*view.k+lp/2;view.y=-((miny+maxy)/2)*view.k;
  applyView();save();
}
function matchesQuery(p,q){
  var hay=[p.name,p.code,p.note,p.group,p.offers.join(' '),p.needs.join(' '),p.events.join(' '),p.likes,p.metHow].join(' ').toLowerCase();
  return hay.indexOf(q)>=0;
}
function applyFocus(){
  var q=query.trim().toLowerCase(),matchSet={},focusSet=null,linkKeep=null,pathLinks=null;
  S.people.forEach(function(p){var e=nodeEls[p.id];if(e)e.classList.remove('sel','match','dim','onpath')});
  Object.keys(linkEls).forEach(function(k){linkEls[k].g.classList.remove('dim','onpath')});
  if(q){
    S.people.forEach(function(p){if(matchesQuery(p,q))matchSet[p.id]=1});
    focusSet=matchSet;linkKeep=function(l){return matchSet[l.a]||matchSet[l.b]};
  }else if(tab==='events'&&eventSel.length){
    focusSet={};peopleWithTags(eventSel).forEach(function(p){focusSet[p.id]=1});
    linkKeep=function(l){return focusSet[l.a]&&focusSet[l.b]};
  }else if(tab==='path'&&pathRes){
    focusSet={me:1};pathLinks={};pathRes.steps.forEach(function(st){focusSet[st.to]=1;pathLinks[st.link.id]=1});
    linkKeep=function(l){return pathLinks[l.id]};
  }else if(sel&&sel.kind==='person'){
    focusSet={};focusSet[sel.id]=1;
    visibleLinks().forEach(function(l){if(l.a===sel.id)focusSet[l.b]=1;if(l.b===sel.id)focusSet[l.a]=1});
    linkKeep=function(l){return l.a===sel.id||l.b===sel.id};
  }else if(sel&&sel.kind==='link'){
    var l0=allLinks().filter(function(l){return l.id===sel.id})[0];
    if(l0){focusSet={};focusSet[l0.a]=1;focusSet[l0.b]=1;linkKeep=function(l){return l.id===l0.id}}
  }
  S.people.forEach(function(p){
    var e=nodeEls[p.id];if(!e)return;
    if(focusSet&&!focusSet[p.id])e.classList.add('dim');
    if(q&&matchSet[p.id])e.classList.add('match');
    if(sel&&sel.kind==='person'&&sel.id===p.id)e.classList.add('sel');
    if(pathLinks&&focusSet[p.id])e.classList.add('onpath');
  });
  visibleLinks().forEach(function(l){
    var e=linkEls[l.id];if(!e)return;
    if(linkKeep&&!linkKeep(l))e.g.classList.add('dim');
    if(pathLinks&&pathLinks[l.id])e.g.classList.add('onpath');
  });
  renderReadout();
}
var legendOpen=window.innerWidth>820;
function riskVisible(){return S.showRisk&&!S.hideSens}
function toggleRisk(){S.showRisk=!S.showRisk;save();renderGraph();renderPanel();renderStats()}
function toggleHide(){S.hideSens=!S.hideSens;save();renderGraph();renderPanel();renderStats();toast(S.hideSens?'Risk marks hidden (press H to show)':'Risk marks shown')}
function renderLegend(){
  var box=$('#legend');box.textContent='';
  box.append(h('h3',{style:'cursor:pointer',onclick:function(){legendOpen=!legendOpen;renderLegend()}},(legendOpen?'▾ ':'▸ ')+'Key'+(legendOpen?' (click to hide)':'')));
  if(!legendOpen)return;
  S.types.forEach(function(t){
    var n=allLinks().filter(function(l){return l.type===t.id}).length;
    var sw=h('span',{class:'sw',style:'border-color:'+t.color+(t.dashed?';border-top-style:dashed':'')+(t.dotted?';border-top-style:dotted':'')});
    box.append(h('div',{class:'chip'+(S.hidden[t.id]?' off':''),onclick:function(){S.hidden[t.id]=!S.hidden[t.id];save();renderGraph();reheat(.3);renderPanel()}},sw,t.name+(n?' ('+n+')':'')));
  });
  box.append(h('h3',{style:'margin-top:8px'},'Circle colour = character'));
  [5,4,3,2,1,0].forEach(function(r){
    var n=S.people.filter(function(p){return !p.isMe&&p.rating===r}).length;
    box.append(h('div',{class:'chip'+(S.hiddenRatings[r]?' off':''),onclick:function(){S.hiddenRatings[r]=!S.hiddenRatings[r];save();renderGraph();reheat(.4);renderPanel()}},
      h('span',{class:'dot',style:'background:'+RATING_COLORS[r]}),(r?r+' · ':'')+ratingLabel(r)+(n?' ('+n+')':'')));
  });
  if(S.showRisk&&!S.hideSens){
    box.append(h('h3',{style:'margin-top:8px'},'Risk ring'));
    ['critical','high','medium','low','none'].forEach(function(k){
      var li=PR.LEVELS[k],n=riskCount([k]);
      box.append(h('div',{class:'chip',style:'cursor:default'},h('span',{class:'rkdot'+(k==='none'?' dashed':''),style:'border-color:'+li.color}),li.label+(n?' ('+n+')':'')));
    });
    box.append(h('div',{class:'legnote'},'Ring = risk level · triangle = high / critical · fill = character'));
  }
  box.append(h('div',{class:'chip',id:'riskchip',style:'margin-top:6px',onclick:toggleRisk},h('span',{class:'dot',style:'border-radius:0;height:4px;background:var(--muted)'}),'Show risk: '+(S.showRisk?'ON':'OFF')+'  (R)'));
  legendExtras(box);
  box.append(h('div',{class:'legnote'},'Faded = not talked to for 3+ months'+(THEME.drift?' · pulse = birthday soon / drifting':'')));
}
function renderReadout(){
  var box=$('#readout');if(!box)return;
  box.textContent='';
  var p=sel&&sel.kind==='person'?person(sel.id):null;
  if(!p){box.classList.remove('on');return}
  box.classList.add('on');
  var ds=daysSince(p),db=daysToBday(p),fv=favoursOf(p.id),mb=p.metBy?person(p.metBy):null;
  function kv(k,v){return h('div',{class:'kv'},h('span',{},k),h('span',{class:'mono num'},v))}
  box.append(h('div',{class:'rt'},h('span',{},plainName(p)),h('span',{class:'mono'},p.code)));
  if(!p.isMe)box.append(kv('Character',p.rating?p.rating+' / 5':'—'));
  if(!p.isMe&&riskVisible()){var rv=riskOfPerson(p),li=PR.LEVELS[rv.level];box.append(h('div',{class:'kv',id:'ro-risk'},h('span',{},'Risk'),h('span',{},h('span',{class:'lv '+li.cls},li.tag),rv.overridden?h('span',{class:'ovmark',style:'margin-left:5px'},'OVR'):null)))}
  box.append(kv('Lines',String(linksOf(p.id).length)));
  if(!p.isMe){
    box.append(kv('Last talked',ds===null?'—':PM.agoShort(ds)));
    box.append(kv('Birthday',db===null?'—':(db===0?'TODAY':'in '+db+'d')));
    box.append(kv('Favours',fv.list.length?(fv.net>0?'owe '+fv.net:fv.net<0?'owed '+(-fv.net):'even'):'—'));
    box.append(kv('Met via',mb?plainName(mb):'—'));
    if(p.events.length)box.append(kv('Events',trunc(p.events.join(', '),22)));
  }
}

/* ---------- pointer interaction ---------- */
var ptrs={},gesture=null;
function toWorld(cx,cy){var r=svg.getBoundingClientRect();return {x:(cx-r.left-r.width/2-view.x)/view.k,y:(cy-r.top-r.height/2-view.y)/view.k}}
function zoomAt(cx,cy,factor){
  var r=svg.getBoundingClientRect(),w=toWorld(cx,cy),k=Math.max(0.15,Math.min(3.5,view.k*factor));
  view.k=k;view.x=cx-r.left-r.width/2-w.x*k;view.y=cy-r.top-r.height/2-w.y*k;applyView();save();
}
svg.addEventListener('wheel',function(e){e.preventDefault();zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*(e.ctrlKey?0.01:0.0015)))},{passive:false});
svg.addEventListener('pointerdown',function(e){
  svg.setPointerCapture(e.pointerId);
  ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
  var ids=Object.keys(ptrs);
  if(ids.length>=2){
    var a=ptrs[ids[0]],b=ptrs[ids[1]];
    if(gesture&&gesture.node){dragNode=null}
    gesture={mode:'pinch',d:Math.hypot(a.x-b.x,a.y-b.y),moved:true};return;
  }
  var nodeEl=e.target.closest&&e.target.closest('.node'),hitEl=e.target.closest&&e.target.closest('.hit');
  gesture={sx:e.clientX,sy:e.clientY,moved:false,vx:view.x,vy:view.y};
  if(nodeEl){
    var p=person(nodeEl.getAttribute('data-id'));gesture.mode='node';gesture.pid=p.id;
    if(!p.isMe){gesture.node=p;var w=toWorld(e.clientX,e.clientY);gesture.ox=p.x-w.x;gesture.oy=p.y-w.y}
  }else if(hitEl){gesture.mode='link';gesture.lid=hitEl.getAttribute('data-link')}
  else{gesture.mode='pan';svg.classList.add('panning')}
});
svg.addEventListener('pointermove',function(e){
  if(!ptrs[e.pointerId]||!gesture)return;
  ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
  if(gesture.mode==='pinch'){
    var ids=Object.keys(ptrs);if(ids.length<2)return;
    var a=ptrs[ids[0]],b=ptrs[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y);
    if(gesture.d>0)zoomAt((a.x+b.x)/2,(a.y+b.y)/2,d/gesture.d);
    gesture.d=d;return;
  }
  var dx=e.clientX-gesture.sx,dy=e.clientY-gesture.sy;
  if(!gesture.moved&&Math.hypot(dx,dy)>4)gesture.moved=true;
  if(!gesture.moved)return;
  if(gesture.mode==='pan'){view.x=gesture.vx+dx;view.y=gesture.vy+dy;applyView()}
  else if(gesture.mode==='node'&&gesture.node){
    var w=toWorld(e.clientX,e.clientY),p=gesture.node;
    p.x=w.x+gesture.ox;p.y=w.y+gesture.oy;p.pinned=true;dragNode=p;
    if(!raf)reheat(.4);else alpha=Math.max(alpha,.3);
    updatePositions();
  }
});
function endPtr(e){
  if(!ptrs[e.pointerId])return;
  delete ptrs[e.pointerId];
  svg.classList.remove('panning');
  var g=gesture;
  if(Object.keys(ptrs).length>0){return}
  gesture=null;
  if(!g)return;
  if(g.mode==='pinch'){save();return}
  if(g.mode==='node'){
    dragNode=null;
    if(!g.moved){select({kind:'person',id:g.pid})}
    else{renderGraph();save();renderPanel()}
  }else if(g.mode==='link'){if(!g.moved)select({kind:'link',id:g.lid})}
  else if(g.mode==='pan'){if(!g.moved)select(null);else save()}
}
svg.addEventListener('pointerup',endPtr);
svg.addEventListener('pointercancel',endPtr);
$('#zin').onclick=function(){var r=svg.getBoundingClientRect();zoomAt(r.left+r.width/2,r.top+r.height/2,1.25)};
$('#zout').onclick=function(){var r=svg.getBoundingClientRect();zoomAt(r.left+r.width/2,r.top+r.height/2,0.8)};
$('#zfit').onclick=fitView;
window.addEventListener('resize',applyView);

/* ---------- selection ---------- */
function select(x,noTab){
  var changed=!(sel&&x&&sel.kind===x.kind&&sel.id===x.id);
  sel=x;
  if(x&&(x.kind==='person'||x.kind==='link')&&!noTab)tab='people';
  if(x&&x.kind==='person'&&changed)ptab='basics';
  applyFocus();renderPanel();
}
