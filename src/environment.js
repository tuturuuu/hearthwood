import * as THREE from 'three';

// ---------- clock, seasons, weather ----------
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

export const realHours = (d = new Date()) => d.getHours() + d.getMinutes() / 60;

export function seasonOf(d = new Date()) {
  const m = d.getMonth();
  return m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'autumn';
}

/** day: 0 = night, 1 = full daylight; dusk: strength of the golden-hour tint. */
export function lightAt(h) {
  const day = smooth(5.5, 7.5, h) * (1 - smooth(17.5, 19.6, h));
  const dusk = Math.max(bell(h, 6.6, 0.8), bell(h, 18.4, 0.9)) * 0.9;
  return { day, dusk };
}

function hash(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

/** Weather changes every 3 hours, the same for everyone, flavoured by the season. */
export function autoWeather(d = new Date()) {
  const season = seasonOf(d);
  const r = hash(`${d.toDateString()}#${Math.floor(d.getHours() / 3)}`);
  if (season === 'winter') return r < 0.55 ? 'snow' : r < 0.7 ? 'rain' : 'clear';
  if (r < (season === 'autumn' ? 0.3 : 0.2)) return 'rain';
  return season === 'autumn' ? 'leaves' : 'clear';
}

export const TIME_MODES = { auto: 'Real clock', day: 'Always day', night: 'Always night' };
export const WEATHER_MODES = { auto: 'Auto', clear: 'Clear', rain: 'Rain', snow: 'Snow', leaves: 'Falling leaves' };

/** Everything the world needs to know about "now", given the user's settings. */
export function environmentFor({ timeMode = 'auto', weatherMode = 'auto' } = {}, d = new Date()) {
  const hours = timeMode === 'day' ? 13 : timeMode === 'night' ? 23 : realHours(d);
  const season = seasonOf(d);
  const weather = weatherMode === 'auto' ? autoWeather(d) : weatherMode;
  return {
    hours, season, weather, ...lightAt(hours),
    rain: weather === 'rain' ? 1 : 0,
    snow: weather === 'snow' ? 1 : 0,
    leaves: weather === 'leaves' ? 1 : 0,
    snowCover: season === 'winter' || weather === 'snow' ? 1 : 0,
  };
}

// ---------- palette blending ----------
/** Turn hex strings into THREE.Color once so blends are cheap. */
export function palette(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = typeof v === 'string' ? new THREE.Color(v) : v;
  return out;
}

export function clonePalette(p) {
  const out = {};
  for (const [k, v] of Object.entries(p)) out[k] = v?.isColor ? v.clone() : v;
  return out;
}

/** Blend `target` towards the keys present in `over` by t (in place). */
export function blendInto(target, over, t) {
  if (t <= 0) return target;
  for (const [k, v] of Object.entries(over)) {
    if (!(k in target)) continue;
    if (v?.isColor) target[k].lerp(v, t);
    else target[k] += (v - target[k]) * t;
  }
  return target;
}

/** night → day, then golden hour, overcast and snow tints on top. */
export function resolvePalette(P, env) {
  const out = blendInto(clonePalette(P.night), P.day, env.day);
  blendInto(out, P.dusk, env.dusk);
  if (P.rain) blendInto(out, P.rain, env.rain * 0.75);
  if (P.snow) blendInto(out, P.snow, env.snowCover * (0.35 + 0.65 * env.day));
  return out;
}
