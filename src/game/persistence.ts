/**
 * Mission progress, per login, in localStorage: personal best score and
 * the cumulative survey atlas (which worlds have ever been visited).
 * Best-effort like the profile cache; storage failures never crash.
 */

const KEY_PREFIX = 'galaxy:game:';

export interface GameRecord {
  bestScore: number;
  surveyedRepoIds: string[];
}

export function readGameRecord(login: string): GameRecord {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + login);
    if (!raw) return { bestScore: 0, surveyedRepoIds: [] };
    const parsed = JSON.parse(raw) as Partial<GameRecord>;
    return {
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      surveyedRepoIds: Array.isArray(parsed.surveyedRepoIds)
        ? parsed.surveyedRepoIds.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return { bestScore: 0, surveyedRepoIds: [] };
  }
}

export function writeGameRecord(login: string, record: GameRecord): void {
  try {
    localStorage.setItem(KEY_PREFIX + login, JSON.stringify(record));
  } catch {
    // Storage unavailable; the run still happened, it just is not saved.
  }
}
