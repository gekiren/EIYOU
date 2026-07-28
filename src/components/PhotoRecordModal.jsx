import React, { useState } from 'react';
import { X, Camera, FileText, Utensils, Sparkles, Check, RefreshCw, ArrowRight } from 'lucide-react';
import { analyzeMealPhoto } from '../shared_modules/ai/nutritionAiService';

export default function PhotoRecordModal({
  isOpen,
  onClose,
  onSaveMeal,
  apiKeys,
  selectedDate
}) {
  if (!isOpen) return null;

  // モード state: 'nutritionLabel' (栄養成分表示) vs 'dishPhoto' (料理写真)
  const [photoMode, setPhotoMode] = useState('nutritionLabel');
  const [imageSrc, setImageSrc] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState('');

  // 解析結果 state
  const [rawParsedData, setRawParsedData] = useState(null);

  // 調整状態 (栄養成分表示モード用)
  // baseServingType: 'percent' (割合%) または 'gram' (グラムg) または 'package' (個/包装)
  const [servingRatio, setServingRatio] = useState(100); // 100% がデフォルト

  // 調整状態 (料理写真モード用)
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [portionMultiplier, setPortionMultiplier] = useState(1.0); // 1.0人前

  // 食事分類 & メモ
  const [mealType, setMealType] = useState('lunch');
  const [customName, setCustomName] = useState('');
  const [memo, setMemo] = useState('');

  // 画像アップロード処理
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target.result);
        setRawParsedData(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // AI & OCR 解析実行
  const handleStartAnalysis = async () => {
    if (!imageSrc) return;
    setIsAnalyzing(true);
    setStatusText('画像を解析しています...');

    try {
      const res = await analyzeMealPhoto({
        base64Image: imageSrc,
        geminiApiKey: apiKeys.geminiKey,
        deepSeekApiKey: apiKeys.deepSeekKey,
        workerProxyUrl: apiKeys.workerUrl,
        onProgress: (msg) => setStatusText(msg)
      });

      setRawParsedData(res);
      setCustomName(res.mealName || (photoMode === 'nutritionLabel' ? '成分表示スキャン品' : '料理写真品'));

      // 料理写真モード用の候補準備
      if (photoMode === 'dishPhoto') {
        const primary = {
          name: res.mealName || '解析料理',
          calories: res.calories || 500,
          protein: res.protein || 20,
          fat: res.fat || 15,
          carbs: res.carbs || 65,
          sodium: res.sodium || 2.0
        };
        setSelectedCandidate(primary);
      }
    } catch (err) {
      alert('解析中にエラーが発生しました: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 計算後の最終栄養価の算出 (成分表示ラベルモード)
  const calcLabelNutrients = () => {
    if (!rawParsedData) return { calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0 };
    const factor = servingRatio / 100;
    return {
      calories: Math.round((rawParsedData.calories || 0) * factor),
      protein: parseFloat(((rawParsedData.protein || 0) * factor).toFixed(1)),
      fat: parseFloat(((rawParsedData.fat || 0) * factor).toFixed(1)),
      carbs: parseFloat(((rawParsedData.carbs || 0) * factor).toFixed(1)),
      sodium: parseFloat(((rawParsedData.sodium || 0) * factor).toFixed(1))
    };
  };

  // 計算後の最終栄養価の算出 (料理写真モード)
  const calcDishNutrients = () => {
    const base = selectedCandidate || rawParsedData || { calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0 };
    const factor = portionMultiplier;
    return {
      calories: Math.round((base.calories || 0) * factor),
      protein: parseFloat(((base.protein || 0) * factor).toFixed(1)),
      fat: parseFloat(((base.fat || 0) * factor).toFixed(1)),
      carbs: parseFloat(((base.carbs || 0) * factor).toFixed(1)),
      sodium: parseFloat(((base.sodium || 0) * factor).toFixed(1))
    };
  };

  const finalNutrients = photoMode === 'nutritionLabel' ? calcLabelNutrients() : calcDishNutrients();

  // 保存ハンドラ
  const handleSave = async () => {
    const mealData = {
      date: selectedDate,
      mealType,
      name: customName || (photoMode === 'nutritionLabel' ? '栄養表示食品' : '記録料理'),
      calories: finalNutrients.calories,
      protein: finalNutrients.protein,
      fat: finalNutrients.fat,
      carbs: finalNutrients.carbs,
      sodium: finalNutrients.sodium,
      photoUrl: imageSrc || '',
      memo: memo || (photoMode === 'nutritionLabel' ? `摂取割合: ${servingRatio}%` : `盛り付け量: ${portionMultiplier}人前`)
    };

    await onSaveMeal(mealData);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
        maxWidth: '680px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '28px',
        position: 'relative'
      }}>
        {/* 閉じるボタン */}
        <button onClick={onClose} className="btn-secondary" style={{ position: 'absolute', top: '20px', right: '20px', padding: '8px' }}>
          <X size={20} />
        </button>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera color="#10b981" size={24} />
            <span>写真による栄養記録</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            栄養成分表示ラベル、または料理写真をアップロードしてAI/OCR解析を行います
          </p>
        </div>

        {/* モード選択タブ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px', background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => setPhotoMode('nutritionLabel')}
            style={{
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              background: photoMode === 'nutritionLabel' ? 'var(--color-primary)' : 'transparent',
              color: photoMode === 'nutritionLabel' ? '#fff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <FileText size={16} />
            <span>栄養成分表示ラベル</span>
          </button>

          <button
            type="button"
            onClick={() => setPhotoMode('dishPhoto')}
            style={{
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              background: photoMode === 'dishPhoto' ? 'var(--color-secondary)' : 'transparent',
              color: photoMode === 'dishPhoto' ? '#fff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <Utensils size={16} />
            <span>料理の写真</span>
          </button>
        </div>

        {/* 写真アップロード領域 */}
        {!imageSrc ? (
          <label style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            border: '2px dashed var(--border-color)',
            borderRadius: '16px',
            cursor: 'pointer',
            background: 'rgba(15, 23, 42, 0.4)',
            marginBottom: '20px',
            transition: 'border 0.2s ease'
          }}>
            <Camera size={40} color="var(--color-primary)" style={{ marginBottom: '12px' }} />
            <span style={{ fontWeight: 600, marginBottom: '4px' }}>画像をアップロードまたはカメラで撮影</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {photoMode === 'nutritionLabel' ? '裏面の栄養成分表示（エネルギー、タンパク質等）を撮影' : '完成した料理の全体写真を撮影'}
            </span>
            <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} style={{ display: 'none' }} />
          </label>
        ) : (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', maxHeight: '220px', border: '1px solid var(--border-color)' }}>
              <img src={imageSrc} alt="撮影画像" style={{ width: '100%', height: '220px', objectFit: 'cover' }} />
              <label style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(15, 23, 42, 0.8)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                border: '1px solid var(--border-color)'
              }}>
                画像を変更
                <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} style={{ display: 'none' }} />
              </label>
            </div>

            {!rawParsedData && !isAnalyzing && (
              <button onClick={handleStartAnalysis} className="btn-primary" style={{ width: '100%', marginTop: '14px', justifyContent: 'center', padding: '14px' }}>
                <Sparkles size={18} />
                <span>{photoMode === 'nutritionLabel' ? 'OCR & AI で成分表示を読み取る' : 'AI で料理と栄養価を特定'}</span>
              </button>
            )}
          </div>
        )}

        {/* 解析中ローディング表示 */}
        {isAnalyzing && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <RefreshCw size={32} className="animate-spin" color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
            <p style={{ fontWeight: 600 }}>{statusText}</p>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* 解析完了後の数値調整UI */}
        {rawParsedData && !isAnalyzing && (
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', background: 'rgba(15, 23, 42, 0.8)' }}>
            
            {/* 食事区分 ＆ 名称調整 */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', marginBottom: '16px' }}>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="input-field"
                style={{ cursor: 'pointer' }}
              >
                <option value="breakfast">朝食</option>
                <option value="lunch">昼食</option>
                <option value="dinner">夕食</option>
                <option value="snack">間食/おやつ</option>
              </select>

              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="食品・料理名を入力"
                className="input-field"
              />
            </div>

            {/* モード別調整スライダー */}
            {photoMode === 'nutritionLabel' ? (
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>食べた量の割合・数値調整</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {servingRatio}% (基準表示の {(servingRatio / 100).toFixed(2)}倍)
                  </span>
                </div>

                <input
                  type="range"
                  min="10"
                  max="300"
                  step="5"
                  value={servingRatio}
                  onChange={(e) => setServingRatio(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer', marginBottom: '12px' }}
                />

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[25, 50, 75, 100, 150, 200].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setServingRatio(val)}
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', background: servingRatio === val ? 'rgba(16, 185, 129, 0.2)' : undefined }}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* 料理写真モード用 盛り付け量倍率 */
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>盛り付け量の調整</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-secondary)' }}>
                    {portionMultiplier.toFixed(1)} 人前
                  </span>
                </div>

                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.1"
                  value={portionMultiplier}
                  onChange={(e) => setPortionMultiplier(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#06b6d4', cursor: 'pointer', marginBottom: '12px' }}
                />

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[0.5, 0.8, 1.0, 1.2, 1.5, 2.0].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPortionMultiplier(val)}
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', background: portionMultiplier === val ? 'rgba(6, 182, 212, 0.2)' : undefined }}
                    >
                      {val}人前
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 最終計算結果プレビュー */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.9)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>エネルギー</span>
                <p style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>{finalNutrients.calories}<span style={{ fontSize: '0.75rem' }}>kcal</span></p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-protein)' }}>タンパク質</span>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-protein)' }}>{finalNutrients.protein}<span style={{ fontSize: '0.75rem' }}>g</span></p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-fat)' }}>脂質</span>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-fat)' }}>{finalNutrients.fat}<span style={{ fontSize: '0.75rem' }}>g</span></p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-carbs)' }}>炭水化物</span>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-carbs)' }}>{finalNutrients.carbs}<span style={{ fontSize: '0.75rem' }}>g</span></p>
              </div>
            </div>

            {/* AIワンポイントアドバイス */}
            {rawParsedData.advice && (
              <p style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(16, 185, 129, 0.1)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid var(--color-primary)' }}>
                💡 <strong>AIアドバイス:</strong> {rawParsedData.advice}
              </p>
            )}

            {/* 保存ボタン */}
            <button onClick={handleSave} className="btn-primary" style={{ width: '100%', marginTop: '16px', justifyContent: 'center', padding: '14px', fontSize: '1rem' }}>
              <Check size={18} />
              <span>この数値で記録を保存</span>
            </button>

          </div>
        )}

      </div>
    </div>
  );
}
