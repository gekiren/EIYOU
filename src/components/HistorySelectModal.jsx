import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Utensils, Sun, Moon, Coffee, RotateCcw, Clock, Star } from 'lucide-react';
import { nutritionDb } from '../shared_modules/db/nutritionDb.js';

export default function HistorySelectModal({ selectedDate, onClose, onSave, onFavoriteToggled }) {
  const [allLogs, setAllLogs] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('favorites'); // 'favorites' | 'recent' | 'frequent' | 'breakfast' | 'lunch' | 'dinner' | 'snack'
  const [targetMealType, setTargetMealType] = useState('lunch');
  const [addedItemIds, setAddedItemIds] = useState(new Set());

  const loadData = async () => {
    setLoading(true);
    try {
      const [logs, favs] = await Promise.all([
        nutritionDb.getAllMealLogs(),
        nutritionDb.getFavorites()
      ]);
      setAllLogs(logs || []);
      setFavorites(favs || []);
      // お気に入りが空の場合はデフォルトを 'recent' にする
      if ((!favs || favs.length === 0) && activeTab === 'favorites') {
        setActiveTab('recent');
      }
    } catch (err) {
      console.error('Failed to fetch past meal logs or favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isFavoriteItem = (name) => {
    if (!name || !favorites) return false;
    const n = name.trim().toLowerCase();
    return favorites.some((f) => (f.name || '').trim().toLowerCase() === n);
  };

  const handleToggleFavorite = async (item) => {
    await nutritionDb.toggleFavorite(item);
    await loadData();
    if (onFavoriteToggled) onFavoriteToggled();
  };

  // 食事タイプ別アイコン・カラー
  const getMealTypeBadge = (type) => {
    switch (type) {
      case 'breakfast':
        return { label: '朝食', icon: <Sun size={12} color="#f59e0b" />, color: '#f59e0b' };
      case 'lunch':
        return { label: '昼食', icon: <Utensils size={12} color="#10b981" />, color: '#10b981' };
      case 'dinner':
        return { label: '夕食', icon: <Moon size={12} color="#3b82f6" />, color: '#3b82f6' };
      case 'snack':
      default:
        return { label: '間食', icon: <Coffee size={12} color="#ec4899" />, color: '#ec4899' };
    }
  };

  // よく食べるメニュー（料理名ごとの出現頻度・最新の栄養価をベースに集約）
  const getFrequentItems = () => {
    const map = new Map();
    allLogs.forEach((item) => {
      const key = (item.name || '').trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          count: 1,
          sample: item
        });
      } else {
        const existing = map.get(key);
        existing.count += 1;
        if (new Date(item.createdAt || item.date) > new Date(existing.sample.createdAt || existing.sample.date)) {
          existing.sample = item;
        }
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .map((entry) => ({ ...entry.sample, frequentCount: entry.count }));
  };

  // フィルタリング処理
  const getFilteredLogs = () => {
    let list = [];
    if (activeTab === 'favorites') {
      list = favorites;
    } else if (activeTab === 'frequent') {
      list = getFrequentItems();
    } else if (['breakfast', 'lunch', 'dinner', 'snack'].includes(activeTab)) {
      list = allLogs.filter((log) => log.mealType === activeTab);
    } else {
      // 'recent'
      list = allLogs;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.memo && item.memo.toLowerCase().includes(q))
      );
    }

    return list;
  };

  const filteredLogs = getFilteredLogs();

  const handleAddMeal = async (item) => {
    const newMealData = {
      date: selectedDate,
      mealType: targetMealType,
      name: item.name,
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      fat: Number(item.fat) || 0,
      carbs: Number(item.carbs) || 0,
      sodium: Number(item.sodium) || 0,
      fiber: Number(item.fiber) || 0,
      photoUrl: item.photoUrl || '',
      memo: item.memo ? `(履歴/お気に入りより追加) ${item.memo}` : '履歴/お気に入りより追加'
    };

    await onSave(newMealData);

    setAddedItemIds((prev) => new Set(prev).add(item.id || item.name));
    setTimeout(() => {
      setAddedItemIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id || item.name);
        return next;
      });
    }, 1500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgb(30, 41, 59)'
        }}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RotateCcw size={22} color="#3b82f6" />
              <span>履歴・お気に入りから追加</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              お気に入りや過去の記録から選択して「{selectedDate}」に追加します
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* コンテンツエリア */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          {/* 追加先の食事種別選択 */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              追加先の食事区分
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { type: 'breakfast', label: '朝食', icon: <Sun size={14} color="#f59e0b" /> },
                { type: 'lunch', label: '昼食', icon: <Utensils size={14} color="#10b981" /> },
                { type: 'dinner', label: '夕食', icon: <Moon size={14} color="#3b82f6" /> },
                { type: 'snack', label: '間食', icon: <Coffee size={14} color="#ec4899" /> }
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => setTargetMealType(item.type)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: targetMealType === item.type ? '#3b82f6' : 'transparent',
                    background: targetMealType === item.type ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: targetMealType === item.type ? '#fff' : 'var(--text-muted)',
                    fontWeight: targetMealType === item.type ? 700 : 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 検索バー */}
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="お気に入り・過去ログから検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 42px',
                borderRadius: '12px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          {/* タブ切り替え */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[
              { id: 'favorites', label: `⭐ お気に入り (${favorites.length})`, icon: <Star size={13} fill="#f59e0b" color="#f59e0b" /> },
              { id: 'recent', label: '履歴順', icon: <Clock size={13} /> },
              { id: 'frequent', label: 'よく食べる', icon: <Utensils size={13} /> },
              { id: 'breakfast', label: '朝食', icon: <Sun size={13} /> },
              { id: 'lunch', label: '昼食', icon: <Utensils size={13} /> },
              { id: 'dinner', label: '夕食', icon: <Moon size={13} /> },
              { id: 'snack', label: '間食', icon: <Coffee size={13} /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  whiteSpace: 'nowrap',
                  border: 'none',
                  background: activeTab === tab.id ? '#3b82f6' : 'rgba(255, 255, 255, 0.06)',
                  color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* 履歴・お気に入りリスト */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              読み込み中...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <Utensils size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
              <p>
                {activeTab === 'favorites'
                  ? 'お気に入りに登録された食事項目がまだありません。カード右端の「★」で登録できます。'
                  : '該当する過去の食事履歴がありません'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredLogs.map((item, index) => {
                const badge = getMealTypeBadge(item.mealType);
                const isJustAdded = addedItemIds.has(item.id || item.name);
                const isFav = isFavoriteItem(item.name);

                return (
                  <div
                    key={item.id ? `${item.id}-${index}` : index}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: `${badge.color}20`,
                            color: badge.color,
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          {badge.icon}
                          {badge.label}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                          {item.name}
                        </span>
                        {item.frequentCount && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              background: 'rgba(59, 130, 246, 0.3)',
                              color: '#60a5fa',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              fontWeight: 600
                            }}
                          >
                            {item.frequentCount}回記録
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <span>
                          <strong style={{ color: '#fff' }}>{item.calories}</strong> kcal
                        </span>
                        <span>P: {item.protein}g</span>
                        <span>F: {item.fat}g</span>
                        <span>C: {item.carbs}g</span>
                        {item.date && (
                          <span style={{ opacity: 0.7 }}>({item.date})</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => handleToggleFavorite(item)}
                        style={{
                          padding: '8px',
                          borderRadius: '10px',
                          border: isFav ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent',
                          background: isFav ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: isFav ? '#f59e0b' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                        title={isFav ? 'お気に入り解除' : 'お気に入りに追加'}
                      >
                        <Star size={16} fill={isFav ? '#f59e0b' : 'none'} />
                      </button>

                      <button
                        onClick={() => handleAddMeal(item)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          border: 'none',
                          background: isJustAdded
                            ? '#10b981'
                            : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: isJustAdded
                            ? '0 4px 12px rgba(16, 185, 129, 0.4)'
                            : '0 4px 12px rgba(59, 130, 246, 0.3)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Plus size={16} />
                        {isJustAdded ? '追加完了!' : '追加'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
