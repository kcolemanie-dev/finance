import { useMemo, useRef, useState } from 'react';
import { ALL_FUNDS, DEFAULT_TARGET_ALLOCATION, FUND_COLORS, FUND_CURRENT_PRICES } from '../data/funds';
import { TRANSACTIONS_RAW } from '../data/transactions';
import { formatEur } from '../lib/format';
import { extractPortfolioScreenshot, getPortfolioAnalysis } from '../lib/api';

function initialHoldings() {
  const result = {};
  for (const tx of TRANSACTIONS_RAW) {
    if (!result[tx.fund]) result[tx.fund] = { units: 0, cost: 0 };
    result[tx.fund].units += tx.units;
    result[tx.fund].cost += tx.cost;
  }
  if (!result['Dev World ex-US']) result['Dev World ex-US'] = { units: 0, cost: 0 };
  return result;
}

export default function PortfolioTab() {
  const [holdings, setHoldings] = useState(initialHoldings);
  const [prices, setPrices] = useState(FUND_CURRENT_PRICES);
  const [targetAlloc, setTargetAlloc] = useState(DEFAULT_TARGET_ALLOCATION);
  const [monthlyInvest, setMonthlyInvest] = useState('1000');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileRef = useRef(null);

  const portfolioData = useMemo(() => {
    return ALL_FUNDS.map((fund) => {
      const position = holdings[fund] || { units: 0, cost: 0 };
      const currentPrice = Number(prices[fund] || 0);
      const value = position.units * currentPrice;
      const gain = value - position.cost;
      return {
        fund,
        units: position.units,
        cost: position.cost,
        currentPrice,
        value,
        gain,
        gainPct: position.cost > 0 ? (gain / position.cost) * 100 : 0,
      };
    });
  }, [holdings, prices]);

  const totalValue = portfolioData.reduce((sum, row) => sum + row.value, 0);
  const totalCost = portfolioData.reduce((sum, row) => sum + row.cost, 0);

  const suggestion = useMemo(() => {
    const activeFunds = Object.entries(targetAlloc).filter(([, weight]) => weight > 0);
    const targetTotal = activeFunds.reduce((sum, [, weight]) => sum + weight, 0);
    const budget = Number(monthlyInvest || 0);
    const gaps = activeFunds
      .map(([fund, weight]) => {
        const row = portfolioData.find((item) => item.fund === fund);
        const currentPct = totalValue > 0 ? ((row?.value || 0) / totalValue) * 100 : 0;
        const targetPct = (weight / targetTotal) * 100;
        return { fund, gap: Math.max(targetPct - currentPct, 0) };
      })
      .filter((row) => row.gap > 0);
    const totalGap = gaps.reduce((sum, row) => sum + row.gap, 0);
    return gaps.map((row) => ({ ...row, amount: totalGap ? (row.gap / totalGap) * budget : 0 }));
  }, [targetAlloc, totalValue, portfolioData, monthlyInvest]);

  async function runAnalysis() {
    setLoading(true);
    setAnalysis('');
    try {
      const data = await getPortfolioAnalysis({
        portfolioData,
        totalValue,
        totalCost,
        monthlyInvest: Number(monthlyInvest || 0),
        targetAlloc,
      });
      setAnalysis(data.analysis);
    } catch (error) {
      setAnalysis(error.message || 'Unable to analyse portfolio right now.');
    } finally {
      setLoading(false);
    }
  }

  async function handleScreenshot(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadStatus('Uploading screenshot…');
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await extractPortfolioScreenshot({
        imageBase64: base64,
        mediaType: file.type || 'image/jpeg',
      });
      const newHoldings = { ...holdings };
      const newPrices = { ...prices };
      for (const item of data.holdings || []) {
        if (!item.fund) continue;
        if (Number.isFinite(item.price)) newPrices[item.fund] = item.price;
        if (Number.isFinite(item.units)) newHoldings[item.fund] = { ...(newHoldings[item.fund] || { cost: 0 }), units: item.units };
      }
      setHoldings(newHoldings);
      setPrices(newPrices);
      setUploadStatus(`Updated ${data.holdings?.length || 0} holdings.`);
    } catch (error) {
      setUploadStatus(error.message || 'Screenshot extraction failed.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="grid cols-2 gap-xl">
      <section className="card span-2">
        <div className="section-head compact">
          <div>
            <p className="eyebrow">ETF portfolio</p>
            <h2>Manual update or screenshot import</h2>
          </div>
          <label className="button secondary upload-button">
            Import screenshot
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleScreenshot} />
          </label>
        </div>
        {uploadStatus && <p className="muted">{uploadStatus}</p>}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fund</th>
                <th>Units</th>
                <th>Price</th>
                <th>Value</th>
                <th>Gain</th>
              </tr>
            </thead>
            <tbody>
              {ALL_FUNDS.map((fund) => {
                const row = portfolioData.find((item) => item.fund === fund);
                return (
                  <tr key={fund}>
                    <td><span className="pill" style={{ borderColor: FUND_COLORS[fund] }}>{fund}</span></td>
                    <td><input className="input table-input" type="number" value={row?.units || ''} onChange={(e) => setHoldings((current) => ({ ...current, [fund]: { ...(current[fund] || { cost: 0 }), units: Number(e.target.value || 0) } }))} /></td>
                    <td><input className="input table-input" type="number" step="0.01" value={prices[fund] || ''} onChange={(e) => setPrices((current) => ({ ...current, [fund]: Number(e.target.value || 0) }))} /></td>
                    <td className="mono">{formatEur(row?.value || 0)}</td>
                    <td className={`mono ${(row?.gain || 0) >= 0 ? 'text-green' : 'text-red'}`}>{formatEur(row?.gain || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Totals</p>
        <h2>{formatEur(totalValue)}</h2>
        <p className="muted">Cost base {formatEur(totalCost)} · Gain {formatEur(totalValue - totalCost)}</p>
        <div className="bar-stack">
          {portfolioData.filter((row) => row.value > 0).map((row) => (
            <div key={row.fund} className="bar-row">
              <div className="bar-label"><span>{row.fund}</span><span>{((row.value / totalValue) * 100 || 0).toFixed(1)}%</span></div>
              <div className="bar-bg"><div className="bar-fill" style={{ width: `${(row.value / totalValue) * 100 || 0}%`, background: FUND_COLORS[row.fund] }} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-head compact">
          <div>
            <p className="eyebrow">Next buy guide</p>
            <h2>Target allocation</h2>
          </div>
          <input className="input compact-input" type="number" value={monthlyInvest} onChange={(e) => setMonthlyInvest(e.target.value)} />
        </div>

        <div className="list-stack">
          {ALL_FUNDS.map((fund) => (
            <label key={fund} className="allocation-row">
              <span>{fund}</span>
              <input className="input compact-input" type="number" value={targetAlloc[fund] || 0} onChange={(e) => setTargetAlloc((current) => ({ ...current, [fund]: Number(e.target.value || 0) }))} />
            </label>
          ))}
        </div>

        <div className="mini-card">
          <p className="muted">Suggested split of the next {formatEur(monthlyInvest || 0)}</p>
          {suggestion.map((row) => (
            <div key={row.fund} className="history-row">
              <span>{row.fund}</span>
              <strong className="mono">{formatEur(row.amount)}</strong>
            </div>
          ))}
        </div>

        <button className="button primary full-width" onClick={runAnalysis} disabled={loading}>
          {loading ? 'Analysing…' : 'Analyse portfolio'}
        </button>
        {analysis && <div className="analysis-box"><pre>{analysis}</pre></div>}
      </section>
    </div>
  );
}
