import React, { useState } from 'react';

export default function NoteForm({ onSubmit }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !content.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmit(title.trim(), content.trim());
      setTitle('');
      setContent('');
      setIsExpanded(false);
    } catch (_err) {
      // Keep the draft in place for another attempt.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="note-form-container">
      <button type="button" className="new-note-button" onClick={() => setIsExpanded(!isExpanded)} aria-expanded={isExpanded} aria-controls="new-note-form">
        <span>{isExpanded ? 'Close editor' : 'Create new note'}</span><span aria-hidden="true">{isExpanded ? '×' : '+'}</span>
      </button>
      {isExpanded && (
        <form id="new-note-form" onSubmit={handleSubmit} className="note-form">
          <label htmlFor="note-title">Title</label>
          <input id="note-title" type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Give it a name" maxLength={120} required autoFocus />
          <label htmlFor="note-content">Content</label>
          <textarea id="note-content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a note..." rows={5} required />
          <p className="field-hint">HTML is rendered as-is. Use only harmless, local test data.</p>
          <button type="submit" className="submit-button" disabled={saving}>{saving ? 'Saving…' : 'Save note ↗'}</button>
        </form>
      )}
    </div>
  );
}
