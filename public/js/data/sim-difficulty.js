/** Alpha sim difficulty — mirrors server/sim-difficulty.js */
export const SIM_DIFFICULTY_LEVELS = [
  {
    id: 'easy',
    label: 'קל',
    sub: 'חמה גבוהה · רוצה דייט',
    personaName: 'מאיה',
    opener: 'היי, מה קורה?',
    cssClass: 'sim-diff--easy'
  },
  {
    id: 'medium',
    label: 'בינוני',
    sub: 'מעורב · בודקת מסגרת',
    personaName: 'ספיר',
    opener: 'היי, מה קורה?',
    cssClass: 'sim-diff--medium'
  },
  {
    id: 'hard',
    label: 'קשה',
    sub: 'קרה · התנגדות מקסימלית',
    personaName: 'ספיר',
    opener: 'היי',
    cssClass: 'sim-diff--hard'
  }
];

export function getSimLevel(id) {
  return SIM_DIFFICULTY_LEVELS.find((l) => l.id === id) || SIM_DIFFICULTY_LEVELS[1];
}
