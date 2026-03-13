const IMPORT_STORAGE_KEY = 'finance-dashboard.importedLots.v1';

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const HEADER_ALIASES = {
  date: ['date', 'trade date', 'purchase date'],
  fund: ['fund', 'product', 'name', 'security'],
  isin: ['isin'],
  units: ['units', 'quantity', 'shares'],
  price: ['price', 'price eur'],
  cost: ['cost', 'total', 'total eur', 'gross amount'],
  totalEur: ['total eur'],
  fees: ['transaction and/or third party fees eur', 'fees', 'fee'],
  valueEur: ['value eur'],
  orderId: ['order id', 'orderid'],
  type: ['type', 'transaction type', 'side'],
};

const DEGiro_PRODUCT_MAP = {
  IE00BK5BR733: 'EM Acc',
  IE00BK5BQV03: 'Dev World',
  IE00BK5BQT80: 'VWCE',
  IE00BFMXXD54: 'S&P 500 Acc',
};

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase();
}

function splitCsvLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((value) => value.trim());
}

function detectDelimiter(headerLine) {
  const delimiters = [',', ';', '\t'];
  let best = ',';
  let bestCount = -1;

  delimiters.forEach((delimiter) => {
    const count = headerLine.split(delimiter).length;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  });

  return best;
}

function parseNumber(value) {
  if (value == null || value === '') return null;
  const cleaned = String(value)
    .replace(/€/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '');

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDisplayDate(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [d, m, y] = value.split('-');
    return `${d}/${m}/${y}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  }

  return '';
}

function findHeaderIndex(headers, key) {
  const aliases = HEADER_ALIASES[key] || [];
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
}

export function makeLotKey(lot) {
  return [lot.date, lot.isin || '', lot.fund, lot.units, lot.price, lot.cost, lot.orderId || ''].join('|');
}

function slug(text) {
  return String(text || '').toLowerCase();
}

function isLikelyBuyType(typeValue) {
  const normalized = normalizeHeader(typeValue);
  if (!normalized) return null;
  if (['sell', 'sale', 'withdrawal', 'redemption'].some((term) => normalized.includes(term))) return false;
  if (['buy', 'purchase', 'deposit'].some((term) => normalized.includes(term))) return true;
  return null;
}

function looksLikeNoiseRow(cells) {
  const joined = cells.join(' ').trim();
  return !joined || (!/\d/.test(joined) && cells.filter(Boolean).length <= 2);
}

function normalizeFundName(product, isin) {
  if (isin && DEGiro_PRODUCT_MAP[isin]) return DEGiro_PRODUCT_MAP[isin];

  const text = slug(product);
  if (text.includes('emerging') || text.includes('em mkts')) return 'EM Acc';
  if (text.includes('developed world')) return 'Dev World';
  if (text.includes('all-world')) return 'VWCE';
  if (text.includes('s&p 500')) return 'S&P 500 Acc';
  return String(product || '').trim();
}

function detectDeGiro(headers) {
  const normalized = headers.map(normalizeHeader);
  return normalized.includes('product') && normalized.includes('isin') && normalized.includes('total eur') && normalized.includes('quantity');
}

function summarizeLots(lots) {
  return Object.entries(
    lots.reduce((acc, lot) => {
      if (!acc[lot.fund]) acc[lot.fund] = { count: 0, units: 0, cost: 0 };
      acc[lot.fund].count += 1;
      acc[lot.fund].units += Number(lot.units || 0);
      acc[lot.fund].cost += Number(lot.cost || 0);
      return acc;
    }, {})
  ).map(([fund, stats]) => ({ fund, ...stats })).sort((a, b) => b.cost - a.cost);
}

function parseDeGiroCsv(rows, delimiter, headers) {
  const indexes = {
    date: findHeaderIndex(headers, 'date'),
    fund: findHeaderIndex(headers, 'fund'),
    isin: findHeaderIndex(headers, 'isin'),
    units: findHeaderIndex(headers, 'units'),
    price: findHeaderIndex(headers, 'price'),
    totalEur: findHeaderIndex(headers, 'totalEur'),
    fees: findHeaderIndex(headers, 'fees'),
    valueEur: findHeaderIndex(headers, 'valueEur'),
    orderId: findHeaderIndex(headers, 'orderId'),
    type: findHeaderIndex(headers, 'type'),
  };

  const lots = [];
  let skipped = 0;
  const errors = [];

  rows.slice(1).forEach((row) => {
    const cells = splitCsvLine(row, delimiter);
    if (looksLikeNoiseRow(cells)) {
      skipped += 1;
      return;
    }

    const rawDate = cells[indexes.date];
    const date = toDisplayDate(rawDate);
    const product = String(cells[indexes.fund] || '').trim();
    const isin = String(cells[indexes.isin] || '').trim();
    const units = parseNumber(cells[indexes.units]);
    const price = parseNumber(cells[indexes.price]);
    const totalEur = parseNumber(cells[indexes.totalEur]);
    const fees = indexes.fees === -1 ? 0 : parseNumber(cells[indexes.fees]) ?? 0;
    const valueEur = indexes.valueEur === -1 ? null : parseNumber(cells[indexes.valueEur]);
    const typeGuess = indexes.type === -1 ? null : isLikelyBuyType(cells[indexes.type]);
    const orderId = indexes.orderId === -1 ? '' : String(cells[indexes.orderId] || '').trim();

    if (!date || !product || !units || price == null || totalEur == null) {
      skipped += 1;
      return;
    }

    const isBuy = typeGuess == null ? units > 0 && totalEur < 0 : typeGuess;
    if (!isBuy) {
      skipped += 1;
      return;
    }

    const cost = Math.abs(totalEur);
    const normalizedFund = normalizeFundName(product, isin);

    lots.push({
      date,
      fund: normalizedFund,
      rawFund: product,
      isin,
      units: Math.abs(units),
      price: Math.abs(price),
      cost,
      fees: Math.abs(fees),
      grossValue: valueEur == null ? Math.abs(units * price) : Math.abs(valueEur),
      orderId,
      source: 'imported',
      importSource: 'degiro',
    });
  });

  return {
    lots,
    skipped,
    errors,
    detectedFormat: 'DeGiro',
    summaryByFund: summarizeLots(lots),
  };
}

function parseGenericCsv(rows, delimiter, headers) {
  const indexes = {
    date: findHeaderIndex(headers, 'date'),
    fund: findHeaderIndex(headers, 'fund'),
    units: findHeaderIndex(headers, 'units'),
    price: findHeaderIndex(headers, 'price'),
    cost: findHeaderIndex(headers, 'cost'),
    type: findHeaderIndex(headers, 'type'),
    isin: findHeaderIndex(headers, 'isin'),
  };

  const missing = ['date', 'fund', 'units'].filter((key) => indexes[key] === -1);
  if (missing.length) {
    return { lots: [], skipped: rows.length - 1, errors: [`Missing required columns: ${missing.join(', ')}.`], detectedFormat: 'Generic CSV', summaryByFund: [] };
  }

  const lots = [];
  let skipped = 0;
  const errors = [];

  rows.slice(1).forEach((row, rowIndex) => {
    const cells = splitCsvLine(row, delimiter);
    if (looksLikeNoiseRow(cells)) {
      skipped += 1;
      return;
    }

    const date = toDisplayDate(cells[indexes.date]);
    const rawFund = String(cells[indexes.fund] || '').trim();
    const isin = indexes.isin === -1 ? '' : String(cells[indexes.isin] || '').trim();
    const fund = normalizeFundName(rawFund, isin);
    const units = parseNumber(cells[indexes.units]);
    const price = indexes.price === -1 ? null : parseNumber(cells[indexes.price]);
    let cost = indexes.cost === -1 ? null : parseNumber(cells[indexes.cost]);
    const typeGuess = indexes.type === -1 ? null : isLikelyBuyType(cells[indexes.type]);

    if (!date || !fund || !units) {
      skipped += 1;
      return;
    }

    const isBuy = typeGuess == null ? units > 0 : typeGuess;
    if (!isBuy) {
      skipped += 1;
      return;
    }

    const normalizedUnits = Math.abs(units);
    const normalizedPrice = Math.abs(price ?? 0);
    if (cost == null) {
      cost = normalizedPrice > 0 ? normalizedUnits * normalizedPrice : 0;
    }

    if (!Number.isFinite(cost)) {
      skipped += 1;
      errors.push(`Row ${rowIndex + 2}: invalid cost.`);
      return;
    }

    lots.push({
      date,
      fund,
      rawFund,
      isin,
      units: normalizedUnits,
      price: normalizedPrice,
      cost: Math.abs(cost),
      source: 'imported',
      importSource: 'generic',
    });
  });

  return { lots, skipped, errors, detectedFormat: 'Generic CSV', summaryByFund: summarizeLots(lots) };
}

export function parseDisposalCsv(text) {
  const rows = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\uFEFF/, '').trimEnd())
    .filter((line) => line.trim().length);

  if (rows.length < 2) {
    return { lots: [], skipped: 0, errors: ['The CSV needs a header row and at least one transaction row.'], detectedFormat: 'Unknown', summaryByFund: [] };
  }

  const delimiter = detectDelimiter(rows[0]);
  const headers = splitCsvLine(rows[0], delimiter);

  if (detectDeGiro(headers)) {
    return parseDeGiroCsv(rows, delimiter, headers);
  }

  return parseGenericCsv(rows, delimiter, headers);
}

export function mergeImportedLots(existingLots, newLots, replaceExisting = true) {
  if (replaceExisting) return newLots;

  const existingKeys = new Set(existingLots.map(makeLotKey));
  const dedupedNew = newLots.filter((lot) => !existingKeys.has(makeLotKey(lot)));
  return [...existingLots, ...dedupedNew];
}

export function loadImportedLots() {
  return loadJson(IMPORT_STORAGE_KEY, []);
}

export function saveImportedLots(lots) {
  saveJson(IMPORT_STORAGE_KEY, lots);
}

export function buildTemplateCsv() {
  return [
    ['Date', 'Fund', 'ISIN', 'Units', 'Price', 'Cost', 'Type'].join(','),
    ['2026-03-03', 'VWCE', 'IE00BK5BQT80', '5', '116.93', '587.65', 'Buy'].join(','),
    ['2026-03-03', 'EM Acc', 'IE00BK5BR733', '6', '69.95', '420.70', 'Buy'].join(','),
  ].join('\n');
}
