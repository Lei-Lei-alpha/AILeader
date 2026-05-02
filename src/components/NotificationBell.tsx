'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertCircle, Clock, X } from 'lucide-react';
import styles from '@/app/page.module.css';
import type { ProgressNotification } from '@/lib/types';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<ProgressNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60000 * 5); // every 5 mins
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
      if (res.ok && data.notifications) {
        setNotifications(data.notifications);
        if (data.notifications.length > 0) setHasNew(true);
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => { setIsOpen(!isOpen); setHasNew(false); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: hasNew ? 'var(--accent-base)' : 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '8px', borderRadius: '50%',
          transition: 'all 0.2s',
        }}
        title="Deadlines & Alerts"
      >
        <Bell size={20} />
        {notifications.length > 0 && (
          <span style={{
            position: 'absolute', top: '5px', right: '5px',
            background: '#ef4444', color: 'white', fontSize: '0.6rem',
            padding: '1px 4px', borderRadius: '10px', fontWeight: 700,
            border: '2px solid var(--bg-sidebar)',
          }}>
            {notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '8px',
          width: '320px', maxHeight: '400px', overflowY: 'auto',
          background: 'rgba(30,30,34,0.95)', backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-color)', borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 1000,
          padding: '12px 0',
        }}>
          <div style={{ padding: '0 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Recent Alerts</span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No upcoming deadlines.
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} style={{
                padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', gap: '10px', transition: 'background 0.2s',
                cursor: 'default',
              }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <div style={{ color: n.message.includes('OVERDUE') ? '#ef4444' : '#f59e0b', marginTop: '2px' }}>
                  {n.message.includes('OVERDUE') ? <AlertCircle size={16} /> : <Clock size={16} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {new Date(n.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
