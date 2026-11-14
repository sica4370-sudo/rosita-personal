/* Rosita Personal · avisos al celular
   Lo ejecuta GitHub Actions cada 5 minutos (6:00 a. m. a 10:55 p. m., hora de Guatemala).
   1) Avisos personales pendientes (/avisos con sent=false): comentarios, respuestas, menciones y reconocimientos.
   2) Publicaciones nuevas que interesan a todos: anuncios (a quien va dirigido) y Rosita Noticias / Arena (a todos).
   3) Cumpleaños del día (una vez, desde las 8:00 a. m.).
   4) Limpieza: borra avisos de más de 21 días y celulares que ya no existen.
   5) Permisos y descansos: avisa a quien debe aprobar, avisa a Gerencia y a la persona cuando se decide,
      manda a las 7:00 a. m. el resumen de quién falta hoy y copia cada ausencia aprobada a Google Calendar
      (calendario que Gerencia conecta en Gestión → Descansos; se guarda en meta/calendario).
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

  async function ausencias() {
    const DC = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"], MS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const addD = (ds, n) => { const d = new Date(ds + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const nice = ds => { const d = new Date(ds + "T12:00:00Z"); return `${DC[d.getUTCDay()]} ${d.getUTCDate()} ${MS[d.getUTCMonth()]}`; };
    const MEDIO = { am: "medio día (mañana)", pm: "medio día (tarde)" };
    const storesS = await db.collection("stores").get(), tienda = id => ((storesS.docs.find(d => d.id === id) || { data: () => ({}) }).data().n || "");
    const esJefe = p => ["jefe", "admin", "fundador"].includes((p || {}).role);
    const admins = activos.filter(p => p.role === "admin").map(p => p.id);
    const quienDecide = c => { const p = staff[c.sid] || {}; return [...admins, ...(esJefe(p) ? [] : activos.filter(j => j.role === "jefe" && j.dept === p.dept).map(j => j.id))].filter(x => x !== c.sid); };
    const que = c => c.tipo === "permiso" ? `permiso ${nice(c.rest)} · ${c.medio ? MEDIO[c.medio] : "día completo"}` : `descansa ${nice(c.rest)} y trabaja ${nice(c.work)}`;
    const cs = await db.collection("cambios").where("rest", ">=", addD(G.day, -3)).get();

    // Avisos según el estado (una sola vez por estado; lo viejo se marca sin avisar)
    for (const d of cs.docs) {
      const c = d.data(); if (c.av === c.estado) continue;
      const fresco = now - ms(c.at) < 48 * 3600e3 || c.estado !== "pendiente";
      if (fresco) {
        const n = nombre(c.sid), link = APP;
        if (c.estado === "pendiente") await enviar(quienDecide(c), { title: `🙋 ${n} pide ${c.tipo === "permiso" ? "permiso" : "mover su descanso"}`, body: `${que(c)}${c.mot ? ` · “${c.mot}”` : ""} · Apruébalo en Gestión`, link, tag: "c-" + d.id });
        else {
          const por = c.decidedBy ? nombre(c.decidedBy) : "Gerencia", ok = c.estado === "aprobado";
          if (c.estado === "anulado") {
            await enviar(admins.filter(x => x !== c.decidedBy && x !== c.sid), { title: `⊘ ${por} anuló: ${n}`, body: `${que(c)} · ya no cuenta`, link, tag: "c-" + d.id });
            await enviar([c.sid], { title: "⊘ Tu permiso o cambio fue anulado", body: `${que(c)} · anuló ${por}. Si lo necesitas, pide uno nuevo.`, link, tag: "c-" + d.id });
            await d.ref.update({ av: c.estado }); continue;
          }
          await enviar(admins.filter(x => x !== c.decidedBy && x !== c.sid), { title: `${ok ? "✅" : "✕"} ${por} ${ok ? "aprobó" : "rechazó"}: ${n}`, body: `${que(c)}${c.mot ? ` · “${c.mot}”` : ""}`, link, tag: "c-" + d.id });
          if (c.decidedBy !== c.sid) await enviar([c.sid], { title: ok ? "✅ Tu solicitud fue aprobada" : "✕ Tu solicitud no fue aprobada", body: `${que(c)} · ${ok ? "aprobó" : "rechazó"} ${por}`, link, tag: "c-" + d.id });
        }
      }
      await d.ref.update({ av: c.estado });
    }

    // Resumen de las 7:00 a. m.: quién falta hoy (Gerencia ve todo; cada jefe, su área)
    let hecho = meta.ausHoy || "";
    if (G.h >= 7 && hecho !== G.day) {
      const trab = await db.collection("cambios").where("work", "==", G.day).get();
      const items = [
        ...cs.docs.map(d => d.data()).filter(c => c.estado === "aprobado" && c.rest === G.day).map(c => ({ c, t: `${nombre(c.sid)}${c.tipo === "permiso" ? ` (${c.medio ? MEDIO[c.medio] : "no viene"})` : " (descansa, movió su descanso)"}` })),
        ...trab.docs.map(d => d.data()).filter(c => c.estado === "aprobado").map(c => ({ c, t: `${nombre(c.sid)} trabaja hoy en lugar de su descanso` }))];
      const para = {};
      for (const it of items) { const p = staff[it.c.sid] || {}; [...admins, ...activos.filter(j => j.role === "jefe" && j.dept === p.dept).map(j => j.id)].filter(x => x !== it.c.sid).forEach(x => (para[x] = para[x] || []).push(it.t)); }
      for (const [sid, l] of Object.entries(para)) await enviar([sid], { title: `📋 Hoy ${l.length === 1 ? "hay 1 cambio" : `hay ${l.length} cambios`} en el personal`, body: l.join(" · "), link: APP, tag: "aus-" + G.day });
      hecho = G.day;
    }

    // Google Calendar
    const calRef = db.doc("meta/calendario"), cal = (await calRef.get()).data() || {}, SA = JSON.parse(KEY).client_email;
    if (cal.sa !== SA) await calRef.set({ sa: SA }, { merge: true });
    if (cal.id) {
      try {
        const { JWT } = require("google-auth-library");
        const k = JSON.parse(KEY), jwt = new JWT({ email: k.client_email, key: k.private_key, scopes: ["https://www.googleapis.com/auth/calendar.events"] });
        const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`;
        const api = async (url, method, body) => { const r = await jwt.request({ url, method, data: body, validateStatus: () => true }); if (r.status >= 300 && !(method === "DELETE" && [404, 410].includes(r.status))) throw new Error(`${r.status} ${JSON.stringify(r.data && r.data.error && r.data.error.message || r.data)}`); return r.data; };
        let n = 0;
        for (const d of cs.docs) {
          const c = d.data(), quiero = c.estado === "aprobado" && c.rest >= G.day;
          if (quiero && !c.gcal) {
            const p = staff[c.sid] || {}, per = c.tipo === "permiso";
            const ev = await api(base, "POST", {
              summary: per ? `📝 ${nombre(c.sid)} · ${c.medio ? MEDIO[c.medio] : "falta todo el día"}` : `🔄 ${nombre(c.sid)} descansa (trabaja el ${nice(c.work)})`,
              description: [`Tienda/área: ${tienda(p.store) || p.dept || "—"}`, c.mot ? `Motivo: ${c.mot}` : "", per ? "Permiso con descuento" : "Cambio de descanso, sin descuento", `Aprobó: ${c.decidedBy ? nombre(c.decidedBy) : "—"}`, "Rosita · Personal"].filter(Boolean).join("\n"),
              start: { date: c.rest }, end: { date: addD(c.rest, 1) }, transparency: "transparent",
              extendedProperties: { private: { rosita: d.id } } });
            await d.ref.update({ gcal: ev.id }); n++;
          } else if (!quiero && c.gcal && c.estado !== "aprobado") { await api(`${base}/${c.gcal}`, "DELETE"); await d.ref.update({ gcal: FieldValue.delete() }); n++; }
        }
        if (cal.estado !== "ok" || n) await calRef.set({ estado: "ok", msg: "", en: now }, { merge: true });
      } catch (e) {
        console.error("calendario", e.message);
        const m = /404|notFound|Not Found/.test(e.message) ? "No encuentro ese calendario: revisa el ID y que esté compartido con el correo de la app." : /403|writer|forbidden|disabled|has not been used/i.test(e.message) ? (/disabled|has not been used/i.test(e.message) ? "Falta activar Google Calendar API en el proyecto." : "El calendario no está compartido con permiso para hacer cambios.") : e.message.slice(0, 200);
        await calRef.set({ estado: "error", msg: m, en: now }, { merge: true });
      }
    }
    return hecho;
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
  // 5) Permisos y descansos
  const ausHoy = await ausencias();
  await db.doc("meta/push").set({ last: maxAt, cumple, ausHoy, en: now }, { merge: true });

  // 4) Limpieza
  for (const [sid, tks] of Object.entries(malos)) { try { await db.doc("privado/" + sid).update(...[...new Set(tks)].flatMap(t => [new FieldPath("tk", t), FieldValue.delete()])); } catch (e) { console.error("limpieza", e.message); } }
  const viejos = await db.collection("avisos").where("at", "<", Timestamp.fromMillis(now - 21 * 864e5)).limit(400).get();
  if (!viejos.empty) { const b = db.batch(); viejos.docs.forEach(d => b.delete(d.ref)); await b.commit(); }
  console.log(`Listo: ${pend.size} avisos revisados, ${nuevas.size} publicaciones nuevas, ${enviados} notificaciones enviadas, ${Object.keys(tokens).length} personas con avisos activos.`);
})().catch(e => { console.error(e); process.exit(1); });
