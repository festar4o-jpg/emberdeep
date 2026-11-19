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
const GAME_VERSION='1.0.15';
const SAVE_KEY='emberdeep_v1';
let SAVES=[];
try{SAVES=JSON.parse(localStorage.getItem(SAVE_KEY))||[];}catch(e){SAVES=[];}
// backupSoon(): every store*() calls it; js/backup.js sets the hook (the Android app copies saves outside the app)
let backupHook=null;const backupSoon=()=>{if(backupHook)backupHook();};
function storeSaves(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(SAVES));}catch(e){}backupSoon();}
function saveChar(){if(!G.char)return;if(G.p)G.char.potions=G.p.potions;const i=SAVES.findIndex(c=>c.id===G.char.id);if(i>=0)SAVES[i]=G.char;else SAVES.push(G.char);storeSaves();}

// ---------- game state ----------
const G={ehaz:[],feats:[],walls:[],nearFeat:null,paused:true,char:null,stats:null,p:null,enemies:[],proj:[],fx:[],parts:[],texts:[],loot:[],hazards:[],delayed:[],grid:null,explored:null,mapCv:null,rooms:[],portal:null,boss:null,cam:{x:0,y:0},shake:0,time:0,flow:null,flowTile:-1,flowT:0,depth:1,bagFullT:0,exploreT:0,mmT:0,saveT:0};
const held=[false,false,false,false,false];
const keys={};
