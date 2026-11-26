'use strict';
// Shared helpers, save storage and the global game state G.
// ---------- helpers ----------
const $=id=>document.getElementById(id);
const rand=(a,b)=>a+Math.random()*(b-a);
const randi=(a,b)=>Math.floor(rand(a,b+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const TAU=Math.PI*2;
const pct=v=>Math.round(v*100)+'%';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const angDiff=(a,b)=>{let d=(a-b)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return Math.abs(d);};

// ---------- saves ----------
// Game version: shown in the pause menu; bump it (and VERSION in sw.js) after every change.
const GAME_VERSION='1.0.140';
const SAVE_KEY='emberdeep_v1';
let SAVES=[];
try{SAVES=JSON.parse(localStorage.getItem(SAVE_KEY))||[];}catch(e){SAVES=[];}
// backupSoon(): every store*() calls it; js/backup.js sets the hook (the Android app copies saves outside the app)
let backupHook=null;const backupSoon=()=>{if(backupHook)backupHook();};
// Writes to the phone's storage. When it is full, the oldest backup copy (kept from save format changes, '_backup')
// is deleted and the write tried again, until it fits or no backups are left; then a warning (at most once a minute).
// Backups are only ever deleted when the space is needed.
let saveWarnT=-1e9;
function storeSafe(k,v){for(let n=0;n<20;n++){try{localStorage.setItem(k,v);return true;}catch(e){if(!dropOldestBackup())break;}}
  const now=Date.now();if(now-saveWarnT>60000){saveWarnT=now;if(typeof toast==='function')toast("Couldn't save","Your phone's storage is full: free some space");}return false;}
function dropOldestBackup(){try{const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.includes('_backup'))ks.push(k);}
  if(!ks.length)return false;const ver=k=>{if(k.includes('prerestore'))return 1e9; /* the copy kept before a restore: last to go */const m=/_backup_v(\d+)/.exec(k);return m?+m[1]:0;};ks.sort((a,b)=>ver(a)-ver(b));localStorage.removeItem(ks[0]);return true;}catch(e){return false;}}
function storeSaves(){storeSafe(SAVE_KEY,JSON.stringify(SAVES));backupSoon();}
function saveChar(){if(!G.char)return;if(G.p)G.char.potions=G.p.potions;const i=SAVES.findIndex(c=>c.id===G.char.id);if(i>=0)SAVES[i]=G.char;else SAVES.push(G.char);storeSaves();}

// ---------- game state ----------
const G={ehaz:[],feats:[],walls:[],nearFeat:null,paused:true,char:null,stats:null,p:null,enemies:[],proj:[],fx:[],parts:[],texts:[],loot:[],hazards:[],delayed:[],grid:null,explored:null,mapCv:null,lights:[],splats:[],hitStop:0,rooms:[],portal:null,boss:null,cam:{x:0,y:0},shake:0,time:0,flow:null,flowTile:-1,flowT:0,depth:1,bagFullT:0,exploreT:0,mmT:0,saveT:0};
const held=[false,false,false,false,false];
const keys={};
