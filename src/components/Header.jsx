import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Settings, Camera, MessageSquare, Plus } from 'lucide-react';

export default function Header({
  selectedDate,
  onDateChange,
  onOpenPhotoModal,
  onOpenChatModal,
  onOpenSettingsModal
}) {
  const formatDateDisplay = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) return '今日';
    const [y, m, d] = dateStr.split('-');
    return `${m}月${d}日 (${y})`;
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    const today = new Date().toISOString().split('T')[0];
    onDateChange(today);
  };

  return (
    <header className="glass-panel" style={{ padding: '16px 24px', marginBottom: '24px', borderRadius: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* ロゴ・アプリタイトル */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
          }}>
            🥗
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              EIYOU
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AI 栄養記録 & PFC管理</p>
          </div>
        </div>

        {/* 日付コントロール */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '6px 12px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          <button onClick={handlePrevDay} className="btn-secondary" style={{ padding: '6px', borderRadius: '8px' }} title="前日">
            <ChevronLeft size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '130px', justifyContent: 'center' }}>
            <Calendar size={16} color="var(--color-primary)" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <button onClick={handleNextDay} className="btn-secondary" style={{ padding: '6px', borderRadius: '8px' }} title="翌日">
            <ChevronRight size={18} />
          </button>

          {selectedDate !== new Date().toISOString().split('T')[0] && (
            <button onClick={handleToday} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '8px' }}>
              今日
            </button>
          )}
        </div>

        {/* アクションボタン（写真撮影・チャット記録・設定） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onOpenPhotoModal} className="btn-primary">
            <Camera size={18} />
            <span>写真記録 (OCR/AI)</span>
          </button>

          <button onClick={onOpenChatModal} className="btn-secondary">
            <MessageSquare size={18} color="#06b6d4" />
            <span>チャット記録</span>
          </button>

          <button onClick={onOpenSettingsModal} className="btn-secondary" style={{ padding: '10px' }} title="設定・データ入出力">
            <Settings size={18} />
          </button>
        </div>

      </div>
    </header>
  );
}
