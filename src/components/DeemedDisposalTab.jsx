import { useMemo, useState } from 'react';
import { FUND_CURRENT_PRICES, FUND_COLORS } from '../data/funds';
import { TRANSACTIONS_RAW } from '../data/transactions';
import { addYears, daysUntil, formatEur, formatLongDate, parseDate } from '../lib/format';

function urgency(days) {
  if (days <= 365) return 'text-red';
  if (days <= 730) return 'text-amber';
  if (days <= 1460) return 'text-blue';
  return 'text-green';
}

export default function DeemedDisposalTab() {
  const [filter, setFilter] = useState('all');
  const [prices, setPrices] = useState(FUND_CURRENT_PRICES);

  const lots = useMemo(() => {
    return TRANSACTIONS_RAW.map((tx, index) => {
      const buyDate = parseDate(tx.date);
      const deemedDate = addYears(buyDate, 8);
      const currentValue = tx.units * Number(prices[tx.fund] || 0);
      const gain = currentValue - tx.cost;
      const taxLiability = gain > 0 ? gain * 0.41 : 0;
      return {
        ...tx,
        id: `${tx.fund}-${index}`,
        deemedDate,
        days: daysUntil(deemedDate),
        currentValue,
        gain,
        taxLiability,
      };
    }).sort((a, b) => a.deemedDate - b.deemedDate);
  }, [prices]);

  const filtered = filter === 'all' ? lots : lots.filter((lot) => lot.fund === filter);
  const totalLiability = lots.reduce((sum, lot) => sum + lot.taxLiability, 0);
  const upcomingTwoYears = lots.filter((lot) => lot.days <= 730).reduce((sum, lot) => sum + lot.taxLiability, 0);
  const yearlyBuckets = lots.reduce((acc, lot) => {
    const year = lot.deemedDate.getFullYear();
    acc[year] = (acc[year] || 0) + lot.taxLiability;
    return acc;
  }, {});
  const funds = Array.from(new Set(TRANSACTIONS_RAW.map((tx) => tx.fund)));
  const maxYear = Math.max(...Object.values(yearlyBuckets), 1);

  return (
    <div className="grid gap-xl">
      <section className="card">
        <div className="stats-row">
          <div className="stat-box"><small>Total est. liability</small><strong>{formatEur(totalLiability)}</strong></div>
          <div className="stat-box warn"><small>Due within 2 years</small><strong>{formatEur(upcomingTwoYears)}</strong></div>
          <div className="stat-box"><small>Earliest trigger</small><strong>{lots[0] ? formatLongDate(lots[0].deemedDate) : '—'}</strong></div>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Calendar view</p>
        <h2>Estimated yearly liabilities</h2>
        <div className="timeline">
          {Object.entries(yearlyBuckets).map(([year, value]) => (
            <div key={year} className="timeline-item">
              <span className="mono small">{formatEur(value)}</span>
              <div className="timeline-bar"><div style={{ height: `${(value / maxYear) * 100}%` }} /></div>
              <span>{year}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-head compact">
          <div>
            <p className="eyebrow">Price assumptions</p>
            <h2>Update current ETF prices</h2>
          </div>
        </div>
        <div className="account-grid">
          {Object.entries(prices).map(([fund, value]) => (
            <label key={fund} className="field">
              <span>{fund}</span>
              <input className="input" type="number" step="0.01" value={value} onChange={(e) => setPrices((current) => ({ ...current, [fund]: Number(e.target.value || 0) }))} />
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row wrap gap-sm" style={{ marginBottom: 16 }}>
          {['all', ...funds].map((fund) => (
            <button key={fund} className={`chip ${filter === fund ? 'active' : ''}`} onClick={() => setFilter(fund)}>{fund === 'all' ? 'All funds' : fund}</button>
          ))}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fund</th>
                <th>Bought</th>
                <th>Trigger date</th>
                <th>Cost</th>
                <th>Value</th>
                <th>Tax 41%</th>
                <th>Urgency</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lot) => (
                <tr key={lot.id}>
                  <td><span className="pill" style={{ borderColor: FUND_COLORS[lot.fund] }}>{lot.fund}</span></td>
                  <td className="mono small">{lot.date}</td>
                  <td className="mono small">{formatLongDate(lot.deemedDate)}</td>
                  <td className="mono">{formatEur(lot.cost)}</td>
                  <td className="mono">{formatEur(lot.currentValue)}</td>
                  <td className="mono">{formatEur(lot.taxLiability)}</td>
                  <td className={urgency(lot.days)}>{(lot.days / 365).toFixed(1)}y</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>This is a planning tool, not a tax filing engine. It estimates gains from your current price assumptions and highlights likely deemed disposal trigger years.</p>
      </section>
    </div>
  );
}
