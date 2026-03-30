'use client';

import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, 
  FileText, 
  Trash2,
  Menu,
  X,
  BookOpen
} from 'lucide-react';
import styles from './page.module.css';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import TableOfContents from '@/components/TableOfContents';

type Note = {
  name: string;
  path: string;
  folder: string;
  relativePath: string;
  size: number;
  lastModified: number;
  createdAt: number;
  snippet?: string;
};

export default function Home() {
  const [folders, setFolders] = useState<string[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [author, setAuthor] = useState<string>('');
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [activeContent, setActiveContent] = useState<string>('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Note[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Ref for polling without stale closures
  const activeNoteRef = React.useRef<Note | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState('');
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    activeNoteRef.current = activeNote;
  }, [activeNote]);

  useEffect(() => {
    fetchFolders();
    fetchNotes();
    
    // Set up polling for sync
    const listInterval = setInterval(() => {
      fetchNotes(false);
    }, 5000); // Poll list every 5s
    
    const contentInterval = setInterval(() => {
      if (activeNoteRef.current) {
        pollActiveContent(activeNoteRef.current);
      }
    }, 1000); // Poll active content every 1s
    
    return () => {
      clearInterval(listInterval);
      clearInterval(contentInterval);
    };
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/notes/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/folders');
      const data = await res.json();
      setFolders(data.folders || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotes = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch('/api/notes');
      const data = await res.json();
      setNotes(data.notes || []);
      if (data.author) setAuthor(data.author);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const pollActiveContent = async (note: Note) => {
    try {
      const res = await fetch(`/api/notes/content?path=${encodeURIComponent(note.path)}`);
      const data = await res.json();
      if (data.content !== undefined) {
        // Only update state if content actually changed to prevent React re-rendering constantly
        setActiveContent((prev) => prev !== data.content ? data.content : prev);
      }
    } catch (err) {
      // Ignore polling errors
    }
  };

  const handleAddFolder = async () => {
    if (!newFolderPath) return;
    try {
      await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: newFolderPath })
      });
      setIsModalOpen(false);
      setNewFolderPath('');
      await fetchFolders();
      await fetchNotes();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFolder = async (folderPath: string) => {
    try {
      await fetch('/api/folders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath })
      });
      if (activeNote?.folder === folderPath) {
        setActiveNote(null);
        setActiveContent('');
      }
      await fetchFolders();
      await fetchNotes();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectNote = async (note: Note) => {
    setActiveNote(note);
    setContentLoading(true);
    try {
      const res = await fetch(`/api/notes/content?path=${encodeURIComponent(note.path)}`);
      const data = await res.json();
      setActiveContent(data.content || 'Failed to load content');
    } catch (err) {
      setActiveContent('Error loading note');
    } finally {
      setContentLoading(false);
    }
    // Auto-close sidebar on mobile after selecting a note
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const groupedNotes = notes.reduce((acc, note) => {
    if (!acc[note.folder]) acc[note.folder] = [];
    acc[note.folder].push(note);
    return acc;
  }, {} as Record<string, Note[]>);

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <aside 
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <BookOpen size={24} />
            <span>Lab</span>Notes
          </div>
          {typeof window !== 'undefined' && window.innerWidth < 768 && (
             <button onClick={() => setSidebarOpen(false)}>
               <X size={20} color="var(--text-secondary)" />
             </button>
          )}
        </div>
        
        <div className={styles.searchContainer}>
          <input 
            type="text" 
            placeholder="Search notes..." 
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.foldersList}>
          {loading && !searchQuery && <div style={{ color: 'var(--text-muted)' }}>Loading...</div>}
          
          {searchQuery && (
            <div className={styles.folderSection}>
              <div className={styles.folderTitle}>
                <span>Search Results</span>
              </div>
              {isSearching ? (
                 <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Searching...</div>
              ) : searchResults.length === 0 ? (
                 <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No results.</div>
              ) : (
                searchResults.map((note) => (
                  <div 
                    key={note.path} 
                    className={`${styles.noteItem} ${activeNote?.path === note.path ? styles.active : ''}`}
                    onClick={() => handleSelectNote(note)}
                    style={{ alignItems: 'flex-start', flexDirection: 'column' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                      <FileText size={16} className={styles.fileIcon} />
                      <span className={styles.noteName}>
                        {note.relativePath}
                      </span>
                    </div>
                    {note.snippet && (
                      <div className={styles.searchSnippet}>
                         {note.snippet}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {!searchQuery && Object.entries(groupedNotes).map(([folder, folderNotes]) => (
            <div key={folder} className={styles.folderSection}>
              <div className={styles.folderTitle}>
                <span title={folder}>{folder.split('/').pop() || folder}</span>
                <button onClick={() => handleDeleteFolder(folder)} title="Remove Folder">
                  <Trash2 size={14} />
                </button>
              </div>
              {folderNotes.map((note) => (
                <div 
                  key={note.path} 
                  className={`${styles.noteItem} ${activeNote?.path === note.path ? styles.active : ''}`}
                  onClick={() => handleSelectNote(note)}
                >
                  <FileText size={16} className={styles.fileIcon} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {note.relativePath}
                  </span>
                </div>
              ))}
            </div>
          ))}
          {!loading && !searchQuery && Object.keys(groupedNotes).length === 0 && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
              No notes found.<br/> Add a folder below.
            </div>
          )}
        </div>

        <div className={styles.sidebarFooter}>
          <button className={styles.addBtn} onClick={() => setIsModalOpen(true)}>
            <FolderPlus size={18} /> Add Folder
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.topbar}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} style={{ marginRight: '1rem', color: 'var(--text-primary)' }}>
              <Menu size={20} />
            </button>
          )}
          <span>{activeNote ? activeNote.relativePath : 'Select a note to read'}</span>
        </div>
        
        <div className={styles.contentWrapper}>
          {contentLoading && (
            <div className={styles.loading}>
              <BookOpen size={32} />
            </div>
          )}
          
          {!contentLoading && activeNote && (
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.noteMeta}>
                  Author: <strong>{author || 'Lab User'}</strong> &ensp;•&ensp; Created on {new Date(activeNote.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <MarkdownRenderer content={activeContent} />
              </div>
              <TableOfContents content={activeContent} />
            </div>
          )}

          {!contentLoading && !activeNote && (
            <div className={styles.emptyState}>
              <BookOpen className={styles.emptyStateIcon} />
              <h2>No Entry Selected</h2>
              <p>Select a note from the sidebar or add a new folder to begin.</p>
            </div>
          )}
        </div>
      </main>

      {/* Add Folder Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>Add Lab Folder</h3>
            <p>Enter the absolute path to your local folder containing .md files.</p>
            <input 
              type="text" 
              placeholder="/Users/lei_lei/Documents/Lab" 
              value={newFolderPath}
              onChange={(e) => setNewFolderPath(e.target.value)}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className={styles.saveBtn} onClick={handleAddFolder}>
                Add Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
