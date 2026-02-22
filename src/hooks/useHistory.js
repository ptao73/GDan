// 历史记录与导入导出 Hook
import { useRef, useState } from 'react';
import { DataService } from '../services/dataService.js';
import {
  HAND_CARD_COUNT,
  createTableDealFromEastCards,
  deduplicateOcrSpecs,
  materializeHandCards,
  normalizeTrumpRank,
  parseHandImportJson,
  parseHandSpecsFromText
} from '../utils/handImport.js';

export function useHistory({ setNotice, isSolving }) {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [isImportingHand, setIsImportingHand] = useState(false);
  const [ocrReview, setOcrReview] = useState(null);
  // 缓存 importContext，供审查确认时使用
  const ocrImportContextRef = useRef(null);

  const importInputRef = useRef(null);
  const tesseractLoaderRef = useRef(null);

  async function refreshHistoryAndStats() {
    const [nextHistory, nextStats] = await Promise.all([
      DataService.getHistory(20),
      DataService.getStats()
    ]);
    setHistory(nextHistory);
    setStats(nextStats);
  }

  async function exportHistory() {
    try {
      const content = await DataService.exportData();
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `guandan-history-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice('已导出历史数据。');
    } catch (_error) {
      setNotice('导出失败。');
    }
  }

  function openImportDialog() {
    if (isSolving || isImportingHand) return;
    importInputRef.current?.click();
  }

  function loadTesseractRuntime() {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('当前环境不支持图片识别。'));
    }

    if (window.Tesseract?.recognize) {
      return Promise.resolve(window.Tesseract);
    }

    if (tesseractLoaderRef.current) {
      return tesseractLoaderRef.current;
    }

    tesseractLoaderRef.current = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-tesseract-cdn="1"]');
      if (existing) {
        existing.addEventListener('load', () => {
          if (window.Tesseract?.recognize) {
            resolve(window.Tesseract);
          } else {
            reject(new Error('图片识别组件加载失败。'));
          }
        });
        existing.addEventListener('error', () => {
          reject(new Error('图片识别组件加载失败，请检查网络后重试。'));
        });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.async = true;
      script.dataset.tesseractCdn = '1';
      script.onload = () => {
        if (window.Tesseract?.recognize) {
          resolve(window.Tesseract);
        } else {
          reject(new Error('图片识别组件初始化失败。'));
        }
      };
      script.onerror = () => {
        reject(new Error('图片识别组件加载失败，请检查网络后重试。'));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      tesseractLoaderRef.current = null;
      throw error;
    });

    return tesseractLoaderRef.current;
  }

  function isImageFile(file) {
    if (!file) return false;
    if (typeof file.type === 'string' && file.type.startsWith('image/')) {
      return true;
    }
    return /\.(png|jpe?g|webp|bmp|gif|heic|heif)$/i.test(file.name || '');
  }

  function applyImportedHandSpecs(cardSpecs, incomingTrumpRank, sourceLabel, {
    trumpRank,
    aiSearchMode,
    cancelPendingSearches,
    resetPrecomputeState,
    resetGodViewPrecomputeState,
    resetRoundState,
    kickOffPrecompute,
    kickOffGodViewPrecompute
  }) {
    if (!Array.isArray(cardSpecs) || cardSpecs.length !== HAND_CARD_COUNT) {
      throw new Error(
        `导入失败：手牌必须是 ${HAND_CARD_COUNT} 张，当前识别到 ${cardSpecs?.length || 0} 张。`
      );
    }

    const nextTrumpRank = normalizeTrumpRank(incomingTrumpRank, trumpRank);
    const eastCards = materializeHandCards(cardSpecs, nextTrumpRank);
    const nextTableDeal = createTableDealFromEastCards(eastCards, nextTrumpRank);

    cancelPendingSearches('导入手牌后，取消旧搜索。');
    resetPrecomputeState();
    resetGodViewPrecomputeState();
    resetRoundState(eastCards, nextTrumpRank, nextTableDeal);
    kickOffPrecompute(eastCards, nextTrumpRank, aiSearchMode, true);
    kickOffGodViewPrecompute(nextTableDeal, aiSearchMode, true);
    setNotice(`${sourceLabel}成功：已导入 27 张手牌，当前打几：${nextTrumpRank}。`);
  }

  async function importHandFromImageFile(file, importContext) {
    setIsImportingHand(true);
    setNotice('正在识别图片中的手牌，请稍候...');
    try {
      const tesseract = await loadTesseractRuntime();
      const result = await tesseract.recognize(file, 'eng+chi_sim');
      const recognizedText = result?.data?.text || '';
      const { trumpRank: recognizedTrumpRank, cardSpecs: rawSpecs } =
        parseHandSpecsFromText(recognizedText);

      // OCR 路径专用去重（JSON 路径不需要）
      const rawCount = rawSpecs.length;
      const cardSpecs = deduplicateOcrSpecs(rawSpecs);

      if (cardSpecs.length === HAND_CARD_COUNT) {
        // 去重后恰好 27 张，直接导入
        applyImportedHandSpecs(cardSpecs, recognizedTrumpRank, '图片识别导入', importContext);
      } else {
        // 数量不符，进入审查面板
        ocrImportContextRef.current = importContext;
        setOcrReview({ cardSpecs, rawCount, trumpRank: recognizedTrumpRank });
        setNotice(
          `OCR 识别到 ${rawCount} 张，去重后 ${cardSpecs.length} 张，请审查编辑后确认导入。`
        );
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '图片识别导入失败。');
    } finally {
      setIsImportingHand(false);
    }
  }

  function confirmOcrReview(finalSpecs) {
    const importContext = ocrImportContextRef.current;
    const trumpRank = ocrReview?.trumpRank;
    setOcrReview(null);
    ocrImportContextRef.current = null;
    if (!importContext) return;
    try {
      applyImportedHandSpecs(finalSpecs, trumpRank, '图片识别导入', importContext);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '导入失败。');
    }
  }

  function cancelOcrReview() {
    setOcrReview(null);
    ocrImportContextRef.current = null;
    setNotice('已取消图片识别导入。');
  }

  async function importHistory(event, importContext) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (isImageFile(file)) {
        await importHandFromImageFile(file, importContext);
        return;
      }

      const text = await file.text();
      let importedHand = null;
      try {
        importedHand = parseHandImportJson(text);
      } catch (_handParseError) {
        importedHand = null;
      }

      if (importedHand) {
        setIsImportingHand(true);
        applyImportedHandSpecs(importedHand.cardSpecs, importedHand.trumpRank, 'JSON 导入', importContext);
        return;
      }

      const count = await DataService.importData(text);
      await refreshHistoryAndStats();
      setNotice(`历史导入完成，处理 ${count} 条记录。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '导入失败。');
    } finally {
      setIsImportingHand(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  }

  return {
    history,
    stats,
    isImportingHand,
    ocrReview,
    importInputRef,
    refreshHistoryAndStats,
    exportHistory,
    openImportDialog,
    importHistory,
    confirmOcrReview,
    cancelOcrReview
  };
}
