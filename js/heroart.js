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
const HA_DRAW=0.9; // world px per art px: the figure about 70 tall, the drawn hero's height plus a little
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
  return {sex:f?'f':'m',L,xbow};}
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
    else if(p._hs>0){an='run';fi=Math.floor((p._hw||0)*HA.idx.anims.run.n)%HA.idx.anims.run.n;}
    else fi=haFrame('stance',G.time);}
  const D=HA_DRAW;ctx.save();if(alpha<1)ctx.globalAlpha=alpha;
  for(const slot of HA_ORDER[d]){const n=look.L[slot];if(!n)continue;const Ly=HA.idx.layers[n];
    if(slot==='main'&&look.xbow){if(an==='die')continue;const g=Ly.xb&&Ly.xb[an]&&Ly.xb[an][d]&&Ly.xb[an][d][fi];if(g)haCrossbow(g,fx,fy,D,look.xbow==='repeater');continue;}
    const fr=Ly.a[an]&&Ly.a[an][d]&&Ly.a[an][d][fi];if(!fr)continue;
    ctx.drawImage(HA.img[n],fr[0],fr[1],fr[2],fr[3],fx-fr[4]*D,fy-fr[5]*D,fr[2]*D,fr[3]*D);}
  if(playerFrozen()){ctx.fillStyle='rgba(150,210,255,.30)';ctx.strokeStyle='rgba(225,245,255,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(fx,fy-32,17,36,0,0,TAU);ctx.fill();ctx.stroke();} // ailments.js
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
