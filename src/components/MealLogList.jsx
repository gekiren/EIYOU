import React from 'react';
import { Trash2, Pencil, Sun, Moon, Coffee, Utensils, Image as ImageIcon, Copy, Star } from 'lucide-react';

export default function MealLogList({ mealLogs, onDeleteMeal, onEditMeal, onAddMeal, favoriteNames = [], onToggleFavorite }) {
  const getMealTypeBadge = (type) => {
    switch (type) {
      case 'breakfast':
        return { label: '朝食', icon: <Sun size={14} color="#f59e0b" />, color: '#f59e0b' };
      case 'lunch':
        return { label: '昼食', icon: <Utensils size={14} color="#10b981" />, color: '#10b981' };
      case 'dinner':
        return { label: '夕食', icon: <Moon size={14} color="#3b82f6" />, color: '#3b82f6' };
      case 'snack':
      default:
        return { label: '間食', icon: <Coffee size={14} color="#ec4899" />, color: '#ec4899' };
    }
  };

  const isFavoriteItem = (name) => {
    if (!name || !favoriteNames) return false;
    const n = name.trim().toLowerCase();
    return favoriteNames.some((f) => (f || '').trim().toLowerCase() === n);
  };

  if (!mealLogs || mealLogs.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Utensils size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <p style={{ fontWeight: 600 }}>この日の食事記録はまだありません</p>
        <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>上の「写真記録」または「チャット記録」ボタンから記録を追加してください</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>本日の食事ログ</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>({mealLogs.length}件)</span>
      </h2>

      {mealLogs.map((log) => {
        const badge = getMealTypeBadge(log.mealType);
        const isFav = isFavoriteItem(log.name);

        return (
          <div key={log.id} className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            
            {/* 左側: サムネイル画像 & タイトル */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '220px', flex: 1 }}>
              {log.photoUrl ? (
                <img
                  src={log.photoUrl}
                  alt={log.name}
                  style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                />
              ) : (
                <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ImageIcon size={24} color="var(--text-muted)" />
                </div>
              )}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: `${badge.color}20`,
                    color: badge.color,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {badge.icon}
                    {badge.label}
                  </span>
                  <span style={{ fontSize: '1rem', fontWeight: 700 }}>{log.name}</span>
                </div>
                
                {log.memo && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.memo}</p>
                )}
              </div>
            </div>

            {/* 中央: 栄養数値 (カロリー & PFC) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>{log.calories}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '2px' }}>kcal</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: '12px' }}>
                <span style={{ color: 'var(--color-protein)', fontWeight: 600 }}>P:{log.protein}g</span>
                <span style={{ color: 'var(--color-fat)', fontWeight: 600 }}>F:{log.fat}g</span>
                <span style={{ color: 'var(--color-carbs)', fontWeight: 600 }}>C:{log.carbs}g</span>
              </div>
            </div>

            {/* 右側: お気に入り & 再追加 & 編集 ＆ 削除ボタン */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {onToggleFavorite && (
                <button
                  onClick={() => onToggleFavorite(log)}
                  className="btn-secondary"
                  style={{
                    padding: '8px',
                    borderRadius: '10px',
                    color: isFav ? '#f59e0b' : 'var(--text-muted)',
                    background: isFav ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: isFav ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent'
                  }}
                  title={isFav ? 'お気に入りから削除' : 'お気に入りに追加'}
                >
                  <Star size={16} fill={isFav ? '#f59e0b' : 'none'} />
                </button>
              )}
              {onAddMeal && (
                <button
                  onClick={() => onAddMeal({
                    name: log.name,
                    mealType: log.mealType,
                    calories: log.calories,
                    protein: log.protein,
                    fat: log.fat,
                    carbs: log.carbs,
                    sodium: log.sodium,
                    photoUrl: log.photoUrl,
                    memo: log.memo
                  })}
                  className="btn-secondary"
                  style={{ padding: '8px', borderRadius: '10px', color: '#10b981' }}
                  title="同じものを追加"
                >
                  <Copy size={16} />
                </button>
              )}
              <button
                onClick={() => onEditMeal && onEditMeal(log)}
                className="btn-secondary"
                style={{ padding: '8px', borderRadius: '10px', color: '#3b82f6' }}
                title="編集"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => onDeleteMeal(log.id)}
                className="btn-secondary"
                style={{ padding: '8px', borderRadius: '10px', color: '#ef4444' }}
                title="削除"
              >
                <Trash2 size={16} />
              </button>
            </div>

          </div>
        );
      })}
    </div>
  );
}
