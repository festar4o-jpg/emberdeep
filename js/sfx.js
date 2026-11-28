'use strict';
// Sound with WebAudio: recorded clips where we have them (art/sfx, below playSfx), synthesised for the rest: combat (swings, hits by material, crits,
// kills, blocks, getting hurt, a heartbeat at low life), every skill, potions, level-ups, death, portals, waypoints,
// chests, shrines, gold and item pickups, menu taps, drop chimes and boss cues.
// Browsers only allow audio after a tap, so the audio context is created on the first touch or key press.
// Everything goes through one bus (volume → compressor → speakers); the compressor keeps big fights from clipping.
// Each sound has a minimum gap (GAP) and at most MAX_VOICES sources play at once, so crowds don't turn into noise.
// Settings → Sound turns it all off; Effects volume sets the bus level (music.js has its own).
// Cosmetic randomness only (fx.js fxRnd): sound never shifts gameplay rolls.
let AC=null,BUS=null,NOISE=null,voices=0;
const MAX_VOICES=40;
function audio(){if(AC)return AC;const C=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);if(!C)return null;
  try{AC=new C();const comp=AC.createDynamicsCompressor();comp.threshold.value=-14;comp.knee.value=10;comp.ratio.value=6;comp.attack.value=0.003;comp.release.value=0.2;
    comp.connect(AC.destination);BUS=AC.createGain();BUS.gain.value=0.9;BUS.connect(comp);AC.comp=comp;
    const n=Math.floor(AC.sampleRate*1),buf=AC.createBuffer(1,n,AC.sampleRate),d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=fxRnd()*2-1;NOISE=buf;}
  catch(e){AC=null;}return AC;}
if(typeof addEventListener==='function')for(const ev of ['pointerdown','keydown'])addEventListener(ev,()=>{const a=audio();if(a&&a.state==='suspended')a.resume();},{passive:true});
// A source finished: one voice free again.
const voiceEnd=src=>{voices++;src.onended=()=>{voices--;};};
// One tone: f (Hz) at t0, a quick attack and an exponential decay over dur; to = slide to that pitch; type = wave shape.
function tone(a,f,t0,dur,vol,type,to){const o=a.createOscillator(),g=a.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t0);
  if(to)o.frequency.exponentialRampToValueAtTime(to,t0+dur);
  g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);o.connect(g);g.connect(BUS);voiceEnd(o);o.start(t0);o.stop(t0+dur+0.05);}
// A burst of filtered noise (whooshes, impacts, crackle): filter type ft at f Hz (sliding to fTo), resonance q, rise = attack time.
function noise(a,t0,dur,vol,ft,f,fTo,q,rise){const s=a.createBufferSource(),b=a.createBiquadFilter(),g=a.createGain();s.buffer=NOISE;s.loop=true;
  s.playbackRate.value=0.8+fxRnd()*0.4;b.type=ft||'bandpass';b.frequency.setValueAtTime(f,t0);if(fTo)b.frequency.exponentialRampToValueAtTime(fTo,t0+dur);b.Q.value=q||1;
  g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+(rise||0.006));g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  s.connect(b);b.connect(g);g.connect(BUS);voiceEnd(s);s.start(t0,fxRnd()*0.5);s.stop(t0+dur+0.05);}
const vr=(v,k=0.12)=>v*(1-k+fxRnd()*k*2); // a little pitch variety so repeats don't sound mechanical
// ---------- the sounds ----------
const SFX={
  // drops: rare two bright notes · unique a low gong, then a rising golden arpeggio · set a deep chord with a green call · rune a clink
  rare:(a,t)=>{tone(a,988,t,0.35,0.07,'triangle');tone(a,1480,t+0.09,0.5,0.06,'triangle');},
  unique:(a,t)=>{for(const [f,v,d] of [[98,0.16,2.4],[196,0.14,2.0],[294,0.08,1.7],[392,0.06,1.4],[784,0.035,1.0]])tone(a,f,t,d,v);
    [523,659,784,1047,1319].forEach((f,i)=>tone(a,f,t+0.12+i*0.09,0.9,0.05,'triangle'));tone(a,2093,t+0.6,1.2,0.02);},
  set:(a,t)=>{for(const [f,v,d] of [[117,0.14,2.0],[233,0.12,1.7],[349,0.07,1.4],[466,0.05,1.2]])tone(a,f,t,d,v);
    [466,587,698,932].forEach((f,i)=>tone(a,f,t+0.15+i*0.11,0.8,0.045,'triangle'));tone(a,1397,t+0.6,1,0.02);},
  rune:(a,t)=>{tone(a,1320,t,0.25,0.06,'square');tone(a,1980,t+0.02,0.3,0.04);tone(a,660,t,0.4,0.05);},
  // boss cues: a low warning horn before a big attack, a deep boom at a phase change, a crack on a stagger
  warn:(a,t)=>{tone(a,98,t,0.9,0.1,'sawtooth');tone(a,147,t+0.05,0.8,0.05,'sawtooth');tone(a,196,t+0.1,0.6,0.03);},
  phase:(a,t)=>{tone(a,55,t,1.4,0.2);tone(a,82,t,1.1,0.1);tone(a,330,t,0.5,0.03,'triangle');noise(a,t,1.2,0.12,'lowpass',300,60);},
  stagger:(a,t)=>{tone(a,420,t,0.15,0.08,'square');tone(a,210,t+0.02,0.35,0.07,'triangle');tone(a,840,t,0.12,0.03,'square');},
  // attacks: a whoosh by weapon style (heavy two-handers lower and longer, stabs short and thin)
  swing:(a,t)=>noise(a,t,0.17,0.13,'bandpass',vr(700),vr(2200),1.4,0.05),
  heavy:(a,t)=>{noise(a,t,0.3,0.16,'bandpass',vr(300),vr(1100),1.2,0.09);tone(a,90,t+0.05,0.2,0.04,'sine',55);},
  stab:(a,t)=>noise(a,t,0.09,0.1,'highpass',vr(2200),vr(4000),1,0.02),
  // hits, by what was struck (fx.js MAT): flesh a wet thud, bone a dry clack, armour a clank, ice a tinkle, magma a hiss
  flesh:(a,t)=>{noise(a,t,0.09,0.2,'lowpass',vr(1100),300,1);tone(a,vr(130),t,0.09,0.11,'sine',60);},
  bone:(a,t)=>{noise(a,t,0.06,0.16,'bandpass',vr(2400),1600,4);tone(a,vr(850),t,0.05,0.05,'triangle',500);},
  armor:(a,t)=>{tone(a,vr(1850),t,0.2,0.05,'triangle');tone(a,vr(2750),t,0.14,0.03,'square');noise(a,t,0.05,0.12,'highpass',2500);tone(a,140,t,0.07,0.07,'sine',70);},
  ice:(a,t)=>{tone(a,vr(2640),t,0.22,0.04);tone(a,vr(3520),t+0.02,0.18,0.03);noise(a,t,0.08,0.12,'highpass',4000);},
  chitin:(a,t)=>{noise(a,t,0.05,0.2,'bandpass',vr(1800),900,3);tone(a,vr(400),t,0.05,0.05,'square',200);},
  sap:(a,t)=>{noise(a,t,0.12,0.18,'lowpass',vr(900),200,3);tone(a,vr(200),t,0.1,0.06,'sine',90);},
  magma:(a,t)=>{noise(a,t,0.1,0.18,'lowpass',600,200,1);noise(a,t+0.03,0.3,0.06,'highpass',3500,6000,1,0.03);},
  crit:(a,t)=>{noise(a,t,0.08,0.22,'bandpass',vr(1300),500,1);tone(a,vr(240),t,0.12,0.09,'square',90);tone(a,60,t,0.18,0.12,'sine',40);},
  kill:(a,t)=>{noise(a,t,0.22,0.14,'lowpass',vr(500),120,1,0.01);tone(a,vr(90),t,0.2,0.07,'sine',45);},
  shatter:(a,t)=>{for(let k=0;k<4;k++)noise(a,t+k*0.035,0.05,0.12,'bandpass',vr(2200,0.3),1200,5);},
  bossdie:(a,t)=>{noise(a,t,2.2,0.3,'lowpass',900,50,1,0.02);tone(a,70,t,2.2,0.22,'sine',30);tone(a,140,t,1.4,0.08,'sawtooth',40);},
  // you: blocked, hurt, a heartbeat at low life, dodge, blink, death
  block:(a,t)=>{tone(a,vr(1400),t,0.3,0.06,'triangle');tone(a,vr(2100),t,0.25,0.04,'triangle');noise(a,t,0.06,0.15,'highpass',3000);},
  hurt:(a,t)=>{noise(a,t,0.1,0.16,'lowpass',700,200,1);tone(a,vr(190),t,0.16,0.07,'sawtooth',85);},
  heart:(a,t)=>{tone(a,58,t,0.13,0.28,'sine',40);tone(a,52,t+0.2,0.16,0.2,'sine',36);},
  dodge:(a,t)=>noise(a,t,0.22,0.12,'bandpass',500,1800,1.2,0.04),
  blink:(a,t)=>{tone(a,1600,t,0.16,0.06,'sine',300);noise(a,t,0.12,0.06,'highpass',3000,8000,1);},
  death:(a,t)=>{tone(a,220,t,1.6,0.12,'sawtooth',50);tone(a,110,t,1.8,0.12,'sine',40);noise(a,t,1.2,0.12,'lowpass',500,60,1,0.05);},
  // Warden skills
  cleave:(a,t)=>{noise(a,t,0.2,0.15,'bandpass',vr(600),vr(2400),1.3,0.05);},
  leap:(a,t)=>{noise(a,t,0.4,0.12,'bandpass',300,1500,1,0.15);tone(a,140,t,0.35,0.04,'sine',280);},
  whirl:(a,t)=>{for(let k=0;k<4;k++)noise(a,t+k*0.12,0.16,0.1,'bandpass',vr(700),vr(2000),1.5,0.05);},
  warcry:(a,t)=>{tone(a,150,t,0.7,0.1,'sawtooth',220);tone(a,225,t,0.6,0.05,'sawtooth',330);noise(a,t,0.6,0.12,'bandpass',600,900,0.8,0.05);},
  slam:(a,t)=>{noise(a,t,0.7,0.3,'lowpass',600,60,1,0.01);tone(a,60,t,0.6,0.25,'sine',30);noise(a,t+0.05,0.5,0.08,'bandpass',1500,500,2);},
  // Arcanist skills
  // v1.0.127: the Ranger: a bow's twang, a trap snapping shut, the wolf's howl and bite
  twang:(a,t)=>{tone(a,vr(220),t,0.14,0.07,'triangle',140);tone(a,vr(440),t,0.06,0.03,'square',300);noise(a,t,0.08,0.06,'highpass',vr(2500),3000,0.7,0.002);},
  snap:(a,t)=>{noise(a,t,0.12,0.16,'bandpass',vr(1800),600,2,0.002);tone(a,110,t,0.18,0.1,'square',60);},
  howl:(a,t)=>{tone(a,320,t,0.9,0.06,'sine',560);tone(a,640,t+0.25,0.6,0.025,'sine',420);noise(a,t,0.5,0.03,'bandpass',900,1200,3,0.2);},
  screech:(a,t)=>{tone(a,vr(1900),t,0.32,0.035,'sawtooth',1200);tone(a,vr(2400),t+0.05,0.2,0.015,'sine',1500);},
  bite:(a,t)=>{noise(a,t,0.07,0.07,'lowpass',vr(900),400,1,0.002);tone(a,vr(160),t,0.06,0.04,'square',90);},
  bolt:(a,t)=>{tone(a,vr(900),t,0.16,0.06,'sine',450);tone(a,vr(1350),t,0.1,0.03,'triangle',700);},
  fireball:(a,t)=>{noise(a,t,0.4,0.16,'lowpass',400,1800,1,0.08);tone(a,110,t,0.3,0.05,'sawtooth',70);},
  nova:(a,t)=>{noise(a,t,0.6,0.12,'highpass',2500,6000,1,0.02);[1568,2093,2637].forEach((f,i)=>tone(a,f,t+i*0.03,0.5,0.035));tone(a,200,t,0.3,0.06,'sine',90);},
  chain:(a,t)=>{for(let k=0;k<5;k++){noise(a,t+k*0.045,0.05,0.14,'bandpass',vr(3000,0.3),1500,3);}tone(a,1200,t,0.25,0.04,'sawtooth',200);},
  meteor:(a,t)=>{tone(a,1800,t,0.7,0.05,'sine',260);noise(a,t,0.7,0.08,'bandpass',2500,400,2,0.3);},
  boom:(a,t)=>{noise(a,t,0.6,0.28,'lowpass',800,70,1,0.01);tone(a,vr(80),t,0.5,0.2,'sine',35);},
  // things in the world
  potion:(a,t)=>{for(let k=0;k<4;k++)tone(a,vr(380+k*130,0.2),t+k*0.06,0.07,0.06,'sine',vr(700+k*150,0.2));tone(a,180,t+0.28,0.18,0.06,'sine',120);},
  levelup:(a,t)=>{[523,659,784,1047,1319].forEach((f,i)=>tone(a,f,t+i*0.08,0.7,0.06,'triangle'));tone(a,2093,t+0.45,1,0.03);noise(a,t+0.3,0.8,0.03,'highpass',6000,9000,1,0.2);},
  tpcast:(a,t)=>{tone(a,300,t,1,0.05,'sine',900);tone(a,450,t,1,0.03,'triangle',1350);},
  portal:(a,t)=>{noise(a,t,0.7,0.16,'bandpass',400,2600,2,0.2);tone(a,600,t,0.7,0.05,'sine',1200);tone(a,150,t,0.6,0.08,'sine',75);},
  waypoint:(a,t)=>{tone(a,659,t,1.3,0.06);tone(a,988,t+0.12,1.2,0.05);tone(a,1319,t+0.24,1,0.03);},
  chest:(a,t)=>{tone(a,90,t,0.3,0.07,'sawtooth',140);noise(a,t,0.25,0.06,'bandpass',400,700,3,0.1);tone(a,2637,t+0.3,0.12,0.04,'triangle');tone(a,3136,t+0.38,0.12,0.04,'triangle');tone(a,2349,t+0.45,0.12,0.03,'triangle');},
  shrine:(a,t)=>{tone(a,392,t,1.2,0.06);tone(a,587,t+0.05,1.1,0.05);tone(a,784,t+0.1,1,0.04,'triangle');noise(a,t,0.8,0.04,'highpass',5000,9000,1,0.3);},
  gold:(a,t)=>{tone(a,vr(2637,0.05),t,0.09,0.05,'triangle');tone(a,vr(3136,0.05),t+0.05,0.12,0.04,'triangle');},
  pickup:(a,t)=>noise(a,t,0.07,0.1,'bandpass',vr(1100),600,2),
  click:(a,t)=>tone(a,vr(1300,0.05),t,0.035,0.035,'triangle',900)
};
// Minimum seconds between two plays of the same sound (anything not listed: 0.06).
const GAP={swing:0.05,heavy:0.08,stab:0.05,flesh:0.045,bone:0.045,armor:0.06,ice:0.05,chitin:0.045,sap:0.05,magma:0.06,crit:0.06,kill:0.05,shatter:0.08,hurt:0.12,
  heart:0.5,gold:0.09,pickup:0.05,click:0.04,warn:0.3,levelup:0.5,unique:0.5,set:0.5};
// Sounds that may cut in even when the voice limit is reached.
const SFX_MUST=new Set(['unique','set','rare','rune','warn','phase','levelup','death','bossdie','portal']);
// Recorded sounds (CC0, art/sfx/: one file holding every clip, packed by tools/sfx/build.sh from tools/sfx/clips.txt).
// A key with clips (flesh1, flesh2...) plays one at random, a little re-pitched; keys without clips, and every key until
// the file has loaded (or when it can't), use the synth above (MIX keys: both). THUMP keys get a low synth thump underneath, for weight.
let SAMP=null;
const THUMP={flesh:0.05,crit:0.16,kill:0.07,slam:0.2,boom:0.18,bossdie:0.25,heavy:0.04,set:0.14,unique:0.2};
const MIX=new Set(['set','unique']); // the recording and the synth play together
function loadSamples(a){SAMP=false;if(typeof fetch!=='function')return;fetch('art/sfx/sfx.json').then(r=>r.json()).then(j=>fetch('art/sfx/sfx.ogg?v='+j.v).then(r=>r.arrayBuffer())
  .then(b=>a.decodeAudioData(b)).then(buf=>{const by={};for(const [n,c] of Object.entries(j.clips))(by[n.replace(/\d+$/,'')]??=[]).push(c);SAMP={buf,by};}))
  .catch(()=>setTimeout(()=>{SAMP=null;},30000));} // try again later (offline before the first download)
function playSample(a,k,t){const c=SAMP&&SAMP.by[k];if(!c)return false;const [s,d]=c[Math.floor(fxRnd()*c.length)],src=a.createBufferSource();
  src.buffer=SAMP.buf;src.playbackRate.value=vr(1,0.05);src.connect(BUS);voiceEnd(src);src.start(t,s,d);
  if(THUMP[k])tone(a,vr(62),t,0.25,THUMP[k],'sine',34);return true;}
const sfxAt={};
function playSfx(k,delay){const vol=SETTINGS.sfxVol??0.8;if(SETTINGS.sound===false||!(vol>0)||!SFX[k])return false;const a=audio();if(!a||a.state!=='running')return false;BUS.gain.value=0.9*vol*1.25;
  const now=a.currentTime;if(now-(sfxAt[k]??-9)<(GAP[k]??0.06))return false;if(voices>=MAX_VOICES&&!SFX_MUST.has(k))return false;
  sfxAt[k]=now;if(SAMP===null)loadSamples(a);try{const t=now+(delay||0)+0.005;if(!playSample(a,k,t)||MIX.has(k))SFX[k](a,t);}catch(e){return false;}return true;}
// What a drop sounds like: nothing for common/magic items and gold.
function dropSfx(l){if(l.gem){if(l.gem.r)playSfx('rune');return;}const r=l.item&&l.item.rarity;if(l.item&&l.item.anc){playSfx('unique');playSfx('levelup');return;} /* items.js: Ancient */if(r===3)playSfx('unique');else if(r===5)playSfx('set');else if(r===2)playSfx('rare');}
// Each skill's sound (SKILLS order in skills.js); the basic attack (slot 0) of a Warden is the weapon's swing.
const SKILL_SFX={warden:[null,'leap','whirl','warcry','slam'],arcanist:['bolt','fireball','nova','chain','meteor'],ranger:['twang','twang','swing','howl','twang']}; // the Ranger's own sounds come in a later step
const SWING_SFX={swing:'swing',heavy:'heavy',stab:'stab',thrust:'stab',flick:null};
function skillSfx(cls,i,style){const k=(SKILL_SFX[cls]||[])[i];if(k)playSfx(k);else if(style&&SWING_SFX[style])playSfx(SWING_SFX[style]);}
// Menu taps: a soft tick on any button, tab, slot or item cell.
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('click',ev=>{const t=ev.target;if(t&&t.closest&&t.closest('.btn,.tab,.slot,.cell,.chk,.cls'))playSfx('click');},true);
// Low life: a heartbeat, faster the closer to death (called every frame from update).
let heartT=0;
function heartTick(dt,hp,max){if(!(hp>0)||hp>max*0.3){heartT=0;return;}heartT-=dt;if(heartT<=0){heartT=0.55+1.1*(hp/(max*0.3));playSfx('heart');}}
// ---------- vibration ----------
// Short buzzes on crits, heavy hits taken, boss kills, level-ups and good drops. In the Android app they go through
// EmberdeepApp (native Vibrator: the WebView's own navigator.vibrate is unreliable); in a browser through
// navigator.vibrate. Patterns are [on, off, on, ...] in ms. Rate-limited: within 180 ms of the last buzz only a
// stronger one gets through, so a fight never turns into one long rattle. Settings → Vibration turns them off.
const VIB={crit:[14],hurt:[30],heavy:[70,40,45],levelup:[40,60,40,60,90],rare:[22],set:[60,70,60,70,150],unique:[50,60,50,60,50,60,220],boss:[120,60,200]};
const VIB_RANK={crit:1,hurt:2,rare:3,heavy:4,levelup:5,set:6,unique:6,boss:7};
let vibAt=-1e9,vibRank=0,vibLastK=null;
function buzz(k){if(SETTINGS.vib===false||!VIB[k])return false;const now=Date.now(),r=VIB_RANK[k];
  if(now-vibAt<180&&r<=vibRank)return false;
  const busy=VIB[vibLastK]&&now-vibAt<VIB[vibLastK].reduce((a,b)=>a+b,0);if(busy&&r<vibRank)return false; // a long pattern still playing isn't cut by a weaker one
  vibAt=now;vibRank=r;vibLastK=k;
  try{const A=typeof window!=='undefined'&&window.EmberdeepApp;
    if(A&&typeof A.postMessage==='function')A.postMessage(JSON.stringify({type:'vibrate',p:VIB[k]}));
    else if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(VIB[k]);}catch(e){}
  return true;}
