import { translation } from '../data/translate.js';
import { MILITARY_TRANSLATE } from '../data/military_translate.js';

export const get = {
  translation(key) {
    return translation[key] ?? key;
  },
  militaryTranslation(key) {
    return MILITARY_TRANSLATE[key] ?? key;
  },
};
