const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'notes.db');
let db = null;

/**
 * Initialize the database synchronously.
 * Must be called once before any route handlers access the DB.
 */
function initDb() {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  seedData();
  return db;
}

/**
 * Get the database synchronously.
 * Assumes initDb() has already been called.
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

function seedData() {
  const count = db.prepare('SELECT COUNT(*) as count FROM notes').get().count;

  if (count === 0) {
    const insert = db.prepare('INSERT INTO notes (title, content) VALUES (?, ?)');
    insert.run('Welcome Note', 'Welcome to the Notes App! This is a demo application.');
    insert.run('Security Best Practices', 'Always sanitize user input to prevent XSS and SQL injection attacks.');
    insert.run('Shopping List', 'Buy milk, eggs, bread, and vegetables.');
    insert.run('Meeting Notes', 'Q3 planning meeting: discuss roadmap, budget, and timelines.');
    insert.run('API Keys', 'REMINDER: Never commit API keys or secrets to version control!');
    insert.run('Hello World', '<script>alert("XSS test")</script>');
    insert.run('Color Note', '<div style="color:red">Red styled content</div>');
  }
}

module.exports = { getDb, initDb };
