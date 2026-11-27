'use strict';
// Acts and maps: act definitions, tile queries, per-act map generation, map pre-rendering, flow field.
// ---------- acts: 5 acts × 5 depths; depth 5 of each act is the boss. Depth 26+ repeats the acts as higher cycles. ----------
const ACTS=[
  {name:'Sunken Crypts',sub:'Where the drowned dead keep their vigil',gen:'crypt',col:'#9ab0d8',boss:'Varrok the Hollow',bossCol:'#4a5a7a',mm:'#8a7f70',
   light:{r0:150,r1:470,tint:'rgba(150,190,110,0.05)',dark:'rgba(4,8,5,0.95)'},
   roster:[['grunt',5],['archer',3],['brute',2,2]]},
  {name:'Ashen Wastes',sub:'A desert of cinders beneath a dead sun',gen:'desert',col:'#e0a860',boss:'The Ash Tyrant',bossCol:'#8a4a1a',mm:'#b0905a',
   light:{r0:230,r1:640,tint:'rgba(255,170,90,0.07)',dark:'rgba(20,10,4,0.82)'},
   roster:[['scarab',4],['dustmage',2],['sandworm',1.6]]},
  {name:'Rotwood Marsh',sub:'The ground drinks, and the water bites',gen:'marsh',col:'#9fd060',boss:'Mother of Rot',bossCol:'#4a6a1f',mm:'#6f8a4a',
   light:{r0:150,r1:450,tint:'rgba(120,170,220,0.06)',dark:'rgba(2,6,12,0.95)'},
   roster:[['sporetoad',4],['vinelasher',2.4],['marshtroll',1.8]]},
  {name:'Frozen Citadel',sub:'Halls of ice above an endless fall',gen:'citadel',col:'#bfe4ff',boss:'Rimeheart, the Frozen King',bossCol:'#3a6a9a',mm:'#9ab8d0',
   light:{r0:180,r1:540,tint:'rgba(150,200,255,0.07)',dark:'rgba(3,7,16,0.92)'},
   roster:[['frostwraith',3],['icegolem',1.4],['shardling',3.4]]},
  {name:'The Ember Core',sub:'The heart of the deep still burns',gen:'ember',col:'#ff7a3a',boss:'The Cinder King',bossCol:'#9a1f0a',mm:'#a0604a',
   light:{r0:170,r1:520,tint:'rgba(255,90,30,0.08)',dark:'rgba(14,3,1,0.93)'},
   roster:[['imp',4],['magmabrute',2],['summoner',1.4]]}
];
const actIdx=d=>Math.floor((d-1)/5)%5,cycleOf=d=>Math.floor((d-1)/25)+1,stageOf=d=>(d-1)%5+1;
// Difficulties (c.diff: 0 Normal, 1 Nightmare, 2 Hell; c.diffDone: how many are beaten, 1 = Normal). The depth number
// (1-25 the story, 26+ the endless depths) says where you are; the power depth says how strong things are there:
// Nightmare adds 25 and Hell 50, so they reuse the scaling the endless depths already had (monster life, damage and
// XP, pack size, elite affixes, item level and Tier V bases, gems, gold, area level). The endless depths scale with
// the highest difficulty beaten: Endless 1 is power depth 26 after Normal, 51 after Nightmare, 76 after Hell.
// Monster builders (makeEnemy, rollPack, rollAffixes) take the depth and convert it themselves; loot and prices use PD().
// res: the resistance penalty (v1.0.57); loot: the drop bonuses (v1.0.58), also by diffHere in the endless depths.
// loot: drop = item, charm chance x; rar = Item Rarity bonus %; gold x; pity = kills before a set/unique is guaranteed;
// stone = gem and rune chance x; boss = extra act boss items; zb = extra zone boss items; cur = crafting currency x (currency.js).
const DIFFS=[{name:'Normal',col:'#d9a441',elite:0,res:0,loot:{drop:1,rar:0,gold:1,pity:350,stone:1,boss:0,zb:0,cur:1}},
  {name:'Nightmare',col:'#b070ff',elite:0.06,res:20,loot:{drop:1.1,rar:25,gold:1.5,pity:280,stone:1.3,boss:1,zb:1,cur:1.4}},
  {name:'Hell',col:'#ff4a3a',elite:0.12,res:50,loot:{drop:1.2,rar:50,gold:2,pity:210,stone:1.6,boss:2,zb:2,cur:1.8}}];
const DIFF_N=DIFFS.length;
const curDiff=()=>G.char&&G.char.diff||0;
const powDepth=d=>{const c=G.char;if(!c)return d;if(c.mapRun&&G.zone==='map'&&!G.inTown)return mapPD(c.mapRun); /* sigils.js: maps */return d+25*(d<=25?(c.diff||0):Math.max(0,(c.diffDone||0)-1));};
const PD=()=>powDepth(G.depth||1);
// Resistance penalty where you are: the difficulty's (Nightmare 20, Hell 50); the endless depths take the highest beaten.
// The difficulty whose rules apply where you are: the one you play in the story; the highest beaten in the endless depths.
const diffHere=()=>{const c=G.char;if(!c)return 0;if(c.mapRun&&G.zone==='map'&&!G.inTown)return 2; /* maps play by Hell's rules */return (G.depth||1)<=25?(c.diff||0):Math.max(0,(c.diffDone||0)-1);};
const resPenalty=()=>(DIFFS[diffHere()].res||0)+(typeof mapResPen==='function'?mapResPen():0);
const lootHere=()=>typeof inMap==='function'&&inMap()?mapLoot():DIFFS[diffHere()].loot; // sigils.js: a map's Item Quantity and Rarity
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
function genLevel(depth,mode){
  const A=ACTS[actIdx(depth)];let rooms=null;
  for(let t=0;t<5&&!(rooms&&rooms.length>=6);t++)rooms=GEN[A.gen](depth);
  if(!rooms||rooms.length<3){rooms=GEN.crypt(depth);} // safety net: never ship an unplayable map
  const g=G.grid;G.rooms=rooms;
  const start=rooms[0];let exit=rooms[1],ed=0;
  for(const r of rooms){const d=Math.hypot(r.cx-start.cx,r.cy-start.cy);if(d>ed){ed=d;exit=r;}}
  const isBoss=depth%5===0&&mode!=='noboss',bossOnly=isBoss&&mode==='boss';
  G.portal={x:(exit.cx+0.5)*TILE,y:(exit.cy+0.5)*TILE,active:!isBoss};
  G.enemies=[];G.boss=null;let packId=0;
  const safe=(x,y,r)=>!blockedAt(x,y,r)&&G.terrain[tileIdx(x,y)]===0;
  const spot=r=>{for(let k=0;k<30;k++){const x=(r.x+rand(1,r.w-1))*TILE,y=(r.y+rand(1,r.h-1))*TILE;if(safe(x,y,26))return {x,y};}return {x:(r.cx+0.5)*TILE,y:(r.cy+0.5)*TILE};};
  for(const r of rooms){
    if(r===start)continue;
    if(isBoss&&r===exit){let bx=(r.cx+0.5)*TILE,by=(r.cy-1)*TILE;if(blockedAt(bx,by,40))by=(r.cy+0.5)*TILE;const b=makeEnemy('boss',bx,by,depth,false,++packId);G.enemies.push(b);G.boss=b;continue;}
    if(bossOnly)continue;
    const packs=randi(1,2);
    for(let k=0;k<packs;k++){const id=++packId;const eliteP=Math.random()<(powDepth(depth)<=5?0.2:Math.min(powDepth(depth)>25?0.45:0.3,0.1+powDepth(depth)*0.006)) /* Act 1: elite packs twice as often */,affs=eliteP?rollAffixes(depth):null;
      const c=spot(r);rollPack(depth,eliteP).forEach((type,m)=>{const T=ETYPES[type];
        let x=c.x+rand(-50,50),y=c.y+rand(-50,50);if(type==='vinelasher'){const q=spot(r);x=q.x;y=q.y;}
        if(!safe(x,y,T.r)){x=c.x;y=c.y;}
        G.enemies.push(makeEnemy(type,x,y,depth,eliteP&&m<4,id,affs));});}
  }
  if(!bossOnly)placeEncounters(depth,rooms,start,exit,isBoss,spot);
  G.p.x=(start.cx+0.5)*TILE;G.p.y=(start.cy+0.5)*TILE;
  G.explored=new Uint8Array(MW*MH);
  G.flow=new Int16Array(MW*MH);G.flowTile=-1;
  renderMap();
}
// genTown() lives in js/towns.js (one town per act).

// ---------- map rendering: pre-drawn once per level into one canvas (cheap per frame) ----------
const THEMES={};
{ // drawing helpers shared by themes
  const glow=(x,cx,cy,r,col)=>{const g=x.createRadialGradient(cx,cy,1,cx,cy,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(cx-r,cy-r,r*2,r*2);};
  const dot=(x,cx,cy,r,col)=>{x.fillStyle=col;x.beginPath();x.arc(cx,cy,r,0,TAU);x.fill();};
  const crack=(x,px,py,col,w)=>{x.strokeStyle=col;x.lineWidth=w||1;x.beginPath();x.moveTo(px+rand(4,36),py+rand(4,36));x.lineTo(px+rand(4,36),py+rand(4,36));x.lineTo(px+rand(4,36),py+rand(4,36));x.stroke();};
  // Wall face: two courses of worn bricks with dark mortar, a lit top edge and grime collecting toward the floor.
  const face=(x,px,py,c1,c2)=>{const y0=py+TILE-15;x.fillStyle=c1;x.fillRect(px,y0,TILE,15);
    for(let row=0;row<2;row++){const by=y0+2+row*6.5,off=row?0:7+Math.random()*5;
      for(let bx=-off;bx<TILE;bx+=rand(11,16)){x.fillStyle=Math.random()<0.5?'rgba(255,240,220,.05)':'rgba(0,0,0,.14)';x.fillRect(px+Math.max(0,bx)+1,by,Math.min(rand(9,14),TILE-Math.max(0,bx)-1),5);x.fillStyle='rgba(0,0,0,.45)';if(bx>0)x.fillRect(px+bx,by,1.2,6);}
      x.fillStyle='rgba(0,0,0,.4)';x.fillRect(px,by+5.2,TILE,1.2);}
    x.fillStyle=c2;x.fillRect(px,y0,TILE,2);x.fillStyle='rgba(0,0,0,.18)';x.fillRect(px,y0+2,TILE,1);
    const g=x.createLinearGradient(0,y0+6,0,y0+15);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.45)');x.fillStyle=g;x.fillRect(px,y0+6,TILE,9);
    if(Math.random()<0.3){x.fillStyle='rgba(0,0,0,.35)';x.fillRect(px+rand(4,34),y0+rand(3,10),rand(2,4),rand(1,3));}};
  // Floor of worn flagstones: one, two or four slabs per tile in slightly different tones, bevelled and grouted,
  // with chips and grit, so the floor never reads as a clean grid.
  const slabs=(x,px,py,h,s,l,lv)=>{const c=Math.random();let R;
    if(c<0.3)R=[[0,0,TILE,TILE]];
    else if(c<0.62){const m=rand(13,27);R=Math.random()<0.5?[[0,0,m,TILE],[m,0,TILE-m,TILE]]:[[0,0,TILE,m],[0,m,TILE,TILE-m]];}
    else{const mx=rand(13,27),my=rand(13,27);R=[[0,0,mx,my],[mx,0,TILE-mx,my],[0,my,mx,TILE-my],[mx,my,TILE-mx,TILE-my]];}
    for(const [a,b,w,hh] of R){x.fillStyle=`hsl(${h+rand(-4,4)},${s}%,${l+rand(-lv,lv)}%)`;x.fillRect(px+a,py+b,w,hh);
      x.fillStyle='rgba(255,236,210,.05)';x.fillRect(px+a+1,py+b+1,w-2,1.2);x.fillRect(px+a+1,py+b+1,1.2,hh-2);
      x.fillStyle='rgba(0,0,0,.42)';x.fillRect(px+a,py+b+hh-1.4,w,1.4);x.fillRect(px+a+w-1.4,py+b,1.4,hh);
      if(Math.random()<0.18){x.fillStyle='rgba(0,0,0,.4)';x.beginPath();const cx=px+a+(Math.random()<0.5?1:w-1),cy=py+b+(Math.random()<0.5?1:hh-1);x.moveTo(cx,cy);x.lineTo(cx+rand(-5,5),cy);x.lineTo(cx,cy+rand(-5,5));x.fill();}}
    for(let k=0;k<4;k++){x.fillStyle=Math.random()<0.6?'rgba(0,0,0,.22)':'rgba(255,240,220,.06)';x.fillRect(px+rand(1,TILE-2),py+rand(1,TILE-2),rand(0.8,1.8),rand(0.8,1.8));}};
  const stone=hue=>({void:'#060403',
    floor(x,px,py){slabs(x,px,py,hue,10,14,2.5);
      if(Math.random()<0.07)crack(x,px,py,'rgba(0,0,0,.4)');if(Math.random()<0.02)dot(x,px+rand(8,32),py+rand(8,32),rand(2,4),'rgba(200,190,160,.18)');},
    wall(x,px,py,below,adj){if(!adj)return;x.fillStyle=`hsl(${hue},12%,6%)`;x.fillRect(px,py,TILE,TILE);if(below)face(x,px,py,`hsl(${hue},14%,19%)`,`hsl(${hue},16%,27%)`);},
    deco(x,px,py,n){const r=Math.random();
      if(r<0.018){x.strokeStyle='rgba(215,205,180,.55)';x.lineWidth=2;x.beginPath();x.moveTo(px+10,py+12);x.lineTo(px+28,py+26);x.moveTo(px+28,py+12);x.lineTo(px+10,py+26);x.stroke();dot(x,px+20,py+10,3.5,'rgba(215,205,180,.6)');}
      else if(r<0.03){glow(x,px+20,py+20,24,'rgba(255,180,80,.28)');addLight(px+20,py+16,120,0.6,'255,180,90',0.25,1);x.fillStyle='#d8cfb0';x.fillRect(px+18,py+18,4,9);dot(x,px+20,py+16,2,'#ffd36b');}
      else if(n.up&&n.left&&r<0.3){x.strokeStyle='rgba(220,220,220,.18)';x.lineWidth=1;x.beginPath();for(let k=0;k<4;k++){x.moveTo(px,py);x.lineTo(px+22*Math.cos(k*0.45),py+22*Math.sin(k*0.45));}for(const rr of [8,15])x.arc(px,py,rr,0,Math.PI/2);x.stroke();}}});
  THEMES.crypt=Object.assign(stone(220),{
    rooms(x,rooms){for(const r of rooms){if(r.w<9||Math.random()<0.5)continue;const px=(r.x+1)*TILE+6,py=(r.y+r.h-2)*TILE-6; // sarcophagus
      x.fillStyle='#2a2420';x.fillRect(px,py,TILE*2-12,TILE-8);x.strokeStyle='#4a4038';x.lineWidth=2;x.strokeRect(px+3,py+3,TILE*2-18,TILE-14);x.fillStyle='rgba(0,0,0,.35)';x.fillRect(px,py+TILE-8,TILE*2-12,5);}}});
  THEMES.desert={void:'#120a05',
    floor(x,px,py){x.fillStyle=`hsl(32,${24+Math.random()*2}%,${21.5+Math.random()*1.2}%)`;x.fillRect(px,py,TILE,TILE);
      for(let k=0;k<2;k++)dot(x,px+rand(0,40),py+rand(0,40),rand(8,16),Math.random()<0.5?'rgba(0,0,0,.05)':'rgba(255,230,190,.035)');
      for(let k=0;k<3;k++)dot(x,px+rand(2,38),py+rand(2,38),rand(0.8,1.8),Math.random()<0.5?'rgba(0,0,0,.18)':'rgba(255,230,190,.12)');
      if(Math.random()<0.22){x.strokeStyle='rgba(255,225,180,.09)';x.lineWidth=2;x.beginPath();x.arc(px+20,py+48,30,Math.PI*1.2,Math.PI*1.8);x.stroke();}},
    // jagged sandstone: a dark irregular base, a lit top face, strata lines and cracks
    wall(x,px,py,below,adj){if(!adj){x.fillStyle='#1d140c';x.fillRect(px,py,TILE,TILE);return;}
      const blob=(cx,cy,rx,ry,col)=>{x.fillStyle=col;x.beginPath();for(let k=0;k<9;k++){const a=k/9*TAU,r=rand(0.78,1.08);x.lineTo(cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r);}x.closePath();x.fill();};
      blob(px+20,py+23,25,21,'hsl(28,16%,9%)');blob(px+19,py+18,21,16,'hsl(29,17%,16%)');blob(px+17,py+14,14,9,'hsl(31,18%,23%)');
      x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=1;for(let k=0;k<2;k++){const yy=py+rand(14,28);x.beginPath();x.moveTo(px+rand(2,10),yy);x.lineTo(px+rand(30,38),yy+rand(-3,3));x.stroke();}
      if(Math.random()<0.5)crack(x,px,py,'rgba(0,0,0,.45)');x.fillStyle='rgba(255,230,190,.1)';x.fillRect(px+rand(8,22),py+rand(8,12),rand(4,8),1.2);},
    deco(x,px,py){const r=Math.random();
      if(r<0.012){dot(x,px+20,py+20,6,'#d9d0b8');dot(x,px+18,py+19,1.6,'#2a1d10');dot(x,px+22,py+19,1.6,'#2a1d10');}
      else if(r<0.035){x.strokeStyle='#4a3420';x.lineWidth=2;x.beginPath();const bx=px+20,by=py+32;x.moveTo(bx,by);x.lineTo(bx,by-16);for(const s of [-1,1]){x.moveTo(bx,by-8);x.lineTo(bx+s*8,by-16);x.moveTo(bx,by-13);x.lineTo(bx+s*5,by-21);}x.stroke();}
      else if(r<0.045){const gx=px+rand(10,30),gy=py+rand(10,30);glow(x,gx,gy,10,'rgba(255,120,40,.35)');addLight(gx,gy,55,0.35,'255,120,40',0.2,1);}}};
  THEMES.marsh={void:'#020602',
    floor(x,px,py){x.fillStyle=`hsl(${92+Math.random()*6},18%,${12+Math.random()*1.2}%)`;x.fillRect(px,py,TILE,TILE);
      for(let k=0;k<2;k++)dot(x,px+rand(6,34),py+rand(6,34),rand(5,11),'rgba(0,0,0,.14)');if(Math.random()<0.15)dot(x,px+rand(6,34),py+rand(6,34),rand(3,7),'rgba(120,170,70,.12)');},
    poison(x,px,py){if(Math.random()<0.12)addLight(px+20,py+20,80,0.3,'150,230,80',0.15,0);x.fillStyle='hsl(82,62%,22%)';x.fillRect(px,py,TILE,TILE);dot(x,px+20,py+20,26,'hsla(84,66%,28%,.85)');
      for(let k=0;k<3;k++){x.strokeStyle='rgba(190,255,120,.35)';x.lineWidth=1;x.beginPath();x.arc(px+rand(6,34),py+rand(6,34),rand(1.5,3.5),0,TAU);x.stroke();}},
    wall(x,px,py,below,adj){x.fillStyle='hsl(120,30%,5%)';x.fillRect(px,py,TILE,TILE);if(!adj)return;
      for(let k=0;k<3;k++)dot(x,px+rand(4,36),py+rand(4,36),rand(10,17),`hsl(${95+rand(0,30)},22%,${7+rand(0,6)}%)`);},
    deco(x,px,py){const r=Math.random();
      if(r<0.016){const cx=px+rand(10,30),cy=py+rand(10,30);glow(x,cx,cy,16,'rgba(90,255,210,.28)');addLight(cx,cy,80,0.4,'90,255,210',0.2,0);x.fillStyle='#cfe';x.fillRect(cx-1,cy,2,5);dot(x,cx,cy,4,'#5fd8c0');}
      else if(r<0.04){x.strokeStyle='hsl(90,35%,30%)';x.lineWidth=1.5;x.beginPath();const bx=px+rand(8,32),by=py+34;for(let k=-2;k<=2;k++){x.moveTo(bx+k*3,by);x.lineTo(bx+k*4+rand(-2,2),by-rand(12,22));}x.stroke();}}};
  THEMES.citadel={void:'#02050b',
    floor(x,px,py){slabs(x,px,py,206,13,21,3);
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
      if(r<0.016){const cx=px+rand(10,30),cy=py+rand(14,30);addLight(cx,cy-6,70,0.4,'170,215,255',0.25,0);x.fillStyle='rgba(180,225,255,.75)';x.beginPath();x.moveTo(cx,cy-14);x.lineTo(cx+5,cy);x.lineTo(cx-5,cy);x.fill();x.beginPath();x.moveTo(cx+6,cy-8);x.lineTo(cx+9,cy);x.lineTo(cx+3,cy);x.fill();}
      else if(r<0.05){x.fillStyle='rgba(240,250,255,.12)';x.beginPath();x.ellipse(px+20,py+24,rand(10,18),rand(5,9),0,0,TAU);x.fill();}}};
  THEMES.ember={void:'#1a0400',
    floor(x,px,py){slabs(x,px,py,10,10,10,2);if(Math.random()<0.13)crack(x,px,py,'rgba(255,90,20,.55)',1.5);},
    voidT(x,px,py,i,j,at){if(Math.random()<0.16)addLight(px+20,py+20,140,0.55,'255,110,30',0.12,0);x.fillStyle=`hsl(${18+Math.random()*4},90%,${41+Math.random()*2}%)`;x.fillRect(px,py,TILE,TILE);
      // cooled crust where the lava meets rock: a dark rim fading inward, with lumpy edges
      for(const [di,dj,gx,gy,w,h] of [[0,-1,0,0,TILE,12],[0,1,0,TILE-12,TILE,12],[-1,0,0,0,12,TILE],[1,0,TILE-12,0,12,TILE]]){if(at(i+di,j+dj)===2)continue;
        const g=x.createLinearGradient(px+(di>0?TILE:di<0?0:0),py+(dj>0?TILE:0),px+(di>0?TILE-12:di<0?12:0),py+(dj>0?TILE-12:dj<0?12:0));g.addColorStop(0,'rgba(20,6,2,.95)');g.addColorStop(0.5,'rgba(70,14,2,.6)');g.addColorStop(1,'rgba(120,30,4,0)');x.fillStyle=g;x.fillRect(px+gx,py+gy,w,h);
        for(let k=0;k<3;k++)dot(x,px+(di?gx+(di>0?TILE-gx-12:0)+rand(0,6)+(di>0?6:0):rand(2,38)),py+(dj?(dj>0?TILE-rand(2,8):rand(2,8)):rand(2,38)),rand(2.5,5),'rgba(24,8,3,.9)');}
      for(let k=0;k<2;k++){x.fillStyle='rgba(255,220,120,.35)';x.beginPath();x.ellipse(px+rand(6,34),py+rand(6,34),rand(4,10),rand(2,4),rand(0,3),0,TAU);x.fill();}
      if(Math.random()<0.4)dot(x,px+rand(6,34),py+rand(6,34),rand(3,7),'rgba(90,10,0,.45)');},
    lava(x,px,py){if(Math.random()<0.3)addLight(px+20,py+20,120,0.5,'255,110,30',0.14,0);x.fillStyle='hsl(14,88%,33%)';x.fillRect(px,py,TILE,TILE);
      for(let k=0;k<3;k++){x.fillStyle='rgba(40,8,2,.75)';x.beginPath();const cx=px+rand(6,34),cy=py+rand(6,34);for(let m=0;m<5;m++){const a=m/5*TAU,rr=rand(4,8);x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);}x.fill();}
      crack(x,px,py,'rgba(255,220,120,.7)',1.5);},
    wall(x,px,py,below,adj){x.fillStyle='hsl(0,8%,5%)';x.fillRect(px,py,TILE,TILE);if(!adj)return;x.fillStyle='rgba(255,80,20,.16)';x.fillRect(px,py,TILE,2);
      if(below){face(x,px,py,'hsl(4,12%,11%)','hsl(10,60%,30%)');x.fillStyle='rgba(255,90,20,.35)';x.fillRect(px+rand(4,30),py+TILE-12,rand(3,8),1.5);}},
    deco(x,px,py){const r=Math.random();
      if(r<0.012){glow(x,px+20,py+20,18,'rgba(255,120,30,.45)');addLight(px+20,py+20,80,0.45,'255,120,30',0.25,1);}
      else if(r<0.035){x.fillStyle='#0c0605';x.beginPath();const cx=px+rand(10,30),cy=py+rand(10,30);x.moveTo(cx,cy-9);x.lineTo(cx+5,cy+4);x.lineTo(cx-4,cy+5);x.fill();x.strokeStyle='rgba(255,90,30,.4)';x.lineWidth=1;x.stroke();}}};
  // ---------- props and floor detail (graphics stage 5) ----------
  // Painted into the map once, after the floor and walls. Props are scenery only (they never block or get hit);
  // tall ones (graves, cages, dead trees, pillars) prefer floor right under a wall so they read as standing against it.
  const shade=(x,cx,cy,rx,ry,a)=>{x.fillStyle=`rgba(0,0,0,${a||0.4})`;x.beginPath();x.ellipse(cx,cy,rx,ry,0,0,TAU);x.fill();};
  const lin=(x,x0,y0,x1,y1,c0,c1)=>{const g=x.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,c0);g.addColorStop(1,c1);return g;};
  // propart.js: the painted version of a prop when the props sheet is in (false: draw it as before)
  const pick=a=>a[Math.random()*a.length|0];
  const STONE_GEN={crypt:1,citadel:1,ember:1,a1ossuary:1,a2city:1,a2tomb:1,a4bastion:1,a4pass:1,a5foundry:1,a5tubes:1};
  const PR={
    // a weathered headstone: rounded top, lit face, dark top edge, crack and grime at the foot
    grave(x,cx,cy,c){if(propArt(x,pick(['grave1','grave2','grave3','grave4']),cx,cy+3,0.85,Math.random()<0.5))return;shade(x,cx+3,cy+3,11,4);x.fillStyle='#14110e';x.beginPath();x.moveTo(cx-8,cy+2);x.lineTo(cx-8,cy-14);x.arc(cx,cy-14,8,Math.PI,0);x.lineTo(cx+8,cy+2);x.closePath();x.fill();
      x.fillStyle=lin(x,cx-7,0,cx+7,0,c||'#5a5650','#34312c');x.beginPath();x.moveTo(cx-7,cy+2);x.lineTo(cx-7,cy-13);x.arc(cx,cy-13,7,Math.PI,0);x.lineTo(cx+7,cy+2);x.closePath();x.fill();
      x.strokeStyle='rgba(0,0,0,.5)';x.lineWidth=1;x.beginPath();x.moveTo(cx-3,cy-12);x.lineTo(cx+3,cy-12);x.moveTo(cx,cy-15);x.lineTo(cx,cy-6);x.stroke();
      if(Math.random()<0.5){x.beginPath();x.moveTo(cx+2,cy-19);x.lineTo(cx+4,cy-11);x.lineTo(cx+1,cy-6);x.stroke();}
      x.fillStyle='rgba(70,90,50,.35)';x.fillRect(cx-7,cy-2,14,4);dot(x,cx+rand(-9,9),cy+4,rand(1.5,3),'rgba(30,25,20,.6)');},
    // a broken column: lit drum, shaded flank, jagged broken top, fallen chunks around it
    pillar(x,cx,cy,c,gen){if(propArt(x,STONE_GEN[gen]?pick(['statue1','statue2','statue3','statue4']):pick(['menhir1','menhir2']),cx,cy+4,STONE_GEN[gen]?1:0.75,Math.random()<0.5))return;shade(x,cx+4,cy+4,15,6,0.45);const h=rand(14,26),R=11;x.fillStyle=lin(x,cx-R,0,cx+R,0,c||'#6a645a','#2a2622');x.fillRect(cx-R,cy-h,R*2,h);
      x.beginPath();x.ellipse(cx,cy,R,R*0.42,0,0,Math.PI);x.fill();x.strokeStyle='rgba(0,0,0,.3)';x.lineWidth=1;for(const k of [-5,0,5]){x.beginPath();x.moveTo(cx+k,cy-h+3);x.lineTo(cx+k,cy+R*0.3);x.stroke();}
      x.fillStyle=c?'#8a8478':'#7e776a';x.beginPath();for(let k=0;k<=10;k++){const a=Math.PI+k/10*Math.PI,j=k%2?rand(-4,0):rand(0,3);x.lineTo(cx+Math.cos(a)*R,cy-h+Math.sin(a)*R*0.42+j);}for(let k=0;k<=10;k++){const a=k/10*Math.PI;x.lineTo(cx+Math.cos(a)*R,cy-h+Math.sin(a)*R*0.42);}x.fill();
      for(let k=0;k<4;k++)PR.chunk(x,cx+rand(-20,20),cy+rand(2,10),rand(2.5,5),c);},
    chunk(x,cx,cy,r,c){shade(x,cx+1,cy+1,r*1.1,r*0.5,0.4);x.fillStyle=c||'#5e584e';x.beginPath();for(let k=0;k<6;k++){const a=k/6*TAU,rr=r*rand(0.7,1.1);x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr*0.8);}x.fill();x.fillStyle='rgba(255,240,220,.12)';x.fillRect(cx-r*0.5,cy-r*0.6,r*0.8,1.2);},
    debris(x,cx,cy,c){for(let k=0;k<rand(4,8);k++)PR.chunk(x,cx+rand(-14,14),cy+rand(-9,9),rand(1.8,4.5),c);},
    // a low run of ruined wall: blocks of different heights with lit tops and dark faces
    ruin(x,cx,cy,c){if(propArt(x,pick(['stone1','stone2','stone3','stone4']),cx,cy+6,0.85,Math.random()<0.5))return;shade(x,cx,cy+6,30,6,0.4);let bx=cx-28;while(bx<cx+26){const w=rand(9,14),h=rand(4,16);x.fillStyle=lin(x,0,cy-h,0,cy+4,c||'#4e4840','#24201c');x.fillRect(bx,cy-h,w-1,h+4);x.fillStyle=c?'#7a7466':'#6a645a';x.fillRect(bx,cy-h-3,w-1,3);
      x.fillStyle='rgba(0,0,0,.4)';x.fillRect(bx+w-2,cy-h,1,h+4);bx+=w;}PR.debris(x,cx+rand(-10,10),cy+12,c);},
    // a skull and scattered long bones
    bones(x,cx,cy,c,gen,drawn){if(!drawn&&propArt(x,pick(['skel1','skulls','bones1','bones2','skel2']),cx,cy+4,1,Math.random()<0.5))return;for(let k=0;k<3;k++){const a=rand(0,Math.PI),L=rand(7,12),bx=cx+rand(-10,10),by=cy+rand(-6,6);x.strokeStyle='#a69c84';x.lineWidth=2;x.beginPath();x.moveTo(bx-Math.cos(a)*L/2,by-Math.sin(a)*L/2);x.lineTo(bx+Math.cos(a)*L/2,by+Math.sin(a)*L/2);x.stroke();
        dot(x,bx-Math.cos(a)*L/2,by-Math.sin(a)*L/2,1.7,'#b8ae94');dot(x,bx+Math.cos(a)*L/2,by+Math.sin(a)*L/2,1.7,'#b8ae94');}
      if(Math.random()<0.7){shade(x,cx+1,cy+3,5,2);dot(x,cx,cy,4.5,'#c4b89c');x.fillStyle='#c4b89c';x.fillRect(cx-2.5,cy+2,5,3);dot(x,cx-1.6,cy-0.5,1.2,'#1a140e');dot(x,cx+1.6,cy-0.5,1.2,'#1a140e');}},
    // the ribcage of something large, half sunk in the sand
    ribs(x,cx,cy){if(propArt(x,pick(['ribcage','skel3','skel4']),cx,cy+4,1,Math.random()<0.5))return;const a=rand(-0.5,0.5);x.save();x.translate(cx,cy);x.rotate(a);x.strokeStyle='#b0a688';x.lineWidth=2.5;x.beginPath();x.moveTo(-24,0);x.lineTo(22,0);x.stroke();x.lineWidth=1.8;
      for(let k=0;k<6;k++){const px=-18+k*7;for(const s of [-1,1]){x.beginPath();x.moveTo(px,0);x.quadraticCurveTo(px+5,s*9,px+2,s*15);x.stroke();}}x.fillStyle='#bfb496';x.beginPath();x.ellipse(26,0,6,4.5,0,0,TAU);x.fill();x.restore();},
    // a dead tree seen from above: dark twisted branches forking out from the trunk, their shadow cast to the side
    tree(x,cx,cy,c){if(propArt(x,pick(['deadtree1','deadtree2','deadtree3','deadtree4']),cx,cy+6,0.45,Math.random()<0.5))return;const br=(x0,y0,a,L,w,d)=>{if(d>3||L<4)return;const x1=x0+Math.cos(a)*L,y1=y0+Math.sin(a)*L;x.lineWidth=w;x.beginPath();x.moveTo(x0,y0);x.quadraticCurveTo((x0+x1)/2+rand(-4,4),(y0+y1)/2+rand(-4,4),x1,y1);x.stroke();
        for(let k=0;k<2;k++)br(x1,y1,a+rand(-0.7,0.7),L*rand(0.55,0.75),w*0.6,d+1);};
      x.strokeStyle='rgba(0,0,0,.35)';x.lineCap='round';const seed=Math.random();for(let k=0;k<5;k++)br(cx+8,cy+8,k/5*TAU+seed*6,rand(12,20),3.5,0);
      x.strokeStyle=c||'#2a1e14';for(let k=0;k<5;k++)br(cx,cy,k/5*TAU+seed*6,rand(12,20),3.5,0);dot(x,cx,cy,5,c||'#2a1e14');dot(x,cx-1,cy-1,2,'rgba(255,230,200,.1)');x.lineCap='butt';},
    // an iron gibbet cage on the floor: base ring, bars, a domed top; sometimes bones inside, sometimes coals glowing
    cage(x,cx,cy,hot){if(propOn()){PR.cageD(x,cx,cy,hot);return;}shade(x,cx+3,cy+4,14,5,0.45);if(hot){glow(x,cx,cy-4,18,'rgba(255,110,30,.5)');addLight(cx,cy-6,90,0.5,'255,110,30',0.3,1);}
      x.strokeStyle='#1a1614';x.lineWidth=2;x.beginPath();x.ellipse(cx,cy,11,4.5,0,0,TAU);x.stroke();if(!hot&&Math.random()<0.6)PR.bones(x,cx,cy-3,0,0,1);if(hot)for(let k=0;k<5;k++)dot(x,cx+rand(-6,6),cy+rand(-2,2),rand(1.5,2.5),'#ff8a2a');
      x.strokeStyle='#3a3430';x.lineWidth=1.6;for(let k=0;k<7;k++){const a=Math.PI*(0.05+k/6*0.9),bx=cx+Math.cos(a)*11;x.beginPath();x.moveTo(bx,cy+Math.sin(a)*4.5);x.lineTo(bx,cy-22+Math.sin(a)*4.5);x.stroke();}
      x.beginPath();x.ellipse(cx,cy-22,11,4.5,0,0,TAU);x.stroke();x.beginPath();x.moveTo(cx-11,cy-22);x.quadraticCurveTo(cx,cy-34,cx+11,cy-22);x.stroke();x.fillStyle='rgba(255,230,200,.2)';x.fillRect(cx-9,cy-23,3,1);
      x.strokeStyle='#2a2420';x.lineWidth=1.4;x.setLineDash([2,1.5]);x.beginPath();x.moveTo(cx,cy-30);x.lineTo(cx,cy-46);x.stroke();x.setLineDash([]);},
    // a cluster of melted candles; lit, with a warm pool of light
    candles(x,cx,cy){if(propOn()){PR.candlesD(x,cx,cy);return;}glow(x,cx,cy,22,'rgba(255,170,80,.3)');addLight(cx,cy-6,110,0.55,'255,175,90',0.28,1);
      for(let k=0;k<rand(3,5);k++){const bx=cx+rand(-9,9),by=cy+rand(-4,5),h=rand(5,12);x.fillStyle='rgba(225,215,190,.5)';x.beginPath();x.ellipse(bx,by+1,3.5,1.6,0,0,TAU);x.fill();
        x.fillStyle=lin(x,bx-2,0,bx+2,0,'#e6dcc0','#9a9076');x.fillRect(bx-2,by-h,4,h);x.fillStyle='#ffd27a';x.beginPath();x.ellipse(bx,by-h-2.5,1.3,2.6,0,0,TAU);x.fill();dot(x,bx,by-h-2,0.8,'#fff8e0');}},
    // marsh: a rotting log with a lit top and dark rings at the cut end
    log(x,cx,cy){if(propOn()){PR.logD(x,cx,cy);return;}const a=rand(-0.6,0.6),L=rand(26,40);x.save();x.translate(cx,cy);x.rotate(a);shade(x,3,5,L/2+3,6,0.4);x.fillStyle=lin(x,0,-6,0,6,'#4a3a26','#1e160c');x.fillRect(-L/2,-6,L,12);
      x.fillStyle='rgba(90,120,60,.35)';x.fillRect(-L/2+4,-6,L*0.4,3);x.fillStyle='#5a4630';x.beginPath();x.ellipse(L/2,0,3,6,0,0,TAU);x.fill();x.strokeStyle='rgba(0,0,0,.4)';x.lineWidth=0.8;x.beginPath();x.ellipse(L/2,0,1.5,3.5,0,0,TAU);x.stroke();x.restore();},
    // marsh: a dark pool of standing water with a pale sheen
    puddle(x,cx,cy){if(propOn()){PR.puddleD(x,cx,cy);return;}const rx=rand(10,20),ry=rx*rand(0.45,0.7);x.fillStyle='rgba(8,14,12,.75)';x.beginPath();x.ellipse(cx,cy,rx,ry,rand(-0.3,0.3),0,TAU);x.fill();
      x.strokeStyle='rgba(150,180,170,.18)';x.lineWidth=1;x.beginPath();x.ellipse(cx-rx*0.2,cy-ry*0.25,rx*0.55,ry*0.35,0,Math.PI*1.1,Math.PI*1.8);x.stroke();},
    // ice: a jagged crust of frost crystals
    ice(x,cx,cy){if(propOn()){PR.iceD(x,cx,cy);return;}for(let k=0;k<rand(3,6);k++){const bx=cx+rand(-12,12),by=cy+rand(-6,6),h=rand(5,13);x.fillStyle='rgba(200,230,250,.75)';x.beginPath();x.moveTo(bx-3,by);x.lineTo(bx,by-h);x.lineTo(bx+3,by);x.fill();x.fillStyle='rgba(255,255,255,.6)';x.fillRect(bx-0.5,by-h+2,1,h-3);}},
    chains(x,cx,cy){if(propArt(x,'chains',cx+18,cy+8,0.5,Math.random()<0.5))return;x.strokeStyle='#4a4440';x.lineWidth=1.6;let px=cx-18,py=cy;for(let k=0;k<9;k++){const nx=px+4.5,ny=py+rand(-2,2);x.beginPath();x.ellipse((px+nx)/2,(py+ny)/2,3,1.8,Math.atan2(ny-py,nx-px),0,TAU);x.stroke();px=nx;py=ny;}},
    // v1.0.161: richer drawn versions (with Settings › Props: Painted; Flare has none of these)
    // a rusted iron gibbet: riveted base, thick lit bars, a domed cap on a chain; bones or glowing coals inside
    cageD(x,cx,cy,hot){shade(x,cx+3,cy+5,17,6,0.5);if(hot){glow(x,cx,cy-8,24,'rgba(255,110,30,.55)');addLight(cx,cy-6,90,0.5,'255,110,30',0.3,1);}
      x.fillStyle='#1a1614';x.beginPath();x.ellipse(cx,cy+1,14,5.5,0,0,TAU);x.fill();x.fillStyle='#2e2826';x.beginPath();x.ellipse(cx,cy,13,5,0,0,TAU);x.fill();
      if(hot)for(let k=0;k<7;k++)dot(x,cx+rand(-8,8),cy+rand(-2,2),rand(1.5,2.8),k%2?'#ff8a2a':'#ffcf60');else if(!propArt(x,'skulls',cx,cy+3,0.55)&&Math.random()<0.6)PR.bones(x,cx,cy-3,0,0,1);
      for(let k=0;k<9;k++){const a=Math.PI*(1.05+k/8*0.9),bx=cx+Math.cos(a)*12.5,by=cy+Math.sin(a)*4.8;x.strokeStyle='#2a2422';x.lineWidth=1.8;x.beginPath();x.moveTo(bx,by);x.lineTo(bx,by-26);x.stroke();}
      for(let k=0;k<9;k++){const a=Math.PI*(0.05+k/8*0.9),bx=cx+Math.cos(a)*12.5,by=cy+Math.sin(a)*4.8;x.strokeStyle='#3a3230';x.lineWidth=2.2;x.beginPath();x.moveTo(bx,by);x.lineTo(bx,by-26);x.stroke();x.strokeStyle='rgba(255,220,190,.22)';x.lineWidth=0.8;x.beginPath();x.moveTo(bx-0.6,by-1);x.lineTo(bx-0.6,by-25);x.stroke();
        if(k%3===1){x.fillStyle='rgba(140,60,30,.5)';x.fillRect(bx-1,by-rand(6,20),2,rand(3,6));}}
      x.strokeStyle='#3a3230';x.lineWidth=2.4;x.beginPath();x.ellipse(cx,cy-14,12.5,4.8,0,0,Math.PI);x.stroke();
      x.fillStyle=lin(x,cx-13,0,cx+13,0,'#4a4240','#1e1a18');x.beginPath();x.ellipse(cx,cy-26,13,5,0,Math.PI,TAU);x.quadraticCurveTo(cx,cy-42,cx-13,cy-26);x.fill();x.fillStyle='rgba(255,230,200,.18)';x.fillRect(cx-8,cy-33,6,1.2);
      for(const k of [-9,0,9])dot(x,cx+k,cy+3,1.2,'#7a706a');x.strokeStyle='#2a2420';x.lineWidth=1.4;x.setLineDash([2.5,1.5]);x.beginPath();x.moveTo(cx,cy-38);x.lineTo(cx,cy-60);x.stroke();x.setLineDash([]);},
    // melted candles on a pool of wax, drips, little flames with halos; now and then a skull holds one
    candlesD(x,cx,cy){glow(x,cx,cy-6,30,'rgba(255,170,80,.32)');addLight(cx,cy-6,110,0.55,'255,175,90',0.28,1);
      x.fillStyle='rgba(230,220,195,.55)';x.beginPath();x.ellipse(cx,cy+2,15,6,0,0,TAU);x.fill();x.fillStyle='rgba(255,250,235,.25)';x.beginPath();x.ellipse(cx-3,cy+1,8,3,0,0,TAU);x.fill();
      const C=[];for(let k=0;k<randi(4,7);k++)C.push([cx+rand(-11,11),cy+rand(-3,5),rand(5,15),rand(1.8,2.8)]);C.sort((a,b)=>a[1]-b[1]);
      if(Math.random()<0.35){dot(x,cx+8,cy-2,6,'#c8bca0');x.fillStyle='#c8bca0';x.fillRect(cx+4.5,cy+2,7,4);dot(x,cx+6,cy-2.5,1.6,'#1a140e');dot(x,cx+10,cy-2.5,1.6,'#1a140e');C.push([cx+8,cy-6,5,2]);}
      for(const [bx,by,h,w] of C){x.fillStyle=lin(x,bx-w,0,bx+w,0,'#f2e8cc','#a89c80');x.fillRect(bx-w,by-h,w*2,h);x.fillStyle='#f6eedc';x.beginPath();x.ellipse(bx,by-h,w,w*0.45,0,0,TAU);x.fill();
        x.fillStyle='rgba(235,225,200,.9)';x.fillRect(bx-w+rand(0,w),by-h,1.4,rand(2,h*0.6));x.strokeStyle='#2a2010';x.lineWidth=0.8;x.beginPath();x.moveTo(bx,by-h);x.lineTo(bx,by-h-1.6);x.stroke();
        glow(x,bx,by-h-4,7,'rgba(255,200,110,.55)');x.fillStyle='#ffb040';x.beginPath();x.ellipse(bx,by-h-3.5,1.6,3.4,0,0,TAU);x.fill();x.fillStyle='#fff4d0';x.beginPath();x.ellipse(bx,by-h-3,0.8,1.8,0,0,TAU);x.fill();}},
    // a fallen log: bark ridges lit on top, moss, a cut end with rings, sometimes small mushrooms
    logD(x,cx,cy){const a=rand(-0.5,0.5),L=rand(30,44),R=rand(6,8);x.save();x.translate(cx,cy);x.rotate(a);shade(x,3,R*0.8,L/2+4,R*0.9,0.45);
      x.fillStyle=lin(x,0,-R,0,R,'#6a5236','#1e160c');x.fillRect(-L/2,-R,L,R*2);x.strokeStyle='rgba(0,0,0,.4)';x.lineWidth=1;for(let k=0;k<5;k++){const y=rand(-R+1,R-1);x.beginPath();x.moveTo(-L/2+rand(0,6),y);x.lineTo(L/2-rand(0,8),y+rand(-1,1));x.stroke();}
      x.fillStyle='rgba(255,230,190,.14)';x.fillRect(-L/2,-R,L,2);x.fillStyle='rgba(90,130,50,.55)';x.beginPath();x.ellipse(rand(-L/4,L/4),-R+2,rand(6,11),2.6,0,0,TAU);x.fill();
      x.fillStyle='#8a6a44';x.beginPath();x.ellipse(L/2,0,R*0.45,R,0,0,TAU);x.fill();x.strokeStyle='rgba(60,40,20,.7)';x.lineWidth=0.8;for(const r of [0.7,0.45,0.2]){x.beginPath();x.ellipse(L/2,0,R*0.45*r,R*r,0,0,TAU);x.stroke();}
      x.fillStyle='#1a120a';x.beginPath();x.ellipse(-L/2,0,R*0.4,R*0.95,0,0,TAU);x.fill();
      if(Math.random()<0.45)for(let k=0;k<3;k++){const mx=rand(-L/3,L/4);x.fillStyle='#d8d0b8';x.fillRect(mx-0.8,-R-3,1.6,3);x.fillStyle=Math.random()<0.5?'#b05a2a':'#c8a060';x.beginPath();x.ellipse(mx,-R-3,2.6,1.6,0,Math.PI,TAU);x.fill();}
      x.restore();},
    // dark standing water in a muddy rim: deep middle, a pale sky streak, rings, a drifting leaf
    puddleD(x,cx,cy){const rx=rand(12,22),ry=rx*rand(0.45,0.65),rot=rand(-0.3,0.3);x.fillStyle='rgba(40,30,18,.55)';x.beginPath();x.ellipse(cx,cy,rx+3,ry+2.5,rot,0,TAU);x.fill();
      const g=x.createRadialGradient(cx,cy,1,cx,cy,rx);g.addColorStop(0,'rgba(4,8,8,.92)');g.addColorStop(1,'rgba(22,32,30,.85)');x.fillStyle=g;x.beginPath();x.ellipse(cx,cy,rx,ry,rot,0,TAU);x.fill();
      x.strokeStyle='rgba(170,200,195,.28)';x.lineWidth=1.4;x.beginPath();x.ellipse(cx-rx*0.25,cy-ry*0.3,rx*0.5,ry*0.3,rot,Math.PI*1.1,Math.PI*1.75);x.stroke();
      x.strokeStyle='rgba(170,200,195,.16)';x.lineWidth=0.8;const px=cx+rand(-rx/3,rx/3),py=cy+rand(-ry/3,ry/3);for(const r of [2.5,5.5])x.beginPath(),x.ellipse(px,py,r,r*0.5,0,0,TAU),x.stroke();
      if(Math.random()<0.4){x.fillStyle='rgba(120,100,40,.8)';x.beginPath();x.ellipse(cx+rand(-rx/2,rx/2),cy+rand(-ry/3,ry/3),2.6,1.3,rand(0,3),0,TAU);x.fill();}},
    // a cluster of ice crystals: faceted (lit and shaded halves), a cold glow, frost on the floor
    iceD(x,cx,cy){x.fillStyle='rgba(220,240,255,.22)';x.beginPath();x.ellipse(cx,cy+2,18,7,0,0,TAU);x.fill();glow(x,cx,cy-8,26,'rgba(160,220,255,.25)');
      const C=[];for(let k=0;k<randi(3,6);k++)C.push([cx+rand(-12,12),cy+rand(-3,5),rand(8,22),rand(3,5.5),rand(-0.35,0.35)]);C.sort((a,b)=>a[1]-b[1]);
      for(const [bx,by,h,w,t] of C){const tx=bx+t*h;x.fillStyle='rgba(150,200,240,.85)';x.beginPath();x.moveTo(bx-w,by);x.lineTo(tx,by-h);x.lineTo(bx,by+1);x.closePath();x.fill();
        x.fillStyle='rgba(90,140,200,.85)';x.beginPath();x.moveTo(bx,by+1);x.lineTo(tx,by-h);x.lineTo(bx+w,by);x.closePath();x.fill();
        x.strokeStyle='rgba(255,255,255,.75)';x.lineWidth=0.9;x.beginPath();x.moveTo(bx-w*0.4,by-1);x.lineTo(tx-0.5,by-h+2);x.stroke();dot(x,tx,by-h+1,1,'rgba(255,255,255,.9)');}},
    // v1.0.161: stalagmites and cave mushrooms (painted from Flare's cave tileset; drawn: rough cones, glowing caps)
    stalag(x,cx,cy,c){if(propArt(x,pick(['stalag1','stalag2','stalag3','stalag4']),cx,cy+6,0.7,Math.random()<0.5))return;shade(x,cx+3,cy+5,14,5);
      for(const [o,h,w] of [[-7,18,5],[0,30,7],[7,14,4]]){x.fillStyle=lin(x,cx+o-w,0,cx+o+w,0,c||'#6a5e50','#2a2420');x.beginPath();x.moveTo(cx+o-w,cy+4);x.lineTo(cx+o,cy+4-h);x.lineTo(cx+o+w,cy+4);x.closePath();x.fill();}},
    cshroom(x,cx,cy){if(propArt(x,pick(['cshroom1','cshroom2','cshroom3','cshroom4']),cx,cy+5,0.8,Math.random()<0.5))return;glow(x,cx,cy-6,20,'rgba(190,120,255,.25)');
      for(const [o,h,r] of [[-6,10,6],[4,14,7],[9,7,4]]){x.fillStyle='#d8d0e0';x.fillRect(cx+o-1.2,cy+3-h,2.4,h);x.fillStyle='#7a4aa8';x.beginPath();x.ellipse(cx+o,cy+3-h,r,r*0.55,0,Math.PI,TAU);x.fill();}},
    // v1.0.156: a stone tomb against the wall (painted: a jackal on the lid); drawn: a plain lidded stone box
    tomb(x,cx,cy,c){if(propArt(x,pick(['tomb1','tomb2','tomb3','tomb4']),cx,cy+6,0.8,Math.random()<0.5))return;shade(x,cx+3,cy+6,22,6,0.45);
      x.fillStyle=lin(x,0,cy-14,0,cy+6,c||'#5a5650','#24201c');x.fillRect(cx-20,cy-12,40,18);x.fillStyle=c?'#8a8478':'#6e685e';x.fillRect(cx-22,cy-17,44,6);x.fillStyle='rgba(0,0,0,.35)';x.fillRect(cx-14,cy-6,28,1.5);x.fillRect(cx-14,cy-1,28,1.5);},
    // v1.0.156: old stores left behind: barrels and crates, some broken open
    stores(x,cx,cy){const P=[['barrel',-12,2],['crate',10,-2],[pick(['barrel_broken','crate_open','barrel']),2,10]];let done=false;
      for(const [n,ox,oy] of P)if(propArt(x,n,cx+ox,cy+oy,0.9,Math.random()<0.5))done=true;if(done)return;
      for(const [ox,oy] of [[-10,0],[9,4]]){shade(x,cx+ox,cy+oy+10,11,4);x.fillStyle='#5a3a1e';x.beginPath();x.ellipse(cx+ox,cy+oy,10,12,0,0,TAU);x.fill();x.fillStyle='#3a3e44';x.fillRect(cx+ox-10,cy+oy-5,20,2);x.fillRect(cx+ox-10,cy+oy+4,20,2);}}};
  // Props per act: [kind, weight, against-a-wall]. Colours lean on each act's stone.
  const PROP_SET={
    crypt:[['grave',3,1],['tomb',1,1],['stores',1,0],['pillar',2,0],['candles',2,0],['bones',3,0],['ruin',1.5,0],['cage',1,1],['debris',2,0],['chains',1,0]],
    desert:[['ribs',2,0],['tomb',1,1],['bones',2,0],['pillar',2,0],['ruin',2,0],['tree',2,0],['debris',3,0]],
    marsh:[['tree',4,0],['log',3,0],['puddle',4,0],['bones',1.5,0],['grave',1,1],['debris',1,0]],
    citadel:[['pillar',3,0],['stores',1,0],['ice',3,0],['cage',1.5,1],['ruin',2,0],['debris',2,0],['bones',1,0]],
    ember:[['cage',2,1],['pillar',2,0],['debris',3,0],['bones',2,0],['chains',2,0],['ruin',1,0]],
    a1fields:[['grave',5,0],['tree',3,0],['bones',2,0],['candles',1,0],['debris',1,0]],a1gully:[['tree',3,0],['stores',1,0],['bones',3,0],['cage',2,1],['debris',3,0],['log',1,0]],
    a1ossuary:[['bones',6,0],['stalag',1.5,0],['tomb',1,1],['candles',2,0],['debris',2,0],['grave',1,1],['chains',1,0]],a1moor:[['tree',4,0],['log',3,0],['debris',2,0],['grave',1,0],['ruin',1,0]]};
  const PROP_COL={a1fields:'#5a5650',a1gully:'#6a5e50',a1ossuary:'#4a4440',a1moor:'#5a5448',crypt:'#5a5650',desert:'#8a7656',marsh:'#4a4a3a',citadel:'#7a8a9a',ember:'#3a2c28'};
  // ---- Act 1 zone themes (zones.js) ----
  const treeWall=(x,px,py,adj,h)=>{x.fillStyle=`hsl(${h},18%,4%)`;x.fillRect(px,py,TILE,TILE);if(!adj)return;
    for(let k=0;k<3;k++){const cx=px+rand(4,36),cy=py+rand(4,36),r=rand(10,16);dot(x,cx+3,cy+4,r,'rgba(0,0,0,.4)');dot(x,cx,cy,r,`hsl(${h+rand(-8,8)},${rand(14,22)}%,${rand(8,13)}%)`);dot(x,cx-r*0.3,cy-r*0.35,r*0.45,`hsla(${h},20%,20%,.5)`);}};
  const rockWall=(x,px,py,adj,h,s,l)=>{if(!adj){x.fillStyle=`hsl(${h},${s}%,${l*0.4}%)`;x.fillRect(px,py,TILE,TILE);return;}
    const b=(cx,cy,rx,ry,col)=>{x.fillStyle=col;x.beginPath();for(let k=0;k<9;k++){const a=k/9*TAU,r=rand(0.78,1.08);x.lineTo(cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r);}x.closePath();x.fill();};
    b(px+20,py+23,25,21,`hsl(${h},${s}%,${l*0.55}%)`);b(px+19,py+18,21,16,`hsl(${h},${s}%,${l}%)`);b(px+17,py+14,14,9,`hsl(${h},${s}%,${l*1.4}%)`);if(Math.random()<0.4)crack(x,px,py,'rgba(0,0,0,.45)');};
  THEMES.a1fields={void:'#040604',floor(x,px,py){x.fillStyle=`hsl(${92+Math.random()*10},14%,${13+Math.random()*1.5}%)`;x.fillRect(px,py,TILE,TILE);
      for(let k=0;k<6;k++){x.strokeStyle=`hsla(${80+rand(0,30)},22%,${rand(18,26)}%,.6)`;x.lineWidth=1;const bx=px+rand(2,38),by=py+rand(4,38);x.beginPath();x.moveTo(bx,by);x.lineTo(bx+rand(-2,2),by-rand(3,6));x.stroke();}
      if(Math.random()<0.2)dot(x,px+rand(6,34),py+rand(6,34),rand(5,10),'rgba(60,45,30,.25)');},
    wall(x,px,py,below,adj){treeWall(x,px,py,adj,110);},
    deco(x,px,py){const r=Math.random();if(r<0.025){x.strokeStyle='#8a8478';x.lineWidth=2.4;const cx=px+20,cy=py+24;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx,cy-14);x.moveTo(cx-5,cy-10);x.lineTo(cx+5,cy-10);x.stroke();}}};
  THEMES.a1gully={void:'#060403',floor(x,px,py){x.fillStyle=`hsl(28,${12+Math.random()*3}%,${14+Math.random()*1.5}%)`;x.fillRect(px,py,TILE,TILE);
      for(let k=0;k<5;k++)dot(x,px+rand(2,38),py+rand(2,38),rand(0.8,2),Math.random()<0.6?'rgba(0,0,0,.25)':'rgba(200,180,150,.12)');if(Math.random()<0.1)crack(x,px,py,'rgba(0,0,0,.35)');},
    wall(x,px,py,below,adj){rockWall(x,px,py,adj,26,8,20);},
    deco(x,px,py){if(Math.random()<0.02){x.strokeStyle='#3a2a1a';x.lineWidth=3;const bx=px+20,by=py+30;x.beginPath();x.moveTo(bx,by);x.lineTo(bx,by-22);x.lineTo(bx+10,by-22);x.stroke();x.strokeStyle='#8a7050';x.lineWidth=1;x.beginPath();x.moveTo(bx+9,by-22);x.lineTo(bx+9,by-12);x.stroke();}}};
  THEMES.a1ossuary={void:'#030202',floor(x,px,py){x.fillStyle=`hsl(30,${5+Math.random()*3}%,${10+Math.random()*1.5}%)`;x.fillRect(px,py,TILE,TILE);
      for(let k=0;k<3;k++){if(Math.random()<0.5){x.strokeStyle='rgba(210,200,175,.35)';x.lineWidth=1.6;const bx=px+rand(4,36),by=py+rand(4,36),a=rand(0,3);x.beginPath();x.moveTo(bx,by);x.lineTo(bx+Math.cos(a)*6,by+Math.sin(a)*6);x.stroke();}}},
    wall(x,px,py,below,adj){rockWall(x,px,py,adj,32,6,13);if(adj&&Math.random()<0.12){dot(x,px+20,py+18,4.5,'#c8bca0');dot(x,px+18.5,py+17.5,1.1,'#100c08');dot(x,px+21.5,py+17.5,1.1,'#100c08');}},
    deco(x,px,py){if(Math.random()<0.03){for(let k=0;k<4;k++){x.strokeStyle='#b8ae94';x.lineWidth=1.8;const bx=px+rand(8,32),by=py+rand(8,32),a=rand(0,3);x.beginPath();x.moveTo(bx,by);x.lineTo(bx+Math.cos(a)*8,by+Math.sin(a)*8);x.stroke();}}}};
  THEMES.a1moor={void:'#040504',floor(x,px,py,i,j){const rd=G.road&&G.road[j*MW+i];
      if(rd){x.fillStyle=`hsl(32,${16+Math.random()*3}%,${17+Math.random()*2}%)`;x.fillRect(px,py,TILE,TILE);for(let k=0;k<6;k++)dot(x,px+rand(2,38),py+rand(2,38),rand(0.8,2),Math.random()<0.6?'rgba(0,0,0,.25)':'rgba(220,200,160,.12)');
        x.strokeStyle='rgba(0,0,0,.18)';x.lineWidth=2;x.beginPath();x.moveTo(px,py+14);x.lineTo(px+TILE,py+14+rand(-2,2));x.moveTo(px,py+28);x.lineTo(px+TILE,py+28+rand(-2,2));x.stroke();}
      else{x.fillStyle=`hsl(${78+Math.random()*12},13%,${13+Math.random()*1.5}%)`;x.fillRect(px,py,TILE,TILE);for(let k=0;k<5;k++){x.strokeStyle=`hsla(70,20%,${rand(18,26)}%,.6)`;x.lineWidth=1;const bx=px+rand(2,38),by=py+rand(4,38);x.beginPath();x.moveTo(bx,by);x.lineTo(bx+rand(-2,2),by-rand(3,6));x.stroke();}}},
    wall(x,px,py,below,adj){treeWall(x,px,py,adj,95);},
    deco(x,px,py){if(Math.random()<0.01){x.fillStyle='#2a2018';x.fillRect(px+18,py+8,3,24);dot(x,px+19.5,py+8,4,'rgba(255,200,110,.7)');addLight(px+19.5,py+8,110,0.55,'255,190,100',0.25,1);}}};
  THEMES._props=(x,gen,at,rooms)=>{const S=PROP_SET[gen];if(!S||!rooms)return;const tot=S.reduce((a,s)=>a+s[1],0),c=PROP_COL[gen],taken=new Set();
    for(const r of rooms){const n=Math.round(r.w*r.h/16*rand(0.7,1.3));
      for(let k=0;k<n;k++){let w=Math.random()*tot,P=S[0];for(const s of S){w-=s[1];if(w<0){P=s;break;}}
        let i,j,ok=false;for(let t=0;t<8&&!ok;t++){i=r.x+randi(0,r.w-1);j=r.y+randi(0,r.h-1);if(P[2]){for(let jj=j;jj>=r.y-1;jj--)if(at(i,jj-1)===1){j=jj;break;}}ok=at(i,j)===0&&!taken.has(j*MW+i)&&(!P[2]||at(i,j-1)===1);}
        if(!ok)continue;taken.add(j*MW+i);const cx=i*TILE+20+rand(-5,5),cy=j*TILE+(P[2]?26:20)+rand(-5,5);
        standProp(x,cx,cy+2,[cx-60,cy-110,cx+60,cy+34],x=>{if(P[0]==='cage')PR.cage(x,cx,cy,gen==='ember');else if(P[0]==='tree')PR.tree(x,cx,cy,gen==='desert'?'#3a2a1a':'#20180e');else PR[P[0]](x,cx,cy,c,gen);});}}};
  // Floor detail across many tiles: roots in the marsh, wind ripples in the sand, long cracks in stone.
  THEMES._floorDetail=(x,gen,at)=>{gen=THEMES[gen]&&THEMES[gen].detail||gen;const N=gen==='marsh'?60:gen==='desert'?50:35;
    for(let k=0;k<N;k++){const i=randi(1,MW-2),j=randi(1,MH-2);if(at(i,j)!==0)continue;let px=i*TILE+rand(0,TILE),py=j*TILE+rand(0,TILE),a=rand(0,TAU);
      if(gen==='marsh'){x.strokeStyle='rgba(30,22,12,.85)';for(let b=0;b<3;b++){let qx=px,qy=py,aa=a+b*2.1,w=3;x.lineCap='round';for(let s=0;s<6;s++){aa+=rand(-0.5,0.5);const nx=qx+Math.cos(aa)*12,ny=qy+Math.sin(aa)*12;if(at(Math.floor(nx/TILE),Math.floor(ny/TILE))!==0)break;x.lineWidth=w;x.beginPath();x.moveTo(qx,qy);x.lineTo(nx,ny);x.stroke();
          x.strokeStyle='rgba(120,100,70,.18)';x.lineWidth=w*0.35;x.stroke();x.strokeStyle='rgba(30,22,12,.85)';qx=nx;qy=ny;w*=0.82;}}x.lineCap='butt';}
      else if(gen==='desert'){x.strokeStyle='rgba(255,225,180,.08)';x.lineWidth=1.5;for(let b=0;b<4;b++){x.beginPath();x.arc(px,py+b*6,40,Math.PI*1.25,Math.PI*1.75);x.stroke();}x.strokeStyle='rgba(0,0,0,.1)';for(let b=0;b<4;b++){x.beginPath();x.arc(px,py+b*6+2,40,Math.PI*1.25,Math.PI*1.75);x.stroke();}}
      else{const col=gen==='ember'?'rgba(255,90,20,.5)':gen==='citadel'?'rgba(200,235,255,.15)':'rgba(0,0,0,.45)';x.strokeStyle=col;x.lineWidth=1.2;x.beginPath();x.moveTo(px,py);for(let s=0;s<7;s++){a+=rand(-0.6,0.6);px+=Math.cos(a)*rand(6,12);py+=Math.sin(a)*rand(6,12);if(at(Math.floor(px/TILE),Math.floor(py/TILE))!==0)break;x.lineTo(px,py);}x.stroke();}}};
  // Walls with depth: the rim of a wall's top lit where it meets open floor, a darker inner top, and a soft
  // shadow down the side faces; drawn over the themes' own walls.
  THEMES._wallDepth=(x,gen,at)=>{if(THEMES[gen]&&THEMES[gen].flat)return;gen=THEMES[gen]&&THEMES[gen].detail||gen;if(['desert','marsh','a1fields','a1moor','a1gully','a1ossuary'].includes(gen))return;const lit=gen==='citadel'?'rgba(225,240,255,.22)':gen==='ember'?'rgba(255,110,40,.18)':'rgba(220,210,190,.14)';
    for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){if(at(i,j)!==1)continue;const px=i*TILE,py=j*TILE,n=at(i,j-1)!==1,s=at(i,j+1)!==1,w=at(i-1,j)!==1,e=at(i+1,j)!==1;if(!(n||s||w||e))continue;
      const top=s?TILE-15:TILE; // the face (if any) is the bottom 15px
      x.fillStyle='rgba(255,255,255,.025)';x.fillRect(px+3,py+3,TILE-6,top-6);
      x.fillStyle=lit;if(s)x.fillRect(px,py+top-2,TILE,2);if(n)x.fillRect(px,py,TILE,2);if(w)x.fillRect(px,py,2,top);if(e)x.fillRect(px+TILE-2,py,2,top);
      if(w){x.fillStyle=lin(x,px,0,px+8,0,'rgba(0,0,0,.45)','rgba(0,0,0,0)');x.fillRect(px-8,py,8,TILE);}if(e){x.fillStyle=lin(x,px+TILE+8,0,px+TILE,0,'rgba(0,0,0,.45)','rgba(0,0,0,0)');x.fillRect(px+TILE,py,8,TILE);}}};
  THEMES._h={glow,dot,crack,face,slabs,stone,treeWall,rockWall,PR,PROP_SET,PROP_COL,shade,lin}; // acts.js builds the zone themes of Acts 2-5 from these
}
// Light sources baked with the map (light.js lights them every frame): {x, y, r, i, rgb, g, fl: flickers, torch: draw a flame}.
function addLight(x,y,r,i,rgb,g,fl,torch){const L=G.lights||(G.lights=[]);if(L.some(l=>l.x===x&&l.y===y&&l.r===r))return; /* a standing prop painted again (propart.js) keeps one light */L.push({x,y,r,i,rgb,g,fl:!!fl,torch:!!torch});}
// Wall torches along wall faces in the dungeon, at least 6 tiles apart: iron sconces in stone, wooden stakes in rock and brush.
const TORCH_RGB={a1fields:'255,170,90',a1gully:'255,170,90',a1ossuary:'255,160,80',a1moor:'255,180,100',crypt:'255,165,85',desert:'255,180,100',marsh:'245,195,105',citadel:'255,160,80',ember:'255,110,40'};
function placeTorches(x,gen,at,adjFloor){const TH=THEMES[gen]||{},rgb=TH.torch||TORCH_RGB[gen];if(!rgb||TH.torch===null)return;gen=TH.detail||gen;const C=[],picked=[];
  for(let j=1;j<MH-1;j++)for(let i=1;i<MW-1;i++)if(at(i,j)===1&&at(i,j+1)===0&&adjFloor(i,j))C.push([i,j]);
  C.sort(()=>Math.random()-0.5);
  for(const [i,j] of C){if(picked.length>=46)break;if(picked.some(([a,b])=>Math.max(Math.abs(a-i),Math.abs(b-j))<6))continue;picked.push([i,j]);
    const px=i*TILE+20,py=(j+1)*TILE,wood=gen==='desert'||gen==='marsh';
    if(wood){x.fillStyle='#2a1c10';x.fillRect(px-2,py-16,4,18);x.fillStyle='#4a3420';x.fillRect(px-1,py-16,1.5,18);x.fillStyle='#1a120a';x.fillRect(px-4,py-14,8,4);}
    else{x.fillStyle='#14100d';x.fillRect(px-4,py-15,8,10);x.fillStyle='#2c2621';x.beginPath();x.moveTo(px-6,py-12);x.lineTo(px+6,py-12);x.lineTo(px+3,py-6);x.lineTo(px-3,py-6);x.closePath();x.fill();
      x.fillStyle='rgba(255,190,120,.35)';x.fillRect(px-5,py-12,10,1);x.fillStyle='rgba(0,0,0,.5)';x.fillRect(px-3,py-5,6,2);}
    addLight(px,py-15,240,0.88,rgb,0.34,1,1);}
  // standing iron braziers in the corners of larger rooms
  for(const r of G.rooms||[]){if(r.w<8||r.h<7||Math.random()<0.45)continue;
    for(const [ci,cj] of [[r.x+1,r.y+1],[r.x+r.w-2,r.y+r.h-2],[r.x+r.w-2,r.y+1],[r.x+1,r.y+r.h-2]].sort(()=>Math.random()-0.5).slice(0,Math.random()<0.5?1:2)){
      if(at(ci,cj)!==0)continue;const bx=ci*TILE+20,by=cj*TILE+24;
      standProp(x,bx,by+10-0.1,[bx-30,by-30,bx+30,by+24],x=>{ // its flame (light.js drawTorch) comes right after it
      if(propArt(x,'firebowl',bx,by+11,0.8))return; /* propart.js: an iron fire bowl */
      x.fillStyle='rgba(0,0,0,.45)';x.beginPath();x.ellipse(bx,by+10,14,5,0,0,TAU);x.fill();
      x.strokeStyle='#17120e';x.lineWidth=2.2;x.beginPath();for(const a of [-0.9,0,0.9]){x.moveTo(bx+Math.sin(a)*5,by-2);x.lineTo(bx+Math.sin(a)*12,by+10);}x.stroke();
      x.fillStyle='#231c16';x.beginPath();x.ellipse(bx,by-3,11,5,0,0,TAU);x.fill();x.fillStyle='#3a2e24';x.beginPath();x.ellipse(bx,by-5,11,4,0,0,TAU);x.fill();
      x.fillStyle='#120804';x.beginPath();x.ellipse(bx,by-5,8.5,2.8,0,0,TAU);x.fill();x.fillStyle='rgba(255,140,50,.8)';for(let k=0;k<5;k++)x.fillRect(bx+rand(-6,5),by-6+rand(-1,1),1.6,1.4);});
      G.lights.push({x:bx,y:by-9,r:300,i:0.92,rgb,g:0.4,fl:true,torch:true,big:true});}}}
// ---------- grit and grade (once per map) ----------
// Tileable value noise (several octaves), built once: light greys that a 'multiply' pass turns into grime.
let GRIME=null;
function grimeTex(){if(GRIME)return GRIME;const S=256,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),img=x.createImageData(S,S),v=new Float32Array(S*S);
  for(const [cell,amp] of [[64,0.5],[32,0.28],[16,0.14],[4,0.08]]){const n=S/cell,R=new Float32Array(n*n).map(()=>Math.random());
    for(let j=0;j<S;j++)for(let i=0;i<S;i++){const fx=i/cell,fy=j/cell,ix=fx|0,iy=fy|0,tx=fx-ix,ty=fy-iy,sx=tx*tx*(3-2*tx),sy=ty*ty*(3-2*ty),a=R[iy%n*n+ix%n],b=R[iy%n*n+(ix+1)%n],cc=R[(iy+1)%n*n+ix%n],d=R[(iy+1)%n*n+(ix+1)%n];
      v[j*S+i]+=amp*(a+(b-a)*sx+(cc-a)*sy+(a-b-cc+d)*sx*sy);}}
  for(let k=0;k<S*S;k++){const g=Math.round(255-Math.pow(Math.max(0,v[k]-0.3)/0.7,1.6)*140);img.data[k*4]=g;img.data[k*4+1]=g*0.97|0;img.data[k*4+2]=g*0.93|0;img.data[k*4+3]=255;}
  x.putImageData(img,0,0);return GRIME=c;}
// Shadow strips cast by walls onto the floor beside them, pre-drawn once per side.
let AO=null;
function aoStrips(){if(AO)return AO;AO={};const D=16;
  for(const [k,w,h,x0,y0,x1,y1,a] of [['n',TILE,D,0,0,0,D,0.55],['s',TILE,D,0,D,0,0,0.3],['w',D,TILE,0,0,D,0,0.42],['e',D,TILE,D,0,0,0,0.42]]){
    const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),g=x.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,`rgba(0,0,0,${a})`);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,w,h);AO[k]=c;}
  return AO;}
// Grime over everything, wall shadows on the floor, grit and old stains along the walls, a few dark splashes.
function wearMap(x,at){const W=MW*TILE,H=MH*TILE,A=aoStrips();
  x.save();x.globalCompositeOperation='multiply';x.fillStyle=x.createPattern(grimeTex(),'repeat');x.fillRect(0,0,W,H);
  x.setTransform(3.1,0,0,3.1,0,0);x.globalAlpha=0.55;x.fillRect(0,0,W/3.1,H/3.1);x.restore();
  for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){if(at(i,j)!==0)continue;const px=i*TILE,py=j*TILE;
    if(at(i,j-1)===1)x.drawImage(A.n,px,py);if(at(i,j+1)===1)x.drawImage(A.s,px,py+TILE-16);if(at(i-1,j)===1)x.drawImage(A.w,px,py);if(at(i+1,j)===1)x.drawImage(A.e,px+TILE-16,py);
    if((at(i,j-1)===1||at(i-1,j)===1||at(i+1,j)===1)&&Math.random()<0.5)for(let k=0;k<5;k++){x.fillStyle=Math.random()<0.5?'rgba(0,0,0,.35)':'rgba(190,175,150,.12)';x.beginPath();x.arc(px+rand(2,38),py+rand(2,14),rand(0.7,2),0,TAU);x.fill();}
    if(Math.random()<0.02){const cx=px+rand(8,32),cy=py+rand(8,32),r=rand(8,18);x.fillStyle=Math.random()<0.4?'rgba(60,8,4,.22)':'rgba(0,0,0,.2)';
      x.beginPath();x.ellipse(cx,cy,r,r*rand(0.5,0.9),rand(0,3),0,TAU);x.fill();for(let k=0;k<4;k++){x.beginPath();x.arc(cx+rand(-r*1.6,r*1.6),cy+rand(-r*1.2,r*1.2),rand(1,3),0,TAU);x.fill();}}}}
// Pull the colour toward earthy, muted tones: drain some saturation, then a faint tone wash. [desaturate, tone]
// Each act has its own grade: sickly green crypt ruins, warm dusty desert, cold blue swamp, pale frozen steel, scorched red core.
const GRADE={a1fields:[0.42,'#c8d0b4'],a1gully:[0.4,'#d0ccb8'],a1ossuary:[0.42,'#c8ccb8'],a1moor:[0.4,'#ccd0b4'],crypt:[0.42,'#c8d0b4'],desert:[0.3,'#ecd2a4'],marsh:[0.4,'#b4c4cc'],citadel:[0.38,'#c4d0e0'],ember:[0.25,'#e4bcac'],town:[0.22,'#ecd8bc']};
function gradeMap(x,k){const [d,tone]=GRADE[k]||THEMES[k]&&THEMES[k].grade||GRADE.town,W=MW*TILE,H=MH*TILE;x.save();
  x.globalCompositeOperation='saturation';x.globalAlpha=d;x.fillStyle='#808080';x.fillRect(0,0,W,H);
  x.globalCompositeOperation='multiply';x.globalAlpha=1;x.fillStyle=tone;x.fillRect(0,0,W,H);x.restore();}
// Painting uses its own random numbers (seeded by one draw), so art changes never shift gameplay randomness.
const artRng=seed=>()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
// v1.0.135: standing things (props, braziers, town houses, trees, posts) get their own small canvases instead of the
// floor, so the angled camera (render.js) can stand them upright and draw them back to front with the figures.
// box = [left, top, right, bottom] in world units around the art. v1.0.137: each is painted only when it first comes
// on screen (a few per frame, render.js drawStand), with its own art seed, so opening a town (about 300 of them) no
// longer freezes the game.
let STAND=null; // the list they go into while a map is painted (null: paint straight into the floor)
function standProp(x,fx,fy,box,fn){if(!STAND){fn(x);return;}
  const l=Math.floor(box[0]),t=Math.floor(box[1]);STAND.push({cv:null,fn,seed:Math.random()*4294967296|0,x:l,y:t,w:Math.ceil(box[2])-l,h:Math.ceil(box[3])-t,fx,fy});}
// Paint one now, with the same colour grade as the floor (gradeMap), kept inside its own shape (one shared mask canvas).
let STAND_MASK=null;
function paintStand(s,grade){const c=mkCanvas(s.w,s.h),x=c.getContext('2d'),R0=Math.random;x.translate(-s.x,-s.y);
  Math.random=artRng(s.seed);try{s.fn(x);}finally{Math.random=R0;}s.cv=c; /* fn kept: propart.js paints again with the props sheet */
  const [d,tone]=GRADE[grade]||THEMES[grade]&&THEMES[grade].grade||GRADE.town;
  if(!STAND_MASK)STAND_MASK=mkCanvas(s.w,s.h);else if(STAND_MASK.width<s.w||STAND_MASK.height<s.h){STAND_MASK.width=Math.max(STAND_MASK.width,s.w);STAND_MASK.height=Math.max(STAND_MASK.height,s.h);}
  const M=STAND_MASK.getContext('2d');M.setTransform(1,0,0,1,0,0);M.clearRect(0,0,s.w,s.h);M.drawImage(c,0,0);
  x.setTransform(1,0,0,1,0,0);x.globalCompositeOperation='saturation';x.globalAlpha=d;x.fillStyle='#808080';x.fillRect(0,0,s.w,s.h);
  x.globalCompositeOperation='multiply';x.globalAlpha=1;x.fillStyle=tone;x.fillRect(0,0,s.w,s.h);
  x.globalCompositeOperation='destination-in';x.drawImage(STAND_MASK,0,0,s.w,s.h,0,0,s.w,s.h);x.globalCompositeOperation='source-over';}
function renderMap(seed){const R0=Math.random;G.artSeed=seed??(R0()*4294967296|0);Math.random=artRng(G.artSeed); /* the seed is kept: portal.js repaints a kept zone the same */try{paintMap();}finally{Math.random=R0;STAND=null;}}
function paintMap(){
  G.lights=[];G.splats=[];sprClear(); // new map, new creatures: drop the old sprites
  const cv=document.createElement('canvas');cv.width=MW*TILE;cv.height=MH*TILE;const x=cv.getContext('2d');G.stand=STAND=[];
  const gen=G.inTown?'town'+actIdx(G.depth):(G.zoneTheme||ACTS[actIdx(G.depth)].gen),TH=THEMES[gen]||THEMES[ACTS[actIdx(G.depth)].gen],g=G.grid,T=G.terrain; /* zones.js: each zone has its own theme */
  const at=(i,j)=>i<0||j<0||i>=MW||j>=MH?1:g[j*MW+i];
  const adjFloor=(i,j)=>{for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++)if(at(i+a,j+b)===0)return true;return false;};
  x.fillStyle=TH.void;x.fillRect(0,0,cv.width,cv.height);
  // pass 1: floor, terrain and void tiles
  for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){const k=j*MW+i,v=g[k],px=i*TILE,py=j*TILE;
    if(v===0){if(T[k]===T_BRIDGE&&TH.bridge)TH.bridge(x,px,py,i,j,at);else if(T[k]===T_POISON&&TH.poison)TH.poison(x,px,py);else if(T[k]===T_LAVA&&TH.lava)TH.lava(x,px,py);else TH.floor(x,px,py,i,j);}
    else if(v===2&&TH.voidT)TH.voidT(x,px,py,i,j,at);}
  // pass 2: walls (may overhang floor for organic shapes) and decorations
  for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){const k=j*MW+i,v=g[k],px=i*TILE,py=j*TILE;
    if(v===1)TH.wall(x,px,py,at(i,j+1)===0,adjFloor(i,j),i,j);
    else if(v===0&&T[k]===0&&TH.deco)TH.deco(x,px,py,{up:at(i,j-1)===1,left:at(i-1,j)===1});}
  if(TH.rooms&&G.rooms)TH.rooms(x,G.rooms);
  if(!G.inTown){THEMES._floorDetail(x,gen,at);THEMES._wallDepth(x,gen,at);THEMES._props(x,gen,at,G.rooms);} // stage 5: floor detail, wall depth, props
  wearMap(x,at);gradeMap(x,G.inTown?'town':gen);
  if(!G.inTown)placeTorches(x,gen,at,adjFloor);
  STAND=null;G.stand.grade=G.inTown?'town':gen;
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
