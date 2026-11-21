'use strict';
// Acts as chains of named zones (PoE2 style). Act 1 is defined here, Acts 2-5 in acts.js. Each act: town → 4 zones → the act boss's own zone, plus 2
// optional side zones. Each zone has one layout style (fields, canyon, caves, ruins, roads), freshly randomised on
// every visit; a zone boss; 1-2 named champions ("super uniques"); points of interest (shrines, a hidden chest, an
// event, a waypoint); and a locked exit that opens on an objective (kill the zone boss, find the key, light the seals).
// Town quests per act give skill points, potion charges and uniques.
// Scaling still runs on the depth number: Act 1 zone n is depth n (side zones use their parent's), so monster levels,
// loot tiers and area levels rise zone by zone. Endless depths (26+) keep the older depth chain.
// Character state: c.zone (last zone), c.wps (unlocked waypoints), c.zst[zone] ({boss, key, seals}), c.q[quest].
const ZONES={
  a1z1:{act:1,depth:1,name:'The Mourning Fields',sub:'Gravewatch buries here the dead it cannot name',layout:'fields',theme:'a1fields',
    next:'a1z2',side:'a1s2',gate:'boss',boss:'grieve',su:['hollis','bride'],density:0.9,elite:0.1}, /* the first zone: gentler */
  a1z2:{act:1,depth:2,name:'Gallows Gully',sub:'The road out of Gravewatch, and the trees that line it',layout:'canyon',theme:'a1gully',
    next:'a1z3',side:'a1s1',gate:'key',key:'Gully Key',boss:'hangman',su:['brann','jack'],density:1.25},
  a1z3:{act:1,depth:3,name:'The Ossuary Tunnels',sub:'Bones stacked to the ceiling, and some of them move',layout:'caves',theme:'a1ossuary',
    next:'a1z4',gate:'seals',boss:'weaver',su:['skitter','knuckles'],density:1.35},
  a1z4:{act:1,depth:4,name:'Chapel of Ash',sub:'The last prayers here were burned, not spoken',layout:'ruins',theme:'crypt',
    next:'a1z5',gate:'boss',boss:'abbess',su:['calix','penitent'],density:1.45},
  a1z5:{act:1,depth:5,name:"Varrok's Sepulchre",sub:'The Hollow Lord waits below',layout:'boss',next:null,gate:'actboss'},
  a1s2:{act:1,depth:1,name:'Lantern Road',sub:'Pilgrims walked it once, lamps in hand',layout:'roads',theme:'a1moor',parent:'a1z1',
    gate:'none',boss:'lamplighter',su:['moll'],density:1.2,captive:'pilgrim'},
  a1s1:{act:1,depth:2,name:'The Sunken Barrow',sub:'An old king sleeps badly beneath the gully',layout:'caves',theme:'a1ossuary',parent:'a1z2',
    gate:'none',boss:'wight',su:['pell'],density:1.3,hoard:1}
};
const ACT1_MAIN=['a1z1','a1z2','a1z3','a1z4','a1z5'],ACT1_SIDE=['a1s2','a1s1'];
// An act's chain (main zones by depth) and its side zones; acts.js adds Acts 2-5. Acts without zones keep the depth chain.
const actZones=a=>Object.keys(ZONES).filter(z=>ZONES[z].act===a&&!ZONES[z].parent).sort((x,y)=>ZONES[x].depth-ZONES[y].depth);
const actSides=a=>Object.keys(ZONES).filter(z=>ZONES[z].act===a&&ZONES[z].parent);
const zoneOfDepth=d=>d>=1&&d<=25?actZones(actIdx(d)+1)[stageOf(d)-1]||null:null;
const zst=(c,z)=>{const S=c.zst||(c.zst={});return S[z]||(S[z]={});};
const hasWp=(c,z)=>(c.wps||[]).includes(z);
// Old saves: zones up to the deepest depth reached count as waypointed.
function migrateZones(c){if(!Array.isArray(c.wps))c.wps=[];if(!c.zst||typeof c.zst!=='object')c.zst={};if(!c.q||typeof c.q!=='object')c.q={};
  for(let d=1;d<Math.min(26,c.maxDepth||1);d++){const z=zoneOfDepth(d);if(z&&!c.wps.includes(z))c.wps.push(z);}}
// ---------- zone bosses and champions ----------
// Zone bosses: a base look, life x hp, damage x dmg, and 2 mechanics (ZB_MOVES) on top of a heavy melee swing.
const ZBOSS={
  grieve:{name:'Old Grieve, the Gravedigger',r:30,hp:0.6,dmg:0.8,spd:72, /* the first boss you meet: gentler */moves:['coffin','corpses'],quest:'a1q1'},
  hangman:{name:'The Hangman',r:26,hp:1.1,dmg:1.05,spd:80,moves:['hook','noose']},
  weaver:{name:'The Bone Weaver',r:30,hp:1.2,dmg:1.05,spd:68,moves:['spiral','bonecage']},
  abbess:{name:'Abbess Morwen',r:24,hp:0.55,dmg:1.1,spd:64,moves:['pyres','mend'],ranged:1},
  lamplighter:{name:'The Lamplighter',r:26,hp:1.05,dmg:1,spd:70,moves:['lanterns','pyres']},
  wight:{name:'The Barrow Wight',r:28,hp:1.35,dmg:1.1,spd:74,moves:['chill','corpses'],quest:'a1q3'}
};
// Champions: a base monster type, fixed elite modifiers, more life and loot.
const SUPERU={
  hollis:{name:'Mad Hollis',base:'grunt',affs:['fast','vampiric']},bride:{name:'The Weeping Bride',base:'archer',affs:['shielded']},
  brann:{name:'Crow-Eater Brann',base:'brute',affs:['explodes']},jack:{name:'Rattle Jack',base:'archer',affs:['fast']},
  skitter:{name:'Skitter Queen',base:'grunt',affs:['fast','summoner']},knuckles:{name:'Knuckles',base:'brute',affs:['vampiric','shielded']},
  calix:{name:'Brother Calix',base:'archer',affs:['explodes','shielded']},penitent:{name:'The Penitent',base:'brute',affs:['fast','vampiric']},
  moll:{name:'Old Moll',base:'brute',affs:['shielded']},pell:{name:'Grave-Robber Pell',base:'grunt',affs:['fast','explodes']}
};
ETYPES.zboss={name:'Zone Boss',r:28,hp:850,dmg:9,spd:70,range:26,cd:1.6,xp:90,col:'#7a6a5a',ai:'zboss',drop:1,heavy:1,shape:'zboss'};
ETYPES.nest={name:'Monster Nest',r:24,hp:70,dmg:0,spd:0,range:0,cd:4,xp:30,col:'#5a4a3a',ai:'nest',drop:0.6,shape:'nest'};
function makeZoneBoss(id,x,y,depth){const B=ZBOSS[id],e=makeEnemy('zboss',x,y,depth,false,'zb-'+id,null);
  e.zb=id;e.kind=id;e.name=B.name;e.r=B.r;e.hp=e.maxHp=e.maxHp*B.hp;e.dmg*=B.dmg;e.spd=B.spd;e.cd=2;return e;}
function makeSuper(id,x,y,depth,pack){const S=SUPERU[id],e=makeEnemy(S.base,x,y,depth,true,pack,S.affs.slice());
  e.su=id;e.name=S.name;e.hp=e.maxHp=e.maxHp*(S.hp||2.2);e.dmg*=1.15;e.r+=2;return e;}
// Zone boss mechanics: telegraphed with the same red/orange markers as act bosses.
const ZB_MOVES={
  coffin(e){const a=Math.atan2(G.p.y-e.y,G.p.x-e.x);e.busy=1.1;lineStrike(e,e.x,e.y,a,330,52,0.95,e.dmg*2.2,'#c8a878');},
  corpses(e){e.busy=0.9;for(let i=0;i<3;i++)bossLater(e,i*0.25,()=>{const [x,y]=i?near(120):[G.p.x,G.p.y];groundStrike(e,x,y,58,1,e.dmg*1.3,'#9ab0d8',()=>burst(x,y,14,'#6a5a4a',160));});bossLater(e,0.8,()=>bossSummon(e,'grunt',2,5));},
  hook(e){const a=Math.atan2(G.p.y-e.y,G.p.x-e.x);e.busy=1.2;G.fx.push({type:'tline',x:e.x,y:e.y,a,len:360,w:40,t:0,max:0.9,col:'#8a7a62'});
    bossLater(e,0.9,()=>{const p=G.p,dx=p.x-e.x,dy=p.y-e.y,al=dx*Math.cos(a)+dy*Math.sin(a),pe=Math.abs(-dx*Math.sin(a)+dy*Math.cos(a));
      if(al>0&&al<360+p.r&&pe<20+p.r&&dmgPlayer(e.dmg*1.4,e)){const k=Math.max(0,al-e.r-p.r-10);moveEnt(p,-Math.cos(a)*k,-Math.sin(a)*k);G.shake=Math.max(G.shake,8);floatText(p.x,p.y-30,'Hooked!','#e8a060',false);}});},
  noose(e){e.busy=0.6;for(let i=0;i<3;i++)bossLater(e,i*0.3,()=>groundStrike(e,G.p.x+rand(-20,20),G.p.y+rand(-20,20),55,0.85,e.dmg*1.5,'#8a7a62'));},
  spiral(e){const off=rand(0,TAU);e.busy=1.6;for(let i=0;i<16;i++)bossLater(e,i*0.09,()=>{for(let a=0;a<2;a++)enemyShoot(e,off+i*0.4+a*Math.PI,200,'#e8e0c0',e.dmg*0.6,6);});},
  bonecage(e){e.busy=0.8;const p=G.p;for(let k=0;k<6;k++){const a=k/6*TAU,x=p.x+Math.cos(a)*95,y=p.y+Math.sin(a)*95;groundStrike(e,x,y,48,1.1,e.dmg*1.2,'#e8e0c0');}groundStrike(e,p.x,p.y,40,1.5,e.dmg*1.6,'#e8e0c0');},
  pyres(e){e.busy=0.7;for(let i=0;i<4;i++)bossLater(e,i*0.2,()=>{const [x,y]=i?near(140):[G.p.x,G.p.y];groundStrike(e,x,y,60,1,e.dmg*1.2,'#ff8a3a',()=>addEHaz(x,y,48,4,e.dmg*0.35,'fire'));});},
  mend(e){e.busy=1.4;e.wind=1.2;e.tele={r:200,col:'#9fe08a'};e.act=()=>{for(const o of G.enemies)if(!o.dead&&Math.hypot(o.x-e.x,o.y-e.y)<220){o.hp=Math.min(o.maxHp,o.hp+o.maxHp*0.12);burst(o.x,o.y,8,'#9fe08a',90);}
    floatText(e.x,e.y-e.r-20,'Mended','#9fe08a',false);G.fx.push({type:'ring',x:e.x,y:e.y,r0:20,r1:220,t:0,max:0.5,col:'#9fe08a'});};},
  lanterns(e){e.busy=1;ring(e,10,140,'#ffcc66',e.dmg*0.7,8,rand(0,TAU));bossLater(e,0.5,()=>ring(e,10,140,'#ffcc66',e.dmg*0.7,8,rand(0,TAU)));},
  chill(e){e.busy=0.7;ring(e,16,190,'#bfe8ff',e.dmg*0.6,6,rand(0,TAU),0,{slow:0.4});}
};
AI.zboss=(e,T,d,toP,step,chase,cdm)=>{const B=ZBOSS[e.zb];if(e.busy>0)return;
  if(e.cd<=0&&d<520){const m=B.moves[e.mv=(e.mv||0)+1&1];ZB_MOVES[m](e);e.cd=2.6*cdm;return;}
  if(B.ranged&&d<180){step(toP+Math.PI,0.7);return;}
  if(d>e.r+G.p.r+24)chase();else if(!(e.swing>0)){e.wind=0.5;e.act=null;e.swing=1;bossLater(e,1.2,()=>{e.swing=0;});}};
AI.nest=(e,T,d,toP,step,chase,cdm,dt)=>{e.face+=0.01;e.spawnCd=(e.spawnCd??2)-(dt||0.033);if(d<520&&e.spawnCd<=0&&G.enemies.filter(o=>!o.dead&&o.master===e).length<5){e.spawnCd=4.5;
  const types=ACTS[actIdx(G.depth)].roster.map(r=>r[0]);const m=makeEnemy(types[0],e.x+rand(-30,30),e.y+rand(-30,30),G.depth,false,e.pack,null);m.aggro=true;m.master=e;m.spawnT=0.4;G.enemies.push(m);burst(m.x,m.y,10,'#6a5a3a',120);}};
// ---------- layouts ----------
// Each returns {regions, start, exit, side, hide[]} (regions: {x,y,w,h,cx,cy} spawn areas), or null to retry.
const carveDisc=(cx,cy,r)=>{for(let j=Math.floor(cy-r);j<=Math.ceil(cy+r);j++)for(let i=Math.floor(cx-r);i<=Math.ceil(cx+r);i++)if(inner(i,j)&&(i-cx)**2+(j-cy)**2<=r*r)G.grid[j*MW+i]=0;};
const regionAt=(i,j)=>({x:Math.round(i)-3,y:Math.round(j)-3,w:7,h:7,cx:Math.round(i),cy:Math.round(j)});
// BFS tile distances over floor from a tile.
function tileDist(si,sj){const N=MW*MH,D=new Int32Array(N).fill(-1),q=new Int32Array(N),g=G.grid;let h=0,t=0;const s=sj*MW+si;if(g[s]!==0)return D;D[s]=0;q[t++]=s;
  while(h<t){const c=q[h++],ci=c%MW,cj=(c/MW)|0;for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const ni=ci+a,nj=cj+b;if(ni<0||nj<0||ni>=MW||nj>=MH)continue;const k=nj*MW+ni;if(g[k]!==0||D[k]>=0)continue;D[k]=D[c]+1;q[t++]=k;}}return D;}
// Common finish: drop regions that aren't open floor, pick exit (farthest), side (far but away from the exit) and
// hidden spots (dead ends far from both).
function finishLayout(regions,start,exit){const g=G.grid;
  const ok=r=>{for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++)if(g[(r.cy+b)*MW+r.cx+a]!==0)return false;return true;};
  regions=regions.filter(ok);if(!start||!ok(start))start=regions[0];if(!start||regions.length<6)return null;
  const D=tileDist(start.cx,start.cy);regions=regions.filter(r=>D[r.cy*MW+r.cx]>=0);
  if(!exit||!ok(exit)||D[exit.cy*MW+exit.cx]<0)exit=regions.reduce((a,r)=>D[r.cy*MW+r.cx]>D[a.cy*MW+a.cx]?r:a,regions[0]);
  if(D[exit.cy*MW+exit.cx]<45)return null; // too short a walk
  const DE=tileDist(exit.cx,exit.cy);
  const side=regions.filter(r=>r!==start&&r!==exit&&DE[r.cy*MW+r.cx]>18&&D[r.cy*MW+r.cx]>20).sort((a,b)=>Math.min(D[b.cy*MW+b.cx],DE[b.cy*MW+b.cx])-Math.min(D[a.cy*MW+a.cx],DE[a.cy*MW+a.cx]))[0]||null;
  // hidden spots: secluded (little open floor around) but roomy enough to walk into (3x3 open), far from start and exit
  const hide=[];for(let j=4;j<MH-4;j++)for(let i=4;i<MW-4;i++){const k=j*MW+i;if(D[k]<0)continue;let open=true;for(let b=-1;b<=1&&open;b++)for(let a=-1;a<=1;a++)if(g[(j+b)*MW+i+a]!==0){open=false;break;}if(!open)continue;
    let n=0;for(let b=-4;b<=4;b++)for(let a=-4;a<=4;a++)if(g[(j+b)*MW+i+a]===0)n++;hide.push([i,j,Math.min(D[k],DE[k])-n*0.35]);}
  hide.sort((a,b)=>b[2]-a[2]);const spots=[];for(const h of hide){if(spots.length>=6)break;if(spots.every(s=>Math.abs(s[0]-h[0])+Math.abs(s[1]-h[1])>10))spots.push(h);}
  return {regions,start,exit,side,hide:spots,dist:D};}
const LAYOUT={
  // Open fields broken by clumps of trees and stones, with palisaded monster camps.
  fields(){const g=newGrid(1);for(let j=2;j<MH-2;j++)for(let i=2;i<MW-2;i++)g[j*MW+i]=0;
    for(let k=0;k<50;k++){const side=k%4,t=rand(2,MW-3);const [x,y]=side===0?[t,2]:side===1?[t,MH-3]:side===2?[2,t]:[MW-3,t];blob(x,y,rand(1.5,4),q=>g[q]=1);}
    for(let k=0;k<90;k++)blob(rand(5,MW-6),rand(5,MH-6),rand(0.7,2.4),q=>g[q]=1);
    const camps=[];for(let t=0;t<200&&camps.length<8;t++){const x=randi(9,MW-10),y=randi(9,MH-10);if(camps.some(c=>Math.hypot(c.cx-x,c.cy-y)<14))continue;camps.push(regionAt(x,y));}
    for(const c of camps){carveDisc(c.cx,c.cy,4.6);const gap=rand(0,TAU);for(let k=0;k<14;k++){const a=k/14*TAU;if(Math.abs(angDiff(a,gap))<0.5||Math.abs(angDiff(a,gap+Math.PI))<0.5)continue;const i=Math.round(c.cx+Math.cos(a)*5.8),j=Math.round(c.cy+Math.sin(a)*5.8);if(inner(i,j))g[j*MW+i]=1;}}
    keepConnected();const regs=camps.concat(pickRegions(9,10));const start=regs.slice().sort((a,b)=>a.cx-b.cx)[0];return finishLayout(regs,start,null);},
  // A long canyon winding back and forth across the map, with alcoves and the odd wider basin.
  canyon(){const g=newGrid(1),pts=[];const rows=[6,18,31,44,57];let x=4,dir=1;
    rows.forEach((y,ri)=>{const x1=dir>0?MW-5:4;for(;dir>0?x<=x1:x>=x1;x+=dir)pts.push([x,y+Math.sin(x*0.25+ri)*2.2]);
      if(ri<rows.length-1)for(let yy=y;yy<=rows[ri+1];yy++)pts.push([x-dir,yy]);dir=-dir;x-=dir*2;});
    const regs=[];pts.forEach(([px,py],k)=>{const r=k%40<6?3.4:rand(2.1,2.7);carveDisc(px,py,r);
      if(k%22===11&&Math.random()<0.75){const ox=rand(-1,1),oy=py<MH/2?4.5:-4.5,ax=px+ox,ay=py+oy;carveDisc((px+ax)/2,(py+ay)/2,1.9);carveDisc(ax,ay,rand(2.3,3));regs.push(regionAt(ax,ay));}
      if(k%16===0)regs.push(regionAt(px,py));});
    keepConnected();const start=regionAt(pts[0][0]+1,pts[0][1]),exit=regionAt(pts[pts.length-1][0],pts[pts.length-1][1]);regs.unshift(start);regs.push(exit);return finishLayout(regs,start,exit);},
  // Caves: cellular-automaton caverns plus extra winding tunnels that end in dead ends.
  caves(){let n=0;for(let t=0;t<6&&n<1300;t++){cave(0.46,4);for(let k=0;k<4;k++){let x=rand(8,MW-9),y=rand(8,MH-9),a=rand(0,TAU);for(let s=0;s<40;s++){a+=rand(-0.5,0.5);x=clamp(x+Math.cos(a),3,MW-4);y=clamp(y+Math.sin(a),3,MH-4);carveDisc(x,y,1.6);}}n=keepConnected();}
    if(n<1100)return null;const regs=pickRegions(14,9);const start=regs.slice().sort((a,b)=>(a.cx+a.cy)-(b.cx+b.cy))[0];return finishLayout(regs,start,null);},
  // Ruins: a 4x4 block of rooms with walls between; doorways from a spanning tree plus a few extra; some rooms
  // merge into halls, some hold pillars or rubble.
  ruins(){const g=newGrid(1),N=4,cs=15,rooms=[];
    for(let gy=0;gy<N;gy++)for(let gx=0;gx<N;gx++){const x=2+gx*cs,y=2+gy*cs,w=cs-1,h=cs-1;for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(inner(i,j))g[j*MW+i]=0;rooms.push({x,y,w,h,cx:x+(w>>1),cy:y+(h>>1),gx,gy});}
    const door=(a,b)=>{if(a.gy===b.gy){const wx=Math.max(a.x,b.x)-1,y0=randi(a.y+2,a.y+a.h-5);for(let j=y0;j<y0+3;j++)g[j*MW+wx]=0;}else{const wy=Math.max(a.y,b.y)-1,x0=randi(a.x+2,a.x+a.w-5);for(let i=x0;i<x0+3;i++)g[wy*MW+i]=0;}};
    const par=[...Array(N*N).keys()],root=i=>par[i]===i?i:(par[i]=root(par[i])),edges=[];
    for(let gy=0;gy<N;gy++)for(let gx=0;gx<N;gx++){const i=gy*N+gx;if(gx<N-1)edges.push([i,i+1]);if(gy<N-1)edges.push([i,i+N]);}
    for(const [i,j] of shuffle(edges)){const ri=root(i),rj=root(j);if(ri!==rj){par[ri]=rj;door(rooms[i],rooms[j]);}else if(Math.random()<0.18)door(rooms[i],rooms[j]);}
    for(const r of rooms){const v=Math.random();if(v<0.3)for(const [a,b] of [[r.x+3,r.y+3],[r.x+r.w-4,r.y+3],[r.x+3,r.y+r.h-4],[r.x+r.w-4,r.y+r.h-4]])g[b*MW+a]=1;
      else if(v<0.5)blob(r.x+rand(2,r.w-3),r.y+rand(2,r.h-3),rand(1.2,2.2),q=>g[q]=1);}
    keepConnected();return finishLayout(shuffle(rooms.slice(1)).concat([rooms[0]]),rooms[0],null);},
  // Roads: wild country (trees and rock) cut by a wide winding road, with meadows beside it and side tracks that end
  // in clearings.
  roads(){const g=newGrid(1),road=new Uint8Array(MW*MH);G.road=road;const pts=[];let y=rand(14,MH-14);
    for(let x=4;x<=MW-5;x+=1){y=clamp(y+Math.sin(x*0.13)*0.9+rand(-0.6,0.6),8,MH-9);pts.push([x,y]);}
    const lay=(px,py,r)=>{carveDisc(px,py,r);for(let j=Math.floor(py-r*0.55);j<=Math.ceil(py+r*0.55);j++)for(let i=Math.floor(px-r*0.55);i<=Math.ceil(px+r*0.55);i++)if(inner(i,j))road[j*MW+i]=1;};
    pts.forEach(([px,py])=>lay(px,py,3));const regs=[];
    for(let k=0;k<10;k++){const [px,py]=pts[randi(6,pts.length-7)],cx=px+rand(-3,3),cy=py+(Math.random()<0.5?-1:1)*rand(5,8);carveDisc(cx,cy,rand(3.5,5));regs.push(regionAt(cx,cy));}
    for(let k=0;k<4;k++){const [px,py]=pts[randi(10,pts.length-11)],up=py>MH/2?-1:1;let x=px,yy=py;const L=randi(12,22);for(let s=0;s<L;s++){yy+=up;x+=rand(-0.8,0.8);lay(x,yy,1.9);}carveDisc(x,yy,4.2);regs.push(regionAt(x,yy));}
    for(let k=0;k<pts.length;k+=10)regs.push(regionAt(pts[k][0],pts[k][1]));
    keepConnected();const start=regionAt(pts[0][0]+1,pts[0][1]),exit=regionAt(pts[pts.length-1][0],pts[pts.length-1][1]);return finishLayout([start,...regs,exit],start,exit);}
};
// ---------- building a zone ----------
function startZone(zid,mode){const Z=ZONES[zid],c=G.char;if(!Z)return;migrateZones(c);
  G.zone=zid;G.depth=Z.depth;c.depth=Z.depth;c.zone=zid;c.maxDepth=Math.max(c.maxDepth||1,Z.depth);
  resetArea();G.inTown=false;c.town=0;G.merchant=null;G.stash=null;G.smith=null;G.waystone=null;G.levelMode=Z.layout==='boss'&&(mode==='boss'||mode==='noboss')?mode:'all';
  const p=G.p;p.potions=Math.max(p.potions,potFloor());
  if(!restoreInstance(zid,mode)){ /* portal.js: kept instances; waypoint travel elsewhere throws them away */
    if(mode==='fresh'||mode==='all'||mode==='boss'||mode==='noboss')clearInstances();
    if(Z.layout==='boss'){genLevel(Z.depth,G.levelMode);G.sidePortal=null;G.zStart={x:p.x,y:p.y};}else genZone(Z,mode);}
  G.cam.x=p.x;G.cam.y=p.y;
  const d0=(Z.act-1)*5+1,newAct=Z.depth===d0&&!Z.parent&&(c.actSeen||0)<d0;if(newAct)c.actSeen=d0;
  saveChar();setPause();if(newAct)showActTitle(d0);else toast(Z.name,Z.sub);}
function gateOpen(zid){const Z=ZONES[zid],S=zst(G.char,zid);return Z.gate==='none'||Z.gate==='boss'&&S.boss||Z.gate==='key'&&S.key||Z.gate==='seals'&&S.seals>=3;}
function genZone(Z,mode){const zid=G.zone;let L=null;G.road=null;
  for(let t=0;t<8&&!L;t++)L=LAYOUT[Z.layout](Z);
  if(!L){for(let t=0;t<5&&!L;t++)L=finishLayout(GEN.crypt(Z.depth),null,null);} // safety net
  G.zoneTheme=Z.theme;G.rooms=L.regions;const tile=r=>({x:(r.cx+0.5)*TILE,y:(r.cy+0.5)*TILE});G.zStart=tile(L.start);
  const ex=tile(L.exit);G.portal={x:ex.x,y:ex.y,active:gateOpen(zid),zone:true};
  G.sidePortal=null;const sideTo=Z.side||Z.parent;if(Z.side&&L.side){const s=tile(L.side);G.sidePortal={x:s.x,y:s.y,active:true,to:Z.side};}
  G.enemies=[];G.boss=null;G.zboss=null;let packId=0;const depth=Z.depth,D=L.dist,far=r=>D[r.cy*MW+r.cx]>14;
  const safe=(x,y,r)=>!blockedAt(x,y,r)&&G.terrain[tileIdx(x,y)]===0;
  const spot=r=>{for(let k=0;k<30;k++){const x=(r.x+rand(1,r.w-1))*TILE,y=(r.y+rand(1,r.h-1))*TILE;if(safe(x,y,26))return {x,y};}return tile(r);};
  const used=new Set([L.start,L.exit]);if(L.side)used.add(L.side);
  // packs: more and denser deeper into the act
  const crowd=Z.act>1?Math.min(1,(Z.crowd||13)/L.regions.length):1; /* Acts 2-5: layouts with many small regions don't get more monsters for it (Act 1 is tuned as is) */
  for(const r of L.regions){if(!far(r)||r===L.start)continue;let n;if(crowd===1&&Z.act===1)n=Math.max(1,Math.round((Math.random()<0.5?1:2)*Z.density));else{const v=(Math.random()<0.5?1:2)*Z.density*crowd;n=Math.floor(v)+(Math.random()<v%1?1:0);}
    for(let k=0;k<n;k++){const id=++packId,elite=Math.random()<(Z.elite??0.2),affs=elite?rollAffixes(depth):null,c=spot(r);
      rollPack(depth,elite).forEach((type,m)=>{let x=c.x+rand(-50,50),y=c.y+rand(-50,50);if(!safe(x,y,ETYPES[type].r)){x=c.x;y=c.y;}G.enemies.push(makeEnemy(type,x,y,depth,elite&&m<4,id,affs));});}}
  const freeRegs=()=>shuffle(L.regions.filter(r=>!used.has(r)&&far(r)));
  // zone boss: near the exit for a boss gate (it guards the way), otherwise somewhere deep
  if(Z.boss){const cand=L.regions.filter(r=>!used.has(r)&&far(r)).sort((a,b)=>D[b.cy*MW+b.cx]-D[a.cy*MW+a.cx]);const r=Z.gate==='boss'?cand[0]:cand[Math.min(cand.length-1,randi(1,3))];
    if(r){used.add(r);const q=spot(r);const b=makeZoneBoss(Z.boss,q.x,q.y,depth);G.enemies.push(b);G.zboss=b;
      if(zst(G.char,zid).boss)b.hp=b.maxHp; /* bosses come back on every visit */}}
  // champions with an escort
  for(const id of Z.su||[]){const r=freeRegs()[0];if(!r)break;used.add(r);const q=spot(r),pk=++packId;G.enemies.push(makeSuper(id,q.x,q.y,depth,pk));
    rollPack(depth,false).slice(0,3).forEach(type=>G.enemies.push(makeEnemy(type,q.x+rand(-60,60),q.y+rand(-60,60),depth,false,pk,null)));}
  // points of interest: shrines (and the odd cursed chest / thief) from the encounter system, then the zone's own
  const regs=L.regions.filter(r=>!used.has(r));placeEncounters(depth,regs,L.start,L.exit,false,spot);
  const hide=L.hide.slice(),take=()=>{const h=hide.shift();return h?{x:(h[0]+0.5)*TILE,y:(h[1]+0.5)*TILE}:null;};
  const midRegion=L.regions.filter(r=>!used.has(r)).sort((a,b)=>Math.abs(D[a.cy*MW+a.cx]-D[L.exit.cy*MW+L.exit.cx]*0.45)-Math.abs(D[b.cy*MW+b.cx]-D[L.exit.cy*MW+L.exit.cx]*0.45))[0];
  if(midRegion){used.add(midRegion);const q=spot(midRegion);G.feats.push(zoneFeat('wp',q.x,q.y));}
  const hc=take();if(hc)G.feats.push(zoneFeat('hchest',hc.x,hc.y));
  if(Z.gate==='key'&&!zst(G.char,zid).key){const k=take()||spot(freeRegs()[0]||L.exit);G.feats.push(zoneFeat('key',k.x,k.y));
    const pk=++packId;rollPack(depth,true).forEach((type,m)=>G.enemies.push(makeEnemy(type,k.x+rand(-70,70),k.y+rand(-70,70),depth,m<3,pk,rollAffixes(depth))));}
  if(Z.gate==='seals'){const lit=zst(G.char,zid).seals||0,rs=freeRegs().sort((a,b)=>D[b.cy*MW+b.cx]-D[a.cy*MW+a.cx]);
    for(let k=0;k<3;k++){const r=rs[k*2]||rs[k];if(!r)break;used.add(r);const q=spot(r);const f=zoneFeat('seal',q.x,q.y);if(k<lit)f.done=true;G.feats.push(f);}}
  if(Z.captive){const r=freeRegs()[0];if(r){used.add(r);const q=spot(r),pk='captive';G.feats.push(zoneFeat('captive',q.x,q.y));
    rollPack(depth,true).forEach((type,m)=>G.enemies.push(makeEnemy(type,q.x+rand(-70,70),q.y+rand(-70,70),depth,m<3,pk,rollAffixes(depth))));}}
  if(Z.hoard){const h=take();if(h){const f=zoneFeat('hchest',h.x,h.y);f.hoard=true;G.feats.push(f);}}
  // one or two events: an ambush, a monster nest
  const ev=shuffle(['ambush','nest']).slice(0,Math.random()<0.6?2:1);
  for(const k of ev){const r=freeRegs()[0];if(!r)break;used.add(r);const q=spot(r);
    if(k==='ambush')G.feats.push({kind:'ambush',x:q.x,y:q.y,r:150,done:false,zdraw:()=>{}});
    else{const n=makeEnemy('nest',q.x,q.y,depth,false,++packId,null);n.name='Monster Nest';G.enemies.push(n);}}
  const st=mode==='side'&&G.sidePortal?{x:G.sidePortal.x+70,y:G.sidePortal.y}:mode==='back'&&G.sidePortal?{x:G.sidePortal.x,y:G.sidePortal.y+60}:tile(L.start);
  G.p.x=st.x;G.p.y=st.y;if(blockedAt(G.p.x,G.p.y,G.p.r)){const s=tile(L.start);G.p.x=s.x;G.p.y=s.y;}
  G.explored=new Uint8Array(MW*MH);G.flow=new Int16Array(MW*MH);G.flowTile=-1;
  renderMap();}
// ---------- zone features ----------
// Captives to free (Z.captive): what they are called, what they say, the quest they finish.
const CAPTIVES={pilgrim:{name:'Captive Pilgrim',who:'Pilgrim',free:'The pilgrim is free!',say:'"Bless you. Tell Elder Maren I live."',quest:'a1q2'}};
const FEAT_LABEL={wp:'🌀 Waypoint',hchest:'Open the hidden chest',seal:'✦ Light the seal',captive:'Free the captive',key:''};
function zoneFeat(kind,x,y){return {kind,x,y,r:22,done:false,use:FEAT_USE[kind],label:FEAT_LABEL[kind],zdraw:FEAT_DRAW[kind]};}
const FEAT_USE={
  wp(f){unlockWp();openWay();},
  hchest(f){f.done=true;const c=G.char,d=G.depth,n=f.hoard?5:2;for(let k=0;k<n;k++)dropItem(f.x+rand(-40,40),f.y+rand(-30,40),rollDrop(c,d+1,f.hoard?2:1,k===0?2:0,{act:dropAct(d)}));
    for(let k=0;k<(f.hoard?8:4);k++)dropGold(f.x+rand(-30,30),f.y+rand(-20,30),Math.round(d*randi(4,9)));dropStones({x:f.x,y:f.y},'elite');burst(f.x,f.y,24,'#f2d04a',200);toast(f.hoard?ZONES[G.zone].hoardName||'A hoard!':'A hidden cache!','');},
  seal(f){f.done=true;const S=zst(G.char,G.zone);S.seals=(S.seals||0)+1;burst(f.x,f.y,30,'#9ab0ff',220);G.fx.push({type:'ring',x:f.x,y:f.y,r0:10,r1:140,t:0,max:0.6,col:'#9ab0ff'});
    if(S.seals>=3){G.portal.active=true;toast('All seals lit','The way on is open');}else toast(`Seal lit (${S.seals}/3)`,'');saveChar();},
  captive(f){if(G.enemies.some(e=>!e.dead&&e.pack==='captive')){toast('Guards nearby','Deal with them first');return;}
    f.done=true;const c=G.char,K=CAPTIVES[ZONES[G.zone].captive]||CAPTIVES.pilgrim;burst(f.x,f.y,24,'#f2d04a',160);toast(K.free,K.say);questDone(K.quest);
    for(let k=0;k<3;k++)dropGold(f.x+rand(-30,30),f.y+rand(-20,30),G.depth*12);dropItem(f.x,f.y+30,rollDrop(c,G.depth+1,1,2,{act:dropAct(G.depth)}));}
};
const FEAT_DRAW={
  wp(f){const on=hasWp(G.char,G.zone),t=G.time;ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(f.x,f.y+10,24,9,0,0,TAU);ctx.fill();
    ctx.fillStyle='#4a4f57';ctx.strokeStyle='#14161a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(f.x-10,f.y+10);ctx.lineTo(f.x-6,f.y-26);ctx.lineTo(f.x+6,f.y-26);ctx.lineTo(f.x+10,f.y+10);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle=on?`rgba(90,220,255,${0.6+0.3*Math.sin(t*3)})`:'#5a6068';ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y-8,6,0,TAU);ctx.stroke();lbl(f,on?'Waypoint':'Waypoint (inactive)',on?'#5ad8ff':'#9ab0c0');},
  hchest(f){if(f.done)return;ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(f.x-16,f.y+6,32,6);ctx.fillStyle=f.hoard?'#6a5020':'#4a3420';ctx.strokeStyle='#0a0705';ctx.lineWidth=2;ctx.fillRect(f.x-14,f.y-8,28,16);ctx.strokeRect(f.x-14,f.y-8,28,16);
    ctx.fillStyle=f.hoard?'#f2d04a':'#a08850';ctx.fillRect(f.x-3,f.y-5,6,6);},
  seal(f){const t=G.time;ctx.strokeStyle=f.done?'rgba(150,180,255,.9)':'#4a4a52';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,18,0,TAU);ctx.stroke();ctx.lineWidth=1.5;
    for(let k=0;k<5;k++){const a=k/5*TAU+(f.done?t:0);ctx.beginPath();ctx.moveTo(f.x+Math.cos(a)*18,f.y+Math.sin(a)*18);ctx.lineTo(f.x+Math.cos(a+2.5)*18,f.y+Math.sin(a+2.5)*18);ctx.stroke();}
    if(f.done){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=0.5;ctx.drawImage(falloff('150,180,255'),f.x-30,f.y-90,60,100);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}lbl(f,f.done?'Seal (lit)':'Seal','#9ab0ff');},
  key(f){if(f.done)return;const b=Math.sin(G.time*4)*3;ctx.globalCompositeOperation='lighter';ctx.drawImage(falloff('242,208,74'),f.x-24,f.y-24+b,48,48);ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle='#f2d04a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x-6,f.y+b,5,0,TAU);ctx.moveTo(f.x-1,f.y+b);ctx.lineTo(f.x+12,f.y+b);ctx.moveTo(f.x+8,f.y+b);ctx.lineTo(f.x+8,f.y+5+b);ctx.stroke();lbl(f,ZONES[G.zone].key||'Key','#f2d04a');},
  captive(f){const free=f.done;ctx.strokeStyle='#2a2420';ctx.lineWidth=2;if(!free)for(let k=0;k<7;k++){const a=Math.PI*(0.05+k/6*0.9),x=f.x+Math.cos(a)*14;ctx.beginPath();ctx.moveTo(x,f.y+Math.sin(a)*5);ctx.lineTo(x,f.y-26);ctx.stroke();}
    const K=CAPTIVES[ZONES[G.zone].captive]||CAPTIVES.pilgrim;ctx.fillStyle=K.col||'#6a5a48';ctx.beginPath();ctx.arc(f.x,f.y-8,7,0,TAU);ctx.fill();ctx.fillStyle='#d8b890';ctx.beginPath();ctx.arc(f.x,f.y-12,4,0,TAU);ctx.fill();lbl(f,free?K.who+' (free)':K.name,free?'#9fe08a':'#e8c890');}
};
function lbl(f,t,col){ctx.font='11px Georgia';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText(t,f.x,f.y-34);ctx.fillStyle=col;ctx.fillText(t,f.x,f.y-34);}
function unlockWp(){const c=G.char;if(G.zone&&!hasWp(c,G.zone)){c.wps.push(G.zone);toast('Waypoint unlocked',ZONES[G.zone].name);saveChar();}}
// ---------- per frame ----------
function zoneTick(dt){if(!G.zone||G.inTown||!G.p)return;const p=G.p;
  for(const f of G.feats){const d=Math.hypot(f.x-p.x,f.y-p.y);
    if(f.kind==='wp'&&d<110)unlockWp();
    if(f.kind==='key'&&!f.done&&d<34){f.done=true;zst(G.char,G.zone).key=true;G.portal.active=true;toast(`${ZONES[G.zone].key} found`,'The way on is open');burst(f.x,f.y,24,'#f2d04a',180);saveChar();}
    if(f.kind==='ambush'&&!f.done&&d<f.r){f.done=true;ambush(f);}}}
function ambush(f){const p=G.p,d=G.depth;toast('Ambush!','');G.shake=Math.max(G.shake,6);
  for(let k=0;k<2;k++){const a=rand(0,TAU),pk='amb'+k+G.time;rollPack(d,k===0).forEach((type,m)=>{let x=p.x+Math.cos(a)*260+rand(-50,50),y=p.y+Math.sin(a)*260+rand(-50,50);if(blockedAt(x,y,20)){x=p.x+rand(-120,120);y=p.y+rand(-120,120);}if(blockedAt(x,y,20))return;
    const e=makeEnemy(type,x,y,d,k===0&&m<3,pk,k===0?rollAffixes(d):null);e.aggro=true;e.spawnT=0.4;G.enemies.push(e);burst(x,y,8,'#6a5a4a',120);});}}
// Exits: the main exit (locked until the objective), the side passage, and their button labels.
function zonePortals(p){const P=G.portal,S=G.sidePortal,Z=ZONES[G.zone];
  const nearM=Math.hypot(p.x-P.x,p.y-P.y)<70&&!p.dead,nearS=S&&Math.hypot(p.x-S.x,p.y-S.y)<70&&!p.dead;G.atSide=!!nearS&&!nearM;
  let t='';if(nearM)t=P.active?(Z.next?`⬇ ${ZONES[Z.next].name}`:Z.parent?`↩ ${ZONES[Z.parent].name}`:`⬇ ${townOf(G.depth+1).name}`):`🔒 ${zoneGoal()}`;
  else if(nearS)t=`↪ ${ZONES[S.to].name}`;
  const b=$('descBtn');if(b.textContent!==t)b.textContent=t;b.classList.toggle('hidden',!t);b.classList.toggle('dis',nearM&&!P.active);}
function zoneGoal(){const Z=ZONES[G.zone],S=zst(G.char,G.zone);if(gateOpen(G.zone))return 'Exit open';
  return Z.gate==='boss'?`Slay ${ZBOSS[Z.boss].name.split(',')[0]}`:Z.gate==='key'?`Find the ${Z.key}`:Z.gate==='seals'?`Light the seals (${S.seals||0}/3)`:Z.gate==='actboss'?`Defeat ${ACTS[Z.act-1].boss.split(',')[0]}`:'';}
function zoneDescend(){const Z=ZONES[G.zone];
  if(G.atSide&&G.sidePortal){saveInstance();return startZone(G.sidePortal.to,'side');}
  if(!G.portal.active)return;
  if(Z.parent)return startZone(Z.parent,'back');
  if(Z.next)return startZone(Z.next);
  startTown(G.depth+1);}
// What a zone boss's death does: the gate, the quest, loot.
function zoneBossDown(e){const zid=G.zone,Z=ZONES[zid],B=ZBOSS[e.zb],c=G.char;if(zid)zst(c,zid).boss=true;
  if(Z&&Z.gate==='boss'){G.portal.active=true;toast(`${B.name} falls`,'The way on is open');}else toast(`${B.name} falls`,'');
  if(B.quest)questDone(B.quest);G.shake=Math.max(G.shake,12);
  const d=G.depth;for(let k=0;k<2;k++)dropItem(e.x+rand(-40,40),e.y+rand(-40,40),rollDrop(c,d+2,2,k===0?2:0,{act:dropAct(d)})); // 2 items, the first rare or better
  dropGold(e.x,e.y,d*30);dropGold(e.x+20,e.y,d*20);dropStones(e,'boss');saveChar();}
function superDown(e){const c=G.char,d=G.depth;for(let k=0,n=Math.random()<0.5?2:1;k<n;k++)dropItem(e.x+rand(-30,30),e.y+rand(-30,30),rollDrop(c,d+1,2,k===0?2:0,{act:dropAct(d)}));for(let k=0;k<3;k++)dropGold(e.x+rand(-20,20),e.y,d*8);}
// ---------- quests (Act 1) ----------
const QUESTS={
  a1q1:{act:1,name:'The Gravedigger',goal:'Slay Old Grieve in The Mourning Fields',story:'"He digs our dead back up, and sells what he finds. End him."',reward:'sp',rtext:'+1 skill point'},
  a1q2:{act:1,name:'The Lost Pilgrim',goal:'Free the pilgrim held on Lantern Road',story:'"A pilgrim went down the old road with a lantern. The lantern came back. She did not."',reward:'pot',rtext:'+1 potion charge'},
  a1q3:{act:1,name:'Bones of the Barrow',goal:'Slay the Barrow Wight in The Sunken Barrow',story:'"Something old woke under the gully. Put it back to sleep."',reward:'uq',rtext:'a unique item'},
  a1q4:{act:1,name:'The Hollow Lord',goal:"Defeat Varrok the Hollow in Varrok's Sepulchre",story:'"Varrok raised every grave in this valley. Without him, they rest."',reward:'sp',rtext:'+1 skill point'}};
// Who hands out (and rewards) each act's quests, standing by the stash in that act's town.
const QGIVER=[{name:'Elder Maren',robe:'#3a3440',staff:'#6a4a2a'}];
const giverOf=act=>QGIVER[act-1]||QGIVER[0];
function questDone(id){const c=G.char;migrateZones(c);if(!QUESTS[id]||c.q[id])return;c.q[id]='done';const Q=QUESTS[id];toast('Quest complete: '+Q.name,`Return to ${giverOf(Q.act).name} in ${TOWNS[Q.act-1].name} for your reward`);saveChar();}
function claimQuest(id){const c=G.char,Q=QUESTS[id];if(c.q[id]!=='done')return false;c.q[id]='claimed';
  if(Q.reward==='sp'){c.skillPts++;$('skDot').classList.remove('hidden');}
  else if(Q.reward==='pot'){c.potUp=(c.potUp||0)+1;refreshStats();G.p.potions=Math.min(potMax(),G.p.potions+1);}
  else if(Q.reward==='uq'){const it=rollDrop(c,Math.max(5*Q.act,c.lvl),3,3,{act:Q.act,top:true});if(c.bag.length<30)c.bag.push(it);else dropItem(G.p.x,G.p.y,it);toast('Reward: '+it.name,'');}
  else if(Q.reward==='stones'){const e={x:G.p.x,y:G.p.y};for(let k=0;k<3;k++)dropStones(e,'boss');dropGold(G.p.x,G.p.y+30,Q.act*120);}
  toast('Reward claimed',Q.rtext);saveChar();return true;}
function openQuests(){if(!G.char)return;migrateZones(G.char);$('questOv').classList.remove('hidden');renderQuests();setPause();}
function closeQuests(){$('questOv').classList.add('hidden');setPause();}
function renderQuests(){const c=G.char,near=G.inTown&&G.elderNear,act=G.inTown?actIdx(G.depth)+1:ZONES[G.zone]?ZONES[G.zone].act:actIdx(G.depth)+1;
  /* this act's quests, plus any finished ones still waiting for their reward */
  $('questList').innerHTML=Object.entries(QUESTS).filter(([id,Q])=>Q.act===act||c.q[id]==='done').map(([id,Q])=>{const s=c.q[id];return `<div class="card" style="border-color:${s==='claimed'?'#3a3226':s==='done'?'#9fe08a':'#6a5038'}">
    <div class="iname" style="color:${s==='claimed'?'var(--dim)':'#e8c878'}">${esc(Q.name)} ${s==='claimed'?'✓':s==='done'?'· complete':''}</div><div class="fdim" style="font-style:italic">${esc(Q.story)}</div>
    <div>${esc(Q.goal)}</div><div class="fdim">Reward: ${esc(Q.rtext)}</div>${s==='done'?`<div class="btn sm${near?'':' dis'}" data-claim="${id}" style="margin-top:6px">${near?'Claim reward':`Claim from ${esc(giverOf(Q.act).name)} in ${esc(TOWNS[Q.act-1].name)}`}</div>`:''}</div>`;}).join('');
  $('questList').querySelectorAll('[data-claim]').forEach(b=>b.onclick=()=>{if(claimQuest(b.dataset.claim))renderQuests();});}
// Each act's quest giver stands in its town by the stash (any of them hands out any act's rewards).
function placeElder(){G.elder=G.inTown&&G.stash&&actIdx(G.depth)<QGIVER.length?{x:G.stash.x-70,y:G.stash.y+10,who:giverOf(actIdx(G.depth)+1)}:null;}
function drawElder(){const E=G.elder;if(!E)return;const t=G.time,W=E.who;softShadow(E.x,E.y+10,16,7,0.9);ctx.fillStyle=W.robe;ctx.strokeStyle='#0a0705';ctx.lineWidth=2;ctx.beginPath();ctx.arc(E.x,E.y-6,13,0,TAU);ctx.fill();ctx.stroke();
  ctx.fillStyle='#d8c0a0';ctx.beginPath();ctx.arc(E.x,E.y-10,6,0,TAU);ctx.fill();ctx.fillStyle='#e8e0d0';ctx.fillRect(E.x-4,E.y-6,8,6);ctx.strokeStyle=W.staff;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(E.x+12,E.y+10);ctx.lineTo(E.x+14,E.y-30);ctx.stroke();
  const has=Object.values(G.char.q||{}).some(v=>v==='done');lbl({x:E.x,y:E.y+4},has?'❗ '+W.name:W.name,has?'#9fe08a':'#e8c878');}
function elderTick(){const p=G.p;G.elderNear=!!(G.inTown&&G.elder&&p&&Math.hypot(p.x-G.elder.x,p.y-G.elder.y)<70);}
// HUD line: zone name, area level, objective.
function zoneHud(){const Z=ZONES[G.zone];if(!Z)return null;const left=G.enemies.filter(e=>!e.dead).length;
  return `Act ${Z.act} · ${Z.name} · Lv ${areaLvl(Z.depth)} · ${zoneGoal()} · ${left} foes`;}
// ---------- minimap ----------
function minimapZone(s){if(!G.zone||G.inTown)return;const S=G.sidePortal;
  if(S&&G.explored[tileIdx(S.x,S.y)]){mctx.fillStyle='#e0c060';mctx.beginPath();mctx.arc(S.x/TILE*s,S.y/TILE*s,5,0,TAU);mctx.fill();}
  for(const f of G.feats){if(!G.explored[tileIdx(f.x,f.y)])continue;const col={wp:'#5ad8ff',seal:f.done?'#9ab0ff':'#5a5a70',key:'#f2d04a',captive:'#e8c890',hchest:f.done?null:'#b08840'}[f.kind];
    if(col){mctx.fillStyle=col;mctx.fillRect(f.x/TILE*s-3,f.y/TILE*s-3,6,6);}}
  const b=G.zboss;if(b&&!b.dead&&G.explored[tileIdx(b.x,b.y)]){mctx.fillStyle='#ff6a3a';mctx.beginPath();mctx.arc(b.x/TILE*s,b.y/TILE*s,5,0,TAU);mctx.fill();}}
// The side passage: a swirling amber gate.
function drawSidePortal(onScreen){const S=G.sidePortal;if(!S||G.inTown||!onScreen(S.x,S.y,80))return;ctx.save();ctx.translate(S.x,S.y);
  const g=ctx.createRadialGradient(0,0,4,0,0,40);g.addColorStop(0,'#ffe8a0');g.addColorStop(0.5,'#c8902a99');g.addColorStop(1,'#0000');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,40,0,TAU);ctx.fill();
  ctx.strokeStyle='#e0b050';ctx.lineWidth=3;for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(0,0,26-k*6,G.time*(2+k)+k,G.time*(2+k)+k+3.5);ctx.stroke();}ctx.restore();
  lbl({x:S.x,y:S.y-14},ZONES[S.to].name,'#e0c060');}
// ---------- looks: zone bosses and the nest ----------
const ZB_PAINT={
  grieve:(x,r,f)=>{PAINT.ogre(x,r,f);x.save();x.translate(r*0.2,-r*0.9);x.rotate(0.4);oval(x,r*0.5,0,r*0.75,r*0.07,'#5a4430',1);x.fillStyle='#6a6a6a';path(x,[[r*1.15,-r*0.22],[r*1.5,-r*0.18],[r*1.5,r*0.18],[r*1.15,r*0.22]]);shadeFill(x,r*1.3,0,r*0.3,'#7a7670',1);x.restore();
    const g=x.createRadialGradient(-r*0.5,r*0.8,0,-r*0.5,r*0.8,r*0.4);g.addColorStop(0,'rgba(255,200,110,.9)');g.addColorStop(1,'rgba(255,160,60,0)');x.fillStyle=g;x.fillRect(-r,r*0.4,r,r*0.8);},
  hangman:(x,r,f)=>{walker(x,r,f,{skin:'#8a7a68',torso:'#1e1a1a',sleeve:'#1a1616',boot:'#0e0c0a',chest:0.5,wide:0.85,head:0.34,headX:0.15,
      cape:(x,r,s)=>{x.fillStyle='#141010';path(x,[[r*0.1,-r*0.9],[-r*1.1,-r*0.8+s*r*0.1],[-r*1.35,0],[-r*1.1,r*0.8-s*r*0.1],[r*0.1,r*0.9]]);x.fill();},
      headDeco:(x,r)=>{oval(x,r*0.15,0,r*0.38,r*0.36,'#0e0c0c',1.2);eyes(x,r*0.38,r*0.08,r*0.035,'#ff4a2a');}});
    x.strokeStyle='#8a7050';x.lineWidth=2.4;x.beginPath();x.arc(-r*0.1,r*0.4,r*0.35,0,TAU);x.stroke();x.beginPath();x.moveTo(r*0.3,r*0.85);x.quadraticCurveTo(r*0.9,r*1.2,r*1.2,r*0.8);x.stroke();
    x.strokeStyle='#9a9ea0';x.lineWidth=3;x.beginPath();x.arc(r*1.25,r*0.65,r*0.18,-1.2,2.2);x.stroke();},
  weaver:(x,r,f)=>{const s=swing(f);x.strokeStyle='#cfc6aa';x.lineWidth=r*0.09;for(const sd of [-1,1])for(let k=0;k<3;k++){const a=sd*(0.6+k*0.55)+s*0.15*(k%2?1:-1);x.beginPath();x.moveTo(0,0);x.quadraticCurveTo(Math.cos(a)*r*0.9,Math.sin(a)*r*0.9,Math.cos(a)*r*1.5+r*0.2,Math.sin(a)*r*1.6);x.stroke();}
    PAINT.archer(x,r*0.8,f);for(let k=0;k<4;k++)dot(x,-r*0.5-k*r*0.15,0,r*0.08,'#e8e0c8');},
  abbess:(x,r,f)=>{robe('#8a8478','#d8c8a0','#ffd890')(x,r,f);for(let k=0;k<7;k++){const a=Math.PI*0.6+k/6*Math.PI*0.8,cx=r*0.1+Math.cos(a)*r*0.7,cy=Math.sin(a)*r*0.7;dot(x,cx,cy,r*0.07,'#e8dcc0');
    const g=x.createRadialGradient(cx,cy,0,cx,cy,r*0.2);g.addColorStop(0,'rgba(255,220,140,.9)');g.addColorStop(1,'rgba(255,180,80,0)');x.fillStyle=g;x.fillRect(cx-r*0.2,cy-r*0.2,r*0.4,r*0.4);}},
  lamplighter:(x,r,f)=>{robe('#3a3a2a','#8a7448','#ffcc66')(x,r,f);x.strokeStyle='#4a3420';x.lineWidth=r*0.1;x.beginPath();x.moveTo(r*0.3,r*0.6);x.lineTo(r*1.4,r*0.9);x.stroke();
    const g=x.createRadialGradient(r*1.45,r*0.95,0,r*1.45,r*0.95,r*0.45);g.addColorStop(0,'rgba(255,230,150,1)');g.addColorStop(1,'rgba(255,170,60,0)');x.fillStyle=g;x.fillRect(r,r*0.5,r*0.9,r*0.9);},
  wight:(x,r,f)=>{PAINT.wraith(x,r,f);x.fillStyle='#c8b070';for(let k=0;k<5;k++){const a=Math.PI*0.65+k/4*Math.PI*0.7;path(x,[[r*0.1+Math.cos(a-0.12)*r*0.45,Math.sin(a-0.12)*r*0.45],[r*0.1+Math.cos(a)*r*0.7,Math.sin(a)*r*0.7],[r*0.1+Math.cos(a+0.12)*r*0.45,Math.sin(a+0.12)*r*0.45]]);x.fill();}
    x.strokeStyle='#9aa8b0';x.lineWidth=3;x.beginPath();x.moveTo(r*0.4,r*0.7);x.lineTo(r*1.5,r*0.4);x.stroke();}
};
PAINT.nest=(x,r,f)=>{for(let k=0;k<7;k++){const a=k/7*TAU,d=r*0.45;oval(x,Math.cos(a)*d,Math.sin(a)*d,r*0.42,r*0.36,k%2?'#4a3a2a':'#5a4630',1.1);}oval(x,0,0,r*0.5,r*0.5,'#6a4a34',1.2);
  for(let k=0;k<5;k++)dot(x,rand(-r*0.6,r*0.6),rand(-r*0.6,r*0.6),r*0.08,'#c8b060');eyes(x,r*0.1,r*0.15,r*0.05,'#d0ff60');};
tap('questClose',closeQuests);
tap('questBtn',()=>{$('menuOv').classList.add('hidden');setPause();openQuests();});
