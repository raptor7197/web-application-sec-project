import React, { useState, useEffect, useCallback } from 'react';
import api from './api';
import NoteForm from './components/NoteForm';
import NoteList from './components/NoteList';

export default function App() {
  const [notes, setNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [lastScanResult, setLastScanResult] = useState(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getNotes();
      setNotes(data);
    } catch (err) {
      setError('Failed to fetch notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleCreate = async (title, content) => {
    setError(null);
    try {
      await api.createNote(title, content);
      await fetchNotes();
      setActiveTab('all');
    } catch (err) {
      setError('Failed to create note');
    }
  };

  const handleDelete = async (id) => {
    setError(null);
    try {
      await api.deleteNote(id);
      await fetchNotes();
    } catch (err) {
      setError('Failed to delete note');
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.searchNotes(searchQuery);
      setSearchResults(data);
    } catch (err) {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>
            <span className="logo-icon">📝</span>
            SecureNotes
          </h1>
          <p className="subtitle">DevSecOps Pipeline Demo — Notes Application</p>
          <div className="scan-badges">
            <span className="badge badge-sast">🔍 SAST</span>
            <span className="badge badge-dast">🌐 DAST</span>
            <span className="badge badge-sca">📦 SCA</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <span>⚠️</span> {error}
            <button onClick={() => setError(null)} className="dismiss-btn">×</button>
          </div>
        )}

        <div className="app-layout">
          <div className="sidebar">
            <NoteForm onSubmit={handleCreate} />

            <div className="search-section">
              <h3>🔎 Search Notes</h3>
              <form onSubmit={handleSearch}>
                <div className="search-input-group">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notes..."
                    className="search-input"
                  />
                  <button type="submit" className="btn btn-search" disabled={loading}>
                    {loading ? '...' : 'Go'}
                  </button>
                </div>
              </form>
              {searchResults && (
                <div className="search-meta">
                  Found {searchResults.results?.length || 0} result(s)
                  <button className="btn-link" onClick={() => setSearchResults(null)}>Clear</button>
                </div>
              )}
            </div>

            <div className="info-panel">
              <h3>ℹ️ About This Demo</h3>
              <ul>
                <li>This app contains <strong>intentional vulnerabilities</strong></li>
                <li>Renders note content as raw HTML (XSS)</li>
                <li>Search uses string concatenation (SQLi)</li>
                <li>No authentication on any endpoint (IDOR)</li>
              </ul>
            </div>
          </div>

          <div className="content-area">
            <div className="tab-bar">
              <button
                className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => { setActiveTab('all'); setSearchResults(null); }}
              >
                All Notes ({notes.length})
              </button>
              <button
                className={`tab ${activeTab === 'search' ? 'active' : ''}`}
                onClick={() => setActiveTab('search')}
              >
                Search Results
              </button>
            </div>

            <div className="notes-container">
              <NoteList
                notes={searchResults ? searchResults.results : notes}
                loading={loading}
                onDelete={handleDelete}
                isSearchResult={!!searchResults}
              />
            </div>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>DevSecOps Pipeline Demo — Intentionally Vulnerable for Educational Purposes</p>
          <p className="footer-tech">
            Built with React + Vite · Express + SQLite · Semgrep · CodeQL · OWASP ZAP · npm audit · OWASP Dependency-Check
          </p>
        </div>
      </footer>
    </div>
  );
}
