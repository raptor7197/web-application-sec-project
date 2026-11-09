import test from 'node:test';
import assert from 'node:assert/strict';
import { getNotesView } from './notesView.js';

const notes = [{ id: 1, title: 'Alpha' }, { id: 2, title: 'Beta' }];

test('all tab stays on all notes even after a search', () => {
  assert.deepEqual(getNotesView('all', notes, { results: [notes[1]] }), notes);
});

test('search tab shows the returned results, including an empty list', () => {
  assert.deepEqual(getNotesView('search', notes, { results: [notes[1]] }), [notes[1]]);
  assert.deepEqual(getNotesView('search', notes, { results: [] }), []);
});

test('search tab without a completed query has no results', () => {
  assert.deepEqual(getNotesView('search', notes, null), []);
});
