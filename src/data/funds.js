export const FUND_COLORS = {
  VWCE: '#3b82f6',
  VWRD: '#60a5fa',
  'S&P 500 Acc': '#f59e0b',
  'S&P 500 Dis': '#fbbf24',
  'Dev World': '#10b981',
  'Dev World ex-US': '#34d399',
  'EM Acc': '#8b5cf6',
};

export const FUND_CURRENT_PRICES = {
  VWCE: 148.5,
  VWRD: 144.82,
  'S&P 500 Acc': 112.83,
  'S&P 500 Dis': 111.09,
  'Dev World': 117.42,
  'Dev World ex-US': 0,
  'EM Acc': 69.73,
};

export const ALL_FUNDS = Object.keys(FUND_COLORS);

export const DEFAULT_TARGET_ALLOCATION = {
  VWCE: 55,
  'EM Acc': 20,
  'Dev World ex-US': 25,
  VWRD: 0,
  'S&P 500 Acc': 0,
  'S&P 500 Dis': 0,
  'Dev World': 0,
};
