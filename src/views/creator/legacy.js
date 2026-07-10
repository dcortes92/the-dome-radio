/* eslint-disable */
/* Creator/Studio/On-air — uses globals from window.__dome set by main app */
const { store, $, play, slimSt, esc, artHTML, api, audio, flag } = window.__dome;

/* ════ studio ════ */
(function(){
  const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let st = store.get('mystation', null);
  let editMode = false;
  let eps = [];
  let rec = null, recT0 = 0, recTimer = null, vuRAF = 0, mediaStream = null, chunks = [];
  let lastURL = null;

  /* ---- IndexedDB para las cintas ---- */
  const idb = {
    db: null,
    open(){ return new Promise((res,rej)=>{
      const r = indexedDB.open('dome-studio', 1);
      r.onupgradeneeded = e => e.target.result.createObjectStore('eps', { keyPath:'id' });
      r.onsuccess = e => { idb.db = e.target.result; res(); };
      r.onerror = () => rej(r.error);
    });},
    put(ep){ return new Promise((res,rej)=>{ const t=idb.db.transaction('eps','readwrite'); t.objectStore('eps').put(ep); t.oncomplete=res; t.onerror=()=>rej(t.error); }); },
    all(){ return new Promise((res,rej)=>{ const r=idb.db.transaction('eps').objectStore('eps').getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); }); },
    del(id){ return new Promise(res=>{ const t=idb.db.transaction('eps','readwrite'); t.objectStore('eps').delete(id); t.oncomplete=res; }); },
    clear(){ return new Promise(res=>{ const t=idb.db.transaction('eps','readwrite'); t.objectStore('eps').clear(); t.oncomplete=res; }); }
  };
  const loadEps = () => idb.all().then(a=>{ eps = a.sort((x,y)=>y.id-x.id); });

  const fmtFreq = f => { const p=Number(f).toFixed(1).split('.'); return `<b>${p[0]}</b><i>.${p[1]} FM</i>`; };
  const callsign = name => 'R' + (name.replace(/[^a-zA-Z]/g,'').slice(0,3).toUpperCase() || 'DOM');
  const fmtClock = sec => `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(Math.floor(sec%60)).padStart(2,'0')}`;
  const fmtDate = ts => new Date(ts).toLocaleDateString('en-GB',{day:'2-digit',month:'short'});

  function mins(t){ const a=t.split(':'); return (+a[0])*60 + (+a[1]); }
  function liveShow(){
    if(!st || !st.shows.length) return null;
    const now = new Date(); const d = now.getDay(); const m = now.getHours()*60+now.getMinutes();
    return st.shows.find(sh => {
      const s0 = mins(sh.start), s1 = s0 + sh.dur;
      if(sh.days.includes(d) && m >= s0 && m < s1) return true;
      const yd = (d+6)%7;
      return sh.days.includes(yd) && s1 > 1440 && m < s1-1440;
    }) || null;
  }
  function nextShow(){
    if(!st || !st.shows.length) return null;
    const now = new Date(); const today = now.getDay(); const m = now.getHours()*60+now.getMinutes();
    let best = null;
    st.shows.forEach(sh => sh.days.forEach(d => {
      let delta = ((d - today + 7) % 7) * 1440 + mins(sh.start) - m;
      if(delta < 0) delta += 7*1440;
      if(!best || delta < best.delta) best = { sh, d, delta };
    }));
    return best;
  }

  /* ---- reproducir una cinta por el player real ---- */
  function playEp(ep){
    if(lastURL) URL.revokeObjectURL(lastURL);
    lastURL = URL.createObjectURL(ep.blob);
    const pseudo = {
      stationuuid: 'own:'+ep.id,
      name: st.name + ' — ' + ep.title,
      url: lastURL, url_resolved: lastURL,
      favicon: '', country: 'Your studio', countrycode: 'YOU',
      tags: 'studio', bitrate: 0, ownFreq: st.freq
    };
    play([pseudo], 0);
  }

  /* ---- grabación con micrófono ---- */
  async function startRec(){
    const err = t => { const el=$('#boErr'); el.textContent=t; el.style.display='block'; };
    try{
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio:true });
    }catch(e){
      return err(e && e.name==='NotAllowedError' ? 'Microphone access denied — allow it to record.' : 'Microphone unavailable on this device.');
    }
    $('#boErr').style.display='none';
    chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
    rec = new MediaRecorder(mediaStream, mime ? { mimeType:mime } : undefined);
    rec.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
    rec.onstop = saveRec;
    rec.start(250);
    recT0 = Date.now();
    $('#boRec').classList.add('rec');
    $('#boState').textContent = 'Recording';
    recTimer = setInterval(()=>{ const el=$('#boTime'); if(el) el.textContent = fmtClock((Date.now()-recT0)/1000); }, 250);
    const AC = window.AudioContext || window.webkitAudioContext;
    if(AC){
      const ac = new AC();
      const srcNode = ac.createMediaStreamSource(mediaStream);
      const an = ac.createAnalyser(); an.fftSize = 64; srcNode.connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const cv = $('#boVu'); const ctx = cv.getContext('2d');
      const draw = () => {
        an.getByteFrequencyData(data);
        ctx.clearRect(0,0,cv.width,cv.height);
        for(let k=0;k<7;k++){
          const v = data[Math.floor(k*data.length/7)]/255;
          const h = Math.max(3, v*cv.height);
          ctx.fillStyle = k>4 ? '#E0301E' : '#8A8986';
          ctx.fillRect(k*(cv.width/7)+2, cv.height-h, cv.width/7-5, h);
        }
        vuRAF = requestAnimationFrame(draw);
      };
      draw();
      rec._ac = ac;
    }
  }
  function stopRec(){ if(rec && rec.state!=='inactive') rec.stop(); }
  async function saveRec(){
    clearInterval(recTimer); cancelAnimationFrame(vuRAF);
    mediaStream.getTracks().forEach(t=>t.stop());
    if(rec._ac) rec._ac.close();
    const dur = Math.round((Date.now()-recT0)/1000);
    const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
    const titleEl = $('#boTitle');
    const title = (titleEl && titleEl.value.trim()) || ('Episode ' + (eps.length+1));
    rec = null;
    if(dur < 2){ render(); return; }
    await idb.put({ id: Date.now(), title, dur, size: blob.size, blob });
    await loadEps();
    render();
  }

  function render(){
    const empty=$('#stEmpty'), wiz=$('#stWizard'), home=$('#stHome');
    if(rec) stopRec();
    if(!st && !editMode){ empty.style.display='block'; wiz.style.display='none'; home.style.display='none'; return; }
    if(editMode){
      empty.style.display='none'; home.style.display='none'; wiz.style.display='block';
      $('#stName').value = st ? st.name : '';
      $('#stTag').value = st ? st.tagline : '';
      $('#stFreq').value = st ? st.freq : 99.9;
      $('#stCancel').style.display = st ? 'block' : 'none';
      $('#stFreqView').innerHTML = fmtFreq($('#stFreq').value);
      $('#stErr').style.display='none';
      return;
    }
    empty.style.display='none'; wiz.style.display='none'; home.style.display='block';
    const live = liveShow(); const nx = nextShow();
    const tape = eps.find(e=>e.id===st.tapeId) || eps[0] || null;
    const statusTxt = live
      ? 'On air — ' + live.title
      : nx ? ('Off air — next: ' + DAYS[nx.d] + ' ' + nx.sh.start) : 'Off air — no shows scheduled';
    home.innerHTML = `
      <div class="st-card${live?' onair':''}">
        <span class="led"></span>
        <div class="st-call">${callsign(st.name)} &middot; your frequency</div>
        <div class="st-freq">${fmtFreq(st.freq)}</div>
        <div class="st-name">${st.name}</div>
        ${st.tagline?`<div class="st-tagline">${st.tagline}</div>`:''}
        <div class="st-status"><span>&#9679;</span>${statusTxt}</div>
        ${live && tape ? `<button class="st-live" id="stListen"><svg viewBox="0 0 16 16"><path d="M3 2l11 6-11 6z"/></svg>Listen live &mdash; ${tape.title}</button>` : ''}
        <div class="st-actions">
          <button id="stEdit">Edit station</button>
          <button id="stDrop">Shut down</button>
        </div>
      </div>

      <div class="section-label"><span class="idx">02</span>Recording booth</div>
      <div class="bo-wrap">
        <div class="bo-row">
          <button class="bo-rec" id="boRec" aria-label="Record"><span></span></button>
          <div class="bo-mid">
            <div class="bo-state" id="boState">Ready</div>
            <div class="bo-time" id="boTime">00:00</div>
          </div>
          <canvas class="bo-vu" id="boVu" width="64" height="34"></canvas>
        </div>
        <div class="bo-title"><input id="boTitle" type="text" maxlength="40" placeholder="Episode title (set it before you stop)"></div>
        <p class="bo-err" id="boErr"></p>
      </div>

      <div class="section-label"><span class="idx">03</span>Tape archive</div>
      <div id="epList">${eps.length ? eps.map(ep=>`
        <div class="ep-row">
          <button class="ep-play" data-id="${ep.id}" aria-label="Play episode"><svg viewBox="0 0 16 16"><path d="M3 2l11 6-11 6z"/></svg></button>
          <div class="ep-info">
            <div class="ep-title">${ep.title}</div>
            <div class="ep-meta">${fmtDate(ep.id)} &middot; ${fmtClock(ep.dur)} &middot; ${(ep.size/1048576).toFixed(1)} MB</div>
          </div>
          <button class="ep-tape${(st.tapeId===ep.id)||(!st.tapeId&&eps[0]===ep)?' on':''}" data-id="${ep.id}" title="Set as live tape">&#9733;</button>
          <button class="ep-del" data-id="${ep.id}" aria-label="Delete episode">&times;</button>
        </div>`).join('') : '<div class="sh-empty">No tapes yet &mdash; hit record and say hello to the world.</div>'}
      </div>

      <div class="section-label"><span class="idx">04</span>Programming</div>
      <div id="shList">${st.shows.length ? st.shows.map((sh,i)=>`
        <div class="sh-row${live===sh?' live':''}">
          <span class="sh-dot"></span>
          <div class="sh-info">
            <div class="sh-title">${sh.title}</div>
            <div class="sh-meta">${sh.days.map(d=>DAYS[d]).join(' ')} &middot; ${sh.start} &middot; ${sh.dur} min</div>
          </div>
          <button class="sh-del" data-i="${i}" aria-label="Delete show">&times;</button>
        </div>`).join('') : '<div class="sh-empty">No shows yet &mdash; your air time awaits.</div>'}
      </div>
      <div class="sh-form">
        <div class="au-field" style="margin-top:0"><label for="shTitle">Show title</label>
          <input id="shTitle" type="text" maxlength="40" placeholder="Tuesday Deep Dive" style="background:#fff;border:1px solid #DDDCD8;color:#161616"></div>
        <div class="sh-days" id="shDays">${DAYS.map((d,i)=>`<button type="button" data-d="${i}">${d}</button>`).join('')}</div>
        <div class="sh-grid">
          <input id="shTime" type="time" value="21:00">
          <select id="shDur"><option value="30">30 min</option><option value="60" selected>60 min</option><option value="90">90 min</option><option value="120">120 min</option></select>
        </div>
        <p class="au-err" id="shErr"></p>
        <button class="st-cta" id="shAdd" style="margin-top:14px">Add to schedule</button>
      </div>`;

    $('#stEdit').onclick = ()=>{ editMode=true; render(); };
    $('#stDrop').onclick = async ()=>{
      if(confirm('Shut down your station? Schedule and tapes will be lost.')){
        st=null; store.set('mystation',null);
        await idb.clear(); await loadEps(); render();
      }
    };
    const listen = $('#stListen');
    if(listen) listen.onclick = ()=>playEp(tape);
    $('#boRec').onclick = ()=>{ rec ? stopRec() : startRec(); };
    home.querySelectorAll('.ep-play').forEach(b=>b.onclick=()=>{ const ep=eps.find(x=>x.id===+b.dataset.id); if(ep) playEp(ep); });
    home.querySelectorAll('.ep-tape').forEach(b=>b.onclick=()=>{ st.tapeId=+b.dataset.id; save(); });
    home.querySelectorAll('.ep-del').forEach(b=>b.onclick=async ()=>{
      await idb.del(+b.dataset.id);
      if(st.tapeId===+b.dataset.id) delete st.tapeId;
      await loadEps(); save();
    });
    home.querySelectorAll('.sh-del').forEach(b=>b.onclick=()=>{ st.shows.splice(+b.dataset.i,1); save(); });
    home.querySelectorAll('#shDays button').forEach(b=>b.onclick=()=>b.classList.toggle('on'));
    $('#shAdd').onclick = ()=>{
      const title=$('#shTitle').value.trim();
      const days=[...home.querySelectorAll('#shDays button.on')].map(b=>+b.dataset.d);
      const err=t=>{const el=$('#shErr');el.textContent=t;el.style.display='block';};
      if(!title) return err('Name your show.');
      if(!days.length) return err('Pick at least one day.');
      st.shows.push({ title, days, start:$('#shTime').value||'21:00', dur:+$('#shDur').value });
      st.shows.sort((a,b)=>mins(a.start)-mins(b.start));
      save();
    };
  }
  function save(){ store.set('mystation', st); render();
    if(typeof refreshOwnStation==='function'){ refreshOwnStation().then(()=>{ if(typeof loadTrending==='function' && document.querySelector('#trendGrid .rankrow, #trendGrid .ownrow')) loadTrending(); }); } }

  $('#stFound').onclick = ()=>{ editMode=true; render(); };
  $('#stFreq').addEventListener('input', ()=>{ $('#stFreqView').innerHTML = fmtFreq($('#stFreq').value); });
  $('#stCancel').onclick = ()=>{ editMode=false; render(); };
  $('#stSave').onclick = ()=>{
    const name=$('#stName').value.trim();
    const err=t=>{const el=$('#stErr');el.textContent=t;el.style.display='block';};
    if(!name) return err('Your station needs a name.');
    st = Object.assign(st||{shows:[]}, { name, tagline:$('#stTag').value.trim(), freq:+$('#stFreq').value });
    if(!st.shows) st.shows=[];
    editMode=false; save();
  };

  setInterval(()=>{ if($('#creator').classList.contains('active') && $('#studio').style.display!=='none' && st && !editMode && !rec) render(); }, 30000);
  idb.open().then(loadEps).catch(()=>{}).then(render);
})();


/* ════ profile ════ */
window.updateProfileUI = function(){
  const u = store.get('user', null);
  const ini = u ? (u.name||'?').trim().charAt(0).toUpperCase() : '·';
  $('#pfAva').textContent = ini;
  $('#pfName').textContent = u ? u.name : 'Not signed in';
  $('#pfMail').textContent = u ? (u.guest ? 'Guest session' : u.email) : '—';
};
(function(){
  const scr = $('#profScr');
  $('#profBtn').onclick = ()=>{ updateProfileUI(); scr.hidden = false; };
  $('#pfClose').onclick = ()=>{ scr.hidden = true; };
  $('#pfRename').onclick = ()=>{
    const u = store.get('user', null); if(!u) return;
    const name = prompt('Display name', u.name);
    if(name && name.trim()){ u.name = name.trim().slice(0,24); store.set('user', u); updateProfileUI(); }
  };
  $('#pfClearLib').onclick = ()=>{
    if(!confirm('Clear all favourites and recents?')) return;
    favs = []; recents = [];
    store.set('favs', favs); store.set('recents', recents);
    if(typeof renderLibrary === 'function') renderLibrary();
    if(typeof updateFavUI === 'function') updateFavUI();
  };
  $('#pfReset').onclick = ()=>{
    if(!confirm('Reset everything? Account, library, station and tapes will be wiped.')) return;
    try{ Object.keys(localStorage).filter(k=>k.startsWith('dome:')).forEach(k=>localStorage.removeItem(k)); }catch{}
    try{ indexedDB.deleteDatabase('dome-studio'); }catch{}
    location.reload();
  };
  $('#pfOut').onclick = ()=>{
    store.set('user', null);
    location.reload();   /* vuelve a la pantalla de login */
  };


  updateProfileUI();
})();


/* ---- decades mode ---- */
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
async function loadDecade(label, srcEl){
  const dec=DECADES.find(d=>d.label===label); if(!dec) return;
  decActiveTag=label;
  $('#decChips').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.dec===label));
  $('#decHint').textContent = `Loading ${dec.yr} stations…`;
  $('#decResults').innerHTML = SKEL;
  try{
    // buscar por cada tag de la década en paralelo, dedupe, priorizar US/UK/ES
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


/* ════ on air — ham radio operator simulation ════ */
(function(){
  /* --- DX world: prefijos reales de indicativo por país + bandera + lat aprox para "distancia" --- */
  const DX=[
    {cc:'JA',flag:'🇯🇵',country:'Japan',lat:36},
    {cc:'VK',flag:'🇦🇺',country:'Australia',lat:-25},
    {cc:'W',flag:'🇺🇸',country:'United States',lat:39},
    {cc:'G',flag:'🇬🇧',country:'United Kingdom',lat:54},
    {cc:'DL',flag:'🇩🇪',country:'Germany',lat:51},
    {cc:'F',flag:'🇫🇷',country:'France',lat:47},
    {cc:'EA',flag:'🇪🇸',country:'Spain',lat:40},
    {cc:'I',flag:'🇮🇹',country:'Italy',lat:42},
    {cc:'PY',flag:'🇧🇷',country:'Brazil',lat:-10},
    {cc:'LU',flag:'🇦🇷',country:'Argentina',lat:-38},
    {cc:'TI',flag:'🇨🇷',country:'Costa Rica',lat:10},
    {cc:'CT',flag:'🇵🇹',country:'Portugal',lat:39},
    {cc:'ZS',flag:'🇿🇦',country:'South Africa',lat:-30},
    {cc:'VU',flag:'🇮🇳',country:'India',lat:21},
    {cc:'UA',flag:'🇷🇺',country:'Russia',lat:60},
    {cc:'BV',flag:'🇹🇼',country:'Taiwan',lat:24},
    {cc:'HL',flag:'🇰🇷',country:'South Korea',lat:37},
    {cc:'XE',flag:'🇲🇽',country:'Mexico',lat:23},
    {cc:'VE',flag:'🇨🇦',country:'Canada',lat:56},
    {cc:'SM',flag:'🇸🇪',country:'Sweden',lat:60},
    {cc:'OH',flag:'🇫🇮',country:'Finland',lat:62},
    {cc:'4X',flag:'🇮🇱',country:'Israel',lat:31},
    {cc:'JY',flag:'🇯🇴',country:'Jordan',lat:31},
    {cc:'ZL',flag:'🇳🇿',country:'New Zealand',lat:-41},
    {cc:'CE',flag:'🇨🇱',country:'Chile',lat:-33},
    {cc:'9V',flag:'🇸🇬',country:'Singapore',lat:1}
  ];
  /* bandas HF: cada una con su "personalidad" de propagación */
  const BANDS=[
    {m:'80m', mhz:3.6,  hop:'short', note:'regional, night'},
    {m:'40m', mhz:7.1,  hop:'mixed', note:'reliable workhorse'},
    {m:'20m', mhz:14.2, hop:'long',  note:'the DX band'},
    {m:'15m', mhz:21.3, hop:'long',  note:'daytime DX'},
    {m:'10m', mhz:28.5, hop:'long',  note:'peaks at solar max'}
  ];
  const RST=['339','449','559','579','599','559','589','599']; // signal reports, 599 = perfecto

  const HOME = { lat: 39, cc:'CT', flag:'🇵🇹' }; // residencia en Portugal

  let op = store.get('operator', null);   // {call, name, since, logged:[]}
  let bandIdx = 2;                          // arranca en 20m (la banda DX)
  let current = null;                       // contacto en pantalla
  let scopeRAF = 0;

  const $on = sel => document.querySelector(sel);
  const rnd = arr => arr[Math.floor(Math.random()*arr.length)];
  const pad = (n,l)=>String(n).padStart(l,'0');

  /* genera un callsign de operador con prefijo CT (Portugal) */
  function makeCall(){
    const L='ABCDEFGHJKLMNPQRSTUVWXYZ';
    return 'CT'+(1+Math.floor(Math.random()*7))+L[Math.floor(Math.random()*L.length)]+L[Math.floor(Math.random()*L.length)]+L[Math.floor(Math.random()*L.length)];
  }
  function dxCall(dx){
    const L='ABCDEFGHJKLMNPQRSTUVWXYZ', D='0123456789';
    return dx.cc+D[Math.floor(Math.random()*10)]+L[Math.floor(Math.random()*26)]+L[Math.floor(Math.random()*26)]+L[Math.floor(Math.random()*26)];
  }

  /* propagación: 0..1 según hora del día y la banda (las bandas altas abren de día) */
  function propagation(){
    const h=new Date().getHours();
    const day = h>=8 && h<=18;             // "luz solar"
    const band=BANDS[bandIdx];
    let p;
    if(band.mhz>=14) p = day ? 0.85 : 0.35;   // bandas altas: mejor de día
    else             p = day ? 0.45 : 0.8;    // bandas bajas: mejor de noche
    return p;
  }
  function propLabel(){
    const p=propagation();
    return p>0.7?'Open · strong':p>0.45?'Fair · workable':'Poor · weak';
  }

  /* fuerza de señal de un contacto según distancia y propagación */
  function signalFor(dx){
    const dist=Math.abs(dx.lat-HOME.lat);
    const p=propagation();
    let s = p*100 - dist*0.4 + (Math.random()*30-15);
    return Math.max(15, Math.min(99, Math.round(s)));
  }

  /* ── render principal ── */
  function render(){
    const empty=$on('#opEmpty'), home=$on('#opHome');
    if(!op){ empty.style.display='block'; home.style.display='none'; cancelAnimationFrame(scopeRAF); return; }
    empty.style.display='none'; home.style.display='block';

    const band=BANDS[bandIdx];
    const dxCount=new Set(op.logged.map(c=>c.country)).size;
    const fa=Number(band.mhz).toFixed(1).split('.');

    home.innerHTML = `
      <div class="op-card">
        <div class="op-call">${op.call}</div>
        <div class="op-meta">${HOME.flag} Portugal · licensed since ${op.since}</div>
        <div class="op-stats">
          <div class="op-stat"><b>${op.logged.length}</b><span>QSOs logged</span></div>
          <div class="op-stat"><b>${dxCount}</b><span>DXCC entities</span></div>
          <div class="op-stat"><b>${op.logged.filter(c=>c.qsl).length}</b><span>QSL cards</span></div>
        </div>
      </div>

      <div class="section-label"><span class="idx">01</span>The bands</div>
      <div class="op-band">
        <div class="op-bandhead">
          <div class="freq"><b>${fa[0]}</b><span>.${fa[1]} MHz · ${band.m}</span></div>
          <div class="op-prop" id="opProp">${propLabel()}</div>
        </div>
        <div class="op-listen" id="opListen">
          <canvas class="op-scope" id="opScope"></canvas>
          <div class="op-listen-label" id="opListenLabel">Tap to call CQ &mdash; listen for a reply</div>
        </div>
        <div class="op-tunerow" id="opBands">
          ${BANDS.map((b,i)=>`<button data-b="${i}" class="${i===bandIdx?'hot':''}">${b.m}</button>`).join('')}
        </div>
      </div>

      <div id="opContactSlot"></div>

      <div class="section-label"><span class="idx">02</span>Logbook</div>
      <div id="opLog">${renderLog()}</div>

      <div class="op-actions">
        <button id="opSwitch">New call sign</button>
        <button id="opClear">Clear logbook</button>
      </div>`;

    $on('#opListen').onclick = callCQ;
    home.querySelectorAll('#opBands button').forEach(b=>b.onclick=()=>{
      bandIdx=+b.dataset.b; current=null; render();
    });
    $on('#opSwitch').onclick = ()=>{
      if(confirm('Issue a new call sign? Your logbook stays.')){ op.call=makeCall(); save(); }
    };
    $on('#opClear').onclick = ()=>{
      if(confirm('Clear your entire logbook? This cannot be undone.')){ op.logged=[]; save(); }
    };
    if(current) showContact(current);
    startScope();
  }

  function renderLog(){
    if(!op.logged.length) return '<div class="op-empty">No contacts yet — call CQ and work the world.</div>';
    return op.logged.slice().reverse().map(c=>`
      <div class="op-logrow">
        <span class="lflag">${c.flag}</span>
        <div class="op-loginfo">
          <div class="op-logcall">${c.call}</div>
          <div class="op-logmeta">${c.country} · ${c.band} · ${c.rst} · ${c.date}</div>
        </div>
        ${c.qsl?'<span class="op-qsl">QSL ✓</span>':''}
      </div>`).join('');
  }

  /* ── call CQ: intenta pescar un contacto según propagación ── */
  function callCQ(){
    if(current) return;
    const label=$on('#opListenLabel');
    label.textContent='Calling CQ…';
    const p=propagation();
    setTimeout(()=>{
      if(Math.random()<p){
        const dx=rnd(DX);
        current={
          call:dxCall(dx), flag:dx.flag, country:dx.country,
          band:BANDS[bandIdx].m, rst:rnd(RST), sig:signalFor(dx),
          date:new Date().toISOString().slice(0,10)
        };
        showContact(current);
      }else{
        label.textContent='Only static… try again or change band';
        setTimeout(()=>{ if(!current) label.textContent='Tap to call CQ — listen for a reply'; },2200);
      }
    }, 700+Math.random()*800);
  }

  function showContact(c){
    const slot=$on('#opContactSlot'); if(!slot) return;
    $on('#opListenLabel').textContent='Signal acquired ↓';
    slot.innerHTML=`
      <div class="op-contact">
        <div class="flagrow">
          <span class="cflag">${c.flag}</span>
          <div>
            <div class="ccall">${c.call}</div>
            <div class="cloc">${c.country} · ${c.band}</div>
          </div>
          <div class="csig"><b>${c.sig}</b><span>signal</span></div>
        </div>
        <div class="cact">
          <button class="op-skip-btn" id="opSkip">Let it fade</button>
          <button class="op-log-btn" id="opLogIt">Log contact (${c.rst})</button>
        </div>
      </div>`;
    $on('#opLogIt').onclick=()=>logContact(c);
    $on('#opSkip').onclick=()=>{ current=null; $on('#opContactSlot').innerHTML='';
      $on('#opListenLabel').textContent='Tap to call CQ — listen for a reply'; };
  }

  function logContact(c){
    // QSL confirmada con probabilidad según fuerza de señal
    c.qsl = Math.random() < (c.sig/120);
    op.logged.push(c);
    current=null;
    save();
  }

  /* ── osciloscopio: onda animada que reacciona a la propagación ── */
  function startScope(){
    cancelAnimationFrame(scopeRAF);
    const cv=$on('#opScope'); if(!cv) return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    function resize(){ const r=cv.getBoundingClientRect(); cv.width=r.width*dpr; cv.height=r.height*dpr; }
    resize();
    const ctx=cv.getContext('2d');
    let t=0;
    const draw=()=>{
      const w=cv.width, h=cv.height; t+=0.05;
      ctx.clearRect(0,0,w,h);
      const p=propagation();
      const amp=h*0.16*(0.4+p*0.6);
      const noise=(1-p)*h*0.08;
      ctx.lineWidth=1.5*dpr; ctx.strokeStyle=current?'#E0301E':'#C9C8C5';
      ctx.beginPath();
      for(let x=0;x<w;x++){
        const base=Math.sin(x*0.03+t)*amp + Math.sin(x*0.013-t*0.7)*amp*0.5;
        const ny=(Math.random()-0.5)*noise;
        const y=h/2+base+ny;
        x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }
      ctx.stroke();
      scopeRAF=requestAnimationFrame(draw);
    };
    draw();
  }

  function save(){ store.set('operator', op); render(); }

  /* ── boot ── */
  $on('#opStart').onclick=()=>{
    op={ call:makeCall(), name:(store.get('user',{}).name)||'Operator',
         since:new Date().getFullYear(), logged:[] };
    save();
  };

  // refrescar etiqueta de propagación cada 30s si la vista está activa
  setInterval(()=>{ if($on('#creator').classList.contains('active') && $on('#onair').style.display!=='none' && op && !current){
    const pl=$on('#opProp'); if(pl) pl.textContent=propLabel();
  }},30000);

  // exponer para el switcher de vistas
  window.initOnAir=function(){ render(); };
  if(op) render();
})();


/* ════ creator hub: broadcast <-> on air ════ */
(function(){
  let crMode = 'studio';
  function setCr(mode){
    crMode = mode;
    document.querySelectorAll('#crToggle button').forEach(b=>b.classList.toggle('on', b.dataset.cr===mode));
    $('#studio').style.display = mode==='studio' ? 'block' : 'none';
    $('#onair').style.display  = mode==='onair'  ? 'block' : 'none';
    if(mode==='onair' && window.initOnAir) initOnAir();
  }
  document.querySelectorAll('#crToggle button').forEach(b=>
    b.addEventListener('click',()=>setCr(b.dataset.cr)));
  // se llama cuando se abre el tab Creator
  window.initCreator = function(){
    // mantener el modo actual; si es la primera vez, arranca en Broadcast
    setCr(crMode);
  };
})();


