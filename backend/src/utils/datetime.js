// Utilitários de data/hora compartilhados entre controllers
import { config } from "../config/index.js";

export function parseDateOnly(value) {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

export function normalizeHora(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return null;
}

export function getNowInBusinessTimeZone() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.business.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}:${map.second}`,
    dateTime: `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}`,
  };
}
