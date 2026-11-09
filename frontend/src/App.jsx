import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from './api';
import { getNotesView } from './notesView';
import NoteForm from './components/NoteForm';
import NoteList from './components/NoteList';

const detectors = [
  { label: 'Static analysis', tools: 'Semgrep · CodeQL', tag: 'SAST' },
  { label: 'Dependencies', tools: 'npm audit · Dependency-Check', tag: 'SCA' },
  { label: 'Secret detection', tools: 'Gitleaks', tag: 'SECRETS' },
  { label: 'Runtime testing', tools: 'OWASP ZAP', tag: 'DAST' },
];

export default function App() {
  const [notes, setNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [notesLoading, setNotesLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const requestId = useRef(0);

  const fetchNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const data = await api.getNotes();
      setNotes(data);
      setError(null);
    } catch (_err) {
      setError('Could not load notes. Check that the API is running, then retry.');
      throw _err;
    } finally {
      setNotesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes().catch(() => {});
  }, [fetchNotes]);

  const clearSearch = () => {
    requestId.current += 1;
    setSearchResults(null);
    setSearchLoading(false);
    setSearchQuery('');
    setActiveTab('all');
  };

  const handleCreate = async (title, content) => {
    try {
      await api.createNote(title, content);
    } catch (err) {
      setError('Could not save the note. Your draft is still here; please retry.');
      throw err;
    }
    clearSearch();
    await fetchNotes().catch(() => {});
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteNote(id);
      clearSearch();
      await fetchNotes();
    } catch (_err) {
      setError('Could not delete the note. Please retry.');
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      clearSearch();
      return;
    }
    const currentRequest = ++requestId.current;
    setSearchLoading(true);
    setError(null);
    setActiveTab('search');
    try {
      const data = await api.searchNotes(query);
      if (currentRequest === requestId.current) setSearchResults(data);
    } catch (_err) {
      if (currentRequest === requestId.current) setError('Search failed. Try another query.');
    } finally {
      if (currentRequest === requestId.current) setSearchLoading(false);
    }
  };

  const visibleNotes = getNotesView(activeTab, notes, searchResults);

  return (
    <div className="app">
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="Faultline home">
            <span className="brand-mark" aria-hidden="true">F<span>/</span></span>
            <span>FAULTLINE<span className="brand-suffix"> / LAB</span></span>
          </a>
          <div className="header-right">
            <span className="header-context">WEB APPLICATION SECURITY</span>
            <span className="header-status"><span className="status-dot" /> LOCAL DEMO</span>
          </div>
        </div>
      </header>

      <main id="top" className="page-shell">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> THE DEVSECOPS TESTBED <span className="eyebrow-number">/ 001</span></p>
            <h1 id="hero-title">Break things.<br /><em>Find the faultline.</em></h1>
            <p className="hero-description">A deliberately vulnerable notes app built to make security testing tangible. Explore the attack surface, then trace what the pipeline catches.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#workspace">Explore the workspace <span aria-hidden="true">↗</span></a>

              <span className="hero-caption">LOCAL ENVIRONMENT · NOT FOR PRODUCTION</span>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="visual-grid" />
            <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
            <div className="visual-core"><span>F/</span></div>
            <span className="visual-label visual-label-top">ATTACK SURFACE <b>01 / 04</b></span>
            <span className="visual-label visual-label-bottom">OBSERVE → DETECT → LEARN</span>
            <span className="visual-cross cross-one">+</span><span className="visual-cross cross-two">+</span>
          </div>
        </section>

        <div className="warning-strip" role="note">
          <span className="warning-symbol" aria-hidden="true">!</span>
          <p><strong>Intentionally insecure.</strong> XSS, SQL injection, and missing access controls are part of the exercise. Use only on localhost with disposable data.</p>
          <span className="warning-index">LAB NOTICE / 01</span>
        </div>

        <section className="overview" aria-label="Lab overview">
          <div className="overview-card"><span className="overview-index">01 / TARGET</span><strong>Notes application</strong><span>React · Express · SQLite</span></div>
          <div className="overview-card"><span className="overview-index">02 / EXPOSURE</span><strong>3 attack classes</strong><span>XSS · SQLi · IDOR</span></div>
          <div className="overview-card"><span className="overview-index">03 / DETECTION</span><strong>4 scan layers</strong><span>SAST · SCA · Secrets · DAST</span></div>
        </section>

        <section id="workspace" className="workspace" aria-labelledby="workspace-title">
          <div className="section-heading">
            <div><p className="eyebrow">/ INTERACTIVE ENVIRONMENT</p><h2 id="workspace-title">The workspace<span className="heading-period">.</span></h2></div>
            <span className="section-marker">01 — 02</span>
          </div>
          {error && <div className="error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}
          <div className="workspace-grid">
            <aside className="workspace-sidebar" aria-label="Workspace controls">
              <div className="panel-heading"><span className="panel-index">01</span><h3>Actions</h3></div>
              <NoteForm onSubmit={handleCreate} />
              <div className="sidebar-divider" />
              <form className="search-form" onSubmit={handleSearch} role="search">
                <label htmlFor="note-search">Find a note</label>
                <div className="search-input-group"><input id="note-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search titles & content" /><button type="submit" disabled={searchLoading} aria-label="Search notes">↗</button></div>
                <p className="field-hint">Search endpoint contains intentional SQL injection.</p>
              </form>
              <div className="sidebar-divider" />
              <div className="lab-brief"><span className="brief-icon">↗</span><div><strong>Know your environment</strong><p>Content renders as HTML. Never use real credentials or private data here.</p></div></div>
            </aside>
            <div className="notes-panel">
              <div className="notes-toolbar">
                <div className="tabs" aria-label="Note views">
                  <button type="button" className={activeTab === 'all' ? 'tab active' : 'tab'} onClick={() => setActiveTab('all')} aria-pressed={activeTab === 'all'}>All notes <span>{notes.length}</span></button>
                  <button type="button" className={activeTab === 'search' ? 'tab active' : 'tab'} onClick={() => setActiveTab('search')} aria-pressed={activeTab === 'search'}>Search results <span>{searchResults?.results?.length ?? '—'}</span></button>
                </div>
                {activeTab === 'search' && searchResults && <button type="button" className="clear-button" onClick={clearSearch}>Clear search ×</button>}
              </div>
              <div className="notes-body">
                <NoteList notes={visibleNotes} loading={activeTab === 'search' ? searchLoading : notesLoading} onDelete={handleDelete} isSearchResult={activeTab === 'search'} hasSearched={!!searchResults} />
                {error && !notesLoading && activeTab === 'all' && <button type="button" className="retry-button" onClick={() => fetchNotes().catch(() => {})}>Retry loading notes ↗</button>}
              </div>
              <div className="notes-foot"><span>DATA SOURCE / LOCAL SQLITE</span><span>{activeTab === 'search' ? 'SEARCH VIEW' : 'ALL ENTRIES'}</span></div>
            </div>
          </div>
        </section>

        <section className="detection" aria-labelledby="detection-title">
          <div className="section-heading"><div><p className="eyebrow">/ BEHIND THE SCENES</p><h2 id="detection-title">Layers of detection<span className="heading-period">.</span></h2></div><span className="section-marker">02 — 02</span></div>
          <p className="detection-intro">The repository's CI defines these scanners. These are pipeline components, not live scan results.</p>
          <div className="detector-grid">{detectors.map((detector, index) => <div className="detector-card" key={detector.tag}><span className="detector-number">0{index + 1} / {detector.tag}</span><strong>{detector.label}</strong><span>{detector.tools}</span><span className="detector-arrow" aria-hidden="true">↗</span></div>)}</div>
        </section>
      </main>
      <footer className="site-footer"><div><span className="footer-brand">FAULTLINE / LAB</span><p>Built to find weaknesses, not to hide them.</p></div><span>EDUCATIONAL DEMO · RUN LOCALLY ONLY</span></footer>
    </div>
  );
}
