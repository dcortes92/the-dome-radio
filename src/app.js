import { store } from './store.js';
import { api } from './api/radio-browser.js';
import {
  updateMediaSession,
  setMediaPlaybackState,
  initMediaSession,
} from './player/media-session.js';


/* =================== State & helpers =================== */
const $ = s => document.querySelector(s);
const state = { list:[], idx:-1, playing:false };
const audio = $('#audio');

let favs=store.get('favs',[]), recents=store.get('recents',[]);
function slimSt(s){ return {stationuuid:s.stationuuid,name:s.name,url:s.url,url_resolved:s.url_resolved,favicon:s.favicon,country:s.country,countrycode:s.countrycode,codec:s.codec,bitrate:s.bitrate,tags:s.tags}; }
function isFav(uuid){ return favs.some(f=>f.stationuuid===uuid); }

function flag(cc){
  if(!cc || cc.length!==2) return '🌐';
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c=>0x1F1A5+c.charCodeAt(0)));
}
function esc(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function initials(name){ return (name||'?').trim().slice(0,2).toUpperCase(); }
function hashFreq(uuid){
  let h=0; for(const c of uuid) h=(h*31 + c.charCodeAt(0))>>>0;
  return (87.5 + (h%205)/10).toFixed(1); // 87.5–108.0 dial fiction
}
function artHTML(st){
  const fb = esc(initials(st.name));
  return st.favicon
    ? `<img src="${esc(st.favicon)}" alt="" loading="lazy" onerror="this.parentNode.textContent='${fb}'">`
    : fb;
}
function metaLine(st){
  const parts=[st.countrycode?flag(st.countrycode):'', st.country||'', st.codec?st.codec.toUpperCase():''].filter(Boolean);
  return parts.join(' · ');
}
function stationCard(st,i,_row=false){
  return `<div class="station" data-i="${i}" data-uuid="${esc(st.stationuuid)}" style="animation-delay:${Math.min(i*35,420)}ms">
    <div class="art">${artHTML(st)}</div>
    <div class="txt">
      <div class="name">${esc(st.name)}</div>
      <div class="meta">${esc(metaLine(st))}</div>
    </div>
  </div>`;
}
function bindCards(container,list){
  container.querySelectorAll('.station').forEach(el=>{
    el.addEventListener('click',()=> play(list, +el.dataset.i));
  });
}
function bindOwnRow(container){
  const el = container && container.querySelector('.ownrow'); if(!el) return;
  el.addEventListener('click', async ()=>{
    await refreshOwnStation();
    const own = ownStationSync();
    if(!own || !own._hasTape){
      document.querySelector('nav button[data-view="studio"]').click();
      return;
    }
    play([own], 0);
  });
}
function markPlaying(){
  document.querySelectorAll('.station').forEach(el=>{
    el.classList.toggle('playing', state.idx>=0 && el.dataset.uuid === state.list[state.idx]?.stationuuid);
  });
}
function rankRow(st,i){
  const n=String(i+1).padStart(2,'0');
  return `<div class="station rankrow" data-i="${i}" data-uuid="${esc(st.stationuuid)}" style="animation-delay:${Math.min(i*35,420)}ms">
    <div class="rank"><b>${n[0]}</b><span>${n[1]}</span></div>
    <div class="art">${artHTML(st)}</div>
    <div class="txt"><div class="name">${esc(st.name)}</div><div class="meta">${esc(metaLine(st))}</div></div>
    <div class="eq"><i></i><i></i><i></i></div>
  </div>`;
}
function libRow(st,i,removable){
  return `<div class="station" data-i="${i}" data-uuid="${esc(st.stationuuid)}" style="animation-delay:${Math.min(i*35,420)}ms">
    <div class="art">${artHTML(st)}</div>
    <div class="txt"><div class="name">${esc(st.name)}</div><div class="meta">${esc(metaLine(st))}</div></div>
    ${removable?'<button class="rowfav" aria-label="Remove favourite"><svg viewBox="0 0 24 24"><path d="M12 20.5C12 20.5 4 15.2 4 9.7 4 7.1 6 5.2 8.4 5.2c1.6 0 2.8.8 3.6 2.1.8-1.3 2-2.1 3.6-2.1C18 5.2 20 7.1 20 9.7c0 5.5-8 10.8-8 10.8z"/></svg></button>':''}
  </div>`;
}
function renderLibrary(){
  const f=$('#favList'), r=$('#recentList');
  f.innerHTML = favs.length ? favs.map((s,i)=>libRow(s,i,true)).join('') : '<div class="status">No favourites yet — tap the ♥ in the player.</div>';
  r.innerHTML = recents.length ? recents.map((s,i)=>libRow(s,i,false)).join('') : '<div class="status">Stations you play will appear here.</div>';
  f.querySelectorAll('.station').forEach(el=>{
    el.addEventListener('click',e=>{
      if(e.target.closest('.rowfav')){
        e.stopPropagation();
        favs=favs.filter(x=>x.stationuuid!==el.dataset.uuid);
        store.set('favs',favs); renderLibrary(); updateFavUI(); return;
      }
      play(favs,+el.dataset.i);
    });
  });
  r.querySelectorAll('.station').forEach(el=>el.addEventListener('click',()=>play(recents,+el.dataset.i)));
  markPlaying();
}
function updateFavUI(){
  const st=state.idx>=0?state.list[state.idx]:null;
  const on=!!(st&&isFav(st.stationuuid));
  $('#favBtn').classList.toggle('on',on);
  $('#favBtn').setAttribute('aria-pressed',String(on));
  $('#dialFav').classList.toggle('on',on);
}
function toggleCurrentFav(btn){
  const st=state.idx>=0?state.list[state.idx]:null; if(!st) return;
  const user = store.get('user', null);
  // Account-backed favorites require a non-guest signed-in user (FR-006)
  if (!user || user.guest) {
    const scr = document.getElementById('authScr');
    if (scr) {
      scr.hidden = false;
      scr.style.display = '';
      scr.classList.remove('hide');
    } else {
      setDockStatus('Sign in to save favourites', true);
    }
    return;
  }
  const removing = isFav(st.stationuuid);
  if(removing) favs=favs.filter(f=>f.stationuuid!==st.stationuuid);
  else favs=[slimSt(st),...favs];
  store.set('favs',favs);
  updateFavUI();
  btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
  if($('#library').classList.contains('active')) renderLibrary();
  import('./api/supabase.js').then(async (mod) => {
    try {
      if (!mod.getSupabase()) return;
      if (removing) await mod.removeFavorite(st.stationuuid);
      else await mod.addFavorite(st);
    } catch { /* offline / not configured */ }
  });
}
function signalLost(){
  setDockStatus('Signal lost · skip to next ▸',true);
  const d=$('#dock'); d.classList.remove('err-anim'); void d.offsetWidth; d.classList.add('err-anim');
}

/* =================== Player =================== */
const dockName=$('#dockName'), dockMeta=$('#dockMeta'), dockArt=$('#dockArt'),
      playBtn=$('#playBtn'), playIcon=$('#playIcon'), freqEl=$('#freq'), ruler=$('#ruler');

const ICON_PLAY='M8 5v14l11-7z', ICON_PAUSE='M6 5h4v14H6zM14 5h4v14h-4z';

function setDockStatus(text, err=false){
  dockMeta.textContent = text;
  dockMeta.classList.toggle('err', err);
}
function play(list, idx){
  state.list = list; state.idx = idx;
  const st = list[idx];
  if(!st) return;
  // dial animation
  const f = st.ownFreq ? Number(st.ownFreq).toFixed(1) : hashFreq(st.stationuuid);
  freqEl.textContent = `${f} MHz · ${st.countrycode||'??'}`;
  ruler.style.transform = `translateX(${ -((parseFloat(f)-87.5)/20.5)*1100 - 650 }px)`;
  // dock
  dockName.textContent = st.name;
  dockArt.innerHTML = artHTML(st);
  setDockStatus('Tuning in…');
  updateMediaSession(st);
  // stream
  audio.src = st.url_resolved || st.url;
  audio.play().then(()=>{
    state.playing = true; refreshPlayUI(); setMediaPlaybackState(true);
    setDockStatus(metaLine(st) + (st.bitrate?` · ${st.bitrate}kbps`:''));
    api('/json/url/'+st.stationuuid).catch(()=>{}); // count the listen
  }).catch(()=>{
    state.playing = false; refreshPlayUI();
    signalLost();
  });
  markPlaying();
  if(!$('#app').classList.contains('has-dock')){
    $('#app').classList.add('has-dock');
    $('#dock').classList.add('show');
    setTimeout(()=>{ sizeNet(); if(leafMap) leafMap.invalidateSize(); }, 580);
  }
  mapFocus(st);
  if(!String(st.stationuuid).startsWith('own:')){
    recents=[slimSt(st),...recents.filter(r=>r.stationuuid!==st.stationuuid)].slice(0,12);
    store.set('recents',recents);
  }
  updateFavUI();
  // keep the big dial in sync
  if(DIAL.open && DIAL.list===list){
    const N=list.length, base=Math.round(DIAL.pos);
    let diff=dmod(idx-dmod(base,N),N); if(diff>N/2)diff-=N;
    if(diff!==0) dialAnimateTo(base+diff,true); else dialCenter(idx);
  }
}
function refreshPlayUI(){
  playIcon.querySelector('path').setAttribute('d', state.playing?ICON_PAUSE:ICON_PLAY);
  playBtn.setAttribute('aria-pressed', String(state.playing));
  $('#dock').classList.toggle('playing-anim', state.playing);
  const npi=document.getElementById('npPlayIcon');
  if(npi) npi.setAttribute('d', state.playing?ICON_PAUSE:ICON_PLAY);
  if(DIAL.open && state.idx>=0) $('#npState').textContent = state.playing?'on air':'paused';
}
function togglePlay(){
  if(state.idx<0) return;
  if(state.playing){ audio.pause(); state.playing=false; setMediaPlaybackState(false); }
  else { audio.play().catch(()=>signalLost()); state.playing=true; setMediaPlaybackState(true); }
  refreshPlayUI();
}
playBtn.addEventListener('click',togglePlay);
$('#nextBtn').addEventListener('click',()=>{ if(state.list.length) play(state.list,(state.idx+1)%state.list.length); });
$('#prevBtn').addEventListener('click',()=>{ if(state.list.length) play(state.list,(state.idx-1+state.list.length)%state.list.length); });
audio.addEventListener('error',()=>{ if(state.idx>=0){ state.playing=false; refreshPlayUI(); signalLost();} });
audio.addEventListener('stalled',()=> setDockStatus('Buffering…'));
audio.addEventListener('playing',()=>{ state.playing=true; refreshPlayUI(); if(state.idx>=0) setDockStatus(metaLine(state.list[state.idx])); });

/* =================== Tabs =================== */
let mapBuilt=false;

function activateView(view){
  if (view === 'creator') {
    domeToast('Broadcast isn’t available yet');
    return;
  }
  const viewId = view === 'map' ? 'mapview' : view;
  document.querySelectorAll('nav button').forEach(x=>{
    const on = x.dataset.view === view;
    x.classList.toggle('active', on);
    x.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const el = document.getElementById(viewId);
  if (el) el.classList.add('active');
  if(view==='map'){
    if(mapMode==='web'){
      if(!mapBuilt) buildMap();
      else setTimeout(sizeNet,60);
      GRAPH.active=true;
    } else {
      GRAPH.active=false;
      if(leafMap) setTimeout(()=>leafMap.invalidateSize(),60);
    }
  } else GRAPH.active=false;
  $('#app').classList.toggle('app-dark', view==='map' && mapMode==='map');
  if(view==='library') renderLibrary();
}

function domeToast(msg){
  const host = $('.app') || document.body;
  let t = $('#hdrToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'hdrToast';
    t.className = 'net-toast';
    host.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 1900);
}

document.querySelectorAll('nav button').forEach(b=>{
  b.addEventListener('click',()=>{
    activateView(b.dataset.view);
  });
});

const searchBtn = $('#searchBtn');
if (searchBtn) {
  searchBtn.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach(x=>{
      x.classList.remove('active');
      x.setAttribute('aria-selected','false');
    });
    activateView('search');
    const inp = $('#search .searchbox input') || $('#search input');
    if (inp) setTimeout(() => { try { inp.focus(); } catch { /* ignore */ } }, 160);
  });
}

/* waveform bars in Now Playing art */
(function initNpWave(){
  const wf = document.getElementById('npwave');
  if (!wf || wf.childElementCount) return;
  [13,22,15,36,19,29,43,17,25,38,14,32,47,21,13,34,27,45,18,30,41,16,25,35,14,39,22,32,46,15,26,37,19,30,13,23,34,17,42,20,14,31,38,16,25,13]
    .forEach((h) => {
      const b = document.createElement('span');
      b.style.height = h + 'px';
      wf.appendChild(b);
    });
})();

/* =================== Explore =================== */
async function loadStats(){
  try{ const s = await api('/json/stats'); $('#statCount').textContent = s.stations.toLocaleString('en-US')+' stations on air'; }
  catch{ $('#statCount').textContent = 'on air'; }
}
let trendList=[];
/* tu emisora como estación del dial — lee Studio + su cinta de IndexedDB */
let ownStationCache = null;
function ownStationSync(){ return ownStationCache; }
function refreshOwnStation(){
  return new Promise(res=>{
    const st = store.get('mystation', null);
    if(!st){ ownStationCache = null; return res(null); }
    const done = tape => {
      ownStationCache = {
        stationuuid: 'own:self',
        name: st.name,
        url: tape ? tape._url : '', url_resolved: tape ? tape._url : '',
        favicon:'', country:'Your studio', countrycode:'YOU',
        tags: (st.tagline||'studio'), bitrate:0, ownFreq: st.freq, isOwn:true,
        _hasTape: !!tape
      };
      res(ownStationCache);
    };
    try{
      const r = indexedDB.open('dome-studio',1);
      r.onsuccess = e=>{ const db=e.target.result;
        if(!db.objectStoreNames.contains('eps')){ return done(null); }
        const all = db.transaction('eps').objectStore('eps').getAll();
        all.onsuccess = ()=>{ const list=(all.result||[]).sort((a,b)=>b.id-a.id);
          const ep = list.find(e=>e.id===st.tapeId) || list[0] || null;
          if(ep){ if(ownStationCache && ownStationCache._url) URL.revokeObjectURL(ownStationCache._url);
                  ep._url = URL.createObjectURL(ep.blob); }
          done(ep);
        };
        all.onerror = ()=>done(null);
      };
      r.onerror = ()=>done(null);
    }catch{ done(null); }
  });
}

function ownRow(st){
  const f = Number(st.ownFreq).toFixed(1);
  return `<div class="station ownrow" data-own="1" data-uuid="own:self">
    <div class="rank own"><svg viewBox="0 0 16 16"><path d="M8 1l2 4.5L15 6l-3.7 3.3L12.5 15 8 12.2 3.5 15l1.2-5.7L1 6l5-.5z"/></svg></div>
    <div class="art ownart">${st.name.charAt(0).toUpperCase()}</div>
    <div class="txt"><div class="name">${esc(st.name)} <em class="own-badge">Your station</em></div>
      <div class="meta">${f} FM · ${st._hasTape?'tap to listen':'record a tape in Studio'}</div></div>
    <div class="eq"><i></i><i></i><i></i></div>
  </div>`;
}

async function loadTrending(){
  try{
    // TRENDING REAL = momentum reciente (clicktrend) con volumen real (clickcount), worldwide
    let pool = await api('/json/stations/search?order=clicktrend&reverse=true&limit=80&hidebroken=true');
    pool = (pool||[]).filter(s=>s.url_resolved && (s.clicktrend||0)>0 && (s.clickcount||0)>=80);
    // respaldo 1: las más escuchadas ahora (clickcount = clics de las últimas 24h), worldwide
    if(pool.length<6){
      const seenU=new Set(pool.map(s=>s.stationuuid));
      const hot=(await api('/json/stations/search?order=clickcount&reverse=true&limit=80&hidebroken=true')||[])
        .filter(s=>s.url_resolved && (s.clickcount||0)>0 && !seenU.has(s.stationuuid));
      pool=pool.concat(hot);
    }
    // respaldo 2: topvote global si la red de clics no responde
    if(!pool.length){
      pool = prioByCountry(await api('/json/stations/topvote/120?hidebroken=true')).filter(s=>s.url_resolved);
    }
    // dedupe por nombre
    const seenN=new Set();
    pool = pool.filter(s=>{ const k=s.name.trim().toLowerCase(); if(seenN.has(k))return false; seenN.add(k); return true; });
    // rotar SOLO dentro del top trending (variedad sin perder el "trending"): top 12, barajar, tomar 3
    const top = pool.slice(0,12);
    for(let i=top.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [top[i],top[j]]=[top[j],top[i]]; }
    const seen=new Set();
    trendList = top.filter(s=>{ const k=(s.name||'').trim().toLowerCase(); if(seen.has(k))return false; seen.add(k); return s.url_resolved; }).slice(0,3);
    await refreshOwnStation();
    const own = ownStationSync();
    $('#trendGrid').innerHTML = (own?ownRow(own):'') + trendList.map((s,i)=>rankRow(s,i)).join('');
    bindCards($('#trendGrid'), trendList);
    bindOwnRow($('#trendGrid'));
  }catch{ $('#trendGrid').innerHTML = '<div class="status">Could not reach the radio network. Check your connection.</div>'; }
}
const JAZZ_IMG='/assets/genres/jazz.jpg';
const CLASSICAL_IMG='/assets/genres/classical.jpg';
const LOFI_IMG='/assets/genres/lofi.jpg';
const ELECTRONIC_IMG='/assets/genres/electronic.jpg';
const LATIN_IMG='/assets/genres/latin.jpg';
const SOUL_IMG='/assets/genres/soul.jpg';
const REGGAE_IMG='/assets/genres/reggae.jpg';
const POP_IMG='/assets/genres/pop.jpg';
const ROCK_IMG='/assets/genres/rock.jpg';
const TECHNO_IMG='/assets/genres/techno.jpg';
const CHRISTIAN_IMG='/assets/genres/christian.jpg';
const GENRE_CARDS=[
  {tag:'christian', img:CHRISTIAN_IMG, bg:'#444441', ink:'#161616', code:'89.5 FM'},
  {tag:'classical', img:CLASSICAL_IMG, bg:'#3B3C37', ink:'#161616', code:'90.1 FM'},
  {tag:'electronic', img:ELECTRONIC_IMG, bg:'#444749', ink:'#F2F1EF', code:'98.3 FM'},
  {tag:'jazz', bg:'#474745', ink:'#161616', code:'87.9 FM', img:JAZZ_IMG},
  {tag:'latin', img:LATIN_IMG, bg:'#474239', ink:'#FFFFFF', code:'101.5 FM'},
  {tag:'lofi', img:LOFI_IMG, bg:'#494949', ink:'#F2F1EF', code:'94.7 FM'},
  {tag:'pop', img:POP_IMG, bg:'#484745', ink:'#161616', code:'100.3 FM'},
  {tag:'reggae', img:REGGAE_IMG, bg:'#434341', ink:'#161616', code:'102.1 FM'},
  {tag:'rock', img:ROCK_IMG, bg:'#403F3A', ink:'#161616', code:'107.1 FM'},
  {tag:'soul', img:SOUL_IMG, bg:'#464645', ink:'#F2F1EF', code:'104.9 FM'},
  {tag:'techno', img:TECHNO_IMG, bg:'#424F56', ink:'#F2F1EF', code:'108.0 FM'}
];
const TAGS=['news','ambient','hiphop','reggae','salsa','fado','country','funk','disco','metal'];
let genreCountCache={};
async function loadGenreCounts(){
  const slots=document.querySelectorAll('.lcount[data-count]');
  if(!slots.length) return;
  // consultar cada género por separado (endpoint filtrado, ligero) en paralelo
  await Promise.all([...slots].map(async el=>{
    const tag=el.dataset.count.toLowerCase();
    if(genreCountCache[tag]!=null){ setCount(el, genreCountCache[tag]); return; }
    try{
      // /json/tags/{name} devuelve los tags que coinciden con el nombre + su stationcount
      const res = await api('/json/tags/'+encodeURIComponent(tag));
      // tomar la coincidencia exacta si existe, si no, sumar las que empiezan igual
      let n=null;
      if(Array.isArray(res)){
        const exact=res.find(t=>t && t.name && t.name.toLowerCase()===tag);
        if(exact) n=exact.stationcount;
      }
      genreCountCache[tag]=n;
      setCount(el, n);
    }catch{ el.textContent='—'; }
  }));
}
function setCount(el, n){
  el.textContent = (n!=null && n>0) ? n.toLocaleString('en-US') : '—';
}
function renderGenres(mode){
  const grid=$('#genreGrid');
  if(mode==='list'){
    grid.className='glist';
    grid.innerHTML = GENRE_CARDS.map((g,i)=>`
  <button class="lrow" data-tag="${g.tag}" style="animation-delay:${i*35}ms">
    <span class="lthumb"><img src="${g.img}" alt="${g.tag}" loading="lazy"></span>
    <span class="lname">${g.tag}</span>
    <span class="lcount" data-count="${g.tag}">—</span>
    <span class="larrow"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
  </button>`).join('');
    loadGenreCounts();
  } else {
    grid.className='ggrid';
    grid.innerHTML = GENRE_CARDS.map((g,i)=>`
  <button class="gcard has-img" data-tag="${g.tag}" style="background:${g.bg};color:${g.ink};animation-delay:${i*45}ms">
    <span class="motif gimg"><img src="${g.img}" alt="${g.tag}" loading="lazy"></span>
    <span class="led"></span>
    <span class="gname">${g.tag}</span>
    <span class="gcode">${g.code}</span>
  </button>`).join('');
  }
  // re-enganchar clicks de género (abren el drill-down por tag)
  grid.querySelectorAll('[data-tag]').forEach(el=>{
    el.addEventListener('click',()=>loadTag(el.dataset.tag, el));
  });
}
renderGenres((store.get('genreView')||'grid'));
/* toggle grid/lista de Frequencies */
$('#genreView').querySelectorAll('.vbtn').forEach(b=>{
  b.addEventListener('click',()=>{
    const mode=b.dataset.mode;
    $('#genreView').querySelectorAll('.vbtn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    store.set('genreView', mode);
    renderGenres(mode);
  });
});
// reflejar el modo guardado en los iconos al cargar
(function(){ const sv=(store.get('genreView')||'grid');
  $('#genreView').querySelectorAll('.vbtn').forEach(x=>x.classList.toggle('active', x.dataset.mode===sv)); })();
$('#tagChips').innerHTML = TAGS.map(t=>`<button class="chip" data-tag="${t}">${t}</button>`).join('');
/* ---- explore drill-down ---- */
function setShelfActive(el){
  document.querySelectorAll('.chip,.gcard,.mcard,.lcard').forEach(x=>x.classList.remove('active'));
  if(el) el.classList.add('active');
}
function showResults(title){
  $('#exHome').style.display='none';
  $('#exResults').style.display='block';
  $('#resTitle').textContent=title;
  $('#explore').scrollTop=0;
}
$('#exBack').addEventListener('click',()=>{
  $('#exResults').style.display='none';
  $('#exHome').style.display='block';
  setShelfActive(null);
});
function renderResults(list,empty){
  const box=$('#tagResults');
  box.innerHTML = list.length ? list.map((s,i)=>stationCard(s,i,true)).join('') : `<div class="status">${empty}</div>`;
  bindCards(box, list); markPlaying();
}
const SKEL='<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
async function loadTag(tag, srcEl){
  setShelfActive(srcEl);
  showResults('Genre — '+tag);
  $('#tagResults').innerHTML=SKEL;
  const TAG=encodeURIComponent(tag);
  try{
    // 1) US first
    let us=(await api(`/json/stations/search?tag=${TAG}&tagExact=true&countrycode=US&order=clickcount&reverse=true&limit=30&hidebroken=true`))
      .filter(s=>s.url_resolved);
    let list=us;
    // 2) if thin, top up with the rest of the world (no dupes), US kept on top
    if(us.length<8){
      const seen=new Set(us.map(s=>s.stationuuid));
      const world=(await api(`/json/stations/bytagexact/${TAG}?order=clickcount&reverse=true&limit=30&hidebroken=true`))
        .filter(s=>s.url_resolved && !seen.has(s.stationuuid));
      list=us.concat(world).slice(0,30);
    }
    renderResults(list,'No stations found for this tag.');
  }catch{ $('#tagResults').innerHTML='<div class="status">Could not load stations.</div>'; }
}
document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>loadTag(c.dataset.tag,c)));

/* ---- moods (multi-tag blends) ---- */
const MOODS=[
  {id:'chill',   tags:['chillout','lounge','downtempo'],   bg:'#E9E8E5', ink:'#161616', tone:'#3F3B3B', ac:'#E0301E',
   mini:(t,a)=>`<path d="M7 16.5 A7.5 7.5 0 0 1 21 16.5" fill="none" stroke="${t}" stroke-width="3" stroke-linecap="round"/><rect x="4.5" y="15" width="5.5" height="8.5" rx="2.75" fill="${t}"/><rect x="18" y="15" width="5.5" height="8.5" rx="2.75" fill="${a}"/>`},
  {id:'focus',   tags:['classical','piano','instrumental'],bg:'#C9C8C5', ink:'#161616', tone:'#3A3A38', ac:'#E0301E',
   mini:(t,a)=>`<path d="M14 3.5 L21.5 24 H6.5 Z" fill="${t}"/><line x1="14" y1="21" x2="20.5" y2="7.5" stroke="${a}" stroke-width="2.6" stroke-linecap="round"/>`},
  {id:'energy',  tags:['dance','edm','workout'],           bg:'#161616', ink:'#F2F1EF', tone:'#8A8985', ac:'#E0301E',
   mini:(t,a)=>`<rect x="4.5" y="12" width="4.5" height="11" rx="2.25" fill="${t}"/><rect x="11.75" y="4.5" width="4.5" height="18.5" rx="2.25" fill="${a}"/><rect x="19" y="9" width="4.5" height="14" rx="2.25" fill="${t}"/>`},
  {id:'party',   tags:['house','disco','funk'],            bg:'#E0301E', ink:'#FFFFFF', tone:'#FFFFFF', ac:'#161616',
   mini:(t,a,b)=>`<circle cx="14" cy="14" r="10.5" fill="${t}"/><circle cx="14" cy="14" r="4.2" fill="${a}"/><circle cx="14" cy="14" r="1.4" fill="${b}"/>`},
  {id:'romance', tags:['romantic','soul','slow'],          bg:'#959693', ink:'#161616', tone:'#3F3B3B', ac:'#E0301E',
   mini:(t,a)=>`<rect x="13.6" y="5.5" width="2.5" height="12" fill="${t}"/><path d="M16.1 5.5 C20.5 7 21.6 10 20 13.2 C20 9.6 18 8.4 16.1 8.6 Z" fill="${t}"/><path d="M10.5 23 C6.8 20 5.3 17.4 6.8 15.6 C8 14.2 10 14.7 10.5 16.2 C11 14.7 13 14.2 14.2 15.6 C15.7 17.4 14.2 20 10.5 23 Z" fill="${a}"/>`},
  {id:'night',   tags:['synthwave','triphop','darkwave'],  bg:'#161616', ink:'#F2F1EF', tone:'#8A8985', ac:'#E0301E',
   mini:(t,a)=>`<path d="M4 14 Q9 7.5 14 14 T24 14" fill="none" stroke="${t}" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="20" r="2.4" fill="${a}"/>`},
  {id:'morning', tags:['easy listening','pop','acoustic'], bg:'#E9E8E5', ink:'#161616', tone:'#3F3B3B', ac:'#E0301E',
   mini:(t,a,b)=>`<line x1="9" y1="11" x2="17" y2="3.5" stroke="${t}" stroke-width="2.2" stroke-linecap="round"/><rect x="4" y="10.5" width="20" height="13.5" rx="3.5" fill="${t}"/><circle cx="18.5" cy="17.2" r="3.4" fill="${a}"/><rect x="7.5" y="14.2" width="6.5" height="2.2" rx="1.1" fill="${b}"/><rect x="7.5" y="18.4" width="6.5" height="2.2" rx="1.1" fill="${b}"/>`},
  {id:'roots',   tags:['folk','world music','reggae'],     bg:'#3F3B3B', ink:'#FFFFFF', tone:'#9C9B98', ac:'#E0301E',
   mini:(t,a,b)=>`<rect x="14" y="2" width="3" height="13" rx="1.5" fill="${a}" transform="rotate(38 15.5 8)"/><circle cx="14.5" cy="12.5" r="5" fill="${t}"/><circle cx="11" cy="18" r="7" fill="${t}"/><circle cx="11.5" cy="16.5" r="2.5" fill="${b}"/>`}
];
$('#moodShelf').innerHTML = MOODS.map((m,i)=>`
  <button class="mcard" data-mood="${m.id}" style="background:${m.bg};color:${m.ink};animation-delay:${i*40}ms">
    <span class="mini"><svg viewBox="0 0 28 28">${m.mini(m.tone,m.ac,m.bg)}</svg></span>
    <span class="mname">${m.id}</span>
    <span class="mtags">${m.tags.slice(0,2).join(' · ')}</span>
  </button>`).join('');
async function loadMood(m, srcEl){
  setShelfActive(srcEl);
  showResults('Mood — '+m.id);
  $('#tagResults').innerHTML=SKEL;
  try{
    const batches=await Promise.all(m.tags.map(t=>
      api(`/json/stations/bytagexact/${encodeURIComponent(t)}?order=clickcount&reverse=true&limit=14&hidebroken=true`).catch(()=>[])
    ));
    const seen=new Set();
    const merged=batches.flat()
      .filter(st=>st.url_resolved && (seen.has(st.stationuuid)?false:(seen.add(st.stationuuid),true)))
      .sort((a,b)=>(b.clickcount||0)-(a.clickcount||0)).slice(0,30);
    renderResults(merged,'No stations match this mood right now.');
  }catch{ $('#tagResults').innerHTML='<div class="status">Could not load stations.</div>'; }
}
document.querySelectorAll('.mcard').forEach(el=>{
  const m=MOODS.find(x=>x.id===el.dataset.mood);
  el.addEventListener('click',()=>loadMood(m,el));
});

/* ---- languages ---- */
async function loadLanguages(){
  try{
    const langs=(await api('/json/languages'))
      .filter(l=>l.name && /^[a-z ]+$/i.test(l.name) && l.name.length<=14 && l.stationcount>150)
      .sort((a,b)=>b.stationcount-a.stationcount).slice(0,14);
    $('#langShelf').innerHTML = langs.map((l,i)=>{
      const code=(l.iso_639||l.name).slice(0,2).toUpperCase();
      return `<button class="lcard" data-lang="${esc(l.name)}" style="animation-delay:${i*40}ms">
        <span class="lcode"><b>${code[0]||''}</b><span>${code[1]||''}</span></span>
        <span class="lname">${esc(l.name)}</span>
        <span class="lcount">${l.stationcount.toLocaleString('en-US')} st</span>
      </button>`;
    }).join('');
    $('#langShelf').querySelectorAll('.lcard').forEach(el=>{
      el.addEventListener('click',()=>loadLang(el.dataset.lang,el));
    });
  }catch{ $('#langShelf').innerHTML='<div class="status">Could not load languages.</div>'; }
}
async function loadLang(name, srcEl){
  setShelfActive(srcEl);
  showResults('Language — '+name);
  $('#tagResults').innerHTML=SKEL;
  try{
    const r=(await api(`/json/stations/bylanguageexact/${encodeURIComponent(name)}?order=clickcount&reverse=true&limit=30&hidebroken=true`)).filter(s=>s.url_resolved);
    renderResults(r,'No stations found for this language.');
  }catch{ $('#tagResults').innerHTML='<div class="status">Could not load stations.</div>'; }
}

/* =================== Genre constellation =================== */
const GRAPH={
  nodes:[], links:[], stations:[],
  byUuid:new Set(), genreByTag:new Map(),
  cam:{x:0,y:0,z:1}, built:false, active:false,
  autoFit:true, fitT:null, raf:null
};
/* el hint de discover se desvanece tras la primera interacción */
let hintDismissed=false;
function dismissHint(){
  if(hintDismissed) return;
  hintDismissed=true;
  const h=$('#netHint'); if(h) h.classList.add('faded');
}
// también desvanecer al interactuar con el mapa (Leaflet) o cualquier zona de discover
(function(){
  const mv=$('#mapview');
  if(mv) mv.addEventListener('pointerdown',()=>{ dismissHint(); }, true);
})();
const NET_MAX=110;
const net=$('#net'); const nctx=net.getContext('2d');
let netW=0, netH=0, netDPR=1;

function sizeNet(){
  const r=net.getBoundingClientRect();
  if(r.width<10||r.height<10) return; // hidden or not laid out yet — keep last good size
  netDPR=Math.min(window.devicePixelRatio||1,2);
  netW=r.width; netH=r.height;
  net.width=Math.round(netW*netDPR); net.height=Math.round(netH*netDPR);
}
window.addEventListener('resize',()=>{ if(GRAPH.built) sizeNet(); });

function netToast(msg){
  const t=$('#netToast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),2400);
}
function cleanTags(str){
  return (str||'').split(',').map(t=>t.trim().toLowerCase())
    .filter(t=>t && t.length>=3 && t.length<=18).slice(0,3);
}
function addStationNode(st, px, py){
  if(GRAPH.byUuid.has(st.stationuuid)) return null;
  GRAPH.byUuid.add(st.stationuuid);
  GRAPH.stations.push(st);
  const a=Math.random()*Math.PI*2;
  const n={kind:'st', st, x:px+Math.cos(a)*70, y:py+Math.sin(a)*70,
           vx:0, vy:0, r:16, born:performance.now(), expanded:false, img:null};
  if(st.favicon){ n.img=new Image(); n.img.src=st.favicon; }
  GRAPH.nodes.push(n);
  return n;
}
function addGenreNode(tag, px, py){
  if(GRAPH.genreByTag.has(tag)) return GRAPH.genreByTag.get(tag);
  const a=Math.random()*Math.PI*2;
  const n={kind:'tag', tag, x:px+Math.cos(a)*80, y:py+Math.sin(a)*80,
           vx:0, vy:0, r:7, born:performance.now(), busy:false, drained:false};
  GRAPH.genreByTag.set(tag,n);
  GRAPH.nodes.push(n);
  return n;
}
function addLink(a,b,len){
  if(GRAPH.links.some(l=>(l.a===a&&l.b===b)||(l.a===b&&l.b===a))) return;
  GRAPH.links.push({a,b,len:len||85});
}
function expandStation(node){
  if(node.expanded) return;
  node.expanded=true;
  const tags=cleanTags(node.st.tags);
  if(!tags.length){ netToast('This signal carries no genre data'); return; }
  tags.forEach(t=>{ const g=addGenreNode(t,node.x,node.y); addLink(node,g,85); });
}
async function expandGenre(gnode){
  if(gnode.busy) return;
  if(GRAPH.stations.length>=NET_MAX){ netToast('Constellation is full — reset to keep exploring'); return; }
  if(gnode.drained){ netToast(`No new signals in “${gnode.tag}”`); return; }
  gnode.busy=true;
  try{
    const res=prioByCountry((await api(`/json/stations/bytagexact/${encodeURIComponent(gnode.tag)}?order=clickcount&reverse=true&limit=14&hidebroken=true`))
      .filter(s=>s.url_resolved && !GRAPH.byUuid.has(s.stationuuid))).slice(0,5);
    if(!res.length){ gnode.drained=true; netToast(`No new signals in “${gnode.tag}”`); }
    else res.forEach(s=>{ const n=addStationNode(s,gnode.x,gnode.y); if(n) addLink(gnode,n,85); });
  }catch{ netToast('Could not reach the network'); }
  gnode.busy=false;
}
function seedGraph(st){
  GRAPH.nodes=[]; GRAPH.links=[]; GRAPH.stations=[];
  GRAPH.byUuid=new Set(); GRAPH.genreByTag=new Map();
  GRAPH.cam={x:0,y:0,z:1}; GRAPH.autoFit=true;
  const pool = prioByCountry(trendList.filter(s=>cleanTags(s.tags).length));
  const seed = st || (state.idx>=0 ? state.list[state.idx] : null) || pool[0] || trendList[0];
  if(!seed){ netToast('Still tuning the network — try again in a second'); GRAPH.built=false; return; }
  const n=addStationNode(seed,0,0);
  n.x=0; n.y=0;
  expandStation(n);
}
async function buildMap(){ // keeps the tab wiring name
  mapBuilt=true; GRAPH.built=true;
  sizeNet();
  requestAnimationFrame(sizeNet);
  if(!trendList.length){ try{ await loadTrending(); }catch{} }
  seedGraph();
  netLoop();
}

/* ---- physics ---- */
function netStep(){
  const N=GRAPH.nodes;
  for(let i=0;i<N.length;i++){
    const a=N[i];
    for(let j=i+1;j<N.length;j++){
      const b=N[j];
      let dx=a.x-b.x, dy=a.y-b.y;
      let d2=dx*dx+dy*dy; if(d2<1)d2=1;
      if(d2>90000) continue;
      const f=2400/d2, d=Math.sqrt(d2);
      const fx=f*dx/d, fy=f*dy/d;
      a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy;
    }
  }
  for(const l of GRAPH.links){
    let dx=l.b.x-l.a.x, dy=l.b.y-l.a.y;
    const d=Math.sqrt(dx*dx+dy*dy)||1;
    const f=(d-l.len)*0.035;
    const fx=f*dx/d, fy=f*dy/d;
    l.a.vx+=fx; l.a.vy+=fy; l.b.vx-=fx; l.b.vy-=fy;
  }
  for(const n of N){
    if(n===dragNode) { n.vx=0; n.vy=0; continue; }
    n.vx-=n.x*0.0016; n.vy-=n.y*0.0016;
    n.vx*=0.86; n.vy*=0.86;
    const sp=Math.hypot(n.vx,n.vy);
    if(sp>9){ n.vx*=9/sp; n.vy*=9/sp; }
    n.x+=n.vx; n.y+=n.vy;
  }
}
function computeFit(){
  if(GRAPH.nodes.length<1) return null;
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  for(const n of GRAPH.nodes){
    if(n.x<minX)minX=n.x; if(n.x>maxX)maxX=n.x;
    if(n.y<minY)minY=n.y; if(n.y>maxY)maxY=n.y;
  }
  const pad=120, bw=maxX-minX+pad*2, bh=maxY-minY+pad*2;
  if(netW<10||netH<10) sizeNet();
  return {
    z: Math.max(.4, Math.min(1.3, Math.min(netW/bw, netH/bh))),
    x: -(minX+maxX)/2,
    y: -(minY+maxY)/2
  };
}
function netAutoFit(){
  if(!GRAPH.autoFit || GRAPH.nodes.length<2) return;
  const t=computeFit(); if(!t) return;
  GRAPH.cam.z+=(t.z-GRAPH.cam.z)*0.04;
  GRAPH.cam.x+=(t.x-GRAPH.cam.x)*0.04;
  GRAPH.cam.y+=(t.y-GRAPH.cam.y)*0.04;
}
let fitAnim=null;
function fitNow(){
  const t=computeFit(); if(!t) return;
  GRAPH.autoFit=false; clearTimeout(GRAPH.fitT);
  cancelAnimationFrame(fitAnim);
  const from={x:GRAPH.cam.x,y:GRAPH.cam.y,z:GRAPH.cam.z}, t0=performance.now(), dur=600;
  const step=(now)=>{
    const p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3);
    GRAPH.cam.z=from.z+(t.z-from.z)*e;
    GRAPH.cam.x=from.x+(t.x-from.x)*e;
    GRAPH.cam.y=from.y+(t.y-from.y)*e;
    if(p<1) fitAnim=requestAnimationFrame(step);
    else { fitAnim=null; GRAPH.autoFit=true; }
  };
  fitAnim=requestAnimationFrame(step);
}
function pauseAutoFit(){
  GRAPH.autoFit=false;
  cancelAnimationFrame(fitAnim); fitAnim=null;
  clearTimeout(GRAPH.fitT);
  GRAPH.fitT=setTimeout(()=>GRAPH.autoFit=true,7000);
}

/* ---- render ---- */
function netDraw(now){
  nctx.setTransform(netDPR,0,0,netDPR,0,0);
  nctx.clearRect(0,0,netW,netH);
  const {x:cx,y:cy,z}=GRAPH.cam;
  nctx.setTransform(netDPR*z,0,0,netDPR*z, netDPR*(netW/2+cx*z), netDPR*(netH/2+cy*z));
  const playingUuid = state.idx>=0 ? state.list[state.idx]?.stationuuid : null;
  // links
  for(const l of GRAPH.links){
    const hot = (l.a.st&&l.a.st.stationuuid===playingUuid)||(l.b.st&&l.b.st.stationuuid===playingUuid);
    nctx.strokeStyle = hot ? 'rgba(224,48,30,.6)' : 'rgba(26,26,26,.12)';
    nctx.lineWidth = hot ? 1.4 : 1;
    nctx.beginPath(); nctx.moveTo(l.a.x,l.a.y); nctx.lineTo(l.b.x,l.b.y); nctx.stroke();
  }
  // nodes
  for(const n of GRAPH.nodes){
    const age=Math.min(1,(now-n.born)/420), pop=1-Math.pow(1-age,3);
    if(n.kind==='tag'){
      nctx.save(); nctx.translate(n.x,n.y); nctx.rotate(Math.PI/4); nctx.scale(pop,pop);
      nctx.fillStyle = n.drained ? '#C7C7C5' : (n.busy ? '#E0301E' : '#3F3B3B');
      nctx.fillRect(-4.5,-4.5,9,9);
      nctx.restore();
      nctx.font='10px "IBM Plex Mono",monospace';
      nctx.textAlign='center';
      nctx.fillStyle = n.drained ? '#B3B3B0' : '#626060';
      nctx.fillText(n.tag, n.x, n.y+20);
    }else{
      const isPlaying = n.st.stationuuid===playingUuid;
      if(isPlaying){
        const t=(now%1800)/1800;
        nctx.beginPath(); nctx.arc(n.x,n.y,n.r+4+t*22,0,7);
        nctx.strokeStyle=`rgba(224,48,30,${.5*(1-t)})`; nctx.lineWidth=1.5; nctx.stroke();
      }
      nctx.save(); nctx.translate(n.x,n.y); nctx.scale(pop,pop);
      nctx.beginPath(); nctx.arc(0,0,n.r,0,7);
      nctx.fillStyle='#FFFFFF'; nctx.fill();
      nctx.strokeStyle = isPlaying ? '#1A1A1A' : (n.expanded ? '#838079' : '#D1D1D1');
      nctx.lineWidth = isPlaying ? 2 : 1.2; nctx.stroke();
      if(n.img && n.img.complete && n.img.naturalWidth){
        nctx.beginPath(); nctx.arc(0,0,n.r-2.5,0,7); nctx.clip();
        nctx.drawImage(n.img,-(n.r-2.5),-(n.r-2.5),(n.r-2.5)*2,(n.r-2.5)*2);
      }else{
        nctx.font='600 11px "Inter Tight",sans-serif';
        nctx.textAlign='center'; nctx.textBaseline='middle';
        nctx.fillStyle = isPlaying ? '#1A1A1A' : '#8A8985';
        nctx.fillText(initials(n.st.name),0,1);
        nctx.textBaseline='alphabetic';
      }
      nctx.restore();
      nctx.font='10px "Inter",sans-serif';
      nctx.textAlign='center';
      nctx.fillStyle = isPlaying ? '#1A1A1A' : 'rgba(26,26,26,.5)';
      nctx.fillText(truncN(n.st.name,16), n.x, n.y+n.r+15);
    }
  }
}
function netLoop(){
  cancelAnimationFrame(GRAPH.raf);
  const frame=(t)=>{
    if(GRAPH.active){ netStep(); netAutoFit(); netDraw(t); }
    GRAPH.raf=requestAnimationFrame(frame);
  };
  GRAPH.raf=requestAnimationFrame(frame);
}

/* ---- input: drag nodes, pan, pinch, tap ---- */
let dragNode=null, panOn=false, downSX=0, downSY=0, downT=0, movedFar=false;
const pointers=new Map(); let pinchD=0;
function toWorld(sx,sy){
  const {x,y,z}=GRAPH.cam;
  return [ (sx-netW/2)/z - x, (sy-netH/2)/z - y ];
}
function hitNode(wx,wy){
  for(let i=GRAPH.nodes.length-1;i>=0;i--){
    const n=GRAPH.nodes[i];
    const rr=(n.kind==='st'?n.r+6:14);
    if((wx-n.x)**2+(wy-n.y)**2 < rr*rr) return n;
  }
  return null;
}
net.addEventListener('pointerdown',e=>{
  dismissHint();
  gwClose();
  net.setPointerCapture(e.pointerId);
  const r=net.getBoundingClientRect();
  const sx=e.clientX-r.left, sy=e.clientY-r.top;
  pointers.set(e.pointerId,{sx,sy});
  if(pointers.size===2){
    const ps=[...pointers.values()];
    pinchD=Math.hypot(ps[0].sx-ps[1].sx, ps[0].sy-ps[1].sy);
    dragNode=null; panOn=false;
    return;
  }
  downSX=sx; downSY=sy; downT=performance.now(); movedFar=false;
  const [wx,wy]=toWorld(sx,sy);
  dragNode=hitNode(wx,wy);
  panOn=!dragNode;
});
net.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)) return;
  const r=net.getBoundingClientRect();
  const sx=e.clientX-r.left, sy=e.clientY-r.top;
  const prev=pointers.get(e.pointerId);
  pointers.set(e.pointerId,{sx,sy});
  if(pointers.size===2){
    const ps=[...pointers.values()];
    const d=Math.hypot(ps[0].sx-ps[1].sx, ps[0].sy-ps[1].sy);
    if(pinchD>0){
      const mx=(ps[0].sx+ps[1].sx)/2, my=(ps[0].sy+ps[1].sy)/2;
      netZoom(d/pinchD, mx, my);
    }
    pinchD=d; movedFar=true;
    return;
  }
  const dx=sx-prev.sx, dy=sy-prev.sy;
  if(Math.abs(sx-downSX)+Math.abs(sy-downSY)>8) movedFar=true;
  if(dragNode){
    const [wx,wy]=toWorld(sx,sy);
    dragNode.x=wx; dragNode.y=wy;
    pauseAutoFit();
  }else if(panOn){
    GRAPH.cam.x+=dx/GRAPH.cam.z; GRAPH.cam.y+=dy/GRAPH.cam.z;
    pauseAutoFit();
  }
});
['pointerup','pointercancel'].forEach(ev=>net.addEventListener(ev,e=>{
  pointers.delete(e.pointerId);
  if(pointers.size<2) pinchD=0;
  const wasTap = !movedFar && (performance.now()-downT)<400;
  if(wasTap && dragNode){
    const n=dragNode;
    if(n.kind==='st'){
      expandStation(n);
      play(GRAPH.stations, GRAPH.stations.indexOf(n.st));
    }else{
      expandGenre(n);
    }
  }
  dragNode=null; panOn=false;
}));
function netZoom(f, sx, sy){
  const c=GRAPH.cam;
  const wx=(sx-netW/2)/c.z - c.x, wy=(sy-netH/2)/c.z - c.y;
  c.z=Math.max(.3,Math.min(2.4,c.z*f));
  c.x=(sx-netW/2)/c.z - wx; c.y=(sy-netH/2)/c.z - wy;
  pauseAutoFit();
}
net.addEventListener('wheel',e=>{
  e.preventDefault();
  const r=net.getBoundingClientRect();
  netZoom(Math.exp(-e.deltaY*0.0015), e.clientX-r.left, e.clientY-r.top);
},{passive:false});
$('#netReset').addEventListener('click',()=>{
  // reseed desde un país prioritario (US/UK/ES) al azar entre ellos
  const pool=prioByCountry(trendList.filter(s=>cleanTags(s.tags).length));
  const prim=pool.filter(s=>['US','GB','ES'].includes(s.countrycode));
  const pick=(prim.length?prim:pool);
  seedGraph(pick[Math.floor(Math.random()*Math.min(pick.length,5))]);
  netToast('New constellation seeded');
});
$('#netFit').addEventListener('click',fitNow);

/* ---- discover mode toggle: genre web <-> world map ---- */
let mapMode='web', leafMap=null, leafBuilt=false, geoBase=[], geoCurrent=[], mapFilter=null;
const curMarks=new Map(); let activeMark=null;
function renderMapMarkers(list){
  curMarks.forEach(m=>leafMap.removeLayer(m)); curMarks.clear(); activeMark=null;
  geoCurrent=list;
  list.forEach((st,i)=>{
    const m=L.circleMarker([st.geo_lat,st.geo_long],{radius:4.5,color:'#E7E6E3',weight:1,fillColor:'#E7E6E3',fillOpacity:.6});
    m.bindPopup(`<div class="lpop"><strong>${esc(st.name)}</strong><span>${esc(metaLine(st))}</span><button class="lplay" data-i="${i}">▶ Listen</button></div>`);
    m.on('popupopen',e=>{
      e.popup.getElement().querySelector('.lplay').addEventListener('click',()=>play(geoCurrent,i));
    });
    m.addTo(leafMap);
    curMarks.set(st.stationuuid,m);
  });
}
function setDiscMode(mode){
  mapMode=mode;
  document.querySelectorAll('#discToggle button').forEach(b=>b.classList.toggle('on',b.dataset.mode===mode));
  const web = mode==='web', dec = mode==='decades';
  net.style.display = web?'block':'none';
  $('#map').style.display = (mode==='map')?'block':'none';
  $('#mapview').classList.toggle('map-dark', mode==='map');
  $('#app').classList.toggle('app-dark', mode==='map' && $('#mapview').classList.contains('active'));
  $('#decadePanel').style.display = dec?'block':'none';
  document.querySelector('.net-tools').style.display = web?'flex':'none';
  $('#netHint').style.display = (dec || hintDismissed) ? 'none' : 'block';
  $('#netHint').textContent = web ? 'Tap a station to tune · genres grow the map' : 'Tap a signal on the map to tune in';
  GRAPH.active = web && $('#mapview').classList.contains('active');
  if(web){ sizeNet(); }
  else if(mode==='map'){
    if(!leafBuilt) buildLeaf();
    else setTimeout(()=>leafMap.invalidateSize(),60);
  }
  else if(dec){ if(!decBuilt) initDecades(); }
}
const GW_GENRES=['jazz','classical','lofi','electronic','latin','soul','rock','techno','christian','gospel',
  'news','ambient','hiphop','reggae','ska','pop','salsa','fado','country','funk','disco','metal','blues','kpop'];
$('#gwGrid').innerHTML=GW_GENRES.map(t=>`<button data-tag="${t}">${t}</button>`).join('');
let gwCtx='web', lastSeedTag=null;
function gwOpen(ctx){
  gwCtx=ctx;
  $('#gwTitle').textContent = ctx==='web' ? 'Seed the web from a genre' : 'Filter the map by genre';
  $('#gwAll').style.display = ctx==='map' ? 'inline-block' : 'none';
  const cur = ctx==='web' ? lastSeedTag : mapFilter;
  $('#gwGrid').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x.dataset.tag===cur));
  decClose();
  $('#gwDrop').classList.add('open'); $('#mapview').classList.add('gw-open');
}
function gwClose(){ $('#gwDrop').classList.remove('open'); $('#mapview').classList.remove('gw-open'); }
function decOpen(){
  gwClose();
  // marcar el chip activo si ya hay una década seleccionada
  $('#decChips').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x.dataset.dec===decActiveTag));
  $('#decDrop').classList.add('open'); $('#mapview').classList.add('gw-open');
}
function decClose(){ $('#decDrop').classList.remove('open'); if(!$('#gwDrop').classList.contains('open')) $('#mapview').classList.remove('gw-open'); }
$('#gwGrid').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
  gwClose();
  if(gwCtx==='web'){ lastSeedTag=b.dataset.tag; seedGraphFromTag(b.dataset.tag); }
  else mapFilterTag(b.dataset.tag);
}));
$('#gwAll').addEventListener('click',()=>{ gwClose(); mapFilterTag(null); });
async function seedGraphFromTag(tag){
  setDiscMode('web');
  GRAPH.nodes=[]; GRAPH.links=[]; GRAPH.stations=[];
  GRAPH.byUuid=new Set(); GRAPH.genreByTag=new Map();
  GRAPH.cam={x:0,y:0,z:1}; GRAPH.autoFit=true;
  GRAPH.built=true; mapBuilt=true;
  sizeNet(); if(!GRAPH.raf) netLoop();
  GRAPH.active = $('#mapview').classList.contains('active');
  const g=addGenreNode(tag,0,0); g.x=0; g.y=0;
  $('#netHint').textContent=`Web seeded from “${tag}” · tap to grow`;
  await expandGenre(g);
  if(!GRAPH.stations.length) netToast(`No stations found in “${tag}”`);
}
document.querySelectorAll('#discToggle button').forEach(b=>b.addEventListener('click',()=>{
  const mode=b.dataset.mode;
  if(mode==='decades'){
    if(mapMode!=='decades'){ setDiscMode('decades'); gwClose(); decOpen(); }
    else { $('#decDrop').classList.contains('open') ? decClose() : decOpen(); }
    return;
  }
  decClose();
  if(mapMode!==mode){ setDiscMode(mode); gwClose(); }
  else ($('#gwDrop').classList.contains('open') && gwCtx===mode) ? gwClose() : gwOpen(mode);
}));
/* ordena US/UK/ES primero, conserva el resto del mundo después */
const PRIO_CC={US:0, GB:1, ES:2};
function prioByCountry(list){
  return list.slice().sort((a,b)=>{
    const pa = PRIO_CC[a.countrycode] ?? 9, pb = PRIO_CC[b.countrycode] ?? 9;
    if(pa!==pb) return pa-pb;
    return (b.clickcount||0)-(a.clickcount||0);
  });
}
async function buildLeaf(){
  leafBuilt=true;
  if(typeof L==='undefined'){ $('#netHint').textContent='Map failed to load — check connection'; return; }
  leafMap=L.map('map',{zoomControl:false,attributionControl:false,worldCopyJump:true}).setView([24,5],2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:18}).addTo(leafMap);
  setTimeout(()=>leafMap.invalidateSize(),60);
  try{
    geoBase=prioByCountry((await api('/json/stations/search?has_geo_info=true&order=clickcount&reverse=true&limit=600&hidebroken=true'))
      .filter(st=>st.geo_lat && st.geo_long && st.url_resolved));
    if(!mapFilter){
      renderMapMarkers(geoBase);
      $('#netHint').textContent=`${geoBase.length} signals on the map · tap to tune`;
    }
  }catch{ $('#netHint').textContent='Could not load map signals'; }
}
function mapFocus(st){
  if(!leafBuilt || !st) return;
  if(activeMark) activeMark.setStyle({color:'#E7E6E3',fillColor:'#E7E6E3',radius:4.5,fillOpacity:.6});
  const m=curMarks.get(st.stationuuid);
  if(m){ m.setStyle({color:'#E0301E',fillColor:'#E0301E',radius:7,fillOpacity:.85}); activeMark=m; }
  else activeMark=null;
}
async function mapFilterTag(tag){
  mapFilter=tag;
  if(!leafBuilt) buildLeaf();
  if(!tag){
    renderMapMarkers(geoBase);
    $('#netHint').textContent=`${geoBase.length} signals on the map · tap to tune`;
    if(state.idx>=0) mapFocus(state.list[state.idx]);
    return;
  }
  $('#netHint').textContent=`Loading “${tag}” stations…`;
  try{
    const list=prioByCountry((await api(`/json/stations/search?tag=${encodeURIComponent(tag)}&tagExact=true&has_geo_info=true&order=clickcount&reverse=true&limit=400&hidebroken=true`))
      .filter(st=>st.geo_lat && st.geo_long && st.url_resolved));
    renderMapMarkers(list);
    $('#netHint').textContent = list.length ? `${list.length} “${tag}” signals · tap to tune` : `No geo-tagged “${tag}” stations — showing none`;
    if(state.idx>=0) mapFocus(state.list[state.idx]);
  }catch{ $('#netHint').textContent='Could not filter the map'; }
}

/* =================== Search by name =================== */
let nameList=[], nameTimer=null;
let decList=[];
$('#nameInput').addEventListener('input', e=>{
  clearTimeout(nameTimer);
  const q=e.target.value.trim();
  if(q.length<2){ $('#nameResults').innerHTML=''; return; }
  nameTimer=setTimeout(async ()=>{
    $('#nameResults').innerHTML='<div class="skeleton"></div><div class="skeleton"></div>';
    try{
      nameList=(await api(`/json/stations/search?name=${encodeURIComponent(q)}&order=clickcount&reverse=true&limit=30&hidebroken=true`)).filter(s=>s.url_resolved);
      $('#nameResults').innerHTML = nameList.length ? nameList.map((s,i)=>stationCard(s,i,true)).join('') : '<div class="status">No stations match that name.</div>';
      bindCards($('#nameResults'), nameList); markPlaying();
    }catch{ $('#nameResults').innerHTML='<div class="status">Search failed. Try again.</div>'; }
  },350);
});

/* =================== Countries =================== */
let countries=[], countryStationList=[];
async function loadCountries(){
  try{
    countries = (await api('/json/countries')).filter(c=>c.iso_3166_1 && c.stationcount>2)
      .sort((a,b)=>b.stationcount-a.stationcount);
    renderCountries(countries.slice(0,40));
  }catch{ $('#countryList').innerHTML='<div class="status">Could not load countries.</div>'; }
}
function renderCountries(list){
  $('#countryList').innerHTML = list.map(c=>`
    <div class="country" data-cc="${c.iso_3166_1}" data-name="${esc(c.name)}">
      <span class="flag">${flag(c.iso_3166_1)}</span>
      <span class="cname">${esc(c.name)}</span>
      <span class="count">${c.stationcount.toLocaleString('en-US')}</span>
    </div>`).join('');
  $('#countryList').querySelectorAll('.country').forEach(el=>{
    el.addEventListener('click',()=>openCountry(el.dataset.cc, el.dataset.name));
  });
}
$('#countryInput').addEventListener('input', e=>{
  const q=e.target.value.trim().toLowerCase();
  renderCountries(q ? countries.filter(c=>c.name.toLowerCase().includes(q)).slice(0,40) : countries.slice(0,40));
});
async function openCountry(cc,name){
  $('#countryList').style.display='none';
  $('#countryInput').parentNode.style.display='none';
  const box=$('#countryStations');
  box.innerHTML=`<button class="backbtn" id="backCountries">← All countries</button>
    <div class="section-label">${flag(cc)} ${esc(name)}</div>
    <div class="rowlist" id="ccList"><div class="skeleton"></div><div class="skeleton"></div></div>`;
  $('#backCountries').addEventListener('click',()=>{
    box.innerHTML=''; $('#countryList').style.display=''; $('#countryInput').parentNode.style.display='';
  });
  try{
    countryStationList=(await api(`/json/stations/bycountrycodeexact/${cc}?order=clickcount&reverse=true&limit=60&hidebroken=true`)).filter(s=>s.url_resolved);
    $('#ccList').innerHTML = countryStationList.map((s,i)=>stationCard(s,i,true)).join('');
    bindCards($('#ccList'), countryStationList); markPlaying();
  }catch{ $('#ccList').innerHTML='<div class="status">Could not load stations.</div>'; }
}

/* =================== Rotary dial =================== */
const DIAL={open:false,list:[],pos:0,step:30,M:12,raf:null,snapT:null};
function dmod(k,n){return ((k%n)+n)%n}
function truncN(s,n=14){s=s||'';return s.length>n?s.slice(0,n-1)+'…':s}
function dialOpen(list, idx){
  if(!list || !list.length) return;
  DIAL.list=list;
  DIAL.M=Math.min(list.length,16);
  DIAL.step=360/DIAL.M;
  DIAL.pos=idx;
  DIAL.open=true;
  $('#dialscr').classList.add('open');
  $('#dialscr').setAttribute('aria-hidden','false');
  dialRender(); dialCenter(dmod(idx,list.length));
}
function dialClose(){
  DIAL.open=false; cancelSnap();
  $('#dialscr').classList.remove('open');
  $('#dialscr').setAttribute('aria-hidden','true');
}
$('#dialClose').addEventListener('click',dialClose);

let dragMoved=false;
/* anillo circular: las emisoras se distribuyen alrededor; la activa queda arriba (12 en punto).
   STEP grados por emisora; ticks finos subdividen cada paso. */
/* ── dial radial: semicírculo abajo, estaciones como "slices", activa en rojo ── */
const TUNER={cx:300, cy:340, r1:208, r2:298, num:255, lab:316};
function dpolar(cx,cy,r,a){const t=a*Math.PI/180;return [cx+r*Math.cos(t),cy+r*Math.sin(t)]}
function segPath(cx,cy,r1,r2,a0,a1){
  const [x0,y0]=dpolar(cx,cy,r2,a0),[x1,y1]=dpolar(cx,cy,r2,a1),
        [x2,y2]=dpolar(cx,cy,r1,a1),[x3,y3]=dpolar(cx,cy,r1,a0);
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r2} ${r2} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} A ${r1} ${r1} 0 0 0 ${x3.toFixed(1)} ${y3.toFixed(1)} Z`;
}
function dnorm(a){return ((a+540)%360)-180}
function dialRender(){
  const N=DIAL.list.length, M=DIAL.M, st=DIAL.step;
  const base=Math.round(DIAL.pos), half=Math.floor(M/2);
  let html='';
  for(let k=base-half; k<base-half+M; k++){
    const a=-90+dnorm((k-DIAL.pos)*st);   // aguja fija a las 12 en punto
    if(a<-200 || a>20) continue;           // recortar bajo el horizonte
    const a0=a-st/2+1.6, a1=a+st/2-1.6;
    const li=dmod(k,N), s=DIAL.list[li], off=k-base;
    let fill='#ECEBE9', op=1, txtFill='#B5B4B1', labFill='#B5B4B1', labW='400';
    if(off===0){ fill='#E0301E'; txtFill='#FFFFFF'; labFill='#1A1A1A'; labW='600'; }  // activa en ROJO
    else if(off===-1){fill='#1A1A1A';op=.30;txtFill='#FFF'}
    else if(off===-2){fill='#1A1A1A';op=.14;txtFill='#FFF'}
    else if(off===-3){fill='#1A1A1A';op=.06;txtFill='#FFF'}
    html+=`<path class="seg" data-k="${k}" d="${segPath(TUNER.cx,TUNER.cy,TUNER.r1,TUNER.r2,a0,a1)}" fill="${fill}" opacity="${op}"/>`;
    const [nx,ny]=dpolar(TUNER.cx,TUNER.cy,TUNER.num,a);
    html+=`<text class="segnum" x="${nx.toFixed(1)}" y="${ny.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="${txtFill}" transform="rotate(${(a+90).toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)})">${String(li+1).padStart(2,'0')}</text>`;
    const [lx,ly]=dpolar(TUNER.cx,TUNER.cy,TUNER.lab,a);
    html+=`<text class="seglab" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="${labFill}" font-weight="${labW}" transform="rotate(${(a+90).toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})">${esc(truncN(s.name,13))}</text>`;
  }
  const g=$('#dialSegs');
  g.innerHTML=html;
  g.querySelectorAll('.seg').forEach(p=>p.addEventListener('click',()=>{ if(!dragMoved) dialAnimateTo(+p.dataset.k); }));
}
function dialCenter(li){
  const s=DIAL.list[li]; if(!s) return;
  $('#npName').textContent=s.name;
  $('#npFreq').innerHTML=`<b>${hashFreq(s.stationuuid)}</b><span> MHz</span>`;
  $('#npMeta').textContent=metaLine(s)+(s.bitrate?` · ${s.bitrate}kbps`:'');
  $('#npArt').innerHTML=artHTML(s);
  const isCurrent = state.list===DIAL.list && state.idx===li;
  $('#npState').textContent = isCurrent ? (state.playing?'on air':'paused') : 'release to tune';
}
function dialAnimateTo(k, silent=false){
  cancelSnap();
  const from=DIAL.pos, dist=k-from, t0=performance.now(), dur=480;
  function tick(t){
    const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3);
    DIAL.pos=from+dist*e; dialRender();
    if(p<1){ DIAL.raf=requestAnimationFrame(tick); }
    else{
      DIAL.pos=k; DIAL.raf=null;
      const li=dmod(k,DIAL.list.length);
      if(!silent) play(DIAL.list, li); else dialCenter(li);
    }
  }
  DIAL.raf=requestAnimationFrame(tick);
}
function cancelSnap(){ if(DIAL.raf){cancelAnimationFrame(DIAL.raf);DIAL.raf=null;} clearTimeout(DIAL.snapT); }

const wrap=$('#wheelwrap');
let dialDragging=false, prevAng=0;
function evAngle(e){
  const svg=$('#dialSvg').getBoundingClientRect();
  const k=svg.width/600;                   // escala viewBox(600)→pantalla
  const cx=svg.left+TUNER.cx*k, cy=svg.top+TUNER.cy*k;
  return Math.atan2(e.clientY-cy, e.clientX-cx)*180/Math.PI;
}
wrap.addEventListener('pointerdown',e=>{
  dialDragging=true; dragMoved=false; prevAng=evAngle(e);
  cancelSnap(); wrap.setPointerCapture(e.pointerId);
});
wrap.addEventListener('pointermove',e=>{
  if(!dialDragging) return;
  const a=evAngle(e); let d=dnorm(a-prevAng);
  prevAng=a;
  if(Math.abs(d)>0.5) dragMoved=true;
  const before=Math.round(DIAL.pos);
  DIAL.pos-=d/DIAL.step;                    // arrastrar el dial radial
  const now=Math.round(DIAL.pos);
  if(now!==before){
    dialCenter(dmod(now,DIAL.list.length));
    if(navigator.vibrate) navigator.vibrate(4);
  }
  dialRender();
});
['pointerup','pointercancel'].forEach(ev=>wrap.addEventListener(ev,()=>{
  if(!dialDragging) return;
  dialDragging=false;
  if(dragMoved) dialAnimateTo(Math.round(DIAL.pos));
}));
wrap.addEventListener('wheel',e=>{
  if(!DIAL.open) return;
  e.preventDefault(); cancelSnap();
  DIAL.pos+=e.deltaY*0.005;
  dialCenter(dmod(Math.round(DIAL.pos),DIAL.list.length));
  dialRender();
  DIAL.snapT=setTimeout(()=>dialAnimateTo(Math.round(DIAL.pos)),180);
},{passive:false});
document.addEventListener('keydown',e=>{
  if(!DIAL.open) return;
  if(e.key==='ArrowRight') dialAnimateTo(Math.round(DIAL.pos)+1);
  if(e.key==='ArrowLeft') dialAnimateTo(Math.round(DIAL.pos)-1);
  if(e.key==='Escape') dialClose();
});
$('#npPlay').addEventListener('click',togglePlay);

function openDialFromDock(){
  const list = state.list.length ? state.list : trendList;
  if(!list.length) return;
  dialOpen(list, state.idx>=0 ? state.idx : 0);
}
document.querySelector('#dock .dial').addEventListener('click',openDialFromDock);
$('#dockArt').addEventListener('click',openDialFromDock);
document.querySelector('#dock .info').addEventListener('click',openDialFromDock);

/* =================== UX: favourites, volume, sleep, keys, coach =================== */
$('#favBtn').addEventListener('click',()=>toggleCurrentFav($('#favBtn')));
$('#dialFav').addEventListener('click',()=>toggleCurrentFav($('#dialFav')));

const volRange=$('#volRange');
const savedVol=store.get('vol',100);
audio.volume=savedVol/100; volRange.value=savedVol;
volRange.addEventListener('input',()=>{ audio.volume=volRange.value/100; store.set('vol',+volRange.value); });

let sleepT=null, sleepTick=null, sleepEnd=0;
function clearSleep(){
  clearTimeout(sleepT); clearInterval(sleepTick);
  $('#sleepLeft').textContent='';
  document.querySelectorAll('.schip').forEach(x=>x.classList.remove('on'));
}
document.querySelectorAll('.schip').forEach(b=>b.addEventListener('click',()=>{
  const wasOn=b.classList.contains('on');
  clearSleep();
  if(wasOn) return;
  b.classList.add('on');
  const ms=(+b.dataset.min)*60000;
  sleepEnd=Date.now()+ms;
  sleepT=setTimeout(()=>{
    audio.pause(); state.playing=false; refreshPlayUI();
    setDockStatus('Sleep timer ended — paused');
    clearSleep();
  },ms);
  const tick=()=>{ $('#sleepLeft').textContent=Math.max(1,Math.ceil((sleepEnd-Date.now())/60000))+' min'; };
  tick(); sleepTick=setInterval(tick,20000);
}));

document.addEventListener('keydown',e=>{
  if(e.target.closest('input,textarea')) return;
  if(e.code==='Space'){ e.preventDefault(); togglePlay(); return; }
  if(DIAL.open) return;
  if(e.key==='ArrowRight') $('#nextBtn').click();
  if(e.key==='ArrowLeft') $('#prevBtn').click();
});

let coached=store.get('coach',false);
audio.addEventListener('playing',()=>{
  if(coached) return;
  coached=true; store.set('coach',true);
  const c=$('#coach'); c.classList.add('show');
  setTimeout(()=>c.classList.remove('show'),5200);
});

/* =================== Boot =================== */
loadStats(); loadTrending(); loadCountries(); loadLanguages();


/* ════ auth ════ */
(function(){
  const scr = $('#authScr'); if(!scr) return;
  const u0 = store.get('user', null);
  /* bypass de desarrollo: abrir con #skip entra como guest sin llenar nada */
  if(location.hash.toLowerCase().includes('skip')){
    store.set('user', { name:'Guest', email:null, guest:true });
    updateProfileUI();
    scr.remove(); return;
  }
  if(u0){ scr.remove(); return; }

  /* dial 87.5–108.0 duplicado para loop infinito (42 celdas x 84px = 3528px) */
  const fr=[]; for(let f=875; f<=1080; f+=5) fr.push((f/10).toFixed(1));
  const cells = fr.map(f=>`<span class="au-f">${f}</span>`).join('');
  $('#auStrip').innerHTML = cells + cells;

  let mode = 'signup';
  function setMode(m){
    mode = m;
    scr.classList.toggle('login', m==='login');
    $('#auTgIn').classList.toggle('on', m==='login');
    $('#auTgUp').classList.toggle('on', m==='signup');
    $('#auTgIn').setAttribute('aria-selected', m==='login');
    $('#auTgUp').setAttribute('aria-selected', m==='signup');
    $('#auCta').textContent = m==='login' ? 'Sign in' : 'Create account';
    $('#auErr').style.display = 'none';
  }
  $('#auTgUp').onclick = ()=>setMode('signup');
  $('#auTgIn').onclick = ()=>setMode('login');
  setMode('signup');

  function finish(u){
    store.set('user', u);
    updateProfileUI();
    scr.classList.add('hide');
    setTimeout(()=>scr.remove(), 550);
  }
  $('#auForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const name = $('#auName').value.trim();
    const email = $('#auEmail').value.trim();
    const pass = $('#auPass').value;
    const err = t => { const el=$('#auErr'); el.textContent=t; el.style.display='block'; };
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err('Enter a valid email.');
    if(pass.length < 6) return err('Password needs at least 6 characters.');
    if(mode==='signup' && !name) return err('Add your name to create the account.');
    try {
      const mod = await import('./api/supabase.js');
      if (mod.getSupabase()) {
        const res = mode === 'login'
          ? await mod.signIn(email, pass)
          : await mod.signUp(email, pass);
        if (res.error) return err(res.error.message || 'Auth failed.');
        finish({ name: name || email.split('@')[0], email, guest: false });
        return;
      }
    } catch (ex) {
      return err(ex.message || 'Auth unavailable.');
    }
    // Fallback local prototype auth when Supabase env is not set
    finish({ name: name || email.split('@')[0], email, guest: false });
  });
  $('#auGuest').onclick = ()=>finish({ name:'Guest', email:null, guest:true });
})();

/* ════ profile (must boot with main app — not Creator-only) ════ */
function updateProfileUI(){
  const u = store.get('user', null);
  const ini = u ? (u.name||'?').trim().charAt(0).toUpperCase() : '·';
  const photo = u && u.photo ? u.photo : null;
  const ava = photo ? `<img src="${photo}" alt="">` : ini;
  $('#pfAva').innerHTML = ava;
  const hdrAva = $('#hdrAva');
  if (hdrAva) hdrAva.innerHTML = ava;
  $('#pfName').textContent = u ? u.name : 'Not signed in';
  $('#pfMail').textContent = u ? (u.guest ? 'Guest session' : u.email) : '—';
  const premium = (() => {
    try {
      const p = store.get('profile', null);
      return p?.subscription_status === 'active' ||
        (p?.premium_until && new Date(p.premium_until) > new Date());
    } catch { return false; }
  })();
  const upgrade = $('#upgradeBtn');
  const manage = $('#manageSubBtn');
  if (upgrade) upgrade.hidden = !!premium;
  if (manage) manage.hidden = !premium;
}
window.updateProfileUI = updateProfileUI;
(function initProfileSheet(){
  const scr = $('#profScr');
  if (!scr || !$('#profBtn')) return;
  $('#profBtn').onclick = ()=>{ updateProfileUI(); scr.hidden = false; };
  $('#pfClose').onclick = ()=>{ scr.hidden = true; };
  $('#pfRename').onclick = ()=>{
    const u = store.get('user', null); if(!u) return;
    const name = prompt('Display name', u.name);
    if(name && name.trim()){ u.name = name.trim().slice(0,24); store.set('user', u); updateProfileUI(); }
  };
  const photoInp = $('#pfPhoto');
  const photoBtn = $('#pfPhotoBtn');
  const pfAva = $('#pfAva');
  const pickPhoto = () => { if (photoInp) photoInp.click(); };
  if (photoBtn) photoBtn.addEventListener('click', pickPhoto);
  if (pfAva) pfAva.addEventListener('click', pickPhoto);
  if (photoInp) {
    photoInp.addEventListener('change', () => {
      const f = photoInp.files && photoInp.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const img = new Image();
        img.onload = () => {
          const S = 256;
          const c = document.createElement('canvas');
          c.width = S; c.height = S;
          const x = c.getContext('2d');
          const s = Math.min(img.width, img.height);
          const sx = (img.width - s) / 2;
          const sy = (img.height - s) / 2;
          x.drawImage(img, sx, sy, s, s, 0, 0, S, S);
          let data;
          try { data = c.toDataURL('image/jpeg', 0.85); } catch { return; }
          const u = store.get('user', null) || { name: 'Guest', guest: true };
          u.photo = data;
          store.set('user', u);
          updateProfileUI();
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(f);
      photoInp.value = '';
    });
  }
  $('#pfClearLib').onclick = ()=>{
    if(!confirm('Clear all favourites and recents?')) return;
    favs = []; recents = [];
    store.set('favs', favs); store.set('recents', recents);
    renderLibrary();
    updateFavUI();
  };
  $('#pfReset').onclick = ()=>{
    if(!confirm('Reset everything? Account, library, station and tapes will be wiped.')) return;
    try{ Object.keys(localStorage).filter(k=>k.startsWith('dome:')).forEach(k=>localStorage.removeItem(k)); }catch{}
    try{ indexedDB.deleteDatabase('dome-studio'); }catch{}
    location.reload();
  };
  $('#pfOut').onclick = ()=>{
    store.set('user', null);
    import('./api/supabase.js').then((m) => m.signOut?.()).catch(() => {});
    location.reload();
  };
  updateProfileUI();
})();

/* ════ decades (Discover) — was stranded in Creator legacy ════ */
let decBuilt=false, decActiveTag=null;
const DECADES=[
  {label:'50s', yr:'1950s', tags:['50s','oldies','rock and roll','doo wop']},
  {label:'60s', yr:'1960s', tags:['60s','oldies','classic rock','soul']},
  {label:'70s', yr:'1970s', tags:['70s','classic rock','disco','funk']},
  {label:'80s', yr:'1980s', tags:['80s','new wave','synthpop']},
  {label:'90s', yr:'1990s', tags:['90s','grunge','eurodance']}
];
function initDecades(){
  decBuilt=true;
  $('#decChips').innerHTML = DECADES.map(d=>
    `<button data-dec="${d.label}">${d.label}<span class="yr">${d.yr}</span></button>`).join('');
  $('#decChips').querySelectorAll('button').forEach(b=>
    b.addEventListener('click',()=>{ decClose(); loadDecade(b.dataset.dec, b); }));
}
async function loadDecade(label){
  const dec=DECADES.find(d=>d.label===label); if(!dec) return;
  decActiveTag=label;
  $('#decChips').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.dec===label));
  $('#decHint').textContent = `Loading ${dec.yr} stations…`;
  $('#decResults').innerHTML = SKEL;
  try{
    const batches = await Promise.all(dec.tags.map(t=>
      api(`/json/stations/bytagexact/${encodeURIComponent(t)}?order=clickcount&reverse=true&limit=20&hidebroken=true`).catch(()=>[])
    ));
    const seen=new Set();
    const merged = prioByCountry(
      batches.flat().filter(st=>st.url_resolved && (seen.has(st.stationuuid)?false:(seen.add(st.stationuuid),true)))
    ).slice(0,30);
    decList = merged;
    $('#decHint').textContent = merged.length ? `${dec.yr} · ${merged.length} stations on air` : '';
    $('#decResults').innerHTML = merged.length
      ? merged.map((st,i)=>stationCard(st,i,true)).join('')
      : `<div class="status">No ${dec.yr} stations found right now.</div>`;
    bindCards($('#decResults'), decList); markPlaying();
  }catch{ $('#decResults').innerHTML='<div class="status">Could not load stations.</div>'; }
}

// Expose shared helpers for frozen creator module
window.__dome = {
  store,
  api,
  $,
  play,
  slimSt,
  esc,
  artHTML,
  audio,
  flag,
  state,
  get favs(){ return favs; },
  set favs(v){ favs = v; },
  get recents(){ return recents; },
  set recents(v){ recents = v; },
  renderLibrary,
  updateFavUI,
};

initMediaSession(() => ({
  playPause: () => playBtn && playBtn.click(),
  next: () => document.getElementById('nextBtn')?.click(),
  prev: () => document.getElementById('prevBtn')?.click(),
  stop: () => {
    audio.pause();
    state.playing = false;
    setMediaPlaybackState(false);
  },
}));

// Creator/Studio remains frozen — Broadcast control shows a toast only (see activateView)
export async function ensureCreator() {
  await import('./views/creator/legacy.js');
}

export { state, play, store, api, $ };
