import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import en from './en.js';
import zh from './zh.js';

export const LANGUAGE_STORAGE_KEY = 'guandan-language';

const dictionaries = { zh, en };
const I18nContext = createContext(null);

function interpolate(value, variables = {}) {
  return String(value).replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return variables[key] === undefined ? `{{${key}}}` : String(variables[key]);
  });
}

function getInitialLanguage() {
  if (typeof window === 'undefined') return 'zh';

  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch (_error) {
    // Ignore storage failures in privacy-restricted environments.
  }

  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage);

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (_error) {
      // Ignore storage failures in privacy-restricted environments.
    }
  }, [language]);

  const value = useMemo(() => {
    const dictionary = dictionaries[language] || zh;
    const t = (key, variables) => {
      const value = key.split('.').reduce((current, part) => current?.[part], dictionary);
      if (value === undefined) {
        const fallback = key.split('.').reduce((current, part) => current?.[part], zh);
        return interpolate(fallback === undefined ? key : fallback, variables);
      }
      return interpolate(value, variables);
    };

    return { language, setLanguage, t };
  }, [language]);

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}

const SUIT_SYMBOLS = { S: '♠', H: '♥', C: '♣', D: '♦' };

export function localizedCardLabel(card, t) {
  if (card?.rank === 'SJ') return t('card.smallJoker');
  if (card?.rank === 'BJ') return t('card.bigJoker');
  return `${SUIT_SYMBOLS[card?.suit] || ''}${card?.rank || ''}`;
}

export function localizedCardSpecLabel(spec, t) {
  if (spec?.rank === 'SJ') return t('card.smallJoker');
  if (spec?.rank === 'BJ') return t('card.bigJoker');
  if (spec?.rank === 'JOKER') return t('card.joker');
  return `${SUIT_SYMBOLS[spec?.suit] || spec?.suit || ''}${spec?.rank || ''}`;
}

export function localizedComboLabel(combo, t) {
  const base = t(`combo.${combo?.type}`);
  if (combo?.type === 'straight' || combo?.type === 'straightFlush') {
    return `${base} (${combo.sequence?.join('-') || ''})`;
  }
  if (combo?.type === 'wood' || combo?.type === 'steel') {
    return `${base} (${combo.sequence?.join('-') || ''})`;
  }
  if (combo?.type === 'threeWithPair') {
    return `${base} (${t('combo.detail', {
      tripleRank: combo.tripleRank || '',
      pairRank: combo.pairRank || ''
    })})`;
  }
  if (combo?.mainRank) return `${base} (${combo.mainRank})`;
  return base;
}

export function localizeError(error, t) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes('JSON 格式不正确')) return t('errors.invalidJson');
  if (message.includes('未找到手牌数组')) return t('errors.missingCards');
  if (message.includes('未解析到有效牌面')) return t('errors.noValidCards');
  if (message.includes('超过双副牌上限')) return t('errors.overCapacity');
  if (message.includes('手牌必须是')) {
    const count = message.match(/当前识别到\s*(\d+)/)?.[1] || '0';
    return t('errors.wrongCardCount', { count });
  }
  if (message.includes('未提取到文本')) return t('errors.noText');
  if (message.includes('未检测到可识别')) return t('errors.noCardText');
  if (message.includes('当前环境不支持图片识别')) return t('errors.unsupportedImage');
  if (message.includes('加载失败')) return t('errors.tesseractLoad');
  if (message.includes('初始化失败')) return t('errors.tesseractInit');
  if (message.includes('请选择图片文件')) return t('notices.chooseImage');
  if (message.includes('请选择 JSON 文件')) return t('notices.chooseJson');
  if (message.includes('导入失败')) return t('errors.defaultImport');
  return message || t('errors.defaultImport');
}

export function localizeGodExplanation(explanation, t) {
  if (!explanation) return '';
  if (explanation === '当前组牌方案较为均衡。') return t('godView.balancedExplanation');
  return explanation
    .replace(/火力充足（(\d+) 个炸弹）/g, (_match, count) => t('godView.strongFire', { count }))
    .replace(/孤张较多（(\d+) 张），容易被管住/g, (_match, count) =>
      t('godView.manySingles', { count })
    )
    .replace(/对手炸弹强，建议优先保护自己不被管住/g, () => t('godView.strongOpponent'))
    .replace(/；/g, languageAwareSeparator(t))
    .replace(/。$/, '.');
}

function languageAwareSeparator(t) {
  return t('language.en') === 'EN' ? '; ' : '；';
}

export function languageLocale(language) {
  return language === 'zh' ? 'zh-CN' : 'en-US';
}
