import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatCount } from '../lib/format';
import { STAR_ID, useGalaxyStore } from '../state/store';
import { Legend } from './Legend';
import { FlightHUD, MissionResult } from './Mission';
import { RepoPanel } from './RepoPanel';
import { StarPanel } from './StarPanel';

const TOUR_STOP_MS = 5200;

/**
 * Guided tour: fly the camera through the largest planets and finish
 * on the star. Any manual selection change cancels it, so a click
 * anywhere hands control straight back to the visitor.
 */
function useTour(): { touring: boolean; toggleTour: () => void } {
  const galaxy = useGalaxyStore((s) => s.galaxy);
  const selectRepo = useGalaxyStore((s) => s.selectRepo);
  const selectedRepoId = useGalaxyStore((s) => s.selectedRepoId);
  const [touring, setTouring] = useState(false);
  const expected = useRef<string | null>(null);

  useEffect(() => {
    if (!touring) return;
    const stops = [...galaxy.planets]
      .sort((a, b) => b.radius - a.radius)
      .slice(0, 4)
      .map((p) => p.repoId);
    stops.push(STAR_ID);
    let index = 0;
    expected.current = stops[0];
    selectRepo(stops[0]);
    const timer = window.setInterval(() => {
      index += 1;
      if (index >= stops.length) {
        expected.current = null;
        selectRepo(null);
        setTouring(false);
        return;
      }
      expected.current = stops[index];
      selectRepo(stops[index]);
    }, TOUR_STOP_MS);
    return () => window.clearInterval(timer);
  }, [touring, galaxy, selectRepo]);

  useEffect(() => {
    if (touring && selectedRepoId !== expected.current) setTouring(false);
  }, [touring, selectedRepoId]);

  const toggleTour = () =>
    setTouring((wasTouring) => {
      // Nothing to visit in an empty galaxy.
      if (!wasTouring && galaxy.planets.length === 0) return wasTouring;
      return !wasTouring;
    });

  return { touring, toggleTour };
}

/**
 * Grab the rendered canvas as a PNG download and put ready-to-paste
 * embed markdown on the clipboard. Works because the Canvas runs with
 * preserveDrawingBuffer enabled.
 */
async function saveSnapshot(login: string): Promise<string> {
  const canvas = document.querySelector<HTMLCanvasElement>('.app canvas');
  if (!canvas) return 'Could not find the canvas.';

  const filename = `github-galaxy-${login}.png`;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, 'image/png');

  const link = `${location.origin}${location.pathname}?u=${encodeURIComponent(login)}`;
  const markdown = `[![${login}'s GitHub Galaxy](./${filename})](${link})`;
  try {
    await navigator.clipboard.writeText(markdown);
    return 'Image saved. Embed markdown copied to your clipboard.';
  } catch {
    return 'Image saved.';
  }
}

/** Native share sheet where available, deep-link copy everywhere else. */
async function shareGalaxy(login: string): Promise<string> {
  const url = `${location.origin}${location.pathname}?u=${encodeURIComponent(login)}`;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `${login}'s GitHub Galaxy`, url });
      return '';
    } catch {
      return '';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'Link copied to your clipboard.';
  } catch {
    return `Share this link: ${url}`;
  }
}

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
  const flight = useGalaxyStore((s) => s.mode === 'flight');
  const startMission = useGalaxyStore((s) => s.startMission);
  const [username, setUsername] = useState('');
  const [snapNote, setSnapNote] = useState<string | null>(null);
  const { touring, toggleTour } = useTour();

  useEffect(() => {
    if (!snapNote) return;
    const timer = setTimeout(() => setSnapNote(null), 5000);
    return () => clearTimeout(timer);
  }, [snapNote]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (username.trim()) void loadProfile(username);
  };

  const onSnapshot = () => {
    void saveSnapshot(profile.login).then(setSnapNote);
  };

  const onShare = () => {
    void shareGalaxy(profile.login).then((note) => {
      if (note) setSnapNote(note);
    });
  };

  const repoCount = profile.repos.filter((r) => !r.isFork && !r.isArchived).length;

  // A mission owns the whole overlay.
  if (flight) return <FlightHUD />;

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
        <a
          className="hud-note hud-note-action"
          href="https://github.com/m1stD3V/Aster"
          target="_blank"
          rel="noreferrer"
        >
          open source on GitHub
        </a>
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
          <button
            className="hud-button"
            type="button"
            onClick={onSnapshot}
            title="Download this view as a PNG"
          >
            Save image
          </button>
          <button
            className="hud-button"
            type="button"
            onClick={onShare}
            title="Share a link to this galaxy"
          >
            Share
          </button>
        </form>
        {snapNote && <p className="hud-note">{snapNote}</p>}
        {message && (
          <button className="hud-message" type="button" onClick={dismissMessage}>
            {message}
          </button>
        )}
      </div>

      <Legend />
      <RepoPanel />
      <StarPanel />

      {isYoungSystem && (
        <p className="hud-caption">A young system. The voyage is just beginning.</p>
      )}

      {(!selectedRepoId || touring) && (
        <p className="hud-hint">
          drag to orbit · scroll to zoom · click a planet ·{' '}
          <button className="hud-hint-button" type="button" onClick={toggleTour}>
            {touring ? 'stop the tour' : 'take the tour'}
          </button>{' '}
          ·{' '}
          <button className="hud-hint-button" type="button" onClick={startMission}>
            fly a mission
          </button>
        </p>
      )}

      <MissionResult />
    </div>
  );
}
