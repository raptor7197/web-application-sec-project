import React, { useState } from 'react';

export default function NoteCard({ note, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm('Delete this note?')) {
      onDelete(note.id);
    }
  };

  // UNSAFE: Intentionally uses dangerouslySetInnerHTML to render raw HTML
  // This is the XSS vulnerability that SAST/DAST tools should detect
  const renderContent = () => {
    return { __html: note.content };
  };

  return (
    <div
      className={`note-card ${expanded ? 'expanded' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="note-card-header">
        <h3 className="note-title">{note.title}</h3>
        <div className="note-card-actions">
          <span className="note-id">#{note.id}</span>
          <button className="btn-icon btn-delete" onClick={handleDelete} title="Delete note">
            🗑️
          </button>
        </div>
      </div>

      <div className="note-content" dangerouslySetInnerHTML={renderContent()} />

      {expanded && (
        <div className="note-meta">
          <div className="meta-row">
            <span className="meta-label">Created:</span>
            <span>{note.created_at}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Raw content:</span>
            <code className="raw-content">{note.content}</code>
          </div>
        </div>
      )}
    </div>
  );
}
