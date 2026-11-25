// In-game updates (v1.0.116). The site's changes.json says which game version is newest and what each version
// changed (plain lines, newest first). The game asks for it at start-up, every UPD_EVERY ms while it runs, and when
// you tap ☰ › Check for updates. A newer version: a dot on ☰, and the update box (What's new + Update now / Later)
// as soon as you are somewhere calm (title screen, town, or a menu open; never in the middle of a fight).
// Update now saves and reloads: the service worker (sw.js) fetches every file fresh, so the reload is the new game.
// changes.json is in sw.js FILES, so What's new also works offline; tests check its newest entry is GAME_VERSION.
const UPD_EVERY=10*60*1000,UPD_FIRST=4000;
const UPD={data:null,avail:null,later:null,busy:false};
// -1, 0, 1 for version strings like 1.0.116
function vcmp(a,b){const x=String(a).split('.').map(Number),y=String(b).split('.').map(Number);for(let i=0;i<3;i++){const d=(x[i]||0)-(y[i]||0);if(d)return d>0?1:-1;}return 0;}
function checkUpdate(manual){if(UPD.busy||typeof fetch!=='function')return;UPD.busy=true;
  if(manual)$('updCheck').textContent='Checking…';
  fetch('changes.json?t='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('http '+r.status);return r.json();})
    .then(j=>updGot(j,manual)).catch(()=>{if(manual)toast("Couldn't check for updates",'No connection to the game server. Try again when you are online.');})
    .finally(()=>{UPD.busy=false;if(manual)$('updCheck').textContent='🔄 Check for updates';});}
// The answer (also called by the tests with a ready object).
function updGot(j,manual){if(!j||typeof j.latest!=='string')return;UPD.data=j;
  if(vcmp(j.latest,GAME_VERSION)>0){UPD.avail=j.latest;if(manual)UPD.later=null;updDot();if(manual||updCalm())showUpdate();}
  else{UPD.avail=null;updDot();if(manual)toast('You have the newest version',`Emberdeep v${GAME_VERSION}`);}}
// Calm: no hero yet, in town, or a menu is open (the game is paused).
const updCalm=()=>!G.char||G.inTown||G.paused;
function updDot(){const d=$('menuDot');if(d)d.classList.toggle('hidden',!UPD.avail);}
// Every few seconds: show a waiting update once things are calm (not again after Later, until the next version).
function updTick(){if(UPD.avail&&UPD.later!==UPD.avail&&updCalm()&&$('updOv').classList.contains('hidden'))showUpdate();}
// The lines of every version newer than this one (or the last few, for What's new).
function updNotes(newer){const N=(UPD.data&&UPD.data.notes)||[];return newer?N.filter(n=>vcmp(n.v,GAME_VERSION)>0):N.slice(0,6);}
function notesHtml(list){return list.map(n=>`<div class="updv"><b>v${esc(n.v)}</b>${n.t.map(t=>`<div>• ${esc(t)}</div>`).join('')}</div>`).join('')||'<div class="fdim">No notes.</div>';}
function showUpdate(){if(!UPD.avail)return;$('updTitle').textContent=`Update ready: v${UPD.avail}`;
  $('updSub').textContent=`You have v${GAME_VERSION}. Updating takes a few seconds; your heroes and items are saved first.`;
  $('updBody').innerHTML=notesHtml(updNotes(true));$('updGo').classList.remove('hidden');$('updLater').textContent='Later';
  $('updOv').classList.remove('hidden');setPause();}
function showNews(){const go=()=>{$('updTitle').textContent="What's new";$('updSub').textContent=`You have v${GAME_VERSION}.`;$('updBody').innerHTML=notesHtml(updNotes(false));
    $('updGo').classList.toggle('hidden',!UPD.avail);$('updLater').textContent='Close';$('updOv').classList.remove('hidden');setPause();};
  if(UPD.data)go();else if(typeof fetch==='function')fetch('changes.json',{cache:'no-cache'}).then(r=>r.json()).then(j=>{UPD.data=j;go();}).catch(()=>toast("What's new",'Not available offline yet'));}
function closeUpdate(){$('updOv').classList.add('hidden');if(UPD.avail)UPD.later=UPD.avail;setPause();}
function applyUpdate(){try{if(G.char)saveChar();}catch(e){}$('updGo').textContent='Updating…';setTimeout(()=>location.reload(),300);}
tap('updCheck',()=>checkUpdate(true));tap('updNews',showNews);tap('updGo',applyUpdate);tap('updLater',closeUpdate);
// Started from main.js (boot).
function startUpdates(){$('updVer').textContent='v'+GAME_VERSION;setTimeout(()=>checkUpdate(false),UPD_FIRST);setInterval(()=>checkUpdate(false),UPD_EVERY);setInterval(updTick,2000);}
