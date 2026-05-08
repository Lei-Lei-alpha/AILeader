'use client';

import React, { useState, useEffect } from 'react';
import {
  FolderPlus,
  FileText,
  Trash2,
  Menu,
  Plus,
  ChevronDown,
  ChevronRight,
  Settings,
  Calendar,
  BarChart2,
  Telescope,
  Database,
  Loader,
  GitBranch,
} from 'lucide-react';
import styles from '@/app/page.module.css';
import type { Note } from '@/lib/types';

interface SidebarProps {
  notes: Note[];
  folders: string[];
  activeNote: Note | null;
  sidebarCollapsed: boolean;
  author: string;
  projectFolders: Set<string>;
  indexingFolder: string | null;
  onSelectNote: (note: Note) => void;
  onSidebarCollapse: (collapsed: boolean) => void;
  onFolderAdded: () => void;
  onFolderDeleted: (folder: string) => void;
  onNoteCreated: () => void;
  onOpenDashboard: () => void;
  onAIPlan: (folder: string) => void;
  onOpenSettings: () => void;
  onIndexFolder: (folder: string) => void;
  onOpenPipeline: (folder: string) => void;
}

export default function Sidebar({
  notes,
  folders,
  activeNote,
  sidebarCollapsed,
  author,
  projectFolders,
  indexingFolder,
  onSelectNote,
  onSidebarCollapse,
  onFolderAdded,
  onFolderDeleted,
  onNoteCreated,
  onOpenDashboard,
  onAIPlan,
  onOpenSettings,
  onIndexFolder,
  onOpenPipeline,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Note[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // Add Folder modal
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState('');

  // Create Note modal
  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [targetFolder, setTargetFolder] = useState('');
  const [newNoteName, setNewNoteName] = useState('');

  useEffect(() => {
    const id = setTimeout(() => {
      if (searchQuery.trim()) performSearch(searchQuery);
      else setSearchResults([]);
    }, 400);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/notes/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      /* ignore */
    } finally {
      setIsSearching(false);
    }
  };

  const toggleFolder = (folder: string) =>
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      next.has(folder) ? next.delete(folder) : next.add(folder);
      return next;
    });

  const handleAddFolder = async () => {
    if (!newFolderPath) return;
    await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: newFolderPath }),
    });
    setIsAddFolderOpen(false);
    setNewFolderPath('');
    onFolderAdded();
  };

  const handleDeleteFolder = async (folderPath: string) => {
    await fetch('/api/folders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath }),
    });
    onFolderDeleted(folderPath);
  };

  const handleCreateNote = async () => {
    if (!newNoteName.trim() || !targetFolder) return;
    const res = await fetch('/api/notes/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: targetFolder, filename: newNoteName, author }),
    });
    if (res.ok) {
      setIsCreateNoteOpen(false);
      onNoteCreated();
    }
  };

  const openCreateNote = (folder: string) => {
    setTargetFolder(folder);
    setNewNoteName('');
    setIsCreateNoteOpen(true);
  };

  const groupedNotes: Record<string, Note[]> = {};
  for (const note of notes) {
    if (!groupedNotes[note.folder]) groupedNotes[note.folder] = [];
    groupedNotes[note.folder].push(note);
  }

  return (
    <>
      {/* ── Sidebar panel ─────────────────────────────────────────────── */}
      <aside className={`${styles.sidebar} ${styles.sidebarOpen} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
        {/* Header */}
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <Telescope size={22} />
            {!sidebarCollapsed && <><span>Research</span>Mentor</>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => onSidebarCollapse(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              {sidebarCollapsed ? <ChevronRight size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className={styles.searchContainer}>
          {!sidebarCollapsed && (
            <input
              type="text"
              placeholder="Search notes..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          )}
        </div>

        {/* Folder list */}
        <div className={styles.foldersList}>
          {!sidebarCollapsed && (
            <button
              className={styles.editBtn}
              style={{ width: '90%', margin: '0 auto 15px', display: 'flex', justifyContent: 'center', background: 'rgba(139,92,246,0.1)', color: 'var(--accent-base)' }}
              onClick={onOpenDashboard}
            >
              <BarChart2 size={16} /> Global Dashboard
            </button>
          )}

          {/* Search results */}
          {searchQuery && (
            <div className={styles.folderSection}>
              <div className={styles.folderTitle}><span>Search Results</span></div>
              {isSearching ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Searching...</div>
              ) : searchResults.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No results.</div>
              ) : (
                searchResults.map((note) => (
                  <div
                    key={note.path}
                    className={`${styles.noteItem} ${activeNote?.path === note.path ? styles.active : ''}`}
                    onClick={() => onSelectNote(note)}
                    style={{ alignItems: 'flex-start', flexDirection: 'column' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                      <FileText size={16} className={styles.fileIcon} />
                      <span className={styles.noteName}>{note.relativePath}</span>
                    </div>
                    {note.snippet && <div className={styles.searchSnippet}>{note.snippet}</div>}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Folder tree — driven by the registered folders list so empty folders still appear */}
          {!searchQuery && folders.map((folder) => {
            const folderNotes = groupedNotes[folder] || [];
            const folderName = folder.split(/[/\\]/).pop() || folder;
            const hasMeta = projectFolders.has(folder);
            return (
              <div key={folder} className={styles.folderSection}>
                <div className={styles.folderTitle}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', flex: 1, overflow: 'hidden' }}
                    onClick={() => toggleFolder(folder)}
                  >
                    {collapsedFolders.has(folder) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    {!sidebarCollapsed && (
                      <span title={folder} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {folderName}
                      </span>
                    )}
                    {hasMeta && !sidebarCollapsed && (
                      <span title="Research project" style={{ fontSize: '0.6rem', background: 'rgba(139,92,246,0.2)', color: 'var(--accent-base)', padding: '1px 5px', borderRadius: '3px', flexShrink: 0 }}>
                        RM
                      </span>
                    )}
                  </div>
                  {!sidebarCollapsed && (
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      <button onClick={() => openCreateNote(folder)} title="New Note" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => onIndexFolder(folder)}
                        title="Index project files with AI"
                        disabled={indexingFolder === folder}
                        style={{ background: 'none', border: 'none', cursor: indexingFolder === folder ? 'wait' : 'pointer', color: indexingFolder === folder ? 'var(--accent-base)' : 'var(--text-secondary)' }}
                      >
                        {indexingFolder === folder
                          ? <Loader size={14} style={{ animation: 'spinAi 1s linear infinite' }} />
                          : <Database size={14} />
                        }
                      </button>
                      {hasMeta && (
                        <button
                          onClick={() => onOpenPipeline(folder)}
                          title="Open Research Pipeline"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }}
                        >
                          <GitBranch size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDeleteFolder(folder)} title="Remove Folder" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {!collapsedFolders.has(folder) && folderNotes.map((note) => (
                  <div
                    key={note.path}
                    className={`${styles.noteItem} ${activeNote?.path === note.path ? styles.active : ''}`}
                    onClick={() => onSelectNote(note)}
                  >
                    <FileText size={16} className={styles.fileIcon} />
                    {!sidebarCollapsed && (
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {note.relativePath}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          {folders.length === 0 && !searchQuery && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
              No notes found.<br />Add a folder below.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.sidebarFooter}>
          <button
            className={styles.addBtn}
            onClick={() => onAIPlan(activeNote?.folder || folders[0] || '')}
            title="AI Research Plan"
            style={{ marginBottom: '0.5rem', backgroundColor: 'var(--accent-base)', color: 'white' }}
          >
            <Calendar size={18} /> {!sidebarCollapsed && 'AI Plan'}
          </button>
          <button
            className={styles.addBtn}
            onClick={onOpenSettings}
            title="Settings"
            style={{ marginBottom: '0.5rem' }}
          >
            <Settings size={18} /> {!sidebarCollapsed && 'Settings'}
          </button>
          <button className={styles.addBtn} onClick={() => setIsAddFolderOpen(true)}>
            <FolderPlus size={18} /> {!sidebarCollapsed && 'Add Folder'}
          </button>
        </div>
      </aside>

      {/* ── Add Folder modal ──────────────────────────────────────────── */}
      {isAddFolderOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsAddFolderOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Add Research Folder</h3>
            <p>Enter the absolute path to your folder containing research files.</p>
            <input
              type="text"
              placeholder="/mnt/d/research/MyProject"
              value={newFolderPath}
              onChange={(e) => setNewFolderPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setIsAddFolderOpen(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleAddFolder}>Add Folder</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Note modal ─────────────────────────────────────────── */}
      {isCreateNoteOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsCreateNoteOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>New Research Note</h3>
            <p>Adding to <strong>{targetFolder.split(/[/\\]/).pop()}</strong>.</p>
            <input
              type="text"
              placeholder="e.g. Experiment Results"
              value={newNoteName}
              onChange={(e) => setNewNoteName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateNote()}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setIsCreateNoteOpen(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleCreateNote}>Create</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
