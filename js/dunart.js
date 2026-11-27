'use strict';
// v1.0.159: painted dungeon ground and walls (the world repaint, step 5). Earth, cobbles, snow, grass, stone slabs and
// iron plates from Flare's ground tiles, brick and rock from the lit faces of its walls (straightened), all in the
// floors sheet (js/floorart.js, tools/hero-art/build-floors.js). Each zone keeps its own colours: a texture is
// recoloured to the zone's hue, saturation and lightness (its light and shade kept), once per map, then painted
// into the map like the drawn ground was. Raised walls (render.js) show the painted wall tile as both top and face.
// Tree, ice and crystal walls and ice floors stay drawn. Settings › Floors: Painted or Drawn.
// material -> [texture, contrast, default colour]; walls only paint where they border floor (the rest stays dark)
const DUN_FLOOR={sand:['snow',1.4],earth:['earth',1.4],cobble:['cobble',1.25],slab:['slab',1.3],snow:['snow',1.3],ash:['earth',1.2],plate:['plate',1.3],grass:['grass',1.3]};
const DUN_WALL={brick:['brick',1.1],rock:['rock',0.75],sandstone:['rock',0.75],snowrock:['rock',0.8],obsidian:['rock',0.7,{h:10,s:8,l:9}],basalt:['brick',1,{h:6,s:10,l:11}],citadel:['brick',1.1,{h:210,s:14,l:26}]};
// Act 1 and the older act themes: what their drawn ground and walls look like, as materials
const DUN_OLD={
  a1fields:{floor:['grass',{h:96,s:14,l:14}]},a1moor:{floor:['grass',{h:84,s:13,l:14}],road:['earth',{h:32,s:17,l:18}]},
  a1gully:{floor:['earth',{h:28,s:13,l:15}],wall:['rock',{h:26,s:8,l:20}]},a1ossuary:{floor:['earth',{h:30,s:6,l:11}],wall:['rock',{h:32,s:6,l:13}]},
  crypt:{floor:['slab',{h:220,s:10,l:14}],wall:['brick',{h:220,s:12,l:20}]},desert:{floor:['sand',{h:32,s:24,l:22}],wall:['sandstone',{h:28,s:16,l:24}]},
  marsh:{floor:['grass',{h:95,s:18,l:12}]},citadel:{floor:['slab',{h:206,s:13,l:21}],wall:['citadel',{}]},
  ember:{floor:['slab',{h:10,s:10,l:10}],wall:['basalt',{}],post(x,px,py){if(Math.random()<0.13)THEMES._h.crack(x,px,py,'rgba(255,90,20,.55)',1.5);},
    wallPost(x,px,py){x.fillStyle='rgba(255,80,20,.16)';x.fillRect(px,py,TILE,2);}}};
const DUN={cache:new Map()};
// hsl (0-360, 0-100, 0-100) -> [r, g, b]
function dunRgb(h,s,l){s/=100;l/=100;const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return 255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)));};return [f(0),f(8),f(4)];}
// The tiles of texture `tex` recoloured to hsl(h, s, l): each pixel keeps how much lighter or darker than the tile's
// average it is (times con). Cached per map; null when this browser can't read pixels (then the drawn ground stays).
function dunTiles(tex,h,s,l,con){const key=tex+'|'+h+'|'+s+'|'+l+'|'+con;if(DUN.cache.has(key))return DUN.cache.get(key);
  const F=FL.idx.m&&FL.idx.m[tex];let out=null;
  if(F)try{out=F.map(t=>{const c=mkCanvas(TILE,TILE),x=c.getContext('2d');x.drawImage(FL.img,t[0],t[1],FL.idx.n,FL.idx.n,0,0,TILE,TILE);
      const im=x.getImageData(0,0,TILE,TILE),d=im.data;if(!(d instanceof Uint8ClampedArray))throw 0;let m=0;const n=d.length/4,Y=new Float32Array(n);
      for(let k=0;k<n;k++){Y[k]=0.3*d[k*4]+0.59*d[k*4+1]+0.11*d[k*4+2];m+=Y[k];}m=m/n||1;const lut=new Array(101);
      for(let k=0;k<n;k++){const L=Math.max(0,Math.min(100,Math.round(l*(1+(Y[k]/m-1)*con))));const c=lut[L]||(lut[L]=dunRgb(h,s,L));d[k*4]=c[0];d[k*4+1]=c[1];d[k*4+2]=c[2];d[k*4+3]=255;}
      x.putImageData(im,0,0);return c;});}catch(e){out=null;}
  if(DUN.cache.size>60)DUN.cache.clear();DUN.cache.set(key,out);return out;}
// Paints material [kind, {h, s, l}] (DUN_FLOOR or DUN_WALL) at tile (px, py); false: draw it the old way.
function dunPaint(x,spec,px,py,wall){if(!spec||!floorOn())return false;const M=(wall?DUN_WALL:DUN_FLOOR)[spec[0]];if(!M)return false;floorLoad();if(!FL.idx||!FL.idx.m)return false;
  const o=Object.assign({},M[2]||{},spec[1]||{}),T=dunTiles(M[0],o.h??30,o.s??10,o.l??15,M[1]);if(!T)return false;
  x.drawImage(T[Math.random()*T.length|0],px,py);return true;}
// Wraps every dungeon theme's ground and walls (Acts 2-5 keep their materials in .mat: acts.js zoneTheme).
for(const k in THEMES){if(k[0]==='_'||k.startsWith('town'))continue;const T=THEMES[k],S=T.mat||DUN_OLD[k];if(!S)continue;const f0=T.floor,w0=T.wall;
  if(S.floor)T.floor=function(x,px,py,i,j){const f=S.road&&G.road&&G.road[j*MW+i]?S.road:S.floor;if(dunPaint(x,f,px,py)){if(S.post)S.post(x,px,py);return;}return f0.call(this,x,px,py,i,j);};
  if(S.wall&&w0)T.wall=function(x,px,py,below,adj,i,j){if(adj&&dunPaint(x,S.wall,px,py,true)){if(S.wallPost)S.wallPost(x,px,py);return;}return w0.call(this,x,px,py,below,adj,i,j);};}
