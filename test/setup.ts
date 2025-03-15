import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { indexedDB } from 'fake-indexeddb';

beforeEach(() => {
  // Clear all databases before each test
  indexedDB.databases().then(dbs => {
    dbs.forEach(db => {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    });
  });
});