import React from 'react';
import NoteCard from './NoteCard';

export default function NoteList({ notes, loading, onDelete, isSearchResult, hasSearched }) {
  if (loading) return <div className="loading-state" role="status"><span className="spinner" /><p>{isSearchResult ? 'Searching notes…' : 'Loading notes…'}</p></div>;

  if (!notes?.length) {
    return <div className="empty-state"><span className="empty-icon" aria-hidden="true">{isSearchResult ? '⌕' : '+'}</span><h3>{isSearchResult ? (hasSearched ? 'No matches found' : 'Search the archive') : 'No notes yet'}</h3><p>{isSearchResult ? (hasSearched ? 'Try a different query or return to all notes.' : 'Enter a term in the search field to begin.') : 'Create a note to populate the workspace.'}</p></div>;
  }

  return <div className="note-list">{notes.map((note) => <NoteCard key={note.id} note={note} onDelete={onDelete} />)}</div>;
}
