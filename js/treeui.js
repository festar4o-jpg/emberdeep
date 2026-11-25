// Passive tree screen (v1.0.105): the 🌳 button. A canvas with the whole tree: drag to move, pinch (or the mouse
// wheel) to zoom, tap a node to see it in the box at the bottom, then Take it there (choice nodes: tap one of the
// three bonuses). Tapping a selected node that can be taken takes it. Drawn only when something changes.
// Rules and data: passives.js. treeTapAt(x, y) is the tap (screen pixels), also used by the tests.
const TV={x:0,y:0,z:0.5,sel:null,ptrs:new Map(),moved:0,pinch:null,dirty:true,raf:0,w:0,h:0,dpr:1};
const TREE_COL={lifepct:'#e0505a',armpct:'#b0a090',block:'#c8b088',bleed:'#c02838',aspd:'#e8c060',cspd:'#8fb8ff',critd:'#ff8a3a',crit:'#ffd060',loh:'#e04070',
  spell:'#6a8aff',igniteCh:'#ff6a20',shockCh:'#a0d0ff',poisonCh:'#8fd040',res:'#5a9aff',cdr:'#a8e0c0',move:'#9fe0a0',ares:'#d0a0ff',evade:'#80d0c0',
  regen:'#ff9aa0',potheal:'#ff6080',rarity:'#ffd36b',gold:'#e8c040',dmg:'#ff6a5a',dr:'#a89878',lpk:'#e06080'};
const treeOpen=()=>!$('treeOv').classList.contains('hidden');
function treeDot(){const c=G.char;$('treeDot').classList.toggle('hidden',!c||!pasFree(c));
  if(c&&G.p&&pasFree(c)&&typeof hint==='function')hint('tree','Passive points','You have passive points to spend. Tap 🌳: tap a node next to your start, then Take. Diamonds let you pick a bonus; the four big nodes at the edge are keystones.');} // hints.js
function toggleTree(){if(!G.char)return;const o=$('treeOv');o.classList.toggle('hidden');
  if(treeOpen()){TV.sel=null;treeSize();const s=PAS_NODES[pasStart(G.char)],z=Math.min(TV.w,TV.h)/900;TV.z=z;TV.x=s.x*0.6;TV.y=s.y*0.6;treeInfo();treeDraw();}
  setPause();treeDot();}
function treeFit(){TV.z=Math.min(TV.w,TV.h)/2150;TV.x=TV.y=0;treeDraw();}
function treeSize(){const cv=$('treeCv'),r=cv.getBoundingClientRect();TV.w=+r.width>0?+r.width:window.innerWidth;TV.h=+r.height>0?+r.height:window.innerHeight;
  TV.dpr=Math.min(2,window.devicePixelRatio||1);cv.width=Math.round(TV.w*TV.dpr);cv.height=Math.round(TV.h*TV.dpr);TV.dirty=true;}
const toScr=(x,y)=>[(x-TV.x)*TV.z+TV.w/2,(y-TV.y)*TV.z+TV.h/2];
const toTree=(sx,sy)=>[(sx-TV.w/2)/TV.z+TV.x,(sy-TV.h/2)/TV.z+TV.y];
const nodeR=N=>({start:18,small:8,choice:10,notable:15,key:20})[N.t];
function treeDraw(){if(!TV.raf)TV.raf=requestAnimationFrame(()=>{TV.raf=0;treePaint();});}
function treePaint(){if(!treeOpen()||!G.char)return;const c=G.char,cv=$('treeCv'),x=cv.getContext('2d');if(!x)return;
  x.setTransform(TV.dpr,0,0,TV.dpr,0,0);x.fillStyle='#0b0806';x.fillRect(0,0,TV.w,TV.h);
  const pad=40,vis=N=>{const [sx,sy]=toScr(N.x,N.y);return sx>-pad&&sy>-pad&&sx<TV.w+pad&&sy<TV.h+pad;};
  x.lineCap='round';
  for(const [a,b] of PAS_EDGES){const A=PAS_NODES[a],B=PAS_NODES[b];if(!vis(A)&&!vis(B))continue;const ha=pasHas(c,a),hb=pasHas(c,b);
    x.strokeStyle=ha&&hb?'#e8b44a':ha||hb?'#7a5e30':'#3a3026';x.lineWidth=Math.max(1,(ha&&hb?4:2.5)*TV.z);
    const [x0,y0]=toScr(A.x,A.y),[x1,y1]=toScr(B.x,B.y);x.beginPath();x.moveTo(x0,y0);x.lineTo(x1,y1);x.stroke();}
  const names=TV.z>0.55;x.textAlign='center';x.textBaseline='middle';
  for(const id in PAS_NODES){const N=PAS_NODES[id];if(!vis(N))continue;const [sx,sy]=toScr(N.x,N.y),r=Math.max(3,nodeR(N)*TV.z),has=pasHas(c,id),can=!has&&pasNext(c,id)&&!N.soon;
    x.beginPath();if(N.t==='choice'){x.moveTo(sx,sy-r*1.2);x.lineTo(sx+r*1.2,sy);x.lineTo(sx,sy+r*1.2);x.lineTo(sx-r*1.2,sy);x.closePath();}else x.arc(sx,sy,r,0,TAU);
    x.fillStyle=has?'#d9a441':can?'#3a2a14':'#17110c';x.fill();
    x.lineWidth=Math.max(1,(N.t==='key'||N.t==='notable'?3:2)*TV.z);x.strokeStyle=has?'#ffe3a0':can?'#d9a441':N.t==='key'?'#7a3a5a':'#4a3a2a';x.stroke();
    const st=N.st&&N.st[0];if(st&&!has&&N.t!=='start'){x.beginPath();x.arc(sx,sy,r*0.45,0,TAU);x.fillStyle=TREE_COL[pasKey(st[0],c.cls)]||'#9c8b72';x.fill();}
    if(N.t==='start'){x.fillStyle=has?'#2a1a08':'#9c8b72';x.font=`${Math.round(r*1.1)}px serif`;x.fillText(N.cls==='warden'?'⚔':'✦',sx,sy+1);}
    if(TV.sel===id){x.beginPath();x.arc(sx,sy,r+5,0,TAU);x.strokeStyle='#fff';x.lineWidth=2;x.stroke();}
    if(names&&(N.t==='notable'||N.t==='key'||N.t==='start')){x.font=`${Math.round(Math.max(10,12*TV.z))}px Georgia,serif`;x.fillStyle=N.t==='key'?'#e0a0c0':has?'#ffe3a0':'#c8b088';
      x.fillText(N.name,sx,sy+r+Math.max(9,11*TV.z));}}
  $('treePts').textContent=`${pasFree(c)} point${pasFree(c)===1?'':'s'} to spend · ${pasSpent(c)} taken`;}
// The box at the bottom: what the selected node gives and whether you can take it.
function treeInfo(){const box=$('treeInfo'),c=G.char,id=TV.sel,N=id&&PAS_NODES[id];if(!N){box.classList.add('hidden');return;}
  const why=pasWhyNot(c,id),has=pasHas(c,id),own=id===pasStart(c),kind={start:'Start',small:'Passive',choice:'Choice',notable:'Notable',key:'Keystone'}[N.t];
  let h=`<div class="trn">${esc(N.name||(N.opts?'Choose one':pasStatText(N.st[0],c.cls)))} <span class="fdim">${kind}</span></div>`;
  if(own)h+='<div class="fdim">Your starting point</div>';
  else if(N.t==='key')h+=`<div>${esc(N.desc)}</div>`;
  else if(N.opts)h+=N.opts.map((o,i)=>{const on=has&&(c.pas.ch[id]|0)===i;return `<div class="btn trop${on?' on':''}${!has&&!why?'':' off'}" data-o="${i}"><b>${o.name}</b> ${esc(o.st.map(s=>pasStatText(s,c.cls)).join(', '))}</div>`;}).join('');
  else h+=(N.st||[]).map(s=>`<div>${esc(pasStatText(s,c.cls))}</div>`).join('');
  if(!own&&has){const no=pasRefundWhyNot(c,id);h+=`<div class="trok">✓ Taken</div>`+(no?`<div class="fdim">Take back: ${esc(no)}</div>`:`<div class="btn" id="treeBack">Take back (${pasRefundCost(c)} gold, you have ${c.gold||0})</div>`);}
  else if(!own)h+=has?'':why?`<div class="fdim">${esc(why)}</div>`:N.opts?'<div class="fdim">Tap a bonus to take it (1 point)</div>':'<div class="btn" id="treeTake">Take (1 point)</div>';
  box.innerHTML=h;box.classList.remove('hidden');
  const tk=$('treeTake');if(tk)tk.onclick=()=>treeTakeSel();const bk=$('treeBack');if(bk)bk.onclick=()=>treeBackSel();
  box.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>treeTakeSel(+b.dataset.o));}
function treeBackSel(){const c=G.char,id=TV.sel;if(!id||!pasRefund(c,id))return false;playSfx('gold');treeInfo();treeDraw();treeDot();return true;}
function treeTakeSel(opt){const c=G.char,id=TV.sel;if(!id||!pasTake(c,id,opt))return false;playSfx('levelup');treeInfo();treeDraw();treeDot();return true;}
// A tap at screen pixels: select the nearest node in reach; tapping the selected node again takes it (not choice nodes).
function treeTapAt(sx,sy){let best=null,bd=1e9;for(const id in PAS_NODES){const N=PAS_NODES[id],[x,y]=toScr(N.x,N.y),d=Math.hypot(x-sx,y-sy);
    if(d<Math.max(16,nodeR(N)*TV.z+10)&&d<bd){bd=d;best=id;}}
  if(best&&best===TV.sel&&!PAS_NODES[best].opts&&!pasWhyNot(G.char,best))treeTakeSel();else{TV.sel=best;treeInfo();}treeDraw();return best;}
function treeZoom(f,sx,sy){const [tx,ty]=toTree(sx,sy),z=Math.max(0.15,Math.min(2.5,TV.z*f));TV.z=z;TV.x=tx-(sx-TV.w/2)/z;TV.y=ty-(sy-TV.h/2)/z;
  TV.x=Math.max(-1100,Math.min(1100,TV.x));TV.y=Math.max(-1100,Math.min(1100,TV.y));treeDraw();}
// ---------- touch and mouse ----------
{const cv=$('treeCv'),pos=e=>{const r=cv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);TV.ptrs.set(e.pointerId,pos(e));if(TV.ptrs.size===1)TV.moved=0;
    if(TV.ptrs.size===2){const [a,b]=[...TV.ptrs.values()];TV.pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),z:TV.z};TV.moved=99;}});
  cv.addEventListener('pointermove',e=>{const p=TV.ptrs.get(e.pointerId);if(!p)return;const q=pos(e);
    if(TV.ptrs.size===1){TV.moved+=Math.abs(q[0]-p[0])+Math.abs(q[1]-p[1]);if(TV.moved>8){TV.x-=(q[0]-p[0])/TV.z;TV.y-=(q[1]-p[1])/TV.z;
      TV.x=Math.max(-1100,Math.min(1100,TV.x));TV.y=Math.max(-1100,Math.min(1100,TV.y));treeDraw();}}
    TV.ptrs.set(e.pointerId,q);
    if(TV.ptrs.size===2&&TV.pinch){const [a,b]=[...TV.ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);treeZoom(TV.pinch.z*d/Math.max(1,TV.pinch.d)/TV.z,(a[0]+b[0])/2,(a[1]+b[1])/2);}});
  const up=e=>{const p=TV.ptrs.get(e.pointerId);if(!p)return;TV.ptrs.delete(e.pointerId);if(TV.ptrs.size<2)TV.pinch=null;
    if(!TV.ptrs.size&&TV.moved<=8&&e.type==='pointerup')treeTapAt(p[0],p[1]);};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{e.preventDefault();const [sx,sy]=pos(e);treeZoom(e.deltaY<0?1.15:1/1.15,sx,sy);},{passive:false});}
tap('treeBtn',toggleTree);tap('treeClose',toggleTree);tap('treeFitBtn',treeFit);
window.addEventListener('resize',()=>{if(treeOpen()){treeSize();treeDraw();}});
