'use strict';
// Lighting: everything outside a light source fades into near-black.
// Each frame a small light map (LIGHT_RES of the screen) is filled with the area's darkness, soft holes are cut
// wherever light falls (one pre-rendered falloff sprite, stretched per light), and the map is laid over the scene;
// the upscale softens it for free. Coloured sources then add a faint glow on top ('lighter'), so torches and fire
// read warm against cold shadows. Static lights (wall torches, candles, lava, glowing mushrooms) are collected once
// while the map is painted (G.lights, see addLight in maps.js); moving ones (you, projectiles, spells, loot, fiery
// monsters, hazards) are gathered per frame. All sprites are built once and reused: a frame is only drawImage calls.
const LIGHT_RES=0.33,LIGHT_MAX=96,GLOW_MAX=40;
let LCV=null,LX=null,VIG=null,VIG_K='';
const LSPR={},RGB_OF={};
function mkCanvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,w|0);c.height=Math.max(1,h|0);return c;}
// Soft round falloff, white (for cutting light) or in a colour (for glow). Cached per colour.
function falloff(rgb){const k=rgb||'w';let c=LSPR[k];if(c)return c;const S=128,C=rgb||'255,255,255';c=mkCanvas(S,S);const x=c.getContext('2d'),g=x.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
  for(const [o,a] of [[0,1],[0.18,0.9],[0.42,0.58],[0.66,0.26],[0.85,0.08],[1,0]])g.addColorStop(o,`rgba(${C},${a})`);x.fillStyle=g;x.fillRect(0,0,S,S);return LSPR[k]=c;}
// '#rgb', '#rrggbb' or '#rrggbbaa' (or an 'r,g,b' string) → 'r,g,b'.
function rgbOf(col){if(!col)return '255,220,180';let v=RGB_OF[col];if(v)return v;let h=String(col);
  if(/^\d+,\d+,\d+$/.test(h))v=h;else if(h[0]==='#'){h=h.slice(1);if(h.length<6)h=h.slice(0,3).split('').map(c=>c+c).join('');const n=parseInt(h.slice(0,6),16);v=Number.isFinite(n)?`${n>>16&255},${n>>8&255},${n&255}`:'255,220,180';}
  else{const m=h.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);v=m?`${m[1]},${m[2]},${m[3]}`:'255,220,180';}
  return RGB_OF[col]=v;}
const lightRgb=Lt=>Lt.rgb||(Lt.rgb=rgbOf(Lt.tint));
// Monsters that carry their own light: [rgb, radius, strength].
const MON_LIGHT={imp:['255,120,40',80,0.7],magmabrute:['255,100,30',130,0.85],summoner:['255,90,160',70,0.5],dustmage:['255,210,140',60,0.45],
  frostwraith:['150,210,255',70,0.5],shardling:['150,210,255',45,0.3],vinelasher:['200,90,120',40,0.25]};
const BOSS_LIGHT=['232,224,192','224,168,96','159,224,74','200,235,255','255,150,50'];
// Flicker for flames: a fast, uneven wobble around 1.
const flick=(t,s)=>0.86+0.14*Math.sin(t*9.3+s)*Math.sin(t*5.1+s*1.7);
function gatherLights(Lt){
  const L=[],p=G.p,t=G.time,hw=CW/Z/2,hh=CH/Z/2,cx=G.cam.x,cy=G.cam.y;
  // i = how much darkness it removes (0..1), g = strength of its coloured glow (0 = none)
  const add=(x,y,r,i,rgb,g)=>{if(L.length>=LIGHT_MAX||!(r>0)||Math.abs(x-cx)>hw+r||Math.abs(y-cy)>hh+r)return;L.push({x,y,r,i,rgb,g});};
  if(p){add(p.x,p.y,Lt.r1,0.92,lightRgb(Lt),0.1);add(p.x,p.y,Lt.r0*1.5,0.75,null,0);
    if(setAuraOn())add(p.x,p.y,140,0.5,auraCols()[0],0.22);
    if(hasPw('burnAura')&&!G.inTown&&!p.dead)add(p.x,p.y,AURA_R*1.2,0.4,'255,110,30',0.18);}
  for(const s of G.lights||[]){const f=s.fl?flick(t,s.x*0.37+s.y):1;add(s.x,s.y,s.r*(0.94+0.06*f),s.i*f,s.rgb,s.g*f);}
  if(G.inTown&&G.town){const T=G.town.T;for(const l of G.town.lights){const f=l.win?0.9+0.1*Math.sin(t*1.3+l.x):flick(t,l.x);
      add(l.x,l.y,l.r*2.4,(l.win?0.55:0.85)*f,l.shroom?'120,255,190':l.way?'90,220,255':T.flame,(l.win?0.22:0.32)*f);}
    if(G.smith)add(G.smith.x+34,G.smith.y-6,130,0.9*flick(t,3),'255,140,50',0.35);}
  const P=G.portal;if(P)add(P.x,P.y,170,P.active?0.85:0.4,P.active?'170,110,255':'150,150,150',P.active?0.28:0.08);
  if(!G.inTown)for(const f of G.feats){if(f.kind==='shrine'){if(!f.used)add(f.x,f.y-18,120,0.7,rgbOf(SHRINES[f.type].col),0.3);}else if(f.state!=='open')add(f.x,f.y,110,0.6,f.state==='waves'?'255,64,160':'144,64,255',0.25);}
  for(const q of G.proj)add(q.x,q.y,50+q.r*4,0.8,rgbOf(q.col),0.4);
  for(const f of G.fx){const k=1-f.t/f.max;if(k<=0)continue;
    if(f.type==='ring')add(f.x,f.y,(f.r1||60)+40,0.75*k,rgbOf(f.col),0.3*k);
    else if(f.type==='arc')add(f.x+Math.cos(f.a)*f.r*0.6,f.y+Math.sin(f.a)*f.r*0.6,f.r+40,0.45*k,rgbOf(f.col),0.18*k);
    else if(f.type==='boom')add(f.x,f.y,f.r*3,0.95*k,rgbOf(f.col),0.55*k);
    else if(f.type==='cracks')add(f.x,f.y,f.r*1.6,0.5*k,rgbOf(f.col),0.25*k);
    else if(f.type==='bolt'){for(let n=0;n<f.pts.length;n+=2)add(f.pts[n].x,f.pts[n].y,90,0.85*k,'190,225,255',0.4*k);}
    else if(f.type==='lflash')add(f.x+Math.cos(f.a)*f.len/2,f.y+Math.sin(f.a)*f.len/2,f.len*0.6,0.7*k,rgbOf(f.col),0.3*k);
    else if((f.type==='tele'||f.type==='tline')&&!f.own){const x=f.type==='tline'?f.x+Math.cos(f.a)*f.len/2:f.x,y=f.type==='tline'?f.y+Math.sin(f.a)*f.len/2:f.y;add(x,y,(f.r||f.len/2)+50,0.55,'255,80,30',0.25*(1-k)+0.05);} // enemy warnings light the floor red
    else if(f.type==='tele'||f.type==='tline'){const x=f.type==='tline'?f.x+Math.cos(f.a)*f.len/2:f.x,y=f.type==='tline'?f.y+Math.sin(f.a)*f.len/2:f.y;add(x,y,(f.r||f.len/2)+30,0.35,rgbOf(f.col),0.1);}}
  for(const h of G.hazards)add(h.x,h.y,h.r*1.5,0.6,h.rot?'140,210,64':'255,110,30',0.25);
  for(const h of G.ehaz)add(h.x,h.y,h.r*1.5,0.5*Math.min(1,h.t/h.max*2),h.kind==='poison'?'150,220,70':'255,110,30',0.22);
  for(const l of G.loot){if(!l.item||l.item.rarity<2||lootHidden(l.item))continue;add(l.x,l.y,60,0.55,rgbOf(RCOL[l.item.rarity]),0.22);}
  for(const e of G.enemies){if(e.dead||e.hidden)continue;
    const M=e.type==='boss'?[BOSS_LIGHT[e.kind||0],e.r*4,0.55]:MON_LIGHT[e.type];
    if(M)add(e.x,e.y,M[1],M[2]*(e.type==='imp'||e.type==='magmabrute'?flick(t,e.seed):1),M[0],M[2]*0.45);
    if(e.burnT>0)add(e.x,e.y,e.r*3.5,0.5*flick(t,e.seed),'255,120,40',0.25);}
  return L;}
// Edges of the screen sink a little deeper into the dark. Rebuilt when the screen size changes.
function vignette(){const k=CW+'x'+CH;if(VIG&&VIG_K===k)return VIG;VIG_K=k;const w=Math.ceil(CW/4),h=Math.ceil(CH/4);VIG=mkCanvas(w,h);const x=VIG.getContext('2d');
  const g=x.createRadialGradient(w/2,h/2,Math.min(w,h)*0.35,w/2,h/2,Math.hypot(w,h)/2);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,0.6)');x.fillStyle=g;x.fillRect(0,0,w,h);return VIG;}
// Called by render() in screen space (ctx transform = DPR).
function drawLighting(Lt){
  const w=Math.ceil(CW*LIGHT_RES),h=Math.ceil(CH*LIGHT_RES);
  if(!LCV){LCV=mkCanvas(w,h);LX=LCV.getContext('2d');}else if(LCV.width!==w||LCV.height!==h){LCV.width=w;LCV.height=h;}
  const L=gatherLights(Lt),S=falloff(),k=Z*LIGHT_RES,ox=CW/2-G.cam.x*Z,oy=CH/2-G.cam.y*Z;
  LX.setTransform(1,0,0,1,0,0);LX.globalCompositeOperation='source-over';LX.globalAlpha=1;LX.clearRect(0,0,w,h);LX.fillStyle=Lt.dark;LX.fillRect(0,0,w,h);
  LX.globalCompositeOperation='destination-out';
  for(const l of L){const r=l.r*k;LX.globalAlpha=clamp(l.i,0,1);LX.drawImage(S,(l.x*Z+ox)*LIGHT_RES-r,(l.y*Z+oy)*LIGHT_RES-r,r*2,r*2);}
  LX.globalCompositeOperation='source-over';LX.globalAlpha=1;
  ctx.drawImage(LCV,0,0,w,h,0,0,w/LIGHT_RES,h/LIGHT_RES);
  ctx.globalCompositeOperation='lighter';let n=0;
  for(const l of L){if(!(l.g>0)||!l.rgb||n++>=GLOW_MAX)continue;const r=l.r*Z*0.55;ctx.globalAlpha=clamp(l.g,0,1);ctx.drawImage(falloff(l.rgb),l.x*Z+ox-r,l.y*Z+oy-r,r*2,r*2);}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  ctx.drawImage(vignette(),0,0,CW,CH);
}
// ---------- soft drop shadows ----------
// One blurred oval, pre-rendered, stretched under every character, monster and item.
let SHADOW=null;
function softShadow(x,y,rx,ry,a){if(!SHADOW){const W=64,H=32;SHADOW=mkCanvas(W,H);const s=SHADOW.getContext('2d');s.setTransform(1,0,0,0.5,0,0);const g=s.createRadialGradient(W/2,H,0,W/2,H,W/2);
  g.addColorStop(0,'rgba(0,0,0,.75)');g.addColorStop(0.5,'rgba(0,0,0,.45)');g.addColorStop(1,'rgba(0,0,0,0)');s.fillStyle=g;s.fillRect(0,0,W,H*2);}
  ctx.globalAlpha=a==null?1:a;ctx.drawImage(SHADOW,x-rx,y-ry,rx*2,ry*2);ctx.globalAlpha=1;}
// ---------- torch flames ----------
// Four pre-drawn flame frames (warm core, darker tips), tinted per light colour, drawn on top of the baked sconce.
const FLAME={};
function flameFrames(rgb){let F=FLAME[rgb];if(F)return F;F=[];const W=24,H=40,[r,g,b]=rgb.split(',').map(Number);
  for(let f=0;f<4;f++){const c=mkCanvas(W,H),x=c.getContext('2d'),sw=Math.sin(f/4*TAU)*1.6;
    const lay=(s,col,a)=>{x.globalAlpha=a;x.fillStyle=col;x.beginPath();x.moveTo(W/2-6*s,H-6);x.quadraticCurveTo(W/2-7*s,H-18*s,W/2+sw*s,H-6-30*s+(f%2)*2);x.quadraticCurveTo(W/2+7*s,H-18*s,W/2+6*s,H-6);x.closePath();x.fill();};
    lay(1,`rgb(${r*0.7|0},${g*0.35|0},${b*0.2|0})`,0.85);lay(0.72,`rgb(${r},${g*0.75|0},${b*0.45|0})`,0.95);lay(0.42,`rgb(255,${Math.min(255,g+60)},${Math.min(255,b+90)})`,1);
    F.push(c);}return FLAME[rgb]=F;}
function drawTorches(onScreen){const t=G.time;
  for(const s of G.lights||[]){if(!s.torch||!onScreen(s.x,s.y,40))continue;const F=flameFrames(s.rgb),f=F[((t*10+s.x*0.13)|0)&3],k=s.big?1.9:1;ctx.drawImage(f,s.x-6*k,s.y-17*k,12*k,20*k);}}
