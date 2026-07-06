import { languageColor } from '../data/languageColors';
import { formatCount, timeAgo } from '../lib/format';
import { useGalaxyStore } from '../state/store';

/** Details for the focused repo; renders nothing when nothing is selected. */
export function RepoPanel() {
  const repo = useGalaxyStore((s) =>
    s.selectedRepoId
      ? (s.profile.repos.find((r) => r.id === s.selectedRepoId) ?? null)
      : null,
  );
  const selectRepo = useGalaxyStore((s) => s.selectRepo);

  if (!repo) return null;

  return (
    <aside className="hud-corner hud-bottom-right repo-panel" aria-live="polite">
      <div className="repo-panel-header">
        <h2 className="repo-name">{repo.name}</h2>
        <button
          className="legend-close"
          type="button"
          aria-label="Close repo panel"
          onClick={() => selectRepo(null)}
        >
          ×
        </button>
      </div>
      {repo.description && <p className="repo-description">{repo.description}</p>}
      <dl className="repo-stats">
        <div>
          <dt>Stars</dt>
          <dd>{formatCount(repo.stars)}</dd>
        </div>
        <div>
          <dt>Forks</dt>
          <dd>{formatCount(repo.forks)}</dd>
        </div>
        <div>
          <dt>Language</dt>
          <dd>
            <span
              className="language-dot"
              style={{ backgroundColor: languageColor(repo.language, repo.languageColor) }}
            />
            {repo.language ?? 'n/a'}
          </dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{timeAgo(repo.pushedAt)}</dd>
        </div>
      </dl>
    </aside>
  );
}
