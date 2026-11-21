'use strict';
// Sound cues, synthesised with WebAudio (no sound files): a chime when a rare, unique, set item or a rune drops, and boss cues.
// Browsers only allow audio after a tap, so the audio context is created on the first touch or key press.
// Settings → Sound turns them off.
let AC=null;
function audio(){if(AC)return AC;const C=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);if(!C)return null;try{AC=new C();}catch(e){AC=null;}return AC;}
if(typeof addEventListener==='function')for(const ev of ['pointerdown','keydown'])addEventListener(ev,()=>{const a=audio();if(a&&a.state==='suspended')a.resume();},{passive:true});
// One soft bell partial: a sine at f with a quick attack and a long exponential decay.
function tone(a,f,t0,dur,vol,type){const o=a.createOscillator(),g=a.createGain();o.type=type||'sine';o.frequency.value=f;
  g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);o.connect(g);g.connect(a.destination);o.start(t0);o.stop(t0+dur+0.05);}
// rare: two bright notes · unique: a deep bell with a shimmer · set: a hollow, greener chord · rune: a metallic clink
const DROP_SFX={
  rare:a=>{const t=a.currentTime;tone(a,988,t,0.35,0.07,'triangle');tone(a,1480,t+0.09,0.5,0.06,'triangle');},
  // unique: a low gong, then a rising golden arpeggio over a shimmer; set: a deep chord with a green rising call
  unique:a=>{const t=a.currentTime;for(const [f,v,d] of [[98,0.16,2.4],[196,0.14,2.0],[294,0.08,1.7],[392,0.06,1.4],[784,0.035,1.0]])tone(a,f,t,d,v);
    [523,659,784,1047,1319].forEach((f,i)=>tone(a,f,t+0.12+i*0.09,0.9,0.05,'triangle'));tone(a,2093,t+0.6,1.2,0.02);},
  set:a=>{const t=a.currentTime;for(const [f,v,d] of [[117,0.14,2.0],[233,0.12,1.7],[349,0.07,1.4],[466,0.05,1.2]])tone(a,f,t,d,v);
    [466,587,698,932].forEach((f,i)=>tone(a,f,t+0.15+i*0.11,0.8,0.045,'triangle'));tone(a,1397,t+0.6,1,0.02);},
  // boss cues: a low warning horn before a big attack, a deep boom at a phase change, a crack on a stagger
  warn:a=>{const t=a.currentTime;tone(a,98,t,0.9,0.1,'sawtooth');tone(a,147,t+0.05,0.8,0.05,'sawtooth');tone(a,196,t+0.1,0.6,0.03);},
  phase:a=>{const t=a.currentTime;tone(a,55,t,1.4,0.2);tone(a,82,t,1.1,0.1);tone(a,330,t,0.5,0.03,'triangle');},
  stagger:a=>{const t=a.currentTime;tone(a,420,t,0.15,0.08,'square');tone(a,210,t+0.02,0.35,0.07,'triangle');tone(a,840,t,0.12,0.03,'square');},
  rune:a=>{const t=a.currentTime;tone(a,1320,t,0.25,0.06,'square');tone(a,1980,t+0.02,0.3,0.04);tone(a,660,t,0.4,0.05);}};
let sfxLast=0;
function playSfx(k){if(SETTINGS.sound===false||!DROP_SFX[k])return;const a=audio();if(!a||a.state!=='running')return;
  if(a.currentTime-sfxLast<0.06)return;sfxLast=a.currentTime;try{DROP_SFX[k](a);}catch(e){}}
// What a drop sounds like: nothing for common/magic items and gold.
function dropSfx(l){if(l.gem){if(l.gem.r)playSfx('rune');return;}const r=l.item&&l.item.rarity;if(r===3)playSfx('unique');else if(r===5)playSfx('set');else if(r===2)playSfx('rare');}
