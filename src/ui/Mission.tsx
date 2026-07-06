import { useGalaxyStore } from '../state/store';

/** Score and clock while flying, plus the controls reminder. */
export function FlightHUD() {
  const score = useGalaxyStore((s) => s.score);
  const secondsLeft = useGalaxyStore((s) => s.secondsLeft);
  const login = useGalaxyStore((s) => s.galaxy.login);

  return (
    <div className="hud">
      <div className="flight-hud">
        <span className="flight-stat">✦ {score}</span>
        <span className="flight-clock">{secondsLeft}s</span>
        <span className="flight-login">@{login}</span>
      </div>
      <p className="hud-hint">steer with WASD or arrows · shift to boost · esc to end</p>
    </div>
  );
}

/** Post-mission summary card with the share hook built in. */
export function MissionResult() {
  const result = useGalaxyStore((s) => s.missionResult);
  const login = useGalaxyStore((s) => s.galaxy.login);
  const startMission = useGalaxyStore((s) => s.startMission);
  const dismiss = useGalaxyStore((s) => s.dismissMissionResult);

  if (!result) return null;

  const shareScore = async () => {
    const url = `${location.origin}${location.pathname}?u=${encodeURIComponent(login)}`;
    const text = `I harvested ${result.score} stardust surveying @${login}'s GitHub galaxy. Fly yours:`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'GitHub Galaxy', text, url });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
    } catch {
      // Nothing sensible to do; the score is on screen anyway.
    }
  };

  return (
    <div className="intro">
      <div className="intro-card mission-card">
        <p className="intro-eyebrow">Mission complete</p>
        <p className="mission-score">✦ {result.score}</p>
        <p className="intro-sub">
          {result.newBest
            ? 'A new personal best. '
            : `Personal best: ${result.bestScore}. `}
          You surveyed {result.surveyedThisRun} worlds this run; your atlas covers{' '}
          {result.surveyedTotal} of {result.planetCount}. Active repos spawn richer stardust
          fields, so the best way to raise your ceiling is to ship something.
        </p>
        <div className="intro-form">
          <button className="intro-button" type="button" onClick={startMission}>
            Fly again
          </button>
          <button className="intro-button" type="button" onClick={shareScore}>
            Share score
          </button>
        </div>
        <button className="intro-skip" type="button" onClick={dismiss}>
          back to the observatory
        </button>
      </div>
    </div>
  );
}
