import React from 'react';
import NoteCard from './NoteCard';

export default function NoteList({ notes, loading, onDelete, isSearchResult }) {
  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading notes...</p>
      </div>
    );
  }

  if (!notes || notes.length === 0) {
    return (
      <div className="empty-state">
        {isSearchResult ? (
          <>
            <span className="empty-icon">🔍</span>
            <h3>No results found</h3>
            <p>Try a different search query</p>
          </>
        ) : (
          <>
            <span className="empty-icon">📝</span>
            <h3>No notes yet</h3>
            <p>Create your first note to get started</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="note-list">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onDelete={onDelete} />
      ))}
    </div>
  );
}
