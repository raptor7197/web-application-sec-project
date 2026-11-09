export function getNotesView(tab, notes, results) {
  return tab === 'search' ? (results?.results ?? []) : notes;
}
