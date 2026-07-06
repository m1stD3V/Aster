import { useState, type FormEvent } from 'react';
import { formatCount } from '../lib/format';
import { useGalaxyStore } from '../state/store';
import { Legend } from './Legend';
import { RepoPanel } from './RepoPanel';

/** DOM overlay: crisp text over the canvas, anchored to the corners. */
export function HUD() {
  const profile = useGalaxyStore((s) => s.profile);
  const isYoungSystem = useGalaxyStore((s) => s.galaxy.isYoungSystem);
  const sourceKind = useGalaxyStore((s) => s.sourceKind);
  const status = useGalaxyStore((s) => s.status);
  const message = useGalaxyStore((s) => s.message);
  const loadProfile = useGalaxyStore((s) => s.loadProfile);
  const loadMock = useGalaxyStore((s) => s.loadMock);
  const dismissMessage = useGalaxyStore((s) => s.dismissMessage);
  const selectedRepoId = useGalaxyStore((s) => s.selectedRepoId);
  const [username, setUsername] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (username.trim()) void loadProfile(username);
  };

  const repoCount = profile.repos.filter((r) => !r.isFork && !r.isArchived).length;

  return (
    <div className="hud">
      <header className="hud-corner hud-top-left">
        <h1 className="hud-title">{profile.name ?? profile.login}</h1>
        <p className="hud-login">@{profile.login}</p>
        <p className="hud-stats">
          {formatCount(profile.followers)} followers · {repoCount} repositories
        </p>
        {sourceKind === 'mock' ? (
          <p className="hud-note">sample galaxy</p>
        ) : (
          <button className="hud-note hud-note-action" type="button" onClick={loadMock}>
            back to the sample galaxy
          </button>
        )}
      </header>

      <div className="hud-corner hud-top-right">
        <form className="hud-form" onSubmit={onSubmit}>
          <input
            className="hud-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="github username"
            aria-label="GitHub username"
            spellCheck={false}
            autoComplete="off"
            maxLength={39}
          />
          <button className="hud-button" type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Charting...' : 'Chart'}
          </button>
        </form>
        {message && (
          <button className="hud-message" type="button" onClick={dismissMessage}>
            {message}
          </button>
        )}
      </div>

      <Legend />
      <RepoPanel />

      {isYoungSystem && (
        <p className="hud-caption">A young system. The voyage is just beginning.</p>
      )}

      {!selectedRepoId && (
        <p className="hud-hint">drag to orbit · scroll to zoom · click a planet</p>
      )}
    </div>
  );
}
