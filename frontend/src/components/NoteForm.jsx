import React, { useState } from 'react';

export default function NoteForm({ onSubmit }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSubmit(title.trim(), content.trim());
    setTitle('');
    setContent('');
    setIsExpanded(false);
  };

  return (
    <div className="note-form-container">
      <button
        className="btn btn-primary btn-expand"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? '− Cancel' : '+ New Note'}
      </button>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="note-form">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="form-input"
            autoFocus
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Note content (HTML is supported)..."
            className="form-textarea"
            rows={4}
          />
          <div className="form-hint">
            💡 HTML content will be rendered as-is (XSS vulnerability)
          </div>
          <button type="submit" className="btn btn-primary btn-submit">
            ✨ Create Note
          </button>
        </form>
      )}
    </div>
  );
}
