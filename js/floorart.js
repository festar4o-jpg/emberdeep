'use strict';
// v1.0.157: painted town floors (the world repaint, step 3). Grass, cobbles, snow, cave earth and stone slabs from the
// free ARPG Flare's ground tiles (CC-BY-SA 3.0, art/floors/CREDITS.txt), turned from corner-view diamonds back into
// squares by tools/hero-art/build-floors.js so they fit Emberdeep's straight maps, recoloured per town. Painted into
// the map once (maps.js paintMap), so they cost nothing per frame. Settings › Floors: Painted or Drawn. Until the
// sheet is in, the floors are drawn as before; when it arrives, the town is painted again.
const FL={idx:null,img:null,want:false};
const floorOn=()=>SETTINGS.floors!=='drawn'&&typeof Image!=='undefined'&&typeof fetch==='function';
function floorLoad(){if(FL.want)return;FL.want=true;
  fetch('art/floors/floors.json').then(r=>r.ok?r.json():null).then(j=>{if(!j||!j.f){FL.want=false;return;}const im=new Image();im.decoding='async';
    im.onload=()=>{FL.idx=j;FL.img=im;if(G.inTown&&G.mapCv&&floorOn())renderMap(G.artSeed);}; // the same town again, now on painted ground
    im.src='art/floors/floors.webp'+(j.v?'?v='+j.v:'');}).catch(()=>{FL.want=false;});}
// Paints one tile of floor set `name` (a random tile of it) at (px, py), w x h tiles (default 1); false until the sheet is in.
function floorArt(x,name,px,py,w,h){if(!floorOn())return false;floorLoad();if(!FL.idx)return false;const F=FL.idx.f[name];if(!F)return false;const n=FL.idx.n;
  for(let j=0;j<(h||1);j++)for(let i=0;i<(w||1);i++){const t=F[Math.random()*F.length|0];x.drawImage(FL.img,t[0],t[1],n,n,px+i*TILE,py+j*TILE,TILE,TILE);}return true;}
