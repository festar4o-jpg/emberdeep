'use strict';
// Canvas rendering: world, player and weapons, monsters, minimap.
// ---------- render ----------
const cv=$('game');let ctx=cv.getContext('2d'); // let: sprites.js paints weapons into sprites through it
let DPR=1,CW=0,CH=0,Z=1;
function resize(){DPR=Math.min(2,window.devicePixelRatio||1);CW=innerWidth;CH=innerHeight;cv.width=Math.round(CW*DPR);cv.height=Math.round(CH*DPR);Z=clamp(Math.min(CW,CH)/430,0.75,1.5);if(!joy.active)placeJoy(null);}
addEventListener('resize',resize);
function resizeTo(w,h){CW=w;CH=h;} // tests: pretend a screen size
// Joystick base: at the thumb while active; otherwise a faint hint where it usually sits (mirrored in left-handed mode).
function placeJoy(on){const j=$('joy'),k=$('knob');if(on){j.style.left=joy.ox+'px';j.style.top=joy.oy+'px';j.style.opacity=1;return;}
  const x=clamp(CW*0.2,150,230);j.style.left=(SETTINGS.lefty?CW-x:x)+'px';j.style.top=(CH-105)+'px';j.style.opacity=0.35;k.style.transform='translate(0,0)';}

function render(){
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#060403';ctx.fillRect(0,0,cv.width,cv.height);
  if(!G.mapCv||!G.p)return;
  const p=G.p;const sx=G.shake?fr(-G.shake,G.shake):0,sy=G.shake?fr(-G.shake,G.shake):0; // fx.js rng: shaking never shifts gameplay rolls
  ctx.setTransform(DPR*Z,0,0,DPR*Z,DPR*(CW/2-G.cam.x*Z+sx),DPR*(CH/2-G.cam.y*Z+sy));
  const vw=CW/Z,vh=CH/Z,vx=G.cam.x-vw/2-20,vy=G.cam.y-vh/2-20;
  const x0=Math.max(0,vx),y0=Math.max(0,vy),x1=Math.min(G.mapCv.width,vx+vw+40),y1=Math.min(G.mapCv.height,vy+vh+40);
  if(x1>x0&&y1>y0)ctx.drawImage(G.mapCv,x0,y0,x1-x0,y1-y0,x0,y0,x1-x0,y1-y0);
  const onScreen=(x,y,m)=>x>vx-m&&x<vx+vw+40+m&&y>vy-m&&y<vy+vh+40+m;
  if(!G.inTown&&G.terrain){ // pulse poison / lava on visible tiles only
    const ember=ACTS[actIdx(G.depth)].gen==='ember',i0=Math.max(0,Math.floor(x0/TILE)),i1=Math.min(MW-1,Math.floor(x1/TILE)),j0=Math.max(0,Math.floor(y0/TILE)),j1=Math.min(MH-1,Math.floor(y1/TILE));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*MW+i,t=G.terrain[k];
      if(t===T_POISON){ctx.fillStyle='#b8ff5a';ctx.globalAlpha=0.05+0.05*Math.sin(G.time*2+i*1.7+j*2.3);ctx.fillRect(i*TILE,j*TILE,TILE,TILE);}
      else if(t===T_LAVA||(ember&&G.grid[k]===2)){ctx.fillStyle='#ffc040';ctx.globalAlpha=0.07+0.07*Math.sin(G.time*3+i*0.9+j*1.3);ctx.fillRect(i*TILE,j*TILE,TILE,TILE);}}
    ctx.globalAlpha=1;}
  drawTorches(onScreen);
  // portal
  const P=G.portal;if(onScreen(P.x,P.y,80)){ctx.save();ctx.translate(P.x,P.y);
    const g=ctx.createRadialGradient(0,0,4,0,0,44);g.addColorStop(0,P.active?'#e9d0ff':'#777');g.addColorStop(0.5,P.active?'#8a3dff99':'#44444499');g.addColorStop(1,'#0000');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,44,0,TAU);ctx.fill();
    ctx.strokeStyle=P.active?'#c79bff':'#666';ctx.lineWidth=3;for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(0,0,30-k*7,G.time*(2+k)+k,G.time*(2+k)+k+3.5);ctx.stroke();}ctx.restore();}
  if(!G.inTown)drawFeatures(onScreen);else drawTownLive(onScreen);
  if(G.inTown&&G.merchant&&onScreen(G.merchant.x,G.merchant.y,120))drawMerchant();
  if(G.inTown&&G.stash&&onScreen(G.stash.x,G.stash.y,80))drawStash();
  if(G.inTown&&G.smith&&onScreen(G.smith.x,G.smith.y,100))drawSmith();
  // hazards & telegraphs
  for(const h of G.hazards){const g=ctx.createRadialGradient(h.x,h.y,5,h.x,h.y,h.r);g.addColorStop(0,h.rot?'#8fd04066':'#ff6a1a66');g.addColorStop(1,h.rot?'#6ab02000':'#ff3a0a00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,TAU);ctx.fill();}
  for(const f of G.fx)if((f.type==='tele'||f.type==='tline')&&!f.own)drawWarning(f,f.t/f.max); // fx.js: enemy attacks, red/orange
  drawSplats(); // fx.js: blood that fades
  for(const f of G.fx)if(f.type==='tline'&&f.own){const t=f.t/f.max;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.a);ctx.strokeStyle=f.col;ctx.globalAlpha=0.7;ctx.lineWidth=2;ctx.strokeRect(0,-f.w/2,f.len,f.w);ctx.globalAlpha=0.2;ctx.fillStyle=f.col;ctx.fillRect(0,-f.w/2,f.len*t,f.w);ctx.restore();ctx.globalAlpha=1;}
  for(const f of G.fx)if(f.type==='tele'&&f.own){const t=f.t/f.max;if(f.meteor)drawMeteorFall(f,t);ctx.strokeStyle=f.col;ctx.globalAlpha=0.8;ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,TAU);ctx.stroke();ctx.fillStyle=f.col;ctx.globalAlpha=0.18;ctx.beginPath();ctx.arc(f.x,f.y,f.r*t,0,TAU);ctx.fill();ctx.globalAlpha=1;}
  for(const h of G.ehaz){if(!onScreen(h.x,h.y,h.r))continue;const a=Math.min(1,h.t/h.max*2)*(0.8+0.2*Math.sin(G.time*5+h.x)),poi=h.kind==='poison',fr=h.kind==='frost';
    ctx.globalAlpha=0.28*a;ctx.fillStyle=poi?'#8fd040':fr?'#8fc8f0':'#ff6a1a';ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,TAU);ctx.fill();
    ctx.globalAlpha=0.35*a;ctx.fillStyle=poi?'#c8ff70':fr?'#e6f6ff':'#ffc040';ctx.beginPath();ctx.arc(h.x,h.y,h.r*0.55,0,TAU);ctx.fill();}
  ctx.globalAlpha=1;
  drawArena();for(const f of G.fx)if(f.type==='cata')drawCata(f,f.t/f.max);else if(f.type==='nova')drawNova(f,f.t/f.max); /* bossfight.js: shrinking arenas, Cataclysm's safe wedge */
  for(const e of G.enemies)if(!e.dead&&e.wind>0&&e.tele){ctx.strokeStyle=e.tele.col;ctx.globalAlpha=0.75;ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,e.tele.r,0,TAU);ctx.stroke();ctx.globalAlpha=0.15;ctx.fillStyle=e.tele.col;ctx.fill();ctx.globalAlpha=1;}
  // loot
  ctx.textAlign='center';LABELS.length=0;
  for(const l of G.loot){if(!onScreen(l.x,l.y,40)||(l.item&&lootHidden(l.item)))continue;const bob=Math.sin(G.time*4+l.x)*2;
    if(l.gem){drawStoneLoot(l,bob);continue;}
    if(l.gold){softShadow(l.x,l.y+5,7,3,0.8);ctx.fillStyle='#c9a440';ctx.strokeStyle='#5a4010';ctx.lineWidth=1.5;for(const [dx,dy] of [[-3,1],[3,2],[0,-1]]){ctx.beginPath();ctx.arc(l.x+dx,l.y+bob+dy,4,0,TAU);ctx.fill();ctx.stroke();}
      lootLabel(l.x,l.y-14,`${l.gold} Gold`,CURRENCY_COL,'rgba(200,180,138,.55)',null,null,true);continue;}
    const col=RCOL[l.item.rarity];
    if(l.item.rarity>=2)drawBeam(l,col,l.item.rarity!==2); // fx.js: rare = short beam, unique/set/Runebind = tall
    const iy=l.y+bob; // rarity-coloured disc with the item's own inventory icon on top
    softShadow(l.x,l.y+12,15-bob,6,0.8);
    ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.arc(l.x,iy,15,0,TAU);ctx.fill();
    ctx.strokeStyle=col;ctx.lineWidth=2;ctx.globalAlpha=0.85;ctx.stroke();ctx.globalAlpha=1;
    const im=iconImg(iconKey(l.item));
    if(im.complete&&im.naturalWidth)ctx.drawImage(im,l.x-12,iy-12,24,24);
    else{ctx.save();ctx.translate(l.x,iy);ctx.rotate(Math.PI/4);ctx.fillStyle=col;ctx.fillRect(-6,-6,12,12);ctx.restore();} // until the icon has loaded
    const cmp=lootCmp(l),tag=lootTag(l.item,cmp); // fx.js: dark box, edged in the rarity colour
    lootLabel(l.x,l.y-24,l.item.name,col,l.item.rarity?col:'#5a5650',tag&&tag.t,tag&&tag.col,!l.item.rarity);}
  // entities sorted by y
  const ents=G.enemies.filter(e=>!e.dead&&onScreen(e.x,e.y,60));G.crowd=ents.length;/* big crowds skip the per-monster top light (sprites.js litBlit) */ents.push(p);if(G.inTown&&G.town)for(const f of G.town.folk)if(onScreen(f.x,f.y,60))ents.push(f);ents.sort((a,b)=>a.y-b.y);
  if(setAuraOn())drawSetAuraGround(p); // on the floor, under every entity
  drawCorpses(); // sprites.js: falling bodies
  for(const e of ents){if(e===p)drawPlayer();else if(e.folk)drawFolk(e);else drawEnemy(e);}
  // projectiles
  drawProjectiles(); // fx.js
  // fx
  for(const f of G.fx){const t=f.t/f.max;
    if(f.type==='arc'){const hf=f.half||1.1,sw=t*0.4*(f.dir||1),lw=(f.lw||10)*(1-t)+2;ctx.globalCompositeOperation='lighter';ctx.strokeStyle=f.col;
      ctx.globalAlpha=(1-t)*0.45;ctx.lineWidth=lw*1.8;ctx.beginPath();ctx.arc(f.x,f.y,f.r,f.a-hf+sw,f.a+hf+sw);ctx.stroke();
      ctx.globalAlpha=1-t;ctx.lineWidth=lw*0.6;ctx.stroke();ctx.strokeStyle='#fff6e0';ctx.globalAlpha=(1-t)*0.7;ctx.lineWidth=Math.max(1,lw*0.18);ctx.beginPath();ctx.arc(f.x,f.y,f.r,f.a-hf*0.8+sw,f.a+hf*0.8+sw);ctx.stroke();
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
    else if(f.type==='lflash'){ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.a);ctx.globalAlpha=1-t;ctx.fillStyle='#fff';ctx.fillRect(0,-f.w/4,f.len,f.w/2);ctx.fillStyle=f.col;ctx.globalAlpha=(1-t)*0.6;ctx.fillRect(0,-f.w/2,f.len,f.w);ctx.restore();ctx.globalAlpha=1;}
    else if(f.type==='boom'||f.type==='cracks')drawSkillFx(f,t);
    else if(f.type==='ring'){const R=f.r0+(f.r1-f.r0)*t;if(elementOf(f.col)==='ice'&&f.r1>100)drawIceRing(f,t,R);ctx.globalCompositeOperation='lighter';ctx.strokeStyle=f.col;ctx.beginPath();ctx.arc(f.x,f.y,R,0,TAU);
      ctx.globalAlpha=(1-t)*0.35;ctx.lineWidth=12*(1-t)+2;ctx.stroke();ctx.globalAlpha=1-t;ctx.lineWidth=3;ctx.stroke();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
    else if(f.type==='bolt')drawBolt(f,t);}
  drawParticles(); // fx.js
  if(G.inTown)drawTownAmb();else drawAir();
  for(const t of G.texts){ctx.globalAlpha=1-t.t/0.9;ctx.font=(t.big?'bold 18px':'bold 13px')+' sans-serif';ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText(t.txt,t.x,t.y);ctx.fillStyle=t.col;ctx.fillText(t.txt,t.x,t.y);}ctx.globalAlpha=1;
  // darkness
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const Lt=G.inTown?townOf(G.depth).light:ACTS[actIdx(G.depth)].light;
  drawFog(); // fx.js: under the light map, so mist only shows where light falls
  drawLighting(Lt); // light.js
  drawBossIntro(); // sprites.js
  drawPhaseBanner(); // bossfight.js
  if(p.hurt>0){ctx.fillStyle=`rgba(160,0,0,${p.hurt})`;ctx.fillRect(0,0,CW,CH);}
  drawLootTip();
}
// A gem or rune on the ground: a small glinting gem (bigger with quality), a skull, or a rune stone, plus its name.
function drawStoneLoot(l,bob){const s=l.gem,x=l.x,y=l.y+bob,col=stoneCol(s);
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.arc(x,y+2,9,0,TAU);ctx.fill();
  if(s.r){ctx.fillStyle='#5d6168';ctx.strokeStyle='#2f3236';ctx.lineWidth=1.5;ctx.fillRect(x-7,y-9,14,18);ctx.strokeRect(x-7,y-9,14,18);
    ctx.fillStyle='#ffd36b';ctx.font='11px Georgia';ctx.fillText(RUNES[s.r].name[0],x,y+4);}
  else if(s.g==='skull'){ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y-1,6,0,TAU);ctx.fill();ctx.fillRect(x-3.5,y+3,7,4);ctx.fillStyle='#2a2418';ctx.fillRect(x-3.5,y-2,2.5,2.5);ctx.fillRect(x+1,y-2,2.5,2.5);}
  else{const z=4+s.q*1.2;ctx.fillStyle=col;ctx.strokeStyle='#00000088';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-z);ctx.lineTo(x+z*0.8,y-z*0.25);ctx.lineTo(x,y+z);ctx.lineTo(x-z*0.8,y-z*0.25);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.globalAlpha=0.5+0.5*Math.sin(G.time*5+x);ctx.fillStyle='#fff';ctx.fillRect(x-1,y-z*0.6,2,2);ctx.globalAlpha=1;}
  if(s.r)drawBeam(l,CURRENCY_COL,false); // runes are rare enough for a beam
  lootLabel(x,y-16,stoneName(s),s.r?CURRENCY_COL:col,'rgba(200,180,138,.6)',null,null,true);}
// Ground loot comparison, cached per item for half a second (bestSlot can run stat calculations).
function lootCmp(l){if(!(l.cmpT>G.time-0.5)||l.cmpT>G.time){l.cmpT=G.time;l.cmp=G.char?compareLoot(G.char,l.item):null;}return l.cmp;}
// Label suffix: the tier numeral, with ▲/▼ against the tier you wear in that slot.
function lootTag(it,cmp){if(!it.tier)return null;const n=TIER_NAME[it.tier-1];
  if(!cmp||cmp.other)return {t:n,col:'#8a7a62'};
  if(!cmp.cur||cmp.dt>0)return {t:n+' ▲',col:'#6f6'};if(cmp.dt<0)return {t:n+' ▼',col:'#f66'};return {t:n,col:'#cdb68a'};}
// Tooltip card above the nearest item in reach: base stats and how they compare with what you wear.
const TIP_R=130;
function drawLootTip(){
  const p=G.p;if(!p||p.dead||G.paused)return;
  let best=null,bd=TIP_R;for(const l of G.loot){if(!l.item||l.taken||lootHidden(l.item))continue;const d=Math.hypot(l.x-p.x,l.y-p.y);if(d<bd){bd=d;best=l;}}
  if(!best)return;
  const it=best.item,cmp=lootCmp(best),lines=[];
  lines.push([it.name,RCOL[it.rarity],'bold 13px']);
  lines.push([`${RNAME[it.rarity]} ${typeLabel(it)}${it.tier?' · '+tierLabel(it):''}`,'#9c8b72','11px']);
  if(it.slot==='weapon')lines.push([`Damage ${Math.round(it.dmin)}–${Math.round(it.dmax)}`,'#e8dcc4','12px']);else if(it.arm)lines.push([`Armor ${Math.round(it.arm)}`,'#e8dcc4','12px']);
  if(it.sockets)lines.push([`${it.sockets} socket${it.sockets>1?'s':''}`,'#9fb8d8','11px']);
  for(const k of itemPowers(it))lines.push(['✦ '+UPOW[k].t,'#ff9a3a','11px']);
  const sv=setView(it,G.char);if(sv){const ON='#3fe05a',OFF='#7a7a7a';
    for(const o of sv.own)lines.push([`${o.text} (${o.need} set)`,o.on?ON:OFF,'11px']);
    lines.push([`${sv.name} (${sv.n}/${sv.total})`,ON,'bold 11px']);
    for(const p of sv.pieces)lines.push([(p.worn?'● ':'○ ')+p.name,p.worn?ON:OFF,'11px']);
    for(const b of sv.bonus)lines.push([`${b.full?'Full set':`(${b.need})`}: ${b.text}`,b.on?ON:OFF,'11px']);}
  if(cmp){
    if(cmp.other)lines.push([`${CLASSES[it.cls].name} item`,'#e07a5a','12px']);
    else if(!cmp.cur)lines.push([`▲ ${SLOT_NAME[cmp.sl]} is empty`,'#6f6','12px']);
    else{const c=cmp.cur,ct=c.tier?'Tier '+TIER_NAME[c.tier-1]+' ':'';
      lines.push([`vs ${ct}${c.name}${c.upg?' +'+c.upg:''}`,'#9c8b72','11px']);
      const tierTxt=cmp.dt>0?`▲ ${cmp.dt} tier${cmp.dt>1?'s':''} higher`:cmp.dt<0?`▼ ${-cmp.dt} tier${cmp.dt<-1?'s':''} lower`:'= same tier';
      const pctTxt=cmp.pct==null?'':` · ${cmp.pct>=0?'+':''}${Math.round(cmp.pct*100)}% ${cmp.stat}`;
      const good=cmp.pct==null?cmp.dt:cmp.pct;
      lines.push([tierTxt+pctTxt,good>0.005?'#6f6':good<-0.005?'#f66':'#cdb68a','12px']);}
  }
  let w=0;for(const [t,,f] of lines){ctx.font=f+' sans-serif';w=Math.max(w,ctx.measureText(t).width);}
  const lh=16,pad=7,bw=w+pad*2,bh=lines.length*lh+pad*2-2;
  const sx=(best.x-G.cam.x)*Z+CW/2,sy=(best.y-G.cam.y)*Z+CH/2-34*Z;
  const x=clamp(sx-bw/2,6,CW-bw-6),y=clamp(sy-bh,6,CH-bh-6);
  ctx.fillStyle='rgba(16,11,8,.92)';ctx.strokeStyle=RCOL[it.rarity];ctx.lineWidth=1.5;
  ctx.beginPath();ctx.rect(x,y,bw,bh);ctx.fill();ctx.stroke();
  ctx.textAlign='left';ctx.textBaseline='top';
  lines.forEach(([t,col,f],i)=>{ctx.font=f+' sans-serif';ctx.fillStyle=col;ctx.fillText(t,x+pad,y+pad+i*lh);});
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
}
// Hand pose during an attack: [x, y, angle] in the player's local frame. side = +1 main hand, -1 off hand.
function handPose(style,u,side){const S=Math.sin(u*Math.PI);
  if(style==='stab')return [5+S*16,side*(12-S*5),side*0.12];         // quick straight jab
  if(style==='flick')return [5+S*6,12*side,side*(0.5-S*0.9)];         // wand flick
  if(style==='thrust')return [5+S*10,11*side,side*0.15];
  if(style==='heavy')return [5+S*4,12*side,side*heavyAng(u)];
  const e=1-(1-u)*(1-u);return [5+S*5,12*side,side*(1.4-e*2.3)];     // one-hand swing across the front
}
// Two-hander: slow wind-up behind the shoulder, then a fast heavy follow-through.
function heavyAng(u){if(u<0.35)return 0.6+u/0.35*1.3;const k=(u-0.35)/0.65;return 1.9-(1-Math.pow(1-k,3))*3.5;}
// Weapon shapes drawn along +x from the grip at the origin; two-handers are drawn much larger.
function drawWeapon(wt,glow){
  ctx.lineCap='round';
  const ln=(c,w,x0,x1)=>{ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x0,0);ctx.lineTo(x1,0);ctx.stroke();};
  const poly=(f,st,pts)=>{ctx.fillStyle=f;ctx.strokeStyle=st;ctx.lineWidth=1.2;ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.stroke();};
  const guard=(x,h,w)=>{ctx.strokeStyle='#8a7444';ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,-h);ctx.lineTo(x,h);ctx.stroke();};
  const glowAt=(x,r,col)=>{const g=ctx.createRadialGradient(x,0,1,x,0,r);g.addColorStop(0,'#fff');g.addColorStop(0.4,col);g.addColorStop(1,col+'00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,0,r,0,TAU);ctx.fill();};
  switch(wt){
    case 'dagger':ln('#4a2e17',3,-3,2);guard(2,3,2.2);poly('#b4b8b8','#5d6268',[[2,-1.8],[13,-1.2],[17,0],[13,1.2],[2,1.8]]);break;
    case 'axe':ln('#7a5230',3.2,-4,23);poly('#9a9ea0','#4c5258',[[15,-1.5],[23,-1.5],[26,-10],[13,-8.5]]);break;
    case 'mace':ln('#7a5230',3.2,-4,18);ctx.strokeStyle='#4d545a';ctx.lineWidth=2;for(let k=0;k<6;k++){const q=k/6*TAU;ctx.beginPath();ctx.moveTo(21+Math.cos(q)*4,Math.sin(q)*4);ctx.lineTo(21+Math.cos(q)*8,Math.sin(q)*8);ctx.stroke();}
      ctx.fillStyle='#9aa3aa';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(21,0,5,0,TAU);ctx.fill();ctx.stroke();break;
    case 'greatsword':ln('#5a3a1e',4,-11,4);guard(4,8,3.5);poly('#b0b4b4','#50565c',[[4,-3.2],[44,-2.6],[50,0],[44,2.6],[4,3.2]]);ctx.strokeStyle='#9aa3aa';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(40,0);ctx.stroke();break;
    case 'greataxe':ln('#6b4423',4,-12,42);poly('#9a9ea0','#4c5258',[[30,-2],[40,-2],[45,-15],[27,-12]]);poly('#9a9ea0','#4c5258',[[30,2],[40,2],[45,15],[27,12]]);break;
    case 'maul':ln('#6b4423',4.2,-12,34);poly('#8f979e','#3d4348',[[31,-10],[45,-10],[45,10],[31,10]]);ctx.strokeStyle='#5c646b';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(34,-10);ctx.lineTo(34,10);ctx.moveTo(42,-10);ctx.lineTo(42,10);ctx.stroke();break;
    case 'wand':ln('#e6dcc3',2.6,-3,15);glowAt(17,glow?10:5,'#ffd36b');break;
    case 'scepter':ln('#c9a24a',3,-3,16);if(glow)glowAt(19.5,13,'#ff8a2a');ctx.fillStyle='#ff8a2a';ctx.strokeStyle='#c9a24a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(19.5,0,4.5,0,TAU);ctx.fill();ctx.stroke();break;
    case 'staff':ln('#8a5f35',4,-16,33);glowAt(37,glow?16:10,'#c48bff');break;
    case 'scimitar':ln('#5a3a1e',3.5,-4,3);guard(3,4.5,2.6);ctx.fillStyle='#b4b8b8';ctx.strokeStyle='#5d6268';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(3,-2);ctx.quadraticCurveTo(20,-3,31,-9);ctx.quadraticCurveTo(24,1,3,2);ctx.closePath();ctx.fill();ctx.stroke();break;
    case 'spear':ln('#8a5f35',3.2,-14,47);ln('#c9a24a',4.5,43,46);poly('#b0b4b4','#50565c',[[46,-3.2],[60,0],[46,3.2]]);break;
    case 'flail':{ln('#7a5230',3.2,-4,13);const sw=Math.sin(G.time*9)*3;ctx.strokeStyle='#8f979e';ctx.lineWidth=1.6;ctx.setLineDash([2,1.5]);ctx.beginPath();ctx.moveTo(13,0);ctx.quadraticCurveTo(18,sw,23,sw*0.6);ctx.stroke();ctx.setLineDash([]);
      ctx.strokeStyle='#4d545a';ctx.lineWidth=2;for(let k=0;k<6;k++){const q=k/6*TAU;ctx.beginPath();ctx.moveTo(27+Math.cos(q)*3.5,sw*0.6+Math.sin(q)*3.5);ctx.lineTo(27+Math.cos(q)*7.5,sw*0.6+Math.sin(q)*7.5);ctx.stroke();}
      ctx.fillStyle='#9aa3aa';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(27,sw*0.6,4.8,0,TAU);ctx.fill();ctx.stroke();break;}
    case 'runeblade':ln('#3a2a4a',3.5,-4,3);guard(3,5,3);poly('#9fc4e8','#3a6a9a',[[3,-2.2],[28,-1.8],[33,0],[28,1.8],[3,2.2]]);ctx.fillStyle=glow?'#ffffff':'#7ff0ff';for(const x of [9,15,21])ctx.fillRect(x,-0.8,3,1.6);break;
    case 'demonblade':ln('#1a0a0a',3.5,-4,3);guard(3,5,3);if(glow)glowAt(20,14,'#ff3a2a');poly('#3a0f10','#e0453a',[[3,-2.5],[30,-2],[36,0],[30,2],[3,2.5]]);poly('#3a0f10','#e0453a',[[9,-2.4],[12,-6.5],[14,-2.3]]);poly('#3a0f10','#e0453a',[[19,-2.2],[22,-6.5],[24,-2.1]]);break;
    case 'rod':ln('#b08a5a',3,-3,18);if(glow)glowAt(22,11,'#7fe0ff');poly('#7fe0ff','#2e7ca8',[[18,0],[21.5,-3.5],[26,0],[21.5,3.5]]);break;
    case 'thornstaff':ln('#5a4a2a',4,-16,33);ctx.strokeStyle='#8ae05a';ctx.lineWidth=1.5;ctx.beginPath();for(const [x,d] of [[2,-1],[10,1],[18,-1],[26,1]]){ctx.moveTo(x,d*2);ctx.lineTo(x+3,d*5);}ctx.stroke();glowAt(37,glow?16:10,'#8ae05a');break;
    case 'runewand':ln('#9fc4e8',2.6,-3,15);ctx.fillStyle='#2e7ca8';for(const x of [2,7,12])ctx.fillRect(x,-0.6,2,1.2);glowAt(17,glow?10:5,'#7ff0ff');break;
    case 'demonstaff':ln('#3a1a1a',4,-16,31);if(glow)glowAt(36,16,'#ff3a2a');ctx.fillStyle='#e8dcc4';ctx.strokeStyle='#5a1a1a';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(36,0,5,0,TAU);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#8a1a1a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(34,-4);ctx.quadraticCurveTo(33,-9,37,-11);ctx.moveTo(34,4);ctx.quadraticCurveTo(33,9,37,11);ctx.stroke();ctx.fillStyle='#ff3a2a';ctx.fillRect(37,-2.5,1.8,1.8);ctx.fillRect(37,0.7,1.8,1.8);break;
    default:ln('#5a3a1e',3.5,-4,3);guard(3,5,3);poly('#b4b8b8','#5d6268',[[3,-2],[26,-1.6],[31,0],[26,1.6],[3,2]]); // sword
  }
}
// ---------- full-set aura (dungeon only): a glow and rune ring on the ground, a green rim light, rising motes ----------
// Colours come from each full set's theme (SETS[k].aura); with two full sets the inner and outer rings, the glow
// and the motes share both colours.
const setAuraOn=()=>!G.inTown&&!G.p.dead&&!!(G.stats&&G.stats.fullSets&&G.stats.fullSets.length);
const auraCols=()=>{const c=G.stats.fullSets.map(k=>SETS[k].aura||'63,224,90');return c.length?c:['63,224,90'];};
const auraLight=c=>c.split(',').map(v=>Math.round(+v+(255-v)*0.65)).join(','); // the colour mixed toward white
function drawSetAuraGround(p){const t=G.time,pulse=0.5+0.5*Math.sin(t*2.6),R=58+6*pulse,y=p.y+p.r*0.55,cs=auraCols(),A=cs[0],B=cs[1]||cs[0];
  ctx.save();ctx.globalCompositeOperation='lighter';
  // soft pool of light under the feet (an ellipse, so it reads as lying on the floor)
  ctx.translate(p.x,y);ctx.scale(1,0.5);
  let g=ctx.createRadialGradient(0,0,4,0,0,R);g.addColorStop(0,`rgba(${auraLight(A)},${0.5+0.2*pulse})`);g.addColorStop(0.3,`rgba(${A},${0.42+0.15*pulse})`);g.addColorStop(0.65,`rgba(${B},${0.2+0.1*pulse})`);g.addColorStop(1,`rgba(${B},0)`);
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,R,0,TAU);ctx.fill();
  // two counter-rotating rune rings
  ctx.lineWidth=2.5;ctx.strokeStyle=`rgba(${A},${0.7+0.25*pulse})`;ctx.setLineDash([10,7]);ctx.lineDashOffset=-t*30;ctx.beginPath();ctx.arc(0,0,36,0,TAU);ctx.stroke();
  ctx.lineWidth=1.5;ctx.strokeStyle=`rgba(${B},${0.45+0.2*pulse})`;ctx.setLineDash([3,9]);ctx.lineDashOffset=t*22;ctx.beginPath();ctx.arc(0,0,48,0,TAU);ctx.stroke();ctx.setLineDash([]);
  // four glinting rune marks on the outer ring
  ctx.fillStyle=`rgba(${auraLight(B)},${0.6+0.4*pulse})`;for(let k=0;k<4;k++){const a=t*0.9+k*TAU/4;ctx.beginPath();ctx.arc(Math.cos(a)*48,Math.sin(a)*48,2.6,0,TAU);ctx.fill();}
  ctx.restore();}
// Motes drifting up around the character, in front of the body; their positions follow the clock (no state).
function drawSetAuraMotes(p,z){const t=G.time,cs=auraCols();ctx.save();ctx.globalCompositeOperation='lighter';
  for(let k=0;k<9;k++){const ph=(t*0.55+k/9)%1,a=k*2.39+Math.sin(t*0.7+k)*0.4,r=16+ (k%3)*7,c=cs[k%cs.length];
    const x=p.x+Math.cos(a)*r,y=p.y+p.r*0.4-z-ph*46,al=Math.sin(ph*Math.PI);
    ctx.fillStyle=`rgba(${c},${0.9*al})`;ctx.beginPath();ctx.arc(x,y,2.4,0,TAU);ctx.fill();
    ctx.fillStyle=`rgba(${auraLight(c)},${0.8*al})`;ctx.beginPath();ctx.arc(x,y,1.1,0,TAU);ctx.fill();}
  ctx.restore();}
function drawPlayer(){
  const p=G.p,C=CLASSES[G.char.cls];let z=0;if(p.leap){z=Math.sin(Math.min(1,p.leap.t/p.leap.dur)*Math.PI)*40;}
  const aura=setAuraOn();
  softShadow(p.x,p.y+p.r*0.55,p.r*1.5*(1-z/120),p.r*0.75*(1-z/120),1-z/80);
  if(p.dead){ctx.globalAlpha=0.4;}else if(p.dodge)ctx.globalAlpha=0.55; // see-through while dodging (untouchable)
  if(p.spin>0){ctx.strokeStyle='#ffe0b0';ctx.lineWidth=4;for(let k=0;k<3;k++){const a=G.time*18+k*TAU/3;ctx.globalAlpha=0.7;ctx.beginPath();ctx.arc(p.x,p.y,82,a,a+0.9);ctx.stroke();}ctx.globalAlpha=1;}
  if(hasPw('burnAura')&&!G.inTown&&!p.dead){const g=ctx.createRadialGradient(p.x,p.y,10,p.x,p.y,AURA_R);g.addColorStop(0,'#ff6a1a00');g.addColorStop(0.7,`rgba(255,110,30,${0.10+0.05*Math.sin(G.time*6)})`);g.addColorStop(1,'#ff6a1a00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,AURA_R,0,TAU);ctx.fill();}
  if(aura){ctx.globalCompositeOperation='lighter';const r=p.r*2.6,A=0.55+0.2*Math.sin(G.time*3);ctx.globalAlpha=A;ctx.drawImage(falloff(auraCols()[0]),p.x-r,p.y-z-r,r*2,r*2);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';} // rim light in the set's colour
  const heroF=p.spin>0?0:animFrame(p,11);
  ctx.save();ctx.translate(p.x,p.y-z);
  if(p.slowT>0){ctx.strokeStyle='#9fdcff';ctx.globalAlpha=0.6;ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,0,p.r+4,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;}
  if(p.buffT>0){ctx.strokeStyle='#ffcc55';ctx.globalAlpha=0.5+Math.sin(G.time*8)*0.2;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,p.r+6,0,TAU);ctx.stroke();ctx.globalAlpha=1;}
  const C2=G.char,eq=C2.equip,mw=eq.mainhand&&eq.mainhand.slot==='weapon'?eq.mainhand:null,off=eq.offhand,W=mw?WEAPONS[mw.wt]||FIST:null;
  const A=p.atk,u=A?Math.min(1,A.t/A.dur):0,S=Math.sin(u*Math.PI),spin=p.spin>0;
  // body: follows through on a blow, rocks back when hit, breathes when standing still; lit from the top (sprites.js)
  const ang=spin?G.time*20:p.face,push=(A?S*4:0)-(p.hurt>0?p.hurt*10:0),bx=p.x+Math.cos(ang)*push,by=p.y-z+Math.sin(ang)*push;
  const moved=Math.abs((p._ap||0)-(p._ap1??-1))>1e-6;p._ap1=p._ap||0;
  const HS=heroSprite(C2.cls,p.r,heroF),hb=!moved&&!A&&!spin?1+0.02*Math.sin(G.time*2.2):1;
  ctx.restore();ctx.save(); // leave the ring overlays' frame
  litBlit(HS,bx,by,ang,p.dead?0.4:p.dodge?0.55:null,hb*(p.dead?0.92:1));
  ctx.translate(bx,by);ctx.rotate(ang); // local frame: +x = facing, +y = main-hand side
  if(p.dead)ctx.globalAlpha=0.4;else if(p.dodge)ctx.globalAlpha=0.55;
  const hand=(x,y)=>{ctx.fillStyle=C2.cls==='warden'?'#5e5a54':'#a88a70';ctx.strokeStyle='#140d08';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,3.4,0,TAU);ctx.fill();ctx.stroke();};
  const at=(x,y,ang,fn)=>{ctx.save();ctx.translate(x,y);ctx.rotate(ang);fn();ctx.restore();};
  if(W&&W.hands===2){ // two-hander: both hands on the grip
    const staff=W.anim==='thrust'; /* staffs and spears: held forward, low grip */let gx=staff?5:6,gy=staff?11:9,ang=staff?0.2:0.7;
    if(spin)ang=1.3;
    else if(A){if(A.style==='heavy'){ang=heavyAng(u);gx+=S*4;}else if(A.style==='thrust')gx+=S*10;else if(A.style==='swing')ang=1.4-(1-(1-u)*(1-u))*2.3;}
    at(gx,gy,ang,()=>{const WS=weaponSprite(mw.wt,!!A&&staff);ctx.drawImage(WS,-64,-64,128,128);hand(staff?0:-1,0);hand(staff?-9:-8,0);});
  }else{
    const pose=(side,h)=>spin?[6,12*side,side*1.3]:A&&A.hand===h?handPose(A.style,u,side):[5,12*side,side*0.5];
    const [x,y,g]=pose(1,'mh');at(x,y,g,()=>{if(W){const WS=weaponSprite(mw.wt,!!A&&A.hand==='mh');ctx.drawImage(WS,-64,-64,128,128);}hand(0,0);});
    if(off&&off.slot==='weapon'){const [x2,y2,g2]=pose(-1,'oh');at(x2,y2,g2,()=>{ctx.scale(1,-1);const WS=weaponSprite(off.wt,false);ctx.drawImage(WS,-64,-64,128,128);hand(0,0);});}
    else if(off&&off.slot==='shield'){const lift=A&&A.hand==='mh'?-S*2:0;ctx.fillStyle='#4e3420';ctx.strokeStyle='#7a6a4a';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(9,-13+lift,9.5,0,TAU);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#5a3418';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(9,-22.5+lift);ctx.lineTo(9,-3.5+lift);ctx.stroke();ctx.fillStyle='#c9a24a';ctx.beginPath();ctx.arc(9,-13+lift,3,0,TAU);ctx.fill();}
    else if(off&&off.slot==='focus'){hand(6,-12);
      if(off.kind==='tome'){ctx.fillStyle='#7a2a2a';ctx.strokeStyle='#3a1212';ctx.lineWidth=1.5;ctx.fillRect(3,-23,12,10);ctx.strokeRect(3,-23,12,10);ctx.fillStyle='#e8dcc4';ctx.fillRect(13,-22,2,8);
        ctx.globalAlpha=0.6+Math.sin(G.time*4)*0.3+(A?0.3:0);ctx.fillStyle='#ffd36b';ctx.beginPath();ctx.arc(8.5,-18,2.2,0,TAU);ctx.fill();ctx.globalAlpha=1;}
      else{const bob=Math.sin(G.time*3)*1.5,ox=14,oy=-15+bob,R=A?12:8;const gr=ctx.createRadialGradient(ox,oy,1,ox,oy,R);gr.addColorStop(0,'#fff');gr.addColorStop(0.35,'#c48bff');gr.addColorStop(1,'#c48bff00');
        ctx.fillStyle=gr;ctx.beginPath();ctx.arc(ox,oy,R,0,TAU);ctx.fill();ctx.fillStyle='#6a3fb5';ctx.globalAlpha=0.7;ctx.beginPath();ctx.arc(ox,oy,3.5,0,TAU);ctx.fill();ctx.globalAlpha=1;}}
    else hand(5,-12);
  }
  ctx.restore();ctx.globalAlpha=1;
  if(aura)drawSetAuraMotes(p,z);
}
function drawMerchant(){
  const {x,y}=G.merchant;
  ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(x-60,y+12,120,8);
  ctx.fillStyle='#3a2612';ctx.fillRect(x-55,y-60,5,64);ctx.fillRect(x+50,y-60,5,64);
  for(let k=0;k<8;k++){ctx.fillStyle=k%2?'#e8dcc4':'#a3262f';ctx.fillRect(x-60+k*15,y-72,15,14);}
  ctx.fillStyle='#2f6b4a';ctx.strokeStyle='#140d08';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y-18,15,0,TAU);ctx.fill();ctx.stroke();
  ctx.fillStyle='#e8c9a0';ctx.beginPath();ctx.arc(x,y-15,7,0,TAU);ctx.fill();
  ctx.fillStyle='#5a3b1c';ctx.strokeStyle='#2a1a0a';ctx.lineWidth=2;ctx.fillRect(x-56,y-4,112,18);ctx.strokeRect(x-56,y-4,112,18);
  for(const [c,o] of [['#d33',-38],['#d33',-28],['#3a7bd5',-18],['#f2d04a',22],['#6f8fff',36]]){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x+o,y-6,4,0,TAU);ctx.fill();}
  ctx.font='12px Georgia';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText('Merchant',x,y-78);ctx.fillStyle='#f2d04a';ctx.fillText('Merchant',x,y-78);
}
// Blacksmith: forge glow, anvil and the smith with a hammer.
function drawSmith(){
  const {x,y}=G.smith,fl=0.6+0.4*Math.sin(G.time*7)*Math.sin(G.time*3.1);
  const g=ctx.createRadialGradient(x+34,y-6,2,x+34,y-6,46);g.addColorStop(0,`rgba(255,140,40,${0.55*fl})`);g.addColorStop(1,'rgba(255,90,20,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x+34,y-6,46,0,TAU);ctx.fill();
  ctx.fillStyle='#3a3530';ctx.strokeStyle='#140d08';ctx.lineWidth=2;ctx.fillRect(x+24,y-20,22,26);ctx.strokeRect(x+24,y-20,22,26);ctx.fillStyle=`rgba(255,${120+60*fl|0},40,1)`;ctx.fillRect(x+29,y-10,12,8);
  ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(x-24,y+10,40,7);
  ctx.fillStyle='#4a4f57';ctx.strokeStyle='#1a1c20';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-22,y-4);ctx.lineTo(x+12,y-4);ctx.lineTo(x+6,y+2);ctx.lineTo(x-16,y+2);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillRect(x-10,y+2,10,10);
  ctx.fillStyle='#7a4a2a';ctx.strokeStyle='#140d08';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x-6,y-26,13,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#e8c9a0';ctx.beginPath();ctx.arc(x-6,y-24,6.5,0,TAU);ctx.fill();
  const sw=Math.max(0,Math.sin(G.time*4))*0.9;ctx.save();ctx.translate(x+4,y-28);ctx.rotate(-0.6+sw);ctx.strokeStyle='#6b4423';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(14,0);ctx.stroke();ctx.fillStyle='#8f979e';ctx.fillRect(12,-4,7,8);ctx.restore();
  ctx.font='12px Georgia';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText('Blacksmith',x,y-46);ctx.fillStyle='#e8a060';ctx.fillText('Blacksmith',x,y-46);
}
// Stash chest: wooden box with iron bands and a gold lock.
function drawStash(){
  const {x,y}=G.stash;
  ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(x-30,y+10,60,7);
  ctx.strokeStyle='#140d08';ctx.lineWidth=3;
  ctx.fillStyle='#6b4423';ctx.fillRect(x-26,y-18,52,30);ctx.strokeRect(x-26,y-18,52,30);
  ctx.fillStyle='#7d5129';ctx.beginPath();ctx.moveTo(x-26,y-18);ctx.quadraticCurveTo(x,y-38,x+26,y-18);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#4a4f57';for(const o of [-17,13])ctx.fillRect(x+o,y-28,4,40);
  ctx.fillRect(x-26,y-19,52,4);
  ctx.fillStyle='#f2d04a';ctx.fillRect(x-5,y-16,10,10);ctx.fillStyle='#140d08';ctx.fillRect(x-1,y-13,2,4);
  ctx.font='12px Georgia';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText('Stash',x,y-42);ctx.fillStyle='#d9a441';ctx.fillText('Stash',x,y-42);
}
// Monster silhouettes, drawn around (0,0) after translate to the monster.
const SHAPES={};
{
  const body=(r,col)=>{ctx.fillStyle=col;ctx.strokeStyle='#0a0705';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.stroke();};
  const eyes=(e,c,sp,sz)=>{const r=e.r;ctx.fillStyle=c||'#ff2a1a';for(const s of [-1,1]){ctx.beginPath();ctx.arc(r*0.45,s*r*(sp||0.27),Math.max(2,r*(sz||0.13)),0,TAU);ctx.fill();}};
  SHAPES.blob=(e,col)=>{ctx.rotate(e.face);body(e.r,col);eyes(e);};
  SHAPES.archer=(e,col)=>{ctx.rotate(e.face);body(e.r,col);eyes(e);ctx.strokeStyle='#8a7a5a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.r,0,9,-1.2,1.2);ctx.stroke();};
  SHAPES.boss=(e,col)=>{ctx.fillStyle=col;ctx.strokeStyle='#0a0705';ctx.lineWidth=2.5;ctx.beginPath();for(let k=0;k<10;k++){const a=k/10*TAU+G.time*0.5,rr=k%2?e.r:e.r*1.15;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();ctx.stroke();
    ctx.rotate(e.face);const r=e.r,k=e.kind||0,cc=['#e8e0c0','#e0a860','#9fe04a','#dff4ff','#ffb040'][k];
    if(e.phase){ctx.globalAlpha=0.35+Math.sin(G.time*6)*0.15;ctx.strokeStyle=cc;ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r+8,0,TAU);ctx.stroke();ctx.globalAlpha=1;}
    ctx.fillStyle=cc;ctx.strokeStyle='#0a0705';ctx.lineWidth=1.5; // crown on the back of the head
    if(k===2){for(let i=0;i<6;i++){const a=Math.PI*0.6+i/5*Math.PI*0.8,w=Math.sin(G.time*3+i)*0.15;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*0.8,Math.sin(a)*r*0.8);ctx.quadraticCurveTo(Math.cos(a+w)*r*1.5,Math.sin(a+w)*r*1.5,Math.cos(a-w)*r*1.8,Math.sin(a-w)*r*1.8);ctx.strokeStyle=cc;ctx.lineWidth=3;ctx.stroke();}}
    else{const n=k===1?2:5;for(let i=0;i<n;i++){const a=n===2?Math.PI+(i?0.7:-0.7):Math.PI*0.7+i/(n-1)*Math.PI*0.6,h=k===3?0.75:k===1?0.9:0.5,b=0.18;
      ctx.beginPath();ctx.moveTo(Math.cos(a-b)*r*0.75,Math.sin(a-b)*r*0.75);ctx.lineTo(Math.cos(a)*r*(1+h),Math.sin(a)*r*(1+h));ctx.lineTo(Math.cos(a+b)*r*0.75,Math.sin(a+b)*r*0.75);ctx.closePath();
      if(k===4){ctx.globalAlpha=0.7+Math.sin(G.time*10+i)*0.3;}ctx.fill();ctx.stroke();ctx.globalAlpha=1;}}
    eyes(e,k===3?'#5ae0ff':k===2?'#d0ff60':'#ffdd33');};
  SHAPES.scarab=(e,col)=>{ctx.rotate(e.face);const r=e.r,w=Math.sin(G.time*30+e.seed)*2;ctx.strokeStyle='#111';ctx.lineWidth=1.5;ctx.beginPath();
    for(const s of [-1,1])for(let k=-1;k<=1;k++){ctx.moveTo(k*r*0.5,s*r*0.5);ctx.lineTo(k*r*0.6+w*s,s*r*1.25);}ctx.stroke();
    ctx.fillStyle=col;ctx.strokeStyle='#0a0705';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,r*1.25,r*0.85,0,0,TAU);ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(r*0.6,0);ctx.stroke();ctx.fillStyle='#14202a';ctx.beginPath();ctx.arc(r*1.05,0,r*0.45,0,TAU);ctx.fill();};
  SHAPES.robe=(e,col,T)=>{ctx.rotate(e.face);const r=e.r;ctx.fillStyle=col;ctx.strokeStyle='#0a0705';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(r*1.1,0);ctx.lineTo(-r*0.9,r);ctx.lineTo(-r*0.6,0);ctx.lineTo(-r*0.9,-r);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.arc(r*0.2,0,r*0.5,0,TAU);ctx.fill();eyes(e,T.orb,0.18,0.1);
    const g=e.wind>0?14:8,ox=r*0.6,oy=r*1.05,gr=ctx.createRadialGradient(ox,oy,1,ox,oy,g);gr.addColorStop(0,'#fff');gr.addColorStop(0.4,T.orb);gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(ox,oy,g,0,TAU);ctx.fill();};
  SHAPES.worm=(e,col)=>{ctx.rotate(e.face);const r=e.r;for(let k=3;k>=1;k--){ctx.fillStyle=k%2?col:'#8a6440';ctx.strokeStyle='#0a0705';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-k*r*0.55,Math.sin(G.time*4+k)*3,r*(1-k*0.15),0,TAU);ctx.fill();ctx.stroke();}
    body(r,col);ctx.fillStyle='#2a0a08';ctx.beginPath();ctx.arc(r*0.35,0,r*0.55,0,TAU);ctx.fill();ctx.fillStyle='#f0e8d0';
    for(let k=0;k<8;k++){const a=k/8*TAU;ctx.beginPath();ctx.moveTo(r*0.35+Math.cos(a)*r*0.55,Math.sin(a)*r*0.55);ctx.lineTo(r*0.35+Math.cos(a)*r*0.3,Math.sin(a)*r*0.3);ctx.lineTo(r*0.35+Math.cos(a+0.3)*r*0.55,Math.sin(a+0.3)*r*0.55);ctx.fill();}};
  SHAPES.toad=(e,col)=>{ctx.rotate(e.face);const r=e.r,sq=e.hopT>0?1.12:1;ctx.fillStyle=col;ctx.strokeStyle='#0a0705';ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(0,0,r*1.15*sq,r*0.95/sq,0,0,TAU);ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(200,230,110,.5)';for(const [a,b,c] of [[-0.4,0.4,0.22],[-0.5,-0.35,0.18],[0.1,-0.1,0.15],[-0.1,0.55,0.12]]){ctx.beginPath();ctx.arc(a*r,b*r,c*r,0,TAU);ctx.fill();}
    for(const s of [-1,1]){ctx.fillStyle=col;ctx.strokeStyle='#0a0705';ctx.beginPath();ctx.arc(r*0.55,s*r*0.45,r*0.28,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#ffd040';ctx.beginPath();ctx.arc(r*0.62,s*r*0.45,r*0.13,0,TAU);ctx.fill();}};
  SHAPES.vine=(e,col)=>{const r=e.r;ctx.strokeStyle='#2a1a0e';ctx.lineWidth=3;ctx.beginPath();for(let k=0;k<5;k++){const a=k/5*TAU+e.seed;ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*r*1.5,Math.sin(a)*r*1.5);}ctx.stroke();
    ctx.save();ctx.rotate(G.time*0.6+e.seed);ctx.fillStyle='#2c4e1e';ctx.beginPath();for(let k=0;k<14;k++){const a=k/14*TAU,rr=k%2?r*1.35:r*0.8;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();ctx.restore();
    ctx.rotate(e.face);body(r*0.8,col);ctx.fillStyle='#e04a6a';ctx.beginPath();ctx.moveTo(r*0.75,0);ctx.lineTo(r*0.2,-r*0.3);ctx.lineTo(r*0.2,r*0.3);ctx.fill();};
  SHAPES.troll=(e,col)=>{ctx.rotate(e.face);const r=e.r;body(r,col);ctx.fillStyle='rgba(30,50,20,.6)';ctx.beginPath();ctx.arc(-r*0.35,0,r*0.65,Math.PI*0.5,Math.PI*1.5);ctx.fill();
    ctx.fillStyle='#2f4a22';for(const [a,b] of [[-0.5,0.4],[-0.2,-0.55],[-0.6,-0.2]]){ctx.beginPath();ctx.arc(a*r,b*r,r*0.2,0,TAU);ctx.fill();}
    eyes(e,'#ffb020');ctx.strokeStyle='#efe6c8';ctx.lineWidth=2.5;for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(r*0.75,s*r*0.15);ctx.lineTo(r*1.05,s*r*0.3);ctx.stroke();}
    if(e.hp<e.maxHp&&G.time-(e.lastHit||-9)>2&&!(e.bleedT>0)){ctx.strokeStyle='rgba(120,230,90,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r+3,0,TAU);ctx.stroke();}};
  SHAPES.wraith=(e,col)=>{ctx.rotate(e.face);const r=e.r;ctx.globalAlpha=0.82;ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,Math.PI/2);
    for(let k=0;k<=4;k++){const t=k/4;ctx.lineTo(-r*0.4-t*r*1.4,(1-2*t)*r*0.9+Math.sin(G.time*6+k+e.seed)*4);}ctx.closePath();ctx.fill();ctx.globalAlpha=1;eyes(e,'#5ae0ff',0.3,0.15);};
  SHAPES.golem=(e,col)=>{ctx.rotate(e.face);const r=e.r;ctx.fillStyle=col;ctx.strokeStyle='#1a2a3a';ctx.lineWidth=3;ctx.beginPath();for(let k=0;k<6;k++){const a=k/6*TAU+0.5;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(230,248,255,.35)';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(0.5)*r,Math.sin(0.5)*r);ctx.lineTo(Math.cos(1.55)*r,Math.sin(1.55)*r);ctx.fill();
    ctx.fillStyle='#dff4ff';for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(-r*0.1,s*r*0.75);ctx.lineTo(r*0.15,s*r*1.25);ctx.lineTo(r*0.3,s*r*0.7);ctx.fill();}eyes(e,'#5ae0ff',0.25,0.1);};
  SHAPES.shard=(e,col)=>{const r=e.r;ctx.save();ctx.rotate(G.time*2+e.seed);ctx.fillStyle=col;ctx.strokeStyle='#1a3a5a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r*1.2,0);ctx.lineTo(0,r*0.75);ctx.lineTo(-r*1.2,0);ctx.lineTo(0,-r*0.75);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.45)';ctx.beginPath();ctx.moveTo(r*0.6,0);ctx.lineTo(0,r*0.35);ctx.lineTo(-r*0.6,0);ctx.lineTo(0,-r*0.35);ctx.fill();ctx.restore();ctx.rotate(e.face);eyes(e,'#1a3a8a',0.2,0.1);};
  SHAPES.imp=(e,col)=>{ctx.rotate(e.face);const r=e.r,f=Math.sin(G.time*25+e.seed)*0.35;ctx.fillStyle='#5a1a10';for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(-r*0.2,s*r*0.4);ctx.lineTo(-r*1.3,s*r*(1.5+f));ctx.lineTo(-r*0.9,s*r*0.3);ctx.fill();}
    body(r,col);ctx.fillStyle='#2a0a04';for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(r*0.3,s*r*0.6);ctx.lineTo(r*0.2,s*r*1.15);ctx.lineTo(r*0.6,s*r*0.55);ctx.fill();}eyes(e,'#ffe040');};
  SHAPES.magma=(e,col)=>{ctx.rotate(e.face);const r=e.r;body(r,col);ctx.strokeStyle=`rgba(255,${(120+Math.sin(G.time*4+e.seed)*60)|0},30,.9)`;ctx.lineWidth=2;ctx.beginPath();
    for(const [a,b,c,d] of [[-0.6,-0.3,0.1,0.2],[0.1,0.2,-0.2,0.7],[0.1,0.2,0.5,-0.4],[-0.6,-0.3,-0.3,-0.8]]){ctx.moveTo(a*r,b*r);ctx.lineTo(c*r,d*r);}ctx.stroke();eyes(e,'#ffd040');};
}
function drawEnemy(e){
  const T=ETYPES[e.type];
  if(e.hidden){ // burrowed sandworm: a moving mound of sand
    ctx.fillStyle='rgba(50,34,18,.6)';ctx.beginPath();ctx.ellipse(e.x,e.y,e.r*1.1,e.r*0.6,0,0,TAU);ctx.fill();
    ctx.fillStyle='#9a7a4a';for(let k=0;k<5;k++){const a=k*1.26+G.time*3+e.seed;ctx.beginPath();ctx.arc(e.x+Math.cos(a)*e.r*0.7,e.y+Math.sin(a)*e.r*0.35,3,0,TAU);ctx.fill();}return;}
  const bs=e.type==='boss'?BOSS_SCALE:1;softShadow(e.x,e.y+e.r*0.55*bs,e.r*1.5*bs,e.r*0.7*bs,T.shape==='wraith'||T.shape==='imp'?0.5:1);
  if(e.elite){ctx.strokeStyle=e.affs&&e.affs.length?AFFIXES[e.affs[0]].col:'#6f8fff';ctx.lineWidth=2;ctx.globalAlpha=0.6+Math.sin(G.time*5)*0.3;ctx.beginPath();ctx.arc(e.x,e.y,e.r+5,0,TAU);ctx.stroke();ctx.globalAlpha=1;}
  const S=creatureSprite(e,T); // sprites.js: pre-rendered, only rotated and stamped here
  if(S){const ang=T.shape==='shard'?G.time*2+e.seed:e.face,P=creaturePose(e),ex=e.x+Math.cos(e.face)*P.dx,ey=e.y+Math.sin(e.face)*P.dx;
    let sc=P.sc;if(e.introT>0){const u=1-e.introT/2.4;sc*=0.55+0.45*Math.min(1,u*1.6);ctx.globalAlpha=Math.min(1,u*2);} // a boss rising for its entrance
    if(G.crowd>12&&e.type!=='boss'&&!e.elite)blit(S,ex,ey,ang,T.shape==='wraith'?0.9:null);else litBlit(S,ex,ey,ang,T.shape==='wraith'?0.9:null,sc);ctx.globalAlpha=1;
    if(e.flash>0)blit(whiteOf(S),ex,ey,ang,Math.min(1,e.flash/0.1)*0.85); // a brief white hit flash
    if(e.frozen>0){ctx.fillStyle='rgba(150,210,255,.3)';ctx.strokeStyle='rgba(225,245,255,.75)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(e.x,e.y,e.r*1.05,0,TAU);ctx.fill();ctx.stroke();}
    if(e.wind>0&&Math.floor(G.time*20)%2===0){ctx.globalCompositeOperation='lighter';ctx.fillStyle='rgba(255,70,30,.3)';ctx.beginPath();ctx.arc(e.x,e.y,e.r*1.1,0,TAU);ctx.fill();ctx.globalCompositeOperation='source-over';}
    if(e.type==='boss'&&e.phase){ctx.globalAlpha=0.35+Math.sin(G.time*6)*0.15;ctx.strokeStyle=`rgb(${BOSS_LIGHT[e.kind||0]})`;ctx.lineWidth=4;ctx.beginPath();ctx.arc(e.x,e.y,e.r+10,0,TAU);ctx.stroke();ctx.globalAlpha=1;}
    if(T.shape==='troll'&&e.hp<e.maxHp&&G.time-(e.lastHit||-9)>2&&!(e.bleedT>0)){ctx.strokeStyle='rgba(120,230,90,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,e.r+3,0,TAU);ctx.stroke();}}
  else{let col=e.col||T.col;if(e.flash>0)col='#fff';else if(e.frozen>0)col='#9fd8ff';if(e.wind>0&&Math.floor(G.time*20)%2===0)col='#ff8a6a';
    ctx.save();ctx.translate(e.x,e.y);(SHAPES[T.shape]||SHAPES.blob)(e,col,T);ctx.restore();}
  if(e.stun>0){ctx.fillStyle='#ffd54a';ctx.font='12px sans-serif';ctx.fillText('✦',e.x+Math.cos(G.time*8)*8,e.y-e.r-6);}
  if(e.hp<e.maxHp&&e.type!=='boss'){const w=e.r*2;ctx.fillStyle='#000a';ctx.fillRect(e.x-w/2,e.y-e.r-10,w,4);ctx.fillStyle=e.elite?'#6f8fff':'#c22';ctx.fillRect(e.x-w/2,e.y-e.r-10,w*Math.max(0,e.hp/e.maxHp),4);}
  if(e.shieldT>0){ctx.strokeStyle='#bcd0ff';ctx.fillStyle='rgba(150,180,255,.18)';ctx.lineWidth=2;ctx.globalAlpha=0.7+Math.sin(G.time*10)*0.2;ctx.beginPath();ctx.arc(e.x,e.y,e.r+9,0,TAU);ctx.fill();ctx.stroke();ctx.globalAlpha=1;}
  if(e.type==='boss')drawBossState(e); /* bossfight.js */
  if(e.elite||e.type==='thief')drawEliteLabel(e);
}
// Elite name, with its affixes on a line underneath (each in its own colour).
function drawEliteLabel(e){const A=e.affs||[],y=e.y-e.r-14,ny=A.length?y-12:y;
  ctx.font='11px Georgia';ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText(e.name,e.x,ny);ctx.fillStyle=e.type==='thief'?'#f2d04a':'#8fa8ff';ctx.fillText(e.name,e.x,ny);
  if(!A.length)return;ctx.font='9px sans-serif';const sep=' · ',sw=ctx.measureText(sep).width,ws=A.map(k=>ctx.measureText(AFFIXES[k].name).width);
  let x=e.x-(ws.reduce((a,b)=>a+b,0)+sw*(A.length-1))/2;ctx.textAlign='left';
  A.forEach((k,i)=>{if(i){ctx.strokeText(sep,x,y);ctx.fillStyle='#9c8b72';ctx.fillText(sep,x,y);x+=sw;}ctx.strokeText(AFFIXES[k].name,x,y);ctx.fillStyle=AFFIXES[k].col;ctx.fillText(AFFIXES[k].name,x,y);x+=ws[i];});
  ctx.textAlign='center';}
const mm=$('minimap'),mctx=mm.getContext('2d');
function drawMinimap(){
  const s=mm.width/MW;mctx.clearRect(0,0,mm.width,mm.height);const base=G.inTown?townOf(G.depth).mm:ACTS[actIdx(G.depth)].mm,TC=[base,'#7fbf3a','#e8642a',base];
  for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){const k=j*MW+i;if(G.explored[k]&&G.grid[k]===0){mctx.fillStyle=TC[G.terrain[k]]||base;mctx.fillRect(i*s,j*s,s+0.5,s+0.5);}}
  const P=G.portal;const pti=Math.floor(P.y/TILE)*MW+Math.floor(P.x/TILE);if(G.explored[pti]){mctx.fillStyle=P.active?'#b27bff':'#777';mctx.beginPath();mctx.arc(P.x/TILE*s,P.y/TILE*s,6,0,TAU);mctx.fill();}
  if(G.inTown&&G.smith){mctx.fillStyle='#e8703a';mctx.beginPath();mctx.arc(G.smith.x/TILE*s,G.smith.y/TILE*s,4.5,0,TAU);mctx.fill();}
  if(G.inTown&&G.stash){mctx.fillStyle='#b07a3a';mctx.fillRect(G.stash.x/TILE*s-4,G.stash.y/TILE*s-4,8,8);}
  if(G.inTown&&G.waystone){mctx.fillStyle='#4ad8e8';mctx.beginPath();mctx.arc(G.waystone.x/TILE*s,G.waystone.y/TILE*s,4.5,0,TAU);mctx.fill();}
  if(G.inTown&&G.merchant){mctx.fillStyle='#f2d04a';mctx.beginPath();mctx.arc(G.merchant.x/TILE*s,G.merchant.y/TILE*s,5,0,TAU);mctx.fill();}
  mctx.fillStyle='#e33';for(const e of G.enemies){if(e.dead||e.hidden)continue;if(G.explored[Math.floor(e.y/TILE)*MW+Math.floor(e.x/TILE)]&&Math.hypot(e.x-G.p.x,e.y-G.p.y)<400)mctx.fillRect(e.x/TILE*s-2,e.y/TILE*s-2,4,4);}
  if(!G.inTown)minimapFeatures(s);
  mctx.fillStyle='#fff';mctx.beginPath();mctx.arc(G.p.x/TILE*s,G.p.y/TILE*s,4.5,0,TAU);mctx.fill();
}
