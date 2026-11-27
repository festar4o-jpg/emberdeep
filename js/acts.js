'use strict';
// Acts 2-5 as chains of named zones (zones.js runs them; Act 1 lives there). Per act: four zones and the act boss's
// own arena on its five depths, one or two side zones, a layout generator per zone (LAYOUT), a theme per zone (THEMES,
// built from maps.js's helpers), a zone boss with two mechanics and its own look, champions, quests and a quest giver.
// Zones may bring their own monster mix (Z.roster, used by rollPack) and props.
const AH=THEMES._h;
// ---------- shared painters for zone themes ----------
const ZFLOOR={
  sand(x,px,py,o){x.fillStyle=`hsl(${o.h+rand(-2,2)},${o.s}%,${o.l+Math.random()*1.3}%)`;x.fillRect(px,py,TILE,TILE);
    for(let k=0;k<2;k++)AH.dot(x,px+rand(0,40),py+rand(0,40),rand(8,16),Math.random()<0.5?'rgba(0,0,0,.05)':'rgba(255,230,190,.035)');
    for(let k=0;k<3;k++)AH.dot(x,px+rand(2,38),py+rand(2,38),rand(0.8,1.8),Math.random()<0.5?'rgba(0,0,0,.18)':'rgba(255,230,190,.12)');
    if(o.ripple&&Math.random()<o.ripple){x.strokeStyle='rgba(255,225,180,.1)';x.lineWidth=2;x.beginPath();x.arc(px+20,py+48,30,Math.PI*1.2,Math.PI*1.8);x.stroke();}},
  slab(x,px,py,o){AH.slabs(x,px,py,o.h,o.s,o.l,o.lv||2.5);if(Math.random()<0.07)AH.crack(x,px,py,o.crack||'rgba(0,0,0,.4)');
    if(o.inlay&&Math.random()<o.inlay){x.strokeStyle=o.inlayCol;x.lineWidth=1.2;x.strokeRect(px+8,py+8,24,24);}},
  earth(x,px,py,o){x.fillStyle=`hsl(${o.h+rand(-3,3)},${o.s}%,${o.l+Math.random()*1.5}%)`;x.fillRect(px,py,TILE,TILE);
    for(let k=0;k<5;k++)AH.dot(x,px+rand(2,38),py+rand(2,38),rand(0.8,2.2),Math.random()<0.6?'rgba(0,0,0,.25)':o.fleck||'rgba(200,180,150,.12)');if(Math.random()<0.1)AH.crack(x,px,py,'rgba(0,0,0,.35)');},
  cobble(x,px,py,o){x.fillStyle=`hsl(${o.h},${o.s}%,${o.l-3}%)`;x.fillRect(px,py,TILE,TILE);
    for(let j=0;j<4;j++)for(let i=0;i<4;i++){const cx=px+i*10+5+(j%2)*3+rand(-1,1),cy=py+j*10+5+rand(-1,1);x.fillStyle=`hsl(${o.h+rand(-4,4)},${o.s}%,${o.l+rand(-2,2.5)}%)`;x.beginPath();x.ellipse(cx,cy,4.3,3.8,rand(0,3),0,TAU);x.fill();}
    if(Math.random()<0.08)AH.dot(x,px+rand(6,34),py+rand(6,34),rand(5,9),'rgba(0,0,0,.18)');}
};
const ZWALL={
  rock(x,px,py,below,adj,o){AH.rockWall(x,px,py,adj,o.h,o.s,o.l);},
  tree(x,px,py,below,adj,o){AH.treeWall(x,px,py,adj,o.h);},
  brick(x,px,py,below,adj,o){x.fillStyle=adj?`hsl(${o.h},${o.s}%,${o.l*0.55}%)`:`hsl(${o.h},${o.s}%,${o.l*0.25}%)`;x.fillRect(px,py,TILE,TILE);if(!adj)return;
    x.fillStyle='rgba(0,0,0,.25)';x.fillRect(px,py+13,TILE,1.4);x.fillRect(px,py+26,TILE,1.4);x.fillRect(px+(o.h%2?14:22),py,1.4,13);x.fillRect(px+8,py+14,1.4,12);
    if(o.trim){x.fillStyle=o.trim;x.fillRect(px,py,TILE,2);}if(below)AH.face(x,px,py,`hsl(${o.h},${o.s}%,${o.l}%)`,o.trim||`hsl(${o.h},${o.s+4}%,${o.l+9}%)`);},
  sandstone(x,px,py,below,adj,o){if(!adj){x.fillStyle=`hsl(${o.h},16%,7%)`;x.fillRect(px,py,TILE,TILE);return;}
    const b=(cx,cy,rx,ry,col)=>{x.fillStyle=col;x.beginPath();for(let k=0;k<9;k++){const a=k/9*TAU,r=rand(0.78,1.08);x.lineTo(cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r);}x.closePath();x.fill();};
    b(px+20,py+23,25,21,`hsl(${o.h-2},${o.s}%,${o.l*0.42}%)`);b(px+19,py+18,21,16,`hsl(${o.h},${o.s}%,${o.l*0.75}%)`);b(px+17,py+14,14,9,`hsl(${o.h+2},${o.s+2}%,${o.l}%)`);
    x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=1;for(let k=0;k<2;k++){const yy=py+rand(14,28);x.beginPath();x.moveTo(px+rand(2,10),yy);x.lineTo(px+rand(30,38),yy+rand(-3,3));x.stroke();}
    if(Math.random()<0.5)AH.crack(x,px,py,'rgba(0,0,0,.45)');}
};
// Zone theme from a floor painter, a wall painter and options: road floor, void/poison/lava/bridge tiles of an act
// theme, deco, colour grade, base for floor detail (detail), no wall depth (flat), torches (torch: rgb or null).
function zoneTheme(o){const F=ZFLOOR[o.floor[0]],W=ZWALL[o.wall[0]];
  return {mat:o /* dunart.js paints these materials */,void:o.void||'#080503',detail:o.detail,flat:o.flat,grade:o.grade,torch:o.torch,
    floor(x,px,py,i,j){if(o.road&&G.road&&G.road[j*MW+i])return ZFLOOR[o.road[0]](x,px,py,o.road[1]);F(x,px,py,o.floor[1]);},
    wall(x,px,py,below,adj){W(x,px,py,below,adj,o.wall[1]);},
    deco:o.deco||null,voidT:o.voidT||null,poison:o.poison||null,lava:o.lava||null,bridge:o.bridge||THEMES.citadel.bridge};}
function zoneProps(id,set,col){AH.PROP_SET[id]=set;AH.PROP_COL[id]=col;}
// little decorations scattered on open floor
const decoOf=(list)=>(x,px,py)=>{let r=Math.random();for(const [p,fn] of list){if(r<p){fn(x,px,py);return;}r-=p;}};
// ---------- props ----------
{const {PR,shade,lin,dot}=AH;
  PR.urn=(x,cx,cy,c)=>{shade(x,cx+2,cy+3,9,4);x.fillStyle=lin(x,cx-7,0,cx+7,0,c||'#9a7448','#4a3420');x.beginPath();x.ellipse(cx,cy-6,7,9,0,0,TAU);x.fill();x.fillRect(cx-4,cy-17,8,4);
    x.strokeStyle='rgba(0,0,0,.4)';x.lineWidth=1;x.beginPath();x.moveTo(cx-6,cy-8);x.lineTo(cx+6,cy-8);x.stroke();if(Math.random()<0.4){x.fillStyle='#2a1a10';x.beginPath();x.moveTo(cx+2,cy-14);x.lineTo(cx+7,cy-6);x.lineTo(cx+3,cy-2);x.fill();}};
  PR.crate=(x,cx,cy)=>{if(propArt(x,Math.random()<0.3?'crate_open':'crate',cx,cy+4,0.95,Math.random()<0.5))return; /* propart.js */shade(x,cx+3,cy+3,12,5);x.fillStyle='#5a4228';x.fillRect(cx-10,cy-16,20,18);x.strokeStyle='#2a1c10';x.lineWidth=1.5;x.strokeRect(cx-10,cy-16,20,18);x.beginPath();x.moveTo(cx-10,cy-16);x.lineTo(cx+10,cy+2);x.stroke();};
  PR.wagon=(x,cx,cy)=>{const a=rand(-0.5,0.5);x.save();x.translate(cx,cy);x.rotate(a);shade(x,3,6,30,9);x.fillStyle='#4a3420';x.fillRect(-26,-12,52,20);x.strokeStyle='#22160c';x.lineWidth=2;x.strokeRect(-26,-12,52,20);
    for(let k=-20;k<26;k+=8){x.beginPath();x.moveTo(k,-12);x.lineTo(k,8);x.stroke();}for(const s of [-1,1]){x.strokeStyle='#2a1c10';x.lineWidth=3;x.beginPath();x.arc(s*16,10,8,0,s>0?Math.PI*1.3:TAU);x.stroke();}x.restore();};
  PR.eggs=(x,cx,cy)=>{for(let k=0;k<randi(3,6);k++){const ex=cx+rand(-11,11),ey=cy+rand(-7,7);shade(x,ex+1,ey+2,5,2.5);x.fillStyle=lin(x,ex-4,0,ex+4,0,'#d8c890','#7a6a40');x.beginPath();x.ellipse(ex,ey-3,4,5.5,0,0,TAU);x.fill();}
    dot(x,cx,cy+2,9,'rgba(140,170,60,.18)');};
  PR.obelisk=(x,cx,cy,c)=>{shade(x,cx+4,cy+4,10,5);x.fillStyle=lin(x,cx-6,0,cx+6,0,c||'#8a7656','#3a2e20');x.beginPath();x.moveTo(cx-6,cy+2);x.lineTo(cx-4,cy-30);x.lineTo(cx,cy-36);x.lineTo(cx+4,cy-30);x.lineTo(cx+6,cy+2);x.fill();
    x.strokeStyle='rgba(255,210,120,.35)';x.lineWidth=1;for(let k=0;k<3;k++){x.beginPath();x.moveTo(cx-2,cy-24+k*7);x.lineTo(cx+2,cy-24+k*7);x.stroke();}};}
// ---------- layouts ----------
const carveRect=(x0,y0,x1,y1)=>{for(let j=Math.max(1,y0);j<=Math.min(MH-2,y1);j++)for(let i=Math.max(1,x0);i<=Math.min(MW-2,x1);i++)G.grid[j*MW+i]=0;};
const wallRect=(x0,y0,x1,y1)=>{for(let j=Math.max(1,y0);j<=Math.min(MH-2,y1);j++)for(let i=Math.max(1,x0);i<=Math.min(MW-2,x1);i++)G.grid[j*MW+i]=1;};
// A wandering walk from (ax,ay) to (bx,by), carving a path of radius w; returns the points walked.
function wander(ax,ay,bx,by,w,jit){let x=ax,y=ay;const out=[];for(let s=0;s<400;s++){const d=Math.hypot(bx-x,by-y);if(d<1)break;
  const a=Math.atan2(by-y,bx-x)+rand(-jit,jit)+Math.sin(s*0.19+ax)*jit*0.6;x=clamp(x+Math.cos(a),3,MW-4);y=clamp(y+Math.sin(a),3,MH-4);carveDisc(x,y,w*rand(0.85,1.15));out.push([x,y]);}return out;}
Object.assign(LAYOUT,{
  // Dunes: an open sand sea cut by long, gently curving ridges (each broken by a gap or two), rock arches and
  // half-buried pillars.
  dunes(){const g=newGrid(1);for(let j=2;j<MH-2;j++)for(let i=2;i<MW-2;i++)g[j*MW+i]=0;
    for(let k=0;k<46;k++){const side=k%4,t=rand(2,MW-3);const [x,y]=side===0?[t,2]:side===1?[t,MH-3]:side===2?[2,t]:[MW-3,t];blob(x,y,rand(1.5,4.5),q=>g[q]=1);}
    for(let k=0;k<14;k++){let x=rand(6,MW-7),y=rand(6,MH-7),a=rand(0,TAU);const L=randi(14,30),bend=rand(-0.1,0.1),gap=randi(4,L-5),gap2=Math.random()<0.5?randi(3,L-3):-9;
      for(let s=0;s<L;s++){a+=bend+rand(-0.06,0.06);x+=Math.cos(a);y+=Math.sin(a);if(Math.abs(s-gap)<2||Math.abs(s-gap2)<2)continue;const i=Math.round(x),j=Math.round(y);
        if(i>3&&j>3&&i<MW-4&&j<MH-4){g[j*MW+i]=1;if(Math.random()<0.4)g[j*MW+i+(Math.random()<0.5?1:-1)]=1;}}}
    for(let k=0;k<7;k++){const x=randi(6,MW-9),y=randi(6,MH-9),hz=Math.random()<0.5;g[y*MW+x]=1;g[(y+(hz?0:3))*MW+x+(hz?3:0)]=1;} // arches
    for(let k=0;k<26;k++)blob(rand(5,MW-6),rand(5,MH-6),rand(0.5,1.3),q=>g[q]=1);
    keepConnected();const regs=pickRegions(14,9);const start=regs.slice().sort((a,b)=>(a.cx-a.cy)-(b.cx-b.cy))[0];return finishLayout(regs,start,null);},
  // Ravine: one long gorge zig-zagging across the map, with side canyons branching off it (some branching again),
  // each ending in a pocket.
  ravine(){const g=newGrid(1),regs=[];const N=5,trunk=[];let py=Math.random()<0.5?rand(8,18):rand(MH-19,MH-9);
    for(let k=0;k<N;k++){const x0=4+k*(MW-9)/N,x1=4+(k+1)*(MW-9)/N,ny=py<MH/2?rand(MH-19,MH-9):rand(8,18);trunk.push(...wander(x0,py,x1,ny,rand(2.1,2.6),0.8));py=ny;}
    trunk.forEach(([x,y],k)=>{if(k%55===30)carveDisc(x,y,rand(3.6,4.4));if(k%16===0)regs.push(regionAt(x,y));});
    const branch=(x,y,a,L,w,depth)=>{let bx=x,by=y;for(let s=0;s<L;s++){a+=rand(-0.25,0.25);const nx=bx+Math.cos(a),ny=by+Math.sin(a);if(nx<4||ny<4||nx>MW-5||ny>MH-5)break;bx=nx;by=ny;carveDisc(bx,by,w);
        if(depth<1&&s===Math.floor(L/2)&&Math.random()<0.45)branch(bx,by,a+(Math.random()<0.5?1:-1)*rand(0.9,1.3),randi(6,11),w*0.9,depth+1);}
      carveDisc(bx,by,rand(2.8,3.8));regs.push(regionAt(bx,by));};
    for(let k=0;k<7;k++){const n=randi(12,trunk.length-12),[x,y]=trunk[n],[x2,y2]=trunk[n+2];const ta=Math.atan2(y2-y,x2-x);branch(x,y,ta+(Math.random()<0.5?1:-1)*rand(1.2,1.9),randi(9,17),rand(1.5,1.9),0);}
    keepConnected();const start=regionAt(trunk[2][0],trunk[2][1]),exit=regionAt(trunk[trunk.length-2][0],trunk[trunk.length-2][1]);return finishLayout([start,...regs,exit],start,exit);},
  // City: a street grid of blocks: solid buildings, hollow ones you can walk into through a doorway, collapsed
  // blocks of rubble and open plazas with a fountain.
  city(){const g=newGrid(1);for(let j=2;j<MH-2;j++)for(let i=2;i<MW-2;i++)g[j*MW+i]=0;
    const cuts=()=>{const c=[];let v=4;while(v+7<MW-4){const w=randi(7,10);c.push([v,Math.min(v+w-1,MW-5)]);v+=w+randi(3,4);}return c;};
    const xs=cuts(),ys=cuts(),regs=[];
    for(const [y0,y1] of ys)for(const [x0,x1] of xs){const v=Math.random(),cx=(x0+x1)>>1,cy=(y0+y1)>>1;
      if(v<0.14){if(Math.random()<0.7)wallRect(cx,cy,cx+1,cy+1);regs.push(regionAt(cx-2,cy-2));} // plaza with a fountain
      else if(v<0.27){for(let k=0;k<4;k++)blob(rand(x0,x1),rand(y0,y1),rand(0.8,1.8),q=>g[q]=1);regs.push(regionAt(cx,cy));} // collapsed
      else{wallRect(x0,y0,x1,y1);if(v<0.66&&x1-x0>=6&&y1-y0>=6){carveRect(x0+1,y0+1,x1-1,y1-1);
          const doors=Math.random()<0.4?2:1;for(let d=0;d<doors;d++){const side=randi(0,3);if(side<2){const i=randi(x0+2,x1-3),j=side?y1:y0;carveRect(i,j,i+1,j);}else{const j=randi(y0+2,y1-3),i=side===2?x0:x1;carveRect(i,j,i,j+1);}}
          const split=x1-x0>=9&&Math.random()<0.4;if(split)wallRect(cx,y0+1,cx,y1-2); // an inner wall
          regs.push(regionAt(split?x0+2:cx,cy));}}}
    for(let k=0;k+1<ys.length;k++)for(let m=0;m+1<xs.length;m++)if(Math.random()<0.5)regs.push(regionAt(xs[m][1]+2,ys[k][1]+2)); // crossroads
    for(let k=0;k<20;k++){const i=randi(3,MW-4),j=randi(3,MH-4);if(g[j*MW+i]===0&&g[j*MW+i+1]===0&&g[j*MW+i-1]===0)g[j*MW+i]=1;} // stalls and debris
    keepConnected();const start=regs.slice().sort((a,b)=>(a.cx+(MH-a.cy))-(b.cx+(MH-b.cy)))[0];return finishLayout(regs,start,null);},
  // Temple: symmetric about its axis. An entrance court, a pillared processional hall caved in halfway, chambers
  // mirrored on both sides, an outer ambulatory joining some of them, niches, and the inner sanctum at the top.
  temple(){const g=newGrid(1),regs=[],half=MW>>1;
    carveRect(22,53,half-1,60);carveRect(28,14,half-1,52);wallRect(28,31,half-1,33); // court, hall, the cave-in
    for(let j=16;j<52;j+=3)if(j<30||j>34)g[j*MW+29]=1; // pillar row (mirrored)
    const bands=[[45,50],[37,42],[24,29],[15,20]],lower=[],upper=[];
    for(const [y0,y1] of bands){const w=randi(7,10),x1=25,x0=x1-w+1,ym=(y0+y1)>>1;carveRect(x0,y0,x1,y1);carveRect(26,ym-1,27,ym+1);(y0>33?lower:upper).push({x0,y0,y1,ym});regs.push(regionAt((x0+x1)>>1,ym));
      if(Math.random()<0.35)for(const [a,b] of [[x0+1,y0+1],[x1-1,y0+1],[x0+1,y1-1],[x1-1,y1-1]])g[b*MW+a]=1;}
    carveRect(5,17,7,49);regs.push(regionAt(6,33)); // the ambulatory
    const link=c=>{carveRect(8,c.ym-1,c.x0-1,c.ym+1);};link(lower[randi(0,1)]);link(upper[randi(0,1)]);for(const c of lower.concat(upper))if(Math.random()<0.4)link(c);
    for(let k=0;k<3;k++){const y=randi(18,46);carveRect(2,y,3,y+2);carveRect(4,y+1,4,y+1);} // niches
    carveRect(19,3,half-1,11);carveRect(29,12,half-1,13);regs.push(regionAt(26,7)); // sanctum
    for(let j=0;j<MH;j++)for(let i=0;i<half;i++)g[j*MW+(MW-1-i)]=g[j*MW+i]; // mirror
    for(const [a,b] of [[24,5],[24,9],[MW-25,5],[MW-25,9]])g[b*MW+a]=1;
    for(const r of regs.slice())if(r.cx<half-2)regs.push(regionAt(MW-1-r.cx,r.cy));
    keepConnected();const start=regionAt(half,57),exit=regionAt(half,6);return finishLayout([start,...regs,exit],start,exit);},
  // Burrows: round chambers joined by wriggling worm tunnels (a spanning tree plus a couple of loops) and tunnels
  // that just end.
  burrows(){const g=newGrid(1),ch=[];
    for(let t=0;t<400&&ch.length<11;t++){const x=rand(7,MW-8),y=rand(7,MH-8),r=rand(2.6,4.4);if(ch.some(c=>Math.hypot(c.x-x,c.y-y)<c.r+r+6))continue;ch.push({x,y,r});}
    for(const c of ch){carveDisc(c.x,c.y,c.r);for(let k=0;k<2;k++)carveDisc(c.x+rand(-c.r,c.r)*0.6,c.y+rand(-c.r,c.r)*0.6,c.r*rand(0.5,0.8));}
    const worm=(a,b)=>{let x=a.x,y=a.y;const ph=rand(0,9);for(let s=0;s<260;s++){const d=Math.hypot(b.x-x,b.y-y);if(d<1.5)break;const ang=Math.atan2(b.y-y,b.x-x)+Math.sin(s*0.3+ph)*0.95;x+=Math.cos(ang)*0.8;y+=Math.sin(ang)*0.8;carveDisc(x,y,rand(1.2,1.7));}};
    const inT=[0],edges=[];while(inT.length<ch.length){let best=null;for(const i of inT)for(let j=0;j<ch.length;j++){if(inT.includes(j))continue;const d=Math.hypot(ch[i].x-ch[j].x,ch[i].y-ch[j].y);if(!best||d<best[2])best=[i,j,d];}inT.push(best[1]);edges.push(best);}
    for(const [i,j] of edges)worm(ch[i],ch[j]);for(let k=0;k<2;k++){const i=randi(0,ch.length-1),j=randi(0,ch.length-1);if(i!==j)worm(ch[i],ch[j]);}
    for(let k=0;k<4;k++){const c=ch[randi(0,ch.length-1)];let x=c.x,y=c.y,a=rand(0,TAU);for(let s=0;s<randi(10,16);s++){a+=rand(-0.4,0.4);x=clamp(x+Math.cos(a),3,MW-4);y=clamp(y+Math.sin(a),3,MH-4);carveDisc(x,y,1.3);}carveDisc(x,y,1.9);}
    keepConnected();const regs=ch.map(c=>regionAt(c.x,c.y));const start=regs.slice().sort((a,b)=>(a.cx+a.cy)-(b.cx+b.cy))[0];return finishLayout(regs,start,null);}
});
// ---------- Act 2: the Ashen Wastes ----------
Object.assign(ZONES,{
  a2z1:{act:2,depth:6,name:'The Cinder Dunes',sub:'Black sand, and something vast moving under it',layout:'dunes',theme:'a2dunes',
    next:'a2z2',side:'a2s1',gate:'boss',boss:'kharu',su:['sunscorch','hasra'],density:1.2},
  a2z2:{act:2,depth:7,name:'The Bleached Gorge',sub:'The vultures here have never gone hungry',layout:'ravine',theme:'a2gorge',
    next:'a2z3',gate:'key',key:'Sun Sigil',boss:'ozra',su:['gnaw','tamsin'],density:1.3,roster:[['scarab',3],['sandworm',2.2],['archer',1.6],['dustmage',1]]},
  a2z3:{act:2,depth:8,name:'The Buried Bazaar',sub:'A city of traders, swallowed whole by the sand',layout:'city',theme:'a2city',
    next:'a2z4',side:'a2s2',gate:'seals',seal:'sun-dial',boss:'vael',su:['asp','taxman'],density:1.4,roster:[['dustmage',3],['scarab',3],['grunt',1.6],['sandworm',1]]},
  a2z4:{act:2,depth:9,name:'Tomb of the Sun-Kings',sub:'They were buried with their servants. The servants still serve',layout:'temple',theme:'a2tomb',
    next:'a2z5',gate:'boss',boss:'nefrem',su:['ankhet','tombguard'],density:1.5,roster:[['dustmage',3],['archer',2],['scarab',2],['brute',1.3]]},
  a2z5:{act:2,depth:10,name:'The Ash Throne',sub:'The Ash Tyrant holds court in the cinders',layout:'boss',next:null,gate:'actboss'},
  a2s1:{act:2,depth:6,name:'The Worm Warrens',sub:'Tunnels as wide as a cart, and still warm',layout:'burrows',theme:'a2warren',parent:'a2z1',
    gate:'none',boss:'broodmother',su:['gnasher'],density:1.35,roster:[['sandworm',3],['scarab',5]],hoard:1,hoardName:'The brood\'s buried hoard!'},
  a2s2:{act:2,depth:8,name:'The Caravan Road',sub:'The last caravan never reached Kesh',layout:'roads',theme:'a2road',parent:'a2z3',
    gate:'none',boss:'duskhand',su:['ji'],density:1.35,captive:'caravan',roster:[['dustmage',2],['grunt',2],['scarab',3],['brute',1]]}
});
Object.assign(ZBOSS,{
  kharu:{name:'Kharu the Sandreaver',r:30,hp:1.05,dmg:1,spd:96,moves:['erupt','sandspray'],quest:'a2q1',wide:1},
  ozra:{name:'Ozra, the Vulture Queen',r:26,hp:0.95,dmg:1.05,spd:90,moves:['divebomb','feathers']},
  vael:{name:'Merchant-Prince Vael',r:24,hp:0.75,dmg:1.05,spd:66,moves:['goldrain','hirelings'],ranged:1},
  nefrem:{name:'Nefrem the Embalmed',r:28,hp:1.25,dmg:1.1,spd:64,moves:['sunbeam','wraps']},
  broodmother:{name:'The Brood Mother',r:30,hp:1.3,dmg:1.05,spd:70,moves:['eggs','acid'],quest:'a2q3',wide:1},
  duskhand:{name:'Dusk-Hand, the Raider Chief',r:24,hp:1.1,dmg:1.1,spd:92,moves:['whirl','traps']}
});
Object.assign(SUPERU,{
  sunscorch:{name:'Sunscorch',base:'scarab',affs:['fast','explodes'],hp:6},hasra:{name:'Dune Prophet Hasra',base:'dustmage',affs:['shielded','summoner']},
  gnaw:{name:'Old Gnaw',base:'sandworm',affs:['vampiric']},tamsin:{name:'Tamsin the Hollow-Eyed',base:'dustmage',affs:['fast']},
  asp:{name:'The Gilded Asp',base:'scarab',affs:['vampiric','explodes'],hp:6},taxman:{name:'The Tax Collector',base:'sandworm',affs:['shielded']},
  ankhet:{name:'High Priest Ankhet',base:'dustmage',affs:['summoner','shielded']},tombguard:{name:'The Tomb Guardian',base:'brute',affs:['shielded','vampiric']},
  gnasher:{name:'Gnasher',base:'sandworm',affs:['fast']},ji:{name:'Rattlesnake Ji',base:'dustmage',affs:['fast','explodes']}
});
CAPTIVES.caravan={name:'Captive Caravan Guard',who:'Caravan guard',free:'The guard is free!',say:'"Tell Saddiq the water got through."',quest:'a2q2',col:'#8a3a2a'};
QGIVER[1]={name:'Saddiq the Water-Keeper',robe:'#a08050',staff:'#5a3a1a'};
Object.assign(QUESTS,{
  a2q1:{act:2,name:'The Sandreaver',goal:'Slay Kharu the Sandreaver in The Cinder Dunes',story:'"Every caravan that crossed the dunes this year was swallowed. Not robbed. Swallowed."',reward:'sp',rtext:'+1 skill point'},
  a2q2:{act:2,name:'The Last Caravan',goal:'Free the caravan guard held on The Caravan Road',story:'"One of the guards lived, they say. Raiders keep her for ransom no one can pay."',reward:'stones',rtext:'gems, runes and gold'},
  a2q3:{act:2,name:'Mother of Worms',goal:'Slay the Brood Mother in The Worm Warrens',story:'"The worms are not born in the sand. Something lays them. Find it."',reward:'uq',rtext:'a unique item'},
  a2q4:{act:2,name:'The Ash Tyrant',goal:'Defeat the Ash Tyrant on The Ash Throne',story:'"He burned the sun out of the sky. Burn him out of the sand."',reward:'sp',rtext:'+1 skill point'}});
// ---------- zone boss mechanics (Act 2) ----------
const aimAt=e=>Math.atan2(G.p.y-e.y,G.p.x-e.x);
Object.assign(ZB_MOVES,{
  // sinks into the sand and bursts up under you
  erupt(e){const p=G.p,x=p.x,y=p.y;e.busy=1.5;burst(e.x,e.y,20,'#a08050',160);groundStrike(e,x,y,72,1.1,e.dmg*1.9,'#d8b070',()=>{if(!blockedAt(x,y,e.r)){e.x=x;e.y=y;}G.shake=Math.max(G.shake,9);burst(x,y,30,'#c8a060',220);});},
  sandspray(e){e.busy=0.9;for(let w=0;w<2;w++)bossLater(e,w*0.4,()=>{const a=aimAt(e);for(let k=-3;k<=3;k++)enemyShoot(e,a+k*0.14,250,'#e0c080',e.dmg*0.55,6,{slow:0.3});});},
  // three diving swoops along telegraphed lines
  divebomb(e){e.busy=2.4;for(let i=0;i<3;i++)bossLater(e,i*0.75,()=>{const a=aimAt(e),L=300;lineStrike(e,e.x,e.y,a,L,46,0.6,e.dmg*1.5,'#d8c8a0');
    bossLater(e,0.6,()=>{moveEnt(e,Math.cos(a)*L*0.85,Math.sin(a)*L*0.85);burst(e.x,e.y,14,'#c8b890',150);});});},
  feathers(e){e.busy=0.8;ring(e,14,170,'#e8dcc0',e.dmg*0.5,6,rand(0,TAU));bossLater(e,0.35,()=>{const a=aimAt(e);for(let k=-2;k<=2;k++)enemyShoot(e,a+k*0.18,300,'#f0e8d0',e.dmg*0.6,5);});},
  // coins rain down around you
  goldrain(e){e.busy=1;for(let i=0;i<8;i++)bossLater(e,i*0.12,()=>{const [x,y]=i?near(170):[G.p.x,G.p.y];groundStrike(e,x,y,46,0.9,e.dmg*1.1,'#f2d04a');});},
  hirelings(e){e.busy=1;e.wind=0.8;e.tele={r:60,col:'#f2d04a'};e.act=()=>{bossSummon(e,'dustmage',2,4);bossSummon(e,'scarab',4,10);floatText(e.x,e.y-e.r-20,'"Guards!"','#f2d04a',false);};},
  // a beam of sunlight sweeping across the room
  sunbeam(e){const a0=aimAt(e),dir=Math.random()<0.5?1:-1;e.busy=1.9;for(let i=0;i<7;i++)bossLater(e,i*0.16,()=>lineStrike(e,e.x,e.y,a0+dir*(i-3)*0.3,360,40,0.7,e.dmg*1.2,'#ffd870'));},
  // bandages lash out and drag you in, then cling
  wraps(e){const a=aimAt(e);e.busy=1.2;G.fx.push({type:'tline',x:e.x,y:e.y,a,len:340,w:38,t:0,max:0.85,col:'#d8ccaa'});
    bossLater(e,0.85,()=>{const p=G.p,dx=p.x-e.x,dy=p.y-e.y,al=dx*Math.cos(a)+dy*Math.sin(a),pe=Math.abs(-dx*Math.sin(a)+dy*Math.cos(a));
      if(al>0&&al<340+p.r&&pe<19+p.r&&dmgPlayer(e.dmg*1.2,e)){const k=Math.max(0,al-e.r-p.r-10);moveEnt(p,-Math.cos(a)*k,-Math.sin(a)*k);slowPlayer(0.5,2);floatText(p.x,p.y-30,'Bound!','#d8ccaa',false);}});},
  // eggs land around you and hatch scarabs
  eggs(e){e.busy=1.1;for(let i=0;i<3;i++){const [x,y]=near(190);groundStrike(e,x,y,40,1,e.dmg*1.1,'#c8d070',()=>{if(G.enemies.filter(o=>!o.dead&&o.master===e).length>=12)return;
      for(let k=0;k<3;k++){const m=makeEnemy('scarab',x+rand(-14,14),y+rand(-14,14),G.depth,false,e.pack);if(blockedAt(m.x,m.y,m.r)){m.x=x;m.y=y;}m.aggro=true;m.master=e;m.summoned=true;m.spawnT=0.3;G.enemies.push(m);}burst(x,y,12,'#d8e090',140);});}},
  acid(e){e.busy=0.8;for(let i=0;i<4;i++)bossLater(e,i*0.18,()=>{const [x,y]=i?near(150):[G.p.x,G.p.y];groundStrike(e,x,y,52,0.9,e.dmg*1,'#9fe04a',()=>addEHaz(x,y,46,4.5,e.dmg*0.35,'poison'));});},
  // two spinning blade sweeps, closing in between them
  whirl(e){e.busy=1.8;for(let i=0;i<2;i++)bossLater(e,i*0.9,()=>{const a=aimAt(e),d=Math.min(160,Math.hypot(G.p.x-e.x,G.p.y-e.y)*0.6);moveEnt(e,Math.cos(a)*d,Math.sin(a)*d);groundStrike(e,e.x,e.y,115,0.6,e.dmg*1.4,'#e8e0d0');});},
  traps(e){e.busy=0.7;const p=G.p;for(let k=0;k<6;k++){const a=k/6*TAU+rand(-0.2,0.2),r=rand(70,150),x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;if(wallAt(Math.floor(x/TILE),Math.floor(y/TILE)))continue;
    groundStrike(e,x,y,40,1.1,e.dmg*1.1,'#b0a090',()=>addEHaz(x,y,34,5,e.dmg*0.3,'poison'));}}
});
// ---------- zone boss looks (Act 2) ----------
Object.assign(ZB_PAINT,{
  kharu:(x,r,f)=>{PAINT.worm(x,r,f);for(let k=1;k<=4;k++){const cx=-k*r*0.62;x.fillStyle='rgba(30,20,12,.55)';x.beginPath();x.ellipse(cx,0,r*0.22,r*(0.78-k*0.08),0,0,TAU);x.fill();}
    for(let k=0;k<6;k++){const a=Math.PI*0.6+k/5*Math.PI*0.8;x.fillStyle='#e8dcc0';path(x,[[Math.cos(a)*r*0.9,Math.sin(a)*r*0.9],[Math.cos(a)*r*1.25,Math.sin(a)*r*1.25],[Math.cos(a+0.15)*r*0.92,Math.sin(a+0.15)*r*0.92]]);x.fill();}},
  ozra:(x,r,f)=>{const s=swing(f);for(const sd of [-1,1]){x.fillStyle='#2a2018';path(x,[[r*0.1,sd*r*0.4],[-r*0.5,sd*(r*1.6+s*r*0.15)],[-r*1.1,sd*r*1.3],[-r*0.8,sd*r*0.4]]);shadeFill(x,-r*0.4,sd*r*0.9,r*0.8,'#3a2c20',1.2);
      x.strokeStyle='rgba(230,220,200,.35)';x.lineWidth=1;for(let k=0;k<4;k++){x.beginPath();x.moveTo(-r*0.2-k*r*0.2,sd*r*0.5);x.lineTo(-r*0.4-k*r*0.2,sd*r*(1.2+k*0.08));x.stroke();}}
    robe('#4a3828','#c8b890','#ff9a4a')(x,r*0.85,f);oval(x,r*0.55,0,r*0.2,r*0.12,'#d8b860',1);},
  vael:(x,r,f)=>{robe('#6a2a5a','#f2d04a','#f2d04a')(x,r,f);for(let k=0;k<5;k++)AH.dot(x,-r*0.3+k*r*0.18,r*(k%2?0.55:-0.55),r*0.07,'#f2d04a');oval(x,r*0.3,0,r*0.28,r*0.3,'#e8c060',1);},
  nefrem:(x,r,f)=>{walker(x,r,f,{skin:'#c8bc98',torso:'#d8ccaa',sleeve:'#c8bc98',boot:'#8a7a5a',chest:0.55,wide:0.88,head:0.32,headX:0.2,
      torsoDeco:(x,r)=>{x.strokeStyle='rgba(90,70,40,.5)';x.lineWidth=1.2;for(let k=-3;k<=3;k++){x.beginPath();x.moveTo(-r*0.5,k*r*0.22);x.lineTo(r*0.4,k*r*0.22+r*0.08);x.stroke();}},
      headDeco:(x,r)=>{x.fillStyle='#f2d04a';path(x,[[r*0.05,-r*0.42],[r*0.45,-r*0.3],[r*0.45,r*0.3],[r*0.05,r*0.42],[-r*0.25,0]]);shadeFill(x,r*0.15,0,r*0.4,'#d8a830',1);eyes(x,r*0.42,r*0.1,r*0.035,'#5ad8ff');}});},
  broodmother:(x,r,f)=>{PAINT.worm(x,r,f);for(let k=0;k<7;k++)AH.dot(x,-r*rand(0.8,2.3),rand(-r*0.5,r*0.5),r*rand(0.1,0.16),'#d8c890');x.fillStyle='rgba(160,200,60,.3)';x.beginPath();x.arc(r*0.35,0,r*0.5,0,TAU);x.fill();},
  duskhand:(x,r,f)=>{walker(x,r,f,{skin:'#8a6a4a',torso:'#5a2a20',sleeve:'#4a2018',boot:'#1e140c',chest:0.52,wide:0.86,head:0.32,headX:0.18,
      cape:(x,r,s)=>{x.fillStyle='#8a3a2a';path(x,[[r*0.1,-r*0.9],[-r*1.0,-r*0.8+s*r*0.1],[-r*1.3,0],[-r*1.0,r*0.8-s*r*0.1],[r*0.1,r*0.9]]);x.fill();},
      headDeco:(x,r)=>{oval(x,r*0.2,0,r*0.34,r*0.33,'#d8c8a0',1);x.fillStyle='#2a1a10';x.fillRect(r*0.3,-r*0.3,r*0.08,r*0.6);}});
    x.strokeStyle='#c8ccd0';x.lineWidth=3;for(const sd of [-1,1]){x.beginPath();x.moveTo(r*0.4,sd*r*0.8);x.quadraticCurveTo(r*1.2,sd*r*1.1,r*1.5,sd*r*0.6);x.stroke();}}
});
// ---------- Act 2 themes ----------
{const {dot,crack,glow}=AH;
  const bush=(x,px,py)=>{x.strokeStyle='#4a3420';x.lineWidth=2;x.beginPath();const bx=px+20,by=py+32;x.moveTo(bx,by);x.lineTo(bx,by-16);for(const s of [-1,1]){x.moveTo(bx,by-8);x.lineTo(bx+s*8,by-16);x.moveTo(bx,by-13);x.lineTo(bx+s*5,by-21);}x.stroke();};
  const skull=(x,px,py)=>{dot(x,px+20,py+20,6,'#d9d0b8');dot(x,px+18,py+19,1.6,'#2a1d10');dot(x,px+22,py+19,1.6,'#2a1d10');};
  const ember=(x,px,py)=>{const gx=px+rand(10,30),gy=py+rand(10,30);glow(x,gx,gy,10,'rgba(255,120,40,.35)');addLight(gx,gy,55,0.35,'255,120,40',0.2,1);};
  THEMES.a2dunes=zoneTheme({floor:['sand',{h:30,s:22,l:20,ripple:0.35}],wall:['sandstone',{h:24,s:14,l:24}],detail:'desert',flat:1,grade:[0.32,'#e8c8a0'],void:'#120a05',
    deco:decoOf([[0.012,skull],[0.03,bush],[0.008,ember]])});
  zoneProps('a2dunes',[['ribs',3,0],['bones',2,0],['pillar',1.5,0],['tree',2,0],['debris',2,0],['obelisk',0.6,0]],'#8a7656');
  THEMES.a2gorge=zoneTheme({floor:['earth',{h:16,s:16,l:24,fleck:'rgba(255,235,215,.14)'}],wall:['rock',{h:10,s:22,l:25}],detail:'desert',flat:1,grade:[0.3,'#f0ccb0'],void:'#140806',
    deco:decoOf([[0.02,skull],[0.03,(x,px,py)=>{for(let k=0;k<3;k++){x.strokeStyle='#e8e0d0';x.lineWidth=1.6;const bx=px+rand(8,32),by=py+rand(8,32),a=rand(0,3);x.beginPath();x.moveTo(bx,by);x.lineTo(bx+Math.cos(a)*9,by+Math.sin(a)*9);x.stroke();}}]])});
  zoneProps('a2gorge',[['bones',4,0],['ribs',3,0],['cage',1.5,1],['debris',3,0],['tree',1,0]],'#a08070');
  THEMES.a2city=zoneTheme({floor:['cobble',{h:34,s:16,l:22}],wall:['brick',{h:30,s:24,l:26}],detail:'crypt',grade:[0.3,'#e8d0a8'],torch:'255,185,105',void:'#0e0804',
    deco:decoOf([[0.015,(x,px,py)=>{x.fillStyle='rgba(120,40,30,.35)';x.fillRect(px+4,py+6,32,22);}],[0.02,bush]])});
  zoneProps('a2city',[['urn',4,0],['crate',3,0],['ruin',2,0],['debris',3,0],['pillar',1,0],['bones',1,0]],'#9a7448');
  THEMES.a2tomb=zoneTheme({floor:['slab',{h:40,s:18,l:13,lv:2,inlay:0.12,inlayCol:'rgba(242,208,74,.25)'}],wall:['brick',{h:38,s:12,l:17,trim:'hsl(44,60%,38%)'}],detail:'crypt',grade:[0.34,'#e0c898'],torch:'255,195,110',void:'#060402',
    deco:decoOf([[0.02,(x,px,py)=>{glow(x,px+20,py+20,20,'rgba(255,200,90,.22)');}],[0.015,skull]])});
  zoneProps('a2tomb',[['urn',3,0],['pillar',3,0],['candles',2,0],['obelisk',1.5,1],['bones',2,0],['chains',1,0]],'#9a8458');
  THEMES.a2warren=zoneTheme({floor:['earth',{h:32,s:24,l:14,fleck:'rgba(220,200,140,.1)'}],wall:['rock',{h:30,s:22,l:15}],detail:'marsh',flat:1,grade:[0.36,'#d8c8a0'],void:'#080503',
    deco:decoOf([[0.03,(x,px,py)=>{dot(x,px+20,py+22,rand(6,11),'rgba(160,190,70,.14)');}],[0.015,skull]])});
  zoneProps('a2warren',[['eggs',4,0],['stalag',1.5,0],['bones',3,0],['debris',2,0],['ribs',1,0]],'#6a5a3a');
  THEMES.a2road=zoneTheme({floor:['sand',{h:33,s:20,l:21,ripple:0.15}],road:['earth',{h:28,s:18,l:16}],wall:['sandstone',{h:28,s:12,l:22}],detail:'desert',flat:1,grade:[0.3,'#ecd2a4'],void:'#120a05',
    deco:decoOf([[0.02,bush],[0.01,skull]])});
  zoneProps('a2road',[['wagon',2,0],['crate',2,0],['bones',2,0],['ribs',1.5,0],['debris',2,0],['tree',1,0]],'#8a7656');}
// ---------- Act 3: Rotwood Marsh ----------
// plank causeway across void (water): void tiles on the way become bridge, walls become floor
function causeway(ax,ay,bx,by,w){const n=Math.ceil(Math.hypot(bx-ax,by-ay)*2);for(let s=0;s<=n;s++){const cx=ax+(bx-ax)*s/n,cy=ay+(by-ay)*s/n;
  for(let j=Math.floor(cy-w);j<=Math.ceil(cy+w);j++)for(let i=Math.floor(cx-w);i<=Math.ceil(cx+w);i++){if(!inner(i,j)||(i-cx)**2+(j-cy)**2>w*w)continue;const k=j*MW+i;if(G.grid[k]===2){G.grid[k]=0;G.terrain[k]=T_BRIDGE;}else if(G.grid[k]===1)G.grid[k]=0;}}}
const mst=pts=>{const inT=[0],E=[];while(inT.length<pts.length){let b=null;for(const i of inT)for(let j=0;j<pts.length;j++){if(inT.includes(j))continue;const d=Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y);if(!b||d<b[2])b=[i,j,d];}inT.push(b[1]);E.push(b);}return E;};
const poisonPools=(n,r0,r1)=>{const g=G.grid,T=G.terrain;for(let k=0;k<n;k++){const x=rand(4,MW-5),y=rand(4,MH-5);if(g[Math.round(y)*MW+Math.round(x)]!==0)continue;blob(x,y,rand(r0,r1),q=>{if(g[q]===0&&T[q]===0)T[q]=T_POISON;});}};
Object.assign(LAYOUT,{
  // Islands: black water with mossy islands (reeds and dead trees on them) joined by plank causeways.
  islands(){const g=newGrid(2);for(let i=0;i<MW;i++){g[i]=1;g[(MH-1)*MW+i]=1;}for(let j=0;j<MH;j++){g[j*MW]=1;g[j*MW+MW-1]=1;}
    const is=[];for(let t=0;t<500&&is.length<16;t++){const x=rand(6,MW-7),y=rand(6,MH-7),r=rand(3.4,5.8);if(is.some(c=>Math.hypot(c.x-x,c.y-y)<c.r+r+3.5))continue;is.push({x,y,r});}
    for(const c of is){blob(c.x,c.y,c.r,q=>g[q]=0);for(let k=0;k<2;k++)blob(c.x+rand(-c.r,c.r)*0.7,c.y+rand(-c.r,c.r)*0.7,c.r*0.6,q=>g[q]=0);if(c.r>4&&Math.random()<0.7)blob(c.x+rand(-1.5,1.5),c.y+rand(-1.5,1.5),rand(0.6,1.2),q=>g[q]=1);}
    for(const [i,j] of mst(is))causeway(is[i].x,is[i].y,is[j].x,is[j].y,1.1);
    for(let k=0;k<2;k++){const i=randi(0,is.length-1),j=randi(0,is.length-1);if(i!==j&&Math.hypot(is[i].x-is[j].x,is[i].y-is[j].y)<22)causeway(is[i].x,is[i].y,is[j].x,is[j].y,1.1);}
    poisonPools(6,1,1.8);keepConnected();
    const regs=is.map(c=>regionAt(c.x,c.y));const start=regs.slice().sort((a,b)=>a.cx-b.cx)[0];return finishLayout(regs,start,null);},
  // Forest: open ground grown thick with tree clumps and fallen trunks, trails trodden between clearings.
  forest(){const g=newGrid(1);for(let j=2;j<MH-2;j++)for(let i=2;i<MW-2;i++)g[j*MW+i]=0;
    for(let k=0;k<330;k++)blob(rand(3,MW-4),rand(3,MH-4),rand(0.8,2.5),q=>g[q]=1);
    for(let k=0;k<14;k++){let x=rand(5,MW-6),y=rand(5,MH-6);const a=rand(0,TAU);for(let s=0;s<randi(4,8);s++){x+=Math.cos(a);y+=Math.sin(a);const i=Math.round(x),j=Math.round(y);if(inner(i,j))g[j*MW+i]=1;}} // fallen trunks
    const cl=[];for(let t=0;t<400&&cl.length<13;t++){const x=rand(6,MW-7),y=rand(6,MH-7);if(cl.some(c=>Math.hypot(c.x-x,c.y-y)<12))continue;cl.push({x,y});}
    for(const c of cl)carveDisc(c.x,c.y,rand(2.6,3.8));for(const [i,j] of mst(cl))wander(cl[i].x,cl[i].y,cl[j].x,cl[j].y,1.25,0.6);
    poisonPools(4,0.8,1.5);keepConnected();const regs=cl.map(c=>regionAt(c.x,c.y));const start=regs.slice().sort((a,b)=>(a.cx+a.cy)-(b.cx+b.cy))[0];return finishLayout(regs,start,null);},
  // Mire caves: the cellular caverns, flooded with poison pools.
  mirecaves(Z){const L=LAYOUT.caves(Z);if(!L)return null;poisonPools(16,1.4,3);return L;},
  // Trench: the switchback canyon with poison mud along its floor.
  trench(Z){const L=LAYOUT.canyon(Z);if(!L)return null;poisonPools(26,1,2.2);return L;},
  // Village: a drowned village: mud banks and ponds, stilt huts (some over the water) with doorways, boardwalks.
  village(){const g=newGrid(1);for(let j=2;j<MH-2;j++)for(let i=2;i<MW-2;i++)g[j*MW+i]=0;
    for(let k=0;k<40;k++){const side=k%4,t=rand(2,MW-3);const [x,y]=side===0?[t,2]:side===1?[t,MH-3]:side===2?[2,t]:[MW-3,t];blob(x,y,rand(1.5,3.5),q=>g[q]=1);}
    for(let k=0;k<9;k++)blob(rand(8,MW-9),rand(8,MH-9),rand(2.5,4.8),q=>{if(g[q]===0)g[q]=2;}); // ponds
    const huts=[];for(let t=0;t<500&&huts.length<11;t++){const w=randi(5,7),h=randi(4,6),x=randi(4,MW-w-5),y=randi(4,MH-h-5);if(huts.some(u=>x<u.x+u.w+3&&x+w+3>u.x&&y<u.y+u.h+3&&y+h+3>u.y))continue;huts.push({x,y,w,h});}
    for(const u of huts){wallRect(u.x,u.y,u.x+u.w-1,u.y+u.h-1);carveRect(u.x+1,u.y+1,u.x+u.w-2,u.y+u.h-2);const d=randi(0,3),mx=u.x+(u.w>>1),my=u.y+(u.h>>1);
      if(d===0)carveRect(mx,u.y,mx,u.y);else if(d===1)carveRect(mx,u.y+u.h-1,mx,u.y+u.h-1);else if(d===2)carveRect(u.x,my,u.x,my);else carveRect(u.x+u.w-1,my,u.x+u.w-1,my);
      u.cx=mx;u.cy=my;u.d=d;}
    for(const [i,j] of mst(huts.map(u=>({x:u.cx,y:u.cy}))))causeway(huts[i].cx,huts[i].cy+(huts[i].h>>1)+1,huts[j].cx,huts[j].cy+(huts[j].h>>1)+1,0.9); // boardwalks (along the hut fronts)
    for(const u of huts){wallRect(u.x,u.y,u.x+u.w-1,u.y);wallRect(u.x,u.y,u.x,u.y+u.h-1);wallRect(u.x+u.w-1,u.y,u.x+u.w-1,u.y+u.h-1);wallRect(u.x,u.y+u.h-1,u.x+u.w-1,u.y+u.h-1);
      const mx=u.cx,my=u.cy;if(u.d===0)carveRect(mx,u.y,mx,u.y);else if(u.d===1)carveRect(mx,u.y+u.h-1,mx,u.y+u.h-1);else if(u.d===2)carveRect(u.x,my,u.x,my);else carveRect(u.x+u.w-1,my,u.x+u.w-1,my);
      carveRect(mx,u.y+u.h-1,mx,u.y+u.h-1);} // walls stay walls after the boardwalks; every hut has its door and a back door to the boardwalk
    poisonPools(8,1,2);keepConnected();const regs=huts.map(u=>regionAt(u.cx,u.cy)).concat(pickRegions(6,10));const start=regs.slice().sort((a,b)=>(a.cx-a.cy)-(b.cx-b.cy))[0];return finishLayout(regs,start,null);}
});
Object.assign(ZONES,{
  a3z1:{act:3,depth:11,name:'The Drowned Fen',sub:'Islands of moss on water that never moves',layout:'islands',theme:'a3fen',
    next:'a3z2',gate:'boss',boss:'bog',su:['bloatgut','mossback'],density:1.25},
  a3z2:{act:3,depth:12,name:'The Rotwood',sub:'Trees grown so close the light gave up',layout:'forest',theme:'a3wood',
    next:'a3z3',side:'a3s1',gate:'key',key:'Heartwood Key',boss:'thornfather',su:['briar','knotty'],density:1.3,roster:[['vinelasher',3],['sporetoad',3],['marshtroll',1.6]]},
  a3z3:{act:3,depth:13,name:'The Weeping Caves',sub:'Water drips from every stone, and it burns',layout:'mirecaves',theme:'a3caves',
    next:'a3z4',gate:'seals',boss:'gloomhag',su:['drip','oldslime'],density:1.4,roster:[['sporetoad',4],['marshtroll',2],['vinelasher',1.5],['grunt',1.5]]},
  a3z4:{act:3,depth:14,name:'Sunken Mirewick',sub:'The village sank in a night. Its people stayed',layout:'village',theme:'a3village',
    next:'a3z5',gate:'boss',boss:'silt',su:['kell','deacon'],density:1.5,roster:[['grunt',3],['sporetoad',3],['archer',1.5],['marshtroll',1.6]]},
  a3z5:{act:3,depth:15,name:'Heart of Rot',sub:'Mother of Rot feeds the whole marsh',layout:'boss',next:null,gate:'actboss'},
  a3s1:{act:3,depth:12,name:'The Leech Trench',sub:'A ditch of warm black mud, and things that drink',layout:'trench',theme:'a3trench',parent:'a3z2',
    gate:'none',boss:'leechking',su:['suckling'],density:1.35,captive:'fisherboy',roster:[['sporetoad',3],['marshtroll',2],['grunt',2]]}
});
Object.assign(ZBOSS,{
  bog:{name:'Grandmother Bog',r:32,hp:1.1,dmg:1,spd:70,moves:['hopslam','spores'],quest:'a3q1'},
  thornfather:{name:'The Thornfather',r:30,hp:1.25,dmg:1.05,spd:58,moves:['thorns','roots'],quest:'a3q3'},
  gloomhag:{name:'The Gloom Hag',r:24,hp:0.8,dmg:1.1,spd:66,moves:['hex','mend'],ranged:1},
  silt:{name:'Father Silt, the Drowned Priest',r:26,hp:1.25,dmg:1.1,spd:64,moves:['tide','drowned']},
  leechking:{name:'The Leech King',r:30,hp:1.3,dmg:1.05,spd:74,moves:['leech','acid'],wide:1}
});
Object.assign(SUPERU,{
  bloatgut:{name:'Bloatgut',base:'sporetoad',affs:['vampiric']},mossback:{name:'Moss-Back',base:'marshtroll',affs:['fast']},
  briar:{name:'Briar',base:'vinelasher',affs:['shielded']},knotty:{name:'Old Knotty',base:'marshtroll',affs:['vampiric']},
  drip:{name:'Drip',base:'sporetoad',affs:['fast','explodes']},oldslime:{name:'Old Slime',base:'marshtroll',affs:['shielded']},
  kell:{name:'Bone-Fisher Kell',base:'archer',affs:['fast'],hp:3},deacon:{name:'The Bloated Deacon',base:'sporetoad',affs:['shielded','explodes']},
  suckling:{name:'Suckling',base:'sporetoad',affs:['vampiric','fast']}
});
CAPTIVES.fisherboy={name:"The Fisher's Boy",who:'Fisher boy',free:'The boy is free!',say:'"Is my mother still in Mirewatch? Tell her I\'m coming."',quest:'a3q2',col:'#6a4a2a'};
QGIVER[2]={name:'Old Wen the Boatwoman',robe:'#3a4a2a',staff:'#4a3a1a'};
Object.assign(QUESTS,{
  a3q1:{act:3,name:'Grandmother Bog',goal:'Slay Grandmother Bog in The Drowned Fen',story:'"She was a toad once. Then she ate the ferryman, and then the ferry."',reward:'sp',rtext:'+1 skill point'},
  a3q2:{act:3,name:"The Fisher's Boy",goal:'Free the boy held in The Leech Trench',story:'"His boat came back without him. Something dragged him down the trench."',reward:'pot',rtext:'+1 potion charge'},
  a3q3:{act:3,name:'The Thornfather',goal:'Slay the Thornfather in The Rotwood',story:'"The oldest tree in the wood walks now. It plants the dead like seeds."',reward:'uq',rtext:'a unique item'},
  a3q4:{act:3,name:'Mother of Rot',goal:'Defeat Mother of Rot in the Heart of Rot',story:'"Cut out the heart and the marsh might heal."',reward:'sp',rtext:'+1 skill point'}});
Object.assign(ZB_MOVES,{
  // a great hop onto you, and a shockwave where she lands
  hopslam(e){const p=G.p,x=p.x,y=p.y;e.busy=1.4;groundStrike(e,x,y,88,1,e.dmg*1.7,'#9ab060',()=>{if(!blockedAt(x,y,e.r)){e.x=x;e.y=y;}G.shake=Math.max(G.shake,10);ring(e,10,190,'#b8d070',e.dmg*0.5,7,rand(0,TAU));});},
  spores(e){e.busy=0.8;for(let i=0;i<5;i++)bossLater(e,i*0.15,()=>{const [x,y]=i?near(200):[G.p.x,G.p.y];groundStrike(e,x,y,50,0.9,e.dmg*0.8,'#b8ff5a',()=>addEHaz(x,y,50,5,e.dmg*0.3,'poison'));});},
  // crosses of thorns from the ground, aimed then turned
  thorns(e){const a=aimAt(e);e.busy=1.6;for(let w=0;w<2;w++)bossLater(e,w*0.6,()=>{for(let k=0;k<4;k++)lineStrike(e,e.x,e.y,a+k*Math.PI/2+w*Math.PI/4,320,40,0.75,e.dmg*1.25,'#8ab050');});},
  roots(e){e.busy=1.3;for(let i=0;i<3;i++)bossLater(e,i*0.4,()=>{const x=G.p.x,y=G.p.y;groundStrike(e,x,y,48,0.7,e.dmg*1.2,'#6a5030',()=>{if(Math.hypot(G.p.x-x,G.p.y-y)<60)slowPlayer(0.55,1.6);});});},
  hex(e){e.busy=0.9;ring(e,12,150,'#a080d0',e.dmg*0.55,7,rand(0,TAU),0,{slow:0.45});bossLater(e,0.4,()=>{const a=aimAt(e);for(let k=-1;k<=1;k++)enemyShoot(e,a+k*0.2,260,'#c0a0f0',e.dmg*0.6,6,{slow:0.45});});},
  // two tidal rings with a gap facing you: step into the gap
  tide(e){e.busy=1.3;for(let w=0;w<2;w++)bossLater(e,w*0.55,()=>{const a=aimAt(e),n=20;for(let k=0;k<n;k++){const ang=a+k/n*TAU;if(Math.abs(angDiff(ang,a+(w?0.6:-0.6)))<0.45)continue;enemyShoot(e,ang,160,'#7ab0c0',e.dmg*0.6,7);}});},
  drowned(e){e.busy=1;e.wind=0.8;e.tele={r:70,col:'#7ab0c0'};e.act=()=>{bossSummon(e,'grunt',3,6);floatText(e.x,e.y-e.r-20,'"Rise, my flock"','#9ac8d0',false);};},
  // latches on from afar, drags you in and drinks
  leech(e){const a=aimAt(e);e.busy=1.2;G.fx.push({type:'tline',x:e.x,y:e.y,a,len:330,w:36,t:0,max:0.85,col:'#8a2a2a'});
    bossLater(e,0.85,()=>{const p=G.p,dx=p.x-e.x,dy=p.y-e.y,al=dx*Math.cos(a)+dy*Math.sin(a),pe=Math.abs(-dx*Math.sin(a)+dy*Math.cos(a)),h=p.hp;
      if(al>0&&al<330+p.r&&pe<18+p.r&&dmgPlayer(e.dmg*1.3,e)){const k=Math.max(0,al-e.r-p.r-10);moveEnt(p,-Math.cos(a)*k,-Math.sin(a)*k);e.hp=Math.min(e.maxHp,e.hp+Math.max(0,h-p.hp)*3);floatText(p.x,p.y-30,'Drained!','#e05050',false);}});}
});
Object.assign(ZB_PAINT,{
  bog:(x,r,f)=>{PAINT.toad(x,r,f);for(let k=0;k<6;k++){const a=k/6*TAU,cx=-r*0.2+Math.cos(a)*r*0.45,cy=Math.sin(a)*r*0.45;oval(x,cx,cy,r*0.12,r*0.12,k%2?'#c8b070':'#a04030',1);AH.dot(x,cx,cy,r*0.04,'#f0e8c0');}},
  thornfather:(x,r,f)=>{PAINT.vine(x,r,f);oval(x,0,0,r*0.55,r*0.55,'#4a3420',1.4);x.strokeStyle='#2a1c10';x.lineWidth=2;for(let k=0;k<5;k++){x.beginPath();x.arc(0,0,r*(0.15+k*0.08),k,k+2.5);x.stroke();}
    x.strokeStyle='#5a4028';x.lineWidth=r*0.08;for(const sd of [-1,1]){x.beginPath();x.moveTo(r*0.2,sd*r*0.3);x.lineTo(r*0.6,sd*r*0.8);x.lineTo(r*0.9,sd*r*0.7);x.moveTo(r*0.6,sd*r*0.8);x.lineTo(r*0.5,sd*r*1.15);x.stroke();}eyes(x,r*0.3,r*0.15,r*0.05,'#c0ff60');},
  gloomhag:(x,r,f)=>{robe('#2a3a2a','#6a7a4a','#a080d0')(x,r,f);x.strokeStyle='#8a8a7a';x.lineWidth=1.5;for(let k=0;k<7;k++){x.beginPath();x.moveTo(r*0.2,(k-3)*r*0.08);x.quadraticCurveTo(-r*0.5,(k-3)*r*0.15,-r*1.1,(k-3)*r*0.2);x.stroke();}},
  silt:(x,r,f)=>{robe('#3a4a52','#7a9aa0','#7ab0c0')(x,r,f);for(let k=0;k<8;k++)AH.dot(x,rand(-r*0.8,r*0.2),rand(-r*0.7,r*0.7),r*0.06,'#c8c0a8');x.strokeStyle='#6a5a40';x.lineWidth=r*0.08;x.beginPath();x.moveTo(r*0.3,r*0.7);x.lineTo(r*1.4,r*0.9);x.stroke();
    x.strokeStyle='#a0a8b0';x.lineWidth=2.5;x.beginPath();x.arc(r*1.45,r*0.72,r*0.16,-0.5,2.6);x.stroke();},
  leechking:(x,r,f)=>{PAINT.worm(x,r,f);x.globalAlpha=0.55;for(let k=0;k<=4;k++){x.fillStyle='#3a0a10';x.beginPath();x.ellipse(-k*r*0.62,0,r*(1-k*0.13),r*(0.95-k*0.12),0,0,TAU);x.fill();}x.globalAlpha=1;
    for(let k=0;k<4;k++)AH.dot(x,-r*(0.5+k*0.6),0,r*0.08,'#e05050');}
});
{const {dot,glow,crack}=AH;
  // black water: ripples, the odd lily pad, a muddy bank against land
  const water=(hue,l)=>(x,px,py,i,j,at)=>{x.fillStyle=`hsl(${hue+rand(-4,4)},28%,${l+Math.random()}%)`;x.fillRect(px,py,TILE,TILE);
    for(let k=0;k<2;k++){x.strokeStyle='rgba(160,200,190,.08)';x.lineWidth=1;x.beginPath();x.ellipse(px+rand(6,34),py+rand(6,34),rand(4,10),rand(1.5,3),0,0,TAU);x.stroke();}
    if(Math.random()<0.05){dot(x,px+rand(8,32),py+rand(8,32),rand(3,5),'#3a5a2a');}
    if(at(i,j-1)===0){x.fillStyle='rgba(40,30,18,.85)';x.fillRect(px,py,TILE,6);x.fillStyle='rgba(0,0,0,.35)';x.fillRect(px,py+6,TILE,4);}};
  const reeds=(x,px,py)=>{x.strokeStyle='hsl(80,30%,26%)';x.lineWidth=1.5;x.beginPath();const bx=px+rand(8,32),by=py+34;for(let k=-2;k<=2;k++){x.moveTo(bx+k*3,by);x.lineTo(bx+k*4+rand(-2,2),by-rand(12,22));}x.stroke();};
  const shroom=(x,px,py)=>{const cx=px+rand(10,30),cy=py+rand(10,30);glow(x,cx,cy,16,'rgba(90,255,210,.28)');addLight(cx,cy,80,0.4,'90,255,210',0.2,0);x.fillStyle='#cfe';x.fillRect(cx-1,cy,2,5);dot(x,cx,cy,4,'#5fd8c0');};
  const leaves=(x,px,py)=>{for(let k=0;k<4;k++){x.fillStyle=`hsla(${rand(20,50)},40%,${rand(14,22)}%,.7)`;x.beginPath();x.ellipse(px+rand(4,36),py+rand(4,36),3,1.6,rand(0,3),0,TAU);x.fill();}};
  THEMES.a3fen=zoneTheme({floor:['earth',{h:88,s:20,l:13,fleck:'rgba(120,170,70,.12)'}],wall:['tree',{h:100}],detail:'marsh',flat:1,grade:[0.42,'#b4c4b0'],void:'#020806',
    voidT:water(180,7),poison:THEMES.marsh.poison,deco:decoOf([[0.05,reeds],[0.01,shroom]])});
  zoneProps('a3fen',[['tree',3,0],['cshroom',1,0],['log',3,0],['puddle',3,0],['bones',1,0]],'#4a4a3a');
  THEMES.a3wood=zoneTheme({floor:['earth',{h:30,s:20,l:11,fleck:'rgba(90,70,40,.2)'}],wall:['tree',{h:85}],detail:'marsh',flat:1,grade:[0.44,'#b8c0a0'],void:'#030502',
    poison:THEMES.marsh.poison,deco:decoOf([[0.06,leaves],[0.012,shroom],[0.02,reeds]])});
  zoneProps('a3wood',[['tree',5,0],['log',4,0],['bones',1,0],['grave',0.5,1],['debris',1,0]],'#3a3a2a');
  THEMES.a3caves=zoneTheme({floor:['slab',{h:150,s:8,l:11,lv:2,crack:'rgba(120,200,140,.18)'}],wall:['rock',{h:150,s:10,l:13}],detail:'marsh',grade:[0.42,'#a8c0b8'],void:'#020403',torch:'150,230,170',
    poison:THEMES.marsh.poison,deco:decoOf([[0.03,shroom],[0.02,(x,px,py)=>dot(x,px+rand(6,34),py+rand(6,34),rand(4,8),'rgba(120,200,180,.12)')]])});
  zoneProps('a3caves',[['puddle',4,0],['stalag',2,0],['cshroom',2,0],['bones',2,0],['debris',2,0],['chains',1,0]],'#3a4a42');
  THEMES.a3village=zoneTheme({floor:['earth',{h:40,s:22,l:13}],wall:['brick',{h:30,s:22,l:20,trim:'hsl(30,30%,28%)'}],detail:'marsh',grade:[0.42,'#b4bcb0'],void:'#020806',torch:'190,255,140',
    voidT:water(190,8),poison:THEMES.marsh.poison,deco:decoOf([[0.03,reeds],[0.02,leaves]])});
  zoneProps('a3village',[['crate',2,0],['log',3,0],['puddle',2,0],['urn',1.5,0],['bones',1.5,0],['cage',1,1]],'#4a3a2a');
  THEMES.a3trench=zoneTheme({floor:['earth',{h:20,s:18,l:10,fleck:'rgba(140,40,30,.15)'}],wall:['rock',{h:60,s:12,l:13}],detail:'marsh',flat:1,grade:[0.44,'#bcb8a8'],void:'#040302',
    poison:THEMES.marsh.poison,deco:decoOf([[0.04,reeds],[0.015,(x,px,py)=>dot(x,px+20,py+20,rand(5,9),'rgba(120,20,20,.25)')]])});
  zoneProps('a3trench',[['bones',3,0],['log',2,0],['puddle',4,0],['tree',1,0]],'#3a2a22');
  QGIVER[2].robe='#3a4a2a';}
// ---------- Act 4: the Frozen Citadel ----------
Object.assign(ZFLOOR,{
  snow(x,px,py,o){x.fillStyle=`hsl(${o.h},${o.s}%,${o.l+Math.random()*2}%)`;x.fillRect(px,py,TILE,TILE);
    for(let k=0;k<2;k++)AH.dot(x,px+rand(0,40),py+rand(0,40),rand(8,15),Math.random()<0.5?'rgba(255,255,255,.06)':'rgba(40,60,90,.06)');
    for(let k=0;k<3;k++)AH.dot(x,px+rand(2,38),py+rand(2,38),rand(0.6,1.4),'rgba(255,255,255,.25)');},
  ice(x,px,py,o){x.fillStyle=`hsl(${o.h+rand(-3,3)},${o.s}%,${o.l+Math.random()*1.5}%)`;x.fillRect(px,py,TILE,TILE);
    x.strokeStyle='rgba(235,248,255,.16)';x.lineWidth=1.5;x.beginPath();const a=rand(0,3);x.moveTo(px+20-Math.cos(a)*18,py+20-Math.sin(a)*18);x.lineTo(px+20+Math.cos(a)*18,py+20+Math.sin(a)*18);x.stroke();
    if(Math.random()<0.15)AH.crack(x,px,py,'rgba(210,240,255,.3)');}
});
Object.assign(ZWALL,{
  snowrock(x,px,py,below,adj,o){AH.rockWall(x,px,py,adj,o.h,o.s,o.l);if(!adj)return;x.fillStyle='rgba(240,248,255,.85)';x.beginPath();x.ellipse(px+18,py+12,rand(12,17),rand(6,9),0,0,TAU);x.fill();
    x.fillStyle='rgba(200,220,240,.5)';x.beginPath();x.ellipse(px+20,py+16,rand(8,12),rand(3,5),0,0,TAU);x.fill();},
  crystal(x,px,py,below,adj,o){x.fillStyle=adj?`hsl(${o.h},30%,${o.l}%)`:'#050a12';x.fillRect(px,py,TILE,TILE);if(!adj)return;
    for(let k=0;k<3;k++){const cx=px+rand(6,34),cy=py+rand(10,34),h=rand(10,22);x.fillStyle=`hsla(${o.h+rand(-10,10)},60%,${rand(55,75)}%,.8)`;x.beginPath();x.moveTo(cx-5,cy);x.lineTo(cx,cy-h);x.lineTo(cx+5,cy);x.closePath();x.fill();}
    if(below)AH.face(x,px,py,`hsl(${o.h},30%,${o.l*1.3}%)`,`hsl(${o.h},50%,70%)`);},
  citadel(x,px,py,below,adj){THEMES.citadel.wall(x,px,py,below,adj);}
});
Object.assign(LAYOUT,{
  // Crevasse: a snowfield of drifts cut by long chasm cracks, each crossed by a few snow bridges.
  crevasse(){const g=newGrid(1),T=G.terrain;for(let j=2;j<MH-2;j++)for(let i=2;i<MW-2;i++)g[j*MW+i]=0;
    for(let k=0;k<44;k++){const side=k%4,t=rand(2,MW-3);const [x,y]=side===0?[t,2]:side===1?[t,MH-3]:side===2?[2,t]:[MW-3,t];blob(x,y,rand(1.5,4),q=>g[q]=1);}
    for(let k=0;k<55;k++)blob(rand(5,MW-6),rand(5,MH-6),rand(0.7,2),q=>g[q]=1);
    for(let c=0;c<4;c++){const vert=c%2===0;let x=vert?rand(12,MW-13):3,y=vert?3:rand(12,MH-13),a=vert?Math.PI/2:0;const pts=[];
      for(let s=0;s<140;s++){a+=rand(-0.18,0.18);a=vert?clamp(a,Math.PI/2-0.7,Math.PI/2+0.7):clamp(a,-0.7,0.7);x+=Math.cos(a);y+=Math.sin(a);if(x<2||y<2||x>MW-3||y>MH-3)break;pts.push([x,y,a]);
        blob(x,y,rand(1.1,1.8),q=>{g[q]=2;T[q]=0;});}
      for(let b=0;b<3;b++){const [bx,by,ba]=pts[Math.floor(pts.length*(b+0.5)/3)]||pts[0];const pa=ba+Math.PI/2;causeway(bx-Math.cos(pa)*4,by-Math.sin(pa)*4,bx+Math.cos(pa)*4,by+Math.sin(pa)*4,1);}}
    keepConnected();const regs=pickRegions(14,9);const start=regs.slice().sort((a,b)=>(a.cx+a.cy)-(b.cx+b.cy))[0];return finishLayout(regs,start,null);},
  // Pass: switchback ledges over an open drop, a cliff face above each, alcoves and rope-bridge shortcuts.
  pass(){const g=newGrid(2);for(let i=0;i<MW;i++){g[i]=1;g[(MH-1)*MW+i]=1;}for(let j=0;j<MH;j++){g[j*MW]=1;g[j*MW+MW-1]=1;}
    const rows=[7,19,31,43,55],regs=[];let pts=[];let dir=Math.random()<0.5?1:-1,x=dir>0?5:MW-6;
    rows.forEach((y,ri)=>{const x1=dir>0?MW-6:5;for(;dir>0?x<=x1:x>=x1;x+=dir){const yy=y+Math.sin(x*0.3+ri)*1.5;carveDisc(x,yy,rand(1.6,2.1));pts.push([x,yy]);
        for(let j=Math.round(yy)-4;j<=Math.round(yy)-3;j++)if(inner(x,j)&&g[j*MW+x]===2)g[j*MW+x]=1;} // cliff above
      if(ri<rows.length-1)for(let yy=y;yy<=rows[ri+1];yy++){carveDisc(x-dir,yy,1.7);pts.push([x-dir,yy]);}dir=-dir;x-=dir*2;});
    pts.forEach(([px,py],k)=>{if(k%30===15){const oy=Math.random()<0.5?3.5:-3.5;carveDisc(px,py+oy,2.6);regs.push(regionAt(px,py+oy));}if(k%18===0)regs.push(regionAt(px,py));});
    for(let k=0;k<2;k++){const ri=randi(0,rows.length-2),bx=randi(18,MW-19);causeway(bx,rows[ri]+1,bx,rows[ri+1]-1,0.8);}
    keepConnected();const start=regionAt(pts[0][0],pts[0][1]),exit=regionAt(pts[pts.length-1][0],pts[pts.length-1][1]);return finishLayout([start,...regs,exit],start,exit);},
  // Ice caves: caverns with bottomless pits and ice pillars.
  icecaves(){let n=0;for(let t=0;t<6&&n<1250;t++){cave(0.45,4);const g=G.grid;for(let k=0;k<6;k++)blob(rand(8,MW-9),rand(8,MH-9),rand(1.4,2.6),q=>{if(g[q]===0)g[q]=2;});
      for(let k=0;k<30;k++){const i=randi(3,MW-4),j=randi(3,MH-4);if(g[j*MW+i]===0)g[j*MW+i]=1;}n=keepConnected();}
    if(n<1050)return null;const regs=pickRegions(14,9);const start=regs.slice().sort((a,b)=>(b.cx+a.cy)-(a.cx+b.cy))[0];return finishLayout(regs,start,null);},
  // Bastion: walled keeps (gateways on the sides that bridge out) and round towers over the chasm, joined by long bridges.
  bastion(){const g=newGrid(2);for(let i=0;i<MW;i++){g[i]=1;g[(MH-1)*MW+i]=1;}for(let j=0;j<MH;j++){g[j*MW]=1;g[j*MW+MW-1]=1;}
    const CX=4,CY=3,cw=Math.floor((MW-2)/CX),ch=Math.floor((MH-2)/CY),K=[];
    for(let gy=0;gy<CY;gy++)for(let gx=0;gx<CX;gx++){const mx=1+gx*cw+(cw>>1)+randi(-1,1),my=1+gy*ch+(ch>>1)+randi(-1,1),tower=Math.random()<0.3;
      if(tower){blob(mx,my,4.2,q=>g[q]=1);carveDisc(mx,my,3);}else{const w=randi(9,12),h=randi(9,13),x0=mx-(w>>1),y0=my-(h>>1);wallRect(x0,y0,x0+w-1,y0+h-1);carveRect(x0+1,y0+1,x0+w-2,y0+h-2);
        if(Math.random()<0.6)for(const [a,b] of [[x0+3,y0+3],[x0+w-4,y0+3],[x0+3,y0+h-4],[x0+w-4,y0+h-4]])g[b*MW+a]=1;}
      K.push({x:mx,y:my,gx,gy});}
    const link=(a,b)=>{const hz=a.gy===b.gy;if(hz)causeway(a.x,a.y,b.x,a.y,1.05);else causeway(a.x,a.y,a.x,b.y,1.05);};
    const par=[...Array(CX*CY).keys()],root=i=>par[i]===i?i:(par[i]=root(par[i])),edges=[];
    for(let gy=0;gy<CY;gy++)for(let gx=0;gx<CX;gx++){const i=gy*CX+gx;if(gx<CX-1)edges.push([i,i+1]);if(gy<CY-1)edges.push([i,i+CX]);}
    for(const [i,j] of shuffle(edges)){const ri=root(i),rj=root(j);if(ri!==rj){par[ri]=rj;link(K[i],K[j]);}else if(Math.random()<0.25)link(K[i],K[j]);}
    keepConnected();const regs=K.map(k=>regionAt(k.x,k.y+(g[(k.y)*MW+k.x]?2:0)));return finishLayout(regs,regs[0],null);},
  // Frozen lake: pine shores around a great frozen lake (its ice marked in G.road for the theme) with holes and rock islands.
  frozenlake(){const g=newGrid(1),ice=new Uint8Array(MW*MH);G.road=ice;for(let j=2;j<MH-2;j++)for(let i=2;i<MW-2;i++)g[j*MW+i]=0;
    for(let k=0;k<60;k++){const side=k%4,t=rand(2,MW-3);const [x,y]=side===0?[t,2]:side===1?[t,MH-3]:side===2?[2,t]:[MW-3,t];blob(x,y,rand(2,5),q=>g[q]=1);}
    const cx=MW/2+rand(-4,4),cy=MH/2+rand(-4,4),rx=rand(19,23),ry=rand(16,20);
    for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){const d=((i-cx)/rx)**2+((j-cy)/ry)**2;if(d<1+rand(-0.06,0.06))ice[j*MW+i]=1;else if(d<1.5&&g[j*MW+i]===0&&Math.random()<0.05)blob(i,j,rand(0.8,1.8),q=>g[q]=1);}
    for(let k=0;k<7;k++){const a=rand(0,TAU),d=rand(0.2,0.75);blob(cx+Math.cos(a)*rx*d,cy+Math.sin(a)*ry*d,rand(1,2.2),q=>{if(g[q]===0)g[q]=2;});} // holes in the ice
    for(let k=0;k<5;k++){const a=rand(0,TAU),d=rand(0.1,0.7);blob(cx+Math.cos(a)*rx*d,cy+Math.sin(a)*ry*d,rand(1,2),q=>g[q]=1);} // rocks
    for(let k=0;k<70;k++)blob(rand(4,MW-5),rand(4,MH-5),rand(0.6,1.8),q=>{if(!ice[q])g[q]=1;}); // pines on the shore
    keepConnected();const regs=pickRegions(15,9);const start=regs.slice().sort((a,b)=>a.cx-b.cx)[0];return finishLayout(regs,start,null);}
});
Object.assign(ZONES,{
  a4z1:{act:4,depth:16,name:'The Whiteout',sub:'Snow to the horizon, and cracks with no bottom',layout:'crevasse',theme:'a4snow',
    next:'a4z2',side:'a4s1',gate:'boss',boss:'frostjaw',su:['whitepelt','snowblind'],density:1.25},
  a4z2:{act:4,depth:17,name:'The Shattered Stair',sub:'The citadel road, cut into the cliff and half fallen away',layout:'pass',theme:'a4pass',
    next:'a4z3',gate:'key',key:'Rime Key',boss:'avwitch',su:['cliffwalker','svala'],density:1.35,roster:[['shardling',3.4],['frostwraith',3],['icegolem',1.2]]},
  a4z3:{act:4,depth:18,name:'The Frozen Depths',sub:'Caverns of blue ice under the citadel',layout:'icecaves',theme:'a4ice',
    next:'a4z4',gate:'seals',boss:'matriarch',su:['splinter','glimmer'],density:1.4,roster:[['shardling',4],['icegolem',1.6],['frostwraith',2]]},
  a4z4:{act:4,depth:19,name:'The Hanging Bastion',sub:'Keeps chained over the abyss, still manned',layout:'bastion',theme:'a4bastion',
    next:'a4z5',gate:'boss',boss:'vosk',su:['frostknight','bellringer'],density:1.5,roster:[['frostwraith',3],['icegolem',1.8],['shardling',2],['archer',1.5]]},
  a4z5:{act:4,depth:20,name:"Rimeheart's Throne",sub:'The Frozen King has not moved in a hundred years',layout:'boss',next:null,gate:'actboss'},
  a4s1:{act:4,depth:16,name:'The Sunless Lake',sub:'Ice a fathom thick, and something under it',layout:'frozenlake',theme:'a4lake',parent:'a4z1',
    gate:'none',boss:'ymra',su:['oldtusk'],density:1.35,captive:'scout',roster:[['frostwraith',3],['icegolem',1.6],['shardling',3]]}
});
Object.assign(ZBOSS,{
  frostjaw:{name:'Frostjaw, the Yeti King',r:32,hp:1.15,dmg:1.05,spd:78,moves:['avalanche','roar'],quest:'a4q1'},
  avwitch:{name:'The Avalanche Witch',r:24,hp:0.8,dmg:1.1,spd:66,moves:['icicles','blizzard'],ranged:1},
  matriarch:{name:'The Crystal Matriarch',r:28,hp:1.2,dmg:1.05,spd:60,moves:['shardburst','bonecage'],quest:'a4q3'},
  vosk:{name:'Commander Vosk, the Last Sentinel',r:28,hp:1.3,dmg:1.1,spd:70,moves:['shieldcharge','sentinels']},
  ymra:{name:'Ymra, the Lake Wyrm',r:30,hp:1.3,dmg:1.05,spd:80,moves:['breach','chill'],wide:1}
});
Object.assign(SUPERU,{
  whitepelt:{name:'Whitepelt',base:'icegolem',affs:['fast']},snowblind:{name:'The Snowblind',base:'frostwraith',affs:['shielded']},
  cliffwalker:{name:'Cliffwalker',base:'shardling',affs:['fast','explodes']},svala:{name:'Grim Svala',base:'frostwraith',affs:['vampiric']},
  splinter:{name:'Splinter',base:'shardling',affs:['summoner']},glimmer:{name:'Glimmer',base:'icegolem',affs:['shielded']},
  frostknight:{name:'The Frostbitten Knight',base:'icegolem',affs:['vampiric']},bellringer:{name:'The Bellringer',base:'frostwraith',affs:['summoner']},
  oldtusk:{name:'Old Tusk',base:'icegolem',affs:['fast','vampiric']}
});
CAPTIVES.scout={name:'Frozen Scout',who:'Scout',free:'The scout is free!',say:'"Tell the Jarl the lake is not empty."',quest:'a4q2',col:'#4a5a7a'};
QGIVER[3]={name:'Jarl Hessa',robe:'#5a4a3a',staff:'#3a2a1a'};
Object.assign(QUESTS,{
  a4q1:{act:4,name:'The Yeti King',goal:'Slay Frostjaw in The Whiteout',story:'"He takes a hunter from us every moon. This moon, take him."',reward:'sp',rtext:'+1 skill point'},
  a4q2:{act:4,name:'The Lost Scout',goal:'Free the scout held at The Sunless Lake',story:'"I sent my best scout to the lake. Her horn stopped three days ago."',reward:'stones',rtext:'gems, runes and gold'},
  a4q3:{act:4,name:'The Crystal Matriarch',goal:'Slay the Crystal Matriarch in The Frozen Depths',story:'"The ice under the citadel is growing. Something is growing it."',reward:'uq',rtext:'a unique item'},
  a4q4:{act:4,name:'Rimeheart',goal:"Defeat Rimeheart in Rimeheart's Throne",story:'"End the winter. End the king."',reward:'sp',rtext:'+1 skill point'}});
Object.assign(ZB_MOVES,{
  // three boulders roll at you along telegraphed lanes
  avalanche(e){e.busy=1.6;for(let i=0;i<3;i++)bossLater(e,i*0.35,()=>{const a=aimAt(e)+(i-1)*0.32;lineStrike(e,e.x,e.y,a,380,54,0.8,e.dmg*1.4,'#e8f4ff');});},
  roar(e){e.busy=1;e.wind=0.9;e.tele={r:170,col:'#bfe8ff'};e.act=()=>{const p=G.p;if(Math.hypot(p.x-e.x,p.y-e.y)<170+p.r&&dmgPlayer(e.dmg*1.5,e))slowPlayer(0.5,2);G.fx.push({type:'ring',x:e.x,y:e.y,r0:20,r1:170,t:0,max:0.4,col:'#bfe8ff'});G.shake=Math.max(G.shake,8);};},
  icicles(e){e.busy=1.2;const a=aimAt(e);for(let i=0;i<7;i++)bossLater(e,i*0.1,()=>{const d=70+i*55,x=e.x+Math.cos(a)*d+rand(-20,20),y=e.y+Math.sin(a)*d+rand(-20,20);groundStrike(e,x,y,40,0.75,e.dmg*1.2,'#bfe8ff');});},
  blizzard(e){e.busy=0.8;for(let i=0;i<4;i++)bossLater(e,i*0.2,()=>{const [x,y]=i?near(170):[G.p.x,G.p.y];groundStrike(e,x,y,54,0.9,e.dmg*0.9,'#dff4ff',()=>addEHaz(x,y,52,5,e.dmg*0.3,'frost'));});},
  // crystals grow around her and burst into shards
  shardburst(e){e.busy=1.3;for(let k=0;k<4;k++){const a=k/4*TAU+rand(-0.3,0.3),x=e.x+Math.cos(a)*110,y=e.y+Math.sin(a)*110;G.fx.push({type:'tele',x,y,r:26,t:0,max:0.8,col:'#9fd8ff'});
    bossLater(e,0.8,()=>{for(let n=0;n<8;n++)enemyShoot({x,y,dead:false},n/8*TAU+k,210,'#bfe8ff',e.dmg*0.5,6);burst(x,y,12,'#bfe8ff',150);});}},
  shieldcharge(e){const a=aimAt(e);e.busy=1.3;lineStrike(e,e.x,e.y,a,320,56,0.7,e.dmg*1.6,'#c8d0e0');bossLater(e,0.7,()=>{moveEnt(e,Math.cos(a)*300,Math.sin(a)*300);G.shake=Math.max(G.shake,8);});},
  sentinels(e){e.busy=1;ring(e,16,180,'#bfe8ff',e.dmg*0.5,6,rand(0,TAU),0,{slow:0.35});bossLater(e,0.5,()=>bossSummon(e,'frostwraith',2,4));},
  breach(e){const p=G.p,x=p.x,y=p.y;e.busy=1.5;burst(e.x,e.y,20,'#bfe8ff',160);groundStrike(e,x,y,76,1.1,e.dmg*1.8,'#9fd8ff',()=>{if(!blockedAt(x,y,e.r)){e.x=x;e.y=y;}G.shake=Math.max(G.shake,9);ring(e,8,170,'#bfe8ff',e.dmg*0.45,6,rand(0,TAU),0,{slow:0.4});});}
});
Object.assign(ZB_PAINT,{
  frostjaw:(x,r,f)=>{walker(x,r,f,{skin:'#c8d4dc',torso:'#dfe8ee',sleeve:'#d0dce4',boot:'#8a98a4',chest:0.62,wide:0.98,head:0.3,headX:0.38,armY:0.98,reach:0.3,
    torsoDeco:(x,r)=>AH.dot(x,-r*0.1,0,r*0.3,'rgba(150,170,190,.25)'),headDeco:(x,r)=>{for(const sd of [-1,1]){x.fillStyle='#e8e0c8';path(x,[[r*0.4,sd*r*0.15],[r*0.75,sd*r*0.32],[r*0.45,sd*r*0.28]]);x.fill();}eyes(x,r*0.55,r*0.12,r*0.04,'#5ad8ff');}});},
  avwitch:(x,r,f)=>{robe('#9ab0c8','#e8f4ff','#bfe8ff')(x,r,f);for(let k=0;k<5;k++){const a=-0.8+k*0.4;x.fillStyle='rgba(220,240,255,.9)';path(x,[[r*0.25+Math.cos(a)*r*0.3,Math.sin(a)*r*0.3],[r*0.25+Math.cos(a)*r*0.65,Math.sin(a)*r*0.65],[r*0.25+Math.cos(a+0.15)*r*0.3,Math.sin(a+0.15)*r*0.3]]);x.fill();}},
  matriarch:(x,r,f)=>{PAINT.shard(x,r,f);PAINT.shard(x,r*0.7,f);const g=x.createRadialGradient(0,0,0,0,0,r*0.5);g.addColorStop(0,'rgba(220,250,255,1)');g.addColorStop(1,'rgba(120,200,255,0)');x.fillStyle=g;x.beginPath();x.arc(0,0,r*0.5,0,TAU);x.fill();},
  vosk:(x,r,f)=>{walker(x,r,f,{skin:'#8a9aa8',torso:'#5a6a7a',sleeve:'#4a5a6a',boot:'#2a3440',chest:0.58,wide:0.94,head:0.32,headX:0.2,
      headDeco:(x,r)=>{oval(x,r*0.2,0,r*0.34,r*0.33,'#7a8a9a',1.2);x.fillStyle='#101820';x.fillRect(r*0.38,-r*0.18,r*0.08,r*0.36);eyes(x,r*0.42,r*0.08,r*0.03,'#7fe8ff');}});
    oval(x,r*0.4,r*0.85,r*0.22,r*0.45,'#6a7a8a',1.3);x.strokeStyle='#bfe8ff';x.lineWidth=1.5;x.beginPath();x.ellipse(r*0.4,r*0.85,r*0.12,r*0.3,0,0,TAU);x.stroke();},
  ymra:(x,r,f)=>{PAINT.worm(x,r,f);x.globalAlpha=0.6;for(let k=0;k<=4;k++){x.fillStyle='#4a6a8a';x.beginPath();x.ellipse(-k*r*0.62,0,r*(1-k*0.13),r*(0.95-k*0.12),0,0,TAU);x.fill();}x.globalAlpha=1;
    for(let k=1;k<=4;k++){x.fillStyle='rgba(220,240,255,.8)';path(x,[[-k*r*0.62,-r*0.2],[-k*r*0.62-r*0.15,-r*0.55],[-k*r*0.62+r*0.1,-r*0.2]]);x.fill();}}
});
{const {dot,glow}=AH;
  const pine=(x,px,py)=>{const cx=px+20,cy=py+28;dot(x,cx+3,cy+3,12,'rgba(0,0,0,.35)');for(let k=0;k<3;k++){x.fillStyle=`hsl(150,${20+k*4}%,${10+k*4}%)`;x.beginPath();x.moveTo(cx-12+k*3,cy-k*7);x.lineTo(cx,cy-16-k*7);x.lineTo(cx+12-k*3,cy-k*7);x.fill();}x.fillStyle='rgba(240,250,255,.6)';x.fillRect(cx-3,cy-30,6,3);};
  const drift=(x,px,py)=>{x.fillStyle='rgba(255,255,255,.12)';x.beginPath();x.ellipse(px+20,py+22,rand(10,18),rand(4,8),0,0,TAU);x.fill();};
  const crys=(x,px,py)=>{const cx=px+rand(10,30),cy=py+rand(14,30);addLight(cx,cy-6,70,0.4,'170,215,255',0.25,0);x.fillStyle='rgba(180,225,255,.75)';x.beginPath();x.moveTo(cx,cy-14);x.lineTo(cx+5,cy);x.lineTo(cx-5,cy);x.fill();};
  const lakeWater=(x,px,py,i,j,at)=>{x.fillStyle=`hsl(205,40%,${9+Math.random()}%)`;x.fillRect(px,py,TILE,TILE);x.strokeStyle='rgba(220,240,255,.5)';x.lineWidth=2;
    if(at(i,j-1)===0)x.fillRect(px,py,TILE,3);if(at(i-1,j)===0)x.fillRect(px,py,3,TILE);if(at(i+1,j)===0)x.fillRect(px+TILE-3,py,3,TILE);if(at(i,j+1)===0)x.fillRect(px,py+TILE-3,TILE,3);};
  THEMES.a4snow=zoneTheme({floor:['snow',{h:210,s:16,l:62}],wall:['snowrock',{h:210,s:10,l:30}],detail:'citadel',flat:1,grade:[0.3,'#d4e0ec'],void:'#02050b',voidT:THEMES.citadel.voidT,
    deco:decoOf([[0.04,drift],[0.008,crys]])});
  zoneProps('a4snow',[['ice',3,0],['bones',1.5,0],['debris',2,0],['tree',1.5,0]],'#8a9aaa');
  THEMES.a4pass=zoneTheme({floor:['slab',{h:215,s:8,l:24,lv:3,crack:'rgba(200,235,255,.18)'}],wall:['snowrock',{h:215,s:8,l:22}],detail:'citadel',grade:[0.34,'#c8d4e4'],void:'#02050b',voidT:THEMES.citadel.voidT,torch:'255,165,85',
    deco:decoOf([[0.03,drift],[0.01,crys]])});
  zoneProps('a4pass',[['ice',2,0],['debris',3,0],['pillar',1,0],['bones',1,0]],'#7a8a9a');
  THEMES.a4ice=zoneTheme({floor:['ice',{h:200,s:40,l:30}],wall:['crystal',{h:200,l:18}],detail:'citadel',grade:[0.3,'#bcd8f0'],void:'#01040a',voidT:THEMES.citadel.voidT,torch:null,
    deco:decoOf([[0.03,crys],[0.02,drift]])});
  zoneProps('a4ice',[['ice',5,0],['debris',1,0],['bones',1,0]],'#9ab8d0');
  THEMES.a4bastion=zoneTheme({floor:['slab',{h:206,s:13,l:21,lv:3}],wall:['citadel',{}],detail:'citadel',grade:[0.38,'#c4d0e0'],void:'#02050b',voidT:THEMES.citadel.voidT,bridge:THEMES.citadel.bridge,torch:'255,160,80',
    deco:decoOf([[0.016,crys],[0.03,drift]])});
  zoneProps('a4bastion',[['pillar',3,0],['ice',2,0],['cage',1.5,1],['chains',1.5,0],['debris',2,0]],'#7a8a9a');
  THEMES.a4lake=zoneTheme({floor:['snow',{h:205,s:14,l:58}],road:['ice',{h:200,s:45,l:42}],wall:['tree',{h:150}],detail:'citadel',flat:1,grade:[0.3,'#d0dcec'],void:'#020610',voidT:lakeWater,
    deco:decoOf([[0.03,drift],[0.015,pine]])});
  zoneProps('a4lake',[['tree',3,0],['ice',2,0],['log',2,0],['bones',1,0]],'#8a9aaa');}
// ---------- Act 5: the Ember Core ----------
Object.assign(ZFLOOR,{
  ash(x,px,py,o){x.fillStyle=`hsl(${o.h},${o.s}%,${o.l+Math.random()*1.5}%)`;x.fillRect(px,py,TILE,TILE);
    for(let k=0;k<5;k++)AH.dot(x,px+rand(2,38),py+rand(2,38),rand(0.7,1.8),Math.random()<0.7?'rgba(0,0,0,.3)':'rgba(200,190,180,.12)');
    if(Math.random()<0.08){const cx=px+rand(6,34),cy=py+rand(6,34);AH.dot(x,cx,cy,1.4,'#ff8a3a');}if(Math.random()<0.1)AH.crack(x,px,py,'rgba(255,90,20,.4)',1.2);},
  plate(x,px,py,o){x.fillStyle=`hsl(${o.h},${o.s}%,${o.l+rand(-1,1)}%)`;x.fillRect(px,py,TILE,TILE);x.strokeStyle='rgba(0,0,0,.5)';x.lineWidth=1.5;x.strokeRect(px+1,py+1,TILE-2,TILE-2);
    for(const [a,b] of [[5,5],[35,5],[5,35],[35,35]])AH.dot(x,px+a,py+b,1.6,'rgba(160,150,140,.4)');if(Math.random()<0.1)AH.dot(x,px+rand(8,32),py+rand(8,32),rand(4,8),'rgba(255,100,30,.12)');}
});
Object.assign(ZWALL,{
  basalt(x,px,py,below,adj){THEMES.ember.wall(x,px,py,below,adj);},
  obsidian(x,px,py,below,adj,o){if(!adj){x.fillStyle='#050202';x.fillRect(px,py,TILE,TILE);return;}x.fillStyle='#0c0808';x.fillRect(px,py,TILE,TILE);
    for(let k=0;k<3;k++){x.fillStyle=`hsl(${o.h},10%,${rand(8,16)}%)`;x.beginPath();const cx=px+rand(6,34),cy=py+rand(6,34);x.moveTo(cx,cy-rand(10,16));x.lineTo(cx+rand(6,10),cy+6);x.lineTo(cx-rand(6,10),cy+6);x.fill();}
    x.fillStyle='rgba(255,100,40,.18)';x.fillRect(px,py,TILE,2);}
});
Object.assign(LAYOUT,{
  // Lava flow: ash plains crossed by rivers of lava (void) with stone bridges, obsidian spires and burning pools.
  lavaflow(){const g=newGrid(1),T=G.terrain;for(let j=2;j<MH-2;j++)for(let i=2;i<MW-2;i++)g[j*MW+i]=0;
    for(let k=0;k<44;k++){const side=k%4,t=rand(2,MW-3);const [x,y]=side===0?[t,2]:side===1?[t,MH-3]:side===2?[2,t]:[MW-3,t];blob(x,y,rand(1.5,4),q=>g[q]=1);}
    for(let k=0;k<40;k++)blob(rand(5,MW-6),rand(5,MH-6),rand(0.6,1.6),q=>g[q]=1);
    for(let c=0;c<3;c++){let x=rand(10,MW-11),y=3,a=Math.PI/2+rand(-0.4,0.4);const pts=[];if(c===1){x=3;y=rand(14,MH-15);a=rand(-0.3,0.3);}
      for(let s=0;s<150;s++){a+=rand(-0.2,0.2)+Math.sin(s*0.12)*0.05;x+=Math.cos(a);y+=Math.sin(a);if(x<2||y<2||x>MW-3||y>MH-3)break;pts.push([x,y,a]);blob(x,y,rand(1.4,2.2),q=>{g[q]=2;T[q]=0;});}
      for(let b=0;b<3;b++){const [bx,by,ba]=pts[Math.floor(pts.length*(b+0.5)/3)]||pts[0];const pa=ba+Math.PI/2;causeway(bx-Math.cos(pa)*5,by-Math.sin(pa)*5,bx+Math.cos(pa)*5,by+Math.sin(pa)*5,1.05);}}
    for(let k=0;k<10;k++){const x=rand(4,MW-5),y=rand(4,MH-5);blob(x,y,rand(0.8,1.6),q=>{if(g[q]===0&&T[q]===0)T[q]=T_LAVA;});}
    keepConnected();const regs=pickRegions(14,9);const start=regs.slice().sort((a,b)=>(a.cx+a.cy)-(b.cx+b.cy))[0];return finishLayout(regs,start,null);},
  // Foundry: workshop halls in a grid (anvil pillars, molten channels across their floors) joined by long corridors.
  foundry(){const g=newGrid(1),T=G.terrain,H=[];const CX=4,CY=4,cw=15,ch=15;
    for(let gy=0;gy<CY;gy++)for(let gx=0;gx<CX;gx++){const w=randi(8,11),h=randi(7,10),x0=2+gx*cw+randi(0,cw-w-2),y0=2+gy*ch+randi(0,ch-h-2);carveRect(x0,y0,x0+w-1,y0+h-1);
      const r={x:x0,y:y0,w,h,cx:x0+(w>>1),cy:y0+(h>>1),gx,gy};H.push(r);
      if(Math.random()<0.5){const j=randi(y0+1,y0+h-2);for(let i=x0+1;i<x0+w-1;i++)T[j*MW+i]=T_LAVA;} // a molten channel
      if(Math.random()<0.5)for(const [a,b] of [[x0+2,y0+2],[x0+w-3,y0+h-3]])g[b*MW+a]=1;}
    const corr=(a,b)=>{if(a.gy===b.gy){const y=Math.round((a.cy+b.cy)/2);carveRect(Math.min(a.cx,b.cx),y-1,Math.max(a.cx,b.cx),y);}else{const x=Math.round((a.cx+b.cx)/2);carveRect(x-1,Math.min(a.cy,b.cy),x,Math.max(a.cy,b.cy));}};
    const par=[...Array(CX*CY).keys()],root=i=>par[i]===i?i:(par[i]=root(par[i])),edges=[];
    for(let gy=0;gy<CY;gy++)for(let gx=0;gx<CX;gx++){const i=gy*CX+gx;if(gx<CX-1)edges.push([i,i+1]);if(gy<CY-1)edges.push([i,i+CX]);}
    for(const [i,j] of shuffle(edges)){const ri=root(i),rj=root(j);if(ri!==rj){par[ri]=rj;corr(H[i],H[j]);}else if(Math.random()<0.15)corr(H[i],H[j]);}
    keepConnected();const regs=H.map(r=>regionAt(r.cx,r.cy-(T[r.cy*MW+r.cx]?2:0)));return finishLayout(regs,regs[0],null);},
  // Tubes: three long lava tubes winding across the map, joined by short cross-tunnels, with burning pools.
  tubes(){const g=newGrid(1),T=G.terrain,regs=[],tubes=[];
    for(let t=0;t<3;t++){const y0=10+t*20+rand(-3,3),pts=wander(3,y0,MW-4,y0+rand(-6,6),rand(1.6,2.1),1.05);tubes.push(pts);pts.forEach(([x,y],k)=>{if(k%14===7)regs.push(regionAt(x,y));if(k%40===20)carveDisc(x,y,3.2);});}
    for(let k=0;k<5;k++){const a=tubes[randi(0,1)],p=a[randi(5,a.length-6)],b=tubes[tubes.indexOf(a)+1],q=b.reduce((m,c)=>Math.abs(c[0]-p[0])<Math.abs(m[0]-p[0])?c:m,b[0]);wander(p[0],p[1],q[0],q[1],1.4,0.9);}
    for(let k=0;k<12;k++){const tb=tubes[randi(0,2)],[x,y]=tb[randi(4,tb.length-5)];blob(x,y,rand(0.8,1.5),q=>{if(g[q]===0)T[q]=T_LAVA;});}
    keepConnected();const start=regionAt(tubes[0][1][0],tubes[0][1][1]),last=tubes[2][tubes[2].length-2];return finishLayout([start,...regs,regionAt(last[0],last[1])],start,null);},
  // Caldera: rings of rock terraces around a central lava lake, joined by ramps, with a ragged outer rim.
  caldera(){const g=newGrid(1),T=G.terrain,cx=MW/2,cy=MH/2,regs=[];
    for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){const d=Math.hypot(i-cx,j-cy)+rand(-0.6,0.6);
      if(d<7)g[j*MW+i]=2;else if(d<10||d>13&&d<16.5||d>19.5&&d<23||d>26&&d<29.5)g[j*MW+i]=0;}
    const ramp=(r0,r1,a)=>{for(let r=r0;r<=r1;r+=0.5)carveDisc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,1.3);};
    const rings=[[8.5,14.8],[15,21],[21.5,27.5]];let a0=rand(0,TAU);
    rings.forEach(([r0,r1],k)=>{const n=k===2?3:2;for(let m=0;m<n;m++)ramp(r0,r1,a0+m*TAU/n+rand(-0.3,0.3));a0+=rand(1,2);});
    for(let k=0;k<26;k++){const a=rand(0,TAU),r=rand(9,29);blob(cx+Math.cos(a)*r,cy+Math.sin(a)*r,rand(0.5,1.1),q=>{if(g[q]===0)g[q]=1;});}
    for(let k=0;k<8;k++){const a=rand(0,TAU),r=rand(9,29);blob(cx+Math.cos(a)*r,cy+Math.sin(a)*r,rand(0.6,1.2),q=>{if(g[q]===0)T[q]=T_LAVA;});}
    for(const R of [8.5,14.8,21.2,27.8])for(let k=0;k<6;k++){const a=k/6*TAU+R;regs.push(regionAt(cx+Math.cos(a)*R,cy+Math.sin(a)*R));}
    keepConnected();const start=regs[regs.length-1];return finishLayout(regs,start,regs[0]);},
  // Quarry: a grid of lava pits and stone blocks with walkways between them.
  quarry(){const g=newGrid(1);for(let j=2;j<MH-2;j++)for(let i=2;i<MW-2;i++)g[j*MW+i]=0;const regs=[];
    const cuts=()=>{const c=[];let v=5;while(v+6<MW-5){const w=randi(5,8);c.push([v,v+w-1]);v+=w+randi(3,4);}return c;};
    for(const [y0,y1] of cuts())for(const [x0,x1] of cuts()){const v=Math.random();
      if(v<0.55){for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++)g[j*MW+i]=2;}else if(v<0.75)wallRect(x0,y0,x1,y1);else regs.push(regionAt((x0+x1)>>1,(y0+y1)>>1));
      regs.push(regionAt(x1+2,y1+2));}
    for(let k=0;k<30;k++){const side=k%4,t=rand(2,MW-3);const [x,y]=side===0?[t,2]:side===1?[t,MH-3]:side===2?[2,t]:[MW-3,t];blob(x,y,rand(1.2,2.6),q=>g[q]=1);}
    keepConnected();const start=regs.slice().sort((a,b)=>(a.cx+a.cy)-(b.cx+b.cy))[0];return finishLayout(regs,start,null);}
});
Object.assign(ZONES,{
  a5z1:{act:5,depth:21,name:'The Ashfall Plains',sub:'It has rained ash here for a thousand years',layout:'lavaflow',theme:'a5ash',
    next:'a5z2',gate:'boss',boss:'pyrrhus',su:['cinderwing','slag'],density:1.25},
  a5z2:{act:5,depth:22,name:'The Black Foundry',sub:'The forges of the deep, worked by the damned',layout:'foundry',theme:'a5foundry',
    next:'a5z3',side:'a5s1',gate:'key',key:'Foundry Key',boss:'overseer',su:['rivet','hound'],density:1.35,roster:[['magmabrute',2.4],['imp',3],['summoner',1.2]]},
  a5z3:{act:5,depth:23,name:'The Magma Tubes',sub:'Tunnels the lava carved on its way up',layout:'tubes',theme:'a5tubes',
    next:'a5z4',gate:'seals',boss:'coil',su:['scorch','embertongue'],density:1.4,roster:[['imp',4],['magmabrute',2],['summoner',1.6]]},
  a5z4:{act:5,depth:24,name:'The Caldera',sub:'The rim of the burning heart',layout:'caldera',theme:'a5caldera',
    next:'a5z5',gate:'boss',boss:'ixa',su:['choir','colossus'],density:1.5,roster:[['summoner',2],['imp',3.5],['magmabrute',2.2]]},
  a5z5:{act:5,depth:25,name:'The Ember Core',sub:'The Cinder King waits at the heart of the deep',layout:'boss',next:null,gate:'actboss'},
  a5s1:{act:5,depth:22,name:'The Slag Pits',sub:'Where the foundry throws what it cannot use',layout:'quarry',theme:'a5slag',parent:'a5z2',
    gate:'none',boss:'slavemaster',su:['gorger'],density:1.35,captive:'forgeslave',roster:[['magmabrute',2.4],['imp',3],['grunt',1.5]]}
});
Object.assign(ZBOSS,{
  pyrrhus:{name:'Pyrrhus the Ash-Drake',r:30,hp:1.15,dmg:1.05,spd:86,moves:['firebreath','meteor'],quest:'a5q1'},
  overseer:{name:'The Iron Overseer',r:30,hp:1.3,dmg:1.1,spd:60,moves:['hammer','bellows']},
  coil:{name:'The Molten Coil',r:30,hp:1.25,dmg:1.05,spd:84,moves:['magmaburst','lavatrail'],quest:'a5q3',wide:1},
  ixa:{name:'High Pyromancer Ixa',r:24,hp:0.85,dmg:1.15,spd:66,moves:['pyres','firewall'],ranged:1},
  slavemaster:{name:'The Slavemaster',r:28,hp:1.25,dmg:1.1,spd:76,moves:['hook','brand']}
});
Object.assign(SUPERU,{
  cinderwing:{name:'Cinderwing',base:'imp',affs:['vampiric'],hp:3},slag:{name:'Slag',base:'magmabrute',affs:['shielded']},
  rivet:{name:'Rivet',base:'imp',affs:['fast','explodes'],hp:3},hound:{name:"The Overseer's Hound",base:'magmabrute',affs:['fast']},
  scorch:{name:'Scorch',base:'summoner',affs:['shielded']},embertongue:{name:'Ember-Tongue',base:'imp',affs:['summoner'],hp:3},
  choir:{name:'The Burning Choir',base:'summoner',affs:['explodes']},colossus:{name:'Ashen Colossus',base:'magmabrute',affs:['vampiric']},
  gorger:{name:'Gorger',base:'magmabrute',affs:['vampiric','fast']}
});
CAPTIVES.forgeslave={name:'Chained Forge-Slave',who:'Forge-slave',free:'The slave is free!',say:'"Cinderforge? I will walk there on these burns if I must."',quest:'a5q2',col:'#5a3a2a'};
QGIVER[4]={name:'Forgemaster Odda',robe:'#4a2a1a',staff:'#2a2a2a'};
Object.assign(QUESTS,{
  a5q1:{act:5,name:'The Ash-Drake',goal:'Slay Pyrrhus the Ash-Drake in The Ashfall Plains',story:'"A drake of ash hunts the plains. Our ore carts never make it back."',reward:'sp',rtext:'+1 skill point'},
  a5q2:{act:5,name:'Unchained',goal:'Free the forge-slave held in The Slag Pits',story:'"They took smiths from us to work their foundry. Bring one home."',reward:'pot',rtext:'+1 potion charge'},
  a5q3:{act:5,name:'The Molten Coil',goal:'Slay the Molten Coil in The Magma Tubes',story:'"Something swims in the magma under the foundry, and it is getting bigger."',reward:'uq',rtext:'a unique item'},
  a5q4:{act:5,name:'The Cinder King',goal:'Defeat the Cinder King in The Ember Core',story:'"Put out the heart of the deep."',reward:'sp',rtext:'+1 skill point'}});
Object.assign(ZB_MOVES,{
  firebreath(e){const a=aimAt(e);e.busy=1.3;for(let k=-2;k<=2;k++)lineStrike(e,e.x,e.y,a+k*0.22,300,40,0.8,e.dmg*1.2,'#ff8a3a');bossLater(e,0.8,()=>{for(let k=0;k<3;k++){const d=90+k*80;addEHaz(e.x+Math.cos(a)*d,e.y+Math.sin(a)*d,44,3,e.dmg*0.3,'fire');}});},
  meteor(e){e.busy=1;for(let i=0;i<3;i++)bossLater(e,i*0.3,()=>{const [x,y]=i?near(160):[G.p.x,G.p.y];groundStrike(e,x,y,78,1.1,e.dmg*1.6,'#ff6a2a',()=>{addEHaz(x,y,60,4,e.dmg*0.35,'fire');G.shake=Math.max(G.shake,8);});});},
  hammer(e){e.busy=1.4;e.wind=0.8;e.tele={r:110,col:'#ff8a3a'};e.act=()=>{const p=G.p;if(Math.hypot(p.x-e.x,p.y-e.y)<110+p.r)dmgPlayer(e.dmg*1.7,e);G.shake=Math.max(G.shake,10);G.fx.push({type:'ring',x:e.x,y:e.y,r0:10,r1:110,t:0,max:0.3,col:'#ff8a3a'});
    const a=aimAt(e);for(let k=0;k<4;k++)lineStrike(e,e.x,e.y,a+k*Math.PI/2+Math.PI/4,300,36,0.6,e.dmg*1.1,'#ffaa44');};},
  bellows(e){e.busy=1;for(let w=0;w<3;w++)bossLater(e,w*0.35,()=>ring(e,14,200,'#ff8a3a',e.dmg*0.5,7,rand(0,TAU)));},
  magmaburst(e){const p=G.p,x=p.x,y=p.y;e.busy=1.5;groundStrike(e,x,y,80,1.1,e.dmg*1.8,'#ff6a2a',()=>{if(!blockedAt(x,y,e.r)){e.x=x;e.y=y;}addEHaz(x,y,64,4,e.dmg*0.35,'fire');G.shake=Math.max(G.shake,9);});},
  lavatrail(e){e.busy=1.2;const a=aimAt(e);for(let i=0;i<6;i++)bossLater(e,i*0.15,()=>{moveEnt(e,Math.cos(a)*45,Math.sin(a)*45);addEHaz(e.x,e.y,40,4,e.dmg*0.4,'fire');});ring(e,10,170,'#ff8a3a',e.dmg*0.45,7,rand(0,TAU));},
  firewall(e){const a=aimAt(e)+Math.PI/2,p=G.p;e.busy=1;for(let k=-3;k<=3;k++){const x=p.x+Math.cos(a)*k*55,y=p.y+Math.sin(a)*k*55;if(wallAt(Math.floor(x/TILE),Math.floor(y/TILE)))continue;groundStrike(e,x,y,40,1,e.dmg*1.2,'#ff6a2a',()=>addEHaz(x,y,38,4,e.dmg*0.35,'fire'));}},
  brand(e){e.busy=0.9;for(let i=0;i<4;i++)bossLater(e,i*0.22,()=>{const x=G.p.x+rand(-30,30),y=G.p.y+rand(-30,30);groundStrike(e,x,y,46,0.8,e.dmg*1.3,'#ff9a4a',()=>addEHaz(x,y,36,3,e.dmg*0.3,'fire'));});}
});
Object.assign(ZB_PAINT,{
  pyrrhus:(x,r,f)=>{PAINT.imp(x,r*0.9,f);oval(x,-r*0.1,0,r*0.5,r*0.45,'#3a2a26',1.3);for(let k=0;k<5;k++)AH.dot(x,-r*0.5+k*r*0.2,0,r*0.06,'#ff8a3a');eyes(x,r*0.45,r*0.1,r*0.04,'#ffb040');},
  overseer:(x,r,f)=>{PAINT.golem(x,r,f);x.globalAlpha=0.6;x.fillStyle='#2a2220';x.beginPath();x.arc(0,0,r*0.95,0,TAU);x.fill();x.globalAlpha=1;for(let k=0;k<4;k++)AH.dot(x,rand(-r*0.5,r*0.5),rand(-r*0.6,r*0.6),r*0.07,'#ff7a2a');
    x.fillStyle='#4a4440';x.fillRect(r*0.6,r*0.5,r*0.7,r*0.3);x.fillStyle='#6a6460';x.fillRect(r*1.1,r*0.3,r*0.3,r*0.7);},
  coil:(x,r,f)=>{PAINT.worm(x,r,f);x.globalAlpha=0.55;for(let k=0;k<=4;k++){x.fillStyle=k%2?'#8a2a0a':'#2a1008';x.beginPath();x.ellipse(-k*r*0.62,0,r*(1-k*0.13),r*(0.95-k*0.12),0,0,TAU);x.fill();}x.globalAlpha=1;
    for(let k=1;k<=4;k++)AH.dot(x,-k*r*0.62,0,r*0.12,'#ffa040');},
  ixa:(x,r,f)=>{robe('#5a1a14','#ff8a3a','#ffcc66')(x,r,f);for(let k=0;k<3;k++){const a=k*2.1+G.time;const g=x.createRadialGradient(Math.cos(k*2.1)*r*0.9,Math.sin(k*2.1)*r*0.9,0,Math.cos(k*2.1)*r*0.9,Math.sin(k*2.1)*r*0.9,r*0.25);g.addColorStop(0,'rgba(255,200,90,1)');g.addColorStop(1,'rgba(255,90,20,0)');x.fillStyle=g;x.fillRect(-r*1.3,-r*1.3,r*2.6,r*2.6);}},
  slavemaster:(x,r,f)=>{walker(x,r,f,{skin:'#7a5040',torso:'#3a2420',sleeve:'#2a1a16',boot:'#140c08',chest:0.6,wide:0.94,head:0.3,headX:0.3,
      headDeco:(x,r)=>{oval(x,r*0.3,0,r*0.3,r*0.29,'#2a2420',1.2);eyes(x,r*0.5,r*0.1,r*0.035,'#ff6a2a');}});
    x.strokeStyle='#8a8480';x.lineWidth=2.5;x.beginPath();x.moveTo(r*0.3,r*0.8);for(let k=1;k<6;k++)x.lineTo(r*(0.3+k*0.25),r*(0.8+Math.sin(k)*0.2));x.stroke();}
});
{const {dot,glow}=AH;
  const emberDot=(x,px,py)=>{const gx=px+rand(10,30),gy=py+rand(10,30);glow(x,gx,gy,12,'rgba(255,120,40,.4)');addLight(gx,gy,60,0.4,'255,120,40',0.2,1);};
  const spire=(x,px,py)=>{x.fillStyle='#0c0605';x.beginPath();const cx=px+rand(10,30),cy=py+rand(10,30);x.moveTo(cx,cy-12);x.lineTo(cx+6,cy+5);x.lineTo(cx-5,cy+6);x.fill();x.strokeStyle='rgba(255,90,30,.4)';x.lineWidth=1;x.stroke();};
  const base={voidT:THEMES.ember.voidT,lava:THEMES.ember.lava,void:'#1a0400',detail:'ember',torch:'255,110,40'};
  THEMES.a5ash=zoneTheme(Object.assign({},base,{floor:['ash',{h:20,s:6,l:15}],wall:['obsidian',{h:10}],flat:1,grade:[0.28,'#dcc0b4'],torch:null,deco:decoOf([[0.015,emberDot],[0.03,spire]])}));
  zoneProps('a5ash',[['debris',4,0],['bones',2,0],['pillar',1,0],['ribs',1,0]],'#3a2c28');
  THEMES.a5foundry=zoneTheme(Object.assign({},base,{floor:['plate',{h:15,s:6,l:13}],wall:['basalt',{}],grade:[0.26,'#e0bcac'],deco:decoOf([[0.012,emberDot]])}));
  zoneProps('a5foundry',[['cage',2,1],['chains',3,0],['crate',2,0],['debris',2,0],['pillar',1,0]],'#3a2c28');
  THEMES.a5tubes=zoneTheme(Object.assign({},base,{floor:['slab',{h:8,s:12,l:9,lv:2,crack:'rgba(255,90,20,.5)'}],wall:['basalt',{}],grade:[0.24,'#e8b8a4'],deco:decoOf([[0.02,emberDot],[0.02,spire]])}));
  zoneProps('a5tubes',[['debris',4,0],['bones',2,0],['chains',1,0]],'#3a2c28');
  THEMES.a5caldera=zoneTheme(Object.assign({},base,{floor:['ash',{h:14,s:10,l:13}],wall:['obsidian',{h:5}],flat:1,grade:[0.25,'#e4bcac'],torch:null,deco:decoOf([[0.02,emberDot],[0.03,spire]])}));
  zoneProps('a5caldera',[['debris',3,0],['pillar',1.5,0],['bones',2,0],['cage',1,1]],'#3a2c28');
  THEMES.a5slag=zoneTheme(Object.assign({},base,{floor:['earth',{h:16,s:14,l:12,fleck:'rgba(255,120,40,.12)'}],wall:['obsidian',{h:18}],flat:1,grade:[0.27,'#e0bcac'],torch:null,deco:decoOf([[0.015,emberDot],[0.02,spire]])}));
  zoneProps('a5slag',[['debris',4,0],['cage',2,1],['chains',2,0],['crate',1,0]],'#3a2c28');}
