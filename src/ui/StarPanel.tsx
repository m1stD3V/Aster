import { languageColor } from '../data/languageColors';
import { formatCount } from '../lib/format';
import { STAR_ID, useGalaxyStore } from '../state/store';

/**
 * Aggregate profile stats, shown when the central star is selected:
 * the account read as a whole system rather than one repo.
 */
export function StarPanel() {
  const profile = useGalaxyStore((s) => s.profile);
  const selected = useGalaxyStore((s) => s.selectedRepoId === STAR_ID);
  const selectRepo = useGalaxyStore((s) => s.selectRepo);

  if (!selected) return null;

  const repos = profile.repos.filter((r) => !r.isFork && !r.isArchived);
  const totalStars = repos.reduce((sum, r) => sum + r.stars, 0);
  const totalForks = repos.reduce((sum, r) => sum + r.forks, 0);

  // Top languages by repo count, ties broken by stars.
  const byLanguage = new Map<string, { count: number; stars: number }>();
  for (const repo of repos) {
    if (!repo.language) continue;
    const entry = byLanguage.get(repo.language) ?? { count: 0, stars: 0 };
    entry.count += 1;
    entry.stars += repo.stars;
    byLanguage.set(repo.language, entry);
  }
  const topLanguages = [...byLanguage.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].stars - a[1].stars)
    .slice(0, 3);

  const memberSince = new Date(profile.createdAt).getFullYear();

  return (
    <aside className="hud-corner hud-bottom-right repo-panel" aria-live="polite">
      <div className="repo-panel-header">
        <h2 className="repo-name">@{profile.login}</h2>
        <button
          className="legend-close"
          type="button"
          aria-label="Close profile panel"
          onClick={() => selectRepo(null)}
        >
          ×
        </button>
      </div>
      <p className="repo-description">
        A system of {repos.length} worlds, shining since {memberSince}.
      </p>
      <dl className="repo-stats">
        <div>
          <dt>Total stars</dt>
          <dd>{formatCount(totalStars)}</dd>
        </div>
        <div>
          <dt>Total forks</dt>
          <dd>{formatCount(totalForks)}</dd>
        </div>
        <div>
          <dt>Followers</dt>
          <dd>{formatCount(profile.followers)}</dd>
        </div>
        <div>
          <dt>Languages</dt>
          <dd className="star-languages">
            {topLanguages.length === 0
              ? 'n/a'
              : topLanguages.map(([lang]) => (
                  <span key={lang} className="star-language" title={lang}>
                    <span
                      className="language-dot"
                      style={{ backgroundColor: languageColor(lang) }}
                    />
                    {lang}
                  </span>
                ))}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
