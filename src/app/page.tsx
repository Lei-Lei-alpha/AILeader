'use client';

import React, { useState, useEffect } from 'react';
import {
  FolderPlus, 
  FileText, 
  Trash2,
  Menu,
  X,
  BookOpen,
  Plus,
  ChevronDown,
  ChevronRight,
  Edit,
  Save,
  XCircle,
  Settings
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
  
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [targetFolder, setTargetFolder] = useState('');
  const [newNoteName, setNewNoteName] = useState('');
  
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteUnusedFigures, setDeleteUnusedFigures] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    activeNoteRef.current = activeNote;
  }, [activeNote]);

  useEffect(() => {
    fetchFolders();
    fetchNotes();
    fetchSettings();
    
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

  const toggleFolder = (folder: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
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

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setDeleteUnusedFigures(data.deleteUnusedFigures || false);
      if (data.author) setAuthor(data.author);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const updateSettings = async (updates: any) => {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        setDeleteUnusedFigures(data.deleteUnusedFigures || false);
        if (data.author) setAuthor(data.author);
      } else {
        alert('Failed to update settings');
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
      alert('Error updating settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const pollActiveContent = async (note: Note) => {
    if (isEditing) return;
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

  const openCreateNoteModal = (folderPath: string) => {
    setTargetFolder(folderPath);
    setNewNoteName('');
    setIsNoteModalOpen(true);
  };

  const handleCreateNote = async () => {
    if (!newNoteName.trim() || !targetFolder) return;
    try {
      const res = await fetch('/api/notes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: targetFolder, filename: newNoteName, author })
      });
      if (res.ok) {
        setIsNoteModalOpen(false);
        await fetchNotes();
        // Option to automatically switch to the newly created note could be implemented here
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectNote = async (note: Note) => {
    setActiveNote(note);
    setIsEditing(false);
    setContentLoading(true);
    try {
      const res = await fetch(`/api/notes/content?path=${encodeURIComponent(note.path)}`);
      const data = await res.json();
      setActiveContent(data.content || 'Failed to load content');
      setEditedContent(data.content || '');
    } catch (err) {
      setActiveContent('Error loading note');
      setEditedContent('');
    } finally {
      setContentLoading(false);
    }
    // Auto-close sidebar on mobile after selecting a note
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleStartEditing = () => {
    setEditedContent(activeContent);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedContent(activeContent);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!activeNote) return;
    try {
      const res = await fetch('/api/notes/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path: activeNote.path, 
          content: editedContent,
          previousContent: activeContent
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActiveContent(data.content || editedContent);
        setEditedContent(data.content || editedContent);
        setIsEditing(false);
        await fetchNotes(false);
      } else {
        console.error('Save failed:', data.error || 'Unknown');
      }
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement> | React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement> | React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement> | React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!isEditing) {
      alert('Please enter edit mode first');
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => 
      ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'].includes(file.type)
    );

    if (imageFiles.length === 0) {
      alert('Please drag and drop image files (PNG, JPG, GIF, WebP, SVG)');
      return;
    }

    setUploadingImages(true);
    try {
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/notes/upload', {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          // Insert markdown syntax at cursor position or at the end
          const textarea = textareaRef.current;
          if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const beforeText = editedContent.substring(0, start);
            const afterText = editedContent.substring(end);
            const newContent = beforeText + '\n' + data.markdown + '\n' + afterText;
            setEditedContent(newContent);
            
            // Move cursor after inserted text
            setTimeout(() => {
              if (textarea) {
                textarea.focus();
                const newCursorPos = start + data.markdown.length + 2;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
              }
            }, 0);
          }
        } else {
          const error = await res.json();
          alert(`Failed to upload ${file.name}: ${error.error}`);
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload images');
    } finally {
      setUploadingImages(false);
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
                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', flex: 1, overflow: 'hidden' }}
                  onClick={() => toggleFolder(folder)}
                >
                  {collapsedFolders.has(folder) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <span title={folder} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                    {folder.split('/').pop() || folder}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button onClick={() => openCreateNoteModal(folder)} title="New Note">
                    <Plus size={14} />
                  </button>
                  <button onClick={() => handleDeleteFolder(folder)} title="Remove Folder">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {!collapsedFolders.has(folder) && folderNotes.map((note) => (
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
          <button 
            className={styles.addBtn} 
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            style={{ marginBottom: '0.5rem' }}
          >
            <Settings size={18} /> Settings
          </button>
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
                <div className={styles.editorHeader}>
                  {!isEditing ? (
                    <button className={styles.editBtn} onClick={handleStartEditing}>
                      <Edit size={16} />
                      Edit
                    </button>
                  ) : (
                    <div className={styles.editorActions}>
                      <button className={styles.cancelEditBtn} onClick={handleCancelEdit}>
                        <XCircle size={16} />
                        Cancel
                      </button>
                      <button className={styles.saveEditBtn} onClick={handleSaveEdit}>
                        <Save size={16} />
                        Save
                      </button>
                    </div>
                  )}
                </div>
                {isEditing && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    💡 Tip: Drag and drop images to insert them, or use Markdown syntax: <code style={{ background: 'var(--bg-card)', padding: '0.2em 0.4em', borderRadius: '2px' }}>![alt text](/figures/image.png)</code>
                  </div>
                )}
                {isEditing ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    style={{
                      position: 'relative',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}
                  >
                    <textarea
                      ref={textareaRef}
                      className={styles.editorTextarea}
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      style={{
                        borderColor: isDragging ? 'var(--accent-base)' : undefined,
                        borderWidth: isDragging ? '2px' : undefined,
                        boxShadow: isDragging ? '0 0 0 3px rgba(139, 92, 246, 0.1)' : undefined,
                        transition: 'all 200ms ease'
                      }}
                      disabled={uploadingImages}
                    />
                    {isDragging && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(139, 92, 246, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        pointerEvents: 'none',
                        border: '2px dashed var(--accent-base)'
                      }}>
                        <div style={{ textAlign: 'center', color: 'var(--accent-base)', fontWeight: 500 }}>
                          Drop images here to insert
                        </div>
                      </div>
                    )}
                    {uploadingImages && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        pointerEvents: 'none'
                      }}>
                        <div style={{ color: 'white', fontWeight: 500 }}>
                          Uploading images...
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <MarkdownRenderer content={activeContent} />
                )}
              </div>
              <TableOfContents content={isEditing ? editedContent : activeContent} />
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

      {/* Create Note Modal */}
      {isNoteModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsNoteModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>New Lab Note</h3>
            <p>Enter the filename for your new note. It will be added to <strong>{targetFolder.split('/').pop()}</strong>.</p>
            <input 
              type="text" 
              placeholder="e.g. My Next Experiment" 
              value={newNoteName}
              onChange={(e) => setNewNoteName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateNote()}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setIsNoteModalOpen(false)}>
                Cancel
              </button>
              <button className={styles.saveBtn} onClick={handleCreateNote}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsSettingsOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>Settings</h3>
            
            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deleteUnusedFigures}
                  onChange={(e) => {
                    setDeleteUnusedFigures(e.target.checked);
                    updateSettings({ deleteUnusedFigures: e.target.checked });
                  }}
                  disabled={settingsLoading}
                  style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                />
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    Delete Unused Figures
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Automatically remove figure files when they are no longer referenced in any markdown file
                  </div>
                </div>
              </label>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Author Name
              </label>
              <input 
                type="text" 
                placeholder="e.g. Dr. Lab Researcher" 
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                onBlur={() => updateSettings({ author })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setIsSettingsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
