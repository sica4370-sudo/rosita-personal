// Catálogos y reglas de negocio de Rosita Personal
export const ROLES = {
  admin:     { l: 'Gerencia',            d: 'Ve y administra todo: personal, horarios, tiendas y descansos' },
  fundador:  { l: 'Fundadores',          d: 'Ven quién llegó y publican anuncios' },
  jefe:      { l: 'Jefe de área',        d: 'Aprueba cambios de descanso de su departamento, publica anuncios y reconoce' },
  sistemas:  { l: 'Sistemas',            d: 'Crea usuarios y restablece PINs' },
  encargada: { l: 'Encargada de tienda', d: 'Publica fotos y anuncios en su tienda y reconoce a su equipo' },
  asesora:   { l: 'Asesora de ventas',   d: 'Marca entrada y salida y participa en el muro' },
  apoyo:     { l: 'Apoyo / oficina',     d: 'Marca entrada, almuerzo y salida' }
};
export const ROLE_ORDER = ['admin', 'fundador', 'jefe', 'sistemas', 'encargada', 'asesora', 'apoyo'];

export const DEPTS = { ventas: 'Ventas', mercadeo: 'Mercadeo', contabilidad: 'Contabilidad', operaciones: 'Operaciones', gerencia: 'Gerencia' };

export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DIAS_C = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Tiendas iniciales (se pueden editar en Gestión → Tiendas)
export const STORES_SEED = [
  { id: 'of', n: 'Oficina', city: 'Salcajá', mall: false, order: 0 },
  { id: 'ut', n: 'Utz Ulew', city: 'Quetzaltenango', mall: true, order: 1 },
  { id: 'cc', n: 'Metroplaza', city: '4 Caminos', mall: true, order: 2 },
  { id: 'la', n: 'Los Altos', city: 'Totonicapán', mall: true, order: 3 },
  { id: 'pr', n: 'Pradera', city: 'Chimaltenango', mall: true, order: 4 },
  { id: 're', n: 'Regalo', city: 'Mercado Salcajá', mall: false, order: 5 },
  { id: 'be', n: 'Bendición', city: 'Mercado Salcajá', mall: false, order: 6 },
  { id: 'fe', n: 'Fe', city: 'Mercado Salcajá', mall: false, order: 7 },
  { id: 'am', n: 'Amor', city: 'Mercado Salcajá', mall: false, order: 8 },
  { id: 'gr', n: 'Gracia', city: 'Mercado Salcajá', mall: false, order: 9 },
  { id: 'bo', n: 'Bondad', city: 'Mercado Salcajá', mall: false, order: 10 },
  { id: 'mi', n: 'Misericordia', city: 'Mercado Salcajá', mall: false, order: 11 },
  { id: 'fi', n: 'Fidelidad', city: 'Mercado Salcajá', mall: false, order: 12 },
  { id: 'ol', n: 'On line', city: 'Oficina Salcajá', mall: false, order: 13 }
];

// Horarios de ejemplo: ajústalos a los reales en Gestión → Horarios
export const HORARIOS_SEED = [
  { id: 'h-mercado', n: 'Mercado Salcajá', ini: '08:00', fin: '17:00', lunch: 0, dias: [0, 1, 2, 3, 4, 5, 6], tol: 5 },
  { id: 'h-centro', n: 'Centro comercial', ini: '10:00', fin: '20:00', lunch: 0, dias: [0, 1, 2, 3, 4, 5, 6], tol: 5 },
  { id: 'h-oficina', n: 'Oficina', ini: '08:00', fin: '17:00', lunch: 60, dias: [1, 2, 3, 4, 5, 6], tol: 5 },
  { id: 'h-marsab', n: 'Martes y sábado', ini: '08:00', fin: '17:00', lunch: 0, dias: [2, 6], tol: 5 }
];

export const RCATS = [['atencion', '💖', 'Atención al cliente'], ['equipo', '🤝', 'Trabajo en equipo'], ['venta', '💰', 'Venta destacada'], ['orden', '✨', 'Tienda impecable'], ['inicia', '🚀', 'Iniciativa'], ['puntual', '⏰', 'Puntualidad']];
export const FTAGS = ['🪟 Vitrina', '🆕 Llegó producto', '✨ Tienda lista', '🛍️ Clienta feliz'];
export const NEMO = ['☕', '💪', '🎉', '🙏', '🔥', '🌷', '📦', '😂'];
export const COLORS = ['#f400a1', '#7b3fe4', '#11a36b', '#e2711d', '#3a6ff7', '#c2185b', '#00897b', '#6d4c41', '#8e24aa', '#d81b60', '#1e88e5'];

// ¿Le toca trabajar a esta persona en esta fecha? (horario + día de descanso + cambios aprobados)
export function worksOn(st, hor, dateStr, cambios) {
  if (!st || !hor) return false;
  const c = (cambios || []).filter(x => x.sid === st.id && x.estado === 'aprobado');
  // Un permiso de medio día no quita el día: solo acorta el turno
  if (c.some(x => x.rest === dateStr && !x.medio)) return false;
  if (c.some(x => x.work === dateStr)) return true;
  const wd = new Date(dateStr + 'T12:00:00').getDay();
  if (!hor.dias.includes(wd)) return false;
  if (st.descanso != null && st.descanso >= 0 && Number(st.descanso) === wd) return false;
  return true;
}
// Motivo por el que hoy no trabaja (para mostrarlo bonito)
export function restReason(st, hor, dateStr, cambios) {
  const c = (cambios || []).find(x => x.sid === st.id && x.estado === 'aprobado' && x.rest === dateStr && !x.medio);
  if (c) return { k: c.tipo === 'permiso' ? 'permiso' : 'cambio', c };
  const wd = new Date(dateStr + 'T12:00:00').getDay();
  if (st.descanso != null && Number(st.descanso) === wd) return { k: 'descanso' };
  return { k: 'sinturno' };
}

// Reacciones del muro (estilo Facebook)
export const RX = [['❤️', 'Me encanta'], ['👏', 'Aplausos'], ['😂', 'Me divierte'], ['😮', 'Me asombra'], ['🔥', 'Fuego'], ['🙏', 'Gracias']];
