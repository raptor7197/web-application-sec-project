const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const { initDb } = require('./db');
const notesRouter = require('./routes/notes');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Note: helmet is included but not properly configured
// Intentionally weak CSP to allow XSS demonstration
app.use(
  helmet({
    contentSecurityPolicy: false,  // Intentionally disabled
    xssFilter: false,              // Intentionally disabled
  })
);

// API Routes
app.use('/api/notes', notesRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Initialize database
initDb();

app.listen(PORT, () => {
  console.log(`Notes API server running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /api/notes          - List all notes`);
  console.log(`  GET  /api/notes/:id       - Get note by ID`);
  console.log(`  POST /api/notes           - Create a note`);
  console.log(`  GET  /api/notes/search?q= - Search notes (VULNERABLE: SQLi)`);
  console.log(`  PUT  /api/notes/:id       - Update a note`);
  console.log(`  DELETE /api/notes/:id     - Delete a note`);
});
