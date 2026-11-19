'use strict';
// Acts and maps: act definitions, tile queries, per-act map generation, map pre-rendering, flow field.
// ---------- acts: 5 acts × 5 depths; depth 5 of each act is the boss. Depth 26+ repeats the acts as higher cycles. ----------
const ACTS=[
  {name:'Sunken Crypts',sub:'Where the drowned dead keep their vigil',gen:'crypt',col:'#9ab0d8',boss:'Varrok the Hollow',bossCol:'#4a5a7a',mm:'#8a7f70',
   light:{r0:150,r1:470,tint:'rgba(90,120,200,0.05)',dark:'rgba(2,3,8,0.9)'},
   roster:[['grunt',5],['archer',3],['brute',2,2]]},
  {name:'Ashen Wastes',sub:'A desert of cinders beneath a dead sun',gen:'desert',col:'#e0a860',boss:'The Ash Tyrant',bossCol:'#8a4a1a',mm:'#b0905a',
   light:{r0:230,r1:640,tint:'rgba(255,170,90,0.07)',dark:'rgba(28,12,2,0.62)'},
   roster:[['scarab',4],['dustmage',2],['sandworm',1.6]]},
  {name:'Rotwood Marsh',sub:'The ground drinks, and the water bites',gen:'marsh',col:'#9fd060',boss:'Mother of Rot',bossCol:'#4a6a1f',mm:'#6f8a4a',
   light:{r0:150,r1:450,tint:'rgba(140,220,90,0.06)',dark:'rgba(2,10,4,0.9)'},
   roster:[['sporetoad',4],['vinelasher',2.4],['marshtroll',1.8]]},
  {name:'Frozen Citadel',sub:'Halls of ice above an endless fall',gen:'citadel',col:'#bfe4ff',boss:'Rimeheart, the Frozen King',bossCol:'#3a6a9a',mm:'#9ab8d0',
   light:{r0:180,r1:540,tint:'rgba(150,200,255,0.07)',dark:'rgba(3,8,20,0.86)'},
   roster:[['frostwraith',3],['icegolem',1.4],['shardling',3.4]]},
  {name:'The Ember Core',sub:'The heart of the deep still burns',gen:'ember',col:'#ff7a3a',boss:'The Cinder King',bossCol:'#9a1f0a',mm:'#a0604a',
   light:{r0:170,r1:520,tint:'rgba(255,90,30,0.08)',dark:'rgba(22,3,0,0.86)'},
   roster:[['imp',4],['magmabrute',2],['summoner',1.4]]}
];
const actIdx=d=>Math.floor((d-1)/5)%5,cycleOf=d=>Math.floor((d-1)/25)+1,stageOf=d=>(d-1)%5+1;
const roman=n=>['I','II','III','IV','V','VI','VII','VIII','IX','X'][n-1]||String(n);
const depthLabel=d=>d>25?`Endless ${d-25}`:`${actIdx(d)+1}-${stageOf(d)}`;
// grid: 0 floor, 1 wall, 2 void (chasm / lava lake: blocks walking, not projectiles). terrain: 1 poison, 2 lava, 3 bridge.
const T_POISON=1,T_LAVA=2,T_BRIDGE=3;
// ---------- level generation ----------
function solid(tx,ty){if(tx<0||ty<0||tx>=MW||ty>=MH)return true;return G.grid[ty*MW+tx]!==0;}
function wallAt(tx,ty){if(tx<0||ty<0||tx>=MW||ty>=MH)return true;return G.grid[ty*MW+tx]===1;} // projectiles fly over chasms and lava
const tileIdx=(x,y)=>Math.floor(y/TILE)*MW+Math.floor(x/TILE);
// ---------- map generation (one style per act) ----------
function newGrid(fill){const g=new Uint8Array(MW*MH).fill(fill);G.grid=g;G.terrain=new Uint8Array(MW*MH);return g;}
const inner=(i,j)=>i>0&&j>0&&i<MW-1&&j<MH-1;
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
// Irregular disc of tiles around (cx,cy).
function blob(cx,cy,r,fn){for(let j=Math.floor(cy-r);j<=Math.ceil(cy+r);j++)for(let i=Math.floor(cx-r);i<=Math.ceil(cx+r);i++){if(!inner(i,j))continue;const dx=i-cx,dy=j-cy;if(dx*dx+dy*dy<=r*r*rand(0.7,1.15))fn(j*MW+i,i,j);}}
// Keep only the largest connected floor region; cut-off pockets become wall. Returns the floor tile count.
function keepConnected(){const g=G.grid,lab=new Int32Array(MW*MH).fill(-1);let best=-1,bestN=0,id=0;const q=new Int32Array(MW*MH);
  for(let s=0;s<MW*MH;s++){if(g[s]!==0||lab[s]!==-1)continue;let h=0,t=0;q[t++]=s;lab[s]=id;
    while(h<t){const c=q[h++],cx=c%MW,cy=(c/MW)|0;for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+a,ny=cy+b;if(nx<0||ny<0||nx>=MW||ny>=MH)continue;const k=ny*MW+nx;if(g[k]!==0||lab[k]!==-1)continue;lab[k]=id;q[t++]=k;}}
    if(t>bestN){bestN=t;best=id;}id++;}
  for(let k=0;k<MW*MH;k++)if(g[k]===0&&lab[k]!==best){g[k]=1;G.terrain[k]=0;}
  return bestN;}
// Spawn/encounter areas for open maps: well-spaced spots with a clear 3×3 of safe floor.
function pickRegions(n,minD){const g=G.grid,T=G.terrain,c=[];
  for(let j=3;j<MH-3;j++)for(let i=3;i<MW-3;i++){let ok=true;for(let b=-1;b<=1&&ok;b++)for(let a=-1;a<=1;a++){const k=(j+b)*MW+i+a;if(g[k]!==0||T[k]!==0){ok=false;break;}}if(ok)c.push(i,j);}
  const idx=shuffle([...Array(c.length/2).keys()]),out=[];
  for(const q of idx){const i=c[q*2],j=c[q*2+1];if(out.some(r=>Math.abs(r.cx-i)+Math.abs(r.cy-j)<minD))continue;out.push({x:i-3,y:j-3,w:7,h:7,cx:i,cy:j});if(out.length>=n)break;}
  return out;}
// Cellular-automaton caves.
function cave(fill,iters){const g=newGrid(1);for(let j=1;j<MH-1;j++)for(let i=1;i<MW-1;i++)g[j*MW+i]=Math.random()<fill?1:0;
  const tmp=new Uint8Array(MW*MH);
  for(let it=0;it<iters;it++){tmp.fill(1);for(let j=1;j<MH-1;j++)for(let i=1;i<MW-1;i++){let n=0;for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++)n+=g[(j+b)*MW+i+a];tmp[j*MW+i]=n>=5?1:0;}g.set(tmp);}
  return g;}
const GEN={
  // Act 1: rectangular crypt rooms joined by corridors, pillars in some rooms.
  crypt(depth){const g=newGrid(1);
    const carve=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(inner(i,j))g[j*MW+i]=0;};
    const rooms=[];let tries=0;const target=9+Math.min(4,Math.floor(stageOf(depth)/2)+1);
    while(rooms.length<target&&tries<800){tries++;const w=randi(7,13),h=randi(7,11),x=randi(2,MW-w-3),y=randi(2,MH-h-3);
      if(rooms.some(r=>x<r.x+r.w+3&&x+w+3>r.x&&y<r.y+r.h+3&&y+h+3>r.y))continue;
      rooms.push({x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)});}
    rooms.forEach(r=>carve(r.x,r.y,r.w,r.h));
    const corr=(a,b)=>{const x0=Math.min(a.cx,b.cx),x1=Math.max(a.cx,b.cx);carve(x0-1,a.cy-1,x1-x0+3,3);const y0=Math.min(a.cy,b.cy),y1=Math.max(a.cy,b.cy);carve(b.cx-1,y0-1,3,y1-y0+3);};
    for(let i=1;i<rooms.length;i++){let best=0,bd=1e9;for(let j=0;j<i;j++){const d=Math.abs(rooms[i].cx-rooms[j].cx)+Math.abs(rooms[i].cy-rooms[j].cy);if(d<bd){bd=d;best=j;}}corr(rooms[i],rooms[best]);}
    if(rooms.length>4)corr(rooms[rooms.length-1],rooms[1]);
    rooms.forEach((r,i)=>{if(i>0&&r.w>=9&&r.h>=9&&Math.random()<0.45)[[r.x+2,r.y+2],[r.x+r.w-3,r.y+2],[r.x+2,r.y+r.h-3],[r.x+r.w-3,r.y+r.h-3]].forEach(([a,b])=>g[b*MW+a]=1);});
    return rooms;},
  // Act 2: open desert with a ragged edge, scattered rocks and ruined pillar rows.
  desert(){const g=newGrid(1);
    for(let j=2;j<MH-2;j++)for(let i=2;i<MW-2;i++)g[j*MW+i]=0;
    for(let k=0;k<44;k++){const side=k%4,t=rand(2,MW-3);const [x,y]=side===0?[t,2]:side===1?[t,MH-3]:side===2?[2,t]:[MW-3,t];blob(x,y,rand(1.5,4.5),q=>g[q]=1);}
    for(let k=0;k<50;k++){const x=rand(6,MW-7),y=rand(6,MH-7);
      if(Math.random()<0.25){const L=randi(3,7),hz=Math.random()<0.5;for(let s=0;s<L;s+=2){const i=Math.round(x+(hz?s:0)),j=Math.round(y+(hz?0:s));if(inner(i,j))g[j*MW+i]=1;}}
      else blob(x,y,rand(0.6,2.3),q=>g[q]=1);}
    keepConnected();return pickRegions(12,11);},
  // Act 3: organic caves with slowing poison pools.
  marsh(){let n=0;for(let t=0;t<6&&n<1300;t++){cave(0.47,5);n=keepConnected();}
    const g=G.grid,T=G.terrain;
    for(let k=0;k<14;k++){const x=rand(4,MW-5),y=rand(4,MH-5);if(g[Math.round(y)*MW+Math.round(x)]!==0)continue;blob(x,y,rand(1.6,3.2),q=>{if(g[q]===0)T[q]=T_POISON;});}
    return pickRegions(12,10);},
  // Act 4: big halls floating over a chasm, joined by narrow bridges.
  citadel(){const g=newGrid(2);
    for(let i=0;i<MW;i++){g[i]=1;g[(MH-1)*MW+i]=1;}for(let j=0;j<MH;j++){g[j*MW]=1;g[j*MW+MW-1]=1;}
    const C=3,cs=Math.floor((MW-2)/C),halls=[];
    for(let gy=0;gy<C;gy++)for(let gx=0;gx<C;gx++){const w=randi(11,15),h=randi(10,14),mx=1+gx*cs+(cs>>1),my=1+gy*cs+(cs>>1);
      const x=mx-(w>>1)+randi(-1,1),y=my-(h>>1)+randi(-1,1);halls.push({x,y,w,h,cx:mx,cy:my,gx,gy});
      for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(inner(i,j))g[j*MW+i]=0;
      if(w>=12&&h>=11&&Math.random()<0.75)for(const [a,b] of [[x+3,y+3],[x+w-4,y+3],[x+3,y+h-4],[x+w-4,y+h-4]])g[b*MW+a]=1;}
    const link=(a,b)=>{const hz=a.gy===b.gy;const n0=hz?a.cx:a.cy,n1=hz?b.cx:b.cy;
      for(let s=n0;s<=n1;s++)for(const o of [0,1]){const i=hz?s:a.cx+o,j=hz?a.cy+o:s,k=j*MW+i;if(g[k]===2)G.terrain[k]=T_BRIDGE;g[k]=0;}};
    const par=[...Array(C*C).keys()],root=i=>par[i]===i?i:(par[i]=root(par[i]));const edges=[];
    for(let gy=0;gy<C;gy++)for(let gx=0;gx<C;gx++){const i=gy*C+gx;if(gx<C-1)edges.push([i,i+1]);if(gy<C-1)edges.push([i,i+C]);}
    for(const [i,j] of shuffle(edges)){const ri=root(i),rj=root(j);if(ri!==rj){par[ri]=rj;link(halls[i],halls[j]);}else if(Math.random()<0.3)link(halls[i],halls[j]);}
    keepConnected();return shuffle(halls);},
  // Act 5: lava caverns: wide caves, impassable lava lakes and walkable lava pools that burn.
  ember(){let n=0;for(let t=0;t<6&&n<1400;t++){cave(0.43,4);
      const g=G.grid;for(let k=0;k<7;k++){const x=rand(6,MW-7),y=rand(6,MH-7);blob(x,y,rand(2,3.6),q=>{if(g[q]===0)g[q]=2;});}
      n=keepConnected();}
    const g=G.grid,T=G.terrain;
    for(let k=0;k<11;k++){const x=rand(4,MW-5),y=rand(4,MH-5);if(g[Math.round(y)*MW+Math.round(x)]!==0)continue;blob(x,y,rand(1,2.2),q=>{if(g[q]===0)T[q]=T_LAVA;});}
    return pickRegions(12,10);}
};
function genLevel(depth){
  const A=ACTS[actIdx(depth)];let rooms=null;
  for(let t=0;t<5&&!(rooms&&rooms.length>=6);t++)rooms=GEN[A.gen](depth);
  if(!rooms||rooms.length<3){rooms=GEN.crypt(depth);} // safety net: never ship an unplayable map
  const g=G.grid;G.rooms=rooms;
  const start=rooms[0];let exit=rooms[1],ed=0;
  for(const r of rooms){const d=Math.hypot(r.cx-start.cx,r.cy-start.cy);if(d>ed){ed=d;exit=r;}}
  const isBoss=depth%5===0;
  G.portal={x:(exit.cx+0.5)*TILE,y:(exit.cy+0.5)*TILE,active:!isBoss};
  G.enemies=[];G.boss=null;let packId=0;
  const safe=(x,y,r)=>!blockedAt(x,y,r)&&G.terrain[tileIdx(x,y)]===0;
  const spot=r=>{for(let k=0;k<30;k++){const x=(r.x+rand(1,r.w-1))*TILE,y=(r.y+rand(1,r.h-1))*TILE;if(safe(x,y,26))return {x,y};}return {x:(r.cx+0.5)*TILE,y:(r.cy+0.5)*TILE};};
  for(const r of rooms){
    if(r===start)continue;
    if(isBoss&&r===exit){let bx=(r.cx+0.5)*TILE,by=(r.cy-1)*TILE;if(blockedAt(bx,by,40))by=(r.cy+0.5)*TILE;const b=makeEnemy('boss',bx,by,depth,false,++packId);G.enemies.push(b);G.boss=b;continue;}
    const packs=randi(1,2);
    for(let k=0;k<packs;k++){const id=++packId;const eliteP=Math.random()<Math.min(depth>25?0.45:0.3,0.1+depth*0.006),affs=eliteP?rollAffixes(depth):null;
      const c=spot(r);rollPack(depth,eliteP).forEach((type,m)=>{const T=ETYPES[type];
        let x=c.x+rand(-50,50),y=c.y+rand(-50,50);if(type==='vinelasher'){const q=spot(r);x=q.x;y=q.y;}
        if(!safe(x,y,T.r)){x=c.x;y=c.y;}
        G.enemies.push(makeEnemy(type,x,y,depth,eliteP&&m<4,id,affs));});}
  }
  placeEncounters(depth,rooms,start,exit,isBoss,spot);
  G.p.x=(start.cx+0.5)*TILE;G.p.y=(start.cy+0.5)*TILE;
  G.explored=new Uint8Array(MW*MH);
  G.flow=new Int16Array(MW*MH);G.flowTile=-1;
  renderMap();
}
function genTown(){
  const g=newGrid(1);
  const R={x:22,y:24,w:20,h:12};R.cx=R.x+10;R.cy=R.y+6;
  for(let j=R.y;j<R.y+R.h;j++)for(let i=R.x;i<R.x+R.w;i++)g[j*MW+i]=0;
  G.rooms=[R];G.enemies=[];G.boss=null;
  G.p.x=(R.x+2.5)*TILE;G.p.y=(R.cy+0.5)*TILE;
  G.portal={x:(R.x+R.w-2.5)*TILE,y:(R.cy+0.5)*TILE,active:true};
  G.merchant={x:R.cx*TILE,y:(R.y+3.5)*TILE};
  G.stash={x:(R.x+4)*TILE,y:(R.y+3.5)*TILE};
  G.smith={x:R.cx*TILE,y:(R.y+R.h-2.5)*TILE};
  G.explored=new Uint8Array(MW*MH).fill(1);
  G.flow=new Int16Array(MW*MH);G.flowTile=-1;
  renderMap();
}

// ---------- map rendering: pre-drawn once per level into one canvas (cheap per frame) ----------
const THEMES={};
{ // drawing helpers shared by themes
  const glow=(x,cx,cy,r,col)=>{const g=x.createRadialGradient(cx,cy,1,cx,cy,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(cx-r,cy-r,r*2,r*2);};
  const dot=(x,cx,cy,r,col)=>{x.fillStyle=col;x.beginPath();x.arc(cx,cy,r,0,TAU);x.fill();};
  const crack=(x,px,py,col,w)=>{x.strokeStyle=col;x.lineWidth=w||1;x.beginPath();x.moveTo(px+rand(4,36),py+rand(4,36));x.lineTo(px+rand(4,36),py+rand(4,36));x.lineTo(px+rand(4,36),py+rand(4,36));x.stroke();};
  const face=(x,px,py,c1,c2)=>{x.fillStyle=c1;x.fillRect(px,py+TILE-15,TILE,15);x.fillStyle=c2;x.fillRect(px,py+TILE-15,TILE,2);x.fillStyle='rgba(0,0,0,.3)';for(let k=0;k<TILE;k+=13)x.fillRect(px+k,py+TILE-13,1,13);};
  const stone=hue=>({void:'#060403',
    floor(x,px,py){x.fillStyle=`hsl(${hue},14%,${12+Math.random()*4}%)`;x.fillRect(px,py,TILE,TILE);x.strokeStyle='rgba(0,0,0,.28)';x.lineWidth=1;x.strokeRect(px+.5,py+.5,TILE-1,TILE-1);
      if(Math.random()<0.07)crack(x,px,py,'rgba(0,0,0,.4)');if(Math.random()<0.02)dot(x,px+rand(8,32),py+rand(8,32),rand(2,4),'rgba(200,190,160,.18)');},
    wall(x,px,py,below,adj){if(!adj)return;x.fillStyle=`hsl(${hue},12%,6%)`;x.fillRect(px,py,TILE,TILE);if(below)face(x,px,py,`hsl(${hue},14%,19%)`,`hsl(${hue},16%,27%)`);},
    deco(x,px,py,n){const r=Math.random();
      if(r<0.018){x.strokeStyle='rgba(215,205,180,.55)';x.lineWidth=2;x.beginPath();x.moveTo(px+10,py+12);x.lineTo(px+28,py+26);x.moveTo(px+28,py+12);x.lineTo(px+10,py+26);x.stroke();dot(x,px+20,py+10,3.5,'rgba(215,205,180,.6)');}
      else if(r<0.03){glow(x,px+20,py+20,24,'rgba(255,180,80,.28)');x.fillStyle='#d8cfb0';x.fillRect(px+18,py+18,4,9);dot(x,px+20,py+16,2,'#ffd36b');}
      else if(n.up&&n.left&&r<0.3){x.strokeStyle='rgba(220,220,220,.18)';x.lineWidth=1;x.beginPath();for(let k=0;k<4;k++){x.moveTo(px,py);x.lineTo(px+22*Math.cos(k*0.45),py+22*Math.sin(k*0.45));}for(const rr of [8,15])x.arc(px,py,rr,0,Math.PI/2);x.stroke();}}});
  THEMES.town=stone(35);
  THEMES.crypt=Object.assign(stone(220),{
    rooms(x,rooms){for(const r of rooms){if(r.w<9||Math.random()<0.5)continue;const px=(r.x+1)*TILE+6,py=(r.y+r.h-2)*TILE-6; // sarcophagus
      x.fillStyle='#2a2420';x.fillRect(px,py,TILE*2-12,TILE-8);x.strokeStyle='#4a4038';x.lineWidth=2;x.strokeRect(px+3,py+3,TILE*2-18,TILE-14);x.fillStyle='rgba(0,0,0,.35)';x.fillRect(px,py+TILE-8,TILE*2-12,5);}}});
  THEMES.desert={void:'#120a05',
    floor(x,px,py){x.fillStyle=`hsl(32,${26+Math.random()*6}%,${21+Math.random()*4}%)`;x.fillRect(px,py,TILE,TILE);
      for(let k=0;k<3;k++)dot(x,px+rand(2,38),py+rand(2,38),rand(0.8,1.8),Math.random()<0.5?'rgba(0,0,0,.18)':'rgba(255,230,190,.12)');
      if(Math.random()<0.22){x.strokeStyle='rgba(255,225,180,.09)';x.lineWidth=2;x.beginPath();x.arc(px+20,py+48,30,Math.PI*1.2,Math.PI*1.8);x.stroke();}},
    wall(x,px,py,below,adj){if(!adj){x.fillStyle='#1d140c';x.fillRect(px,py,TILE,TILE);return;}
      x.fillStyle='hsl(30,18%,12%)';x.beginPath();x.ellipse(px+20,py+22,24,21,rand(-0.4,0.4),0,TAU);x.fill();
      x.fillStyle='hsl(28,20%,22%)';x.beginPath();x.ellipse(px+17,py+15,15,10,rand(-0.4,0.4),0,TAU);x.fill();dot(x,px+14,py+12,3,'rgba(255,230,190,.12)');},
    deco(x,px,py){const r=Math.random();
      if(r<0.012){dot(x,px+20,py+20,6,'#d9d0b8');dot(x,px+18,py+19,1.6,'#2a1d10');dot(x,px+22,py+19,1.6,'#2a1d10');}
      else if(r<0.035){x.strokeStyle='#4a3420';x.lineWidth=2;x.beginPath();const bx=px+20,by=py+32;x.moveTo(bx,by);x.lineTo(bx,by-16);for(const s of [-1,1]){x.moveTo(bx,by-8);x.lineTo(bx+s*8,by-16);x.moveTo(bx,by-13);x.lineTo(bx+s*5,by-21);}x.stroke();}
      else if(r<0.045)glow(x,px+rand(10,30),py+rand(10,30),10,'rgba(255,120,40,.35)');}};
  THEMES.marsh={void:'#020602',
    floor(x,px,py){x.fillStyle=`hsl(${88+Math.random()*16},22%,${11+Math.random()*4}%)`;x.fillRect(px,py,TILE,TILE);
      for(let k=0;k<2;k++)dot(x,px+rand(6,34),py+rand(6,34),rand(5,11),'rgba(0,0,0,.14)');if(Math.random()<0.15)dot(x,px+rand(6,34),py+rand(6,34),rand(3,7),'rgba(120,170,70,.12)');},
    poison(x,px,py){x.fillStyle='hsl(82,62%,22%)';x.fillRect(px,py,TILE,TILE);dot(x,px+20,py+20,26,'hsla(84,66%,28%,.85)');
      for(let k=0;k<3;k++){x.strokeStyle='rgba(190,255,120,.35)';x.lineWidth=1;x.beginPath();x.arc(px+rand(6,34),py+rand(6,34),rand(1.5,3.5),0,TAU);x.stroke();}},
    wall(x,px,py,below,adj){x.fillStyle='hsl(120,30%,5%)';x.fillRect(px,py,TILE,TILE);if(!adj)return;
      for(let k=0;k<3;k++)dot(x,px+rand(4,36),py+rand(4,36),rand(10,17),`hsl(${105+rand(0,30)},35%,${9+rand(0,7)}%)`);},
    deco(x,px,py){const r=Math.random();
      if(r<0.016){const cx=px+rand(10,30),cy=py+rand(10,30);glow(x,cx,cy,16,'rgba(90,255,210,.28)');x.fillStyle='#cfe';x.fillRect(cx-1,cy,2,5);dot(x,cx,cy,4,'#5fd8c0');}
      else if(r<0.04){x.strokeStyle='hsl(90,35%,30%)';x.lineWidth=1.5;x.beginPath();const bx=px+rand(8,32),by=py+34;for(let k=-2;k<=2;k++){x.moveTo(bx+k*3,by);x.lineTo(bx+k*4+rand(-2,2),by-rand(12,22));}x.stroke();}}};
  THEMES.citadel={void:'#02050b',
    floor(x,px,py){x.fillStyle=`hsl(${200+Math.random()*12},18%,${23+Math.random()*5}%)`;x.fillRect(px,py,TILE,TILE);x.strokeStyle='rgba(210,235,255,.09)';x.lineWidth=1;x.strokeRect(px+.5,py+.5,TILE-1,TILE-1);
      if(Math.random()<0.25)dot(x,px+rand(4,36),py+rand(4,36),rand(4,10),'rgba(240,250,255,.06)');if(Math.random()<0.05)crack(x,px,py,'rgba(200,235,255,.18)');},
    voidT(x,px,py,i,j,at){x.fillStyle='#02050b';x.fillRect(px,py,TILE,TILE);if(Math.random()<0.1)dot(x,px+rand(0,40),py+rand(0,40),rand(8,18),'rgba(120,160,220,.035)');
      if(at(i,j-1)===0){x.fillStyle='hsl(210,16%,17%)';x.fillRect(px,py,TILE,14);x.fillStyle='hsl(205,20%,30%)';x.fillRect(px,py,TILE,2);x.fillStyle='rgba(220,240,255,.5)';
        for(let k=0;k<3;k++){const ix=px+rand(3,37);x.beginPath();x.moveTo(ix-2,py+14);x.lineTo(ix+2,py+14);x.lineTo(ix,py+14+rand(4,9));x.fill();}}},
    bridge(x,px,py,i,j,at){const vert=at(i-1,j)===2||at(i+1,j)===2;x.fillStyle='#3b2c1e';x.fillRect(px,py,TILE,TILE);x.fillStyle='rgba(0,0,0,.35)';
      for(let k=4;k<TILE;k+=9)vert?x.fillRect(px,py+k,TILE,1.5):x.fillRect(px+k,py,1.5,TILE);
      x.fillStyle='#6a5236';if(vert){if(at(i-1,j)===2)x.fillRect(px,py,3,TILE);if(at(i+1,j)===2)x.fillRect(px+TILE-3,py,3,TILE);}else{if(at(i,j-1)===2)x.fillRect(px,py,TILE,3);if(at(i,j+1)===2)x.fillRect(px,py+TILE-3,TILE,3);}},
    wall(x,px,py,below,adj){x.fillStyle=adj?'hsl(210,14%,28%)':'#0a0f18';x.fillRect(px,py,TILE,TILE);if(!adj)return;
      x.fillStyle='rgba(0,0,0,.22)';x.fillRect(px,py+13,TILE,1.5);x.fillRect(px,py+27,TILE,1.5);x.fillRect(px+20,py,1.5,13);x.fillRect(px+8,py+14,1.5,13);x.fillRect(px+30,py+28,1.5,12);
      x.fillStyle='rgba(240,250,255,.55)';x.fillRect(px,py,TILE,4);if(below)face(x,px,py,'hsl(210,16%,22%)','hsl(205,30%,40%)');},
    deco(x,px,py){const r=Math.random();
      if(r<0.016){const cx=px+rand(10,30),cy=py+rand(14,30);x.fillStyle='rgba(180,225,255,.75)';x.beginPath();x.moveTo(cx,cy-14);x.lineTo(cx+5,cy);x.lineTo(cx-5,cy);x.fill();x.beginPath();x.moveTo(cx+6,cy-8);x.lineTo(cx+9,cy);x.lineTo(cx+3,cy);x.fill();}
      else if(r<0.05){x.fillStyle='rgba(240,250,255,.12)';x.beginPath();x.ellipse(px+20,py+24,rand(10,18),rand(5,9),0,0,TAU);x.fill();}}};
  THEMES.ember={void:'#1a0400',
    floor(x,px,py){x.fillStyle=`hsl(${6+Math.random()*10},14%,${8+Math.random()*4}%)`;x.fillRect(px,py,TILE,TILE);if(Math.random()<0.13)crack(x,px,py,'rgba(255,90,20,.55)',1.5);},
    voidT(x,px,py){x.fillStyle=`hsl(${16+Math.random()*8},95%,${40+Math.random()*6}%)`;x.fillRect(px,py,TILE,TILE);
      for(let k=0;k<2;k++){x.fillStyle='rgba(255,220,120,.35)';x.beginPath();x.ellipse(px+rand(6,34),py+rand(6,34),rand(4,10),rand(2,4),rand(0,3),0,TAU);x.fill();}
      if(Math.random()<0.4)dot(x,px+rand(6,34),py+rand(6,34),rand(3,7),'rgba(90,10,0,.45)');},
    lava(x,px,py){x.fillStyle='hsl(14,88%,33%)';x.fillRect(px,py,TILE,TILE);
      for(let k=0;k<3;k++){x.fillStyle='rgba(40,8,2,.75)';x.beginPath();const cx=px+rand(6,34),cy=py+rand(6,34);for(let m=0;m<5;m++){const a=m/5*TAU,rr=rand(4,8);x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);}x.fill();}
      crack(x,px,py,'rgba(255,220,120,.7)',1.5);},
    wall(x,px,py,below,adj){x.fillStyle='hsl(0,8%,5%)';x.fillRect(px,py,TILE,TILE);if(!adj)return;x.fillStyle='rgba(255,80,20,.16)';x.fillRect(px,py,TILE,2);
      if(below){face(x,px,py,'hsl(4,12%,11%)','hsl(10,60%,30%)');x.fillStyle='rgba(255,90,20,.35)';x.fillRect(px+rand(4,30),py+TILE-12,rand(3,8),1.5);}},
    deco(x,px,py){const r=Math.random();
      if(r<0.012)glow(x,px+20,py+20,18,'rgba(255,120,30,.45)');
      else if(r<0.035){x.fillStyle='#0c0605';x.beginPath();const cx=px+rand(10,30),cy=py+rand(10,30);x.moveTo(cx,cy-9);x.lineTo(cx+5,cy+4);x.lineTo(cx-4,cy+5);x.fill();x.strokeStyle='rgba(255,90,30,.4)';x.lineWidth=1;x.stroke();}}};
}
function renderMap(){
  const cv=document.createElement('canvas');cv.width=MW*TILE;cv.height=MH*TILE;const x=cv.getContext('2d');
  const gen=G.inTown?'town':ACTS[actIdx(G.depth)].gen,TH=THEMES[gen],g=G.grid,T=G.terrain;
  const at=(i,j)=>i<0||j<0||i>=MW||j>=MH?1:g[j*MW+i];
  const adjFloor=(i,j)=>{for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++)if(at(i+a,j+b)===0)return true;return false;};
  x.fillStyle=TH.void;x.fillRect(0,0,cv.width,cv.height);
  // pass 1: floor, terrain and void tiles
  for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){const k=j*MW+i,v=g[k],px=i*TILE,py=j*TILE;
    if(v===0){if(T[k]===T_BRIDGE&&TH.bridge)TH.bridge(x,px,py,i,j,at);else if(T[k]===T_POISON&&TH.poison)TH.poison(x,px,py);else if(T[k]===T_LAVA&&TH.lava)TH.lava(x,px,py);else TH.floor(x,px,py);}
    else if(v===2&&TH.voidT)TH.voidT(x,px,py,i,j,at);}
  // pass 2: walls (may overhang floor for organic shapes) and decorations
  for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){const k=j*MW+i,v=g[k],px=i*TILE,py=j*TILE;
    if(v===1)TH.wall(x,px,py,at(i,j+1)===0,adjFloor(i,j));
    else if(v===0&&T[k]===0&&TH.deco)TH.deco(x,px,py,{up:at(i,j-1)===1,left:at(i-1,j)===1});}
  if(TH.rooms&&G.rooms)TH.rooms(x,G.rooms);
  G.mapCv=cv;
}
function computeFlow(){
  const p=G.p;const pt=Math.floor(p.y/TILE)*MW+Math.floor(p.x/TILE);if(pt===G.flowTile)return;G.flowTile=pt;
  const f=G.flow;f.fill(-1);const q=new Int32Array(MW*MH);let h=0,t=0;q[t++]=pt;f[pt]=0;
  while(h<t){const c=q[h++];const cx=c%MW,cy=(c/MW)|0,d=f[c];if(d>45)continue;
    for(const [ax,ay] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+ax,ny=cy+ay;if(nx<0||ny<0||nx>=MW||ny>=MH)continue;const n=ny*MW+nx;if(f[n]!==-1||G.grid[n]!==0)continue;f[n]=d+1;q[t++]=n;}}
}
function flowDir(e){
  const tx=Math.floor(e.x/TILE),ty=Math.floor(e.y/TILE);const here=G.flow[ty*MW+tx];
  let best=null,bd=here<0?9999:here;
  for(const [ax,ay] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=tx+ax,ny=ty+ay;if(solid(nx,ny))continue;if(ax&&ay&&(solid(tx+ax,ty)||solid(tx,ty+ay)))continue;const d=G.flow[ny*MW+nx];if(d>=0&&d<bd){bd=d;best=[nx,ny];}}
  if(!best)return null;return Math.atan2((best[1]+0.5)*TILE-e.y,(best[0]+0.5)*TILE-e.x);
}
