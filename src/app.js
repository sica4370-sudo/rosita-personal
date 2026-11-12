import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, connectAuthEmulator, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, limit, onSnapshot, writeBatch, serverTimestamp, deleteField, documentId } from 'firebase/firestore';
import { streak, storeStreak, earned, BADGES, COMODINES_MES, COMODIN_MAX, VENTANA } from './rachas.js';
import { firebaseConfig, LOGIN_DOMAIN, TZ, VERSION } from './config.js';
import { ROLES, ROLE_ORDER, DEPTS, DIAS, DIAS_C, MESES, STORES_SEED, HORARIOS_SEED, RCATS, FTAGS, NEMO, COLORS, RX, worksOn, restReason } from './data.js';

/* ================== FIREBASE ================== */
const EMU = /[?&]emu=1/.test(location.search) || location.hostname === 'localhost' && /[?&]emu/.test(location.search);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let db;
try { db = initializeFirestore(app, { localCache: EMU ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch (e) { db = initializeFirestore(app, { localCache: memoryLocalCache() }); }
if (EMU) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8080); }

const pw = pin => `rp-${pin}-dlr`;
const D = (...p) => doc(db, ...p);
const C = (...p) => collection(db, ...p);

/* ================== UTILIDADES ================== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');
function nowParts() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date()).map(x => [x.type, x.value]));
  const hh = p.hour === '24' ? '00' : p.hour;
  return { day: `${p.year}-${p.month}-${p.day}`, hm: `${hh}:${p.minute}`, min: (+hh) * 60 + (+p.minute) };
}
const toMin = hm => { const [h, m] = (hm || '0:0').split(':').map(Number); return h * 60 + m; };
const fmtMin = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const addDays = (ds, n) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const niceDate = ds => { const d = new Date(ds + 'T12:00:00'); return `${DIAS_C[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; };
const ini = n => (n || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const first = n => (n || '').split(' ')[0];
const colorOf = id => { let h = 0; for (const c of id || '') h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
const av = (p, cls = '') => p ? `<div class="av ${cls}" style="background:${colorOf(p.id)}">${p.photo ? `<img src="${p.photo}" alt="">` : ini(p.n)}</div>` : '<div class="av">?</div>';
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20);
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ago = ms => { const d = Math.max(0, Math.round((Date.now() - ms) / 60000)); return d < 1 ? 'ahora' : d < 60 ? `hace ${d} min` : d < 1440 ? `hace ${Math.floor(d / 60)} h` : `hace ${Math.floor(d / 1440)} d`; };
const tsMs = t => t && t.toMillis ? t.toMillis() : (typeof t === 'number' ? t : Date.now());
const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  in: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  lunch: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  back: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  heart: '<path d="M16.8 3.9A5 5 0 0 1 21.5 9.1c0 3.1-2.7 5-5.2 7.2-2.5 2.2-3.9 3.5-4.3 3.8-.5-.3-2.1-1.8-4.3-3.8C5.1 14.1 2.5 12.2 2.5 9.1a5 5 0 0 1 4.7-5.2 4.2 4.2 0 0 1 3.7 1.9c.8 1.2 1 1.8 1.1 1.8s.3-.6 1.1-1.8a4.2 4.2 0 0 1 3.7-1.9Z"/>',
  comment: '<path d="M20.7 17A10 10 0 1 0 17.1 20.6L22 22Z"/>',
  plus: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
  dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  swap: '<path d="M16 3h5v5"/><path d="M21 3 14 10"/><path d="M8 21H3v-5"/><path d="m3 21 7-7"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  store: '<path d="M3 9h18l-1.5-5h-15Z"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>'
};
const ico = k => `<svg class="i" viewBox="0 0 24 24">${ICONS[k] || ''}</svg>`;
function toast(t) { document.querySelectorAll('.toast').forEach(x => x.remove()); const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2800); }
function compress(file, size, q) {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onerror = rej;
    r.onload = () => { const img = new Image(); img.onerror = rej; img.onload = () => { const c = document.createElement('canvas'), m = Math.min(img.width, img.height), s = Math.min(size, m); c.width = c.height = s; c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s); res(c.toDataURL('image/jpeg', q)); }; img.src = r.result; };
    r.readAsDataURL(file);
  });
}
const geo = () => new Promise(res => {
  if (!navigator.geolocation) return res({ ok: false });
  navigator.geolocation.getCurrentPosition(p => res({ ok: true, lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }), () => res({ ok: false }), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
});
const dist = (a, b) => { const R = 6371000, t = x => x * Math.PI / 180, dLa = t(b.lat - a.lat), dLo = t(b.lng - a.lng); const h = Math.sin(dLa / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLo / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(h))); };

/* ================== ESTADO ================== */
const S = {
  phase: 'boot', setup: null, dir: [], stores: {}, horarios: {}, staff: {}, me: null, uid: null,
  pick: null, pinbuf: '', zone: 'Todas', q: '', tab: 'inicio', sub: null, sheet: null, busy: false,
  posts: [], notes: {}, today: null, myMarks: [], cambios: [], scope: 'todo', liveMarks: [], unsub: []
};
const RECENT_KEY = 'rp_recent';
const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; } };
const pushRecent = sid => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([sid, ...recent().filter(x => x !== sid)].slice(0, 4))); } catch (e) { } };
const P = sid => S.staff[sid] || S.dir.find(x => x.id === sid);
const storeN = k => (S.stores[k] || {}).n || '—';
const myHor = () => S.me && S.horarios[S.me.horario];
// Punto de corte del medio día: el que se le asignó a la persona o la mitad del turno
// Horario flexible: sin hora ni días fijos, sin tardanzas ni horas extra (se paga por avance)
const isFlex = p => !!(p && (S.horarios[p.horario] || {}).flex);
// ¿Se espera hoy a esta persona? Las de horario flexible solo cuentan si ya llegaron
const expected = (p, day, arr) => worksOn(p, S.horarios[p.horario], day, S.cambios) && (!isFlex(p) || !!(arr || {})[p.id]);
const fixedIn = h => !!h && (!h.flex || !!h.flexIni);
const horLbl = h => !h ? 'sin horario' : h.flex ? (h.flexIni ? `entra ${h.ini} · salida libre` : 'horario flexible') : `${h.ini}–${h.fin}`;
const corte = (p, h) => p.medioH || fmtMin(Math.round((toMin(h.ini) + toMin(h.fin)) / 2 / 30) * 30);
// Horario real de una persona en una fecha: considera sus días de medio día y los permisos de medio día
function horDe(p, day) {
  const h = p && S.horarios[p.horario]; if (!h || h.flex) return h || null;
  const wd = new Date(day + 'T12:00:00').getDay(), cut = corte(p, h);
  const perm = S.cambios.find(c => c.sid === p.id && c.tipo === 'permiso' && c.estado === 'aprobado' && c.rest === day && c.medio);
  let t = null, why = '';
  if (perm) { t = perm.medio === 'am' ? 'pm' : 'am'; why = 'permiso'; }
  else if ((p.medios || []).includes(wd)) { t = p.medioT || 'am'; why = 'medio'; }
  if (!t) return h;
  return { ...h, ini: t === 'am' ? h.ini : cut, fin: t === 'am' ? cut : h.fin, lunch: 0, medio: t, why };
}
const medioTxt = p => { const h = S.horarios[p.horario]; if (!h || !(p.medios || []).length) return ''; return `Medio día ${p.medios.map(d => DIAS_C[d]).join(', ')} (${(p.medioT || 'am') === 'am' ? `${h.ini}–${corte(p, h)}` : `${corte(p, h)}–${h.fin}`})`; };
const role = () => S.me ? S.me.role : null;
const isAdmin = () => role() === 'admin';
const isMgr = () => ['admin', 'jefe'].includes(role());
const canPost = () => ['admin', 'jefe', 'encargada', 'fundador', 'sistemas'].includes(role());
const canUsers = () => ['admin', 'sistemas'].includes(role());
// Gerencia y fundadores supervisan: no marcan horario ni cuentan en el equipo de ninguna tienda
const SUP = ['admin', 'fundador'];
const isSup = (p = S.me) => !!p && SUP.includes(p.role);
const canSeeLive = () => ['admin', 'jefe', 'fundador'].includes(role());

/* ================== ARRANQUE ================== */
async function boot() {
  render();
  try {
    const sd = await getDoc(D('meta', 'setup'));
    S.setup = sd.exists() ? sd.data() : null;
    await loadPublic();
  } catch (e) { console.error(e); S.phase = 'error'; S.err = 'No se pudo conectar. Revisa tu internet.'; render(); return; }
  onAuthStateChanged(auth, async u => {
    if (u && S.setup) {
      try {
        const ud = await getDoc(D('uids', u.uid));
        if (!ud.exists()) { await signOut(auth); toast('Tu acceso fue desactivado. Habla con Sistemas.'); S.phase = 'login'; render(); return; }
        S.uid = u.uid; await enter(ud.data().sid);
      } catch (e) { console.error(e); S.phase = 'login'; render(); }
    } else { stopListeners(); S.me = null; S.phase = S.setup ? 'login' : 'setup'; render(); if (S.setup) { try { await loadPublic(); render(); } catch (e) { } } }
  });
}
async function loadPublic() {
  const [dirS, stS] = await Promise.all([getDocs(C('directory')), getDocs(C('stores'))]);
  S.dir = dirS.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false);
  S.stores = Object.fromEntries(stS.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
}
async function enter(sid) {
  S.phase = 'loading'; render();
  const [stf, hor] = await Promise.all([getDocs(C('staff')), getDocs(C('horarios'))]);
  S.staff = Object.fromEntries(stf.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
  S.horarios = Object.fromEntries(hor.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
  S.me = S.staff[sid];
  if (!S.me) { await signOut(auth); return; }
  S.me.photo = (S.dir.find(x => x.id === sid) || {}).photo;
  pushRecent(sid);
  startListeners();
  setTimeout(() => { S.phase = 'app'; S.tab = 'inicio'; render(); }, 600);
}
function stopListeners() { S.unsub.forEach(f => { try { f(); } catch (e) { } }); S.unsub = []; }
function startListeners() {
  stopListeners();
  const day = nowParts().day;
  S.unsub.push(onSnapshot(query(C('posts'), orderBy('at', 'desc'), limit(40)), s => { S.posts = s.docs.map(d => ({ id: d.id, ...d.data() })); rerender(); }));
  S.unsub.push(onSnapshot(C('notes'), s => { S.notes = Object.fromEntries(s.docs.map(d => [d.id, d.data()])); rerender(); }));
  S.unsub.push(onSnapshot(D('days', day), s => { S.today = s.exists() ? s.data() : {}; rerender(); }));
  S.unsub.push(onSnapshot(C('directory'), s => {
    S.dir = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false);
    const me = S.dir.find(x => x.id === S.me.id); if (me && me.photo) S.me.photo = me.photo; rerender();
  }));
  S.unsub.push(onSnapshot(D('arena', 'actual'), s => { S.arena = s.exists() ? s.data() : null; rerender(); }, () => { S.arena = null; }));
  const yday = addDays(day, -1);
  S.unsub.push(onSnapshot(query(C('marks'), where('sid', '==', S.me.id), where('day', 'in', [yday, day])), s => {
    const all = s.docs.map(d => d.data()).sort((a, b) => tsMs(a.at) - tsMs(b.at));
    S.myMarks = all.filter(m => m.day === day); S.myMarksY = all.filter(m => m.day === yday); rerender();
  }));
  if (canSeeLive()) S.unsub.push(onSnapshot(query(C('marks'), where('day', 'in', [yday, day])), s => { S.liveMarks = s.docs.map(d => d.data()).sort((a, b) => tsMs(a.at) - tsMs(b.at)); rerender(); }));
  const from = addDays(day, -(VENTANA + 5));
  loadHist();
  S.unsub.push(onSnapshot(query(C('cambios'), where('rest', '>=', from)), s => { S.cambios = s.docs.map(d => ({ id: d.id, ...d.data() })); rerender(); }));
}
// Historial de llegadas para las rachas (una sola lectura al entrar; hoy llega en vivo)
async function loadHist() {
  try {
    const from = addDays(nowParts().day, -VENTANA), s = await getDocs(query(C('days'), where(documentId(), '>=', from)));
    S.hist = Object.fromEntries(s.docs.map(d => [d.id, (d.data() || {}).arr || {}]));
    S.histStart = s.docs.map(d => d.id).sort()[0] || nowParts().day;
    RK = null; rerender(); setTimeout(checkBadges, 300);
  } catch (e) { console.error(e); }
}
/* ---- Rachas (se recalculan una vez por cada redibujo) ---- */
let RK = null;
const rkey = () => `${S.histStart}|${nowParts().day}|${JSON.stringify((S.today || {}).arr || {})}|${S.cambios.length}|${Object.keys(S.staff).length}|${S.posts.length}`;
const dayCreated = p => p.createdAt && p.createdAt.toDate ? new Date(p.createdAt.toDate().getTime() - 6 * 3600e3).toISOString().slice(0, 10) : '';
const inRacha = p => !!p && p.active !== false && !isSup(p) && !!S.horarios[p.horario] && fixedIn(S.horarios[p.horario]);
function rachas() {
  if (!S.hist) return null;
  const k = rkey(); if (RK && RK.k === k) return RK;
  const today = nowParts().day, arrOf = d => d === today ? ((S.today || {}).arr || {}) : (S.hist[d] || {});
  const per = {};
  Object.values(S.staff).filter(inRacha).forEach(p => {
    const h = S.horarios[p.horario], cd = dayCreated(p);
    per[p.id] = streak({ sid: p.id, today, start: cd > S.histStart ? cd : S.histStart, arrOf, expected: d => worksOn(p, h, d, S.cambios), iniOf: d => (horDe(p, d) || {}).ini, flexOnlyIfCame: !!h.flex });
  });
  const stores = {};
  Object.keys(S.stores).forEach(id => { const rs = Object.values(S.staff).filter(p => p.store === id && per[p.id]).map(p => per[p.id]); if (rs.length) stores[id] = { ...storeStreak(rs, today), n: rs.length }; });
  RK = { k, per, stores }; return RK;
}
const myRacha = () => { const r = rachas(); return r && r.per[S.me.id]; };
function badgesFor(sid) {
  const r = rachas(), p = S.staff[sid]; if (!p) return new Set();
  const e = r ? earned(r.per[sid], { recos: S.posts.filter(x => x.kind === 'reco' && x.to === sid).length, storeBest: ((r.stores || {})[p.store] || {}).best || 0 }) : new Set();
  Object.keys((S.notes[sid] || {}).ins || {}).forEach(x => e.add(x));
  return e;
}
// Guarda las insignias nuevas de la persona y se las celebra
async function checkBadges() {
  if (!S.me || isSup() || !S.hist || S.sheet) return;
  const have = (S.notes[S.me.id] || {}).ins || {}, now = badgesFor(S.me.id), nue = [...now].filter(x => !have[x] && !(S._insSent || {})[x]);
  if (!nue.length) return;
  S._insSent = { ...(S._insSent || {}), ...Object.fromEntries(nue.map(x => [x, 1])) };
  const day = nowParts().day;
  try { await setDoc(D('notes', S.me.id), { ins: Object.fromEntries(nue.map(x => [x, day])) }, { merge: true }); } catch (e) { console.error(e); return; }
  S.sheet = { kind: 'insignia', keys: nue }; render();
}
const fireDots = days => days.slice(-7).map(x => { const wd = DIAS_C[new Date(x.d + 'T12:00:00').getDay()][0]; const ic = { ok: '🔥', com: '🛡️', late: '✕', miss: '✕', off: '·', pend: '' }[x.s]; return `<div class="rd ${x.s}"><i>${ic}</i><span>${wd}</span></div>`; }).join('');
function rachaCard() {
  if (isSup() || !inRacha(S.me)) return '';
  const r = rachas(); if (!r) return `<div class="rcard"><div class="rfire">🔥<b>…</b></div><div class="rtx"><b>Calculando tu racha…</b></div></div>`;
  const m = r.per[S.me.id], sr = r.stores[S.me.store];
  const top = Object.entries(r.stores).filter(([, x]) => x.cur > 0).sort((a, b) => b[1].cur - a[1].cur).slice(0, 6);
  return `<div class="rcard" data-tab="perfil"><div class="rfire ${m.cur ? 'on' : ''}">🔥<b>${m.cur}</b></div><div class="rtx"><b>${m.cur ? `${m.cur} ${m.cur === 1 ? 'día' : 'días'} de racha` : 'Empieza tu racha hoy'}</b>
    <small>🛡️ ${m.left} ${m.left === 1 ? 'comodín' : 'comodines'} este mes · cubren hasta ${COMODIN_MAX} min</small><div class="rweek">${fireDots(m.days)}</div></div></div>
    ${sr ? `<div class="rstore">🏪 <b>${esc(storeN(S.me.store))}</b> · ${sr.cur ? `🔥 ${sr.cur} ${sr.cur === 1 ? 'día' : 'días'} con todo el equipo a tiempo` : 'el equipo empieza su racha hoy'}</div>` : ''}
    ${top.length ? `<div class="rtop">${top.map(([id, x], i) => `<span class="${id === S.me.store ? 'me' : ''}">${['🥇', '🥈', '🥉'][i] || '🔥'} ${esc(storeN(id))} <b>${x.cur}</b></span>`).join('')}</div>` : ''}`;
}
/* ---- Arena D'La Rossa (lo manda el puente de la Arena cada 30 min; sin quetzales) ---- */
const ARENA_URL = 'https://arenadlarossa.netlify.app/';
const sup0 = () => isSup();
const sameN = (a, b) => { a = norm(a).trim(); b = norm(b).trim(); return !!a && !!b && (a === b || a.startsWith(b + ' ') || b.startsWith(a + ' ')); };
const arenaTienda = sid => { const A = S.arena; if (!A) return null; const n = storeN(sid); return (A.tiendas || []).find(t => sameN(t.n, n)) || null; };
function arenaYo() {
  const A = S.arena, u = S.me; if (!A || !u) return null;
  const L = A.liga || [], full = L.filter(x => sameN(x.n, u.n)); if (full.length === 1) return full[0];
  const f = L.filter(x => norm(first(x.n)) === norm(first(u.n)) && (!x.t || sameN(x.t, storeN(u.store)))); return f.length === 1 ? f[0] : null;
}
function arenaCard() {
  const A = S.arena; if (!A || A.mes !== nowParts().day.slice(0, 7)) return '';
  const u = S.me, sup = isSup(), t = sup ? null : arenaTienda(u.store), yo = sup ? null : arenaYo(), L = A.liga || [];
  const sell = ['asesora', 'encargada'].includes(u.role);
  const bar = c => `<div class="abar"><i style="width:${Math.min(100, c / 1.2)}%"></i><b style="left:${95 / 1.2}%"></b><b style="left:${100 / 1.2}%"></b></div>`;
  let h = `<div class="acard"><div class="ahead"><span>🏆 Arena · ${esc(A.mesNombre || '')}</span><a href="${ARENA_URL}" target="_blank" rel="noopener">Abrir Arena ›</a></div>`;
  if (sup && A.global != null) h += `<div class="arow"><b>Toda la empresa</b><span>${A.global}%</span></div>${bar(A.global)}`;
  if (t && t.c != null) h += `<div class="arow"><b>${esc(storeN(u.store))} · Desafío</b><span>${t.c}% · #${t.o}</span></div>${bar(t.c)}<small>${t.c >= 120 ? '🚀 ¡Superaron la meta!' : t.c >= 100 ? '🎯 ¡Meta cumplida!' : t.c >= 95 ? '🔥 ¡Ya van en 95%! Falta poco para el 100%' : `Faltan ${Math.ceil(95 - t.c)} puntos para el 95%`}</small>`;
  if (sell && L.length) {
    if (yo) { const up = L[yo.o - 2]; h += `<div class="aliga">⭐ <b>Vas #${yo.o} en la Liga</b> · ${yo.p} pts${up ? ` · te faltan ${Math.max(1, up.p - yo.p + 1)} pts para el #${yo.o - 1} 🚀` : ' · ¡vas en primer lugar! 👑'}</div>`; }
    else h += `<div class="aliga">⭐ Todavía no sumas puntos en la Liga este mes. ¡Tu primera venta cuenta!</div>`;
  }
  if (L.length) h += `<div class="atop">${L.slice(0, 3).map((x, i) => `<span>${['🥇', '🥈', '🥉'][i]} ${esc(first(x.n))}${x.t ? ` <small>${esc(x.t)}</small>` : ''} <b>${x.p}</b></span>`).join('')}</div>`;
  if (sup) { const ts = (A.tiendas || []).filter(x => x.c != null).slice(0, 3); if (ts.length) h += `<div class="atop">${ts.map((x, i) => `<span>${['🥇', '🥈', '🥉'][i]} ${esc(x.n)} <b>${x.c}%</b></span>`).join('')}</div>`; }
  return h + `<div class="aago">Actualizado ${A.en ? ago(A.en) : ''}</div></div>`;
}
function viewRachas() {
  const r = rachas(); if (!r) return '<div class="empty">Calculando…</div>';
  const ppl = Object.values(S.staff).filter(p => r.per[p.id]).sort((a, b) => r.per[b.id].cur - r.per[a.id].cur || r.per[b.id].best - r.per[a.id].best);
  const st = Object.entries(r.stores).sort((a, b) => b[1].cur - a[1].cur || b[1].best - a[1].best);
  return `<div class="note" style="margin:0 0 12px">La racha cuenta los días seguidos en que la persona llega a tiempo. Cada quien tiene <b>${COMODINES_MES} comodines al mes</b> que cubren una tardanza de hasta ${COMODIN_MAX} min. Descansos y permisos no la rompen. Gerencia, fundadores y horarios sin hora de entrada no cuentan.</div>
  <div class="h3" style="margin-top:0">Tiendas <span>todo el equipo a tiempo</span></div><div class="lcard">${st.map(([id, x], i) => `<div class="lrow"><div class="hic">${['🥇', '🥈', '🥉'][i] || '🏪'}</div><div style="flex:1"><b>${esc(storeN(id))}</b><small>${x.n} ${x.n === 1 ? 'persona' : 'personas'} · mejor: ${x.best}</small></div><span class="st ${x.cur ? 'y' : 'p'}">🔥 ${x.cur}</span></div>`).join('')}</div>
  <div class="h3">Personas</div><div class="lcard">${ppl.map(p => { const m = r.per[p.id], b = badgesFor(p.id); return `<div class="lrow">${av(dirP(p.id))}<div style="flex:1;min-width:0"><b>${esc(p.n)}</b><small>${esc(storeN(p.store))} · mejor: ${m.best} · 🛡️ ${m.left} · ${BADGES.filter(x => b.has(x[0])).map(x => x[1]).join('') || 'sin insignias'}</small></div><span class="st ${m.cur ? 'y' : 'p'}">🔥 ${m.cur}</span></div>`; }).join('')}</div>`;
}
function badgeGrid(sid) {
  const b = badgesFor(sid);
  return `<div class="h3">Insignias <span>${b.size} de ${BADGES.length}</span></div><div class="bgrid">${BADGES.map(([k, e, n, d]) => `<div class="bdg ${b.has(k) ? 'on' : ''}" title="${esc(d)}"><div>${e}</div><b>${n}</b><small>${d}</small></div>`).join('')}</div>`;
}
let rtimer = null;
function rerender() { if (S.phase !== 'app' || S.sheet) return; clearTimeout(rtimer); rtimer = setTimeout(render, 60); }

/* ================== VISTAS: INGRESO ================== */
const firma = (cls = '') => `<button class="firma ${cls}" data-about>de <img src="rosita.svg" alt=""> <img class="rlwm" src="wordmark.svg" alt="rosita labs"></button>`;
function viewSetup() {
  const sh = S.form || {};
  return `<div class="apphead"><div class="logo"><span class="rlmark"></span></div><div><div class="t">Rosita</div><div class="s">Configuración inicial</div></div></div>
  <div class="body" style="padding:20px">
    <h2 style="margin:0 0 6px;font-size:22px">Bienvenido 👋</h2>
    <p style="color:#65676b;margin:0 0 16px;font-size:14px;line-height:1.5">Vamos a crear la primera cuenta, la de Gerencia. Con ella vas a crear después a todo el personal, sus horarios y sus días de descanso.</p>
    <label class="lbl">Tu nombre completo</label><input id="su_n" class="fin" value="${esc(sh.n || 'Alan Anderson Sic Tzul')}">
    <label class="lbl">Cómo te verán en la app</label><input id="su_c" class="fin" value="${esc(sh.c || 'Alan')}">
    <label class="lbl">Puesto</label><input id="su_p" class="fin" value="${esc(sh.p || 'Gerente General')}">
    <label class="lbl">Crea tu PIN de 4 dígitos</label><input id="su_pin" class="fin pinin" inputmode="numeric" maxlength="4" type="password" placeholder="••••">
    <label class="lbl">Repite tu PIN</label><input id="su_pin2" class="fin pinin" inputmode="numeric" maxlength="4" type="password" placeholder="••••">
    ${S.err ? `<div class="err">${esc(S.err)}</div>` : ''}
    <button class="wide" data-setup ${S.busy ? 'disabled' : ''}>${S.busy ? 'Creando…' : 'Crear mi cuenta y empezar'}</button>
    <p class="rsmall" style="text-align:center;margin-top:10px">También se crean las 14 tiendas y 4 horarios de ejemplo, que puedes editar.</p>
  </div>${firmaFoot()}`;
}
const firmaFoot = () => `<div class="foot">${firma()}</div>`;
const ZONES = ['Todas', 'Oficina', 'Salcajá', 'Centros comerciales'];
const zoneOf = k => { const s = S.stores[k]; if (!s) return 'Oficina'; if (k === 'of' || k === 'ol') return 'Oficina'; return s.mall ? 'Centros comerciales' : 'Salcajá'; };
function viewLogin() {
  const sel = S.pick ? S.dir.find(x => x.id === S.pick) : null;
  let h = `<div class="apphead"><div class="logo"><span class="rlmark"></span></div><div><div class="t">Rosita</div><div class="s">${sel ? 'Ingresa tu PIN' : 'Toca tu foto para entrar'}</div></div></div><div class="body${sel ? '' : ' pickbody'}">`;
  if (sel) {
    h += `<div class="pinbox">${av(sel, 'big')}<div style="font-weight:700;font-size:17px;margin-top:8px">${esc(sel.n)}</div><div style="font-size:12.5px;color:#65676b">${esc(sel.puesto || '')} · ${esc(storeN(sel.store))}</div>
      <div class="dots" id="dots">${[0, 1, 2, 3].map(i => `<i class="${i < S.pinbuf.length ? 'f' : ''}"></i>`).join('')}</div>
      ${S.err ? `<div class="err" style="text-align:center">${esc(S.err)}</div>` : ''}
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '←', 0, '✕'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div>
      <button class="peek" data-notme style="margin-top:14px">No soy ${esc(first(sel.n))}</button></div>`;
  } else {
    const rec = recent().map(id => S.dir.find(x => x.id === id && x.active !== false)).filter(Boolean);
    if (rec.length) h += `<div class="h3" style="margin-top:0">En este celular</div><div class="recent">${rec.map(p => `<button data-pick="${p.id}">${av(p)}<span>${esc(first(p.n))}</span></button>`).join('')}</div>`;
    if (S.dir.length > 8) h += `<div class="whohead"><div class="search">${ico('search')}<input id="whoq" placeholder="Busca tu nombre" autocomplete="off" value="${esc(S.q)}"></div>
      <div class="zones">${ZONES.map(z => `<button data-zone="${z}" class="${S.zone === z ? 'on' : ''}">${z}</button>`).join('')}</div></div>`;
    h += `<div class="who" id="wholist">`;
    const stores = Object.values(S.stores).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    for (const st of stores) {
      const ppl = S.dir.filter(p => p.store === st.id && p.active !== false).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.n.localeCompare(b.n));
      if (!ppl.length) continue;
      h += `<div class="wg" data-z="${zoneOf(st.id)}" ${S.zone !== 'Todas' && zoneOf(st.id) !== S.zone ? 'hidden' : ''}><div class="gh">${esc(st.n)}<span>${esc(st.city || '')} · ${ppl.length}</span></div><div class="pgrid">`;
      for (const p of ppl) h += `<button class="pf r-${p.role}" data-pick="${p.id}" data-name="${esc(norm(p.n + ' ' + (p.puesto || '')))}"><div class="ring">${av(p)}</div><b>${esc(first(p.n))}</b><small>${esc((ROLES[p.role] || {}).l || '')}</small></button>`;
      h += `</div></div>`;
    }
    h += `</div><div class="empty" id="whonone" hidden style="text-align:center;padding:24px 0">No encontramos ese nombre.<br>Si acabas de entrar al equipo, pide tu usuario a Sistemas.</div>`;
  }
  return h + `</div>${firmaFoot()}`;
}
function filterWho() {
  const q = norm(S.q).trim(); let any = 0;
  document.querySelectorAll('#wholist .wg').forEach(g => {
    let n = 0; const zOk = q || S.zone === 'Todas' || g.dataset.z === S.zone;
    g.querySelectorAll('[data-name]').forEach(b => { const ok = zOk && (!q || b.dataset.name.includes(q)); b.hidden = !ok; if (ok) n++; });
    g.hidden = !n; any += n;
  });
  const e = $('#whonone'); if (e) e.hidden = !!any;
}
const loadView = () => `<div class="rload"><img class="hop" src="rosita.svg" alt="Cargando"><div class="shadow"></div><div class="txt">Cargando<span class="dots"></span></div></div>`;

/* ================== VISTAS: APP ================== */
function todayInfo(st) {
  const day = nowParts().day, hor = horDe(st, day);
  return { day, hor, works: worksOn(st, S.horarios[st.horario], day, S.cambios) };
}
const XT = ['extra', 'extrafin'];
// Horas extra abiertas de una lista de marcas (incluye las que empezaron ayer y siguen de noche)
function openExtra(marks) { const x = marks.filter(m => XT.includes(m.type)); const l = x[x.length - 1]; return l && l.type === 'extra' ? l : null; }
// Minutos extra terminados en el día (cada cierre guarda su duración, aunque haya empezado ayer)
const extraMin = (marks, day) => marks.filter(m => m.type === 'extrafin' && m.day === day).reduce((t, m) => t + (m.extraMin || 0), 0);
const hmin = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`;
function myState() {
  if (openExtra([...(S.myMarksY || []), ...S.myMarks])) return 'extra';
  const m = S.myMarks.filter(x => !XT.includes(x.type)); if (!m.length) return 'fuera';
  const last = m[m.length - 1].type;
  return last === 'salida' ? 'salio' : last === 'almuerzo' ? 'almuerzo' : 'trabajando';
}
function heroCard() {
  const u = S.me, { day, hor, works } = todayInfo(u), np = nowParts(), st = myState();
  const hr = np.min < 720 ? 'Buen día' : np.min < 1080 ? 'Buenas tardes' : 'Buenas noches';
  if (isSup()) {
    const pend = S.cambios.filter(c => c.estado === 'pendiente' && canDecide(c)).length;
    return `<div class="hero h-work"><small>${hr}, ${esc(first(u.n))}</small><h2>Supervisión</h2><p>${esc(u.puesto || (ROLES[u.role] || {}).l)} · no marcas horario${pend ? ` · ${pend} por aprobar` : ''}</p>
      <div class="hrow"><button class="hbtn2" data-tab="equipo">${ico('users')} Ver En vivo</button><button class="hbtn2" data-crear>${ico('plus')} Publicar</button></div></div>`;
  }
  if (!hor) return `<div class="hero h-off"><small>${hr}, ${esc(first(u.n))}</small><h2>Sin horario asignado</h2><p>Pídele a Gerencia que te asigne un horario.</p></div>`;
  if (st === 'extra') {
    const o = openExtra([...(S.myMarksY || []), ...S.myMarks]), m = (o.day === day ? 0 : 1440) + np.min - o.min;
    return `<div class="hero h-lunch"><small>🌙 Horas extra</small><h2>${hmin(Math.max(0, m))}</h2><p>Empezaste a las ${o.hm}${o.day !== day ? ' (ayer)' : ''}</p><button class="hbtn" data-mark="extrafin" ${S.busy ? 'disabled' : ''}>${ico('out')} Terminar horas extra</button></div>`;
  }
  const xbtn = hor && hor.flex ? '' : `<button class="hbtn2" data-mark="extra" style="margin-top:10px">🌙 Voy a trabajar horas extra</button>`;
  if (!works && st === 'fuera') {
    const r = restReason(u, hor, day, S.cambios);
    return `<div class="hero h-off"><small>${DIAS[new Date(day + 'T12:00:00').getDay()]}</small><h2>${r.k === 'permiso' ? 'Hoy tienes permiso 📝' : 'Hoy descansas 🌷'}</h2><p>${r.k === 'permiso' ? 'Tu permiso está aprobado. ¡Que te vaya bien!' : r.k === 'cambio' ? `Cambiaste tu descanso: trabajas el ${niceDate(r.c.work)}` : r.k === 'descanso' ? 'Es tu día de descanso' : 'Hoy no tienes turno'}</p>${xbtn}</div>`;
  }
  const ini0 = toMin(hor.ini);
  if (st === 'fuera' && hor.flex) { const lt = np.min - toMin(hor.ini); return `<div class="hero h-in"><small>${hr}, ${esc(first(u.n))}</small><h2>${!hor.flexIni ? 'Horario flexible' : lt > (hor.tol || 5) ? `Vas ${lt} min tarde` : `Tu entrada es a las ${hor.ini}`}</h2><p>${hor.flexIni ? 'Tu salida es libre' : 'Marca cuando empieces a trabajar'}</p>
      <button class="hbtn" data-mark="entrada" ${S.busy ? 'disabled' : ''}>${ico('in')} ${S.busy ? 'Verificando ubicación…' : 'Empezar a trabajar'}</button></div>`; }
  if (st === 'fuera') {
    const late = np.min - ini0, free = ['jefe', 'admin', 'fundador', 'apoyo', 'sistemas'].includes(u.role);
    if (np.min >= toMin(hor.fin)) return `<div class="hero h-in"><small>${hr}, ${esc(first(u.n))}</small><h2>Tu jornada ya terminó</h2><p>Tu horario de hoy: ${hor.ini}–${hor.fin}</p><button class="hbtn" data-mark="entrada" ${S.busy ? 'disabled' : ''}>${ico('in')} Marcar</button></div>`;
    return `<div class="hero h-in"><small>${hr}, ${esc(first(u.n))}</small><h2>${late > 120 ? 'No has marcado tu entrada' : late > (hor.tol || 5) ? `Vas ${late} min tarde` : `Tu entrada es a las ${hor.ini}`}</h2>${hor.medio ? `<p>☀️ Hoy trabajas medio día: ${hor.ini}–${hor.fin}</p>` : ''}
      <p>${ico('pin')} ${free ? 'Desde la oficina, una tienda u otro lugar' : esc(storeN(u.store))}</p>
      <button class="hbtn" data-mark="entrada" ${S.busy ? 'disabled' : ''}>${ico('in')} ${S.busy ? 'Verificando ubicación…' : 'Marcar entrada'}</button></div>`;
  }
  if (st === 'almuerzo') {
    const o = S.myMarks.filter(x => x.type === 'almuerzo').pop(), m = np.min - o.min;
    return `<div class="hero h-lunch"><small>En almuerzo</small><h2>${m} de ${hor.lunch} min</h2><div class="hbar"><i style="width:${Math.min(100, m / hor.lunch * 100)}%"></i></div><button class="hbtn" data-mark="regreso" ${S.busy ? 'disabled' : ''}>${ico('back')} Regresé</button></div>`;
  }
  if (st === 'salio') return `<div class="hero h-done"><small>Hasta mañana</small><h2>Jornada terminada</h2><p>¡Gracias por tu día, ${esc(first(u.n))}! 🌙${extraMin(S.myMarks, day) ? ` · Extra hoy: ${hmin(extraMin(S.myMarks, day))}` : ''}</p>${xbtn}</div>`;
  const e = S.myMarks.find(x => x.type === 'entrada'), lunchOk = hor.lunch > 0 && !S.myMarks.some(x => x.type === 'almuerzo');
  return `<div class="hero h-work"><small><i class="dotok"></i>En turno</small><h2>Trabajando</h2><p>Entraste ${e.hm}${hor.flex ? `${hor.flexIni && !e.late ? ' · a tiempo ✓' : ''} · salida libre` : `${e.late ? '' : ' · a tiempo ✓'} · sales a las ${hor.fin}${hor.medio ? ' (medio día)' : ''}`}</p>
    <div class="hrow">${lunchOk ? `<button class="hbtn2" data-mark="almuerzo">${ico('lunch')} Almuerzo</button>` : ''}<button class="hbtn2" data-mark="salida">${ico('out')} Marcar salida</button></div></div>`;
}
// Reacciones a notas: notes/{sid}.rx = { persona: emoji }
function noteRxBadge(n) { const v = Object.values(n.rx || {}); if (!v.length) return ''; const c = {}; v.forEach(e => c[e] = (c[e] || 0) + 1); return `<i class="nrxb">${Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]).join('')}${v.length > 1 ? v.length : ''}</i>`; }
const noteRxList = n => Object.entries(n.rx || {}).map(([sid, e]) => { const p = dirP(sid); return p.n ? `<div class="nrxrow">${av(p)}<b>${esc(p.n)}</b><span>${e}</span></div>` : ''; }).join('');
function notesRow() {
  const u = S.me, now = Date.now(), alive = n => n && n.tx && n.at && now - tsMs(n.at) < 864e5, live = Object.entries(S.notes).filter(([, n]) => alive(n));
  const mine = alive(S.notes[u.id]) ? S.notes[u.id] : null;
  const others = live.filter(([sid]) => sid !== u.id && P(sid)).map(([sid]) => dirP(sid))
    .sort((a, b) => (b.store === u.store) - (a.store === u.store) || tsMs(S.notes[b.id].at) - tsMs(S.notes[a.id].at));
  const one = (p, me, n) => `<button class="inote ${me ? 'me' : ''} ${n ? '' : 'empty'}" data-note="${p.id}"><div class="nbub"><p>${n ? esc(n.tx) : 'Tu nota…'}${me && !n ? '<b>+</b>' : ''}</p>${n ? noteRxBadge(n) : ''}</div><i class="tail"></i>${av(p)}<span>${me ? 'Tu nota' : esc(first(p.n))}</span></button>`;
  return `<div class="notes">${one({ ...u, photo: S.me.photo }, true, mine)}${others.map(p => one(p, false, S.notes[p.id])).join('')}</div>`;
}
function tiendaHoy() {
  const u = S.me, day = nowParts().day, arr = (S.today || {}).arr || {};
  if (isSup()) return supCard();
  const team = Object.values(S.staff).filter(p => p.active !== false && !isSup(p) && p.store === u.store && expected(p, day, arr));
  if (!team.find(p => p.id === u.id) && myState() !== 'fuera') team.unshift(u);
  const ok = team.filter(p => arr[p.id]);
  return `<div class="sec"><div class="sech"><b>${esc(storeN(u.store))} hoy</b><span>${ok.length} de ${team.length} ya llegaron</span></div>
    <div class="stories">${team.map(p => `<button class="story ${arr[p.id] ? '' : 'off'}" data-story="${p.id}"><div class="ring">${av(dirP(p.id))}</div><span>${p.id === u.id ? 'Tú' : esc(first(p.n))}</span></button>`).join('') || '<div class="empty">Nadie programado hoy.</div>'}</div></div>`;
}
function supCard() {
  const day = nowParts().day, arr = (S.today || {}).arr || {};
  const exp = Object.values(S.staff).filter(p => p.active !== false && !isSup(p) && expected(p, day, arr));
  const ok = exp.filter(p => arr[p.id]);
  return `<div class="sec"><div class="sech"><b>D'La Rossa hoy</b><span>${ok.length} de ${exp.length} ya llegaron</span></div>
    ${(() => { const r = rachas(); if (!r) return ''; const top = Object.entries(r.stores).filter(([, x]) => x.cur > 0).sort((a, b) => b[1].cur - a[1].cur).slice(0, 6); return top.length ? `<div class="rtop" style="margin:0 14px 8px">${top.map(([id, x], i) => `<span>${['🥇', '🥈', '🥉'][i] || '🔥'} ${esc(storeN(id))} <b>${x.cur}</b></span>`).join('')}</div>` : ''; })()}
    <div class="stories">${ok.slice(0, 12).map(p => `<button class="story" data-story="${p.id}"><div class="ring">${av(dirP(p.id))}</div><span>${esc(first(p.n))}</span></button>`).join('') || '<div class="empty">Todavía no llega nadie.</div>'}</div></div>`;
}
const bioOf = sid => (S.notes[sid] || {}).bio || '';
const dirP = sid => { const s = S.staff[sid] || {}, d = S.dir.find(x => x.id === sid) || {}; return { ...s, ...d, id: sid, n: s.n || d.n }; };
// Reacciones: likedBy guarda { persona: emoji } (los "me gusta" viejos, guardados como true, cuentan como ❤️)
const rxOf = v => v === true ? '❤️' : v;
function rxSummary(it) {
  const cnt = {}; Object.values(it.likedBy || {}).forEach(v => { const e = rxOf(v); cnt[e] = (cnt[e] || 0) + 1; });
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
  return { n: Object.values(cnt).reduce((a, b) => a + b, 0), top };
}
function postCard(it) {
  const u = S.me, p = dirP(it.by), mine = rxOf((it.likedBy || {})[u.id]), { n, top } = rxSummary(it), open = S.rxOpen === it.id;
  let body = '', badge = '';
  if (it.kind === 'anuncio') {
    badge = `<span class="rt ${it.aud && it.aud !== 'all' ? 'enc' : 'jef'}">📣 ${it.aud && it.aud !== 'all' ? esc(storeN(it.aud)) : 'Toda la empresa'}</span>`;
    body = it.tx.length <= 120 ? `<div class="pimg fbstat fb${(it.id.charCodeAt(0)) % 3}"><div>${nl(it.tx)}</div></div>` : `<div class="ptx pcap">${nl(it.tx)}</div>`;
  }
  if (it.kind === 'reco') {
    const c = RCATS.find(x => x[0] === it.cat) || RCATS[0], t = dirP(it.to); badge = '<span class="rt reco">👏 Reconocimiento</span>';
    body = `<div class="pimg g-reco"><div class="rav">${av(t)}<span>${c[1]}</span></div><div class="rtt">reconoció a <b>${t.id === u.id ? 'ti' : esc(t.n)}</b></div><div class="rcat">${c[2]}</div><div class="rq">“${esc(it.tx)}”</div></div>`;
  }
  if (it.kind === 'auto' && it.kind2 === 'noticiero') {
    badge = '<span class="rt auto">Noticiero</span>';
    const ns = it.notas || [], lead = ns[0], yo = sup0() ? null : (it.liga || []).find(x => sameN(x.n, u.n)), mt = sup0() ? null : (it.tiendas || []).find(x => sameN(x.n, storeN(u.store)));
    const tuyo = [yo ? `⭐ Vas <b>#${yo.o}</b> en la Liga con ${yo.p} pts` : '', mt ? `🏪 ${esc(storeN(u.store))} va <b>#${mt.o}</b> con ${mt.c}%` : ''].filter(Boolean);
    body = `<div class="ptx pcap" style="padding-top:2px">${nl(it.tx || '')}</div><div class="news">
      <div class="nbar"><span class="live">● EN VIVO</span><b>ROSITA NOTICIAS</b><span class="nd">${it.ed === 'tarde' ? '🌇 Tarde · ' : ''}${esc((it.title || '').split('·').pop() || '')}</span></div>
      ${lead ? `<div class="nlead"><span>${esc(lead.e)}</span><h3>${esc(lead.h)}</h3><p>${esc(lead.s || '')}</p></div>` : ''}
      ${ns.slice(1).map(n => `<div class="nitem"><i>${esc(n.e)}</i><div><b>${esc(n.h)}</b><small>${esc(n.s || '')}</small></div></div>`).join('')}
      ${tuyo.length ? `<div class="ntuyo"><span>📍 Para ti</span>${tuyo.join('<br>')}</div>` : ''}
      <div class="ntick"><span>⏳ Quedan ${it.quedan} ${it.quedan === 1 ? 'día' : 'días'} para cerrar ${esc(it.mesNombre || 'el mes')}</span><a href="${ARENA_URL}" target="_blank" rel="noopener">Ver tabla completa ›</a></div></div>`;
  } else if (it.kind === 'auto' && it.kind2 === 'tabla') {
    badge = '<span class="rt auto">Arena</span>';
    const M = ['🥇', '🥈', '🥉'], yo = (it.liga || []).find(x => sameN(x.n, u.n)), myT = storeN(u.store), open = S.ligaOpen === it.id;
    const ts = (it.tiendas || []).map((x, i) => `<div class="trow ${!isSup() && sameN(x.n, myT) ? 'me' : ''}"><span class="tp">${M[i] || i + 1}</span><span class="tn">${esc(x.n)}</span><span class="tb"><i style="width:${Math.min(100, x.c / 1.2)}%"></i></span><b>${x.c}%</b></div>`).join('');
    const lg = (it.liga || []), lshow = open ? lg : lg.slice(0, 10);
    const ls = lshow.map(x => `<div class="trow ${yo && x.n === yo.n ? 'me' : ''}"><span class="tp">${M[x.o - 1] || x.o}</span><span class="tn">${esc(x.n)}${x.t ? `<small>${esc(x.t)}</small>` : ''}</span><b>${x.p} pts</b></div>`).join('');
    body = `<div class="ptx pcap" style="padding-top:2px">${nl(it.tx || '')}</div><div class="tabla"><div class="tt">${esc(it.title || '')}</div>
      ${ts ? `<div class="th">🏪 Desafío de Tiendas</div>${ts}` : ''}
      ${ls ? `<div class="th">⭐ Liga de Vendedoras</div>${ls}${lg.length > 10 ? `<button class="tmore" data-lmore="${it.id}">${open ? 'Ver menos' : `Ver toda la Liga (${lg.length})`}</button>` : ''}` : ''}
      ${yo && yo.o > 10 && !open ? `<div class="trow me"><span class="tp">${yo.o}</span><span class="tn">Tú</span><b>${yo.p} pts</b></div>` : ''}</div>`;
  } else if (it.kind === 'auto') {
    const gan = /^arena-cierre/.test(it.id);
    badge = `<span class="rt auto">${gan ? 'Noticiero' : 'Última hora'}</span>`;
    body = `<div class="news"><div class="nbar"><span class="live">${gan ? '🏆 ESPECIAL' : '⚡ ÚLTIMA HORA'}</span><b>ROSITA NOTICIAS</b></div>
      <div class="nlead"><span>${esc(it.icon || '🏆')}</span><h3>${esc(it.title || '')}</h3>${it.tx ? `<p>${nl(it.tx)}</p>` : ''}</div></div>`;
  }
  if (it.kind === 'foto') { badge = `<span class="rt auto">${esc(it.tag || '📷')}</span>`; body = `<div class="pfoto"><img src="${it.img}" alt="" loading="lazy"></div><div class="pcap" style="padding-top:8px"><b>${esc(first(p.n))}</b> ${nl(it.tx || '')}</div>`; }
  const sub = it.kind === 'foto' ? (it.store === 'fuera' ? `📍 ${esc(it.lugar || 'Otra actividad')}` : `${esc(storeN(it.store))} · ${esc((S.stores[it.store] || {}).city || '')}`) : `${esc(p.puesto || '')}`;
  const head = it.kind === 'auto' ? `<div class="logo"><span class="rlmark"></span></div><div class="pw"><b>Rosita</b><small>${it.src === 'arena' ? "Arena D'La Rossa" : 'Rosita Personal'}</small></div>` : `${av(p)}<div class="pw"><b>${it.by === u.id ? 'Tú' : esc(p.n)}</b><small>${sub}</small></div>`;
  return `<article class="post" data-post="${it.id}"><div class="ph2">${head}${badge}${(it.by === u.id || isAdmin()) ? `<button class="pdots" data-pdel="${it.id}" title="Borrar">${ico('dots')}</button>` : ''}</div>${body}
  <div class="pact rxwrap">${open ? `<div class="rxbar">${RX.map(([e, l]) => `<button data-rxe="${e}" data-rxp="${it.id}" class="${mine === e ? 'on' : ''}" title="${l}">${e}</button>`).join('')}</div>` : ''}
    <button type="button" data-rx="${it.id}" class="rxbtn ${mine ? 'on' : ''}">${mine ? `<span class="rxe">${mine}</span>${(RX.find(x => x[0] === mine) || [0, 'Reaccionaste'])[1]}` : `${ico('heart')}Reaccionar`}</button></div>
  <div class="pmeta">${n ? `<b class="rxsum"><span>${top.join('')}</span> ${n === 1 && mine ? 'Tú' : mine ? `Tú y ${n - 1} más` : n}</b>` : '<span class="first">Reacciona primero</span>'}${it.claps ? `<span> · 👏 ${it.claps}</span>` : ''}<small>${ago(tsMs(it.at)).toUpperCase()}</small></div></article>`;
}
function llegadasCard() {
  const u = S.me, arr = (S.today || {}).arr || {};
  const ids = Object.keys(arr).filter(id => id !== u.id && (S.scope !== 'tienda' || arr[id].st === u.store));
  if (!ids.length) return '';
  const ppl = ids.map(dirP).sort((a, b) => (arr[b.id].t || '').localeCompare(arr[a.id].t || ''));
  return `<div class="post arrivals"><div class="stack">${ppl.slice(0, 5).map(p => av(p)).join('')}</div><div style="flex:1;min-width:0"><b>☀️ ${ppl.length === 1 ? `${esc(first(ppl[0].n))} ya llegó` : `${ppl.length} del equipo ya llegaron`}</b><small>${ppl.slice(0, 3).map(p => esc(first(p.n))).join(', ')}${ppl.length > 3 ? ' y ' + (ppl.length - 3) + ' más' : ''}</small></div></div>`;
}
function birthdayCards() {
  const np = nowParts(), md = np.day.slice(5);
  return Object.values(S.staff).filter(p => p.active !== false && p.cumple === md).map(p => `<article class="post"><div class="ph2"><div class="logo"><span class="rlmark"></span></div><div class="pw"><b>Rosita</b><small>Cumpleaños del día</small></div><span class="rt auto">Automático</span></div>
    <div class="pimg g-cumple"><span>🎂</span><div>Hoy cumple años <b>${esc(p.n)}</b> de ${esc(storeN(p.store))} 🎉 ¡Déjale tu saludo!</div></div></article>`).join('');
}
function viewInicio() {
  const u = S.me;
  let h = notesRow() + `<div class="hwrap">${heroCard()}</div>` + rachaCard();
  if (!S.me.photo) h += `<label class="phnudge"><span>${ico('camera')}</span><div><b>Agrega tu foto de perfil</b> para que te reconozcan</div><em>Agregar</em><input type="file" accept="image/*" data-photo hidden></label>`;
  h += tiendaHoy();
  h += `<div class="sec"><div class="sech"><b>Novedades</b>${canPost() ? `<button class="pubbtn" data-crear>${ico('plus')} Crear</button>` : ''}</div>
    <div class="scope"><button data-scope="todo" class="${S.scope !== 'tienda' ? 'on' : ''}">Todo D'La Rossa</button><button data-scope="tienda" class="${S.scope === 'tienda' ? 'on' : ''}">${esc(storeN(u.store))}</button></div></div>`;
  h += birthdayCards();
  const items = S.posts.filter(it => {
    if (it.kind === 'anuncio' && it.aud && it.aud !== 'all' && it.aud !== u.store && !isMgr() && it.by !== u.id) return false;
    if (S.scope === 'tienda') { if (it.kind === 'foto') return it.store === u.store; if (it.kind === 'reco') return (P(it.to) || {}).store === u.store; if (it.kind === 'anuncio') return it.aud === u.store; if (it.kind === 'auto') return !it.tienda || sameN(it.tienda, storeN(u.store)); }
    return true;
  });
  const arr = llegadasCard(); let placed = false;
  for (const it of items) { if (arr && !placed && Date.now() - tsMs(it.at) > 3 * 3600e3) { h += arr; placed = true; } h += postCard(it); }
  if (arr && !placed) h += arr;
  if (!items.length && !arr) h += `<div class="note" style="margin:14px">Todavía no hay publicaciones. ${canPost() ? 'Toca <b>Crear</b> para publicar la primera.' : 'Pronto verás aquí anuncios, fotos y reconocimientos.'}</div>`;
  return h;
}
function viewMarcar() {
  const u = S.me, hor = myHor();
  let h = `<div class="hwrap" style="padding-top:14px">${heroCard()}</div><div style="padding:0 16px">`;
  h += `<div class="h3">Mi día <span>${niceDate(nowParts().day)}</span></div><ul class="tl">${S.myMarks.length ? S.myMarks.map(m => `<li style="flex-wrap:wrap"><span class="tm">${m.hm}</span><span style="flex:1">${{ entrada: '🟢 Entrada', almuerzo: '🍽️ Salió a almorzar', regreso: '↩️ Regresó de almuerzo', salida: '🔵 Salida', extra: '🌙 Inició horas extra', extrafin: '✅ Terminó horas extra' }[m.type]}</span>${m.avance && m.avance.trim() ? `<small style="display:block;width:100%;color:#65676b;padding-left:52px">📝 ${esc(m.avance)}</small>` : ''}${m.type === 'extrafin' && m.extraMin != null ? `<span class="fl ok">${hmin(m.extraMin)}</span>` : ''}${m.gps && m.gps.inside === false ? '<span class="fl amb">fuera de sitio</span>' : m.late ? `<span class="fl warn">+${m.late} min</span>` : m.type === 'entrada' && fixedIn(S.horarios[u.horario]) ? '<span class="fl ok">a tiempo</span>' : ''}</li>`).join('') : '<li class="empty">Todavía no marcaste hoy.</li>'}</ul>`;
  h += `<div class="h3">Mi horario</div><div class="note" style="margin-top:0">${hor && hor.flex ? `<b>${esc(hor.n)}</b> · horario flexible<br>${hor.flexIni ? `Entrada fija a las <b>${hor.ini}</b> (tolerancia ${hor.tol ?? 5} min). Salida libre y días variados.` : 'Sin hora ni días fijos: marca cuando empieces y cuando termines.'}` : hor ? `<b>${esc(hor.n)}</b> · ${hor.ini}–${hor.fin}${hor.lunch ? ` · almuerzo ${hor.lunch} min` : ''}<br>Días: ${hor.dias.map(d => DIAS_C[d]).join(', ')}${medioTxt(u) ? `<br>${medioTxt(u)}` : ''}<br>Descanso: <b>${u.descanso >= 0 ? DIAS[u.descanso] : 'según horario'}</b>` : 'Sin horario asignado'}</div>`;
  h += misCambios();
  return h + `</div>`;
}
function misCambios() {
  const u = S.me, mine = S.cambios.filter(c => c.sid === u.id).sort((a, b) => b.rest.localeCompare(a.rest)).slice(0, 5);
  return `<div class="h3">Descansos y permisos</div>
  ${isFlex(u) ? '' : `<button class="act sec" data-cnew style="padding:12px;font-size:15px;width:100%;margin-bottom:8px"><span class="ic">${ico('swap')}</span><span>Cambiar un día de descanso<small>En vez de perder el día, lo mueves a otra fecha</small></span></button>`}
  <button class="act sec" data-pnew style="padding:12px;font-size:15px;width:100%"><span class="ic">${ico('cal')}</span><span>Pedir permiso<small>Día completo o medio día · se descuenta</small></span></button>
  ${mine.length ? `<ul class="tl" style="margin-top:6px">${mine.map(c => `<li style="flex-wrap:wrap"><span style="flex:1">${cambioTxt(c)}<small style="display:block;color:#65676b">${esc(c.mot || '')}</small></span>${chipC(c)}</li>`).join('')}</ul>` : ''}`;
}
const MEDIO_L = { am: 'medio día (mañana)', pm: 'medio día (tarde)' };
const cambioTxt = c => c.tipo === 'permiso'
  ? `📝 Permiso <b>${niceDate(c.rest)}</b> · ${c.medio ? MEDIO_L[c.medio] : 'día completo'} · se descuenta`
  : `Descansa <b>${niceDate(c.rest)}</b> · trabaja <b>${niceDate(c.work)}</b>`;
const chipC = c => c.estado === 'pendiente' ? '<span class="st y">Pendiente</span>' : c.estado === 'aprobado' ? `<span class="st g">✓ Aprobado</span>` : '<span class="st p" style="color:var(--warn)">✕ Rechazado</span>';
function viewPerfil() {
  const u = S.me, hor = myHor(), recos = S.posts.filter(x => x.kind === 'reco' && x.to === u.id);
  const cnt = {}; recos.forEach(r => cnt[r.cat] = (cnt[r.cat] || 0) + 1);
  return `<div style="padding:0 16px"><div class="prof"><label class="pfedit">${av({ ...u, photo: u.photo })}<span class="cam">${ico('camera')}</span><input type="file" accept="image/*" data-photo hidden></label>
    <div class="pstats">${isSup() ? `<div><b>${S.posts.filter(x => x.by === u.id).length}</b><span>publica&shy;ciones</span></div><div><b>${S.posts.filter(x => x.kind === 'reco' && x.by === u.id).length}</b><span>reconoci&shy;mientos dados</span></div><div><b>👁️</b><span>supervisión</span></div>` : `<div><b>${recos.length}</b><span>reconoci&shy;mientos</span></div><div><b>🔥 ${(myRacha() || {}).cur ?? '—'}</b><span>racha · mejor ${(myRacha() || {}).best ?? 0}</span></div><div><b>${u.descanso >= 0 ? DIAS_C[u.descanso] : '—'}</b><span>descanso</span></div>`}</div>
    <h3>${esc(u.n)}</h3><p>${esc(u.puesto || '')}${isSup() ? '' : ` · ${esc(storeN(u.store))}`}</p>
    ${bioOf(u.id) ? `<button class="bio" data-bio>“${esc(bioOf(u.id))}”</button>` : `<button class="bio add" data-bio>＋ Agrega una frase</button>`}<label class="chgph">${u.photo ? 'Cambiar foto' : 'Agregar foto de perfil'}<input type="file" accept="image/*" data-photo hidden></label></div>
    ${recos.length ? `<div class="h3">Reconocimientos</div><div class="hl">${Object.entries(cnt).map(([k, n]) => { const c = RCATS.find(x => x[0] === k) || RCATS[0]; return `<div><div class="hlc">${c[1]}${n > 1 ? `<i>${n}</i>` : ''}</div><span>${c[2]}</span></div>`; }).join('')}</div>` : ''}
    ${isSup() || !inRacha(u) ? '' : badgeGrid(u.id)}
    <div class="h3">Cuenta</div>
    <button class="wide ghost" data-pinchg>Cambiar mi PIN</button>
    <button class="wide ghost" data-logout style="margin-top:8px">Cerrar sesión</button>
    ${firma('pfirma')}</div>`;
}

/* ===== GESTIÓN ===== */
function gestionTabs() {
  const t = [];
  if (canSeeLive()) t.push(['live', 'En vivo']);
  if (canUsers()) t.push(['people', 'Personas']);
  if (isAdmin()) t.push(['hor', 'Horarios'], ['stores', 'Tiendas']);
  if (isMgr()) t.push(['camb', 'Descansos']);
  if (canSeeLive()) t.push(['rachas', 'Rachas 🔥']);
  return t;
}
function viewGestion() {
  const tabs = gestionTabs();
  if (!tabs.length) return viewMiTienda();
  if (!S.sub || !tabs.some(t => t[0] === S.sub)) S.sub = tabs[0][0];
  const pend = S.cambios.filter(c => c.estado === 'pendiente' && canDecide(c)).length;
  let h = `<div class="gtabs">${tabs.map(([k, l]) => `<button data-sub="${k}" class="${S.sub === k ? 'on' : ''}">${l}${k === 'camb' && pend ? ` <i>${pend}</i>` : ''}</button>`).join('')}</div><div class="gbody">`;
  h += ({ live: viewLive, people: viewPeople, hor: viewHorarios, stores: viewStores, camb: viewCambios, rachas: viewRachas })[S.sub]();
  return h + `</div>`;
}
function viewMiTienda() {
  const u = S.me, day = nowParts().day, arr = (S.today || {}).arr || {}, out = (S.today || {}).out || {};
  const team = Object.values(S.staff).filter(p => p.active !== false && !isSup(p) && p.store === u.store);
  return `<div style="padding:14px 16px"><div class="h3" style="margin-top:0">${esc(storeN(u.store))} <span>${team.length} personas</span></div>` + team.map(p => {
    const w = worksOn(p, S.horarios[p.horario], day, S.cambios), a = arr[p.id];
    return `<div class="mate">${av(dirP(p.id))}<div style="flex:1"><b>${p.id === u.id ? 'Tú' : esc(p.n)}</b><small>${esc(p.puesto || (ROLES[p.role] || {}).l)}${(rachas() || { per: {} }).per[p.id] ? ` · 🔥 ${rachas().per[p.id].cur}` : ''}</small></div>${isFlex(p) && !a && !out[p.id] ? '<span class="st p">horario flexible</span>' : !w ? `<span class="st p">${restReason(p, S.horarios[p.horario], day, S.cambios).k === 'permiso' ? 'permiso' : 'descansa'}</span>` : out[p.id] ? '<span class="st b">ya salió</span>' : a ? '<span class="st g">● en tienda</span>' : '<span class="st p">aún no llega</span>'}</div>`;
  }).join('') + `<div class="note">Tu equipo ve si ya llegaste, nunca tus tardanzas. Eso solo lo ven tus jefes.</div></div>`;
}
function viewLive() {
  const day = nowParts().day, T = S.today || {}, arr = T.arr || {}, out = T.out || {}, lunch = T.lunch || {};
  const ppl = Object.values(S.staff).filter(p => p.active !== false && !['admin', 'fundador'].includes(p.role));
  const exp = ppl.filter(p => expected(p, day, arr));
  const pres = exp.filter(p => arr[p.id]), late = exp.filter(p => arr[p.id] && arr[p.id].late > 0), npm = nowParts().min;
  const miss = exp.filter(p => { const h = horDe(p, day); return !arr[p.id] && h && !h.flex && npm > toMin(h.ini) + (h.tol || 5); });
  let h = `<div class="kpis2"><div><b>${pres.length}/${exp.length}</b><span>llegaron</span></div><div class="w"><b>${late.length}</b><span>tarde</span></div><div class="w"><b>${miss.length}</b><span>sin marcar</span></div><div><b>${ppl.length - exp.length}</b><span>descansan</span></div></div>`;
  const stores = Object.values(S.stores).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  for (const st of stores) {
    const team = ppl.filter(p => p.store === st.id); if (!team.length) continue;
    h += `<div class="h3">${esc(st.n)} <span>${team.filter(p => arr[p.id]).length}/${team.filter(p => expected(p, day, arr)).length}</span></div><div class="lcard">`;
    for (const p of team) {
      const w = worksOn(p, S.horarios[p.horario], day, S.cambios), a = arr[p.id], hor = horDe(p, day);
      const pm = (S.liveMarks || []).filter(m => m.sid === p.id), xo = openExtra(pm), xm = extraMin(pm, day);
      let chip;
      if (!w) { const r = restReason(p, hor, day, S.cambios); chip = `<span class="st p">${r.k === 'permiso' ? '📝 permiso' : r.k === 'cambio' ? '🔁 descanso movido' : 'descansa'}</span>`; }
      else if (out[p.id]) chip = `<span class="st b">salió ${out[p.id]}</span>`;
      else if (lunch[p.id] && !lunch[p.id].r) chip = `<span class="st y">almuerzo ${lunch[p.id].o}</span>`;
      else if (a) chip = `<span class="st ${a.late > 0 ? 'y' : 'g'}">${a.t}${!fixedIn(hor) ? '' : a.late > 0 ? ` · +${a.late} min` : ' ✓'}${a.far ? ' · 📍fuera' : ''}</span>`;
      else if (hor && hor.flex) chip = '<span class="st p">flexible · no ha marcado</span>';
      else chip = miss.includes(p) ? '<span class="st" style="background:var(--warn-bg);color:var(--warn)">sin marcar</span>' : `<span class="st p">entra ${hor ? hor.ini : '—'}</span>`;
      if (xo) chip = `<span class="st b">🌙 extra desde ${xo.hm}</span>`;
      const avz = pm.filter(m => m.day === day && m.avance && m.avance.trim()).pop();
      h += `<div class="lrow">${av(dirP(p.id))}<div style="flex:1;min-width:0"><b>${esc(p.n)}</b><small>${esc(p.puesto || (ROLES[p.role] || {}).l)}${w && hor && hor.medio ? ` · ½ día ${hor.ini}–${hor.fin}${hor.why === 'permiso' ? ' (permiso)' : ''}` : ''}${!xo && xm ? ` · 🌙 extra ${hmin(xm)}` : ''}${avz ? `<span style="display:block;color:#3a3b3c">📝 ${esc(avz.avance)}</span>` : ''}</small></div>${chip}</div>`;
    }
    h += `</div>`;
  }
  return h;
}
function viewPeople() {
  const all = Object.values(S.staff).sort((a, b) => (S.stores[a.store]?.order ?? 99) - (S.stores[b.store]?.order ?? 99) || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  let h = `<button class="wide" data-unew style="margin-bottom:12px">＋ Crear usuario</button>`;
  if (all.length <= 1) h += `<div class="note" style="margin:0 0 12px">Aquí creas a cada persona: su tienda, su rol, su horario y su día de descanso. Al crearla le das un PIN de 4 dígitos para entrar.</div>`;
  let cur = null;
  for (const p of all) {
    if (p.store !== cur) { cur = p.store; h += `<div class="gh" style="margin:14px 2px 6px">${esc(storeN(cur))}</div>`; }
    const hor = S.horarios[p.horario];
    h += `<button class="urow ${p.active === false ? 'off' : ''}" data-uedit="${p.id}">${av(dirP(p.id))}<div style="flex:1;min-width:0"><b>${esc(p.n)}${p.active === false ? ' · desactivado' : ''}</b><small>${esc((ROLES[p.role] || {}).l || p.role)} · ${horLbl(hor)} · descansa ${p.descanso >= 0 ? DIAS_C[p.descanso] : '—'}${(p.medios || []).length ? ` · ½ día ${p.medios.map(d => DIAS_C[d]).join(' ')}` : ''}</small></div>${ico('edit')}</button>`;
  }
  return h;
}
function viewHorarios() {
  const hs = Object.values(S.horarios).sort((a, b) => a.n.localeCompare(b.n));
  return `<button class="wide" data-hnew style="margin-bottom:12px">＋ Nuevo horario</button><div class="note" style="margin:0 0 12px">Los horarios son plantillas: a cada persona le asignas uno y además su día de descanso. Ajusta estos ejemplos a los horarios reales de cada tienda.</div>` +
    hs.map(x => { const n = Object.values(S.staff).filter(p => p.horario === x.id).length; return `<button class="urow" data-hedit="${x.id}"><div class="hic">${ico('clock')}</div><div style="flex:1"><b>${esc(x.n)}</b><small>${x.flex ? (x.flexIni ? `Flexible · entra ${x.ini} · salida libre · días variados · sin horas extra` : 'Flexible · sin hora ni días fijos · sin horas extra') : `${x.ini}–${x.fin} · ${x.dias.map(d => DIAS_C[d]).join(' ')}${x.lunch ? ` · almuerzo ${x.lunch} min` : ' · sin almuerzo'}`} · ${n} ${n === 1 ? 'persona' : 'personas'}</small></div>${ico('edit')}</button>`; }).join('');
}
function viewStores() {
  const st = Object.values(S.stores).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  return `<div class="note" style="margin:0 0 12px">Para verificar que la gente marque desde su tienda, guarda la <b>ubicación de cada tienda</b>: ve a la tienda, abre aquí la tienda y toca <b>Usar mi ubicación actual</b>.</div>` +
    st.map(s => `<button class="urow" data-sedit="${s.id}"><div class="hic">${ico('store')}</div><div style="flex:1"><b>${esc(s.n)}</b><small>${esc(s.city || '')}${s.mall ? ' · centro comercial' : ''} · ${s.lat ? `📍 ubicación guardada (${s.radius || 150} m)` : '<span style="color:var(--amber)">sin ubicación</span>'}</small></div>${ico('edit')}</button>`).join('') + `<button class="wide ghost" data-snew style="margin-top:12px">＋ Nueva tienda</button>`;
}
const canDecide = c => isAdmin() || (role() === 'jefe' && S.me.dept === c.dept && c.sid !== S.me.id);
function viewCambios() {
  const pend = S.cambios.filter(c => c.estado === 'pendiente' && canDecide(c)), rest = S.cambios.filter(c => c.estado !== 'pendiente').sort((a, b) => b.rest.localeCompare(a.rest)).slice(0, 20);
  let h = `<div style="display:flex;gap:8px;margin-bottom:12px"><button class="wide" data-cnew2 style="margin:0;flex:1">${ico('swap')} Mover descanso</button><button class="wide ghost" data-pnew2 style="margin:0;flex:1">${ico('cal')} Dar permiso</button></div><div class="note" style="margin:0 0 12px">Cuando alguien necesita faltar, hay dos caminos: <b>mover su descanso</b> (descansa ese día y trabaja otro, sin descuento) o darle un <b>permiso</b> de día completo o medio día, que <b>se descuenta</b>.</div>`;
  h += `<div class="h3" style="margin-top:0">Por aprobar <span>${pend.length}</span></div>` + (pend.length ? pend.map(c => cambioRow(c, true)).join('') : '<div class="empty">Sin solicitudes pendientes.</div>');
  h += `<div class="h3">Historial</div>` + (rest.length ? rest.map(c => cambioRow(c, false)).join('') : '<div class="empty">Todavía no hay cambios.</div>');
  return h;
}
function cambioRow(c, act) {
  const p = dirP(c.sid);
  return `<div class="crowc">${av(p)}<div style="flex:1;min-width:0"><b>${esc(p.n)}</b><small>${cambioTxt(c)}${c.mot ? ` · “${esc(c.mot)}”` : ''}</small></div>${act ? `<div class="paybtns"><button data-cok="${c.id}">✓</button><button data-cno="${c.id}" style="color:var(--warn)">✕</button></div>` : chipC(c)}</div>`;
}

/* ===== HOJAS (bottom sheets) ===== */
const sheetWrap = (inner, cls = '') => `<div class="sheet-bg" data-bgclose><div class="sheet ${cls}" style="max-height:94%;overflow:auto">${inner}</div></div>`;
const opt = (v, l, sel) => `<option value="${esc(v)}" ${String(sel) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
function sheetHtml() {
  const sh = S.sheet; if (!sh) return '';
  if (sh.kind === 'about') return sheetWrap(`<img class="r" src="rosita.svg" alt=""><div class="awm"><img class="rlwm" src="wordmark-dark.svg" alt="rosita labs" style="width:160px;height:auto"></div><div class="app">Personal</div>
    <div class="rows"><div class="row"><span>Versión</span><span>${VERSION}</span></div><div class="row"><span>Para</span><span>Textiles D'La Rossa</span></div><div class="row"><span>Hecho por</span><span>Rosita Labs</span></div></div><div class="made">Hecho en Quetzaltenango, Guatemala</div><button class="aclose" data-close>Cerrar</button>`, 'about');
  if (sh.kind === 'user') return userSheet(sh);
  if (sh.kind === 'hor') return horSheet(sh);
  if (sh.kind === 'store') return storeSheet(sh);
  if (sh.kind === 'mapa') return `<div class="sheet-bg"><div class="sheet mapsheet"><h4>📍 ${esc(sh.back.s.n || 'Tienda')}</h4><div class="sub">Toca el mapa o arrastra el pin hasta la tienda</div>
    <div style="display:flex;gap:8px;margin-bottom:8px"><input id="m_q" class="fin" style="flex:1;margin:0" placeholder="Buscar lugar. Ej.: Utz Ulew Quetzaltenango"><button class="wide ghost" data-mq style="margin:0;width:auto;padding:0 14px">${ico('search')}</button></div>
    <div id="map"></div><div class="rsmall" id="m_ll" style="margin:6px 0">${sh.lat ? `${sh.lat.toFixed(5)}, ${sh.lng.toFixed(5)}` : 'Sin punto elegido'}</div>
    <div style="display:flex;gap:8px"><button class="wide ghost" data-mcancel style="margin:0;flex:1">Cancelar</button><button class="wide" data-mok style="margin:0;flex:2">Usar esta ubicación</button></div></div></div>`;
  if (sh.kind === 'cambio') return cambioSheet(sh);
  if (sh.kind === 'permiso') return permisoSheet(sh);
  if (sh.kind === 'pin') return sheetWrap(`<h4>Cambiar mi PIN</h4><div class="sub">Necesitas tu PIN actual</div>
    <input id="p_old" class="fin pinin" type="password" inputmode="numeric" maxlength="4" placeholder="PIN actual"><input id="p_new" class="fin pinin" type="password" inputmode="numeric" maxlength="4" placeholder="PIN nuevo"><input id="p_new2" class="fin pinin" type="password" inputmode="numeric" maxlength="4" placeholder="Repite el PIN nuevo">
    ${sh.err ? `<div class="err">${esc(sh.err)}</div>` : ''}<button class="wide" data-pinsave ${S.busy ? 'disabled' : ''}>Guardar</button><button class="wide ghost" data-close>Cancelar</button>`);
  if (sh.kind === 'crear') {
    const op = (k, ic, t, s) => `<button class="crow" data-crear2="${k}"><span>${ic}</span><div><b>${t}</b><small>${s}</small></div></button>`;
    return sheetWrap(`<h4>Crear</h4><div class="sub">¿Qué quieres compartir con el equipo?</div>${['encargada', 'jefe', 'admin', 'sistemas'].includes(role()) ? op('foto', '📷', 'Foto de la tienda', 'Vitrina, producto nuevo, tienda lista') : ''}${['encargada', 'jefe', 'admin', 'fundador', 'sistemas'].includes(role()) ? op('reco', '👏', 'Reconocer a alguien', role() === 'encargada' ? 'A alguien de tu tienda' : 'A cualquier persona') : ''}${op('anuncio', '📣', 'Anuncio', role() === 'encargada' ? 'Para tu tienda' : 'Para la empresa o una tienda')}<button class="wide ghost" data-close style="margin-top:6px">Cancelar</button>`);
  }
  if (sh.kind === 'anuncio') {
    const enc = role() === 'encargada';
    return sheetWrap(`<h4>📣 Nuevo anuncio</h4><div class="sub">${enc ? `Lo ve el personal de <b>${esc(storeN(S.me.store))}</b>` : 'Elige quién lo ve'}</div>
    ${enc ? '' : `<select id="a_aud" class="fin">${opt('all', 'Toda la empresa', sh.aud)}${Object.values(S.stores).map(s => opt(s.id, 'Solo ' + s.n, sh.aud)).join('')}</select>`}
    <textarea id="a_tx" class="fin" rows="4" placeholder="Ej.: Mañana inventario general a las 7:00">${esc(sh.tx || '')}</textarea>${sh.err ? `<div class="err">${esc(sh.err)}</div>` : ''}<button class="wide" data-apub ${S.busy ? 'disabled' : ''}>Publicar</button><button class="wide ghost" data-close>Cancelar</button>`);
  }
  if (sh.kind === 'foto') return sheetWrap(`<h4>Nueva foto</h4><div class="sub">La ve todo D'La Rossa</div>
    <label class="fpick">${sh.img ? `<img src="${sh.img}">` : `<span>${ico('camera')}</span><b>Tomar o elegir foto</b><small>Vitrina, producto, la tienda lista</small>`}<input type="file" accept="image/*" data-fotoimg hidden></label>
    <label class="lbl" style="margin-top:10px">¿Dónde fue?</label><select id="f_st" class="fin">${Object.values(S.stores).filter(s => role() !== 'encargada' || s.id === S.me.store).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map(s => opt(s.id, s.n, sh.store || S.me.store)).join('')}${opt('fuera', '📍 En otra actividad / fuera', sh.store)}</select>
    ${sh.store === 'fuera' ? `<input id="f_lugar" class="fin" value="${esc(sh.lugar || '')}" placeholder="¿Dónde? Ej.: Feria de Xela, apoyo a Mercadeo">` : ''}
    <div class="ideas" style="margin:10px 0">${FTAGS.map(t => `<button data-ftag="${t}" class="${sh.tag === t ? 'on' : ''}">${t}</button>`).join('')}<button data-ftag="otro" class="${sh.tag === 'otro' ? 'on' : ''}">✏️ Otro</button></div>
    ${sh.tag === 'otro' ? `<input id="f_tagx" class="fin" maxlength="24" value="${esc(sh.tagx || '')}" placeholder="Escribe la etiqueta. Ej.: Capacitación">` : ''}
    <textarea id="f_cap" class="fin" rows="2" placeholder="Escribe una descripción…">${esc(sh.cap || '')}</textarea>${sh.err ? `<div class="err">${esc(sh.err)}</div>` : ''}<button class="wide" data-fpub ${S.busy ? 'disabled' : ''}>Compartir</button><button class="wide ghost" data-close>Cancelar</button>`);
  if (sh.kind === 'reco') {
    const pool = Object.values(S.staff).filter(p => p.active !== false && p.id !== S.me.id && (role() !== 'encargada' || p.store === S.me.store));
    return sheetWrap(`<h4>Reconocer a alguien</h4><div class="sub">Se publica en Novedades y queda en su perfil</div>
    <div class="pchips">${pool.map(p => `<button data-rpick="${p.id}" class="${sh.to === p.id ? 'on' : ''}">${av(dirP(p.id))}${esc(first(p.n))}<small>${esc(storeN(p.store))}</small></button>`).join('')}</div>
    <div class="ideas" style="margin-bottom:10px">${RCATS.map(c => `<button data-rcat="${c[0]}" class="${sh.cat === c[0] ? 'on' : ''}">${c[1]} ${c[2]}</button>`).join('')}</div>
    <textarea id="r_tx" class="fin" rows="2" placeholder="Cuenta qué hizo">${esc(sh.tx || '')}</textarea>${sh.err ? `<div class="err">${esc(sh.err)}</div>` : ''}<button class="wide" data-rpub ${S.busy ? 'disabled' : ''}>👏 Publicar reconocimiento</button><button class="wide ghost" data-close>Cancelar</button>`);
  }
  if (sh.kind === 'nota') {
    const n0 = S.notes[S.me.id], n = n0 && n0.tx ? n0 : null, v = sh.tx ?? (n && Date.now() - tsMs(n.at) < 864e5 ? n.tx : '');
    return sheetWrap(`<h4>Tu nota</h4><div class="sub">La ve todo D'La Rossa durante 24 horas. Máximo 60 letras.</div>
    <div class="npreview"><div class="nbub big"><p id="nprev">${v ? esc(v) : '¿Qué está pasando?'}</p></div>${av(S.me)}</div>
    <div style="position:relative"><input id="n_tx" maxlength="60" class="fin" value="${esc(v)}" placeholder="Comparte algo corto con el equipo" autocomplete="off" style="padding-right:52px"><span id="ncount" class="ncount">${v.length}/60</span></div>
    <div class="ideas" style="margin:4px 0 12px">${NEMO.map(e => `<button data-nemo="${e}">${e}</button>`).join('')}</div>
    ${n && Object.keys(n.rx || {}).length ? `<div class="h3" style="margin:4px 0 6px">Reacciones a tu nota</div><div class="nrxlist">${noteRxList(n)}</div>` : ''}
    <button class="wide" data-nsave>Compartir nota</button>${n ? '<button class="wide ghost" data-ndel>Borrar mi nota</button>' : '<button class="wide ghost" data-close>Cancelar</button>'}`);
  }
  if (sh.kind === 'insignia') { const bs = BADGES.filter(x => sh.keys.includes(x[0])); return sheetWrap(`<div style="text-align:center"><div class="bnew">${bs.map(x => x[1]).join(' ')}</div><h4>${bs.length > 1 ? '¡Nuevas insignias!' : '¡Nueva insignia!'}</h4>
    ${bs.map(x => `<div style="margin:6px 0"><b>${x[2]}</b><div class="sub" style="margin:0">${x[3]}</div></div>`).join('')}<button class="wide" data-close style="margin-top:12px">¡Genial!</button></div>`); }
  if (sh.kind === 'avance') return sheetWrap(`<h4>¿Qué avanzaste hoy?</h4><div class="sub">Opcional · lo ve tu jefe</div>
    <textarea id="av_tx" class="fin" rows="3" maxlength="300" placeholder="Ej.: terminé 12 güipiles, avancé el pedido de Metroplaza"></textarea>
    <button class="wide" data-avok>Marcar salida</button><button class="wide ghost" data-close>Cancelar</button>`);
  if (sh.kind === 'xtra') return sheetWrap(`<div style="text-align:center"><div style="font-size:42px">🌙</div><h4>¿Vas a trabajar horas extra?</h4><div class="sub">Estás marcando fuera de tu horario de hoy (${sh.hor.ini}–${sh.hor.fin}).</div></div>
    <button class="wide" data-xyes>Sí, son horas extra</button><button class="wide ghost" data-xno>No, es mi entrada normal</button><button class="wide ghost" data-close>Cancelar</button>`);
  if (sh.kind === 'bio') return sheetWrap(`<h4>Tu frase</h4><div class="sub">Aparece en tu perfil y la ve todo D'La Rossa</div>
    <div style="position:relative"><input id="b_tx" maxlength="80" class="fin" value="${esc(sh.tx ?? bioOf(S.me.id))}" placeholder="Ej.: Con trabajo y fe todo se logra" autocomplete="off"></div>
    <button class="wide" data-bsave>Guardar frase</button>${bioOf(S.me.id) ? '<button class="wide ghost" data-bdel>Quitar mi frase</button>' : '<button class="wide ghost" data-close>Cancelar</button>'}`);
  if (sh.kind === 'vernota') {
    const p = dirP(sh.id), n = S.notes[sh.id];
    return sheetWrap(`<div style="text-align:center"><div class="npreview"><div class="nbub big"><p>${esc(n.tx)}</p></div>${av(p)}</div><b style="font-size:16px">${esc(p.n)}</b><div class="sub" style="margin-top:2px">${esc(p.puesto || '')}${isSup(p) ? '' : ` · ${esc(storeN(p.store))}`} · ${ago(tsMs(n.at))}</div>${n.bio ? `<div class="biov">“${esc(n.bio)}”</div>` : ''}
    <div class="nrxbar">${RX.map(([e, l]) => `<button data-nrx="${e}" class="${(n.rx || {})[S.me.id] === e ? 'on' : ''}" title="${l}">${e}</button>`).join('')}</div>
    ${Object.keys(n.rx || {}).length ? `<div class="sub" style="margin:2px 0 0">${Object.keys(n.rx).length} ${Object.keys(n.rx).length === 1 ? 'reacción' : 'reacciones'}</div>` : ''}
    ${isMgr() ? '<button class="peek" data-nhide style="color:var(--warn)">Ocultar esta nota</button>' : ''}<button class="wide ghost" data-close>Cerrar</button></div>`);
  }
  return '';
}
function userSheet(sh) {
  const u = sh.u || {}, isNew = !sh.id, hs = Object.values(S.horarios);
  const roles = ROLE_ORDER.filter(r => isAdmin() || !['admin', 'fundador'].includes(r));
  return sheetWrap(`<h4>${isNew ? 'Crear usuario' : 'Editar usuario'}</h4><div class="sub">${isNew ? 'Al guardar, la persona aparece en la pantalla de ingreso' : esc(u.n)}</div>
  <label class="lbl">Nombre completo</label><input id="u_n" class="fin" value="${esc(u.n || '')}" placeholder="Ej.: Elizabeth Pérez">
  <label class="lbl">Puesto</label><input id="u_p" class="fin" value="${esc(u.puesto || '')}" placeholder="Ej.: Asesora de ventas">
  <label class="lbl">Rol en la app</label><select id="u_r" class="fin">${roles.map(r => opt(r, ROLES[r].l, u.role || 'asesora')).join('')}</select>
  <div class="rsmall" id="u_rd" style="margin:-4px 0 8px">${esc(ROLES[u.role || 'asesora'].d)}</div>
  <label class="lbl">Departamento</label><select id="u_d" class="fin">${Object.entries(DEPTS).map(([k, l]) => opt(k, l, u.dept || 'ventas')).join('')}</select>
  <label class="lbl">Dónde trabaja</label><select id="u_s" class="fin">${Object.values(S.stores).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map(s => opt(s.id, s.n + ' · ' + (s.city || ''), u.store || 'of')).join('')}</select>
  <label class="lbl">Horario</label><select id="u_h" class="fin">${hs.map(x => opt(x.id, `${x.n} · ${horLbl(x)}`, u.horario || suggestHor(u.store || 'of'))).join('')}</select>
  <label class="lbl">Día de descanso</label><select id="u_ds" class="fin">${opt(-1, 'Según su horario (sin día fijo)', u.descanso ?? -1)}${DIAS.map((d, i) => opt(i, d, u.descanso ?? -1)).join('')}</select>
  <label class="lbl">Días de medio día <span style="font-weight:400;color:#737373">(opcional)</span></label>
  <div class="daypick" id="u_md">${DIAS_C.map((d, i) => `<label><input type="checkbox" value="${i}" ${(u.medios || []).includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
  <div class="rsmall" style="margin:4px 0 6px">Marca los días en que solo trabaja medio turno.</div>
  <div style="display:flex;gap:8px"><div style="flex:1"><label class="lbl">Ese día trabaja</label><select id="u_mt" class="fin">${opt('am', 'En la mañana', u.medioT || 'am')}${opt('pm', 'En la tarde', u.medioT || 'am')}</select></div>
  <div style="flex:1"><label class="lbl">Hora de corte</label><input id="u_mh" class="fin" type="time" value="${esc(u.medioH || '')}" placeholder="13:00"></div></div>
  <div class="rsmall" style="margin:4px 0 8px">Mañana: sale a esa hora. Tarde: entra a esa hora. Si la dejas vacía se usa la mitad de su horario.</div>
  <label class="lbl">Cumpleaños <span style="font-weight:400;color:#737373">(opcional, para felicitarla)</span></label><input id="u_b" class="fin" type="date" value="${u.cumple ? '2000-' + u.cumple : ''}">
  ${isNew ? `<label class="lbl">PIN inicial (4 dígitos)</label><input id="u_pin" class="fin" inputmode="numeric" maxlength="4" value="${esc(sh.pin || '')}"><div class="rsmall" style="margin:-4px 0 8px">Dáselo en persona. Puede cambiarlo después desde su perfil.</div>` : ''}
  ${sh.err ? `<div class="err">${esc(sh.err)}</div>` : ''}
  <button class="wide" data-usave ${S.busy ? 'disabled' : ''}>${S.busy ? 'Guardando…' : isNew ? 'Crear usuario' : 'Guardar cambios'}</button>
  ${!isNew ? `<button class="wide ghost" data-upin>Restablecer PIN</button>${sh.newpin ? `<div class="note" style="text-align:center">Nuevo PIN de ${esc(first(u.n))}: <b style="font-size:20px;letter-spacing:4px">${sh.newpin}</b></div>` : ''}
  ${sh.id !== S.me.id ? `<button class="wide ghost" data-uactive style="color:${u.active === false ? 'var(--ok)' : 'var(--warn)'}">${u.active === false ? 'Reactivar usuario' : 'Desactivar usuario'}</button>` : ''}` : ''}
  <button class="wide ghost" data-close>Cancelar</button>`);
}
const suggestHor = store => { const s = S.stores[store]; if (!s) return Object.keys(S.horarios)[0]; if (store === 'of' || store === 'ol') return S.horarios['h-oficina'] ? 'h-oficina' : Object.keys(S.horarios)[0]; return s.mall ? (S.horarios['h-centro'] ? 'h-centro' : Object.keys(S.horarios)[0]) : (S.horarios['h-mercado'] ? 'h-mercado' : Object.keys(S.horarios)[0]); };
function horSheet(sh) {
  const x = sh.h || { n: '', ini: '08:00', fin: '17:00', lunch: 0, dias: [1, 2, 3, 4, 5, 6], tol: 5 };
  return sheetWrap(`<h4>${sh.id ? 'Editar horario' : 'Nuevo horario'}</h4><div class="sub">Plantilla que se asigna a las personas</div>
  <label class="lbl">Nombre</label><input id="h_n" class="fin" value="${esc(x.n)}" placeholder="Ej.: Centro comercial">
  <label class="chk"><input type="checkbox" id="h_flex" ${x.flex ? 'checked' : ''}> Horario flexible</label>
  <div class="rsmall" style="margin:-4px 0 8px">Para quien trabaja días variados, sale a hora variable y se le paga por su avance: sin hora de salida ni horas extra.</div>
  ${x.flex ? `<label class="chk"><input type="checkbox" id="h_fi" ${x.flexIni !== false ? 'checked' : ''}> Tiene hora fija de entrada</label>
  <div ${x.flexIni !== false ? '' : 'hidden'} style="display:flex;gap:8px"><div style="flex:1"><label class="lbl">Entrada</label><input id="h_fii" class="fin" type="time" value="${x.ini}"></div><div style="flex:1"><label class="lbl">Tolerancia (min)</label><input id="h_fit" class="fin" type="number" min="0" value="${x.tol ?? 5}"></div></div>
  <div class="rsmall" style="margin:4px 0 10px">Se cuentan tardanzas a esa hora. La salida es libre y no hay horas extra.</div>` : ''}
  <div ${x.flex ? 'hidden' : ''}>
  <div style="display:flex;gap:8px"><div style="flex:1"><label class="lbl">Entrada</label><input id="h_i" class="fin" type="time" value="${x.ini}"></div><div style="flex:1"><label class="lbl">Salida</label><input id="h_f" class="fin" type="time" value="${x.fin}"></div></div>
  <label class="lbl">Días que se trabaja</label><div class="daypick">${DIAS_C.map((d, i) => `<label><input type="checkbox" value="${i}" ${x.dias.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
  <div class="rsmall" style="margin:4px 0 10px">El día de descanso de cada persona se resta de estos días.</div>
  <div style="display:flex;gap:8px"><div style="flex:1"><label class="lbl">Almuerzo (min)</label><input id="h_l" class="fin" type="number" min="0" step="5" value="${x.lunch}"></div><div style="flex:1"><label class="lbl">Tolerancia (min)</label><input id="h_t" class="fin" type="number" min="0" value="${x.tol ?? 5}"></div></div>
  <div class="rsmall" style="margin:-2px 0 10px">Almuerzo en 0 = no marcan almuerzo.</div></div>
  ${sh.err ? `<div class="err">${esc(sh.err)}</div>` : ''}<button class="wide" data-hsave ${S.busy ? 'disabled' : ''}>Guardar</button><button class="wide ghost" data-close>Cancelar</button>`);
}
function storeSheet(sh) {
  const s = sh.s || { n: '', city: '', mall: false, radius: 150 };
  return sheetWrap(`<h4>${sh.id ? esc(s.n) : 'Nueva tienda'}</h4><div class="sub">${sh.id ? esc(s.city || '') : 'Agrega una tienda'}</div>
  <label class="lbl">Nombre</label><input id="s_n" class="fin" value="${esc(s.n)}"><label class="lbl">Ciudad / lugar</label><input id="s_c" class="fin" value="${esc(s.city || '')}">
  <label class="chk"><input type="checkbox" id="s_m" ${s.mall ? 'checked' : ''}> Es tienda de centro comercial</label>
  <label class="lbl">Ubicación</label><div class="note" style="margin-top:0">${s.lat ? `📍 ${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}` : 'Sin ubicación guardada.'}</div>
  <div style="display:flex;gap:8px"><button class="wide ghost" data-smap style="margin:0;flex:1">🗺️ Elegir en el mapa</button><button class="wide ghost" data-sgeo style="margin:0;flex:1" ${S.busy ? 'disabled' : ''}>${ico('pin')} Estoy aquí</button></div>
  <label class="lbl">O pega coordenadas / enlace de Google Maps</label><div style="display:flex;gap:8px"><input id="s_ll" class="fin" style="flex:1;margin:0" placeholder="14.8347, -91.5181"><button class="wide ghost" data-sll style="margin:0;width:auto;padding:0 14px">Usar</button></div>
  <div class="rsmall" style="margin:4px 0 8px">En Google Maps mantén presionado el punto de la tienda y copia los números que aparecen arriba.</div>
  <label class="lbl">Radio permitido para marcar (metros)</label><input id="s_r" class="fin" type="number" min="30" step="10" value="${s.radius || 150}">
  ${sh.err ? `<div class="err">${esc(sh.err)}</div>` : ''}<button class="wide" data-ssave ${S.busy ? 'disabled' : ''}>Guardar</button><button class="wide ghost" data-close>Cancelar</button>`);
}
function cambioSheet(sh) {
  const forOther = sh.other, today = nowParts().day;
  const who = forOther ? (sh.sid ? S.staff[sh.sid] : null) : S.me;
  const days = []; for (let i = 0; i < 21; i++) days.push(addDays(today, i));
  const pool = forOther ? Object.values(S.staff).filter(p => p.active !== false && (isAdmin() || p.dept === S.me.dept)) : [];
  let restOpts = '', workOpts = '';
  if (who) {
    const hor = S.horarios[who.horario];
    restOpts = days.filter(d => worksOn(who, hor, d, S.cambios)).map(d => opt(d, niceDate(d), sh.rest)).join('');
    workOpts = days.filter(d => !worksOn(who, hor, d, S.cambios)).map(d => opt(d, niceDate(d) + (who.descanso >= 0 && new Date(d + 'T12:00:00').getDay() === Number(who.descanso) ? ' · su descanso' : ''), sh.work)).join('');
  }
  return sheetWrap(`<h4>Mover día de descanso</h4><div class="sub">En vez de perder el día, se cambia por otro</div>
  ${forOther ? `<label class="lbl">Persona</label><select id="c_sid" class="fin">${opt('', 'Elige a la persona', sh.sid || '')}${pool.map(p => opt(p.id, p.n + ' · ' + storeN(p.store), sh.sid)).join('')}</select>` : ''}
  ${who ? `<label class="lbl">Día que ${forOther ? 'descansará' : 'necesitas descansar'}</label><select id="c_rest" class="fin">${restOpts}</select>
  <label class="lbl">Día que ${forOther ? 'trabajará' : 'trabajarás'} a cambio</label><select id="c_work" class="fin">${workOpts || opt('', 'No hay días de descanso próximos', '')}</select>
  <label class="lbl">Motivo</label><input id="c_mot" class="fin" value="${esc(sh.mot || '')}" placeholder="Ej.: trámite personal">` : ''}
  ${sh.err ? `<div class="err">${esc(sh.err)}</div>` : ''}<button class="wide" data-csave ${S.busy || !who ? 'disabled' : ''}>${forOther ? 'Guardar y aprobar' : 'Enviar solicitud'}</button><button class="wide ghost" data-close>Cancelar</button>`);
}
function permisoSheet(sh) {
  const forOther = sh.other, today = nowParts().day;
  const who = forOther ? (sh.sid ? S.staff[sh.sid] : null) : S.me;
  const pool = forOther ? Object.values(S.staff).filter(p => p.active !== false && (isAdmin() || p.dept === S.me.dept)) : [];
  let dayOpts = '';
  if (who) { const hor = S.horarios[who.horario]; for (let i = 0; i < 31; i++) { const d = addDays(today, i); if (worksOn(who, hor, d, S.cambios)) dayOpts += opt(d, niceDate(d) + (i === 0 ? ' · hoy' : ''), sh.day); } }
  const dur = sh.medio || '';
  return sheetWrap(`<h4>📝 ${forOther ? 'Dar permiso' : 'Pedir permiso'}</h4><div class="sub">El tiempo del permiso se descuenta del pago</div>
  ${forOther ? `<label class="lbl">Persona</label><select id="p_sid" class="fin">${opt('', 'Elige a la persona', sh.sid || '')}${pool.map(p => opt(p.id, p.n + ' · ' + storeN(p.store), sh.sid)).join('')}</select>` : ''}
  ${who ? `<label class="lbl">Día del permiso</label><select id="p_day" class="fin">${dayOpts || opt('', 'No hay días de trabajo próximos', '')}</select>
  <label class="lbl">¿Cuánto tiempo?</label><div class="ideas" style="margin-bottom:6px">${[['', 'Día completo'], ['am', 'Medio día · mañana'], ['pm', 'Medio día · tarde']].map(([k, l]) => `<button data-pdur="${k}" class="${dur === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  <div class="rsmall" style="margin:0 0 6px">${dur === 'am' ? 'Falta en la mañana y entra a trabajar a mediodía.' : dur === 'pm' ? 'Trabaja la mañana y se retira a mediodía.' : 'No se presenta ese día.'}</div>
  <label class="lbl">Motivo</label><input id="p_mot" class="fin" value="${esc(sh.mot || '')}" placeholder="Ej.: cita médica, trámite personal">` : ''}
  ${sh.err ? `<div class="err">${esc(sh.err)}</div>` : ''}<button class="wide" data-psave ${S.busy || !who ? 'disabled' : ''}>${forOther ? 'Guardar y aprobar' : 'Enviar solicitud'}</button><button class="wide ghost" data-close>Cancelar</button>`);
}
async function savePermiso() {
  const sh = S.sheet, sid = sh.other ? $('#p_sid').value : S.me.id, day = $('#p_day') && $('#p_day').value, mot = (($('#p_mot') || {}).value || '').trim();
  Object.assign(sh, { sid, day, mot });
  if (!sid || !day) { sh.err = 'Elige el día del permiso'; return render(); }
  if (mot.length < 3) { sh.err = 'Escribe el motivo'; return render(); }
  const p = S.staff[sid]; S.busy = true; render();
  try {
    const auto = sh.other && (isAdmin() || (role() === 'jefe' && p.dept === S.me.dept));
    await addDoc(C('cambios'), { tipo: 'permiso', sid, dept: p.dept, store: p.store, rest: day, work: null, medio: sh.medio || null, descuento: true, mot, estado: auto ? 'aprobado' : 'pendiente', by: S.me.id, at: serverTimestamp(), ...(auto ? { decidedBy: S.me.id } : {}) });
    S.busy = false; S.sheet = null; render(); toast(auto ? 'Permiso registrado' : 'Permiso enviado a tu jefe');
  } catch (e) { console.error(e); S.busy = false; sh.err = e.code || e.message; render(); }
}

/* ================== RENDER ================== */
function render() {
  const root = $('#app');
  if (S.phase === 'boot' || S.phase === 'loading') { root.innerHTML = loadView(); return; }
  if (S.phase === 'error') { root.innerHTML = `<div class="body" style="padding:40px 20px;text-align:center"><img src="rosita.svg" style="width:80px"><p>${esc(S.err)}</p><button class="wide" onclick="location.reload()">Reintentar</button></div>`; return; }
  if (S.phase === 'setup') { root.innerHTML = viewSetup() + sheetHtml(); return; }
  if (S.phase === 'login') { root.innerHTML = viewLogin() + sheetHtml(); if (S.q) filterWho(); return; }
  const t = S.tab, gt = gestionTabs().length;
  const title = { inicio: '', marcar: 'Marcar', equipo: gt ? 'Gestión' : 'Mi tienda', perfil: 'Perfil' }[t];
  const pend = S.cambios.filter(c => c.estado === 'pendiente' && canDecide(c)).length;
  const body = { inicio: viewInicio, marcar: viewMarcar, equipo: viewGestion, perfil: viewPerfil }[t]();
  // Conserva la posición de la pantalla en cada actualización (reacciones, datos en vivo, reloj); solo vuelve arriba al cambiar de pestaña
  const sc = $('.sbody') ? $('.sbody').scrollTop : 0, keep = S._keepScroll || S._lastTab === t; S._keepScroll = false; S._lastTab = t;
  root.innerHTML = `<div class="topbar">${t === 'inicio' ? `<div class="wordmark"><span class="rlmark"></span><span>rosita</span></div>` : `<div class="ttl">${title}</div>`}<div class="sp"></div>${pend ? `<button class="tbi" data-tab="equipo">${ico('heart')}<i>${pend}</i></button>` : ''}</div>
  <div class="body sbody">${body}</div>
  <nav class="bnav"><button data-tab="inicio" class="${t === 'inicio' ? 'on' : ''}">${ico('home')}</button><button data-tab="equipo" class="${t === 'equipo' ? 'on' : ''}">${ico('users')}${pend ? `<i>${pend}</i>` : ''}</button>
  ${isSup() ? `<button data-crear class="mark">${ico('plus')}</button>` : `<button data-tab="marcar" class="mark ${['trabajando', 'extra'].includes(myState()) ? 'working' : ''}">${ico(myState() === 'fuera' ? 'in' : myState() === 'salio' ? 'check' : 'clock')}</button>`}
  <button data-tab="perfil" class="pfnav ${t === 'perfil' ? 'on' : ''}">${av(S.me)}</button></nav>` + sheetHtml();
  if (keep && $('.sbody')) $('.sbody').scrollTop = sc;
}

/* ================== ACCIONES ================== */
async function doSetup() {
  const n = $('#su_n').value.trim(), c = $('#su_c').value.trim(), p = $('#su_p').value.trim(), pin = $('#su_pin').value, pin2 = $('#su_pin2').value;
  S.form = { n, c, p };
  if (!n || !c) { S.err = 'Escribe tu nombre'; return render(); }
  if (!/^\d{4}$/.test(pin)) { S.err = 'El PIN debe tener 4 números'; return render(); }
  if (pin !== pin2) { S.err = 'Los PIN no coinciden'; return render(); }
  S.err = null; S.busy = true; render();
  try {
    const sid = 'gerencia-' + slug(c), email = `${sid}-1@${LOGIN_DOMAIN}`;
    const cred = await createUserWithEmailAndPassword(auth, email, pw(pin));
    const uid = cred.user.uid, b = writeBatch(db);
    b.set(D('uids', uid), { sid, role: 'admin', dept: 'gerencia', store: 'of' });
    b.set(D('staff', sid), { n, short: c, puesto: p, role: 'admin', dept: 'gerencia', store: 'of', horario: 'h-oficina', descanso: 0, active: true, authUid: uid, loginEmail: email, loginN: 1, createdAt: serverTimestamp() });
    b.set(D('directory', sid), { n: c, puesto: p, role: 'admin', store: 'of', active: true, loginEmail: email });
    STORES_SEED.forEach(({ id, ...s }) => b.set(D('stores', id), { ...s, radius: 150 }));
    HORARIOS_SEED.forEach(({ id, ...h }) => b.set(D('horarios', id), h));
    b.set(D('meta', 'setup'), { at: serverTimestamp(), by: sid });
    await b.commit();
    S.setup = { by: sid }; await loadPublic(); S.busy = false;
    S.uid = uid; await enter(sid);
    toast('¡Listo! Ahora crea al personal en Gestión → Personas');
  } catch (e) { console.error(e); S.busy = false; S.err = 'No se pudo crear: ' + (e.code || e.message); render(); }
}
async function tryPin() {
  const sel = S.dir.find(x => x.id === S.pick);
  try { await signInWithEmailAndPassword(auth, sel.loginEmail, pw(S.pinbuf)); S.pinbuf = ''; S.pick = null; S.err = null; }
  catch (e) { S.err = e.code === 'auth/too-many-requests' ? 'Demasiados intentos. Espera unos minutos.' : 'PIN incorrecto'; S.pinbuf = ''; render(); const d = $('#dots'); d && d.classList.add('shake'); }
}
async function doMark(type, ok) {
  const u = S.me, np = nowParts(), hor = horDe(u, np.day), st = S.stores[u.store] || {};
  const free = ['jefe', 'admin', 'fundador', 'apoyo', 'sistemas'].includes(u.role) || XT.includes(type);
  if (type === 'salida' && hor && hor.flex && !ok) { S.sheet = { kind: 'avance' }; render(); setTimeout(() => { const i = $('#av_tx'); i && i.focus(); }, 50); return; }
  if (type === 'entrada' && !ok && hor && !hor.flex && (np.min >= toMin(hor.fin) || np.min < toMin(hor.ini) - 60)) { S.sheet = { kind: 'xtra', hor }; render(); return; }
  S.busy = true; render();
  const g = await geo();
  let gps = { ok: g.ok };
  if (g.ok) { gps = { ok: true, lat: g.lat, lng: g.lng, acc: g.acc }; if (st.lat) { gps.dist = dist(g, st); gps.inside = gps.dist <= (st.radius || 150) + Math.min(g.acc || 0, 100); } }
  if (!free && gps.inside === false) { S.busy = false; render(); toast(`Estás a ${gps.dist >= 1000 ? (gps.dist / 1000).toFixed(1) + ' km' : gps.dist + ' m'} de ${st.n}. Acércate para marcar.`); return; }
  const late = type === 'entrada' && fixedIn(hor) ? Math.max(0, np.min - toMin(hor.ini) - (hor.tol || 5)) : 0;
  const lateReal = late > 0 ? np.min - toMin(hor.ini) : 0, avance = type === 'salida' && typeof ok === 'string' ? ok.trim().slice(0, 300) : '';
  try {
    const b = writeBatch(db);
    const xo = type === 'extrafin' ? openExtra([...(S.myMarksY || []), ...S.myMarks]) : null, xmin = xo ? (xo.day === np.day ? 0 : 1440) + np.min - xo.min : 0;
    b.set(doc(C('marks')), { sid: u.id, type, day: np.day, hm: np.hm, min: np.min, at: serverTimestamp(), store: u.store, gps, late: lateReal, ...(avance ? { avance } : {}), ...(xo ? { desde: xo.day + ' ' + xo.hm, extraMin: xmin } : {}) });
    const upd = {};
    if (type === 'entrada') upd.arr = { [u.id]: { t: np.hm, st: u.store, late: lateReal, far: gps.inside === false } };
    if (type === 'salida') upd.out = { [u.id]: np.hm };
    if (type === 'almuerzo') upd.lunch = { [u.id]: { o: np.hm } };
    if (type === 'regreso') upd.lunch = { [u.id]: { o: (S.myMarks.filter(x => x.type === 'almuerzo').pop() || {}).hm || '', r: np.hm } };
    if (Object.keys(upd).length) b.set(D('days', np.day), upd, { merge: true });
    await b.commit();
    S.busy = false; if (type === 'entrada' || type === 'salida') S.tab = 'inicio'; render();
    if (type === 'entrada') setTimeout(() => { RK = null; const m = myRacha(); if (m && m.cur > 0 && !lateReal) toast(`🔥 ¡${m.cur} ${m.cur === 1 ? 'día' : 'días'} de racha!`); checkBadges(); }, 2600);
    toast({ extra: `Horas extra desde las ${np.hm} 🌙`, extrafin: `Horas extra terminadas · ${hmin(xmin)}`, entrada: `Entrada registrada ${np.hm}${!g.ok ? ' · sin ubicación' : ''}`, almuerzo: 'Buen provecho 🍽️', regreso: 'Regreso registrado', salida: `Salida registrada ${np.hm} · ¡gracias!` }[type]);
  } catch (e) { console.error(e); S.busy = false; render(); toast('No se pudo registrar. Revisa tu internet.'); }
}
function readUserForm() {
  const v = id => $('#' + id) ? $('#' + id).value : '';
  const b = v('u_b');
  const medios = [...document.querySelectorAll('#u_md input:checked')].map(x => +x.value).sort();
  return { n: v('u_n').trim(), puesto: v('u_p').trim(), role: v('u_r'), dept: v('u_d'), store: v('u_s'), horario: v('u_h'), descanso: Number(v('u_ds')), cumple: b ? b.slice(5) : null, pin: v('u_pin'), medios, medioT: v('u_mt') || 'am', medioH: v('u_mh') || null };
}
async function createAuthUser(email, pin) {
  const sec = initializeApp(firebaseConfig, 'creator-' + Date.now()), a2 = getAuth(sec);
  if (EMU) connectAuthEmulator(a2, 'http://127.0.0.1:9099', { disableWarnings: true });
  try { const c = await createUserWithEmailAndPassword(a2, email, pw(pin)); const uid = c.user.uid; await signOut(a2); return uid; }
  finally { await deleteApp(sec); }
}
async function saveUser() {
  const sh = S.sheet, f = readUserForm();
  sh.u = { ...(sh.u || {}), ...f };
  if (f.n.length < 3) { sh.err = 'Escribe el nombre completo'; return render(); }
  if (!sh.id && !/^\d{4}$/.test(f.pin)) { sh.err = 'El PIN debe tener 4 números'; return render(); }
  S.busy = true; sh.err = null; render();
  try {
    const data = { n: f.n, puesto: f.puesto || ROLES[f.role].l, role: f.role, dept: f.dept, store: f.store, horario: f.horario, descanso: f.descanso, cumple: f.cumple, medios: f.medios, medioT: f.medioT, medioH: f.medioH };
    const hh = S.horarios[f.horario];
    if (f.medioH && hh && (toMin(f.medioH) <= toMin(hh.ini) || toMin(f.medioH) >= toMin(hh.fin))) { S.busy = false; sh.err = `La hora de corte debe estar entre ${hh.ini} y ${hh.fin}`; return render(); }
    if (!sh.id) {
      let sid = slug(f.n) || 'persona'; if (S.staff[sid]) sid += '-' + Math.random().toString(36).slice(2, 5);
      const email = `${sid}-1@${LOGIN_DOMAIN}`, uid = await createAuthUser(email, f.pin), b = writeBatch(db);
      b.set(D('staff', sid), { ...data, active: true, authUid: uid, loginEmail: email, loginN: 1, createdAt: serverTimestamp(), createdBy: S.me.id });
      b.set(D('uids', uid), { sid, role: f.role, dept: f.dept, store: f.store });
      b.set(D('directory', sid), { n: f.n, puesto: data.puesto, role: f.role, store: f.store, active: true, loginEmail: email });
      await b.commit();
      S.staff[sid] = { id: sid, ...data, active: true, authUid: uid, loginEmail: email, loginN: 1 };
      S.dir.push({ id: sid, n: f.n, puesto: data.puesto, role: f.role, store: f.store, active: true, loginEmail: email });
      S.busy = false; S.sheet = null; render(); toast(`Usuario de ${first(f.n)} creado · PIN ${f.pin}`);
    } else {
      const cur = S.staff[sh.id], b = writeBatch(db);
      b.update(D('staff', sh.id), data);
      b.set(D('directory', sh.id), { n: f.n, puesto: data.puesto, role: f.role, store: f.store }, { merge: true });
      if (cur.active !== false) b.set(D('uids', cur.authUid), { sid: sh.id, role: f.role, dept: f.dept, store: f.store });
      await b.commit();
      Object.assign(S.staff[sh.id], data); const d = S.dir.find(x => x.id === sh.id); if (d) Object.assign(d, { n: f.n, puesto: data.puesto, role: f.role, store: f.store });
      if (sh.id === S.me.id) Object.assign(S.me, data);
      S.busy = false; S.sheet = null; render(); toast('Cambios guardados');
    }
  } catch (e) { console.error(e); S.busy = false; sh.err = 'No se pudo guardar: ' + (e.code || e.message); render(); }
}
async function resetPin() {
  const sh = S.sheet, cur = S.staff[sh.id], pin = String(Math.floor(1000 + Math.random() * 9000));
  S.busy = true; render();
  try {
    const n = (cur.loginN || 1) + 1, email = `${sh.id}-${n}@${LOGIN_DOMAIN}`, uid = await createAuthUser(email, pin), b = writeBatch(db);
    b.update(D('staff', sh.id), { authUid: uid, loginEmail: email, loginN: n });
    b.set(D('directory', sh.id), { loginEmail: email }, { merge: true });
    b.set(D('uids', uid), { sid: sh.id, role: cur.role, dept: cur.dept, store: cur.store });
    if (cur.authUid) b.delete(D('uids', cur.authUid));
    await b.commit();
    Object.assign(cur, { authUid: uid, loginEmail: email, loginN: n }); const d = S.dir.find(x => x.id === sh.id); if (d) d.loginEmail = email;
    S.busy = false; sh.newpin = pin; render();
  } catch (e) { console.error(e); S.busy = false; sh.err = 'No se pudo restablecer: ' + (e.code || e.message); render(); }
}
async function toggleActive() {
  const sh = S.sheet, cur = S.staff[sh.id], on = cur.active === false;
  S.busy = true; render();
  try {
    const b = writeBatch(db);
    b.update(D('staff', sh.id), { active: on });
    b.set(D('directory', sh.id), { active: on }, { merge: true });
    if (on) b.set(D('uids', cur.authUid), { sid: sh.id, role: cur.role, dept: cur.dept, store: cur.store }); else b.delete(D('uids', cur.authUid));
    await b.commit(); cur.active = on; const d = S.dir.find(x => x.id === sh.id); if (d) d.active = on;
    S.busy = false; S.sheet = null; render(); toast(on ? 'Usuario reactivado' : 'Usuario desactivado · ya no puede entrar');
  } catch (e) { console.error(e); S.busy = false; sh.err = e.code || e.message; render(); }
}
async function saveHor() {
  const sh = S.sheet, dias = [...document.querySelectorAll('.daypick input:checked')].map(x => +x.value).sort();
  const flex = $('#h_flex').checked, flexIni = flex && !!($('#h_fi') && $('#h_fi').checked);
  const h = { n: $('#h_n').value.trim(), ini: flexIni ? $('#h_fii').value : $('#h_i').value, fin: flex ? '23:59' : $('#h_f').value, lunch: flex ? 0 : Math.max(0, +$('#h_l').value || 0), tol: Math.max(0, +(flexIni ? $('#h_fit').value : $('#h_t').value) || 0), dias: flex ? [0, 1, 2, 3, 4, 5, 6] : dias, flex, flexIni };
  sh.h = h;
  if (!h.n) { sh.err = 'Ponle un nombre'; return render(); } if (flex) { } else if (!dias.length) { sh.err = 'Elige al menos un día'; return render(); } if (toMin(h.fin) <= toMin(h.ini)) { sh.err = 'La salida debe ser después de la entrada'; return render(); }
  S.busy = true; render();
  try { const id = sh.id || 'h-' + slug(h.n) + '-' + Math.random().toString(36).slice(2, 4); await setDoc(D('horarios', id), h); S.horarios[id] = { id, ...h }; S.busy = false; S.sheet = null; render(); toast('Horario guardado'); }
  catch (e) { console.error(e); S.busy = false; sh.err = e.code || e.message; render(); }
}
async function saveStore() {
  const sh = S.sheet, s = { ...(sh.s || {}), n: $('#s_n').value.trim(), city: $('#s_c').value.trim(), mall: $('#s_m').checked, radius: Math.max(30, +$('#s_r').value || 150) };
  sh.s = s; if (!s.n) { sh.err = 'Ponle un nombre'; return render(); }
  S.busy = true; render();
  try { const id = sh.id || slug(s.n); const { id: _x, ...rest } = s; if (rest.order == null) rest.order = Object.keys(S.stores).length; await setDoc(D('stores', id), rest); S.stores[id] = { id, ...rest }; S.busy = false; S.sheet = null; render(); toast('Tienda guardada'); }
  catch (e) { console.error(e); S.busy = false; sh.err = e.code || e.message; render(); }
}
async function saveCambio() {
  const sh = S.sheet, other = sh.other, sid = other ? $('#c_sid').value : S.me.id, rest = $('#c_rest') && $('#c_rest').value, work = $('#c_work') && $('#c_work').value, mot = ($('#c_mot') || {}).value || '';
  Object.assign(sh, { sid, rest, work, mot });
  if (!sid || !rest || !work) { sh.err = 'Elige los dos días'; return render(); }
  const p = S.staff[sid]; S.busy = true; render();
  try {
    const auto = other && (isAdmin() || (role() === 'jefe' && p.dept === S.me.dept));
    await addDoc(C('cambios'), { sid, dept: p.dept, store: p.store, rest, work, mot: mot.trim(), estado: auto ? 'aprobado' : 'pendiente', by: S.me.id, at: serverTimestamp(), ...(auto ? { decidedBy: S.me.id } : {}) });
    S.busy = false; S.sheet = null; render(); toast(auto ? 'Descanso movido' : 'Solicitud enviada a tu jefe');
  } catch (e) { console.error(e); S.busy = false; sh.err = e.code || e.message; render(); }
}

/* ================== EVENTOS ================== */
document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-bgclose],.rcard'); if (!t) return;
  if (t.hasAttribute('data-bgclose') && e.target !== t) return;
  const d = t.dataset;
  if (d.bgclose !== undefined || d.close !== undefined) { S.sheet = null; S._keepScroll = true; render(); return; }
  if (d.about !== undefined) { S.sheet = { kind: 'about' }; render(); return; }
  if (d.setup !== undefined) return doSetup();
  if (d.zone) { S.zone = d.zone; S.q = ''; render(); return; }
  if (d.pick) { S.pick = d.pick; S.pinbuf = ''; S.err = null; render(); return; }
  if (d.notme !== undefined) { S.pick = null; S.pinbuf = ''; S.err = null; render(); return; }
  if (d.k !== undefined) {
    if (d.k === '✕') { S.pick = null; S.pinbuf = ''; S.err = null; render(); return; }
    if (d.k === '←') { S.pinbuf = S.pinbuf.slice(0, -1); render(); return; }
    if (S.pinbuf.length < 4) S.pinbuf += d.k; S.err = null; render();
    if (S.pinbuf.length === 4) tryPin();
    return;
  }
  if (d.tab) { S.tab = d.tab; S.sheet = null; render(); $('.sbody') && ($('.sbody').scrollTop = 0); return; }
  if (d.sub) { S.sub = d.sub; render(); return; }
  if (d.scope) { S.scope = d.scope; render(); return; }
  if (d.mark) return doMark(d.mark);
  if (d.avok !== undefined) { const v = ($('#av_tx') || {}).value || ''; S.sheet = null; return doMark('salida', v.trim() || ' '); }
  if (d.xyes !== undefined) { S.sheet = null; return doMark('extra'); }
  if (d.xno !== undefined) { S.sheet = null; return doMark('entrada', true); }
  if (d.logout !== undefined) { stopListeners(); await signOut(auth); S.tab = 'inicio'; return; }
  if (d.pinchg !== undefined) { S.sheet = { kind: 'pin' }; render(); return; }
  if (d.pinsave !== undefined) {
    const o = $('#p_old').value, n = $('#p_new').value, n2 = $('#p_new2').value;
    if (!/^\d{4}$/.test(n)) { S.sheet.err = 'El PIN nuevo debe tener 4 números'; return render(); } if (n !== n2) { S.sheet.err = 'Los PIN nuevos no coinciden'; return render(); }
    S.busy = true; render();
    try { const u = auth.currentUser; await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, pw(o))); await updatePassword(u, pw(n)); S.busy = false; S.sheet = null; render(); toast('PIN actualizado'); }
    catch (er) { S.busy = false; S.sheet.err = 'Tu PIN actual no es correcto'; render(); }
    return;
  }
  // gestión
  if (d.unew !== undefined) { S.sheet = { kind: 'user', u: { role: 'asesora', dept: 'ventas', store: S.me.store === 'of' ? 'ut' : S.me.store, descanso: -1 }, pin: String(Math.floor(1000 + Math.random() * 9000)) }; S.sheet.u.horario = suggestHor(S.sheet.u.store); render(); return; }
  if (d.uedit) { S.sheet = { kind: 'user', id: d.uedit, u: { ...S.staff[d.uedit] } }; render(); return; }
  if (d.usave !== undefined) return saveUser();
  if (d.upin !== undefined) return resetPin();
  if (d.uactive !== undefined) return toggleActive();
  if (d.hnew !== undefined) { S.sheet = { kind: 'hor' }; render(); return; }
  if (d.hedit) { S.sheet = { kind: 'hor', id: d.hedit, h: { ...S.horarios[d.hedit] } }; render(); return; }
  if (d.hsave !== undefined) return saveHor();
  if (d.snew !== undefined) { S.sheet = { kind: 'store' }; render(); return; }
  if (d.sedit) { S.sheet = { kind: 'store', id: d.sedit, s: { ...S.stores[d.sedit] } }; render(); return; }
  if (d.ssave !== undefined) return saveStore();
  if (d.smap !== undefined || d.sll !== undefined) {
    const sh = S.sheet; sh.s = { ...(sh.s || {}), n: $('#s_n').value, city: $('#s_c').value, mall: $('#s_m').checked, radius: +$('#s_r').value || 150 };
    if (d.sll !== undefined) { const ll = parseLL($('#s_ll').value); if (!ll) { sh.err = 'No reconozco esas coordenadas. Ej.: 14.8347, -91.5181'; return render(); } sh.s.lat = ll.lat; sh.s.lng = ll.lng; sh.err = null; render(); toast('Ubicación puesta. Toca Guardar.'); return; }
    S.sheet = { kind: 'mapa', back: sh, lat: sh.s.lat, lng: sh.s.lng }; render(); openMap().catch(() => toast('No se pudo cargar el mapa. Revisa tu internet.')); return;
  }
  if (d.mok !== undefined) { if (!S.sheet.lat) return toast('Toca el mapa para poner el pin'); return closeMap(true); }
  if (d.mcancel !== undefined) return closeMap(false);
  if (d.mq !== undefined) {
    const q = $('#m_q').value.trim(); if (!q) return; const ll = parseLL(q); if (ll) return S.sheet.setLL && S.sheet.setLL(ll);
    try { const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gt&q=' + encodeURIComponent(q)); const j = await r.json(); if (!j.length) return toast('No encontré ese lugar. Mueve el mapa a mano.'); S.sheet.setLL && S.sheet.setLL({ lat: +j[0].lat, lng: +j[0].lon }, 17); }
    catch (er) { toast('No se pudo buscar. Mueve el mapa a mano.'); } return;
  }
  if (d.sgeo !== undefined) {
    const sh = S.sheet; sh.s = { ...(sh.s || {}), n: $('#s_n').value, city: $('#s_c').value, mall: $('#s_m').checked, radius: +$('#s_r').value || 150 };
    S.busy = true; render(); const g = await geo(); S.busy = false;
    if (!g.ok) { sh.err = 'No se pudo leer tu ubicación. Activa el GPS y da permiso.'; return render(); }
    sh.s.lat = g.lat; sh.s.lng = g.lng; sh.err = null; render(); toast(`Ubicación tomada (precisión ${g.acc} m). Toca Guardar.`); return;
  }
  if (d.cnew !== undefined) { S.sheet = { kind: 'cambio' }; render(); return; }
  if (d.cnew2 !== undefined) { S.sheet = { kind: 'cambio', other: true }; render(); return; }
  if (d.csave !== undefined) return saveCambio();
  if (d.pnew !== undefined) { S.sheet = { kind: 'permiso' }; render(); return; }
  if (d.pnew2 !== undefined) { S.sheet = { kind: 'permiso', other: true }; render(); return; }
  if (d.pdur !== undefined) { const sh = S.sheet; if ($('#p_day')) sh.day = $('#p_day').value; if ($('#p_mot')) sh.mot = $('#p_mot').value; sh.medio = d.pdur || null; render(); return; }
  if (d.psave !== undefined) return savePermiso();
  if (d.cok || d.cno) { try { await updateDoc(D('cambios', d.cok || d.cno), { estado: d.cok ? 'aprobado' : 'rechazado', decidedBy: S.me.id }); toast(d.cok ? 'Aprobado' : 'Rechazado'); } catch (er) { toast('No se pudo guardar'); } return; }
  // muro
  if (d.crear !== undefined) { S.sheet = { kind: 'crear' }; render(); return; }
  if (d.crear2) { S.sheet = d.crear2 === 'anuncio' ? { kind: 'anuncio', aud: role() === 'encargada' ? S.me.store : 'all' } : d.crear2 === 'foto' ? { kind: 'foto', tag: FTAGS[0], store: S.me.store } : { kind: 'reco', cat: 'atencion' }; render(); return; }
  if (d.apub !== undefined) {
    const tx = $('#a_tx').value.trim(), aud = role() === 'encargada' ? S.me.store : $('#a_aud').value; S.sheet.tx = tx; S.sheet.aud = aud;
    if (tx.length < 4) { S.sheet.err = 'Escribe el anuncio'; return render(); }
    S.busy = true; render(); try { await addDoc(C('posts'), { kind: 'anuncio', by: S.me.id, tx, aud, at: serverTimestamp(), likedBy: {} }); S.busy = false; S.sheet = null; S.tab = 'inicio'; render(); toast('Anuncio publicado 📣'); } catch (er) { console.error(er); S.busy = false; S.sheet.err = 'No se pudo publicar'; render(); } return;
  }
  if (d.ftag) { readFoto(); S.sheet.tag = d.ftag; render(); if (d.ftag === 'otro') setTimeout(() => { const i = $('#f_tagx'); i && i.focus(); }, 50); return; }
  if (d.fpub !== undefined) {
    const sh = S.sheet; readFoto(); sh.cap = sh.cap.trim();
    if (!sh.img) { sh.err = 'Elige una foto'; return render(); }
    if (sh.store === 'fuera' && (sh.lugar || '').trim().length < 3) { sh.err = 'Escribe dónde fue la actividad'; return render(); }
    if (sh.tag === 'otro' && !(sh.tagx || '').trim()) { sh.err = 'Escribe la etiqueta'; return render(); }
    const tag = sh.tag === 'otro' ? '✏️ ' + sh.tagx.trim() : sh.tag;
    S.busy = true; render(); try { await addDoc(C('posts'), { kind: 'foto', by: S.me.id, img: sh.img, tag, tx: sh.cap, store: sh.store || S.me.store, ...(sh.store === 'fuera' ? { lugar: sh.lugar.trim() } : {}), at: serverTimestamp(), likedBy: {} }); S.busy = false; S.sheet = null; S.tab = 'inicio'; render(); toast('Foto compartida'); } catch (er) { console.error(er); S.busy = false; sh.err = 'No se pudo publicar'; render(); } return;
  }
  if (d.rpick) { S.sheet.tx = $('#r_tx').value; S.sheet.to = d.rpick; render(); return; }
  if (d.rcat) { S.sheet.tx = $('#r_tx').value; S.sheet.cat = d.rcat; render(); return; }
  if (d.rpub !== undefined) {
    const sh = S.sheet; sh.tx = $('#r_tx').value.trim();
    if (!sh.to) { sh.err = 'Elige a quién reconocer'; return render(); } if (sh.tx.length < 6) { sh.err = 'Cuenta en una frase qué hizo'; return render(); }
    S.busy = true; render(); try { await addDoc(C('posts'), { kind: 'reco', by: S.me.id, to: sh.to, cat: sh.cat, tx: sh.tx, at: serverTimestamp(), likedBy: {} }); S.busy = false; S.sheet = null; S.tab = 'inicio'; render(); toast(`👏 Reconociste a ${first(P(sh.to).n)}`); } catch (er) { console.error(er); S.busy = false; sh.err = 'No se pudo publicar'; render(); } return;
  }
  if (d.lmore) { S.ligaOpen = S.ligaOpen === d.lmore ? null : d.lmore; repaintPost(d.lmore); return; }
  if (d.rx) { const prev = S.rxOpen; S.rxOpen = prev === d.rx ? null : d.rx; if (prev && prev !== d.rx) repaintPost(prev); repaintPost(d.rx); return; }
  if (d.rxe) { const id = d.rxp, it = S.posts.find(x => x.id === id); if (!it) return;
    const cur = rxOf((it.likedBy || {})[S.me.id]), lb = { ...(it.likedBy || {}) }, off = cur === d.rxe;
    if (off) delete lb[S.me.id]; else lb[S.me.id] = d.rxe; it.likedBy = lb; S.rxOpen = null; repaintPost(id);
    try { await updateDoc(D('posts', id), { [`likedBy.${S.me.id}`]: off ? deleteField() : d.rxe }); } catch (er) { console.error(er); toast('No se pudo reaccionar. Revisa tu internet.'); }
    return; }
  if (d.like) { const it = S.posts.find(x => x.id === d.like), on = !(it.likedBy || {})[S.me.id]; const lb = { ...(it.likedBy || {}) }; if (on) lb[S.me.id] = true; else delete lb[S.me.id]; it.likedBy = lb; S._keepScroll = true; render(); try { await updateDoc(D('posts', d.like), { likedBy: lb }); } catch (er) { console.error(er); } return; }
  if (d.clap) { const it = S.posts.find(x => x.id === d.clap); it.claps = (it.claps || 0) + 1; S._keepScroll = true; render(); toast('👏 Aplaudiste'); try { await updateDoc(D('posts', d.clap), { claps: it.claps }); } catch (er) { } return; }
  if (d.pdel) { if (!confirmDel()) return; try { await deleteDoc(D('posts', d.pdel)); toast('Publicación borrada'); } catch (er) { toast('No se pudo borrar'); } return; }
  if (d.note) { S.sheet = d.note === S.me.id ? { kind: 'nota' } : ((S.notes[d.note] || {}).tx ? { kind: 'vernota', id: d.note } : null); render(); if (d.note === S.me.id) setTimeout(() => { const i = $('#n_tx'); i && i.focus(); }, 50); return; }
  if (d.nemo) { const i = $('#n_tx'); if (i.value.length + d.nemo.length <= 60) i.value = (i.value + ' ' + d.nemo).trim(); i.dispatchEvent(new Event('input', { bubbles: true })); return; }
  if (d.nsave !== undefined) { const v = $('#n_tx').value.trim(); if (!v) return toast('Escribe tu nota'); try { const same = (S.notes[S.me.id] || {}).tx === v.slice(0, 60); await setDoc(D('notes', S.me.id), { tx: v.slice(0, 60), at: Date.now(), ...(same ? {} : { rx: deleteField() }) }, { merge: true }); S.sheet = null; render(); toast('Nota compartida · dura 24 horas'); } catch (er) { toast('No se pudo guardar'); } return; }
  if (d.nrx) { const id = S.sheet && S.sheet.id, n = id && S.notes[id]; if (!n) return;
    const off = (n.rx || {})[S.me.id] === d.nrx, rx = { ...(n.rx || {}) }; if (off) delete rx[S.me.id]; else rx[S.me.id] = d.nrx; n.rx = rx; render();
    try { await updateDoc(D('notes', id), { [`rx.${S.me.id}`]: off ? deleteField() : d.nrx }); if (!off) toast(`Reaccionaste ${d.nrx} a la nota de ${first(dirP(id).n)}`); } catch (er) { console.error(er); toast('No se pudo reaccionar. Revisa tu internet.'); }
    return; }
  if (d.bio !== undefined) { S.sheet = { kind: 'bio' }; render(); setTimeout(() => { const i = $('#b_tx'); i && i.focus(); }, 50); return; }
  if (d.bsave !== undefined || d.bdel !== undefined) { const v = d.bdel !== undefined ? '' : $('#b_tx').value.trim().slice(0, 80);
    try { await setDoc(D('notes', S.me.id), { bio: v || deleteField() }, { merge: true }); S.notes[S.me.id] = { ...(S.notes[S.me.id] || {}), bio: v }; S.sheet = null; render(); toast(v ? 'Frase guardada ✨' : 'Frase quitada'); } catch (er) { console.error(er); toast('No se pudo guardar'); } return; }
  if (d.ndel !== undefined) { try { await setDoc(D('notes', S.me.id), { tx: deleteField(), at: deleteField(), rx: deleteField() }, { merge: true }); S.sheet = null; render(); } catch (er) { } return; }
  if (d.nhide !== undefined) { try { await deleteDoc(D('notes', S.sheet.id)); S.sheet = null; render(); toast('Nota ocultada'); } catch (er) { toast('No se pudo ocultar'); } return; }
  if (d.story) { const a = ((S.today || {}).arr || {})[d.story], p = P(d.story); toast(a ? `${first(p.n)} llegó a las ${a.t} ☀️` : `${first(p.n)} todavía no llega`); return; }
});
function repaintPost(id) {
  const el = document.querySelector(`article[data-post="${id}"]`), it = S.posts.find(x => x.id === id);
  if (el && it) el.outerHTML = postCard(it);
}
// Tocar fuera de la barra de reacciones la cierra
document.addEventListener('pointerdown', e => { if (S.rxOpen && !e.target.closest('.rxwrap')) { const id = S.rxOpen; S.rxOpen = null; repaintPost(id); } });
function readFoto() { const sh = S.sheet, v = id => $('#' + id) ? $('#' + id).value : undefined; if (v('f_cap') !== undefined) sh.cap = v('f_cap'); if (v('f_st') !== undefined) sh.store = v('f_st'); if (v('f_lugar') !== undefined) sh.lugar = v('f_lugar'); if (v('f_tagx') !== undefined) sh.tagx = v('f_tagx'); }
// Lee coordenadas escritas o un enlace largo de Google Maps
function parseLL(t) {
  t = decodeURIComponent(t || '');
  const pats = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /[?&](?:q|ll|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/];
  for (const r of pats) { const m = t.match(r); if (m) { const lat = +m[1], lng = +m[2]; if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }; } }
  return null;
}
let leafletP = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletP) leafletP = new Promise((res, rej) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'leaflet/leaflet.css'; document.head.appendChild(l); const sc = document.createElement('script'); sc.src = 'leaflet/leaflet.js'; sc.onload = () => res(window.L); sc.onerror = rej; document.head.appendChild(sc); });
  return leafletP;
}
let MAP = null;
async function openMap() {
  const sh = S.sheet, L = await loadLeaflet(); if (!$('#map')) return;
  const c = sh.lat ? [sh.lat, sh.lng] : [14.8347, -91.5181];
  MAP = L.map('map', { zoomControl: true }).setView(c, sh.lat ? 18 : 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(MAP);
  L.Icon.Default.imagePath = 'leaflet/images/';
  const mk = L.marker(c, { draggable: true }).addTo(MAP), circ = L.circle(c, { radius: sh.back.s.radius || 150, color: '#f400a1', weight: 1, fillOpacity: .12 }).addTo(MAP);
  const set = ll => { sh.lat = ll.lat; sh.lng = ll.lng; mk.setLatLng(ll); circ.setLatLng(ll); const e = $('#m_ll'); if (e) e.textContent = `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`; };
  MAP.on('click', e => set(e.latlng)); mk.on('dragend', () => set(mk.getLatLng()));
  sh.setLL = (ll, z) => { set(ll); MAP.setView([ll.lat, ll.lng], z || 18); };
  setTimeout(() => MAP && MAP.invalidateSize(), 200);
}
function closeMap(save) {
  const sh = S.sheet, back = sh.back;
  if (save && sh.lat) { back.s.lat = sh.lat; back.s.lng = sh.lng; back.err = null; }
  if (MAP) { MAP.remove(); MAP = null; }
  S.sheet = back; render(); if (save && sh.lat) toast('Ubicación elegida. Toca Guardar.');
}
let delArm = 0; function confirmDel() { if (Date.now() - delArm < 3000) return true; delArm = Date.now(); toast('Toca otra vez para borrar'); return false; }
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'whoq') { S.q = t.value; filterWho(); }
  if (t.id === 'n_tx') { $('#ncount').textContent = t.value.length + '/60'; $('#nprev').textContent = t.value || '¿Qué está pasando?'; S.sheet.tx = t.value; }
  if (t.classList.contains('pinin')) t.value = t.value.replace(/\D/g, '').slice(0, 4);
  if (t.id === 'u_r') { const r = ROLES[t.value]; $('#u_rd').textContent = r ? r.d : ''; }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'u_s') { const h = $('#u_h'); if (h) h.value = suggestHor(t.value); }
  if (t.id === 'c_sid' || t.id === 'p_sid') { S.sheet.sid = t.value; render(); }
  if (t.id === 'h_flex' || t.id === 'h_fi') { const sh = S.sheet; sh.h = { ...(sh.h || { ini: '08:00', fin: '17:00', lunch: 0, dias: [1, 2, 3, 4, 5, 6], tol: 5 }), n: $('#h_n').value, flex: $('#h_flex').checked, flexIni: $('#h_fi') ? $('#h_fi').checked : true }; render(); }
  if (t.id === 'f_st') { readFoto(); render(); if (t.value === 'fuera') setTimeout(() => { const i = $('#f_lugar'); i && i.focus(); }, 50); }
  if (t.dataset && t.dataset.photo !== undefined && t.files[0]) {
    try { const img = await compress(t.files[0], 200, .82); await updateDoc(D('directory', S.me.id), { photo: img }); S.me.photo = img; const d = S.dir.find(x => x.id === S.me.id); if (d) d.photo = img; render(); toast('¡Listo! Tu foto ya se ve en el equipo 📸'); }
    catch (er) { console.error(er); toast('No se pudo subir la foto'); }
  }
  if (t.dataset && t.dataset.fotoimg !== undefined && t.files[0]) {
    try { S.sheet.cap = $('#f_cap').value; S.sheet.img = await compress(t.files[0], 900, .72); S.sheet.err = null; render(); } catch (er) { toast('No se pudo leer la foto'); }
  }
});
// Al volver a la app (otra hora del día), refresca la vista
document.addEventListener('visibilitychange', () => { if (!document.hidden) rerender(); });
setInterval(() => { rerender(); checkBadges(); }, 60000);
if ('serviceWorker' in navigator && !EMU) navigator.serviceWorker.register('sw.js').catch(() => { });
window.__S = S;
boot();
