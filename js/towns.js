'use strict';
// Towns: every act has its own (the act of the depth you're heading to; endless cycles reuse them).
// Each town has its own ground, fences, outskirts, buildings, centerpiece, props, lighting, drifting ambience
// (mist, dust, fireflies, snow, embers) and townsfolk who wander about and talk when you pass.
// The ground and buildings are pre-drawn once into the map canvas (THEMES.town0..4); lights, folk and ambience are per frame.
const TOWNS=[
  {name:'Gravewatch',sub:'Lanterns burn all night above the drowned crypts',mm:'#7d8590',amb:'mist',hat:'hood',
   light:{r0:190,r1:560,tint:'rgba(150,180,255,0.03)',dark:'rgba(3,5,12,0.82)'},flame:'255,190,110',
   folk:['#3d4a5c','#5a4636','#4a4a52','#2f3b33'],scatter:['grave','grave','grave','lamp','deadtree','barrel'],
   lines:['Bury them deep, or they climb back up.','The bells rang on their own last night.','Water seeps up through every grave here.','Don\'t follow the lights into the crypts.']},
  {name:'Kesh Oasis',sub:'The last cool water before the cinder dunes',mm:'#c4a46a',amb:'dust',hat:'wrap',
   light:{r0:260,r1:700,tint:'rgba(255,200,120,0.05)',dark:'rgba(22,11,4,0.62)'},flame:'255,200,120',
   folk:['#c8a060','#8a3a2a','#e0d0b0','#3a6a8a'],scatter:['palm','palm','pots','crate','pots'],
   lines:['Fill your skins. The wastes take everything.','The sun out there never set again.','Sand in the bread, sand in the bed.','Caravans stopped coming a year ago.']},
  {name:'Mirewatch',sub:'Stilt huts lashed together over black water',mm:'#7a9050',amb:'flies',hat:'straw',
   light:{r0:170,r1:500,tint:'rgba(150,230,110,0.04)',dark:'rgba(3,8,4,0.84)'},flame:'190,255,140',
   folk:['#5a6a3a','#6a4a2a','#3a5a4a','#7a6a3a'],scatter:['shroom','shroom','reeds','barrel','reeds'],
   lines:['Mind the planks. The water bites.','The mushrooms glow brighter when the rot is close.','My boy went to fish. Only his boat came back.','Boil the water. Twice.']},
  {name:'Frosthold',sub:'A palisade of pine against the endless winter',mm:'#b8c8d8',amb:'snow',hat:'fur',
   light:{r0:220,r1:620,tint:'rgba(200,230,255,0.05)',dark:'rgba(4,8,18,0.74)'},flame:'255,170,90',
   folk:['#6a4a3a','#4a5a7a','#7a3a3a','#5a5a5a'],scatter:['pine','pine','crystal','logs','pine'],
   lines:['Stay near the fire. The cold listens.','The citadel bells ring with no one inside.','We burn a log for every soul lost up there.','Ice on your blade? Good. It\'ll hold the edge.']},
  {name:'Cinderforge',sub:'The last forge-hold before the burning heart',mm:'#a06850',amb:'embers',hat:'helm',
   light:{r0:190,r1:560,tint:'rgba(255,110,40,0.06)',dark:'rgba(14,4,2,0.8)'},flame:'255,120,40',
   folk:['#4a3a3a','#6a2a1a','#3a3a40','#5a4030'],scatter:['brazier','brazier','obelisk','chains','obelisk'],
   lines:['The deep is hungry. Feed it steel, not yourself.','Every hammer here was forged in that fire.','Breathe through cloth. The ash cuts.','The Cinder King hears the anvils. Let him.']}
];
const townOf=d=>TOWNS[actIdx(d)];
// Plaza (tile units): the walkable square with houses along the top and bottom and a road leading in on the left.
const PLAZA={x:20,y:24,w:24,h:16,cx:32,cy:32};
function genTown(){
  const T=townOf(G.depth),g=newGrid(1),R=PLAZA,k=(i,j)=>j*MW+i;
  for(let j=R.y;j<R.y+R.h;j++)for(let i=R.x;i<R.x+R.w;i++)g[k(i,j)]=0;
  for(const [i,j] of [[R.x,R.y],[R.x+1,R.y],[R.x,R.y+1],[R.x+R.w-1,R.y],[R.x+R.w-2,R.y],[R.x+R.w-1,R.y+1],
    [R.x,R.y+R.h-1],[R.x+1,R.y+R.h-1],[R.x,R.y+R.h-2],[R.x+R.w-1,R.y+R.h-1],[R.x+R.w-2,R.y+R.h-1],[R.x+R.w-1,R.y+R.h-2]])g[k(i,j)]=1; // rounded corners
  for(let j=R.cy-1;j<=R.cy+1;j++)for(let i=R.x-5;i<R.x;i++)g[k(i,j)]=0; // the road in
  const tw={k:'center',i:R.cx-1,j:R.cy-1,w:2,h:2};
  const props=[tw],lights=[],under=new Uint8Array(MW*MH),town={T,props,lights,under,folk:[],amb:[],ambT:0,talkT:0,decals:[]};G.town=town;
  const solidRect=(i,j,w,h)=>{for(let b=j;b<j+h;b++)for(let a=i;a<i+w;a++){g[k(a,b)]=1;under[k(a,b)]=1;}}; // solid, but floor drawn under it
  solidRect(tw.i,tw.j,2,2);
  G.p.x=(R.x-3.5)*TILE;G.p.y=(R.cy+0.5)*TILE;
  G.portal={x:(R.x+R.w-2.5)*TILE,y:(R.cy+0.5)*TILE,active:true};
  G.merchant={x:R.cx*TILE,y:(R.y+3.5)*TILE};
  G.stash={x:(R.x+4)*TILE,y:(R.y+3.5)*TILE};
  G.smith={x:(R.cx+0.5)*TILE,y:(R.y+R.h-2.5)*TILE};
  G.waystone={x:(R.x+R.w-5)*TILE,y:(R.y+R.h-3)*TILE};
  const doors=[];
  // houses: a row above the plaza (fronts facing it) and a row below (roofs and backs)
  for(const [j,front] of [[R.y-4,true],[R.y+R.h,false]]){let i=R.x-1+randi(0,1);
    while(i<R.x+R.w-2){const w=randi(4,6);if(i+w>R.x+R.w+1)break;props.push({k:'house',i,j,w,h:4,front,v:Math.random()});
      if(front){doors.push([i+w/2,R.y+0.5,1.6]);}if(front)lights.push({x:(i+w*0.25)*TILE,y:(j+3)*TILE,r:46,win:1},{x:(i+w*0.75)*TILE,y:(j+3)*TILE,r:46,win:1});
      i+=w+randi(1,2);}}
  // gate posts where the road meets the outskirts
  lights.push({x:(R.x-5)*TILE,y:(R.cy-1.2)*TILE-30,r:70},{x:(R.x-5)*TILE,y:(R.cy+2.2)*TILE-30,r:70});
  lights.push({x:G.waystone.x,y:G.waystone.y-20,r:90,way:1});
  lights.push({x:R.cx*TILE,y:R.cy*TILE,r:T.amb==='snow'||T.amb==='embers'?170:110,big:1});
  // props inside the plaza: around the edges, never near the stalls, the paths or the portal, and never cutting the plaza in two
  const keep=[[R.x+0.5,R.cy+0.5,2.6],[R.x+R.w-2.5,R.cy+0.5,3],[R.cx,R.y+3,4],[R.x+4,R.y+3.5,2.4],[R.cx+0.5,R.y+R.h-2.5,3],[R.cx,R.cy,3.2],[R.x+R.w-5,R.y+R.h-3,2.4],...doors];
  const free=(i,j)=>g[k(i,j)]===0&&!keep.some(([x,y,r])=>Math.hypot(i+0.5-x,j+0.5-y)<r);
  const floorN=()=>{let n=0;for(const v of g)if(v===0)n++;return n;};
  const reach=()=>{const s=k(R.x+1,R.cy),seen=new Uint8Array(MW*MH),q=[s];seen[s]=1;let n=1;
    while(q.length){const c=q.pop(),cx=c%MW,cy=(c/MW)|0;for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const t=k(cx+a,cy+b);if(!seen[t]&&g[t]===0){seen[t]=1;n++;q.push(t);}}}return n;};
  const spots=[];for(let j=R.y;j<R.y+R.h;j++)for(let i=R.x;i<R.x+R.w;i++){const edge=Math.min(i-R.x,R.x+R.w-1-i,j-R.y,R.y+R.h-1-j);if(edge<=1||Math.random()<0.04)spots.push([i,j,edge]);}
  let placed=0;
  for(const [i,j,edge] of shuffle(spots)){if(placed>=16)break;if(!free(i,j)||Math.random()<(edge===0?0.45:0.75))continue;
    if(props.some(p=>p.k!=='house'&&Math.abs(p.i-i)<2&&Math.abs(p.j-j)<2))continue;
    const want=floorN()-1;g[k(i,j)]=1;if(reach()!==want){g[k(i,j)]=0;continue;}under[k(i,j)]=1;
    const kind=pick(T.scatter);props.push({k:kind,i,j,w:1,h:1,v:Math.random()});placed++;
    if(kind==='lamp'||kind==='brazier'||kind==='shroom')lights.push({x:(i+0.5)*TILE,y:(j+(kind==='lamp'?0.05:0.4))*TILE,r:kind==='shroom'?60:80,shroom:kind==='shroom'});}
  // flat decorations on the ground (drawn into the map, never in the way)
  for(let n=0;n<26;n++){const i=randi(R.x,R.x+R.w-1),j=randi(R.y,R.y+R.h-1);if(g[k(i,j)]===0)town.decals.push({i,j,v:Math.random()});}
  // townsfolk
  const nf=randi(3,4);for(let n=0;n<nf;n++){let x=0,y=0;for(let t=0;t<40;t++){x=(R.x+rand(2,R.w-2))*TILE;y=(R.y+rand(2,R.h-2))*TILE;if(!blockedAt(x,y,12))break;}
    town.folk.push({folk:1,x,y,r:11,tx:x,ty:y,wait:rand(0,3),col:T.folk[n%T.folk.length],face:rand(0,TAU),step:0,say:'',sayT:0,line:n});}
  G.rooms=[R];G.enemies=[];G.boss=null;
  G.explored=new Uint8Array(MW*MH).fill(1);
  G.flow=new Int16Array(MW*MH);G.flowTile=-1;
  renderMap();
}
// ---------- per frame ----------
function townTick(dt){const W=G.town;if(!W)return;const R=PLAZA,p=G.p;
  for(const f of W.folk){
    if(f.sayT>0)f.sayT-=dt;
    const near=!p.dead&&Math.hypot(p.x-f.x,p.y-f.y)<70;
    if(near&&f.sayT<=0&&W.talkT<=0){f.say=W.T.lines[f.line%W.T.lines.length];f.line+=W.folk.length;f.sayT=3.2;W.talkT=4;f.wait=Math.max(f.wait,2.5);}
    if(near||f.sayT>0){f.face=Math.atan2(p.y-f.y,p.x-f.x);continue;}
    if(f.wait>0){f.wait-=dt;continue;}
    const dx=f.tx-f.x,dy=f.ty-f.y,d=Math.hypot(dx,dy);
    if(d<6){f.wait=rand(1.5,5);for(let t=0;t<20;t++){const x=(R.x+rand(1.5,R.w-1.5))*TILE,y=(R.y+rand(1.5,R.h-1.5))*TILE;if(!blockedAt(x,y,12)){f.tx=x;f.ty=y;break;}}continue;}
    const ox=f.x,oy=f.y,s=42*dt;moveEnt(f,dx/d*s,dy/d*s);f.face=Math.atan2(dy,dx);f.step+=dt*8;
    if(Math.hypot(f.x-ox,f.y-oy)<s*0.3){f.tx=f.x;f.ty=f.y;} // stuck on a prop: pick somewhere else
  }
  if(W.talkT>0)W.talkT-=dt;
  // ambience around the camera
  const vw=CW/Z,vh=CH/Z,A=W.T.amb,amb=W.amb,cap=A==='snow'?140:A==='flies'?36:A==='mist'?22:70;
  W.ambT+=dt*(A==='snow'?55:A==='flies'?14:A==='mist'?5:A==='dust'?22:28);
  while(W.ambT>=1){W.ambT--;if(amb.length>=cap)break;const x=G.cam.x+rand(-vw/2-40,vw/2+40),y=G.cam.y+rand(-vh/2-40,vh/2+40);
    if(A==='snow')amb.push({x,y:G.cam.y-vh/2-rand(0,60),vx:rand(-14,6),vy:rand(30,60),life:rand(6,10),max:8,s:rand(1.5,3.2),ph:rand(0,TAU)});
    else if(A==='mist')amb.push({x,y,vx:rand(6,16),vy:rand(-3,3),life:rand(6,10),max:8,s:rand(40,80),ph:rand(0,TAU)});
    else if(A==='dust')amb.push({x:G.cam.x-vw/2-30,y,vx:rand(40,90),vy:rand(-8,8),life:rand(5,8),max:6,s:rand(1,2.4),ph:rand(0,TAU)});
    else if(A==='flies')amb.push({x,y,vx:rand(-12,12),vy:rand(-12,12),life:rand(4,8),max:6,s:rand(1.6,2.6),ph:rand(0,TAU)});
    else amb.push({x,y:G.cam.y+vh/2+20,vx:rand(-10,10),vy:-rand(30,70),life:rand(4,7),max:5,s:rand(1.4,2.8),ph:rand(0,TAU)});}
  for(const q of amb){q.life-=dt;q.ph+=dt;
    if(A==='snow'||A==='embers')q.x+=(q.vx+Math.sin(q.ph*1.7)*12)*dt;else if(A==='flies'){q.vx+=rand(-40,40)*dt;q.vy+=rand(-40,40)*dt;q.vx=clamp(q.vx,-20,20);q.vy=clamp(q.vy,-20,20);q.x+=q.vx*dt;}else q.x+=q.vx*dt;
    q.y+=(A==='dust'?q.vy+Math.sin(q.ph*2)*10:q.vy)*dt;}
  W.amb=amb.filter(q=>q.life>0);
}
const townFade=q=>Math.min(1,q.life/1.2,(q.max-q.life+1.2)/1.2);
// Living parts of the town, drawn over the map and under everyone: flames, water, centerpiece glow.
function drawTownLive(onScreen){const W=G.town;if(!W)return;const T=W.T,t=G.time,R=PLAZA;
  const cx=R.cx*TILE,cy=R.cy*TILE;
  if(onScreen(cx,cy,160)){const a=T.amb;
    if(a==='mist'){ctx.strokeStyle='rgba(170,200,230,.35)';ctx.lineWidth=1.5;for(let n=0;n<2;n++){const r=((t*14+n*14)%28);ctx.globalAlpha=1-r/28;ctx.beginPath();ctx.ellipse(cx,cy+2,r,r*0.55,0,0,TAU);ctx.stroke();}ctx.globalAlpha=1;}
    else if(a==='dust'){ctx.fillStyle='rgba(200,240,255,.35)';for(let n=0;n<5;n++){const u=t*0.7+n*1.3;ctx.globalAlpha=0.3+0.3*Math.sin(u*2);ctx.fillRect(cx-30+((n*23+t*9)%60),cy-14+n*7,10,2);}ctx.globalAlpha=1;}
    else if(a==='flies'){const g=ctx.createRadialGradient(cx,cy-30,2,cx,cy-30,26);g.addColorStop(0,`rgba(200,255,150,${0.75+0.2*Math.sin(t*3)})`);g.addColorStop(1,'rgba(120,255,120,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy-30,26,0,TAU);ctx.fill();}
    else if(a==='snow')flame(cx,cy-6,30,t,'255,170,80');
    else{ctx.fillStyle='#ffb040';for(let n=0;n<6;n++){const u=(t*0.8+n/6)%1;ctx.globalAlpha=(1-u)*0.8;ctx.beginPath();ctx.arc(cx+Math.sin(n*2.1+t)*16,cy-u*40,2+2*(1-u),0,TAU);ctx.fill();}ctx.globalAlpha=1;}}
  if(G.waystone&&onScreen(G.waystone.x,G.waystone.y,80))drawWaystone();
  for(const L of W.lights){if(L.win||L.big||L.shroom||L.way||!onScreen(L.x,L.y,40))continue;flame(L.x,L.y,9,t+L.x,T.flame);}
}
function flame(x,y,s,t,rgb){const f=0.8+0.2*Math.sin(t*11)*Math.sin(t*7.3);
  for(const [k,c] of [[1,`rgba(${rgb},.85)`],[0.55,'rgba(255,240,190,.95)']]){const h=s*1.5*k*f,w=s*0.55*k;ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x-w,y);
    ctx.quadraticCurveTo(x-w*0.9,y-h*0.5,x+Math.sin(t*6)*w*0.3,y-h);ctx.quadraticCurveTo(x+w*0.9,y-h*0.5,x+w,y);ctx.closePath();ctx.fill();}}
// The Waystone: a rune-carved stone with a turning ring of light (same in every town).
function drawWaystone(){const {x,y}=G.waystone,t=G.time;
  ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(x,y+12,26,8,0,0,TAU);ctx.fill();
  ctx.strokeStyle='rgba(90,220,255,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+8,30,10,0,0,TAU);ctx.stroke();
  for(let k=0;k<6;k++){const a=t*1.2+k/6*TAU;ctx.fillStyle=`rgba(150,240,255,${0.5+0.5*Math.sin(t*3+k)})`;ctx.fillRect(x+Math.cos(a)*30-2,y+8+Math.sin(a)*10-2,4,4);}
  ctx.fillStyle='#4a5058';ctx.strokeStyle='#111418';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x-14,y+10);ctx.lineTo(x-11,y-30);ctx.lineTo(x,y-42);ctx.lineTo(x+11,y-30);ctx.lineTo(x+14,y+10);ctx.closePath();ctx.fill();ctx.stroke();
  const g=0.6+0.4*Math.sin(t*2.2);ctx.strokeStyle=`rgba(110,230,255,${g})`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-32);ctx.lineTo(x-5,y-20);ctx.lineTo(x+5,y-12);ctx.lineTo(x,y);ctx.moveTo(x-6,y-26);ctx.lineTo(x+6,y-26);ctx.stroke();
  ctx.fillStyle=`rgba(180,250,255,${g})`;ctx.beginPath();ctx.arc(x,y-48-Math.sin(t*2)*3,4,0,TAU);ctx.fill();
  ctx.font='12px Georgia';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText('Waystone',x,y-60);ctx.fillStyle='#7fe4f4';ctx.fillText('Waystone',x,y-60);}
// A townsperson: round body, head and an act-specific hat; bobs while walking; a speech bubble when talking.
function drawFolk(f){const T=G.town.T,bob=f.wait>0||f.sayT>0?0:Math.abs(Math.sin(f.step))*2;
  ctx.save();ctx.translate(f.x,f.y-bob);
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(0,f.r+bob*0.5,f.r,4,0,0,TAU);ctx.fill();
  ctx.fillStyle=f.col;ctx.strokeStyle='#0a0705';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,f.r,0,TAU);ctx.fill();ctx.stroke();
  const hx=Math.cos(f.face)*3,hy=-6+Math.sin(f.face)*2;ctx.fillStyle='#d8b890';ctx.beginPath();ctx.arc(hx,hy,6,0,TAU);ctx.fill();ctx.stroke();
  const h=T.hat;ctx.lineWidth=1.5;
  if(h==='hood'){ctx.fillStyle=f.col;ctx.beginPath();ctx.arc(hx,hy-1,7,Math.PI*0.95,Math.PI*2.05);ctx.fill();ctx.stroke();}
  else if(h==='wrap'){ctx.fillStyle='#efe4cc';ctx.beginPath();ctx.ellipse(hx,hy-4,7,4,0,0,TAU);ctx.fill();ctx.stroke();}
  else if(h==='straw'){ctx.fillStyle='#c8a850';ctx.beginPath();ctx.ellipse(hx,hy-3,11,4,0,0,TAU);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(hx,hy-5,4,Math.PI,0);ctx.fill();}
  else if(h==='fur'){ctx.fillStyle='#8a6a4a';ctx.beginPath();ctx.ellipse(hx,hy-4,7.5,4.5,0,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#e8e0d0';ctx.fillRect(hx-7,hy-2,14,2.5);}
  else{ctx.fillStyle='#4a4f57';ctx.beginPath();ctx.arc(hx,hy-1,6.5,Math.PI,0);ctx.fill();ctx.stroke();ctx.fillStyle='#ffb040';ctx.fillRect(hx-4,hy-1,8,2);}
  ctx.restore();
  if(f.sayT>0){ctx.font='11px Georgia';const w=Math.min(220,ctx.measureText(f.say).width)+14,x=f.x-w/2,y=f.y-f.r-36;ctx.globalAlpha=Math.min(1,f.sayT*2);
    ctx.fillStyle='rgba(16,11,8,.88)';ctx.strokeStyle='#8a7a62';ctx.lineWidth=1;ctx.beginPath();ctx.rect(x,y,w,20);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(f.x-4,y+20);ctx.lineTo(f.x,y+26);ctx.lineTo(f.x+4,y+20);ctx.fill();
    ctx.fillStyle='#e8dcc4';ctx.textAlign='center';ctx.fillText(f.say,f.x,y+14,220);ctx.globalAlpha=1;}
}
// Drifting ambience (world space, over everyone).
function drawTownAmb(){const W=G.town;if(!W)return;const A=W.T.amb;
  for(const q of W.amb){const a=townFade(q);
    if(A==='mist'){ctx.globalAlpha=a*0.07;ctx.fillStyle='#b8c8e0';ctx.beginPath();ctx.ellipse(q.x,q.y,q.s,q.s*0.4,0,0,TAU);ctx.fill();}
    else if(A==='snow'){ctx.globalAlpha=a*0.85;ctx.fillStyle='#f4f8ff';ctx.beginPath();ctx.arc(q.x,q.y,q.s,0,TAU);ctx.fill();}
    else if(A==='dust'){ctx.globalAlpha=a*0.4;ctx.fillStyle='#f0d8a8';ctx.fillRect(q.x,q.y,q.s*3,q.s*0.8);}
    else if(A==='flies'){ctx.globalAlpha=a*(0.4+0.6*Math.max(0,Math.sin(q.ph*3)));ctx.fillStyle='#d8ff7a';ctx.beginPath();ctx.arc(q.x,q.y,q.s,0,TAU);ctx.fill();}
    else{ctx.globalAlpha=a*0.9;ctx.fillStyle=q.ph%2<1?'#ffb040':'#ff6a1a';ctx.fillRect(q.x,q.y,q.s,q.s);}}
  ctx.globalAlpha=1;}
// Town lights shine through the dark (screen space, added on top of the darkness).
// Town lights (windows, lamps, the centerpiece, the Waystone) are lit by light.js from G.town.lights.

// ---------- pre-drawn town art ----------
{
  const glow=(x,cx,cy,r,col)=>{const g=x.createRadialGradient(cx,cy,1,cx,cy,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(cx-r,cy-r,r*2,r*2);};
  const dot=(x,cx,cy,r,col)=>{x.fillStyle=col;x.beginPath();x.arc(cx,cy,r,0,TAU);x.fill();};
  const box=(x,px,py,w,h,fill,line,lw)=>{x.fillStyle=fill;x.fillRect(px,py,w,h);if(line){x.strokeStyle=line;x.lineWidth=lw||2;x.strokeRect(px,py,w,h);}};
  const shadow=(x,cx,cy,rx,ry)=>{x.fillStyle='rgba(0,0,0,.35)';x.beginPath();x.ellipse(cx,cy,rx,ry,0,0,TAU);x.fill();};
  const town=()=>G.town;
  // A building: roof above, front wall with a door and lit windows when it faces the plaza.
  // S: {wall, line, roof, roof2, style}  style: gable | flat | thatch | snow | forge
  function house(x,p,S){const px=p.i*TILE,py=p.j*TILE,W=p.w*TILE,H=p.h*TILE,m=4;
    shadow(x,px+W/2,py+H-2,W/2,8);
    const fy=py+H*0.5,fh=H*0.5-4; // front wall
    if(p.front){
      if(S.style==='thatch'){x.fillStyle='#2a1c10';for(let k=0;k<4;k++)x.fillRect(px+m+6+k*(W-2*m-16)/3,py+H-10,4,10);} // stilts
      box(x,px+m,fy,W-2*m,fh-(S.style==='thatch'?6:0),S.wall,S.line);
      x.fillStyle='rgba(0,0,0,.18)';
      if(S.style==='snow'||S.style==='thatch')for(let k=fy+6;k<fy+fh-6;k+=7)x.fillRect(px+m,k,W-2*m,1.5); // logs / planks
      else for(let k=fy+8;k<fy+fh-4;k+=9)for(let s=((k/9)%2)*10;s<W-2*m;s+=20)x.fillRect(px+m+s,k,1.5,9); // bricks
      const dw=18,dx=px+W/2-dw/2;box(x,dx,fy+fh-30-(S.style==='thatch'?6:0),dw,30,'#1a110a',S.line);
      x.fillStyle=S.roof2;x.fillRect(dx-3,fy+fh-33-(S.style==='thatch'?6:0),dw+6,4);
      for(const u of [0.25,0.75]){const wx=px+W*u-7,wy=fy+10;if(Math.abs(px+W*u-(px+W/2))<20)continue;glow(x,wx+7,wy+7,22,'rgba(255,190,100,.25)');box(x,wx,wy,14,13,'#f2c060',S.line,2);x.fillStyle=S.line;x.fillRect(wx+6,wy,2,13);}
    }else box(x,px+m,py+H-16,W-2*m,12,S.wall,S.line);
    // roof
    const ry=py+4,rh=p.front?H*0.5:H-16;
    if(S.style==='flat'){box(x,px+m-2,ry+rh-14,W-2*m+4,14,S.roof,S.line);box(x,px+m-2,ry,W-2*m+4,rh-14,S.roof2,S.line);
      x.fillStyle=pick(['#a3262f','#2f6b8a','#d8a040']);for(let k=0;k<5;k++){x.fillRect(px+m+4+k*(W-2*m-8)/5,ry+rh-2,(W-2*m-8)/5-2,8);} // awning
      if(p.v>0.5){dot(x,px+W*0.3,ry+rh*0.4,7,'#8a6a40');dot(x,px+W*0.3,ry+rh*0.4,4,'#3a2a1a');}}
    else if(S.style==='forge'){box(x,px+m-2,ry,W-2*m+4,rh,S.roof,S.line);x.fillStyle=S.roof2;for(let k=px+m+4;k<px+W-m-4;k+=10)x.fillRect(k,ry+3,3,rh-6);
      const cx=px+W*(p.v>0.5?0.75:0.25);box(x,cx-8,ry-14,16,24,'#2a2422',S.line);glow(x,cx,ry-14,20,'rgba(255,120,30,.55)');dot(x,cx,ry-14,5,'#ffb040');}
    else{ // pitched roofs seen from above: two slopes and a ridge
      x.fillStyle=S.roof;x.strokeStyle=S.line;x.lineWidth=2;x.beginPath();x.moveTo(px+m-4,ry+rh);x.lineTo(px+m+8,ry);x.lineTo(px+W-m-8,ry);x.lineTo(px+W-m+4,ry+rh);x.closePath();x.fill();x.stroke();
      x.fillStyle=S.roof2;x.beginPath();x.moveTo(px+m+8,ry);x.lineTo(px+W-m-8,ry);x.lineTo(px+W-m-14,ry+rh*0.45);x.lineTo(px+m+14,ry+rh*0.45);x.closePath();x.fill();
      x.strokeStyle='rgba(0,0,0,.25)';x.lineWidth=1;for(let k=ry+8;k<ry+rh;k+=7){x.beginPath();x.moveTo(px+m,k);x.lineTo(px+W-m,k);x.stroke();}
      if(S.style==='snow'){x.fillStyle='#eef4fa';x.beginPath();x.moveTo(px+m+6,ry+2);x.lineTo(px+W-m-6,ry+2);x.lineTo(px+W-m-12,ry+rh*0.42);for(let s=W-2*m-24;s>0;s-=10)x.lineTo(px+m+12+s,ry+rh*0.42+(s%20?6:2));x.lineTo(px+m+12,ry+rh*0.42);x.closePath();x.fill();
        x.fillStyle='rgba(220,240,255,.85)';for(let k=px+m+2;k<px+W-m-2;k+=9){x.beginPath();x.moveTo(k,ry+rh);x.lineTo(k+4,ry+rh);x.lineTo(k+2,ry+rh+5+((k*7)%5));x.fill();}}
      if(S.style==='thatch'){x.strokeStyle='rgba(220,200,110,.25)';for(let k=px+m;k<px+W-m;k+=5){x.beginPath();x.moveTo(k,ry+rh*0.45);x.lineTo(k+rand(-3,3),ry+rh);x.stroke();}}
      if(p.v>0.4){const cx=px+W*(p.v>0.7?0.72:0.3);box(x,cx-6,ry-6,12,16,S.line,'#000',1);}}
  }
  // Every town shares the plaza logic; T supplies ground, fence, outskirts, props and the centerpiece.
  function mk(D){return {void:D.void,
    floor:D.floor,
    wall(x,px,py,below,adj,i,j){const W=town();if(W&&W.under[j*MW+i]){D.floor(x,px,py);return;}D.out(x,px,py,i,j);if(adj)D.fence(x,px,py,below,i,j);},
    rooms(x){const W=town();if(!W)return;
      for(const d of W.decals)D.decal(x,d.i*TILE,d.j*TILE,d.v);
      // the road in from the left, then the gate
      const R=PLAZA;D.road&&D.road(x,(R.x-5)*TILE,(R.cy-1)*TILE,5*TILE,3*TILE);
      // outskirt scenery, back to front
      const sc=[];for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){const k=j*MW+i;if(G.grid[k]!==1)continue;const di=Math.max(R.x-i,i-(R.x+R.w-1),0),dj=Math.max(R.y-j,j-(R.y+R.h-1),0);
        if(Math.max(di,dj)<2||(dj>0&&dj<6&&di===0&&i>=R.x-1&&i<=R.x+R.w))continue;if(Math.max(di,dj)>14)continue;if(Math.random()<0.16)sc.push([i,j]);}
      for(const [i,j] of sc)D.scenery(x,i*TILE+rand(0,TILE),j*TILE+rand(0,TILE),Math.random());
      const ps=W.props.slice().sort((a,b)=>a.j+a.h-(b.j+b.h));
      for(const p of ps){if(p.k==='house')house(x,p,D.house);else if(p.k==='center')D.center(x,(p.i+1)*TILE,(p.j+1)*TILE);else D.prop[p.k](x,p.i*TILE+20,p.j*TILE+20,p.v);}
      for(const s of [-1,1])D.gatepost(x,(R.x-5)*TILE,(R.cy+(s<0?-1.2:2.2))*TILE);}};}
  // ---- shared props ----
  const P={
    grave(x,cx,cy,v){shadow(x,cx,cy+12,14,5);if(v<0.5){x.fillStyle='#5a5e66';x.strokeStyle='#22252a';x.lineWidth=2;x.beginPath();x.moveTo(cx-10,cy+12);x.lineTo(cx-10,cy-6);x.arc(cx,cy-6,10,Math.PI,0);x.lineTo(cx+10,cy+12);x.closePath();x.fill();x.stroke();x.fillStyle='rgba(0,0,0,.35)';x.fillRect(cx-5,cy-4,10,2);x.fillRect(cx-5,cy+1,10,2);}
      else{box(x,cx-3,cy-14,6,26,'#5a5e66','#22252a');box(x,cx-10,cy-8,20,6,'#5a5e66','#22252a');}x.fillStyle='rgba(60,90,50,.6)';dot(x,cx-8,cy+11,4,'rgba(60,90,50,.6)');},
    lamp(x,cx,cy){shadow(x,cx,cy+14,8,3);box(x,cx-2,cy-18,4,32,'#2a2a30','#000',1);box(x,cx-6,cy-22,12,10,'#3a3a40','#000',1);x.fillStyle='#ffd890';x.fillRect(cx-4,cy-20,8,6);},
    deadtree(x,cx,cy){shadow(x,cx,cy+12,16,5);x.strokeStyle='#2a2420';x.lineCap='round';x.lineWidth=6;x.beginPath();x.moveTo(cx,cy+12);x.lineTo(cx,cy-10);x.stroke();x.lineWidth=3;x.beginPath();
      for(const [a,b,c,d] of [[0,-6,-14,-20],[0,-10,12,-24],[-8,-15,-16,-14],[6,-17,16,-14]]){x.moveTo(cx+a,cy+b);x.lineTo(cx+c,cy+d);}x.stroke();x.lineCap='butt';},
    barrel(x,cx,cy){shadow(x,cx,cy+12,12,4);x.fillStyle='#6b4423';x.strokeStyle='#1a0f06';x.lineWidth=2;x.beginPath();x.ellipse(cx,cy,12,14,0,0,TAU);x.fill();x.stroke();x.fillStyle='#4a4f57';x.fillRect(cx-12,cy-6,24,2.5);x.fillRect(cx-12,cy+5,24,2.5);},
    crate(x,cx,cy){shadow(x,cx,cy+12,15,4);box(x,cx-14,cy-12,28,24,'#8a6236','#2a1a0a');x.strokeStyle='#5a3e1e';x.lineWidth=2;x.beginPath();x.moveTo(cx-14,cy-12);x.lineTo(cx+14,cy+12);x.moveTo(cx+14,cy-12);x.lineTo(cx-14,cy+12);x.stroke();},
    pots(x,cx,cy){for(const [ox,oy,r,c] of [[-6,2,9,'#a8643a'],[7,-3,7,'#c07a48'],[3,8,6,'#8a4a2a']]){shadow(x,cx+ox,cy+oy+r,r,3);dot(x,cx+ox,cy+oy,r,c);dot(x,cx+ox,cy+oy-r*0.6,r*0.45,'#3a2010');}},
    palm(x,cx,cy,v){shadow(x,cx+10,cy+12,18,5);x.strokeStyle='#7a5a32';x.lineWidth=6;x.beginPath();x.moveTo(cx,cy+12);x.quadraticCurveTo(cx+6,cy-4,cx+2,cy-20);x.stroke();
      x.fillStyle='#3f7a2e';for(let k=0;k<6;k++){const a=k/6*TAU+v;x.beginPath();x.ellipse(cx+2+Math.cos(a)*12,cy-20+Math.sin(a)*8,15,5,a,0,TAU);x.fill();}dot(x,cx+2,cy-20,5,'#2f5a22');dot(x,cx-1,cy-16,3,'#6a4a1a');dot(x,cx+5,cy-16,3,'#6a4a1a');},
    shroom(x,cx,cy,v){shadow(x,cx,cy+12,14,4);box(x,cx-4,cy-6,8,18,'#d8d0b8','#3a3a30',1);glow(x,cx,cy-10,26,'rgba(100,255,190,.3)');
      x.fillStyle=v<0.5?'#3ac0a0':'#5ad070';x.strokeStyle='#0a2a20';x.lineWidth=2;x.beginPath();x.ellipse(cx,cy-8,16,9,0,Math.PI,0);x.closePath();x.fill();x.stroke();for(const o of [-8,0,7])dot(x,cx+o,cy-12,2,'#d8fff0');},
    reeds(x,cx,cy){x.strokeStyle='#5a7a30';x.lineWidth=2;x.beginPath();for(let k=-3;k<=3;k++){x.moveTo(cx+k*3,cy+12);x.lineTo(cx+k*4+rand(-2,2),cy-rand(8,20));}x.stroke();x.fillStyle='#5a3a1a';for(const k of [-2,1,3])x.fillRect(cx+k*4-1.5,cy-14-k,3,8);},
    pine(x,cx,cy,v){shadow(x,cx,cy+14,16,5);box(x,cx-3,cy+4,6,10,'#4a3020');for(const [w,y] of [[18,-2],[14,-12],[9,-21]]){x.fillStyle='#1f4a3a';x.beginPath();x.moveTo(cx-w,cy+y+6);x.lineTo(cx,cy+y-12);x.lineTo(cx+w,cy+y+6);x.closePath();x.fill();
      x.fillStyle='#eef4fa';x.beginPath();x.moveTo(cx-w*0.6,cy+y-2);x.lineTo(cx,cy+y-12);x.lineTo(cx+w*0.5,cy+y-3);x.closePath();x.fill();}},
    crystal(x,cx,cy){shadow(x,cx,cy+12,14,4);glow(x,cx,cy,22,'rgba(160,220,255,.25)');for(const [ox,h,w] of [[-7,18,5],[0,26,6],[7,16,5]]){x.fillStyle='rgba(170,220,255,.85)';x.strokeStyle='#3a6a9a';x.lineWidth=1.5;x.beginPath();x.moveTo(cx+ox-w,cy+12);x.lineTo(cx+ox,cy+12-h);x.lineTo(cx+ox+w,cy+12);x.closePath();x.fill();x.stroke();}},
    logs(x,cx,cy){shadow(x,cx,cy+12,16,4);for(const [ox,oy] of [[-8,6],[8,6],[0,-4]]){dot(x,cx+ox,cy+oy,8,'#6a4428');dot(x,cx+ox,cy+oy,5,'#c89a60');dot(x,cx+ox,cy+oy,1.5,'#6a4428');}x.fillStyle='#eef4fa';x.fillRect(cx-14,cy-12,28,4);},
    brazier(x,cx,cy){shadow(x,cx,cy+12,12,4);x.strokeStyle='#1a1818';x.lineWidth=3;x.beginPath();x.moveTo(cx-8,cy+12);x.lineTo(cx-3,cy-2);x.moveTo(cx+8,cy+12);x.lineTo(cx+3,cy-2);x.stroke();
      x.fillStyle='#3a3533';x.beginPath();x.ellipse(cx,cy-4,12,6,0,0,TAU);x.fill();x.stroke();dot(x,cx,cy-5,7,'#ff8a2a');},
    obelisk(x,cx,cy){shadow(x,cx,cy+12,12,4);x.fillStyle='#16110f';x.strokeStyle='#ff6a1a';x.lineWidth=1;x.beginPath();x.moveTo(cx-8,cy+12);x.lineTo(cx-5,cy-20);x.lineTo(cx,cy-28);x.lineTo(cx+5,cy-20);x.lineTo(cx+8,cy+12);x.closePath();x.fill();x.stroke();
      x.strokeStyle='rgba(255,120,40,.8)';x.beginPath();x.moveTo(cx-1,cy-18);x.lineTo(cx+2,cy-6);x.lineTo(cx-2,cy+4);x.stroke();},
    chains(x,cx,cy){shadow(x,cx,cy+12,14,4);box(x,cx-12,cy-16,4,28,'#2a2624','#000',1);box(x,cx+8,cy-16,4,28,'#2a2624','#000',1);x.strokeStyle='#7a7470';x.lineWidth=2;
      for(let k=0;k<5;k++){x.beginPath();x.ellipse(cx-8+k*4,cy-12+Math.sin(k/4*Math.PI)*8,3,2,0,0,TAU);x.stroke();}}};
  // ---- Gravewatch: cobbles, low mossy walls, wet grass, a roofed well ----
  THEMES.town0=mk({void:'#05070a',
    floor(x,px,py){x.fillStyle=`hsl(215,8%,${15+Math.random()*4}%)`;x.fillRect(px,py,TILE,TILE);for(let k=0;k<4;k++){x.fillStyle=`hsl(215,8%,${19+Math.random()*7}%)`;x.beginPath();x.ellipse(px+(k%2)*20+10+rand(-2,2),py+(k>>1)*20+10+rand(-2,2),8,7,0,0,TAU);x.fill();}},
    out(x,px,py){x.fillStyle=`hsl(${130+Math.random()*20},16%,${8+Math.random()*3}%)`;x.fillRect(px,py,TILE,TILE);if(Math.random()<0.3){x.strokeStyle='rgba(90,120,80,.35)';x.lineWidth=1;x.beginPath();const bx=px+rand(5,35),by=py+rand(10,35);x.moveTo(bx,by);x.lineTo(bx-2,by-6);x.moveTo(bx+2,by);x.lineTo(bx+3,by-7);x.stroke();}},
    fence(x,px,py,below){box(x,px,py+6,TILE,below?30:20,'#3c4048','#16181c');x.fillStyle='rgba(0,0,0,.25)';x.fillRect(px+20,py+6,1.5,below?30:20);x.fillStyle='#4a5a3a';x.fillRect(px,py+6,TILE,3);if(Math.random()<0.4)dot(x,px+rand(4,36),py+8,rand(3,6),'rgba(70,100,60,.7)');},
    road(x,px,py,w,h){x.fillStyle='#2a2822';x.fillRect(px,py,w,h);for(let k=0;k<30;k++)dot(x,px+rand(0,w),py+rand(0,h),rand(4,8),`hsl(215,6%,${14+Math.random()*6}%)`);},
    decal(x,px,py,v){if(v<0.4){x.fillStyle='rgba(90,110,140,.25)';x.beginPath();x.ellipse(px+20,py+22,rand(8,16),rand(4,7),0,0,TAU);x.fill();}else if(v<0.7)dot(x,px+rand(8,32),py+rand(8,32),rand(4,8),'rgba(60,90,50,.45)');else{x.fillStyle='rgba(140,90,50,.5)';for(let k=0;k<3;k++)x.fillRect(px+rand(4,34),py+rand(4,34),4,2);}},
    scenery(x,cx,cy,v){if(v<0.35)P.deadtree(x,cx,cy);else if(v<0.6)P.grave(x,cx,cy,v);else if(v<0.75){x.fillStyle='#22262c';x.beginPath();x.ellipse(cx,cy,rand(10,18),rand(7,11),0,0,TAU);x.fill();}else if(v<0.85)P.grave(x,cx,cy,0.8);},
    gatepost(x,cx,cy){shadow(x,cx,cy+14,12,4);box(x,cx-9,cy-22,18,36,'#4a4e56','#16181c');box(x,cx-11,cy-26,22,6,'#5a5e66','#16181c');x.fillStyle='#ffd890';x.fillRect(cx-3,cy-34,6,8);},
    house:{wall:'#4a4d55',line:'#14161a',roof:'#2b3140',roof2:'#363d50',style:'gable'},
    center(x,cx,cy){shadow(x,cx,cy+28,34,10);x.fillStyle='#5a5e66';x.strokeStyle='#16181c';x.lineWidth=3;x.beginPath();x.ellipse(cx,cy+6,30,22,0,0,TAU);x.fill();x.stroke();
      x.fillStyle='#0c1a28';x.beginPath();x.ellipse(cx,cy+4,20,14,0,0,TAU);x.fill();x.fillStyle='rgba(120,170,220,.35)';x.beginPath();x.ellipse(cx-4,cy+1,8,4,0,0,TAU);x.fill();
      box(x,cx-28,cy-34,5,38,'#4a3424','#140d08');box(x,cx+23,cy-34,5,38,'#4a3424','#140d08');x.fillStyle='#2b3140';x.beginPath();x.moveTo(cx-38,cy-28);x.lineTo(cx,cy-48);x.lineTo(cx+38,cy-28);x.lineTo(cx+34,cy-22);x.lineTo(cx-34,cy-22);x.closePath();x.fill();x.stroke();
      x.strokeStyle='#8a7a5a';x.lineWidth=1.5;x.beginPath();x.moveTo(cx,cy-24);x.lineTo(cx,cy-6);x.stroke();box(x,cx-5,cy-8,10,8,'#6b4423','#140d08',1);},
    prop:P});
  // ---- Kesh Oasis: sand and paving, mudbrick walls, dunes and palms, a spring-fed pool ----
  THEMES.town1=mk({void:'#140a04',
    floor(x,px,py,){x.fillStyle=`hsl(36,${30+Math.random()*6}%,${30+Math.random()*4}%)`;x.fillRect(px,py,TILE,TILE);for(let k=0;k<4;k++)dot(x,px+rand(2,38),py+rand(2,38),rand(0.8,1.6),'rgba(90,60,30,.25)');
      if(Math.random()<0.35){x.strokeStyle='rgba(90,60,30,.25)';x.lineWidth=1;x.strokeRect(px+2.5,py+2.5,TILE-5,TILE-5);}},
    out(x,px,py){x.fillStyle=`hsl(32,${30+Math.random()*5}%,${21+Math.random()*3}%)`;x.fillRect(px,py,TILE,TILE);if(Math.random()<0.25){x.strokeStyle='rgba(255,225,180,.12)';x.lineWidth=2;x.beginPath();x.arc(px+20,py+48,30,Math.PI*1.2,Math.PI*1.8);x.stroke();}},
    fence(x,px,py,below){box(x,px,py+8,TILE,below?28:18,'#a07a50','#3a2614');x.fillStyle='#b88e60';x.fillRect(px,py+8,TILE,4);x.fillStyle='rgba(0,0,0,.2)';x.fillRect(px+13,py+14,1.5,10);x.fillRect(px+30,py+14,1.5,10);},
    road(x,px,py,w,h){x.fillStyle='rgba(120,90,50,.35)';x.fillRect(px,py,w,h);for(let k=0;k<12;k++){x.strokeStyle='rgba(60,40,20,.3)';x.lineWidth=1.5;x.beginPath();const bx=px+rand(0,w),by=py+rand(8,h-8);x.ellipse(bx,by,3,5,0,0,TAU);x.stroke();}},
    decal(x,px,py,v){if(v<0.3){const c=pick(['#8a2a2a','#2a4a7a','#7a5a1a']);box(x,px+4,py+8,32,24,c);x.strokeStyle='#e8c070';x.lineWidth=1.5;x.strokeRect(px+7,py+11,26,18);}else if(v<0.6)dot(x,px+rand(8,32),py+rand(8,32),rand(2,4),'#7a6a5a');else{x.fillStyle='rgba(255,230,190,.12)';x.beginPath();x.ellipse(px+20,py+20,16,6,rand(0,3),0,TAU);x.fill();}},
    scenery(x,cx,cy,v){if(v<0.3)P.palm(x,cx,cy,v*20);else if(v<0.55){x.fillStyle='hsl(30,25%,16%)';x.beginPath();x.ellipse(cx,cy,rand(12,20),rand(9,14),rand(-0.4,0.4),0,TAU);x.fill();dot(x,cx-4,cy-4,4,'rgba(255,230,190,.12)');}
      else if(v<0.65){dot(x,cx,cy,6,'#d9d0b8');dot(x,cx-2,cy-1,1.6,'#2a1d10');dot(x,cx+2,cy-1,1.6,'#2a1d10');}},
    gatepost(x,cx,cy){shadow(x,cx,cy+14,12,4);box(x,cx-10,cy-24,20,38,'#a07a50','#3a2614');x.fillStyle='#c09060';x.beginPath();x.arc(cx,cy-24,10,Math.PI,0);x.fill();x.fillStyle='#ffd890';x.fillRect(cx-3,cy-36,6,7);},
    house:{wall:'#a07a50',line:'#3a2614',roof:'#8a6640',roof2:'#b48c5c',style:'flat'},
    center(x,cx,cy){shadow(x,cx,cy+6,46,30);x.fillStyle='#5a7a3a';x.beginPath();x.ellipse(cx,cy,44,30,0,0,TAU);x.fill();
      x.fillStyle='#1d5a7a';x.beginPath();x.ellipse(cx,cy,36,23,0,0,TAU);x.fill();x.fillStyle='#2f8aa8';x.beginPath();x.ellipse(cx-4,cy-3,26,15,0,0,TAU);x.fill();
      x.strokeStyle='rgba(220,250,255,.4)';x.lineWidth=1.5;for(const [ox,oy,r] of [[-12,-4,6],[10,4,4],[2,-8,3]]){x.beginPath();x.ellipse(cx+ox,cy+oy,r,r*0.5,0,0,TAU);x.stroke();}
      for(const a of [0.4,2.4,4.2]){P.reeds(x,cx+Math.cos(a)*38,cy+Math.sin(a)*25-8);}},
    prop:P});
  // ---- Mirewatch: boardwalk planks, rope rails, black water, a glowing mushroom heart ----
  THEMES.town2=mk({void:'#020602',
    floor(x,px,py){x.fillStyle=`hsl(28,${28+Math.random()*8}%,${18+Math.random()*4}%)`;x.fillRect(px,py,TILE,TILE);x.fillStyle='rgba(0,0,0,.35)';for(let k=0;k<TILE;k+=10)x.fillRect(px,py+k,TILE,1.5);
      x.fillStyle='rgba(20,12,6,.6)';for(let k=0;k<4;k++)x.fillRect(px+((k*13+Math.floor(py/10)*7)%34)+2,py+k*10+4,2,2);if(Math.random()<0.15)dot(x,px+rand(6,34),py+rand(6,34),rand(4,8),'rgba(80,120,40,.3)');},
    out(x,px,py){x.fillStyle=`hsl(${110+Math.random()*20},30%,${6+Math.random()*3}%)`;x.fillRect(px,py,TILE,TILE);if(Math.random()<0.12){x.strokeStyle='rgba(140,190,120,.15)';x.lineWidth=1;x.beginPath();x.ellipse(px+20,py+20,rand(5,12),rand(2,5),0,0,TAU);x.stroke();}},
    fence(x,px,py,below){x.fillStyle='rgba(0,0,0,.3)';x.fillRect(px,py+28,TILE,6);box(x,px+2,py+12,6,22,'#4a3420','#140d08',1);box(x,px+32,py+12,6,22,'#4a3420','#140d08',1);x.strokeStyle='#a08a5a';x.lineWidth=2;x.beginPath();x.moveTo(px,py+16);x.quadraticCurveTo(px+20,py+22,px+TILE,py+16);x.stroke();},
    road(x,px,py,w,h){x.fillStyle='#4a3420';x.fillRect(px,py+8,w,h-16);x.fillStyle='rgba(0,0,0,.35)';for(let k=px;k<px+w;k+=9)x.fillRect(k,py+8,1.5,h-16);},
    decal(x,px,py,v){if(v<0.35){x.strokeStyle='rgba(190,170,120,.35)';x.lineWidth=1;for(let k=0;k<4;k++){x.beginPath();x.moveTo(px+6+k*8,py+6);x.lineTo(px+6+k*8,py+34);x.stroke();x.beginPath();x.moveTo(px+6,py+6+k*8);x.lineTo(px+34,py+6+k*8);x.stroke();}}else if(v<0.6)dot(x,px+rand(8,32),py+rand(8,32),rand(5,9),'rgba(60,100,40,.4)');else{dot(x,px+20,py+20,4,'#c0c0b0');x.fillStyle='#c0c0b0';x.fillRect(px+20,py+19,10,2);}},
    scenery(x,cx,cy,v){if(v<0.25){x.fillStyle='#2f6a2a';x.beginPath();x.arc(cx,cy,rand(6,10),0.4,TAU);x.lineTo(cx,cy);x.fill();if(v<0.08)dot(x,cx+3,cy-2,3,'#e8a0c0');}
      else if(v<0.45)P.reeds(x,cx,cy);else if(v<0.55){box(x,cx-6,cy-4,12,10,'#3a2a18','#100a04',1);dot(x,cx,cy-4,6,'#5a4228');}else if(v<0.62)P.shroom(x,cx,cy,v);},
    gatepost(x,cx,cy){box(x,cx-5,cy-28,10,42,'#4a3420','#140d08');x.fillStyle='#d8d0b8';x.beginPath();x.arc(cx,cy-32,6,0,TAU);x.fill();dot(x,cx-2,cy-33,1.5,'#000');dot(x,cx+2,cy-33,1.5,'#000');x.fillStyle='#ffd890';x.fillRect(cx+6,cy-24,6,8);},
    house:{wall:'#5a4228',line:'#140d08',roof:'#5a5a2a',roof2:'#7a7a3a',style:'thatch'},
    center(x,cx,cy){shadow(x,cx,cy+28,36,10);box(x,cx-9,cy-26,18,52,'#c8c0a8','#3a3a30');x.fillStyle='rgba(0,0,0,.15)';x.fillRect(cx-2,cy-26,3,52);
      glow(x,cx,cy-30,60,'rgba(100,255,170,.3)');x.fillStyle='#2aa080';x.strokeStyle='#0a2a20';x.lineWidth=3;x.beginPath();x.ellipse(cx,cy-24,40,22,0,Math.PI,0);x.closePath();x.fill();x.stroke();
      for(const [o,r] of [[-22,4],[-8,3],[6,4],[22,3],[0,5]])dot(x,cx+o,cy-30-(o%2?0:6),r,'#d8fff0');
      for(const s of [-1,1]){x.fillStyle='#3ac0a0';x.beginPath();x.ellipse(cx+s*24,cy+18,10,6,0,Math.PI,0);x.fill();x.stroke();}},
    prop:P});
  // ---- Frosthold: packed snow, a log palisade, pine woods and a great bonfire ----
  THEMES.town3=mk({void:'#0a0e14',
    floor(x,px,py){x.fillStyle=`hsl(210,${14+Math.random()*6}%,${56+Math.random()*5}%)`;x.fillRect(px,py,TILE,TILE);for(let k=0;k<3;k++)dot(x,px+rand(4,36),py+rand(4,36),rand(4,10),'rgba(150,170,200,.12)');
      if(Math.random()<0.12){x.fillStyle='rgba(110,130,160,.3)';const a=rand(0,TAU);for(let k=0;k<3;k++){x.beginPath();x.ellipse(px+20+Math.cos(a)*k*10-10,py+20+Math.sin(a)*k*10+(k%2?3:-3),3,4.5,a,0,TAU);x.fill();}}},
    out(x,px,py){x.fillStyle=`hsl(210,${18+Math.random()*6}%,${44+Math.random()*5}%)`;x.fillRect(px,py,TILE,TILE);if(Math.random()<0.2)dot(x,px+rand(6,34),py+rand(6,34),rand(8,16),'rgba(255,255,255,.18)');},
    fence(x,px,py,below){for(let k=0;k<4;k++){const sx=px+k*10;box(x,sx,py+2,10,below?34:26,'#5a3e28','#1a0f06',1);x.fillStyle='#5a3e28';x.beginPath();x.moveTo(sx,py+2);x.lineTo(sx+5,py-6);x.lineTo(sx+10,py+2);x.fill();x.fillStyle='#eef4fa';x.beginPath();x.moveTo(sx+1,py+1);x.lineTo(sx+5,py-6);x.lineTo(sx+9,py+1);x.fill();}},
    road(x,px,py,w,h){x.fillStyle='rgba(120,140,170,.25)';x.fillRect(px,py+6,w,h-12);x.strokeStyle='rgba(90,110,140,.4)';x.lineWidth=2;for(const o of [0.35,0.65]){x.beginPath();x.moveTo(px,py+h*o);x.lineTo(px+w,py+h*o);x.stroke();}},
    decal(x,px,py,v){if(v<0.4){x.fillStyle='rgba(160,200,240,.35)';x.beginPath();x.ellipse(px+20,py+20,rand(8,15),rand(5,9),rand(0,3),0,TAU);x.fill();x.strokeStyle='rgba(255,255,255,.5)';x.lineWidth=1;x.stroke();}else if(v<0.7)dot(x,px+rand(10,30),py+rand(10,30),rand(3,5),'rgba(60,50,40,.4)');},
    scenery(x,cx,cy,v){if(v<0.55)P.pine(x,cx,cy,v);else if(v<0.65)P.crystal(x,cx,cy);else if(v<0.75){x.fillStyle='#eef4fa';x.beginPath();x.ellipse(cx,cy,rand(12,20),rand(7,10),0,0,TAU);x.fill();x.fillStyle='rgba(120,140,170,.3)';x.beginPath();x.ellipse(cx,cy+4,rand(10,16),3,0,0,TAU);x.fill();}},
    gatepost(x,cx,cy){shadow(x,cx,cy+14,12,4);box(x,cx-8,cy-28,16,42,'#5a3e28','#1a0f06');x.fillStyle='#eef4fa';x.fillRect(cx-9,cy-30,18,5);x.fillStyle='#ffd890';x.fillRect(cx-3,cy-38,6,8);},
    house:{wall:'#6a4a30',line:'#1a0f06',roof:'#4a3a30',roof2:'#5a4a3a',style:'snow'},
    center(x,cx,cy){shadow(x,cx,cy+8,40,14);glow(x,cx,cy,70,'rgba(255,150,60,.25)');x.fillStyle='rgba(60,50,40,.5)';x.beginPath();x.ellipse(cx,cy+2,36,22,0,0,TAU);x.fill();
      for(let k=0;k<12;k++){const a=k/12*TAU;dot(x,cx+Math.cos(a)*30,cy+2+Math.sin(a)*18,6,'#7a7a80');dot(x,cx+Math.cos(a)*30-1,cy+Math.sin(a)*18,3,'#eef4fa');}
      x.strokeStyle='#4a3020';x.lineWidth=6;x.lineCap='round';x.beginPath();for(const a of [0.3,1.4,2.5]){x.moveTo(cx+Math.cos(a)*18,cy+Math.sin(a)*10);x.lineTo(cx-Math.cos(a)*18,cy-Math.sin(a)*10);}x.stroke();x.lineCap='butt';dot(x,cx,cy,9,'#ff8a2a');},
    prop:P});
  // ---- Cinderforge: basalt flagstones with glowing seams, iron railings, a lava sea and the ember font ----
  THEMES.town4=mk({void:'#1a0400',
    floor(x,px,py){x.fillStyle=`hsl(10,8%,${13+Math.random()*4}%)`;x.fillRect(px,py,TILE,TILE);x.strokeStyle='rgba(255,90,20,.35)';x.lineWidth=1;x.strokeRect(px+.5,py+.5,TILE-1,TILE-1);if(Math.random()<0.08){x.strokeStyle='rgba(255,140,40,.6)';x.beginPath();x.moveTo(px+rand(4,36),py+rand(4,36));x.lineTo(px+rand(4,36),py+rand(4,36));x.stroke();}},
    out(x,px,py,i,j){if(Math.sin(i*0.45+Math.sin(j*0.3)*2)+Math.sin(j*0.5-i*0.2)>0.3){x.fillStyle=`hsl(${16+Math.random()*8},90%,${34+Math.random()*8}%)`;x.fillRect(px,py,TILE,TILE);x.fillStyle='rgba(255,220,120,.3)';x.beginPath();x.ellipse(px+rand(6,34),py+rand(6,34),rand(4,10),rand(2,4),rand(0,3),0,TAU);x.fill();}
      else{x.fillStyle=`hsl(8,10%,${7+Math.random()*3}%)`;x.fillRect(px,py,TILE,TILE);x.strokeStyle='rgba(255,90,20,.45)';x.lineWidth=1.5;x.beginPath();x.moveTo(px,py+rand(0,40));x.lineTo(px+40,py+rand(0,40));x.stroke();}},
    fence(x,px,py,below){x.fillStyle='hsl(8,10%,9%)';x.fillRect(px,py,TILE,TILE);x.fillStyle='#2a2624';x.fillRect(px,py+12,TILE,3);x.fillRect(px,py+26,TILE,3);
      for(let k=4;k<TILE;k+=12){box(x,px+k,py+4,3,below?32:26,'#3a3533','#000',1);x.fillStyle='#5a5250';x.beginPath();x.moveTo(px+k-1,py+4);x.lineTo(px+k+1.5,py-3);x.lineTo(px+k+4,py+4);x.fill();}},
    road(x,px,py,w,h){x.fillStyle='hsl(8,8%,11%)';x.fillRect(px,py+4,w,h-8);x.strokeStyle='rgba(255,90,20,.4)';x.lineWidth=1;for(let k=px;k<px+w;k+=TILE)x.strokeRect(k+.5,py+4.5,TILE-1,h-9);},
    decal(x,px,py,v){if(v<0.35){x.strokeStyle='rgba(255,140,40,.55)';x.lineWidth=1.5;x.beginPath();x.moveTo(px+rand(2,38),py+rand(2,38));x.lineTo(px+20,py+20);x.lineTo(px+rand(2,38),py+rand(2,38));x.stroke();}else if(v<0.6)dot(x,px+rand(8,32),py+rand(8,32),rand(3,6),'#0c0605');else{x.fillStyle='#5a5250';x.fillRect(px+10,py+16,18,3);x.fillRect(px+16,py+10,3,16);}},
    scenery(x,cx,cy,v){if(v<0.4){x.fillStyle='#0c0605';x.beginPath();x.moveTo(cx,cy-rand(14,24));x.lineTo(cx+rand(8,14),cy+8);x.lineTo(cx-rand(8,14),cy+8);x.closePath();x.fill();x.strokeStyle='rgba(255,90,30,.5)';x.lineWidth=1;x.stroke();}
      else if(v<0.55)glow(x,cx,cy,22,'rgba(255,200,80,.45)');else if(v<0.62)P.obelisk(x,cx,cy);},
    gatepost(x,cx,cy){shadow(x,cx,cy+14,12,4);box(x,cx-9,cy-26,18,40,'#2a2422','#000');x.fillStyle='#ff6a1a';x.fillRect(cx-5,cy-16,10,3);x.fillStyle='#3a3533';x.beginPath();x.ellipse(cx,cy-28,12,5,0,0,TAU);x.fill();},
    house:{wall:'#3a302c',line:'#0a0605',roof:'#2a2422',roof2:'#3a3230',style:'forge'},
    center(x,cx,cy){shadow(x,cx,cy+10,44,16);x.fillStyle='#2a2422';x.strokeStyle='#000';x.lineWidth=3;x.beginPath();x.ellipse(cx,cy+2,40,26,0,0,TAU);x.fill();x.stroke();
      x.fillStyle='#ff6a1a';x.beginPath();x.ellipse(cx,cy,30,18,0,0,TAU);x.fill();x.fillStyle='#ffb040';x.beginPath();x.ellipse(cx-4,cy-3,18,9,0,0,TAU);x.fill();glow(x,cx,cy,60,'rgba(255,120,30,.35)');
      x.fillStyle='rgba(90,10,0,.5)';for(const [ox,oy] of [[-14,4],[12,-6],[6,8]])dot(x,cx+ox,cy+oy,4,'rgba(90,10,0,.5)');
      x.strokeStyle='#5a5250';x.lineWidth=2;for(const s of [-1,1]){box(x,cx+s*38-3,cy-30,6,30,'#2a2624','#000',1);for(let k=0;k<4;k++){x.beginPath();x.ellipse(cx+s*(34-k*5),cy-24+k*5,3,2,0,0,TAU);x.stroke();}}},
    prop:P});
}
