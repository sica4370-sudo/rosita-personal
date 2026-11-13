/* Rosita Personal · avisos al celular
   Lo ejecuta GitHub Actions cada 5 minutos (6:00 a. m. a 10:55 p. m., hora de Guatemala).
   1) Avisos personales pendientes (/avisos con sent=false): comentarios, respuestas, menciones y reconocimientos.
   2) Publicaciones nuevas que interesan a todos: anuncios (a quien va dirigido) y Rosita Noticias / Arena (a todos).
   3) Cumpleaños del día (una vez, desde las 8:00 a. m.).
   4) Limpieza: borra avisos de más de 21 días y celulares que ya no existen.
   Necesita el secreto ROSITA_SERVICE_ACCOUNT (llave de una cuenta de servicio del proyecto rosita-personal). */
const admin = require("firebase-admin");
const KEY = process.env.ROSITA_SERVICE_ACCOUNT;
if (!KEY) { console.log("Falta el secreto ROSITA_SERVICE_ACCOUNT: todavía no se envían avisos."); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(KEY)) });
const db = admin.firestore();
const { FieldValue, Timestamp, FieldPath } = admin.firestore;
const APP = process.env.APP_URL || "https://sica4370-sudo.github.io/rosita-personal/";
const TZ = "America/Guatemala";

function gtNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, md: `${p.month}-${p.day}`, h: +(p.hour === "24" ? 0 : p.hour) };
}
const snip = (s, n = 110) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const ms = t => t && t.toMillis ? t.toMillis() : (typeof t === "number" ? t : 0);

(async () => {
  const now = Date.now(), G = gtNow();
  const [staffS, privS, metaS] = await Promise.all([db.collection("staff").get(), db.collection("privado").get(), db.doc("meta/push").get()]);
  const staff = Object.fromEntries(staffS.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
  const activos = Object.values(staff).filter(p => p.active !== false);
  const tokens = {}; privS.docs.forEach(d => { const tk = Object.keys((d.data() || {}).tk || {}); if (tk.length && staff[d.id] && staff[d.id].active !== false) tokens[d.id] = tk; });
  const nombre = sid => sid === "rosita" ? "Rosita" : ((staff[sid] || {}).n || "Alguien").split(" ").slice(0, 2).join(" ");
  const meta = metaS.exists ? metaS.data() : {};
  const malos = {}; let enviados = 0;

  async function enviar(sids, msg) {
    const lista = []; [...new Set(sids)].forEach(sid => (tokens[sid] || []).forEach(t => lista.push([sid, t])));
    for (let i = 0; i < lista.length; i += 500) {
      const parte = lista.slice(i, i + 500);
      const r = await admin.messaging().sendEachForMulticast({ tokens: parte.map(x => x[1]),
        data: { title: msg.title, body: snip(msg.body, 180), link: msg.link || APP, tag: msg.tag || "" },
        webpush: { headers: { Urgency: "high", TTL: "86400" } } });
      r.responses.forEach((x, j) => {
        if (x.success) { enviados++; return; }
        const c = x.error && x.error.code;
        if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"].includes(c)) (malos[parte[j][0]] = malos[parte[j][0]] || []).push(parte[j][1]);
        else console.error("envío", c, x.error && x.error.message);
      });
    }
  }

  // 1) Avisos personales
  const pend = await db.collection("avisos").where("sent", "==", false).limit(300).get();
  const lote = db.batch(); let nLote = 0;
  for (const d of pend.docs) {
    const a = d.data(), viejo = now - ms(a.at) > 6 * 3600e3;
    if (!viejo && a.to && tokens[a.to]) {
      const quien = nombre(a.from);
      const title = { comment: `💬 ${quien} comentó tu publicación`, reply: `💬 ${quien} también comentó`, mention: `@ ${quien} te mencionó`, reco: `👏 ${quien} te dio un reconocimiento` }[a.type] || `🔔 ${quien}`;
      await enviar([a.to], { title, body: a.tx || "", link: `${APP}?p=${a.post || ""}${["comment", "reply"].includes(a.type) || a.c ? "&c=1" : ""}`, tag: a.post ? "p-" + a.post : "" });
    }
    lote.update(d.ref, { sent: true }); nLote++;
  }
  if (nLote) await lote.commit();

  // 2) Publicaciones nuevas para todos
  let last = meta.last || now - 10 * 60e3, maxAt = last;
  const nuevas = await db.collection("posts").where("at", ">", Timestamp.fromMillis(last)).orderBy("at").limit(50).get();
  for (const d of nuevas.docs) {
    const it = d.data(), at = ms(it.at); maxAt = Math.max(maxAt, at);
    if (now - at > 3 * 3600e3) continue;
    const link = `${APP}?p=${d.id}`;
    if (it.kind === "anuncio") {
      const quien = activos.filter(p => p.id !== it.by && (!it.aud || it.aud === "all" || p.store === it.aud)).map(p => p.id);
      await enviar(quien, { title: `📣 Anuncio de ${nombre(it.by)}`, body: it.tx, link, tag: "p-" + d.id });
    } else if (it.kind === "auto") {
      const title = it.kind2 === "noticiero" ? "🎙️ Rosita Noticias" : it.kind2 === "tabla" ? "🏆 Así va la Arena" : `⚡ ${it.title || "Última hora"}`;
      const body = it.kind2 === "noticiero" ? ((it.notas || [])[0] || {}).h || it.tx : it.kind2 === "tabla" ? it.tx : (it.tx || it.title);
      await enviar(activos.map(p => p.id), { title, body: body || "Entra a Rosita para ver las novedades", link, tag: "rosita-" + (it.kind2 || "auto") });
    }
  }

  // 3) Cumpleaños (una vez al día, desde las 8:00)
  let cumple = meta.cumple || "";
  if (G.h >= 8 && cumple !== G.day) {
    for (const p of activos.filter(x => x.cumple === G.md)) await enviar(activos.filter(x => x.id !== p.id).map(x => x.id), { title: `🎂 Hoy cumple años ${nombre(p.id)}`, body: "Entra a Rosita y déjale tu saludo 🎉", link: APP, tag: "cumple-" + p.id });
    cumple = G.day;
  }
  await db.doc("meta/push").set({ last: maxAt, cumple, en: now }, { merge: true });

  // 4) Limpieza
  for (const [sid, tks] of Object.entries(malos)) { try { await db.doc("privado/" + sid).update(...[...new Set(tks)].flatMap(t => [new FieldPath("tk", t), FieldValue.delete()])); } catch (e) { console.error("limpieza", e.message); } }
  const viejos = await db.collection("avisos").where("at", "<", Timestamp.fromMillis(now - 21 * 864e5)).limit(400).get();
  if (!viejos.empty) { const b = db.batch(); viejos.docs.forEach(d => b.delete(d.ref)); await b.commit(); }
  console.log(`Listo: ${pend.size} avisos revisados, ${nuevas.size} publicaciones nuevas, ${enviados} notificaciones enviadas, ${Object.keys(tokens).length} personas con avisos activos.`);
})().catch(e => { console.error(e); process.exit(1); });
