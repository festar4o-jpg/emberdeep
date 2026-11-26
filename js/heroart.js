'use strict';
// v1.0.139: the painted hero (2.5D step 2). Pre-rendered layers from the free ARPG Flare (art by Clint Bellanger,
// Justin Jacobs and the Flare team, CC-BY-SA 3.0; art/hero/CREDITS.txt), built into art/hero/ by tools/hero-art/build.js.
// The hero is stacked from layers: feet, legs, hands, chest, head (or helm), main hand and off hand. The armour TYPE
// worn picks each layer (body kind, helm, gloves, boots, shield kind); each weapon type picks its weapon.
// Warden and Arcanist are the man, the Ranger the woman. Spears are the staff with a steel head (built that way);
// crossbows and repeaters are drawn here over the longbow's poses (hero.json keeps each frame's grip and bow line).
// Pictures load the first time they are needed and the service worker keeps them (sw.js ART cache), so each one
// downloads once. Until every layer of the hero's look has loaded, the last complete look is shown, and before any
// look has loaded, the drawn hero (hero.js). Settings › Hero: Painted or Drawn. Gameplay never changes.
const HA={idx:null,want:false,img:{},cur:null,dieT:0};
// World px per art px. The figure is about 120 art px from soles to head (Flare's HD art), so 0.45 makes it about 54 tall,
// a little under the drawn hero's 57 (v1.0.139 drew it at 0.9: about 108 tall, twice the old hero, far too big).
const HA_DRAW=0.45;
const HA_LIFT=6; // art px: Flare's anchor lies a little below the middle of the feet; lift the figure so they stand on the hero's spot
// v1.0.140: one run cycle (8 frames) per 88 px moved: at full speed (165 px/s) about the art's own 0.53 s stride; walking
// slowly slows the legs with it. (It was tied to the drawn hero's 34 px stride: five strides a second, a blur.)
const HA_STRIDE=88;
const HA_BASE='art/hero/';
// The draw order per facing (Flare engine/hero_layers.txt), facings 0..7 = SW, W, NW, N, NE, E, SE, S.
const HA_ORDER=[['main','feet','legs','hands','chest','off','head'],['main','feet','legs','hands','chest','off','head'],['main','feet','legs','hands','chest','off','head'],
  ['feet','legs','hands','chest','off','head','main'],['feet','legs','hands','chest','off','head','main'],['feet','legs','hands','chest','off','head','main'],
  ['feet','legs','hands','main','chest','head','off'],['main','feet','legs','hands','chest','head','off']];
// Armour type -> layer. Body armour also dresses the legs; nothing worn: plain cloth shirt, trousers and sandals.
const HA_BODY={robe:['mage_vest','mage_skirt'],leather:['leather_chest','leather_pants'],chain:['chain_cuirass','chain_greaves'],plate:['plate_cuirass','plate_greaves']};
const HA_HEAD={warden:'head_short',arcanist:'head_bald',ranger:'head_long'};
// Weapon type -> layer (some bases get their own look). 'xbow': drawn over the longbow's poses.
const HA_WEAPON={sword:'longsword',runeblade:'longsword',demonblade:'longsword',scimitar:'shortsword',spellblade:'shortsword',dagger:'dagger',
  axe:'hand_axe',greataxe:'battle_axe',mace:'mace',flail:'reinforced_club',maul:'maul',greatsword:'greatsword',spear:'spear',
  wand:'wand',runewand:'wand',scepter:'rod',rod:'rod',staff:'staff',thornstaff:'staff',demonstaff:'greatstaff',
  shortbow:'shortbow',recurve:'longbow',longbow:'longbow',greatbow:'greatbow',crossbow:'xbow',repeater:'xbow'};
const HA_BASES={'War Hammer':'war_hammer','Zweihander':'zweihander','Cudgel':'reinforced_club'};
const HA_SHIELD={tower:'shield',kite:'kite_shield',buckler:'buckler'};
const haOn=()=>SETTINGS.hero!=='drawn'&&typeof Image!=='undefined'&&typeof fetch==='function';
// The layers for a hero's class and gear: {sex, L:{feet,legs,hands,chest,head,main,off}, xbow}.
function heroArtLook(C2){const eq=C2.equip||{},f=C2.cls==='ranger',P=f?'f_':'m_',L={};const k=s=>eq[s]&&eq[s].kind;
  const robe=k('body')==='robe',[ch,lg]=HA_BODY[k('body')]||['cloth_shirt','cloth_pants'];L.chest=P+ch;L.legs=P+lg;
  const h=k('helm');L.head=P+(h==='greathelm'?'plate_helm':h==='hood'?(C2.cls==='arcanist'?'mage_hood':'leather_hood'):HA_HEAD[C2.cls]||'head_short');
  const g=k('gloves');L.hands=P+(g==='gauntlets'?'plate_gauntlets':g==='bracers'?'chain_gloves':g==='wraps'?(robe?'mage_sleeves':'leather_gloves'):'default_hands');
  const b=k('boots');L.feet=P+(b==='greaves'?'plate_boots':b==='treads'?'chain_boots':b==='striders'?(robe?'mage_boots':'leather_boots'):'cloth_sandals');
  const mw=eq.mainhand&&eq.mainhand.slot==='weapon'?eq.mainhand:null;let xbow=null;
  if(mw){const w=HA_BASES[mw.base]||HA_WEAPON[mw.wt];if(w==='xbow'){xbow=mw.wt;L.main='f_longbow';}else if(w)L.main=P+w;}
  const off=eq.offhand;if(off&&off.slot==='shield'&&!f)L.off=P+(HA_SHIELD[off.kind]||'kite_shield');
  if(L.main&&!HA_IDX_HAS(L.main))delete L.main; // e.g. a bow on the man: not in the set
  const it={chest:eq.body,legs:eq.body,head:eq.helm,hands:eq.gloves,feet:eq.boots,main:mw,off:L.off?off:null};
  return {sex:f?'f':'m',L,xbow,it,quiver:off&&off.slot==='quiver'?off:null,focus:off&&off.slot==='focus'?off:null};}
const HA_IDX_HAS=n=>!HA.idx||!!HA.idx.layers[n];
function haImg(n){let im=HA.img[n];if(!im){im=HA.img[n]=new Image();im.decoding='async';im.src=HA_BASE+n+'.webp';}return im.complete&&im.naturalWidth?im:null;}
function haLoadIndex(){if(HA.want)return;HA.want=true;fetch(HA_BASE+'hero.json').then(r=>r.ok?r.json():null).then(j=>{if(j&&j.layers)HA.idx=j;}).catch(()=>{HA.want=false;});}
// The look to draw now: the wanted one once all its pictures are in, else the last complete one.
function haReady(look){if(!HA.idx)return null;let ok=true;for(const n of Object.values(look.L))if(!haImg(n))ok=false;
  if(ok){HA.cur=look;return look;}return HA.cur&&HA.cur.sex===look.sex?HA.cur:null;}
// Which animation and frame. back_forth (standing) runs 0..n-1..1; play_once holds its last frame.
function haFrame(an,t){const a=HA.idx.anims[an],n=a.n;if(a.type==='back_forth'){const k=Math.floor(t*1000/a.ms*n)%(2*n-2);return k<n?k:2*n-2-k;}
  if(a.type==='looped')return Math.floor(t*1000/a.ms*n)%n;return Math.min(n-1,Math.floor(t*1000/a.ms*n));}
// Called by hero.js drawHero25 with the feet at (fx, fy) inside the upright frame. Returns false to draw the drawn hero.
function drawHeroArt(p,C2,W,A,u,spin,ang,fx,fy,alpha){if(!haOn())return false;haLoadIndex();
  const look=haReady(heroArtLook(C2));if(!look)return false;
  const d=((Math.round(ang/(Math.PI/4))+4)%8+8)%8;let an='stance',fi;
  if(p.dead){if(!HA.dieT)HA.dieT=G.time;an='die';fi=haFrame('die',G.time-HA.dieT);}
  else{HA.dieT=0;
    if(A&&!spin){an=W&&W.bow?'shoot':A.style==='cast'||C2.cls==='arcanist'?'cast':'swing'; // bows shoot, spells and the Arcanist cast, the rest swing
      fi=Math.min(HA.idx.anims[an].n-1,Math.floor(u*HA.idx.anims[an].n));}
    else if(spin){an='swing';fi=Math.floor(G.time*16)%HA.idx.anims.swing.n;}
    else if(p.hurt>0){an='hit';fi=p.hurt>0.07?0:1;}
    else if(p._hs>0){an='run';fi=Math.floor((p._ha||0)*HA.idx.anims.run.n)%HA.idx.anims.run.n;}
    else fi=haFrame('stance',G.time);}
  const D=HA_DRAW;fy-=HA_LIFT*D;ctx.save();if(alpha<1)ctx.globalAlpha=alpha;
  const back=Math.sin(ang)>-0.25,live=!p.dead; // facing the camera: the back (quiver) is behind the body
  if(live&&look.quiver&&back)haQuiver(look.quiver,ang,fx,fy);
  const fz=live&&look.focus&&haFocusSpot(ang,fx,fy);if(fz&&!fz.near)haFocus(look.focus,fz);
  for(const slot of HA_ORDER[d]){const n=look.L[slot];if(!n)continue;const Ly=HA.idx.layers[n];
    if(slot==='main'&&look.xbow){if(an==='die')continue;const g=Ly.xb&&Ly.xb[an]&&Ly.xb[an][d]&&Ly.xb[an][d][fi];if(g)haCrossbow(g,fx,fy,D,look.xbow==='repeater');continue;}
    const fr=Ly.a[an]&&Ly.a[an][d]&&Ly.a[an][d][fi];if(!fr)continue;
    haPiece(n,fr,fx-fr[4]*D,fy-fr[5]*D,fr[2]*D,fr[3]*D,look.it[slot],alpha);}
  if(live&&look.quiver&&!back)haQuiver(look.quiver,ang,fx,fy);
  if(fz&&fz.near)haFocus(look.focus,fz);
  if(playerFrozen()){ctx.fillStyle='rgba(150,210,255,.30)';ctx.strokeStyle='rgba(225,245,255,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(fx,fy-36*D/0.9,19*D/0.9,40*D/0.9,0,0,TAU);ctx.fill();ctx.stroke();} // ailments.js
  ctx.restore();return true;}
// A heavy crossbow at the bow hand, its stock running back to the chin: g = [grip x, grip y, bow line x, y] (art px from the feet).
function haCrossbow(g,fx,fy,D,rep){const gx=fx+g[0]*D,gy=fy+g[1]*D,hx=fx,hy=fy-59*D;let sx=hx-gx,sy=hy-gy;const dl=Math.hypot(sx,sy)||1;sx/=dl;sy/=dl;
  let ux=g[2],uy=g[3];const dot=ux*sx+uy*sy;ux-=dot*sx;uy-=dot*sy;const ul=Math.hypot(ux,uy);if(ul<0.35){ux=-sy;uy=sx;}else{ux/=ul;uy/=ul;}
  const K=D,bk=Math.max(30,Math.min(dl/K,40)+8),Q=(a,b)=>[gx+(ux*a+sx*b)*K,gy+(uy*a+sy*b)*K];
  const wood=rep?['#1e140c','#4a3a2a','#6a5440']:['#3b2414','#7a4c28','#a8743f'],trim=rep?'#c8743a':'#d9b25a';
  const path=pts=>{ctx.beginPath();pts.forEach((p,i)=>{const q=Q(p[0],p[1]);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);});};
  const line=(pts,w,col)=>{ctx.strokeStyle=col;ctx.lineWidth=w*K;path(pts);ctx.stroke();},poly=(pts,col)=>{ctx.fillStyle=col;path(pts);ctx.closePath();ctx.fill();};
  ctx.lineCap='round';ctx.lineJoin='round';
  const prod=[];for(let t=-1;t<=1.0001;t+=0.1){const a=Math.abs(t);prod.push([t*24,-7+a*a*8-(a>0.85?(a-0.85)*22:0)]);}
  const lt=prod[0],rt=prod[prod.length-1],latch=[0,bk*0.42];
  line(prod,7.2,'#0c0907');line([[0,-17],[0,bk]],8.4,'#0c0907');line([[-4.5,-14],[0,-21],[4.5,-14]],4,'#0c0907'); // dark outline
  line([lt,latch],1.3,'#2a241c');line([rt,latch],1.3,'#2a241c');line([lt,latch],0.7,'#d9ceb0');line([rt,latch],0.7,'#d9ceb0'); // string
  poly([[-2.6,-15],[2.6,-15],[3.4,bk*0.7],[4.6,bk],[-4.6,bk],[-3.4,bk*0.7]],wood[0]); // stock
  poly([[-1.6,-14],[0.6,-14],[1.2,bk*0.7],[1.8,bk-1],[-2.8,bk-1],[-2.2,bk*0.7]],wood[1]);line([[-1,-13],[-1.4,bk*0.68]],0.9,wood[2]);
  for(const b of [-3,bk*0.5,bk-3]){line([[-3.6,b],[3.6,b]],2.2,'#3d4549');line([[-3.2,b-0.4],[3.2,b-0.4]],0.9,'#b9c2c8');poly([[-0.8,b-0.8],[0.8,b-0.8],[0.8,b+0.8],[-0.8,b+0.8]],trim);} // bands, rivets
  line([[0,bk*0.58],[2.4,bk*0.74]],1.6,'#2b3034'); // trigger
  line([[-4.5,-14],[0,-21],[4.5,-14]],2.2,'#4a5257');line([[-4.5,-14],[0,-21],[4.5,-14]],0.9,'#c3ccd2'); // stirrup
  line(prod,5,'#2c3337');line(prod,2.6,'#6d777e');line(prod.map(p=>[p[0],p[1]-0.9]),1,'#b9c3c9'); // steel prod
  poly([[-4,-10.5],[4,-10.5],[4,-4],[-4,-4]],'#6a4a1c');poly([[-3.2,-10],[3.2,-10],[3.2,-7.5],[-3.2,-7.5]],trim);
  for(const p of [lt,rt])poly([[p[0]-1.6,p[1]-1.6],[p[0]+1.6,p[1]-1.6],[p[0]+1.6,p[1]+1.6],[p[0]-1.6,p[1]+1.6]],trim);
  line([[0,-16],[0,latch[1]]],1.5,'#cfc5ad'); // bolt
  poly([[0,-25],[2.2,-17],[-2.2,-17]],'#1b1f22');poly([[0,-24],[1.2,-18],[-1.2,-18]],'#d5dde2');
  poly([[0,latch[1]-6],[2.6,latch[1]-0.5],[0,latch[1]-2]],'#9c2a1e');poly([[0,latch[1]-6],[-2.6,latch[1]-0.5],[0,latch[1]-2]],'#c4412b');}
// v1.0.141: act colours and shimmer. Gear from later acts takes its act's colour over the painted shading (the 'color'
// blend keeps light and shadow): Ashen Wastes sand, Rotwood Marsh moss, Frozen Citadel frost, Ember Core ember.
// Uniques shimmer gold and set pieces green (a pulsing glow of the piece's own shape). Act 1 gear stays as painted.
const HA_TINT=[null,null,'#c89a58','#6f9a3c','#6fb4ff','#ff5626'],HA_TINT_A=0.42,HA_GLOW={3:'#ffa83a',5:'#3dff6a'};
const HA_VAR=new Map(),HA_VAR_S=0.8; // kept at 80%: close to the hero's size on a sharp phone screen, and lighter on memory
// One frame recoloured ('tint') or as a solid silhouette ('glow'), painted once and kept (cleared when it grows large).
function haVariant(n,fr,kind,col){return artVariant(HA.img[n],n,fr,kind,col);}
// Any sheet's frame (id names the sheet) recoloured or as a silhouette; also used by monart.js for hit flashes.
function artVariant(img,id,fr,kind,col){const key=id+'|'+fr[0]+'|'+fr[1]+'|'+kind+col;let c=HA_VAR.get(key);if(c)return c;
  if(HA_VAR.size>700)HA_VAR.clear();const w=Math.ceil(fr[2]*HA_VAR_S),h=Math.ceil(fr[3]*HA_VAR_S);c=mkCanvas(w,h);const x=c.getContext('2d');x.drawImage(img,fr[0],fr[1],fr[2],fr[3],0,0,w,h);
  if(kind==='tint'){x.globalCompositeOperation='color';x.globalAlpha=HA_TINT_A;x.fillStyle=col;x.fillRect(0,0,w,h);
    x.globalAlpha=1;x.globalCompositeOperation='destination-in';x.drawImage(img,fr[0],fr[1],fr[2],fr[3],0,0,w,h);}
  else{x.globalCompositeOperation='source-in';x.fillStyle=col;x.fillRect(0,0,w,h);}
  HA_VAR.set(key,c);return c;}
// One layer's frame at (x, y, w, h), coloured and glowing by the item that made it.
function haPiece(n,fr,x,y,w,h,it,alpha){const tint=it&&HA_TINT[it.tier];
  if(tint){const c=haVariant(n,fr,'tint',tint);ctx.drawImage(c,0,0,c.width,c.height,x,y,w,h);}else ctx.drawImage(HA.img[n],fr[0],fr[1],fr[2],fr[3],x,y,w,h);
  const g=it&&HA_GLOW[it.rarity];if(!g)return;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=(0.16+0.12*Math.sin(G.time*3.2+(it.id||0)))*(alpha||1);
  const c=haVariant(n,fr,'glow',g);ctx.drawImage(c,0,0,c.width,c.height,x,y,w,h);ctx.restore();}
// The Ranger's quiver on the back, arrows showing (hero.js heroProj: the hero's floor frame on screen).
function haQuiver(q,ang,fx,fy){const P=(lx,ly,h)=>{const s=heroProj(ang,lx,ly,h);return [fx+s[0],fy+s[1]];},b=P(-6,4,15),t=P(-8,-5,35),tint=HA_TINT[q.tier];
  ctx.lineCap='round';ctx.strokeStyle='#120c08';ctx.lineWidth=6.4;ctx.beginPath();ctx.moveTo(b[0],b[1]);ctx.lineTo(t[0],t[1]);ctx.stroke();
  ctx.strokeStyle='#5a3a1e';ctx.lineWidth=4.6;ctx.stroke();ctx.strokeStyle=tint||'#8a6a42';ctx.lineWidth=1.2;ctx.beginPath();const m=P(-7.2,-1.5,27);ctx.moveTo(m[0]-2.2,m[1]);ctx.lineTo(m[0]+2.2,m[1]);ctx.stroke(); // strap band
  for(let k=-1;k<=1;k++){const a=P(-8.2,-5+k*1.4,35),z=P(-8.8,-6.6+k*1.4,40);ctx.strokeStyle='#7a5a36';ctx.lineWidth=0.9;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(z[0],z[1]);ctx.stroke();
    ctx.fillStyle=q.rarity===3?'#ffb24a':q.rarity===5?'#5dff8a':'#d8d0bc';ctx.beginPath();ctx.moveTo(z[0],z[1]-2.4);ctx.lineTo(z[0]-1.3,z[1]+0.6);ctx.lineTo(z[0]+1.3,z[1]+0.6);ctx.closePath();ctx.fill();}} // fletching
// The Arcanist's focus floats at the off hand, bobbing: where, and whether it is nearer the camera than the body.
function haFocusSpot(ang,fx,fy){const bob=Math.sin(G.time*2.4)*1.6,s=heroProj(ang,6,-13,27+bob);return {x:fx+s[0],y:fy+s[1],near:heroNear(ang,6,-13)>=0};}
function haFocus(f,z){const col=HA_TINT[f.tier]||(f.rarity===3?'#ffa83a':f.rarity===5?'#3dff6a':'#8fd4ff');
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=0.5+0.18*Math.sin(G.time*3);ctx.drawImage(sparkSprite(rgbOf(col)),z.x-11,z.y-11,22,22);ctx.restore(); // fx.js: the game's glow
  if(f.kind==='tome'){ctx.save();ctx.translate(z.x,z.y);ctx.rotate(-0.25+Math.sin(G.time*1.7)*0.08);
    ctx.fillStyle='#120c08';ctx.fillRect(-4.6,-3.6,9.2,7.2);ctx.fillStyle='#5a2a1e';ctx.fillRect(-4,-3,8,6);ctx.fillStyle='#e8dcc0';ctx.fillRect(-4,-3.6,8,1.1); // cover, pages
    ctx.strokeStyle='#d9b25a';ctx.lineWidth=0.8;ctx.strokeRect(-2.6,-1.8,5.2,3.6);ctx.fillStyle=col;ctx.fillRect(-0.7,-0.7,1.4,1.4);ctx.restore();return;}
  const g=ctx.createRadialGradient(z.x-1.2,z.y-1.4,0.3,z.x,z.y,4);g.addColorStop(0,'#ffffff');g.addColorStop(0.35,col);g.addColorStop(1,'#141020');
  ctx.fillStyle='#0c0907';ctx.beginPath();ctx.arc(z.x,z.y,4.6,0,TAU);ctx.fill();ctx.fillStyle=g;ctx.beginPath();ctx.arc(z.x,z.y,3.9,0,TAU);ctx.fill();}
// v1.0.142: the hero on the character screen (2.5D step 3). The painted hero stands large above the gear slots,
// wearing what is equipped (act colours and shimmer included), breathing; every few seconds he shows his weapon
// (a swing, cast or shot), and a tap turns him around. Drawn each frame while the inventory is open (main.js frame);
// the menu pauses the game, so the doll keeps its own clock. Hidden with Settings › Hero: Drawn.
const DOLL={d:6,t0:0,cv:null}; // facing (6: toward the camera); the figure fills 80% of the doll's height
function drawDoll(now){const cv=DOLL.cv||(DOLL.cv=$('dollCv'));if(!cv||!G.char)return;const box=cv.parentNode;
  if(!haOn()){box.classList.add('hidden');return;}box.classList.remove('hidden');
  if(!cv.onclick)cv.onclick=()=>{DOLL.d=(DOLL.d+1)%8;DOLL.t0=-1e9;}; // a tap turns him one step (and skips the show)
  const w=cv.clientWidth||300,h=cv.clientHeight||170,R=window.devicePixelRatio||1;if(cv.width!==Math.round(w*R)){cv.width=Math.round(w*R);cv.height=Math.round(h*R);}
  const t=now/1000;if(!DOLL.t0)DOLL.t0=t;
  const C2=G.char,eq=C2.equip,mw=eq.mainhand&&eq.mainhand.slot==='weapon'?eq.mainhand:null,W=mw?WEAPONS[mw.wt]:null;
  const show=(t-DOLL.t0)%5,u=show<0.7?show/0.7:0; // every 5 s: 0.7 s of the weapon's move
  const ang=(DOLL.d-4)*Math.PI/4,keep=[ctx,G.time,TILT],x=cv.getContext('2d');
  ctx=x;G.time=t;TILT=TILT_ANGLED; // draw through the game's own painter, into the doll's canvas
  try{x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,cv.width,cv.height);
    const g=x.createRadialGradient(cv.width/2,cv.height*0.82,4,cv.width/2,cv.height*0.82,cv.height*0.6);g.addColorStop(0,'rgba(255,190,120,.16)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,cv.width,cv.height); // a warm pool of light
    const k=R*h*0.8/120/HA_DRAW;x.setTransform(k,0,0,k,cv.width/2,cv.height*0.86);
    const p={x:0,y:0,hurt:0,dead:false,_hs:0,_ha:0};
    const ok=drawHeroArt(p,C2,W,u>0?{t:u,dur:1,style:W?W.anim:'swing'}:null,u,false,ang,0,0,1);
    if(!ok){x.setTransform(R,0,0,R,0,0);x.fillStyle='#a89a80';x.font='13px sans-serif';x.textAlign='center';x.fillText('Loading your hero…',w/2,h/2);}}
  finally{[ctx,G.time,TILT]=keep;}}
