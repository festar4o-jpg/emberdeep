'use strict';
// Music: recorded tracks (art/music/, see TRK below) when they have downloaded; until then, dark ambient generated live with WebAudio.
// The synth: Each act has a mood (MOODS): a key and scale,
// a breathing drone, slow pad chords, sparse distant bells (lute-like plucks in town), and a texture: wind, drips,
// embers crackling, ice. Towns play their act's key in a warmer mode with a hearth crackle. A boss fight adds a
// war-drum pulse and trembling strings, which fade once the fight is over. Changing area crossfades over ~4 s.
// Phone speakers can't play deep bass, so the drone sits an octave or two above each key's root; a sub-bass voice
// is only there for headphones. Settings: Sound on/off mutes everything; Music and Effects have their own volume.
// Runs from the main loop (musicTick); does nothing until the first tap has started the audio context (sfx.js audio).
// Cosmetic randomness only (fx.js fxRnd): music never shifts gameplay rolls.
// root: key (Hz) · scale: semitones · cut: drone filter · dwave/pwave: drone and pad waves · lead: bell/pluck/glass ·
// tex: texture · chord/lead: seconds between chords and lead notes · prog: scale degrees chords are built on · wet: reverb.
const MOODS={
  crypt: {root:73.42,scale:[0,1,3,5,7,8,10],cut:460,dwave:'sawtooth',pwave:'triangle',lead:'bell',tex:'wind',texF:360,chord:[9,13],leadT:[5,11],prog:[0,0,5,3,6,1],wet:0.7},
  desert:{root:82.41,scale:[0,1,4,5,7,8,10],cut:620,dwave:'sawtooth',pwave:'triangle',lead:'bell',tex:'wind',texF:900,chord:[10,14],leadT:[4,9],prog:[0,1,0,6,3],wet:0.55},
  marsh: {root:65.41,scale:[0,2,3,5,7,8,10],cut:400,dwave:'triangle',pwave:'sine',lead:'bell',tex:'drip',chord:[10,14],leadT:[6,12],prog:[0,5,3,0,6],wet:0.75},
  frost: {root:69.3,scale:[0,2,3,5,7,9,10],cut:520,dwave:'triangle',pwave:'sine',lead:'glass',tex:'ice',texF:3000,chord:[11,15],leadT:[3,7],prog:[0,3,5,4,0],wet:0.85},
  ember: {root:61.74,scale:[0,1,3,5,6,8,10],cut:560,dwave:'sawtooth',pwave:'sawtooth',lead:'bell',tex:'crackle',texF:220,chord:[8,12],leadT:[6,12],prog:[0,1,4,0,5],wet:0.55},
  town:  {scale:[0,2,3,5,7,9,10],cut:850,dwave:'triangle',pwave:'triangle',lead:'pluck',tex:'hearth',chord:[8,11],leadT:[3,7],prog:[0,3,4,0,5,3],wet:0.5}
};
const ACT_MOOD=['crypt','desert','marsh','frost','ember'];
// What should be playing now: 'title', 'town<act>' or 'act<act>'.
function musKey(){if(!G.char)return 'title';const a=Math.min(4,Math.max(0,actIdx(G.depth||1)));return (G.inTown?'town':'act')+a;}
function moodOf(key){if(key==='title')return Object.assign({},MOODS.crypt,{vol:0.7});const a=+key.slice(-1),M=MOODS[ACT_MOOD[a]];
  return key.startsWith('town')?Object.assign({},MOODS.town,{root:M.root,vol:0.85}):Object.assign({vol:1},M);}
const semiOf=(sc,i)=>{const n=sc.length,o=Math.floor(i/n);return sc[((i%n)+n)%n]+12*o;};
const noteHz=(m,deg,oct)=>m.root*Math.pow(2,oct+semiOf(m.scale,deg)/12);
const pickF=arr=>arr[Math.floor(fxRnd()*arr.length)];
let MZ=null; // the music graph: {a, out, rev, dly, layer, boss, key, next}
const musNow=()=>MZ; // (tests: MZ is a let)
function impulse(a,sec){const n=Math.floor(a.sampleRate*sec),b=a.createBuffer(2,n,a.sampleRate);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(fxRnd()*2-1)*Math.pow(1-i/n,2.8);}return b;}
function musGraph(a){if(MZ&&MZ.a===a)return MZ;
  const out=a.createGain();out.gain.value=0;out.connect(a.destination);
  const rev=a.createConvolver();rev.buffer=impulse(a,3.2);const rg=a.createGain();rg.gain.value=0.55;rev.connect(rg);rg.connect(out);
  // a soft echo for bells and drips (its repeats darken and also go into the reverb)
  const dly=a.createDelay(2),fb=a.createGain(),dlp=a.createBiquadFilter();dly.delayTime.value=0.62;fb.gain.value=0.38;dlp.type='lowpass';dlp.frequency.value=1800;
  dly.connect(dlp);dlp.connect(fb);fb.connect(dly);dlp.connect(out);dlp.connect(rev);
  MZ={a,out,rev,dly,layer:null,boss:null,key:null,next:{chord:0,lead:0,tex:0},vol:-1,bossOff:0};return MZ;}
const fadeIn=(g,t,to,sec)=>{g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(to,t+sec);};
function fadeOut(g,t,sec){g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(Math.max(0.0001,g.gain.value||0.0001),t);g.gain.exponentialRampToValueAtTime(0.0001,t+sec);}
// ---------- an area's layer: drone, filter, texture bed ----------
function startLayer(Z,key){const a=Z.a,m=moodOf(key),t=a.currentTime,g=a.createGain();fadeIn(g,t,m.vol,4);g.connect(Z.out);
  const send=a.createGain();send.gain.value=m.wet;g.connect(send);send.connect(Z.rev);
  const f=a.createBiquadFilter();f.type='lowpass';f.frequency.value=m.cut;f.Q.value=0.8;f.connect(g);
  const lfo=a.createOscillator(),lg=a.createGain();lfo.frequency.value=0.04+fxRnd()*0.04;lg.gain.value=m.cut*0.45;lfo.connect(lg);lg.connect(f.frequency);lfo.start(t);
  const srcs=[lfo];
  // drone: two detuned voices an octave up, the fifth above, a quiet sub for headphones
  for(const [mul,det,vol,w] of [[2,-7,0.08,m.dwave],[2,6,0.08,m.dwave],[3,0,0.035,m.dwave],[4,3,0.02,'sine'],[1,0,0.09,'sine']]){
    const o=a.createOscillator(),og=a.createGain();o.type=w;o.frequency.value=m.root*mul;o.detune.value=det;og.gain.value=vol;o.connect(og);og.connect(f);o.start(t);srcs.push(o);}
  // texture bed: filtered noise (wind, ice hiss, the low roar under embers); drips and hearths have none
  let tex=null;if(m.tex==='wind'||m.tex==='ice'||m.tex==='crackle'){const s=a.createBufferSource(),bf=a.createBiquadFilter(),tg=a.createGain();s.buffer=NOISE;s.loop=true;
    bf.type=m.tex==='ice'?'highpass':'bandpass';bf.frequency.value=m.texF;bf.Q.value=m.tex==='ice'?0.5:0.9;tg.gain.value=m.tex==='ice'?0.012:0.03;
    s.connect(bf);bf.connect(tg);tg.connect(g);s.start(t);srcs.push(s);tex={bf,tg};}
  return {key,m,g,f,srcs,tex,a};}
function stopLayer(L,sec=3.5){const t=L.a.currentTime;fadeOut(L.g,t,sec);for(const s of L.srcs)try{s.stop(t+sec+0.1);}catch(e){}}
// ---------- events: chords, lead notes, texture ----------
function padChord(L,t){const m=L.m,a=L.a,deg=pickF(m.prog),dur=fr(10,14);
  for(const st of [0,2,4])for(const det of [-5,5]){const o=a.createOscillator(),g=a.createGain();o.type=m.pwave;o.frequency.value=noteHz(m,deg+st,2);o.detune.value=det+fr(-3,3);
    const v=m.pwave==='sawtooth'?0.009:0.02;g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+dur*0.4);g.gain.linearRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(L.f);o.start(t);o.stop(t+dur+0.1);}}
function bell(Z,L,t,f,vol,dec){const a=Z.a;for(const [mul,v] of [[1,1],[2.76,0.35],[5.4,0.12]]){const o=a.createOscillator(),g=a.createGain();o.frequency.value=f*mul;
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol*v,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+dec/mul**0.5);o.connect(g);g.connect(L.g);g.connect(Z.dly);o.start(t);o.stop(t+dec+0.1);}}
function pluck(Z,L,t,f,vol){const a=Z.a,o=a.createOscillator(),lp=a.createBiquadFilter(),g=a.createGain();o.type='triangle';o.frequency.value=f;lp.type='lowpass';
  lp.frequency.setValueAtTime(f*6,t);lp.frequency.exponentialRampToValueAtTime(f*1.2,t+0.6);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.005);
  g.gain.exponentialRampToValueAtTime(0.0001,t+1.4);o.connect(lp);lp.connect(g);g.connect(L.g);g.connect(Z.dly);o.start(t);o.stop(t+1.5);}
function leadNote(Z,L,t){const m=L.m;
  if(m.lead==='pluck'){let d=pickF([0,2,4,7]);const n=2+Math.floor(fxRnd()*3);for(let k=0;k<n;k++){pluck(Z,L,t+k*fr(0.32,0.45),noteHz(m,d,3),0.05);d+=pickF([-1,1,1,2,-2]);}return;}
  if(m.lead==='glass'){bell(Z,L,t,noteHz(m,pickF([0,2,4,6,7,9]),4),0.018,3);return;}
  bell(Z,L,t,noteHz(m,pickF([0,2,4,5,7]),fxRnd()<0.7?3:2),0.03,4.5);}
function texEvent(Z,L,t){const a=Z.a,m=L.m;
  if(m.tex==='drip'){const f=fr(900,2300),o=a.createOscillator(),g=a.createGain();o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*0.55,t+0.08);
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.025,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);o.connect(g);g.connect(L.g);g.connect(Z.dly);o.start(t);o.stop(t+0.2);return fr(0.7,3.2);}
  if(m.tex==='crackle'||m.tex==='hearth'){const s=a.createBufferSource(),hp=a.createBiquadFilter(),g=a.createGain();s.buffer=NOISE;hp.type='highpass';hp.frequency.value=fr(1500,4000);
    const v=m.tex==='hearth'?0.02:0.03;g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(v,t+0.002);g.gain.exponentialRampToValueAtTime(0.0001,t+fr(0.01,0.04));
    s.connect(hp);hp.connect(g);g.connect(L.g);s.start(t,fxRnd()*0.5);s.stop(t+0.06);return fxRnd()<0.3?fr(0.03,0.09):fr(0.15,0.9);}
  if(L.tex){const T=L.tex,f=m.texF*fr(0.6,1.7),dur=fr(2.5,5);T.bf.frequency.linearRampToValueAtTime(f,t+dur);T.tg.gain.linearRampToValueAtTime((m.tex==='ice'?0.012:0.03)*fr(0.4,1.4),t+dur);
    if(m.tex==='ice'&&fxRnd()<0.35)bell(Z,L,t,fr(2600,4200),0.008,1.2);return dur;}
  return 5;}
// ---------- a boss fight: war drums and trembling strings ----------
function startBoss(Z,m){const a=Z.a,t=a.currentTime,g=a.createGain();fadeIn(g,t,1,2.5);g.connect(Z.out);const send=a.createGain();send.gain.value=0.35;g.connect(send);send.connect(Z.rev);
  const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1200;const sg=a.createGain();sg.gain.value=0.5;lp.connect(sg);sg.connect(g);
  const trem=a.createOscillator(),tg=a.createGain();trem.frequency.value=7;tg.gain.value=0.45;trem.connect(tg);tg.connect(sg.gain);trem.start(t);const srcs=[trem];
  for(const [deg,det] of [[0,-6],[0,6],[4,0],[2,-3]]){const o=a.createOscillator(),og=a.createGain();o.type='sawtooth';o.frequency.value=noteHz(m,deg,2);o.detune.value=det;og.gain.value=0.012;o.connect(og);og.connect(lp);o.start(t);srcs.push(o);}
  return {g,srcs,beat:t+0.3,n:0,a};}
function bossBeat(Z,B,t){const a=Z.a,hit=(at,f,v)=>{const o=a.createOscillator(),g=a.createGain();o.frequency.setValueAtTime(f,at);o.frequency.exponentialRampToValueAtTime(f*0.4,at+0.28);
    g.gain.setValueAtTime(0.0001,at);g.gain.exponentialRampToValueAtTime(v,at+0.006);g.gain.exponentialRampToValueAtTime(0.0001,at+0.4);o.connect(g);g.connect(B.g);o.start(at);o.stop(at+0.45);
    const s=a.createBufferSource(),lp=a.createBiquadFilter(),ng=a.createGain();s.buffer=NOISE;lp.type='lowpass';lp.frequency.value=700;ng.gain.setValueAtTime(0.0001,at);
    ng.gain.exponentialRampToValueAtTime(v*0.35,at+0.004);ng.gain.exponentialRampToValueAtTime(0.0001,at+0.15);s.connect(lp);lp.connect(ng);ng.connect(B.g);s.start(at,fxRnd()*0.5);s.stop(at+0.2);};
  const k=B.n%8;if(k===0||k===3||k===4||k===6)hit(t,k===0?120:150,k===0?0.3:0.2);if(k===7)hit(t+0.2,170,0.12);B.n++;}
// ---------- recorded tracks (art/music/, packed by tools/music/build.sh; credits art/music/CREDITS.txt) ----------
// Each act has its track, every town shares one, a boss fight switches to the boss track (from its start). A track is
// downloaded whole the first time it is wanted (a plain fetch, so the service worker keeps it for offline play); until it
// is ready, or when it can't load, the synth above plays. Changing track crossfades over ~3 s.
let TRK=null; // {idx: music.json ({slot: hash}) | null while loading | false, got: {slot: {au, g} | 'loading' | 'failed'}}
const TRK_VOL=1.79; // with out at musVol*0.6: right at the default 70% (user ear tests v1.0.166), the last 30% for extra loudness
const trkSlot=(key,fight)=>fight?'boss':key==='title'?'title':key.startsWith('town')?'town':'act'+key.slice(-1);
function trkGet(Z,slot){const a=Z.a;if(typeof fetch!=='function'||typeof Audio!=='function'||typeof URL==='undefined'||!a.createMediaElementSource)return null;
  if(!TRK){TRK={idx:null,got:{}};fetch('art/music/music.json').then(r=>r.json()).then(j=>{TRK.idx=j;}).catch(()=>{TRK.idx=false;setTimeout(()=>{TRK=null;},30000);});}
  const idx=TRK.idx,g=TRK.got[slot];if(!idx||!idx[slot])return null;if(g)return typeof g==='object'?g:null;
  TRK.got[slot]='loading';const T=TRK;
  fetch('art/music/'+slot+'.ogg?v='+idx[slot]).then(r=>{if(!r.ok)throw new Error('music '+slot);return r.blob();}).then(b=>{
    const au=new Audio(URL.createObjectURL(b)),g=a.createGain();au.loop=true;g.gain.value=0.0001;a.createMediaElementSource(au).connect(g);g.connect(Z.out);T.got[slot]={au,g};})
    .catch(()=>{T.got[slot]='failed';setTimeout(()=>{if(T.got[slot]==='failed')delete T.got[slot];},30000);}); // try again later
  return null;}
function trkPlay(Z,slot,T){if(Z.trk===slot)return;trkStop(Z);Z.trk=slot;Z.trkOn=T;const t=Z.a.currentTime;
  if(slot==='boss')try{T.au.currentTime=0;}catch(e){} // the others carry on where they were
  const p=T.au.play();if(p&&p.catch)p.catch(()=>{});T.g.gain.cancelScheduledValues(t);fadeIn(T.g,t,TRK_VOL,3);}
function trkStop(Z,sec=3){const T=Z.trkOn;if(!T)return;fadeOut(T.g,Z.a.currentTime,sec);Z.trk=null;Z.trkOn=null;
  setTimeout(()=>{if(Z.trkOn!==T)T.au.pause();},sec*1000+200);} // unless it came back in the meantime
// ---------- the main-loop hook ----------
const MUS_BEAT=0.42;
function musicTick(dt){const a=AC;if(!a||a.state!=='running'||!NOISE)return;const Z=musGraph(a),t=a.currentTime;
  const vol=SETTINGS.sound===false?0:SETTINGS.musVol??0.7;
  if(vol!==Z.vol){Z.vol=vol;Z.out.gain.setTargetAtTime(vol*0.6,t,0.3);}
  if(vol<=0){if(Z.layer){stopLayer(Z.layer,0.5);Z.layer=null;Z.key=null;}if(Z.boss){stopLayer(Z.boss,0.5);Z.boss=null;}trkStop(Z,0.5);return;} // muted: stop everything (battery)
  const key=musKey();
  // boss fight: on while a boss is fighting you, off 2 s after it ends (no flicker)
  if(G.char&&G.p&&!G.inTown&&typeof bossFightOn==='function'&&bossFightOn())Z.bossOff=t+2;
  const fight=t<Z.bossOff,slot=trkSlot(key,fight),T=trkGet(Z,slot);
  if(T){trkPlay(Z,slot,T);if(Z.layer){stopLayer(Z.layer);Z.layer=null;Z.key=null;}if(Z.boss){stopLayer(Z.boss,3);Z.boss=null;}return;} // a recorded track: no synth
  trkStop(Z);
  if(key!==Z.key){if(Z.layer)stopLayer(Z.layer);Z.layer=startLayer(Z,key);Z.key=key;Z.next={chord:t+1.5,lead:t+fr(3,6),tex:t+0.5};}
  const L=Z.layer,m=L.m;
  if(t>=Z.next.chord){padChord(L,t+0.05);Z.next.chord=t+fr(m.chord[0],m.chord[1]);}
  if(t>=Z.next.lead){leadNote(Z,L,t+0.05);Z.next.lead=t+fr(m.leadT[0],m.leadT[1])*(Z.boss?2:1);}
  if(t>=Z.next.tex){Z.next.tex=t+texEvent(Z,L,t+0.02);}
  if(fight&&!Z.boss)Z.boss=startBoss(Z,m);
  else if(!fight&&Z.boss){stopLayer(Z.boss,3);Z.boss=null;}
  if(Z.boss){if(Z.boss.beat<t-0.5)Z.boss.beat=t+0.05;while(Z.boss.beat<t+0.25){bossBeat(Z,Z.boss,Z.boss.beat);Z.boss.beat+=MUS_BEAT;}}}
// The app in the background: pause all sound (the battery, and nobody wants a drone from their pocket).
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',()=>{if(!AC)return;const au=MZ&&MZ.trkOn&&MZ.trkOn.au;try{if(document.hidden){AC.suspend();if(au)au.pause();}else{AC.resume();if(au)au.play().catch(()=>{});}}catch(e){}});
