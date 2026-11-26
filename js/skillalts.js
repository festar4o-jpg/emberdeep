// Second skills (v1.0.111): each of the five skill buttons has a second skill to choose from, swapped on the ✨
// screen (free, any time; that button's cooldown restarts). c.alt[i] = 1 when button i uses its second skill (save
// v15). Ranks, skill points, "+1 to <skill>" and "+% damage with skill N" belong to the button, so they follow the
// swap. Modifiers: first skills keep theirs in c.mods, second skills in c.amods (ALT_MODS below, same unlock ranks;
// skillmods.js hasMod / skMod read the skill that is on each button). Uniques made for a first skill only work while it
// is chosen: their code checks firstSk(i) / !altOn(c, i). soon: shown, not choosable yet.
// Use skillAt(c, i) for the skill on a button and skName(cls, i) for its name; SKILLS (skills.js) holds the first ones.
const SKILL_ALTS={
  warden:[ // v1.0.112
    {id:'rend',name:'Rending Strike',icon:'🗡️',cd:0.75,cost:0,elem:'phys',bleed:true,sfx:'stab',mult:r=>1.6+0.14*(r-1),
      desc:r=>`A heavy thrust at one enemy for ${pct(1.6+0.14*(r-1))} weapon damage that always makes it Bleed. Slower than Cleave; made for bosses. Each hit generates 10 Fury.`,
      cast(r){const p=G.p,s=G.stats,t=nearest(p.x,p.y,170);if(t)p.face=Math.atan2(t.y-p.y,t.x-p.x);let hand='mh';if(s.oh){p.hand=p.hand==='mh'?'oh':'mh';hand=p.hand;}
        const h=hand==='oh'?s.oh:s.mh,w=h?WEAPONS[h.wt]||FIST:FIST,reach=w.reach*1.15,m=1.6+0.14*(r-1),deep=hasMod('rendDeep')?1.5:1;let best=null,bd=1e9;
        const inFront=(e,R,arc)=>{const d=dist(e,p);return d<R+e.r&&angDiff(Math.atan2(e.y-p.y,e.x-p.x),p.face)<arc?d:-1;};
        for(const e of G.enemies){if(e.dead||e.hidden)continue;const d=inFront(e,reach,0.6);if(d>=0&&d<bd){bd=d;best=e;}}
        if(best){let mm=m;if(hasMod('rendSunder')){const n=best.sunUntil>G.time?best.sunN||0:0;mm*=1+0.08*n;best.sunN=Math.min(5,n+1);best.sunUntil=G.time+4;} // Sunder
          hitEnemy(best,mm,{kb:40,hand,weapon:true,bleed:true,bleedX:deep});gainRes(10);G.shake=Math.max(G.shake,3);
          if(hasMod('rendSweep')){let n=0;for(const e of G.enemies){if(n>=2||e===best||e.dead||e.hidden)continue;if(inFront(e,reach*1.7,0.4)>=0){hitEnemy(e,m*0.5,{kb:30,hand,weapon:true,bleed:true,bleedX:deep});n++;}}}} // Sweeping Thrust
        G.fx.push({type:'arc',x:p.x,y:p.y,a:p.face,r:reach*(hasMod('rendSweep')?1.6:1)-6,half:0.22,lw:8,dir:-1,t:0,max:0.16,col:'#ffb0a0'});startAtk('thrust',hand,0);}},
    {id:'charge',name:'Charge',icon:'🐂',cd:6,cost:20,elem:'phys',sfx:'dodge',
      desc:r=>`Dash forward through enemies for ${pct(1.2+0.15*(r-1))} damage, knocking them aside and Stunning them for ${(1+0.05*(r-1)).toFixed(2)}s. Costs 20 Fury.`,
      cast(r){const p=G.p,a=aimPoint(320);p.charge={a:p.face,t:0,dur:hasMod('chargeFar')?0.48:0.3,mult:1.2+0.15*(r-1),stun:1+0.05*(r-1),hit:[],sk:G.sk};}},
    {id:'bladefan',name:'Blade Fan',icon:'🪃',cd:5,cost:25,elem:'phys',sfx:'swing',
      desc:r=>`Throw 5 spinning blades in a wide cone, each for ${pct(0.8+0.1*(r-1))} weapon damage, piercing 2 enemies. A ranged attack for the Warden. Costs 25 Fury.`,
      cast(r){const p=G.p,t=aimPoint(360),a0=p.face,more=hasMod('fanMore'),far=hasMod('fanPierce'),n=more?4:2,gap=more?0.17:0.3;
        for(let k=-n;k<=n;k++){const a=a0+k*gap;shoot({x:p.x+Math.cos(a)*100,y:p.y+Math.sin(a)*100},560,7,'#d8d0c0',{mult:(0.8+0.1*(r-1))*(more?0.75:1),weapon:true,pierce:far?5:2});}
        for(const b of G.proj.slice(-(2*n+1))){b.life=far?0.95:0.65;if(hasMod('fanBleed'))b.bleed=true;}p.face=a0;startAtk('swing','mh',2);}}, // Blade Storm, Razor Edge, Serrated
    {id:'banner',name:'Battle Banner',icon:'🚩',cd:18,cost:20,elem:'phys',sfx:'warcry',
      desc:r=>`Plant a banner for ${8+Math.floor((r-1)/2)}s: while you stand near it you deal ${pct(0.25+0.03*(r-1))} more damage and regenerate 2% of your Life a second. Costs 20 Fury.`,
      cast(r){const p=G.p,amt=(0.25+0.03*(r-1))*(hasMod('banWar')?2:hasMod('banHeal')?0.5:1);
        G.banner={x:p.x,y:p.y,t:8+Math.floor((r-1)/2),amt,regen:hasMod('banWar')?0:hasMod('banHeal')?0.05:0.02,fx:0};G.fx.push({type:'ring',x:p.x,y:p.y,r0:10,r1:BANNER_R,t:0,max:0.5,col:'#ffcc55'});burst(p.x,p.y,20,'#ffcc55',160);}},
    {id:'seismic',name:'Seismic Wave',icon:'〰️',cd:10,cost:40,elem:'phys',sfx:'slam',
      desc:r=>`Six quakes roll forward in a line, each hitting for ${pct(1.8+0.2*(r-1))} damage and Stunning for 0.5s. Costs 40 Fury.`,
      cast(r){const p=G.p,t=aimPoint(400),a0=p.face,x0=p.x,y0=p.y,twin=hasMod('seisWide'),m=(1.8+0.2*(r-1))*(twin?0.7:1),sk=G.sk,N=hasMod('seisLong')?10:6,magma=hasMod('seisMagma');
        for(const a of twin?[a0-0.35,a0+0.35]:[a0])for(let k=0;k<N;k++){const x=x0+Math.cos(a)*(55+k*62),y=y0+Math.sin(a)*(55+k*62);if(blockedAt(x,y,10))break;G.fx.push({type:'tele',x,y,r:70,t:0,max:0.2+k*0.12,col:'#ff9a4a',own:1});
          G.delayed.push({sk,t:0.2+k*0.12,fn:()=>{aoe(x,y,70,m,{stun:0.5});fxCracks(x,y,70);burst(x,y,10,'#c8763a',200);G.shake=Math.max(G.shake,6);
            if(magma)G.hazards.push({sk,x,y,r:55,t:3,tick:0.25,mult:0.3+0.04*(r-1)});}});}}}], // Twin Waves, Long Wave, Magma Wake
  arcanist:[ // v1.0.113
    {id:'shards',name:'Ice Shards',icon:'🧊',cd:0.5,cost:0,elem:'cold',sfx:'nova',mult:r=>(0.45+0.06*(r-1))*2, // the sheet counts 2 of the 3 on one target
      desc:r=>`Fire 3 shards in a fan, each for ${pct(0.45+0.06*(r-1))} weapon damage, piercing 1 enemy and Chilling. Each hit restores 1 Mana.`,
      cast(r){const p=G.p,t=aimPoint(520),a0=p.face,five=hasMod('shardFive'),frost=hasMod('shardFrost'),split=hasMod('shardSplit'),m=(0.45+0.06*(r-1))*(five?0.8:1);
        const os=five?[-0.36,-0.18,0,0.18,0.36]:[-0.22,0,0.22];
        for(const o of os){const a=a0+o;shoot({x:p.x+Math.cos(a)*100,y:p.y+Math.sin(a)*100},620,5,'#bfe8ff',{mult:m,weapon:true,pierce:1+(G.stats.pierce||0),onhit:e=>{gainRes(1);if(!e||e.dead)return;
          if(split&&e.chillT>0){aoe(e.x,e.y,55,m*0.5,{quiet:true});burst(e.x,e.y,8,'#dff4ff',150);} // Shatter
          chillHit(e,frost?0.6:0.3,frost?3:2);}});} // Frostbite
        for(const q of G.proj.slice(-os.length))q.life=0.85;p.face=a0;}}, // Shard Spray
    {id:'firewall',name:'Firewall',icon:'🧱',cd:5,cost:30,elem:'fire',sfx:'fireball',
      desc:r=>`A line of burning ground in front of you for ${(4+0.2*(r-1)).toFixed(1)}s, burning for ${pct(0.6+0.07*(r-1))} damage twice a second. Costs 30 Mana.`,
      cast(r){const p=G.p,t=aimPoint(320),a=p.face,T=4+0.2*(r-1),m=(0.6+0.07*(r-1))*(hasMod('wallHot')?1.4:1),put=(x,y,k)=>{if(blockedAt(x,y,10))return false;G.hazards.push({sk:G.sk,x,y,r:42,t:T,tick:0.1*k,mult:m});burst(x,y,8,'#ff8a2a',140);return true;};
        if(hasMod('wallRing')){for(let k=0;k<8;k++){const b=k/8*TAU;put(p.x+Math.cos(b)*110,p.y+Math.sin(b)*110,k);}return;} // Ring of Fire
        for(let k=0,n=hasMod('wallLong')?8:5;k<n;k++)if(!put(p.x+Math.cos(a)*(60+k*55),p.y+Math.sin(a)*(60+k*55),k))break;}}, // Inferno, Searing
    {id:'barrier',name:'Ice Barrier',icon:'🛡️',cd:12,cost:35,elem:'cold',sfx:'nova',
      desc:r=>`A shield of ice soaks ${Math.round((25+2*(r-1)))}% of your Life in damage for 6s. When it breaks or ends it bursts for ${pct(1.2+0.15*(r-1))} damage, Chilling enemies around you. Costs 35 Mana.`,
      cast(r){const p=G.p;p.barrier=Math.max(p.barrier||0,G.stats.life*(0.25+0.02*(r-1))*(hasMod('barBig')?1.5:1));p.barrierT=6; // Glacial Wall
        G.skz.push({k:'barrier',t:6.2,m:(1.2+0.15*(r-1))*(hasMod('barNova')?1.5:1),freeze:hasMod('barNova'),mana:hasMod('barMana'),sk:G.sk}); // Frost Burst, Arcane Ward
        G.fx.push({type:'ring',x:p.x,y:p.y,r0:p.r,r1:p.r+18,t:0,max:0.4,col:'#bfe8ff'});}},
    {id:'orb',name:'Storm Orb',icon:'🔮',cd:7,cost:40,elem:'light',sfx:'chain',
      desc:r=>`A slow orb of lightning drifts forward for 4s, zapping up to 3 enemies near it 3 times a second for ${pct(0.45+0.06*(r-1))} damage. Costs 40 Mana.`,
      cast(r){const p=G.p,t=aimPoint(400),a=p.face,fast=hasMod('orbFast'),still=hasMod('orbStill'),v=still?0:fast?220:110;
        const x=still?t.x:p.x+Math.cos(a)*24,y=still?t.y:p.y+Math.sin(a)*24;
        G.skz.push({k:'orb',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:fast?3:4,zap:0,every:still?1/4.5:1/3,n:fast?5:3,nova:hasMod('orbNova'),m:0.45+0.06*(r-1),sk:G.sk});}}, // Ball Lightning, Tempest Anchor, Overcharged
    {id:'blackhole',name:'Black Hole',icon:'🕳️',cd:14,cost:60,elem:'arcane',sfx:'meteor',
      desc:r=>`Open a black hole for 2.5s: it pulls enemies in and crushes them for ${pct(0.6+0.08*(r-1))} damage twice a second, then collapses for ${pct(3+0.35*(r-1))}. Costs 60 Mana.`,
      cast(r){const a=aimPoint(400),big=hasMod('holeBig'),quick=hasMod('holeQuick'),T=quick?1:big?3.5:2.5; // Event Horizon, Singularity, Nova Star
        G.skz.push({k:'hole',x:a.x,y:a.y,t:T,tick:0.5,R:HOLE_R*(big?1.4:1),m:0.6+0.08*(r-1),end:(3+0.35*(r-1))*(quick?1.6:1),fire:hasMod('holeFire'),fm:0.3+0.04*(r-1),sk:G.sk});
        G.fx.push({type:'tele',x:a.x,y:a.y,r:120*(big?1.4:1),t:0,max:T,col:'#a06aff',own:1});}}],
  ranger:[ // v1.0.129 (moving parts in ranger.js)
    {id:'pierce',name:'Piercing Shot',icon:'➹',cd:0.9,cost:0,elem:'phys',sfx:'twang',
      desc:r=>`A heavy, fast arrow that passes through every enemy in a line for ${pct(1.8+0.16*(r-1))} weapon damage. Each hit restores 2 Focus. Slower than Arrow Shot.`,
      cast(r){const p=G.p,a=aimPoint(700),twin=hasMod('psTwin'),m=(1.8+0.16*(r-1))*(twin?0.65:1),bl=hasMod('psBleed'),mount=hasMod('psMount'); /* Twin Shot, Serrated Shot, Mounting Power */
        for(const k of twin?[-1,1]:[0]){const b=Math.atan2(a.y-p.y,a.x-p.x),ox=-Math.sin(b)*10*k,oy=Math.cos(b)*10*k;let q;
          shoot({x:a.x+ox,y:a.y+oy},1000,5,'#f0e6d0',{mult:m,weapon:true,pierce:99,bleed:bl,onhit:()=>{gainRes(2);if(mount&&q)q.mult=Math.min(m*1.75,q.mult*1.15);},arrow:true});q=G.proj[G.proj.length-1];q.heavy=true;}
        startAtk('bow','mh',0);}},
    {id:'vault',name:'Vault',icon:'🤸',cd:5,cost:15,sfx:'dodge',
      desc:r=>`Flip backwards out of danger (nothing can hit you in the air), leaving caltrops that slow enemies by 50% and hit them for ${pct(0.35+0.04*(r-1))} damage twice a second for ${CALTROP_T}s. Costs 15 Focus.`,
      cast(r){vault(r);}},
    {id:'firetrap',name:'Fire Trap',icon:'🔥',cd:6,cost:25,elem:'fire',sfx:'swing',
      desc:r=>`Throw a trap that springs when an enemy steps close: a fire burst for ${pct(2+0.22*(r-1))} damage (it can Ignite), then burning ground for ${FTRAP_T}s that deals ${pct(0.5+0.055*(r-1))} twice a second. Shares the limit of ${TRAP_MAX} traps. Costs 25 Focus.`,
      cast(r){const a=aimPoint(220),p=G.p;let x=a.x,y=a.y;const d=Math.hypot(x-p.x,y-p.y);if(d>220){x=p.x+(x-p.x)/d*220;y=p.y+(y-p.y)/d*220;}if(blockedAt(x,y,10)){x=p.x;y=p.y;}
        placeTrap(x,y,2+0.22*(r-1),0,G.sk,0.5+0.055*(r-1));}},
    {id:'hawk',name:'Hawk',icon:'🦅',cd:12,cost:30,sfx:'screech',
      desc:r=>`A hawk circles you for ${HAWK_T}s and dives at enemies near you for ${pct(0.7+0.07*(r-1))} weapon damage (faster with Attack Speed), Marking them: Marked enemies take ${Math.round((0.15+0.01*(r-1))*100)}% more damage for ${MARK_T}s. It replaces your wolf. Costs 30 Focus.`,
      cast(r){callHawk(r);}},
    {id:'explosive',name:'Explosive Arrow',icon:'💣',cd:8,cost:40,elem:'fire',sfx:'twang',
      desc:r=>`An arrow that sticks in the first enemy it hits and explodes ${BOMB_T}s later for ${pct(4+0.45*(r-1))} weapon damage around it (it can Ignite). Costs 40 Focus.`,
      cast(r){const a=aimPoint(600),sk=G.sk,m=(4+0.45*(r-1))*(hasMod('exPayload')?1.25:1);shoot(a,700,5,'#ff9a3a',{mult:0.3,weapon:true,arrow:true,onhit:e=>{if(e)stickBomb(e,m,sk);}});G.proj[G.proj.length-1].fire=true;startAtk('bow','mh',0);}}]};
// Modifiers of the second skills (v1.0.114): 3 each, unlocked at ranks MOD_UNLOCK like the first skills' (skillmods.js).
// v1.0.114 balance (per button, against the first skill): Ice Shards 45% a shard, Seismic Wave 180% a quake, Firewall
// 60% a tick, Black Hole collapse 300%.
const ALT_MODS={
  warden:[
    [{k:'rendDeep',name:'Deep Wounds',t:'Its Bleed deals 50% more damage'},
     {k:'rendSunder',name:'Sunder',t:'Each hit on the same enemy deals 8% more than the last, up to 5 times (resets after 4s)'},
     {k:'rendSweep',name:'Sweeping Thrust',t:'Also hits up to 2 more enemies behind the first for half damage'}],
    [{k:'chargeQuake',name:'Trample',t:'Ends with a quake around you for 125% of its damage'},
     {k:'chargeFar',name:'Long Charge',t:'Dash 60% farther'},
     {k:'chargeGuard',name:'Bull\'s Hide',t:'Take 40% less damage for 3s after charging'}],
    [{k:'fanMore',name:'Blade Storm',t:'9 blades instead of 5, each 25% weaker'},
     {k:'fanPierce',name:'Razor Edge',t:'Blades pierce 5 enemies and fly 50% farther'},
     {k:'fanBleed',name:'Serrated',t:'Blades always make enemies Bleed'}],
    [{k:'banWar',name:'War Banner',t:'Twice the damage bonus, but no Life regeneration'},
     {k:'banHeal',name:'Healing Banner',t:'5% Life a second instead of 2%, but half the damage bonus'},
     {k:'banFury',name:'Rally Point',t:'Near it you gain 8 Fury a second and take 20% less damage'}],
    [{k:'seisWide',name:'Twin Waves',t:'Two lines in a V, each 30% weaker'},
     {k:'seisLong',name:'Long Wave',t:'10 quakes instead of 6'},
     {k:'seisMagma',name:'Magma Wake',t:'Each quake leaves burning ground for 3s'}]],
  arcanist:[
    [{k:'shardFive',name:'Shard Spray',t:'5 shards instead of 3, each 20% weaker'},
     {k:'shardFrost',name:'Frostbite',t:'Chills twice as hard and for longer, so enemies freeze sooner'},
     {k:'shardSplit',name:'Shatter',t:'A shard that hits a Chilled enemy bursts for half its damage around it'}],
    [{k:'wallLong',name:'Inferno',t:'8 patches instead of 5: a longer wall'},
     {k:'wallRing',name:'Ring of Fire',t:'A ring of fire around you instead of a line'},
     {k:'wallHot',name:'Searing',t:'Burns for 40% more damage'}],
    [{k:'barBig',name:'Glacial Wall',t:'The shield is 50% bigger'},
     {k:'barNova',name:'Frost Burst',t:'The burst Freezes for 1.5s instead of Chilling and hits 50% harder'},
     {k:'barMana',name:'Arcane Ward',t:'While shielded you regain 4% of your Mana a second'}],
    [{k:'orbFast',name:'Ball Lightning',t:'Twice as fast and zaps 5 enemies at a time, but lasts 3s'},
     {k:'orbStill',name:'Tempest Anchor',t:'Stays where you aim it and zaps 50% more often'},
     {k:'orbNova',name:'Overcharged',t:'Ends with a lightning burst for 3 zaps\' damage around it'}],
    [{k:'holeBig',name:'Event Horizon',t:'Pulls from 40% farther and lasts 1s longer'},
     {k:'holeQuick',name:'Singularity',t:'Lasts only 1s, but collapses for 60% more'},
     {k:'holeFire',name:'Nova Star',t:'The collapse leaves burning ground for 3s'}]],
  ranger:[ // v1.0.130
    [{k:'psTwin',name:'Twin Shot',t:'Two heavy arrows side by side, 65% damage each'},
     {k:'psBleed',name:'Serrated Shot',t:'Always makes enemies Bleed'},
     {k:'psMount',name:'Mounting Power',t:'Each enemy it passes through makes it 15% stronger for the next, up to +75%'}],
    [{k:'vtFar',name:'Long Vault',t:'Flip 50% farther'},
     {k:'vtShot',name:'Parting Shot',t:'When you land, loose a fan of 5 arrows at the nearest enemy, 50% damage each'},
     {k:'vtField',name:'Spiked Field',t:'Caltrops last twice as long, cover 50% more and hit 50% harder'}],
    [{k:'ftWild',name:'Wildfire',t:'The burning ground covers 50% more and lasts 6s'},
     {k:'ftSear',name:'Searing Trap',t:'Fire Trap and its burning ground always Ignite'},
     {k:'ftQuick',name:'Quick Fuse',t:'Arms at once and the cooldown is halved, but 25% less damage'}],
    [{k:'hkTalon',name:'Razor Talons',t:'Dives hit 40% harder and make enemies Bleed'},
     {k:'hkSwift',name:'Swift Wings',t:'Dives twice as often'},
     {k:'hkPrey',name:"Hunter's Mark",t:'The Mark is 50% stronger and lasts twice as long'}],
    [{k:'exQuick',name:'Short Fuse',t:'Explodes after 0.4s instead of 1.2s'},
     {k:'exCluster',name:'Cluster Bomb',t:'The blast scatters 3 small bombs that explode for 40% damage each'},
     {k:'exPayload',name:'Payload',t:'50% wider blast and 25% more damage, but the cooldown is 3s longer'}]]};
const altOf=(cls,i)=>(SKILL_ALTS[cls]||[])[i]||null;
// A hit from button i's FIRST skill (for uniques and rules made for it; G.sk is the button the hit comes from).
const firstSk=i=>G.sk===i&&!altOn(G.char,i);
const altOn=(c,i)=>!!(c&&Array.isArray(c.alt)&&c.alt[i]&&altOf(c.cls,i)&&!altOf(c.cls,i).soon);
const skillAt=(c,i)=>altOn(c,i)?altOf(c.cls,i):SKILLS[c.cls][i];
// The name on button i for class cls: the current hero's choice when it is that class, else the first skill.
const skName=(cls,i)=>{const c=G.char;return (c&&c.cls===cls?skillAt(c,i):SKILLS[cls][i]).name;};
// v15: five entries, 0 or 1; a second skill that isn't ready (soon) falls back to the first.
function fixAlts(c){const a=Array.isArray(c.alt)?c.alt:[];c.alt=[0,1,2,3,4].map(i=>a[i]&&altOf(c.cls,i)&&!altOf(c.cls,i).soon?1:0);return c.alt;}
// Swap button i (the ✨ screen). Returns false when its second skill isn't ready.
function pickAlt(c,i){const A=altOf(c.cls,i);if(!A)return false;if(A.soon){toast(A.name,'Coming in a later update');return false;}
  fixAlts(c);c.alt[i]=c.alt[i]?0:1;if(G.char===c&&G.p){refreshStats();G.p.cd[i]=skillCd(i);G.p.cdMax[i]=G.p.cd[i];buildSkillBar();saveChar();}
  toast(skillAt(c,i).name,'is on this button now');return true;}
// The swap line under each skill on the ✨ screen.
function altRowHtml(c,i){const A=altOf(c.cls,i);if(!A)return '';const on=altOn(c,i),other=on?SKILLS[c.cls][i]:A;
  return `<div class="altrow"><div class="btn sm${A.soon?' dis':''}" data-alt="${i}">⇄ ${other.icon} ${esc(other.name)}</div><span class="fdim">${A.soon?'coming soon · ':''}${esc(on?'back to your first skill':A.desc(1))}</span></div>`;}
// ---------- Warden: the moving parts ----------
// Charge (game.js update, instead of walking): fast dash, each enemy touched is hit once.
function chargeTick(p,dt){const C=p.charge;C.t+=dt;moveEnt(p,Math.cos(C.a)*1050*dt,Math.sin(C.a)*1050*dt);p.face=C.a;
  if(fr(0,1)<0.8)part(p.x+fr(-8,8),p.y+p.r*0.6,-Math.cos(C.a)*80,-20,0.35,'#c8b090',3);
  G.sk=C.sk;for(const e of G.enemies){if(e.dead||e.hidden||C.hit.includes(e))continue;if(dist(e,p)<p.r+e.r+12){C.hit.push(e);hitEnemy(e,C.mult,{kb:90,stun:C.stun});}}
  if(C.t>=C.dur){p.charge=null;G.shake=Math.max(G.shake,5);G.fx.push({type:'ring',x:p.x,y:p.y,r0:8,r1:60,t:0,max:0.25,col:'#ffcc88'});
    if(hasMod('chargeQuake')){aoe(p.x,p.y,110,C.mult*1.25,{stun:0.5});fxCracks(p.x,p.y,110);G.shake=Math.max(G.shake,9);} // Trample
    if(hasMod('chargeGuard'))p.chargeGuardT=3;} // Bull's Hide (skillmods.js modTakenMul)
  G.sk=null;}
// Battle Banner: G.banner {x, y, t, amt, regen}; p.bannerOn = its damage bonus while you are near (game.js rollDmg).
const BANNER_R=180;
function bannerTick(p,dt){if(p.chargeGuardT>0)p.chargeGuardT-=dt;const B=G.banner;p.bannerOn=0;if(!B)return;B.t-=dt;if(B.t<=0||G.inTown){G.banner=null;return;}
  if(Math.hypot(p.x-B.x,p.y-B.y)<BANNER_R&&!p.dead){p.bannerOn=B.amt;if(B.regen)healPlayer(G.stats.life*B.regen*dt,true);if(hasMod('banFury'))gainRes(8*dt);}
  B.fx-=dt;if(B.fx<=0){B.fx=1;G.fx.push({type:'ring',x:B.x,y:B.y,r0:BANNER_R-20,r1:BANNER_R,t:0,max:0.6,col:p.bannerOn?'#ffcc55':'#a08040'});}
  if(fr(0,1)<dt*10)part(B.x+fr(-4,4),B.y-fr(10,40),0,-30,0.5,'#ffcc55',2);}
// ---------- Arcanist: the moving parts (G.skz, ticked in game.js update, cleared with the area) ----------
const HOLE_R=230;
function skzTick(p,dt){if(!G.skz||!G.skz.length)return;
  for(const z of G.skz){z.t-=dt;G.sk=z.sk;
    if(z.k==='barrier'){if(z.mana&&p.barrier>0)gainRes(G.stats.res*0.04*dt);
      if(!(p.barrier>0)||z.t<=0){z.t=0;aoe(p.x,p.y,150,z.m,z.freeze?{freeze:1.5}:{chill:2.5});G.fx.push({type:'ring',x:p.x,y:p.y,r0:10,r1:155,t:0,max:0.4,col:'#9fe4ff'});burst(p.x,p.y,24,'#bff0ff',220);}}
    else if(z.k==='orb'){z.x+=z.vx*dt;z.y+=z.vy*dt;if(blockedAt(z.x,z.y,8)){z.vx=0;z.vy=0;}
      if(fr(0,1)<0.9)part(z.x+fr(-6,6),z.y+fr(-6,6),fr(-30,30),fr(-30,30),0.25,'#a0d0ff',4);
      z.zap-=dt;if(z.zap<=0){z.zap=z.every||1/3;const hit=new Set();for(let k=0;k<(z.n||3);k++){const e=nearest(z.x,z.y,150,hit);if(!e)break;hit.add(e);hitEnemy(e,z.m,{});G.fx.push({type:'bolt',pts:[{x:z.x,y:z.y},{x:e.x,y:e.y}],t:0,max:0.15});}}
      if(z.t<=0&&z.nova){aoe(z.x,z.y,140,z.m*3,{});fxExplosion(z.x,z.y,140,'#9fd8ff');}}
    else if(z.k==='hole'){const R=z.R||HOLE_R;pullTo(z.x,z.y,R,140*dt);z.tick-=dt;if(fr(0,1)<0.8)part(z.x+fr(-90,90),z.y+fr(-90,90),0,0,0.3,'#a06aff',3);
      if(z.tick<=0&&z.t>0){z.tick=0.5;aoe(z.x,z.y,110,z.m,{quiet:true});}
      if(z.t<=0){aoe(z.x,z.y,150,z.end,{});fxExplosion(z.x,z.y,150,'#a06aff');G.shake=Math.max(G.shake,10);if(z.fire)G.hazards.push({sk:z.sk,x:z.x,y:z.y,r:120,t:3,tick:0,mult:z.fm});}}
    else if(typeof RZ!=='undefined'&&RZ[z.k])RZ[z.k](z,p,dt); // ranger.js: Spike Trap, Fire Trap, Rain of Arrows, caltrops, Explosive Arrow
    G.sk=null;}
  G.skz=G.skz.filter(z=>z.t>0);}
// Pull enemies toward a point (heavy ones and bosses less), like uniques.js pullIn.
function pullTo(x,y,r,step){for(const e of G.enemies){if(e.dead||e.hidden)continue;const d=Math.hypot(e.x-x,e.y-y);if(d>r||d<12)continue;
  const k=e.type==='boss'||e.zb?0.2:ETYPES[e.type].heavy?0.5:1,m=Math.min(step*k,d-10),a=Math.atan2(y-e.y,x-e.x);moveEnt(e,Math.cos(a)*m,Math.sin(a)*m);}}
