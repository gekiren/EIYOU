/**
 * 全角数値・記号を半角数値へクリーンアップする関数
 * @param {string} text 入力文字列
 * @param {boolean} allowDecimal 小数点を許可するか
 * @returns {string} クリーンアップ後の半角数値文字列
 */
export const sanitizeNumberInput = (text, allowDecimal = true) => {
  if (typeof text !== 'string') {
    if (typeof text === 'number') return String(text);
    return '';
  }

  // 全角数字 -> 半角数字
  let sanitized = text.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));

  // 全角ピリオド・読点 -> 半角ドット
  sanitized = sanitized.replace(/[．。、,]/g, '.');

  if (allowDecimal) {
    // 数字とドットのみを抽出
    sanitized = sanitized.replace(/[^0-9.]/g, '');
    
    // 最初のドット以外の重複ドットを除去
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }
  } else {
    // 数字のみを抽出
    sanitized = sanitized.replace(/[^0-9]/g, '');
  }

  return sanitized;
};

/**
 * 入力文字列を正の数値（number）として安全にパース
 * @param {string|number} value 
 * @param {number} defaultVal 
 * @returns {number}
 */
export const parsePositiveNumber = (value, defaultVal = 0) => {
  const sanitized = sanitizeNumberInput(String(value ?? ''));
  const num = parseFloat(sanitized);
  if (isNaN(num) || num < 0) return defaultVal;
  return num;
};

export default {
  sanitizeNumberInput,
  parsePositiveNumber,
};
