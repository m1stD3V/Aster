import { useState, type FormEvent } from 'react';
import { useGalaxyStore } from '../state/store';

const REPO_URL = 'https://github.com/m1stD3V/Aster';
const LEAVE_MS = 700;

interface IntroProps {
  onDismiss: () => void;
}

/**
 * First-visit landing overlay: brand, one sentence of promise, and a
 * single input. Dissolves into the already-rendering galaxy behind it.
 * Skipped entirely for ?u= deep links and ?snap captures.
 */
export function Intro({ onDismiss }: IntroProps) {
  const loadProfile = useGalaxyStore((s) => s.loadProfile);
  const [username, setUsername] = useState('');
  const [leaving, setLeaving] = useState(false);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(onDismiss, LEAVE_MS);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (username.trim()) void loadProfile(username);
    dismiss();
  };

  return (
    <div className={`intro${leaving ? ' intro-leaving' : ''}`}>
      <div className="intro-card">
        <p className="intro-eyebrow">GitHub Galaxy</p>
        <h1 className="intro-title">Your code is a solar system.</h1>
        <p className="intro-sub">
          Every repository becomes a planet. Stars set the size, forks become moons,
          languages paint the colors, and age places the orbits. The same username always
          builds the same sky.
        </p>
        <form className="intro-form" onSubmit={onSubmit}>
          <input
            className="hud-input intro-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your github username"
            aria-label="GitHub username"
            spellCheck={false}
            autoComplete="off"
            maxLength={39}
            autoFocus
          />
          <button className="intro-button" type="submit">
            Chart my galaxy
          </button>
        </form>
        <button className="intro-skip" type="button" onClick={dismiss}>
          or drift through a sample system
        </button>
        <p className="intro-foot">
          free · no sign-in ·{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            open source
          </a>
        </p>
      </div>
    </div>
  );
}
