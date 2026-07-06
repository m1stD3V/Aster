# GitHub Galaxy

Your GitHub profile as a calm, deterministic 3D solar system in the browser.

![GitHub Galaxy](docs/screenshot.png)

## Setup

```bash
npm install
npm run dev
```

That is all. The app opens on a bundled sample profile, and entering any GitHub username charts that account through the anonymous REST API. No token, no configuration.

## Data sources and the optional token

Two interchangeable sources sit behind one interface:

- **Anonymous (default).** The REST API, which allows unauthenticated requests: about 60 lookups per hour per IP and 10 searches per minute. This is what a public deployment uses, so no secret ever ships to the browser. When the limit runs out the app says so and stays on whatever galaxy is on screen. One quirk: the search endpoint omits repos with no commits, so empty scaffolds do not appear.
- **Token (local option).** Copy `.env.example` to `.env`, set `VITE_GITHUB_TOKEN` (classic token, no scopes needed), and restart. This switches to GraphQL: one request per profile, 5000 points per hour, and GitHub's exact language colors.

Security notes:

- `.env` is gitignored; never commit a token.
- Do not set `VITE_GITHUB_TOKEN` in a public build. A Vite env var is inlined into the shipped JavaScript where anyone can read it. The anonymous source exists precisely so deployments need no token.
- If you ever paste a token anywhere outside `.env`, rotate it.

## Deploying to GitHub Pages

The repo ships a workflow at `.github/workflows/deploy.yml`. One-time setup:

1. Push the repo to GitHub.
2. In the repo settings, under Pages, set **Source** to **GitHub Actions**.
3. Push to `main` (or `master`), or run the workflow manually.

The workflow tests, lints, builds with the correct `--base` path for project pages, and deploys `dist/`. It intentionally provides no token; the deployed site runs on the anonymous source.

## Embed your galaxy in your profile README

READMEs cannot run scripts or iframes, but they do render animated SVGs. The repo ships three ways to embed, from liveliest to simplest:

1. **Animated SVG widget (recommended).** The `Refresh galaxy widget` workflow renders your galaxy as a self-contained animated SVG (orbits actually move) plus a PNG snapshot of the 3D scene, and pushes both to a `galaxy-image` branch every Monday. Run it once from the Actions tab, then paste this into your profile README, replacing OWNER and REPO:

   ```md
   [![My GitHub Galaxy](https://raw.githubusercontent.com/OWNER/REPO/galaxy-image/galaxy.svg)](https://OWNER.github.io/REPO/?u=OWNER)
   ```

   Swap `galaxy.svg` for `galaxy.png` if you prefer the 3D render as a still.

2. **Save image button.** On the site, chart any account and press "Save image": you get a PNG of the current view and ready-to-paste embed markdown on your clipboard.

3. **Live iframe (for personal sites, not READMEs).** `?u=<login>&snap` renders a clean, HUD-free galaxy that you can drop into an iframe anywhere iframes are allowed.

URL parameters: `?u=<login>` deep-links to a profile; `&snap` hides the interface for captures and embeds.

## How the mapping works

Every visual maps to a real metric. A repository is a planet: its size follows stars (log scaled and normalized against your own top repo, so small profiles still read well), its tint is GitHub's color for the primary language, moons are forks, and rings appear on highly starred repos. Repos pushed within the last six months glow with city lights on their night side, fading as they go quiet. Orbit distance follows repo age, newest close in, and spacing adapts to each planet's rings and moons so neighbors never collide. The central star is you: its size and glow follow followers, and clicking it opens whole-profile stats. Forked and archived repos are excluded by default, and only the top 60 repos become full planets; the rest render as faint distant specks. Space Shuttle Discovery cruises the system on a seeded route; it measures nothing and stays anyway.

Controls: drag to orbit, scroll to zoom, click a planet for details, click the star for profile stats, click empty space to return. "Take the tour" flies the camera through the biggest worlds and ends on the star; any click hands control back. The camera drifts on its own after a few idle seconds, and the occasional meteor is just for you.

## Determinism

All procedural placement (orbit angles, inclinations, speeds, the background starfield) is seeded from the username via FNV-1a plus mulberry32, in `src/lib/prng.ts`. `Math.random` is never used in scene generation, so the same login always produces the same galaxy. Background star density quantizes account age to whole years so it is stable across reloads.

## Commands

| Command          | What it does                                   |
| ---------------- | ---------------------------------------------- |
| `npm run dev`    | Start the dev server                           |
| `npm run build`  | Type-check then build for production           |
| `npm test`       | Unit tests (PRNG, math, mapping, REST adapter) |
| `npm run lint`   | ESLint                                         |
| `npm run format` | Prettier                                       |

## Notes

- Verified against current docs: React Three Fiber 9 pairs with React 19, drei 10 pairs with fiber 9, and the postprocessing chain runs ACES Filmic tone mapping once, as the last effect, with the Canvas in `flat` mode.
- Bloom is selective by luminance: the star pushes emissive color above 1 while planets stay under the threshold, so only the star and corona glow.
- `prefers-reduced-motion` disables the idle camera drift and slows ambient motion to near zero.
