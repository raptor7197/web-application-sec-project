const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// UNSAFE: Intentionally vulnerable to SQL Injection
// The search query concatenates user input directly into SQL
router.get('/search', (req, res) => {
  const search = req.query.q || '';

  // VULNERABILITY: SQL Injection - user input concatenated directly into query
  // Semgrep & CodeQL should flag this as a SQL injection
  const query = "SELECT * FROM notes WHERE title LIKE '%" + search + "%' OR content LIKE '%" + search + "%'";

  try {
    const db = getDb();
    const results = db.prepare(query).all();
    res.json({ results, query });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', message: err.message, query });
  }
});

// Get all notes
router.get('/', (req, res) => {
  const db = getDb();
  const notes = db.prepare('SELECT * FROM notes ORDER BY created_at DESC').all();
  res.json(notes);
});

// UNSAFE: Intentionally vulnerable to IDOR (Insecure Direct Object Reference)
// No authentication check - anyone can access any note by ID
router.get('/:id', (req, res) => {
  const db = getDb();
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }
  res.json(note);
});

// UNSAFE: Intentionally vulnerable - no input validation, no sanitization
router.post('/', (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const db = getDb();
  const result = db.prepare('INSERT INTO notes (title, content) VALUES (?, ?)').run(title, content);
  res.status(201).json({ id: result.lastInsertRowid, title, content });
});

// UNSAFE: Intentionally vulnerable - no ownership check (IDOR)
router.put('/:id', (req, res) => {
  const { title, content } = req.body;
  const db = getDb();
  db.prepare('UPDATE notes SET title = ?, content = ? WHERE id = ?').run(title, content, req.params.id);
  res.json({ success: true });
});

// UNSAFE: Intentionally vulnerable - no ownership check (IDOR)
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
