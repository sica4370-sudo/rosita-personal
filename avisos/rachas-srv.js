/* Rachas del lado del servidor (lo usa enviar.js).
   Reutiliza la misma lógica de la app (src/rachas.js y src/data.js) para que los números coincidan.
   - peligro(): quién tiene su racha en peligro ahora (le toca entrar pronto y no ha marcado)
   - reporte(): el reporte de rachas de ayer para Rosita Noticias (sin nombres de quien la perdió)
   - compromisos(): revisa si quien se comprometió llegó puntual ese día */
const fs = require("fs");
const path = require("path");

async function cargar(rel) {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", rel), "utf8");
  return import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
}

const toMin = hm => { const [h, m] = (hm || "0:0").split(":").map(Number); return h * 60 + m; };
const fmtMin = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const addD = (ds, n) => { const d = new Date(ds + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const SUP = ["admin", "fundador"];
const fixedIn = h => !!h && (!h.flex || !!h.flexIni);
const enRacha = (p, H) => !!p && p.active !== false && !SUP.includes(p.role) && !!H[p.horario] && fixedIn(H[p.horario]);
const diaCreado = p => { const t = p.createdAt; const ms = t && t.toMillis ? t.toMillis() : (t && t._seconds ? t._seconds * 1000 : 0); return ms ? new Date(ms - 6 * 3600e3).toISOString().slice(0, 10) : ""; };
const MILESTONES = [3, 7, 15, 30, 60, 90];

async function crear() {
  const R = await cargar("rachas.js"), D = await cargar("data.js");

  /* staff: {sid: persona}, H: {id: horario}, cambios: [..], hist: {fecha: arr}, histStart, today */
  function calcular({ staff, H, cambios, hist, histStart, today }) {
    const arrOf = d => hist[d] || {}, per = {};
    Object.values(staff).filter(p => enRacha(p, H)).forEach(p => {
      const h = H[p.horario], cd = diaCreado(p);
      per[p.id] = R.streak({ sid: p.id, today, start: cd > histStart ? cd : histStart, arrOf,
        expected: d => D.worksOn(p, h, d, cambios), iniOf: () => null, flexOnlyIfCame: !!h.flex });
    });
    return per;
  }

  // Hora de entrada de hoy (null si hoy tiene permiso o algo especial: mejor no molestar)
  function entradaHoy(p, h, day, cambios) {
    if (!D.worksOn(p, h, day, cambios)) return null;
    if (cambios.some(c => c.sid === p.id && c.estado === "aprobado" && c.rest === day)) return null;
    return entradaBase(p, h, day);
  }

  // Hora de entrada base (horario + medio día de la tarde), sin leer permisos: sirve para el filtro rápido
  function entradaBase(p, h, day) {
    const wd = new Date(day + "T12:00:00Z").getUTCDay();
    if ((p.medios || []).includes(wd) && (p.medioT || "am") === "pm") return p.medioH || fmtMin(Math.round((toMin(h.ini) + toMin(h.fin)) / 2 / 30) * 30);
    return h.ini;
  }

  // Racha en peligro: desde 15 min antes de su entrada hasta que se le acaba la tolerancia
  function peligro({ staff, H, cambios, hist, per, today, nowMin }) {
    const arr = hist[today] || {}, out = [];
    for (const p of Object.values(staff)) {
      const m = per[p.id]; if (!m || m.cur < 1 || arr[p.id]) continue;
      const h = H[p.horario], ini = entradaHoy(p, h, today, cambios); if (!ini) continue;
      const i = toMin(ini), tol = h.tol || 5;
      if (nowMin >= i - 15 && nowMin < i + tol) out.push({ sid: p.id, cur: m.cur, left: m.left, ini, faltan: i - nowMin, tol });
    }
    return out;
  }

  // Reporte de ayer: cuántos llegaron a tiempo, cuántas rachas siguen, cuántas se apagaron (sin nombres)
  // Racha que llevaba al terminar el día i (cuenta hacia atrás, saltando descansos)
  const rachaHasta = (days, i) => { let c = 0; for (let j = i; j >= 0; j--) { const t = days[j].s; if (t === "off") continue; if (t === "ok" || t === "com") c++; else break; } return c; };
  function reporte({ staff, per, stores, yday }) {
    let tocaba = 0, aTiempo = 0, comodin = 0, apagadas = 0, encendidas = 0;
    const hitos = [], storeAyer = {};
    for (const [sid, m] of Object.entries(per)) {
      const i = m.days.findIndex(x => x.d === yday); if (i < 0) continue;
      const s = m.days[i].s; if (s === "off") { if (rachaHasta(m.days, i) > 0) encendidas++; continue; }
      tocaba++;
      const prev = i > 0 ? rachaHasta(m.days, i - 1) : 0;
      const st = (staff[sid] || {}).store; (storeAyer[st] = storeAyer[st] || []).push(s);
      if (s === "ok" || s === "com") {
        if (s === "ok") aTiempo++; else comodin++;
        if (MILESTONES.includes(prev + 1)) hitos.push({ sid, n: prev + 1 });
      } else if (prev > 0) apagadas++;
      if (rachaHasta(m.days, i) > 0) encendidas++;
    }
    const tiendasPerfectas = Object.entries(storeAyer).filter(([id, ss]) => id && stores[id] && ss.length > 1 && ss.every(s => s === "ok" || s === "com")).map(([id]) => stores[id].n);
    const top = Object.entries(per).map(([sid, m]) => { const i = m.days.findIndex(x => x.d === yday); return { sid, cur: i < 0 ? 0 : rachaHasta(m.days, i) }; })
      .filter(x => x.cur >= 3).sort((a, b) => b.cur - a.cur).slice(0, 3);
    return { tocaba, aTiempo, comodin, apagadas, encendidas, hitos: hitos.sort((a, b) => b.n - a.n), tiendasPerfectas, top };
  }

  // Compromisos: ¿llegó a tiempo el día que se comprometió?
  function revisarCompromiso(c, { staff, H, cambios, hist, today }) {
    const p = staff[c.by], h = p && H[p.horario]; if (!p || !h) return { res: "no" };
    let d = c.para;
    // Si ese día no le tocaba (cambio de descanso, permiso), cuenta su siguiente día de trabajo
    for (let k = 0; k < 7 && !D.worksOn(p, h, d, cambios); k++) d = addD(d, 1);
    const a = (hist[d] || {})[c.by];
    if (a) return (a.late || 0) <= 0 ? { res: "ok", dia: d, t: a.t } : { res: "no", dia: d };
    return d < today ? { res: "no", dia: d } : null; // null: todavía no llega, se revisa en la próxima vuelta
  }

  return { calcular, peligro, reporte, revisarCompromiso, enRacha, entradaBase };
}

module.exports = { crear, addD, toMin, MILESTONES };
