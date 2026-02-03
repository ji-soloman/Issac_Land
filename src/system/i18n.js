import { translation } from '../data/translation.js';

export const get = {
  translation(key) {
    translation[key] ?? key;
  }
};
