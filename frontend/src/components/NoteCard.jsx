import React, { useState } from 'react';

export default function NoteCard({ note, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const date = note.created_at ? new Date(`${note.created_at.replace(' ', 'T')}Z`) : null;
  const formattedDate = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Date unknown';

  const handleDelete = (event) => {
    event.stopPropagation();
    if (window.confirm(`Delete “${note.title}”? This cannot be undone.`)) onDelete(note.id);
  };

  return (
    <article className={`note-card ${expanded ? 'expanded' : ''}`}>
      <div className="note-card-top"><span className="note-number">NOTE / {String(note.id).padStart(3, '0')}</span><span className="note-date">{formattedDate}</span></div>
      <h3>{note.title}</h3>
      {/* Intentionally unsafe: XSS is an explicit lab exercise. */}
      <div className="note-content" dangerouslySetInnerHTML={{ __html: note.content }} />
      {expanded && <div className="note-meta"><span>RAW CONTENT</span><code>{note.content}</code></div>}
      <div className="note-card-bottom">
        <button type="button" className="details-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? 'Hide source' : 'View source'} <span aria-hidden="true">{expanded ? '−' : '↗'}</span></button>
        <button type="button" className="delete-button" onClick={handleDelete} aria-label={`Delete ${note.title}`}>Delete</button>
      </div>
    </article>
  );
}
