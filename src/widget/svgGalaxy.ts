import { buildGalaxy, DEFAULT_MAPPING, type PlanetParams } from '../data/mapping';
import type { Profile } from '../data/types';
import { clamp, lerp } from '../lib/math';
import { range, rngFromString } from '../lib/prng';

/**
 * Renders a profile as a self-contained animated SVG banner: the same
 * deterministic galaxy as the 3D scene, flattened to 2D, with orbits
 * driven by SMIL animateMotion. GitHub READMEs strip iframes and
 * scripts but render animated SVG images, so this is the closest thing
 * to a live widget a README allows. No scripts, no external requests.
 */

const W = 1200;
const H = 400;
const CX = 600;
const CY = 205;
/** Vertical squash of orbits: fakes the 3D scene's shallow camera tilt. */
const RY_FACTOR = 0.3;
const MAX_RX = 545;
/** A README banner crowds fast; cap planets below the app's 60. */
const WIDGET_MAX_PLANETS = 20;
/** Real orbital periods are minutes; compress so drift is visible. */
const TIME_COMPRESSION = 3;

const SLATE = '#2A3142';
const TEXT_SECONDARY = '#8B93A7';
const ACCENT = '#5EEAD4';

const f = (n: number): string => {
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix two hex colors; the widget cannot use three.js Color. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const to2 = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${to2(lerp(ca[0], cb[0], t))}${to2(lerp(ca[1], cb[1], t))}${to2(lerp(ca[2], cb[2], t))}`;
}

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Full ellipse path centered on the star, used as an animateMotion rail. */
function orbitPath(rx: number, ry: number): string {
  return `M ${f(CX + rx)} ${f(CY)} A ${f(rx)} ${f(ry)} 0 1 1 ${f(CX - rx)} ${f(CY)} A ${f(rx)} ${f(ry)} 0 1 1 ${f(CX + rx)} ${f(CY)} Z`;
}

function planetSvg(p: PlanetParams, index: number, scale: number): string {
  const rPx = clamp(p.radius * scale * 0.5, 3, 15);
  const period = (Math.PI * 2) / p.orbitSpeed / TIME_COMPRESSION;
  const dur = clamp(period, 18, 110);
  const begin = (p.initialAngle / (Math.PI * 2)) * dur;

  const ring = p.ring
    ? `<ellipse rx="${f(rPx * 2)}" ry="${f(rPx * 0.7)}" fill="none" stroke="${mixHex(p.color, TEXT_SECONDARY, 0.4)}" stroke-width="${f(Math.max(1, rPx * 0.14))}" opacity="${f(Math.min(0.55, p.ring.opacity * 2))}" transform="rotate(-14)"/>`
    : '';

  const moons = p.moons
    .map((m, i) => {
      const moonDur = clamp((Math.PI * 2) / m.speed / 2, 8, 30);
      const moonBegin = (m.phase / (Math.PI * 2)) * moonDur;
      const orbitPx = rPx * 1.9 + i * 3;
      return `<g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${f(moonDur)}s" begin="-${f(moonBegin)}s" repeatCount="indefinite"/><circle cx="${f(orbitPx)}" cy="0" r="${f(Math.max(1.2, rPx * 0.14))}" fill="#7E8698"/></g>`;
    })
    .join('');

  return `<g><animateMotion dur="${f(dur)}s" begin="-${f(begin)}s" repeatCount="indefinite" calcMode="linear"><mpath href="#orbit${index}"/></animateMotion>${ring}<circle r="${f(rPx)}" fill="url(#planet${index})"/>${moons}</g>`;
}

/** Build the whole SVG document. Same input, same string, always. */
export function galaxySvg(profile: Profile, now: number = Date.now()): string {
  const galaxy = buildGalaxy(
    profile,
    { ...DEFAULT_MAPPING, maxPlanets: WIDGET_MAX_PLANETS },
    now,
  );
  const rng = rngFromString(`${galaxy.login}:widget`);
  const scale = MAX_RX / ((galaxy.maxOrbit + 1.5) * 1);
  const starPx = clamp(galaxy.starRadius * scale * 0.45, 12, 30);

  // Background stars, a quarter of them gently twinkling.
  const starCount = 120;
  const stars: string[] = [];
  for (let i = 0; i < starCount; i++) {
    const x = f(range(rng, 0, W));
    const y = f(range(rng, 0, H));
    const r = f(range(rng, 0.4, 1.3));
    const opacity = f(range(rng, 0.25, 0.8));
    if (rng() < 0.25) {
      const dur = f(range(rng, 2.8, 6.5));
      const delay = f(range(rng, 0, 6));
      stars.push(
        `<circle class="tw" style="--d:${dur}s;animation-delay:-${delay}s" cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${opacity}"/>`,
      );
    } else {
      stars.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${opacity}"/>`);
    }
  }

  const planetDefs = galaxy.planets
    .map((p, i) => {
      const base = mixHex(SLATE, p.color, 0.5);
      return `<radialGradient id="planet${i}" cx="35%" cy="30%" r="80%"><stop offset="0%" stop-color="${mixHex(base, '#FFFFFF', 0.3)}"/><stop offset="55%" stop-color="${base}"/><stop offset="100%" stop-color="${mixHex(base, '#05060A', 0.5)}"/></radialGradient>`;
    })
    .join('');

  const orbitPaths = galaxy.planets
    .map((p, i) => {
      const rx = p.orbitA * scale;
      return `<path id="orbit${i}" d="${orbitPath(rx, rx * RY_FACTOR)}" fill="none" stroke="${TEXT_SECONDARY}" stroke-width="0.6" opacity="0.16"/>`;
    })
    .join('');

  const planets = galaxy.planets.map((p, i) => planetSvg(p, i, scale)).join('');

  // The probe: a tiny triangle on a wide rail, nose along its path.
  const probeRx = MAX_RX * 0.88;
  const probeDur = f(range(rng, 55, 75));
  const probeBegin = f(range(rng, 0, 55));
  const probe = `<path id="probePath" d="${orbitPath(probeRx, probeRx * RY_FACTOR * 1.15)}" fill="none"/><g opacity="0.9"><animateMotion dur="${probeDur}s" begin="-${probeBegin}s" repeatCount="indefinite" rotate="auto" calcMode="linear"><mpath href="#probePath"/></animateMotion><path d="M6 0 L-4 3.2 L-1.6 0 L-4 -3.2 Z" fill="${ACCENT}"/><circle cx="-5.4" cy="0" r="1.3" fill="${ACCENT}" opacity="0.55"><animate attributeName="opacity" values="0.55;0.15;0.55" dur="1.4s" repeatCount="indefinite"/></circle></g>`;

  const login = escapeXml(galaxy.login);
  const repoCount = profile.repos.filter((r) => !r.isFork && !r.isArchived).length;
  const caption = `@${login} · ${repoCount} repositories · ${profile.followers} followers`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${login}'s GitHub Galaxy">
<title>@${login}'s GitHub Galaxy</title>
<style>.tw{animation:tw var(--d,4s) ease-in-out infinite}@keyframes tw{0%,100%{opacity:0.12}50%{opacity:0.85}}text{font-family:'JetBrains Mono','SF Mono',ui-monospace,Menlo,monospace}</style>
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#05060A"/><stop offset="100%" stop-color="#0A0E1A"/></linearGradient>
<radialGradient id="vig" cx="50%" cy="50%" r="72%"><stop offset="55%" stop-color="#05060A" stop-opacity="0"/><stop offset="100%" stop-color="#05060A" stop-opacity="0.55"/></radialGradient>
<radialGradient id="nebViolet"><stop offset="0%" stop-color="#6D5DFC" stop-opacity="0.5"/><stop offset="100%" stop-color="#6D5DFC" stop-opacity="0"/></radialGradient>
<radialGradient id="nebIndigo"><stop offset="0%" stop-color="#2A2160" stop-opacity="0.6"/><stop offset="100%" stop-color="#2A2160" stop-opacity="0"/></radialGradient>
<radialGradient id="nebTeal"><stop offset="0%" stop-color="#1FD1C3" stop-opacity="0.35"/><stop offset="100%" stop-color="#1FD1C3" stop-opacity="0"/></radialGradient>
<radialGradient id="corona"><stop offset="0%" stop-color="#FFF6E6" stop-opacity="0.95"/><stop offset="30%" stop-color="#FFD27F" stop-opacity="0.35"/><stop offset="100%" stop-color="#FFD27F" stop-opacity="0"/></radialGradient>
${planetDefs}
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<circle cx="170" cy="80" r="240" fill="url(#nebViolet)" opacity="0.14"/>
<circle cx="1030" cy="320" r="290" fill="url(#nebIndigo)" opacity="0.16"/>
<circle cx="840" cy="50" r="190" fill="url(#nebTeal)" opacity="0.12"/>
${stars.join('')}
${orbitPaths}
<circle cx="${CX}" cy="${CY}" r="${f(starPx * 4.2)}" fill="url(#corona)"/>
<circle cx="${CX}" cy="${CY}" r="${f(starPx)}" fill="#FFF9EF"><animate attributeName="r" values="${f(starPx)};${f(starPx * 1.03)};${f(starPx)}" dur="7s" repeatCount="indefinite"/></circle>
${planets}
${probe}
<text x="24" y="${H - 18}" font-size="12" letter-spacing="1" fill="${TEXT_SECONDARY}">${caption}</text>
<text x="${W - 24}" y="${H - 18}" font-size="10" letter-spacing="3" text-anchor="end" fill="${ACCENT}" opacity="0.65">GITHUB GALAXY</text>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>
`;
}
