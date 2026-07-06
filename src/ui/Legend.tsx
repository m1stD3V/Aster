import { useState, type ReactNode } from 'react';

/** Tiny inline glyphs so each rule is shown, not just described. */
const GLYPHS: Record<string, ReactNode> = {
  star: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7" fill="#ffd27f" opacity="0.25" />
      <circle cx="10" cy="10" r="4" fill="#fff6e6" />
    </svg>
  ),
  size: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="5" cy="12" r="2.5" fill="#8b93a7" />
      <circle cx="13" cy="10" r="5" fill="#e8eaf0" />
    </svg>
  ),
  color: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="4.5" cy="10" r="3" fill="#3178c6" />
      <circle cx="11" cy="10" r="3" fill="#dea584" />
      <circle cx="17" cy="10" r="2.4" fill="#f1e05a" />
    </svg>
  ),
  moons: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="9" cy="11" r="4.5" fill="#8b93a7" />
      <circle cx="15.5" cy="6.5" r="1.4" fill="#e8eaf0" />
      <circle cx="16.5" cy="12.5" r="1.1" fill="#e8eaf0" opacity="0.7" />
    </svg>
  ),
  rings: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="4" fill="#8b93a7" />
      <ellipse
        cx="10"
        cy="10"
        rx="8.5"
        ry="2.6"
        fill="none"
        stroke="#5eead4"
        strokeWidth="1.1"
        opacity="0.8"
      />
    </svg>
  ),
  distance: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="2" fill="#fff6e6" />
      <circle
        cx="10"
        cy="10"
        r="5.5"
        fill="none"
        stroke="#8b93a7"
        strokeWidth="0.8"
        opacity="0.7"
      />
      <circle
        cx="10"
        cy="10"
        r="8.5"
        fill="none"
        stroke="#8b93a7"
        strokeWidth="0.8"
        opacity="0.4"
      />
    </svg>
  ),
  probe: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 4 L13 13 L10 11 L7 13 Z" fill="#5eead4" opacity="0.9" />
    </svg>
  ),
};

interface LegendRow {
  glyph: keyof typeof GLYPHS;
  title: string;
  text: string;
}

const ROWS: LegendRow[] = [
  {
    glyph: 'star',
    title: 'The star is you',
    text: 'It grows and glows with your followers.',
  },
  {
    glyph: 'size',
    title: 'Planets are repos',
    text: 'More GitHub stars, bigger planet. Your top repo is the largest.',
  },
  {
    glyph: 'color',
    title: 'Color is language',
    text: "Each planet is tinted with its repo's main language.",
  },
  {
    glyph: 'moons',
    title: 'Moons are forks',
    text: 'Heavily forked repos keep up to five moons.',
  },
  {
    glyph: 'rings',
    title: 'Rings mean fame',
    text: 'Only your most starred repos wear rings.',
  },
  {
    glyph: 'distance',
    title: 'Distance is age',
    text: 'New repos orbit close to the star; old ones drift far out.',
  },
  { glyph: 'probe', title: 'The probe', text: 'Just passing through.' },
];

/** Small dismissible key explaining the metric-to-visual mapping. */
export function Legend() {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        className="hud-corner hud-bottom-left hud-button legend-toggle"
        type="button"
        onClick={() => setOpen(true)}
      >
        Legend
      </button>
    );
  }

  return (
    <aside className="hud-corner hud-bottom-left legend">
      <div className="legend-header">
        <span className="legend-title">How to read this</span>
        <button
          className="legend-close"
          type="button"
          aria-label="Dismiss legend"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </div>
      <ul className="legend-rows">
        {ROWS.map((row) => (
          <li className="legend-row" key={row.glyph}>
            <span className="legend-glyph">{GLYPHS[row.glyph]}</span>
            <div>
              <p className="legend-row-title">{row.title}</p>
              <p className="legend-row-text">{row.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
