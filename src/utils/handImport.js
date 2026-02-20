import {
  STANDARD_RANKS,
  createFullDeck,
  decorateCard,
  shuffleCards,
  sortCards
} from '../engine/cards.js';

export const HAND_CARD_COUNT = 27;

const SUIT_BY_SYMBOL = {
  '♠': 'S',
  '♤': 'S',
  '♥': 'H',
  '♡': 'H',
  '♣': 'C',
  '♧': 'C',
  '♦': 'D',
  '♢': 'D'
};

const SUIT_WORD_PATTERNS = [
  { pattern: /黑桃/gi, suit: 'S' },
  { pattern: /红桃|紅桃/gi, suit: 'H' },
  { pattern: /梅花/gi, suit: 'C' },
  { pattern: /方块|方塊/gi, suit: 'D' }
];

const JOKER_SMALL_PATTERN = /小王|SMALL\s*JOKER|XIAO\s*WANG|LITTLE\s*JOKER/gi;
const JOKER_BIG_PATTERN = /大王|BIG\s*JOKER|DA\s*WANG|BLACK\s*JOKER/gi;

function toHalfWidth(input) {
  return String(input ?? '')
    .replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ');
}

export function normalizeTrumpRank(input, fallback = '2') {
  const raw = toHalfWidth(input).trim().toUpperCase();
  const normalized = raw === 'T' ? '10' : raw;
  if (STANDARD_RANKS.includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function normalizeSuit(input) {
  const raw = toHalfWidth(input).trim().toUpperCase();
  if (!raw) return null;
  if (raw === 'S' || raw === 'SPADE' || raw === 'SPADES') return 'S';
  if (raw === 'H' || raw === 'HEART' || raw === 'HEARTS') return 'H';
  if (raw === 'C' || raw === 'CLUB' || raw === 'CLUBS') return 'C';
  if (raw === 'D' || raw === 'DIAMOND' || raw === 'DIAMONDS') return 'D';
  if (raw === 'JOKER') return 'JOKER';
  return SUIT_BY_SYMBOL[input] || null;
}

function normalizeRank(input) {
  const raw = toHalfWidth(input).trim().toUpperCase();
  if (!raw) return null;
  if (STANDARD_RANKS.includes(raw)) return raw;
  if (raw === 'T') return '10';
  if (raw === 'SJ' || raw === 'SMALLJOKER' || raw === 'XW') return 'SJ';
  if (raw === 'BJ' || raw === 'BIGJOKER' || raw === 'DW') return 'BJ';
  if (raw === 'JOKER') return 'JOKER';
  return null;
}

function normalizeCardSpecObject(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const directRank = normalizeRank(entry.rank || entry.value || entry.face || entry.cardRank);
  const directSuit = normalizeSuit(entry.suit || entry.cardSuit);
  if (directRank && (directSuit || directRank === 'SJ' || directRank === 'BJ')) {
    if (directRank === 'SJ' || directRank === 'BJ' || directRank === 'JOKER') {
      return { suit: 'JOKER', rank: directRank };
    }
    if (!directSuit || directSuit === 'JOKER') return null;
    return { suit: directSuit, rank: directRank };
  }

  if (typeof entry.label === 'string') {
    const parsed = parseSingleCardToken(entry.label);
    if (parsed) return parsed;
  }

  return null;
}

function parseSingleCardToken(token) {
  if (typeof token !== 'string') return null;
  const source = toHalfWidth(token).trim();
  if (!source) return null;

  if (JOKER_SMALL_PATTERN.test(source)) {
    JOKER_SMALL_PATTERN.lastIndex = 0;
    return { suit: 'JOKER', rank: 'SJ' };
  }
  JOKER_SMALL_PATTERN.lastIndex = 0;

  if (JOKER_BIG_PATTERN.test(source)) {
    JOKER_BIG_PATTERN.lastIndex = 0;
    return { suit: 'JOKER', rank: 'BJ' };
  }
  JOKER_BIG_PATTERN.lastIndex = 0;

  let normalized = source.toUpperCase();
  for (const [symbol, suit] of Object.entries(SUIT_BY_SYMBOL)) {
    normalized = normalized.split(symbol).join(suit);
  }
  normalized = normalized.replace(/\s+/g, '');
  normalized = normalized.replace(/[，,、;；:：|/\\()[\]{}<>]/g, '');
  normalized = normalized.replace(/10/g, 'T');
  normalized = normalized.replace(/^([SHCD])([2-9TJQKA])$/, '$1-$2');
  normalized = normalized.replace(/^([2-9TJQKA])([SHCD])$/, '$2-$1');

  const match = normalized.match(/^([SHCD])-([2-9TJQKA])$/);
  if (!match) return null;

  const rank = match[2] === 'T' ? '10' : match[2];
  return { suit: match[1], rank };
}

function resolveCardEntriesFromJsonPayload(payload) {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return [];
    }

    const hasCardLikeEntries = payload.some((item) => {
      if (typeof item === 'string') return true;
      if (!item || typeof item !== 'object') return false;
      return Boolean(item.suit || item.rank || item.label);
    });
    if (hasCardLikeEntries) {
      return payload;
    }

    const firstRecord = payload.find((item) => item && typeof item === 'object');
    if (firstRecord) {
      return resolveCardEntriesFromJsonPayload(firstRecord);
    }
    return [];
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const directKeys = ['cards', 'dealtCards', 'handCards', 'hand', 'eastCards', 'playerCards'];
  for (const key of directKeys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  if (Array.isArray(payload.players)) {
    const east = payload.players.find((player) => player?.seat === 'E');
    if (Array.isArray(east?.cards)) {
      return east.cards;
    }
  }

  if (payload.game && typeof payload.game === 'object') {
    const nested = resolveCardEntriesFromJsonPayload(payload.game);
    if (nested) return nested;
  }

  return null;
}

function extractTrumpRankFromJsonPayload(payload) {
  if (!payload || typeof payload !== 'object') return undefined;

  const tryKeys = ['trumpRank', 'trump', 'level', 'currentTrumpRank'];
  for (const key of tryKeys) {
    if (payload[key]) {
      return normalizeTrumpRank(payload[key], undefined);
    }
  }

  if (Array.isArray(payload) && payload.length > 0) {
    for (const item of payload) {
      if (!item || typeof item !== 'object') continue;
      const nested = extractTrumpRankFromJsonPayload(item);
      if (nested) return nested;
    }
  }

  if (Array.isArray(payload.players)) {
    const nested = extractTrumpRankFromJsonPayload(payload.players);
    if (nested) return nested;
  }

  if (payload.game && typeof payload.game === 'object') {
    const nested = extractTrumpRankFromJsonPayload(payload.game);
    if (nested) return nested;
  }

  return undefined;
}

function parseCardEntries(entries) {
  const specs = [];
  for (const entry of entries || []) {
    let parsed = null;
    if (typeof entry === 'string') {
      parsed = parseSingleCardToken(entry);
      if (!parsed) {
        try {
          const fromText = parseHandSpecsFromText(entry).cardSpecs;
          specs.push(...fromText);
        } catch (_error) {
          // Ignore invalid free-form text chunks in JSON arrays.
        }
        continue;
      }
    } else {
      parsed = normalizeCardSpecObject(entry);
    }

    if (!parsed) continue;
    specs.push(parsed);
  }
  return specs;
}

export function parseHandImportJson(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (_error) {
    throw new Error('导入失败：JSON 格式不正确。');
  }

  const cardEntries = resolveCardEntriesFromJsonPayload(parsed);
  if (!cardEntries) {
    throw new Error('导入失败：JSON 中未找到手牌数组（cards / dealtCards / players[E].cards）。');
  }

  const cardSpecs = parseCardEntries(cardEntries);
  if (cardSpecs.length === 0) {
    throw new Error('导入失败：未解析到有效牌面。');
  }

  const trumpRank = extractTrumpRankFromJsonPayload(parsed);
  return { trumpRank, cardSpecs };
}

function normalizeTextForOcr(rawText) {
  let text = toHalfWidth(rawText);
  text = text.replace(/\r\n|\r/g, '\n');

  for (const { pattern, suit } of SUIT_WORD_PATTERNS) {
    text = text.replace(pattern, ` ${suit} `);
  }

  for (const [symbol, suit] of Object.entries(SUIT_BY_SYMBOL)) {
    text = text.split(symbol).join(` ${suit} `);
  }

  text = text.replace(JOKER_SMALL_PATTERN, ' SJOKER ');
  JOKER_SMALL_PATTERN.lastIndex = 0;
  text = text.replace(JOKER_BIG_PATTERN, ' BJOKER ');
  JOKER_BIG_PATTERN.lastIndex = 0;
  text = text.replace(/[，,、;；:：|/\\()[\]{}<>]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text.toUpperCase();
}

function extractTrumpRankFromText(normalizedText) {
  const raw = toHalfWidth(normalizedText);
  const match = raw.match(/(?:当前打|打几|级牌|主牌|TRUMP)\s*[:：]?\s*(?:[SHCD]\s*)?(10|[2-9JQKA])/i);
  if (!match) return undefined;
  return normalizeTrumpRank(match[1], undefined);
}

export function parseHandSpecsFromText(rawText) {
  const normalized = normalizeTextForOcr(rawText);
  if (!normalized) {
    throw new Error('识别失败：图片中未提取到文本。');
  }

  const trumpRank = extractTrumpRankFromText(normalized);
  const cardOnlyText = normalized.replace(
    /(?:当前打|打几|级牌|主牌|TRUMP)\s*[:：]?\s*(?:[SHCD]\s*)?(10|[2-9JQKA])/gi,
    ' '
  );

  const cardSpecs = [];
  const regex =
    /\b(BJOKER|SJOKER|JOKER|DW|XW)\b|([SHCD])\s*(10|[2-9JQKA])\b|\b(10|[2-9JQKA])\s*([SHCD])\b/g;

  let match;
  while ((match = regex.exec(cardOnlyText)) !== null) {
    if (match[1]) {
      const marker = match[1];
      if (marker === 'BJOKER' || marker === 'DW') {
        cardSpecs.push({ suit: 'JOKER', rank: 'BJ' });
      } else if (marker === 'SJOKER' || marker === 'XW') {
        cardSpecs.push({ suit: 'JOKER', rank: 'SJ' });
      } else {
        cardSpecs.push({ suit: 'JOKER', rank: 'JOKER' });
      }
      continue;
    }

    if (match[2] && match[3]) {
      cardSpecs.push({ suit: match[2], rank: normalizeTrumpRank(match[3], match[3]) });
      continue;
    }

    if (match[4] && match[5]) {
      cardSpecs.push({ suit: match[5], rank: normalizeTrumpRank(match[4], match[4]) });
    }
  }

  if (cardSpecs.length === 0) {
    throw new Error('识别失败：未检测到可识别的牌面字符。');
  }

  return {
    trumpRank,
    cardSpecs,
    rawText: normalized
  };
}

function makePoolKey(suit, rank) {
  return `${suit}-${rank}`;
}

function toReadableCard(spec) {
  if (spec.suit === 'JOKER') {
    if (spec.rank === 'BJ') return '大王';
    if (spec.rank === 'SJ') return '小王';
    return '王';
  }
  return `${spec.suit}${spec.rank}`;
}

function normalizeCardSpec(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const suit = normalizeSuit(spec.suit);
  const rank = normalizeRank(spec.rank);
  if (!suit || !rank) return null;

  if (rank === 'SJ' || rank === 'BJ' || rank === 'JOKER') {
    return { suit: 'JOKER', rank };
  }
  if (suit === 'JOKER') return null;
  return { suit, rank };
}

export function materializeHandCards(cardSpecs, trumpRank) {
  const normalizedSpecs = (cardSpecs || []).map(normalizeCardSpec).filter(Boolean);
  const pool = new Map();
  for (const card of createFullDeck()) {
    const key = makePoolKey(card.suit, card.rank);
    if (!pool.has(key)) {
      pool.set(key, []);
    }
    pool.get(key).push(card);
  }

  const picked = [];
  for (const spec of normalizedSpecs) {
    if (spec.suit === 'JOKER' && spec.rank === 'JOKER') {
      const small = pool.get(makePoolKey('JOKER', 'SJ')) || [];
      const big = pool.get(makePoolKey('JOKER', 'BJ')) || [];
      const fromPool = small.length > 0 ? small : big;
      if (fromPool.length === 0) {
        throw new Error('导入失败：王的数量超过双副牌上限。');
      }
      picked.push(fromPool.shift());
      continue;
    }

    const key = makePoolKey(spec.suit, spec.rank);
    const bucket = pool.get(key) || [];
    if (bucket.length === 0) {
      throw new Error(`导入失败：${toReadableCard(spec)} 超出双副牌上限。`);
    }
    picked.push(bucket.shift());
  }

  return sortCards(
    picked.map((card) => decorateCard(card, trumpRank)),
    trumpRank
  );
}

export function createTableDealFromEastCards(eastCards, trumpRank) {
  const eastIdSet = new Set((eastCards || []).map((card) => card.id));
  const remaining = shuffleCards(createFullDeck().filter((card) => !eastIdSet.has(card.id)));

  const players = [
    {
      seat: 'E',
      cards: sortCards([...eastCards], trumpRank)
    }
  ];

  const sideSeats = ['S', 'W', 'N'];
  for (let index = 0; index < sideSeats.length; index += 1) {
    const start = index * HAND_CARD_COUNT;
    const cards = remaining
      .slice(start, start + HAND_CARD_COUNT)
      .map((card) => decorateCard(card, trumpRank));
    players.push({
      seat: sideSeats[index],
      cards: sortCards(cards, trumpRank)
    });
  }

  return {
    trumpRank,
    players
  };
}
