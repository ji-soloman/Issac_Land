import { translation } from '../data/translate.js';

export const get = {
  translation(key) {
    return translation[key] ?? key;
  }
};
