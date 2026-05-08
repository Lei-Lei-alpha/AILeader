'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertCircle, Clock, X, CheckCheck } from 'lucide-react';
import type { ProgressNotification } from '@/lib/types';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<ProgressNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/research/notifications');
      const data = await res.json();
      if (res.ok && data.notifications) setNotifications(data.notifications);
    } catch { /* ignore */ }
  };

  const unread = notifications.filter((n) => !n.read);

  const markAllRead = async () => {
    const ids = notifications.map((n) => n.id);
    if (ids.length === 0) return;
    await fetch('/api/research/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readIds: ids }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markOneRead = async (id: string) => {
    await fetch('/api/research/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readIds: [id] }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        title="Deadlines & Alerts"
        style={{
          background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
          color: unread.length > 0 ? '#f59e0b' : 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '8px', borderRadius: '50%', transition: 'all 0.2s',
        }}
      >
        <Bell size={20} />
        {unread.length > 0 && (
          <span style={{
            position: 'absolute', top: '4px', right: '4px',
            background: '#ef4444', color: 'white', fontSize: '0.6rem',
            padding: '1px 4px', borderRadius: '10px', fontWeight: 700,
            border: '2px solid var(--bg-sidebar)', lineHeight: 1.4,
          }}>
            {unread.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '8px',
          width: '340px', maxHeight: '420px', overflowY: 'auto',
          background: 'rgba(22,22,26,0.97)', backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-color)', borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 1000,
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            position: 'sticky', top: 0, background: 'rgba(22,22,26,0.97)',
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
              Alerts {unread.length > 0 && <span style={{ color: '#f59e0b' }}>({unread.length} new)</span>}
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {unread.length > 0 && (
                <button
                  onClick={markAllRead}
                  title="Mark all as read"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem' }}
                >
                  <CheckCheck size={13} /> All read
                </button>
              )}
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No upcoming deadlines.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markOneRead(n.id)}
                style={{
                  padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', gap: '10px', cursor: 'pointer',
                  background: n.read ? 'transparent' : 'rgba(245,158,11,0.04)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={(e) => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(245,158,11,0.04)'}
              >
                <div style={{ color: n.message.includes('OVERDUE') ? '#ef4444' : '#f59e0b', marginTop: '2px', flexShrink: 0 }}>
                  {n.message.includes('OVERDUE') ? <AlertCircle size={15} /> : <Clock size={15} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.78rem', color: n.read ? 'var(--text-muted)' : 'var(--text-primary)',
                    lineHeight: 1.4, fontWeight: n.read ? 400 : 500,
                  }}>
                    {n.message}
                  </div>
                </div>
                {!n.read && (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: '5px' }} />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
