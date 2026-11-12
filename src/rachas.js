// Rachas estilo Duolingo e insignias de Rosita Personal.
// Todo se calcula con el resumen diario (days/{fecha}.arr): quién llegó, a qué hora y cuántos minutos tarde.
export const COMODIN_MAX = 15;   // un comodín cubre hasta 15 min de tardanza
export const COMODINES_MES = 2;  // comodines por persona cada mes
export const VENTANA = 60;       // días hacia atrás que se revisan

export const BADGES = [
  ['primera', '☀️', 'Primer día', 'Llega a tiempo por primera vez'],
  ['r3', '🔥', 'En racha', '3 días seguidos a tiempo'],
  ['r7', '⚡', 'Semana de fuego', '7 días seguidos a tiempo'],
  ['r15', '🚀', 'Imparable', '15 días seguidos a tiempo'],
  ['r30', '👑', 'Leyenda del mes', '30 días seguidos a tiempo'],
  ['r60', '💎', 'Diamante', '60 días seguidos a tiempo'],
  ['limpia', '🛡️', 'Sin comodines', '10 días seguidos a tiempo sin usar comodín'],
  ['madruga', '🌅', 'Siempre temprano', 'Llega 10 min antes 5 veces'],
  ['reco', '👏', 'Estrella del equipo', 'Recibe 3 reconocimientos'],
  ['equipo', '🤝', 'Equipo en llamas', 'Tu tienda logra 7 días seguidos todos a tiempo']
];

/* Racha de una persona.
   ctx: { today, start, arrOf(day), expected(day) -> bool, iniOf(day) -> 'HH:MM' | null, flexOnlyIfCame }
   Devuelve { cur, best, left, days:[{d,s}], early, clean, cleanBest } con s = ok | com | late | miss | off | pend */
export function streak(ctx) {
  const used = {}, days = [];
  let cur = 0, best = 0, clean = 0, cleanBest = 0, early = 0, onTime = 0;
  for (let i = VENTANA; i >= 0; i--) {
    const d = addDays(ctx.today, -i);
    if (d < ctx.start) continue;
    const a = ctx.arrOf(d)[ctx.sid];
    const exp = ctx.flexOnlyIfCame ? !!a : ctx.expected(d);
    if (!exp) { days.push({ d, s: 'off' }); continue; }
    if (!a) {
      if (d === ctx.today) { days.push({ d, s: 'pend' }); continue; }
      cur = 0; clean = 0; days.push({ d, s: 'miss' }); continue;
    }
    const late = a.late || 0, m = d.slice(0, 7);
    if (late <= 0) {
      cur++; clean++; onTime++; days.push({ d, s: 'ok' });
      const ini = ctx.iniOf(d); if (ini && a.t && toMin(ini) - toMin(a.t) >= 10) early++;
    } else if (late <= COMODIN_MAX && (used[m] || 0) < COMODINES_MES) {
      used[m] = (used[m] || 0) + 1; cur++; clean = 0; days.push({ d, s: 'com' });
    } else { cur = 0; clean = 0; days.push({ d, s: 'late' }); }
    best = Math.max(best, cur); cleanBest = Math.max(cleanBest, clean);
  }
  return { cur, best, left: COMODINES_MES - (used[ctx.today.slice(0, 7)] || 0), days, early, clean, cleanBest, onTime };
}

/* Racha de una tienda: días seguidos en que todo el equipo que tocaba llegó a tiempo (o con comodín). */
export function storeStreak(results, today) {
  const byDay = {};
  results.forEach(r => r.days.forEach(x => { (byDay[x.d] = byDay[x.d] || []).push(x.s); }));
  let cur = 0, best = 0;
  Object.keys(byDay).sort().forEach(d => {
    const ss = byDay[d];
    if (ss.some(s => s === 'miss' || s === 'late')) { cur = 0; return; }
    if (ss.some(s => s === 'pend') && d === today) return; // hoy todavía no termina de llegar el equipo
    if (ss.some(s => s === 'ok' || s === 'com')) { cur++; best = Math.max(best, cur); }
  });
  return { cur, best };
}

export function earned(st, extra) {
  const e = new Set();
  if (st) {
    if (st.onTime > 0) e.add('primera');
    [[3, 'r3'], [7, 'r7'], [15, 'r15'], [30, 'r30'], [60, 'r60']].forEach(([n, k]) => { if (st.best >= n) e.add(k); });
    if (st.cleanBest >= 10) e.add('limpia');
    if (st.early >= 5) e.add('madruga');
  }
  if (extra.recos >= 3) e.add('reco');
  if (extra.storeBest >= 7) e.add('equipo');
  return e;
}

const toMin = hm => { const [h, m] = (hm || '0:0').split(':').map(Number); return h * 60 + m; };
function addDays(ds, n) { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
