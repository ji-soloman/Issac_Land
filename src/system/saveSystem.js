// src/system/saveSystem.js
import * as db from '../util/db.js';

export const SaveSystem = {
  async create(id, name, world) {
    const now = Date.now();
    const save = {
      id,
      meta: {
        name,
        createdAt: now,
        updatedAt: now,
        version: 1
      },
      world
    };
    await db.writeSave(save);
    return save;
  },

  async load(id) {
    return await db.getSave(id);
  },

  async list() {
    return await db.getAllSaves();
  },

  async delete(id) {
    await db.deleteSave(id);
  }

};
