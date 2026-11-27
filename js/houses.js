'use strict';
// v1.0.158: richer town houses (the world repaint, step 4), still drawn by code, one look per act:
//   gable  Gravewatch: fieldstone walls, slate roof, stone chimney with smoke, a lantern by an arched door, moss
//   flat   Kesh Oasis: plastered mudbrick, flat roof with jutting beams, pots and a small dome, horseshoe door, lattice windows
//   thatch Mirewatch: plank huts on stilts over black water, shaggy thatch with a ragged fringe, moss and hanging herbs
//   snow   Frosthold: round-log cabins with log ends at the corners, a heavy snow cap, icicles, drifts, a smoking chimney
//   forge  Cinderforge: basalt blocks with glowing seams, a riveted iron roof, slit windows aglow, a tall ember stack
// Drawn once into a standing piece (maps.js standProp), so Math.random is the stand's own seeded generator.
// p: {i, j, w, h, front, v} in tiles (front: it faces the plaza, door and windows showing; else its back and roof).
// Windows sit at a quarter and three quarters of the width (towns.js puts their lights there).
const HS={
  r:(a,b)=>a+Math.random()*(b-a),
  // a #rrggbb colour made lighter (k > 1) or darker (k < 1), as rgba with alpha a
  c(hex,k,a){const n=parseInt(hex.slice(1),16),f=v=>Math.max(0,Math.min(255,Math.round(v*(k??1))));return `rgba(${f(n>>16)},${f(n>>8&255)},${f(n&255)},${a??1})`;},
  rect(x,X,Y,w,h,f){x.fillStyle=f;x.fillRect(X,Y,w,h);},
  line(x,col,lw,pts){x.strokeStyle=col;x.lineWidth=lw;x.beginPath();x.moveTo(pts[0],pts[1]);for(let k=2;k<pts.length;k+=2)x.lineTo(pts[k],pts[k+1]);x.stroke();},
  poly(x,f,pts){x.fillStyle=f;x.beginPath();x.moveTo(pts[0],pts[1]);for(let k=2;k<pts.length;k+=2)x.lineTo(pts[k],pts[k+1]);x.closePath();x.fill();},
  dot(x,X,Y,r,f){x.fillStyle=f;x.beginPath();x.arc(X,Y,r,0,Math.PI*2);x.fill();},
  vgrad(x,y0,y1,a,b){const g=x.createLinearGradient(0,y0,0,y1);g.addColorStop(0,a);g.addColorStop(1,b);return g;},
  glow(x,X,Y,r,rgb,a){const g=x.createRadialGradient(X,Y,1,X,Y,r);g.addColorStop(0,`rgba(${rgb},${a})`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;x.fillRect(X-r,Y-r,r*2,r*2);},
  smoke(x,X,Y,n,col){for(let k=0;k<n;k++)HS.dot(x,X+Math.sin(k*1.7)*4+k*3,Y-k*9,4+k*1.6,`rgba(${col},${0.32-k*0.05})`);},
  // a lit window: frame, warm glass with a soft glow, a cross of mullions
  win(x,X,Y,w,h,frame,arch){HS.glow(x,X+w/2,Y+h/2,w*1.6,'255,190,100',0.28);x.fillStyle=frame;x.fillRect(X-2,Y-2,w+4,h+4);
    const g=HS.vgrad(x,Y,Y+h,'#ffe2a0','#e08a30');x.fillStyle=g;if(arch){x.beginPath();x.moveTo(X,Y+h);x.lineTo(X,Y+w/2);x.arc(X+w/2,Y+w/2,w/2,Math.PI,0);x.lineTo(X+w,Y+h);x.closePath();x.fill();}else x.fillRect(X,Y,w,h);
    x.fillStyle=frame;x.fillRect(X+w/2-1,Y,2,h);x.fillRect(X,Y+h/2-1,w,2);},
  // arched plank door with iron straps
  door(x,X,Y,w,h,wood,frame){x.fillStyle=frame;x.beginPath();x.moveTo(X-3,Y+h);x.lineTo(X-3,Y+w/2);x.arc(X+w/2,Y+w/2,w/2+3,Math.PI,0);x.lineTo(X+w+3,Y+h);x.closePath();x.fill();
    x.fillStyle=wood;x.beginPath();x.moveTo(X,Y+h);x.lineTo(X,Y+w/2);x.arc(X+w/2,Y+w/2,w/2,Math.PI,0);x.lineTo(X+w,Y+h);x.closePath();x.fill();
    x.fillStyle='rgba(0,0,0,.35)';for(let k=X+w/4;k<X+w-1;k+=w/4)x.fillRect(k,Y+2,1,h-2);
    x.fillStyle='#2a2a2e';x.fillRect(X+1,Y+h*0.3,w-2,2);x.fillRect(X+1,Y+h*0.72,w-2,2);HS.dot(x,X+w*0.78,Y+h*0.55,1.5,'#c8a040');}
};
// ---- Gravewatch: grey fieldstone, slate, moss ----
function houseGable(x,b){const {L,Rt,ww,py,H,front}=b,fy=front?py+H*0.5:py+H-18,base=py+H-4;
  // walls: rows of rough stones in mortar, a timber beam on top
  HS.rect(x,L,fy,ww,base-fy,'#2a2c30');
  for(let y=fy+2;y<base-2;){const h=HS.r(8,12);for(let X=L+2-HS.r(0,10);X<Rt-2;){const w=HS.r(12,22),x0=Math.max(L+1,X),x1=Math.min(Rt-1,X+w-2);if(x1>x0+2){const t=HS.r(0.8,1.15);
      HS.rect(x,x0,y,x1-x0,h-2,HS.c('#5c6068',t));HS.rect(x,x0,y,x1-x0,1.5,HS.c('#7a7e86',t));HS.rect(x,x0,y+h-3.5,x1-x0,1.5,'rgba(0,0,0,.3)');}X+=w;}y+=h;}
  for(let k=0;k<5;k++){const X=HS.r(L+4,Rt-14),Y=base-HS.r(2,14);x.fillStyle='rgba(70,100,55,.55)';x.beginPath();x.ellipse(X,Y,HS.r(4,10),HS.r(2,4),0,0,Math.PI*2);x.fill();}
  HS.rect(x,L-2,fy-3,ww+4,5,'#3a2a1e');
  if(front){const cx=b.px+b.W/2;HS.door(x,cx-10,base-30,20,30,'#4a3020','#4a4e56');
    // lantern by the door
    HS.rect(x,cx+15,base-34,2,8,'#1a1a1a');HS.glow(x,cx+16,base-24,16,'255,200,110',0.5);HS.rect(x,cx+12,base-28,8,9,'#2a2420');HS.rect(x,cx+13.5,base-27,5,6,'#ffd27a');
    for(const u of [0.25,0.75]){const X=b.px+b.W*u-7;if(Math.abs(X+7-cx)<22)continue;HS.win(x,X,fy+12,14,15,'#2a2420');
      HS.rect(x,X-6,fy+10,4,19,'#3a4a5a');HS.rect(x,X+16,fy+10,4,19,'#3a4a5a');HS.rect(x,X-3,fy+28,20,3,'#6a6e76');}}
  else{const X=b.px+b.W*(b.v>0.5?0.3:0.7);HS.rect(x,X-4,fy+4,8,7,'#ffcf80');}
  // slate roof: overhanging slope, rows of slates, a ridge
  const ry=py+4,rb=fy-1;HS.poly(x,'#1a1d24',[L-6,rb+2,L+8,ry,Rt-8,ry,Rt+6,rb+2]);
  for(let y=ry+2,row=0;y<rb;y+=6,row++){const t=(y-ry)/(rb-ry),xl=L+8-14*t,xr=Rt-8+14*t;for(let X=xl+(row%2)*5;X<xr-2;X+=10){const w=Math.min(9,xr-X-1);
      HS.rect(x,X,y,w,5.5,HS.c('#3a4254',HS.r(0.85,1.15)*(0.8+0.35*t)));HS.rect(x,X,y+4.5,w,1,'rgba(0,0,0,.4)');}}
  HS.rect(x,L+6,ry-2,ww-12,5,'#4a5262');HS.rect(x,L+6,ry-2,ww-12,1.5,'#6a7282');
  if(b.v>0.3){const X=b.px+b.W*(b.v>0.65?0.72:0.28);HS.rect(x,X-7,ry-18,14,24,'#4e5258');for(let y=ry-16;y<ry+4;y+=5)HS.rect(x,X-7,y,14,1,'rgba(0,0,0,.35)');HS.rect(x,X-9,ry-21,18,4,'#5e626a');HS.smoke(x,X,ry-28,5,'170,175,185');}}
// ---- Kesh Oasis: plaster, flat roof, beams, domes ----
function houseFlat(x,b){const {L,Rt,ww,py,H,front}=b,fy=front?py+H*0.5:py+H-18,base=py+H-4,ry=py+10;
  // the roof seen from above: a pale terrace inside a parapet, pots, a rug, sometimes a dome
  HS.rect(x,L-2,ry,ww+4,fy-ry,'#b48c5c');HS.rect(x,L+4,ry+5,ww-8,fy-ry-10,'#d2ae7a');
  for(let k=0;k<14;k++)HS.dot(x,HS.r(L+8,Rt-8),HS.r(ry+8,fy-8),HS.r(1,2.5),'rgba(120,80,40,.25)');
  if(b.v>0.55){const X=b.px+b.W*0.5,Y=(ry+fy)/2+4,r=Math.min(26,ww*0.18);x.fillStyle=HS.vgrad(x,Y-r,Y,'#f2ead8','#b8a888');x.beginPath();x.arc(X,Y,r,Math.PI,0);x.closePath();x.fill();
    HS.rect(x,X-r-2,Y-1,r*2+4,4,'#8a6a40');HS.rect(x,X-1,Y-r-7,2,7,'#c8a040');HS.dot(x,X,Y-r-8,2,'#e8c050');}
  else{const X=HS.r(L+12,Rt-50),Y=HS.r(ry+10,fy-24);HS.rect(x,X,Y,34,14,['#8a2a2a','#2a4a7a','#7a5a1a'][Math.random()*3|0]);HS.rect(x,X+3,Y+3,28,8,'rgba(232,192,112,.5)');}
  for(let k=0;k<3;k++){const X=HS.r(L+10,Rt-10),Y=HS.r(ry+10,fy-8);HS.dot(x,X,Y,5,'#a8643a');HS.dot(x,X,Y-2,2.2,'#3a2010');}
  // parapet with rounded merlons
  for(let X=L-2;X<Rt;X+=12){x.fillStyle='#c09868';x.beginPath();x.arc(X+5,ry,5,Math.PI,0);x.fill();}
  // plaster walls: warm gradient, patches flaked off to the bricks, beam ends
  x.fillStyle=HS.vgrad(x,fy,base,'#d6b07c','#9a7448');x.fillRect(L,fy,ww,base-fy);
  for(let k=0;k<4;k++){const X=HS.r(L+6,Rt-26),Y=HS.r(fy+10,base-14);HS.rect(x,X,Y,HS.r(10,20),HS.r(6,10),'#a06a44');for(let s=0;s<3;s++)HS.rect(x,X+s*6,Y+3,1,3,'rgba(60,30,10,.4)');}
  HS.rect(x,L,fy,ww,3,'rgba(255,240,210,.35)');for(let X=L+8;X<Rt-6;X+=16){HS.rect(x,X,fy+5,5,4,'#5a3a1e');HS.rect(x,X,fy+8,5,1,'rgba(0,0,0,.4)');}
  if(front){const cx=b.px+b.W/2,dw=20,dh=32,Y=base-dh;
    // horseshoe arch with a striped curtain, an awning above
    x.fillStyle='#8a6640';x.beginPath();x.moveTo(cx-dw/2-3,base);x.lineTo(cx-dw/2-3,Y+8);x.arc(cx,Y+8,dw/2+3,Math.PI*0.9,Math.PI*2.1);x.lineTo(cx+dw/2+3,base);x.closePath();x.fill();
    x.fillStyle='#2a1810';x.beginPath();x.moveTo(cx-dw/2,base);x.lineTo(cx-dw/2,Y+8);x.arc(cx,Y+8,dw/2,Math.PI*0.9,Math.PI*2.1);x.lineTo(cx+dw/2,base);x.closePath();x.fill();
    const cc=['#a3262f','#2f6b8a','#d8a040'][Math.random()*3|0];for(let k=0;k<4;k++)HS.rect(x,cx-dw/2+k*5,Y+10,4,dh-10,k%2?cc:'#e8dcc4');
    for(let k=0;k<6;k++)HS.poly(x,k%2?'#e8dcc4':cc,[cx-24+k*8,Y-6,cx-16+k*8,Y-6,cx-14+k*8,Y+2,cx-22+k*8,Y+2]);
    for(const u of [0.25,0.75]){const X=b.px+b.W*u-7;if(Math.abs(X+7-cx)<24)continue;HS.win(x,X,fy+14,14,18,'#5a3a1e',true);for(let k=1;k<4;k++)HS.rect(x,X,fy+14+k*4.5,14,1,'#5a3a1e');}}}
// ---- Mirewatch: stilts, planks, thatch ----
function houseThatch(x,b){const {L,Rt,ww,py,H,front}=b,base=py+H-4,fy=front?py+H*0.5:py+H-22,wb=base-12;
  // stilts into black water with pale ripples
  x.fillStyle='rgba(8,16,12,.8)';x.beginPath();x.ellipse(b.px+b.W/2,base-2,ww/2+6,7,0,0,Math.PI*2);x.fill();
  for(let k=0;k<5;k++){const X=L+6+k*(ww-16)/4;HS.rect(x,X,wb-2,5,14,'#2a1c10');HS.rect(x,X,wb-2,1.5,14,'#4a3420');x.strokeStyle='rgba(160,190,170,.25)';x.lineWidth=1;x.beginPath();x.ellipse(X+2.5,base-1,6,1.8,0,0,Math.PI*2);x.stroke();}
  // plank walls, weathered: vertical boards, uneven feet, moss
  for(let X=L;X<Rt;X+=7){const w=Math.min(7,Rt-X),t=HS.r(0.8,1.15);HS.rect(x,X,fy,w,wb-fy+HS.r(-2,2),HS.c('#5a4228',t));HS.rect(x,X,fy,1,wb-fy,'rgba(0,0,0,.35)');}
  HS.rect(x,L-2,wb-3,ww+4,4,'#3a2a18');for(let k=0;k<4;k++){x.fillStyle='rgba(80,120,40,.45)';x.beginPath();x.ellipse(HS.r(L+6,Rt-6),wb-HS.r(3,12),HS.r(4,9),HS.r(2,4),0,0,Math.PI*2);x.fill();}
  if(front){const cx=b.px+b.W/2;HS.rect(x,cx-11,wb-30,22,30,'#3a2a18');HS.rect(x,cx-9,wb-28,18,28,'#1a1008');HS.rect(x,cx-9,wb-28,6,28,'#4a3420'); // a door left ajar
    HS.rect(x,cx-16,wb-2,32,4,'#4a3420');
    for(const u of [0.25,0.75]){const X=b.px+b.W*u-6;if(Math.abs(X+6-cx)<22)continue;HS.win(x,X,fy+12,12,12,'#2a1c10');}
    // hanging herbs and a rope coil
    for(let k=0;k<3;k++){const X=L+10+k*7;HS.line(x,'#2a2010',1,[X,fy+2,X,fy+8]);x.fillStyle='#5a7a30';x.beginPath();x.ellipse(X,fy+12,2.5,5,0,0,Math.PI*2);x.fill();}
    x.strokeStyle='#a08a5a';x.lineWidth=2;x.beginPath();x.arc(Rt-14,wb-12,5,0,Math.PI*2);x.stroke();}
  // shaggy thatch: a steep heap of straw strands, a ragged drooping fringe, moss, a tied ridge
  const ry=py+2,rb=fy+6;HS.poly(x,'#4a4a22',[L-8,rb,L+ww*0.2,ry,Rt-ww*0.2,ry,Rt+8,rb]);
  for(let k=0;k<ww*1.4;k++){const t=Math.random(),X0=L+ww*0.2+(ww*0.6)*t,X1=L-8+(ww+16)*t+HS.r(-3,3);x.strokeStyle=HS.c(['#7a7a3a','#8a8442','#5a5a2a','#9a8a4a'][k%4],HS.r(0.75,1.1),0.8);x.lineWidth=1.2;x.beginPath();x.moveTo(X0,ry+HS.r(0,6));x.lineTo(X1,rb+HS.r(-2,5));x.stroke();}
  for(let X=L-8;X<Rt+8;X+=4)HS.line(x,HS.c('#6a6a32',HS.r(0.7,1)),1.5,[X,rb-2,X+HS.r(-2,2),rb+HS.r(3,9)]);
  for(let k=0;k<4;k++){x.fillStyle='rgba(60,100,40,.5)';x.beginPath();x.ellipse(HS.r(L+10,Rt-10),HS.r(ry+10,rb-6),HS.r(5,12),HS.r(3,5),0,0,Math.PI*2);x.fill();}
  HS.rect(x,L+ww*0.2-2,ry-3,ww*0.6+4,6,'#5a5226');for(let X=L+ww*0.25;X<Rt-ww*0.2;X+=18)HS.rect(x,X,ry-4,2,8,'#2a2010');}
// ---- Frosthold: log cabin under snow ----
function houseSnow(x,b){const {L,Rt,ww,py,H,front}=b,fy=front?py+H*0.5:py+H-20,base=py+H-4;
  // round logs: lit tops, dark undersides, log ends sticking out at the corners
  for(let y=fy;y<base;y+=8){HS.rect(x,L,y,ww,8,HS.vgrad(x,y,y+8,'#8a6440','#3a2614'));HS.rect(x,L,y+1,ww,1,'rgba(255,230,190,.25)');
    for(const X of [L-3,Rt+3]){HS.dot(x,X,y+4,4.2,'#6a4a2c');HS.dot(x,X,y+4,2.6,'#b08a5a');HS.dot(x,X,y+4,0.9,'#6a4a2c');}}
  if(front){const cx=b.px+b.W/2;HS.door(x,cx-10,base-30,20,30,'#5a3a20','#2a1a0c');
    // antlers over the door
    x.strokeStyle='#e8dcc4';x.lineWidth=2;x.beginPath();for(const s of [-1,1]){x.moveTo(cx,base-36);x.quadraticCurveTo(cx+s*10,base-40,cx+s*12,base-50);x.moveTo(cx+s*7,base-40);x.lineTo(cx+s*9,base-46);}x.stroke();
    for(const u of [0.25,0.75]){const X=b.px+b.W*u-7;if(Math.abs(X+7-cx)<22)continue;HS.win(x,X,fy+12,14,14,'#3a2614');HS.rect(x,X-3,fy+27,20,4,'#eef4fa');
      x.fillStyle='rgba(235,245,255,.7)';x.beginPath();x.moveTo(X,fy+12);x.lineTo(X+6,fy+12);x.lineTo(X,fy+17);x.fill();}}
  // a snowdrift along the foot
  x.fillStyle='#e6eef8';x.beginPath();x.moveTo(L-6,base+2);for(let X=L-6;X<=Rt+6;X+=8)x.lineTo(X,base-HS.r(2,7));x.lineTo(Rt+6,base+2);x.closePath();x.fill();
  // shingle roof, heavy snow cap with a wavy hem, icicles under the eaves
  const ry=py+4,rb=fy;HS.poly(x,'#3a2a20',[L-8,rb+2,L+10,ry,Rt-10,ry,Rt+8,rb+2]);
  const hem=ry+(rb-ry)*0.5;for(let y=hem-6,row=0;y<rb;y+=5,row++){const t=(y-ry)/(rb-ry),xl=L+10-18*t,xr=Rt-10+18*t;for(let X=xl+(row%2)*4;X<xr-1;X+=8){HS.rect(x,X,y,Math.min(7,xr-X),4,HS.c('#5a4232',HS.r(0.75,1.1)));HS.rect(x,X,y+3.5,Math.min(7,xr-X),1,'rgba(0,0,0,.35)');}}
  x.fillStyle=HS.vgrad(x,ry,rb,'#ffffff','#cfdcec');x.beginPath();x.moveTo(L+8,ry-3);x.lineTo(Rt-8,ry-3);const hx=(hem-ry)/(rb-ry)*18;x.lineTo(Rt-8+hx,hem);for(let X=Rt-8+hx;X>L+8-hx;X-=10)x.quadraticCurveTo(X-5,hem+HS.r(4,10),X-10,hem+HS.r(-1,2));x.lineTo(L+8-hx,hem);x.closePath();x.fill();
  for(let k=0;k<5;k++)HS.rect(x,HS.r(L+16,Rt-30),HS.r(ry+4,hem-6),HS.r(10,24),1.5,'rgba(150,170,200,.35)');
  x.fillStyle='#eef4fa';for(let X=L-6;X<Rt+6;X+=HS.r(14,26))x.fillRect(X,rb-1,HS.r(6,12),3);
  HS.rect(x,L+10,ry-1,ww-20,2,'rgba(255,255,255,.9)');
  for(let X=L-4;X<Rt+4;X+=HS.r(5,9)){const h=HS.r(4,13);HS.poly(x,'rgba(220,240,255,.9)',[X,rb+2,X+3,rb+2,X+1.5,rb+2+h]);}
  if(b.v>0.25){const X=b.px+b.W*(b.v>0.6?0.72:0.28);HS.rect(x,X-7,ry-16,14,22,'#5e5a56');for(let y=ry-14;y<ry+4;y+=5)HS.rect(x,X-7,y,14,1,'rgba(0,0,0,.3)');HS.rect(x,X-9,ry-20,18,5,'#f4f8ff');HS.smoke(x,X,ry-27,5,'200,205,215');}}
// ---- Cinderforge: basalt, iron, embers ----
function houseForge(x,b){const {L,Rt,ww,py,H,front}=b,fy=front?py+H*0.5:py+H-18,base=py+H-4;
  // basalt blocks with seams that glow faintly
  HS.rect(x,L,fy,ww,base-fy,'#6a2410');
  for(let y=fy,row=0;y<base;y+=12,row++)for(let X=L-(row%2)*12;X<Rt;X+=24){const x0=Math.max(L,X+1),x1=Math.min(Rt,X+23);HS.rect(x,x0,y+1,x1-x0,Math.min(11,base-y-1),HS.c('#2e2624',HS.r(0.8,1.2)));HS.rect(x,x0,y+1,x1-x0,1.5,'rgba(255,255,255,.07)');}
  HS.glow(x,b.px+b.W/2,base,ww*0.5,'255,90,20',0.18);
  for(const X of [L+3,Rt-7]){HS.rect(x,X,fy,4,base-fy,'#3a3533');for(let y=fy+6;y<base;y+=12)HS.dot(x,X+2,y,1.3,'#7a706a');}
  if(front){const cx=b.px+b.W/2;HS.rect(x,cx-12,base-32,24,32,'#1a1614');HS.rect(x,cx-10,base-30,20,30,'#3a3533');
    for(let y=base-26;y<base;y+=8)for(const X of [cx-7,cx+7])HS.dot(x,X,y,1.4,'#8a807a');HS.rect(x,cx-10,base-4,20,3,'#ff7a2a');HS.glow(x,cx,base-2,16,'255,120,40',0.5);
    for(const u of [0.25,0.75]){const X=b.px+b.W*u-4;if(Math.abs(X+4-cx)<22)continue;HS.glow(x,X+4,fy+22,20,'255,110,30',0.4);HS.rect(x,X-2,fy+10,12,26,'#1a1614');x.fillStyle=HS.vgrad(x,fy+12,fy+34,'#ffd060','#ff4a10');x.fillRect(X,fy+12,8,22);}}
  // riveted iron plate roof with rust streaks
  const ry=py+6,rb=fy-1;HS.rect(x,L-4,ry,ww+8,rb-ry,'#2a2422');
  for(let X=L-4;X<Rt+4;X+=22){const w=Math.min(21,Rt+4-X);HS.rect(x,X,ry,w,rb-ry,HS.c('#3e3634',HS.r(0.85,1.15)));HS.rect(x,X,ry,1.5,rb-ry,'rgba(255,255,255,.08)');
    for(let y=ry+5;y<rb;y+=10)HS.dot(x,X+3,y,1.2,'#6a605a');if(Math.random()<0.6)HS.rect(x,X+HS.r(6,16),ry+HS.r(4,20),2,HS.r(10,24),'rgba(140,60,30,.45)');}
  HS.rect(x,L-6,rb-3,ww+12,5,'#1a1614');
  // the stack: tall, banded, glowing at the mouth, embers rising
  const X=b.px+b.W*(b.v>0.5?0.75:0.25);HS.rect(x,X-9,ry-34,18,40,'#2a2422');for(let y=ry-30;y<ry+4;y+=9)HS.rect(x,X-10,y,20,2.5,'#4a4240');
  HS.glow(x,X,ry-36,24,'255,120,30',0.55);HS.rect(x,X-11,ry-38,22,5,'#3a3230');HS.rect(x,X-7,ry-37,14,2,'#ffb040');
  for(let k=0;k<6;k++)HS.rect(x,X+HS.r(-10,10),ry-44-HS.r(0,30),2,2,k%2?'#ffb040':'#ff6a1a');}
const HOUSE_STYLE={gable:houseGable,flat:houseFlat,thatch:houseThatch,snow:houseSnow,forge:houseForge};
// Draws house p in the style S.style (towns.js THEMES.town*.house) into canvas context x.
function drawHouse(x,p,S){const px=p.i*TILE,py=p.j*TILE,W=p.w*TILE,H=p.h*TILE,m=4;
  x.fillStyle='rgba(0,0,0,.35)';x.beginPath();x.ellipse(px+W/2,py+H-2,W/2,8,0,0,Math.PI*2);x.fill();
  (HOUSE_STYLE[S.style]||houseGable)(x,{px,py,W,H,L:px+m,Rt:px+W-m,ww:W-2*m,front:p.front,v:p.v});}
