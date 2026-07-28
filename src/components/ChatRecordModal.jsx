import React, { useState } from 'react';
import { X, MessageSquare, Send, Sparkles, Check, Bot, User } from 'lucide-react';
import { analyzeMealTextWithAI } from '../shared_modules/ai/nutritionAiService';

export default function ChatRecordModal({
  isOpen,
  onClose,
  onSaveMeal,
  apiKeys,
  selectedDate
}) {
  if (!isOpen) return null;

  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      sender: 'bot',
      text: 'こんにちは！食べた食事を自由に入力してください。（例：「昼食に和風ハンバーグとご飯小盛り、サラダを食べた」）'
    }
  ]);

  const [previewParsedData, setPreviewParsedData] = useState(null);
  const [mealType, setMealType] = useState('lunch');

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isProcessing) return;

    const userText = inputMessage.trim();
    setInputMessage('');
    setIsProcessing(true);

    // ユーザー発言追加
    setChatHistory(prev => [...prev, { sender: 'user', text: userText }]);

    try {
      const res = await analyzeMealTextWithAI({
        textInput: userText,
        geminiApiKey: apiKeys.geminiKey,
        deepSeekApiKey: apiKeys.deepSeekKey
      });

      setPreviewParsedData(res);

      setChatHistory(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `「${res.mealName}」の栄養価を算出しました。確認して「食事記録を保存」を押してください。`
        }
      ]);
    } catch (err) {
      setChatHistory(prev => [
        ...prev,
        {
          sender: 'bot',
          text: '申し訳ありません。解析に失敗しました: ' + err.message
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!previewParsedData) return;

    const mealData = {
      date: selectedDate,
      mealType,
      name: previewParsedData.mealName || 'チャット入力食事',
      calories: previewParsedData.calories || 0,
      protein: previewParsedData.protein || 0,
      fat: previewParsedData.fat || 0,
      carbs: previewParsedData.carbs || 0,
      sodium: previewParsedData.sodium || 0,
      memo: 'チャット記録よりAI自動分解'
    };

    await onSaveMeal(mealData);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(5, 8, 16, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        position: 'relative'
      }}>
        {/* 閉じるボタン */}
        <button onClick={onClose} className="btn-secondary" style={{ position: 'absolute', top: '16px', right: '16px', padding: '8px' }}>
          <X size={20} />
        </button>

        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare color="#06b6d4" size={22} />
            <span>チャットで栄養記録</span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>食べたものを文章で送るだけでAIが栄養価を算出します</p>
        </div>

        {/* タイムライン */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: '220px',
          maxHeight: '340px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: '16px'
        }}>
          {chatHistory.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '10px',
                alignSelf: item.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%'
              }}
            >
              {item.sender === 'bot' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={18} color="#fff" />
                </div>
              )}

              <div style={{
                background: item.sender === 'user' ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(30, 41, 59, 0.9)',
                color: '#fff',
                padding: '10px 14px',
                borderRadius: item.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                fontSize: '0.9rem',
                lineHeight: 1.4,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}>
                {item.text}
              </div>

              {item.sender === 'user' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={18} color="#fff" />
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Sparkles size={16} className="animate-spin" />
              <span>AIが栄養価を計算中...</span>
            </div>
          )}
        </div>

        {/* プレビュー結果カード */}
        {previewParsedData && (
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select value={mealType} onChange={(e) => setMealType(e.target.value)} className="input-field" style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}>
                  <option value="breakfast">朝食</option>
                  <option value="lunch">昼食</option>
                  <option value="dinner">夕食</option>
                  <option value="snack">間食</option>
                </select>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{previewParsedData.mealName}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center', fontSize: '0.85rem', marginBottom: '12px' }}>
              <div>エネルギー: <strong>{previewParsedData.calories}</strong>kcal</div>
              <div>P: <strong>{previewParsedData.protein}</strong>g</div>
              <div>F: <strong>{previewParsedData.fat}</strong>g</div>
              <div>C: <strong>{previewParsedData.carbs}</strong>g</div>
            </div>

            <button onClick={handleConfirmSave} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
              <Check size={16} />
              <span>この内容で本日の食事に記録</span>
            </button>
          </div>
        )}

        {/* テキスト入力フォーム */}
        <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="食べた食事を自由に入力..."
            className="input-field"
            disabled={isProcessing}
          />
          <button type="submit" className="btn-primary" disabled={isProcessing || !inputMessage.trim()} style={{ padding: '12px 18px' }}>
            <Send size={18} />
          </button>
        </form>

      </div>
    </div>
  );
}
