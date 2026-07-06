/**
 * GitHub's language colors, bundled so there is no runtime dependency.
 * Subset of the linguist list covering common languages; the real data
 * path prefers the color GitHub returns per repo and only falls back here.
 * Source list: https://github.com/ozh/github-colors
 */
export const LANGUAGE_COLORS: Readonly<Record<string, string>> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#663399',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Astro: '#ff5a03',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Lua: '#000080',
  Dart: '#00B4AB',
  Scala: '#c22d40',
  Zig: '#ec915c',
  OCaml: '#ef7a08',
  Clojure: '#db5855',
  R: '#198CE7',
  Julia: '#a270ba',
  Nix: '#7e7eff',
  Dockerfile: '#384d54',
  'Objective-C': '#438eff',
  Perl: '#0298c3',
  Elm: '#60B5CC',
  Erlang: '#B83998',
  'F#': '#b845fc',
  Nim: '#ffc200',
  Crystal: '#000100',
  Assembly: '#6E4C13',
  TeX: '#3D6117',
  'Vim Script': '#199f4b',
  MATLAB: '#e16737',
  Solidity: '#AA6746',
  GDScript: '#355570',
  HCL: '#844FBA',
  PowerShell: '#012456',
  'Jupyter Notebook': '#DA5B0B',
  Makefile: '#427819',
  CMake: '#DA3434',
};

/** Neutral slate for repos with no or unknown language. */
export const FALLBACK_LANGUAGE_COLOR = '#5c6478';

/** Resolve a display color: explicit color, then bundled table, then slate. */
export function languageColor(
  language: string | null,
  explicit: string | null = null,
): string {
  if (explicit) return explicit;
  if (language && LANGUAGE_COLORS[language]) return LANGUAGE_COLORS[language];
  return FALLBACK_LANGUAGE_COLOR;
}
