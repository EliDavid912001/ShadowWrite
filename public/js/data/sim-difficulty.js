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
    sub: 'ספיר · אתגר שובב · מוותרת אחרי frame חזק',
    personaName: 'ספיר',
    opener: 'היי, אז מי אתה ולמה אני אמורה לרצות לדבר איתך?',
    cssClass: 'sim-diff--hard'
  }
];

export function getSimLevel(id) {
  return SIM_DIFFICULTY_LEVELS.find((l) => l.id === id) || SIM_DIFFICULTY_LEVELS[1];
}
