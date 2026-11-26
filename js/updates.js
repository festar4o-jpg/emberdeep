// In-game updates (v1.0.116; app updates v1.0.117). Two kinds:
// - The game: the site's changes.json says which game version is newest and what each version changed (plain lines,
//   newest first). Update now saves and reloads: the service worker (sw.js) fetches every file fresh, so the reload is
//   the new game. changes.json is in sw.js FILES (What's new works offline); tests check its newest entry is GAME_VERSION.
// - The app (only inside the Android app): the site's app/app.json ({native, apk, notes}, put there by
//   tools/build-apk.sh --site) says which app version is newest; the app says its own in its user agent
//   ("EmberdeepApp/4"; app 3 and older just "EmberdeepApp"). Download: app 4+ opens the APK in the phone's browser
//   (MainActivity 'openUrl'), which downloads it and offers to install it; older apps get the link to open by hand.
// After an update the game shows what changed once (showFresh). Checked at start-up, every UPD_EVERY ms, and with ☰ › Check for updates. Something new: a dot on ☰, and its box as
// soon as you are somewhere calm (title screen, town, or a menu open; never in the middle of a fight). Later: not
// again for that version.
const UPD_EVERY=10*60*1000,UPD_FIRST=4000;
const UPD={data:null,avail:null,later:null,app:null,appLater:null,mode:null,busy:false,seen:undefined};
// v1.0.136: the game updates itself when it opens (sw.js loads the newest files), so no "Update ready" box ever shows.
// Instead, the first calm moment after a new version runs, a "Game updated" box lists what changed since the version
// this phone last ran (remembered in SEEN_KEY). A first install shows nothing; a phone that already has heroes but no
// remembered version (from before v1.0.136) counts as coming from the version before this one.
const SEEN_KEY='emberdeep-seen-version';
function seenGet(){try{return localStorage.getItem(SEEN_KEY);}catch(e){return null;}}
function seenSet(v){try{localStorage.setItem(SEEN_KEY,v);}catch(e){}}
// The version to tell about changes since (null: nothing to tell). Worked out once.
function seenFrom(){if(UPD.seen!==undefined)return UPD.seen;let v=seenGet();
  if(!v){const N=(UPD.data&&UPD.data.notes)||[],i=N.findIndex(n=>n.v===GAME_VERSION);
    if(SAVES.length&&i>=0&&N[i+1])v=N[i+1].v;else{seenSet(GAME_VERSION);return UPD.seen=null;}}
  if(vcmp(GAME_VERSION,v)>0)return UPD.seen=v;
  if(v!==GAME_VERSION)seenSet(GAME_VERSION); // an older game than last time (rolled back): just remember this one
  return UPD.seen=null;}
function showFresh(){const from=UPD.seen,N=((UPD.data&&UPD.data.notes)||[]).filter(n=>vcmp(n.v,from)>0&&vcmp(n.v,GAME_VERSION)<=0);
  openBox('fresh',`✨ Game updated to v${GAME_VERSION}`,`Here is what's new since you last played (v${from}).`,notesHtml(N),'','Play');}
// changes.json from the game's own files (works offline), for the box above.
function freshData(){if(UPD.data||UPD.loading||typeof fetch!=='function')return;UPD.loading=true;
  fetch('changes.json',{cache:'no-cache'}).then(r=>r.json()).then(j=>{if(!UPD.data)UPD.data=j;}).catch(()=>{}).finally(()=>{UPD.loading=false;});}
// -1, 0, 1 for version strings like 1.0.116
function vcmp(a,b){const x=String(a).split('.').map(Number),y=String(b).split('.').map(Number);for(let i=0;i<3;i++){const d=(x[i]||0)-(y[i]||0);if(d)return d>0?1:-1;}return 0;}
// The app version this game runs in: 0 = a browser, 3 = app 3 or older (no number), else the number.
function appNative(){const ua=typeof navigator!=='undefined'&&navigator.userAgent||'',m=/EmberdeepApp(?:\/(\d+))?/.exec(ua);return m?(m[1]?+m[1]:3):0;}
const getJson=u=>fetch(u+'?t='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('http '+r.status);return r.json();});
function checkUpdate(manual){if(UPD.busy||typeof fetch!=='function')return;UPD.busy=true;
  if(manual)$('updCheck').textContent='Checking…';
  Promise.all([getJson('changes.json'),appNative()?getJson('app/app.json').catch(()=>null):Promise.resolve(null)])
    .then(([j,a])=>{updGot(j,manual,true);appGot(a,manual);if(manual&&!UPD.avail&&!UPD.app)toast('You have the newest version',`Emberdeep v${GAME_VERSION}${appNative()?` · app ${appNative()}`:''}`);})
    .catch(()=>{if(manual)toast("Couldn't check for updates",'No connection to the game server. Try again when you are online.');})
    .finally(()=>{UPD.busy=false;if(manual)$('updCheck').textContent='🔄 Check for updates';});}
// The answers (also called by the tests with ready objects). quiet: the caller says "newest" itself.
function updGot(j,manual,quiet){if(!j||typeof j.latest!=='string')return;UPD.data=j;
  if(vcmp(j.latest,GAME_VERSION)>0){UPD.avail=j.latest;if(manual)UPD.later=null;updDot();if(manual||updCalm())showUpdate();}
  else{UPD.avail=null;updDot();if(manual&&!quiet)toast('You have the newest version',`Emberdeep v${GAME_VERSION}`);}}
function appGot(a,manual){const mine=appNative();if(!mine||!a||!(a.native>mine)){UPD.app=null;updDot();return;}
  UPD.app=a;if(manual)UPD.appLater=null;updDot();if(!UPD.avail&&(manual||updCalm()))showAppUpdate();}
// Calm: no hero yet, in town, or a menu is open (the game is paused).
const updCalm=()=>!G.char||G.inTown||G.paused;
function updDot(){const d=$('menuDot');if(d)d.classList.toggle('hidden',!UPD.avail&&!UPD.app);}
const boxOpen=()=>!$('updOv').classList.contains('hidden');
// Every few seconds: show what is waiting once things are calm (the game first, then the app).
function updTick(){if(!updCalm()||boxOpen())return;
  if(UPD.seen===undefined||UPD.seen){if(!UPD.data){freshData();return;}if(seenFrom()&&$('startOv').classList.contains('hidden')){showFresh();return;}} // after Tap to start
  if(UPD.avail&&UPD.later!==UPD.avail)showUpdate();else if(UPD.app&&UPD.appLater!==UPD.app.native)showAppUpdate();}
// The lines of every version newer than this one (or the last few, for What's new).
function updNotes(newer){const N=(UPD.data&&UPD.data.notes)||[];return newer?N.filter(n=>vcmp(n.v,GAME_VERSION)>0):N.slice(0,6);}
function notesHtml(list){return list.map(n=>`<div class="updv"><b>v${esc(n.v)}</b>${n.t.map(t=>`<div>• ${esc(t)}</div>`).join('')}</div>`).join('')||'<div class="fdim">No notes.</div>';}
function openBox(mode,title,sub,body,go,later){UPD.mode=mode;$('updTitle').textContent=title;$('updSub').textContent=sub;$('updBody').innerHTML=body;
  $('updGo').textContent=go||'';$('updGo').classList.toggle('hidden',!go);$('updLater').textContent=later;$('updOv').classList.remove('hidden');setPause();}
function showUpdate(){if(!UPD.avail)return;openBox('game',`Update ready: v${UPD.avail}`,`You have v${GAME_VERSION}. Updating takes a few seconds; your heroes and items are saved first.`,
  notesHtml(updNotes(true)),'Update now','Later');}
function showAppUpdate(){const a=UPD.app;if(!a)return;
  openBox('app',`New app version (app ${a.native})`,`You have app ${appNative()}. The game updates itself, but this needs the new app: download it, then tap Update. Your heroes are kept.`,
    `<div class="updv">${(a.notes||[]).map(t=>`<div>• ${esc(t)}</div>`).join('')}</div>`,'⬇ Download','Later');}
function showNews(){const go=()=>openBox('news',"What's new",`You have v${GAME_VERSION}${appNative()?` · app ${appNative()}`:''}.`,notesHtml(updNotes(false)),UPD.avail?'Update now':'','Close');
  if(UPD.data)go();else if(typeof fetch==='function')fetch('changes.json',{cache:'no-cache'}).then(r=>r.json()).then(j=>{UPD.data=j;go();}).catch(()=>toast("What's new",'Not available offline yet'));}
function closeUpdate(){$('updOv').classList.add('hidden');if(UPD.mode==='fresh'){seenSet(GAME_VERSION);UPD.seen=null;}else if(UPD.mode==='app'&&UPD.app)UPD.appLater=UPD.app.native;else if(UPD.avail)UPD.later=UPD.avail;setPause();}
// The site address of the new app (and its download page).
const appUrl=f=>new URL('app/'+(f||''),location.href).href;
function appDownload(){const a=UPD.app,url=appUrl(a.apk),A=typeof window!=='undefined'&&window.EmberdeepApp;
  if(appNative()>=4&&A&&typeof A.postMessage==='function'){A.postMessage(JSON.stringify({type:'openUrl',url}));
    $('updBody').innerHTML='<div class="updv">Your browser is downloading the new app. When it finishes, tap the download (or open it from Download), then <b>Update</b>.</div>';}
  else{const page=appUrl();try{navigator.clipboard&&navigator.clipboard.writeText(page);}catch(e){}
    $('updBody').innerHTML=`<div class="updv">This app is too old to download it by itself. Open this page in Chrome (the link is copied):<div style="margin:6px 0;color:#ffd36b;word-break:break-all">${esc(page)}</div>Tap the download, then <b>Update</b>.</div>`;}
  $('updGo').classList.add('hidden');$('updLater').textContent='Close';}
function applyUpdate(){if(UPD.mode==='app')return appDownload();try{if(G.char)saveChar();}catch(e){}$('updGo').textContent='Updating…';setTimeout(()=>location.reload(),300);}
tap('updCheck',()=>checkUpdate(true));tap('updNews',showNews);tap('updGo',applyUpdate);tap('updLater',closeUpdate);
// Started from main.js (boot).
function startUpdates(){$('updVer').textContent='v'+GAME_VERSION+(appNative()?` · app ${appNative()}`:'');setTimeout(()=>checkUpdate(false),UPD_FIRST);setInterval(()=>checkUpdate(false),UPD_EVERY);setInterval(updTick,2000);}
