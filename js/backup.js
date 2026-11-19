'use strict';
// Save backups: every save key (heroes, shared stash, rune book, settings) in one JSON file.
// Android app (window.EmberdeepApp, added by android MainActivity): every save is also written, a few seconds later,
// to Download/Emberdeep/emberdeep-save.json, outside the app, so it survives an uninstall. Restore backup asks
// the app for a file picker. In a browser, Backup downloads the file and Restore opens a file picker.
// Restoring keeps the replaced saves under emberdeep_v1_backup_prerestore, just in case.
const isBackupKey=k=>/^emberdeep/.test(k)&&!/_backup|_unreadable/.test(k);
function backupJson(){
  const data={};
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(isBackupKey(k))data[k]=localStorage.getItem(k);}}catch(e){}
  return JSON.stringify({game:'emberdeep',ver:GAME_VERSION,at:Date.now(),data});
}
// Checks a backup file's text; returns {data, heroes} or throws an Error with a message for the player.
function parseBackup(text){
  let o;try{o=JSON.parse(text);}catch(e){throw new Error('That file is not an Emberdeep backup');}
  if(!o||o.game!=='emberdeep'||!o.data||typeof o.data!=='object')throw new Error('That file is not an Emberdeep backup');
  const ks=Object.keys(o.data).filter(isBackupKey);
  if(!ks.length||ks.some(k=>typeof o.data[k]!=='string'))throw new Error('That backup is empty or damaged');
  let heroes=[];if(o.data[SAVE_KEY]!=null){try{heroes=JSON.parse(o.data[SAVE_KEY]);}catch(e){heroes=null;}if(!Array.isArray(heroes))throw new Error('That backup is damaged');}
  const data={};for(const k of ks)data[k]=o.data[k];
  return {data,heroes:heroes.length};
}
// Replaces the current saves with the backup's (the caller reloads the page so every system reads them fresh).
function applyBackup(text){
  const b=parseBackup(text);
  try{const cur=localStorage.getItem(SAVE_KEY);if(cur&&cur!=='[]')localStorage.setItem(SAVE_KEY+'_backup_prerestore',cur);}catch(e){}
  const old=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(isBackupKey(k))old.push(k);}}catch(e){}
  for(const k of old)try{localStorage.removeItem(k);}catch(e){}
  for(const k in b.data)try{localStorage.setItem(k,b.data[k]);}catch(e){}
  return b.heroes;
}

const APP=typeof window!=='undefined'&&window.EmberdeepApp&&typeof window.EmberdeepApp.postMessage==='function'?window.EmberdeepApp:null;
let appBackupT=null,restoreArmed=false;
function appBackupNow(manual){clearTimeout(appBackupT);appBackupT=null;if(APP)APP.postMessage(JSON.stringify({type:'backup',json:backupJson(),manual:!!manual}));}
if(APP){
  backupHook=()=>{if(!appBackupT)appBackupT=setTimeout(()=>appBackupNow(false),3000);};
  APP.onmessage=ev=>{let m;try{m=JSON.parse(ev.data);}catch(e){return;}
    if(m.type==='backedUp'){if(m.manual)toast(m.ok?'Backup saved':'Backup failed',m.ok?m.where:m.error);}
    else if(m.type==='restoreData')restoreFrom(m.text);
    else if(m.type==='restoreError')toast('Could not read that file',m.error||'');};
  // leaving the app (home button, screen off): write the pending backup now
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&appBackupT)appBackupNow(false);});
}
function restoreFrom(text){
  let n;try{n=applyBackup(text);}catch(e){toast('Restore failed',e.message);return;}
  toast('Backup restored',n+(n===1?' hero':' heroes'));setTimeout(()=>location.reload(),700);
}
function backupButton(){
  if(APP){appBackupNow(true);return;}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([backupJson()],{type:'application/json'}));
  a.download='emberdeep-save.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
function restoreButton(){
  const b=$('restoreBtn');
  if(SAVES.length&&!restoreArmed){restoreArmed=true;b.textContent='Replace your heroes? Tap again';setTimeout(()=>{restoreArmed=false;b.textContent='📂 Restore backup';},3000);return;}
  restoreArmed=false;b.textContent='📂 Restore backup';
  if(APP){APP.postMessage(JSON.stringify({type:'restore'}));return;}
  $('restoreFile').click();
}
function setupBackupUi(){
  // an older app without the bridge can neither download nor pick files: hide the buttons there
  const oldApp=!APP&&typeof navigator!=='undefined'&&/\bEmberdeepApp\b/.test(navigator.userAgent||'');
  $('backupRow').classList.toggle('hidden',oldApp);
  $('backupInfo').textContent=APP?'Auto-backup: Download/Emberdeep/emberdeep-save.json':'';
  $('backupBtn').onclick=backupButton;$('restoreBtn').onclick=restoreButton;
  $('restoreFile').onchange=ev=>{const f=ev.target.files&&ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>restoreFrom(String(r.result));r.readAsText(f);ev.target.value='';};
}
