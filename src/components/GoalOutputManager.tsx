'use client';

import React, { useState } from 'react';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import styles from '@/app/page.module.css';
import type { PublicationTarget, PublicationStatus, OutputType } from '@/lib/types';

interface GoalOutputManagerProps {
  targets: PublicationTarget[];
  folder: string;
  onUpdate: (id: string, updates: Partial<PublicationTarget>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAdd: (target: Omit<PublicationTarget, 'projectId'>) => Promise<void>;
}

const STATUS_LABELS: Record<PublicationStatus, string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  under_review: 'Under Review',
  accepted: 'Accepted',
  published: 'Published',
  rejected: 'Rejected',
};

const STATUS_CLASS: Record<PublicationStatus, string> = {
  planning: styles.statusPending,
  in_progress: styles.statusInProgress,
  submitted: styles.statusSubmitted,
  under_review: styles.statusUnderReview,
  accepted: styles.statusAccepted,
  published: styles.statusPublished,
  rejected: styles.statusRejected,
};

const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  journal_paper: 'Journal Paper',
  conference_paper: 'Conference Paper',
  dataset: 'Dataset',
  grant: 'Grant',
  thesis_chapter: 'Thesis Chapter',
  preprint: 'Preprint',
};

function generateId() {
  return Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

export default function GoalOutputManager({
  targets,
  folder,
  onUpdate,
  onDelete,
  onAdd,
}: GoalOutputManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [newType, setNewType] = useState<OutputType>('journal_paper');
  const [newDeadline, setNewDeadline] = useState('');

  const handleAdd = async () => {
    if (!newTitle.trim() || !newVenue.trim()) return;
    await onAdd({
      id: generateId(),
      outputType: newType,
      title: newTitle.trim(),
      targetVenue: newVenue.trim(),
      deadline: newDeadline || undefined,
      status: 'planning',
      notes: '',
    });
    setNewTitle('');
    setNewVenue('');
    setNewDeadline('');
    setIsAdding(false);
  };

  return (
    <div className={styles.goalOutputSection}>
      <div className={styles.goalOutputSectionTitle}>
        <ExternalLink size={12} /> Publication Targets
      </div>

      {targets.length === 0 && !isAdding && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          No publication targets yet. Generate the pipeline or add one manually.
        </p>
      )}

      {targets.map((t) => (
        <div key={t.id} className={styles.pubTargetCard}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.pubTargetVenue} style={{ marginBottom: '2px' }}>{t.targetVenue}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.title}
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`${styles.pubTargetStatus} ${STATUS_CLASS[t.status]}`}>
                  {STATUS_LABELS[t.status]}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {OUTPUT_TYPE_LABELS[t.outputType]}
                </span>
                {t.impactFactor && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    IF: {t.impactFactor}
                  </span>
                )}
                {t.deadline && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    Due: {t.deadline}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => onDelete(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', flexShrink: 0 }}
              title="Remove target"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {/* Status selector */}
          <select
            value={t.status}
            onChange={(e) => onUpdate(t.id, { status: e.target.value as PublicationStatus })}
            style={{
              marginTop: '6px', width: '100%', padding: '4px 6px', fontSize: '0.75rem',
              background: 'var(--bg-main)', border: '1px solid var(--border-color)',
              borderRadius: '5px', color: 'var(--text-secondary)',
            }}
          >
            {(Object.keys(STATUS_LABELS) as PublicationStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      ))}

      {isAdding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-elevated)', padding: '10px', borderRadius: '7px', border: '1px solid var(--border-color)' }}>
          <input
            className={styles.detailInput}
            placeholder="Paper title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <input
            className={styles.detailInput}
            placeholder="Target journal / conference..."
            value={newVenue}
            onChange={(e) => setNewVenue(e.target.value)}
          />
          <select
            className={styles.detailInput}
            value={newType}
            onChange={(e) => setNewType(e.target.value as OutputType)}
          >
            {(Object.keys(OUTPUT_TYPE_LABELS) as OutputType[]).map((t) => (
              <option key={t} value={t}>{OUTPUT_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <input
            type="date"
            className={styles.detailInput}
            value={newDeadline}
            onChange={(e) => setNewDeadline(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setIsAdding(false)}
              style={{ flex: 1, padding: '6px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || !newVenue.trim()}
              style={{ flex: 1, padding: '6px', background: 'var(--accent-base)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, opacity: newTitle.trim() && newVenue.trim() ? 1 : 0.4 }}
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px', width: '100%',
            padding: '7px 10px', background: 'rgba(139,92,246,0.07)', color: 'var(--accent-base)',
            border: '1px dashed rgba(139,92,246,0.3)', borderRadius: '6px',
            cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500,
          }}
        >
          <Plus size={13} /> Add Target
        </button>
      )}
    </div>
  );
}
