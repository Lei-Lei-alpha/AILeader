'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Clock, AlertCircle, Circle, Send, Loader } from 'lucide-react';
import styles from '@/app/page.module.css';
import type { ResearchMilestone, SMARTGoal, MilestoneStatus } from '@/lib/types';

interface MilestoneDetailPanelProps {
  milestone: ResearchMilestone;
  goal: SMARTGoal | undefined;
  folder: string;
  onClose: () => void;
  onSave: (milestoneUpdates: Partial<ResearchMilestone>, goalUpdates?: Partial<SMARTGoal>) => Promise<void>;
  onAskMentor: (question: string) => void;
}

const STATUS_ICONS: Record<MilestoneStatus, React.ReactNode> = {
  pending: <Circle size={14} />,
  in_progress: <Clock size={14} style={{ color: '#f59e0b' }} />,
  completed: <CheckCircle2 size={14} style={{ color: '#10b981' }} />,
  blocked: <AlertCircle size={14} style={{ color: '#ef4444' }} />,
};

const STATUS_OPTIONS: MilestoneStatus[] = ['pending', 'in_progress', 'completed', 'blocked'];

export default function MilestoneDetailPanel({
  milestone,
  goal,
  folder,
  onClose,
  onSave,
  onAskMentor,
}: MilestoneDetailPanelProps) {
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description);
  const [dueDate, setDueDate] = useState(milestone.dueDate);
  const [status, setStatus] = useState<MilestoneStatus>(milestone.status);
  const [isSaving, setIsSaving] = useState(false);
  const [mentorQ, setMentorQ] = useState('');

  // Reset when milestone changes
  useEffect(() => {
    setTitle(milestone.title);
    setDescription(milestone.description);
    setDueDate(milestone.dueDate);
    setStatus(milestone.status);
  }, [milestone.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(
        { title, description, dueDate, status },
        goal ? { status: status === 'completed' ? 'done' : 'pending' } : undefined
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAsk = () => {
    if (!mentorQ.trim()) return;
    onAskMentor(`Regarding milestone "${milestone.title}":\n${mentorQ}`);
    setMentorQ('');
  };

  const handleCreateGoal = async () => {
    const newGoal: any = {
      title: `Goal for ${milestone.title}`,
      specific: 'What exactly will be done?',
      measurable: 'How will you measure success?',
      achievable: 'Why is this feasible?',
      relevant: 'How does this advance the research?',
      timeBound: milestone.dueDate,
      status: 'pending',
      priority: 3,
      milestoneId: milestone.id,
    };
    await onSave({}, newGoal);
  };

  return (
    <>
      <div className={styles.milestoneDetailHeader}>
        <div className={styles.milestoneDetailTitle}>{milestone.title}</div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
        >
          <X size={16} />
        </button>
      </div>

      <div className={styles.milestoneDetailBody}>
        {/* Status */}
        <div>
          <div className={styles.detailLabel}>Status</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 10px', borderRadius: '6px', fontSize: '0.78rem',
                  border: `1px solid ${status === s ? 'var(--accent-base)' : 'var(--border-color)'}`,
                  background: status === s ? 'rgba(139,92,246,0.1)' : 'transparent',
                  color: status === s ? 'var(--accent-base)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {STATUS_ICONS[s]}
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <div className={styles.detailLabel}>Title</div>
          <input
            className={styles.detailInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Due Date */}
        <div>
          <div className={styles.detailLabel}>Due Date</div>
          <input
            type="date"
            className={styles.detailInput}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <div className={styles.detailLabel}>Description</div>
          <textarea
            className={styles.detailInput}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* SMART Goal */}
        {goal ? (
          <div>
            <div className={styles.detailLabel}>SMART Goal</div>
            <div className={styles.smartGoalBox}>
              {(
                [
                  ['S', 'Specific', goal.specific],
                  ['M', 'Measurable', goal.measurable],
                  ['A', 'Achievable', goal.achievable],
                  ['R', 'Relevant', goal.relevant],
                  ['T', 'Time-Bound', goal.timeBound],
                ] as [string, string, string][]
              ).map(([key, label, val]) => (
                <div key={key} className={styles.smartRow}>
                  <span className={styles.smartKey}>{key} — {label}</span>
                  <span className={styles.smartVal}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className={styles.detailLabel}>SMART Goal</div>
            <button
              onClick={handleCreateGoal}
              style={{
                width: '100%', padding: '8px', background: 'rgba(139,92,246,0.05)',
                color: 'var(--accent-base)', border: '1px dashed rgba(139,92,246,0.3)',
                borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem',
              }}
            >
              + Create SMART Goal
            </button>
          </div>
        )}

        {/* Ask Mentor */}
        <div>
          <div className={styles.detailLabel}>Ask Mentor</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              className={styles.detailInput}
              style={{ flex: 1, resize: 'none' }}
              placeholder="e.g. What should I prioritise first?"
              value={mentorQ}
              onChange={(e) => setMentorQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            />
            <button
              onClick={handleAsk}
              disabled={!mentorQ.trim()}
              style={{
                padding: '7px 10px', background: 'var(--accent-base)', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer', flexShrink: 0,
                opacity: mentorQ.trim() ? 1 : 0.4,
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            width: '100%', padding: '9px', background: 'var(--accent-base)', color: 'white',
            border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 600,
            fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          {isSaving ? <Loader size={14} style={{ animation: 'spinAi 1s linear infinite' }} /> : null}
          Save Changes
        </button>
      </div>
    </>
  );
}
