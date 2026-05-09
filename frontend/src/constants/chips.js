/**
 * Canonical chip configuration shared across the application.
 *
 * Each entry contains both the internal chip ID used by this app and the
 * `fplName` used by the FPL API, so that a single source of truth drives
 * every chip-related display and mapping throughout the codebase.
 */
export const CHIPS = [
  { id: 'bench_boost',    fplName: 'bboost',   label: 'BB', name: 'Bench Boost',    description: 'Bench points are added to your total',            color: '#2e7d32' },
  { id: 'triple_captain', fplName: '3xc',      label: 'TC', name: 'Triple Captain', description: '3× captain multiplier instead of 2×',             color: '#1565c0' },
  { id: 'free_hit',       fplName: 'freehit',  label: 'FH', name: 'Free Hit',       description: 'Unlimited free transfers — reverts next week',    color: '#e65100' },
  { id: 'wildcard',       fplName: 'wildcard', label: 'WC', name: 'Wildcard',       description: 'All transfers are free and permanent',            color: '#6a1b9a' },
];

/** Internal chip ID → FPL API chip name  (e.g. 'bench_boost' → 'bboost') */
export const CHIP_ID_TO_FPL = Object.fromEntries(CHIPS.map(c => [c.id, c.fplName]));

/** FPL API chip name → internal chip ID  (e.g. 'bboost' → 'bench_boost') */
export const FPL_TO_CHIP_ID = Object.fromEntries(CHIPS.map(c => [c.fplName, c.id]));

/** FPL API chip name → short badge label (e.g. 'bboost' → 'BB') */
export const FPL_CHIP_LABEL = Object.fromEntries(CHIPS.map(c => [c.fplName, c.label]));

/** FPL API chip name → display colour    (e.g. 'bboost' → '#2e7d32') */
export const FPL_CHIP_COLOR = Object.fromEntries(CHIPS.map(c => [c.fplName, c.color]));
