/**
 * CLI: fetch a GitHub profile and write the animated SVG galaxy widget.
 * Runs in Node (bundled by rolldown, see the "widget" npm script).
 *
 *   GALAXY_LOGIN=<login> npm run widget
 *
 * GITHUB_TOKEN is optional; CI passes the Actions token for rate limits.
 * GALAXY_OUT overrides the output path (default widget-out/galaxy.svg).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { restToProfile } from '../src/data/githubRest';
import { galaxySvg } from '../src/widget/svgGalaxy';

const login = process.env.GALAXY_LOGIN;
if (!login) {
  console.error('Set GALAXY_LOGIN to a GitHub username.');
  process.exit(1);
}
const out = process.env.GALAXY_OUT ?? 'widget-out/galaxy.svg';
const token = process.env.GITHUB_TOKEN;

const headers: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

const userResponse = await fetch(
  `https://api.github.com/users/${encodeURIComponent(login)}`,
  { headers },
);
if (!userResponse.ok) {
  console.error(`GitHub user fetch failed: ${userResponse.status}`);
  process.exit(1);
}
const searchResponse = await fetch(
  `https://api.github.com/search/repositories?q=${encodeURIComponent(`user:${login}`)}&sort=stars&order=desc&per_page=100`,
  { headers },
);
if (!searchResponse.ok) {
  console.error(`GitHub repo search failed: ${searchResponse.status}`);
  process.exit(1);
}

const rawUser: unknown = await userResponse.json();
const rawSearch = (await searchResponse.json()) as { items?: unknown[] };
const profile = restToProfile(rawUser, rawSearch.items ?? [], login);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, galaxySvg(profile));
console.log(`Wrote ${out} for @${profile.login} (${profile.repos.length} repos).`);
