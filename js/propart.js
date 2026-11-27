'use strict';
// v1.0.155: painted props (the world repaint, step 1: towns). Standing things cut from the free ARPG Flare's town and
// dungeon tilesets (CC-BY-SA 3.0, art/props/CREDITS.txt) by tools/hero-art/build-props.js into one small sheet:
// barrels, crates, chests, graves, trees, reeds, the anvil, the waystone circle, a lectern, statues... Seen from a
// corner they still sit right on Emberdeep's straight floors. With the angled camera only; Settings › Props:
// Painted or Drawn. Until the sheet has loaded everything is drawn as before; once it is in, the standing props
// already painted (maps.js stands) are painted again with it.
const PR={idx:null,img:null,want:false};
const propOn=()=>SETTINGS.props!=='drawn'&&TILT!==1&&typeof Image!=='undefined'&&typeof fetch==='function';
function propLoad(){if(PR.want)return;PR.want=true;
  fetch('art/props/props.json').then(r=>r.ok?r.json():null).then(j=>{if(!j||!j.p){PR.want=false;return;}const im=new Image();im.decoding='async';
    im.onload=()=>{PR.idx=j;PR.img=im;for(const s of G.stand||[])if(s.fn)s.cv=null;}; // painted again, a few per frame (render.js drawStand)
    im.src='art/props/props.webp'+(j.v?'?v='+j.v:'');}).catch(()=>{PR.want=false;});}
// Draws prop `name` standing at its foot (cx, cy) into canvas context x, k times its size, mirrored if flip;
// false (draw it the old way) until the sheet is in.
const PROP_SIZE=0.8; // all props a touch smaller than Flare's own scale, to sit with the hero and the monsters (MA_SIZE)
function propArt(x,name,cx,cy,k,flip){if(!propOn())return false;propLoad();if(!PR.idx)return false;const f=PR.idx.p[name];if(!f)return false;
  const s=PR.idx.scale*PROP_SIZE*(k||1);if(flip){x.save();x.translate(cx,0);x.scale(-1,1);cx=0;}
  x.drawImage(PR.img,f[0],f[1],f[2],f[3],cx-f[4]*s,cy-f[5]*s,f[2]*s,f[3]*s);if(flip)x.restore();return true;}
// Its height above the foot, in world px (for labels).
function propTop(name,k){const f=PR.idx&&PR.idx.p[name];return f?f[5]*PR.idx.scale*PROP_SIZE*(k||1):0;}
