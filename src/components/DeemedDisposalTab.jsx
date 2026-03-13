import { useEffect, useMemo, useRef, useState } from 'react';
import { FUND_CURRENT_PRICES, FUND_COLORS } from '../data/funds';
import { TRANSACTIONS_RAW } from '../data/transactions';
import { addYears, daysUntil, formatEur, formatLongDate, parseDate } from '../lib/format';
import { buildTemplateCsv, loadImportedLots, mergeImportedLots, parseDisposalCsv, saveImportedLots } from '../lib/disposalImport';

function urgency(days) {
  if (days <= 365) return 'text-red';
  if (days <= 730) return 'text-amber';
  if (days <= 1460) return 'text-blue';
  return 'text-green';
}

function downloadTemplate() {
  const blob = new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'deemed-disposal-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function DeemedDisposalTab() {
  const [filter, setFilter] = useState('all');
  const [prices, setPrices] = useState(FUND_CURRENT_PRICES);
  const [importedLots, setImportedLots] = useState([]);
  const [replaceOnImport, setReplaceOnImport] = useState(true);
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    setImportedLots(loadImportedLots());
  }, []);

  const allTransactions = useMemo(() => [...TRANSACTIONS_RAW, ...importedLots], [importedLots]);

  const allFunds = useMemo(() => {
    const set = new Set([...Object.keys(FUND_CURRENT_PRICES), ...allTransactions.map((tx) => tx.fund)]);
    return Array.from(set);
  }, [allTransactions]);

  const lots = useMemo(() => {
    return allTransactions.map((tx, index) => {
      const buyDate = parseDate(tx.date);
      const deemedDate = addYears(buyDate, 8);
      const currentPrice = Number(prices[tx.fund] || 0);
      const currentValue = tx.units * currentPrice;
      const gain = currentValue - tx.cost;
      const taxLiability = gain > 0 ? gain * 0.41 : 0;
      return {
        ...tx,
        id: `${tx.fund}-${tx.date}-${index}-${tx.source || 'seed'}`,
        deemedDate,
        days: daysUntil(deemedDate),
        currentValue,
        gain,
        taxLiability,
      };
    }).sort((a, b) => a.deemedDate - b.deemedDate);
  }, [allTransactions, prices]);

  const filtered = filter === 'all' ? lots : lots.filter((lot) => lot.fund === filter);
  const totalLiability = lots.reduce((sum, lot) => sum + lot.taxLiability, 0);
  const upcomingTwoYears = lots.filter((lot) => lot.days <= 730).reduce((sum, lot) => sum + lot.taxLiability, 0);
  const yearlyBuckets = lots.reduce((acc, lot) => {
    const year = lot.deemedDate.getFullYear();
    acc[year] = (acc[year] || 0) + lot.taxLiability;
    return acc;
  }, {});
  const funds = Array.from(new Set(allTransactions.map((tx) => tx.fund)));
  const maxYear = Math.max(...Object.values(yearlyBuckets), 1);

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImportSummary(null);

    try {
      const text = await file.text();
      const result = parseDisposalCsv(text);

      if (result.errors.length && !result.lots.length) {
        setImportError(result.errors.join(' '));
        return;
      }

      const merged = mergeImportedLots(importedLots, result.lots, replaceOnImport);
      setImportedLots(merged);
      saveImportedLots(merged);

      setPrices((current) => {
        const next = { ...current };
        result.lots.forEach((lot) => {
          if (!(lot.fund in next)) next[lot.fund] = Number(lot.price || 0);
        });
        return next;
      });

      setImportSummary({
        fileName: file.name,
        imported: result.lots.length,
        skipped: result.skipped,
        duplicatesIgnored: replaceOnImport ? 0 : result.lots.length - (merged.length - importedLots.length),
        mode: replaceOnImport ? 'replaced' : 'added',
        errors: result.errors,
        detectedFormat: result.detectedFormat,
        summaryByFund: result.summaryByFund || [],
      });
    } catch (error) {
      setImportError(error.message || 'Unable to read that file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function clearImportedData() {
    setImportedLots([]);
    saveImportedLots([]);
    setImportSummary({ fileName: '', imported: 0, skipped: 0, duplicatesIgnored: 0, mode: 'cleared', errors: [] });
    setImportError('');
  }

  return (
    <div className="grid gap-xl">
      <section className="card">
        <div className="stats-row">
          <div className="stat-box"><small>Total est. liability</small><strong>{formatEur(totalLiability)}</strong></div>
          <div className="stat-box warn"><small>Due within 2 years</small><strong>{formatEur(upcomingTwoYears)}</strong></div>
          <div className="stat-box"><small>Earliest trigger</small><strong>{lots[0] ? formatLongDate(lots[0].deemedDate) : '—'}</strong></div>
          <div className="stat-box"><small>Imported lots</small><strong>{importedLots.length}</strong></div>
        </div>
      </section>

      <section className="card">
        <div className="section-head compact">
          <div>
            <p className="eyebrow">Import transaction history</p>
            <h2>Upload ETF buys for deemed disposal</h2>
          </div>
          <div className="row wrap gap-sm mobile-stack">
            <button className="button secondary" type="button" onClick={downloadTemplate}>Download CSV template</button>
            <button className="button ghost" type="button" onClick={clearImportedData}>Clear imported lots</button>
          </div>
        </div>

        <div className="import-box">
          <div className="list-stack" style={{ gap: 10 }}>
            <p className="muted" style={{ margin: 0 }}>
              Upload a CSV with at least <span className="mono">Date</span>, <span className="mono">Fund</span>, and <span className="mono">Units</span> columns.
              DeGiro transaction exports are now recognised automatically. Price and Cost are optional for generic CSVs.
            </p>
            <label className="checkbox-row">
              <input type="checkbox" checked={replaceOnImport} onChange={(e) => setReplaceOnImport(e.target.checked)} />
              <span>{replaceOnImport ? 'Replace previous imported lots on next upload' : 'Add new lots on top of previous imports'}</span>
            </label>
          </div>

          <label className="upload-dropzone" htmlFor="disposal-csv-upload">
            <input
              id="disposal-csv-upload"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportFile}
              hidden
            />
            <strong>Choose CSV file</strong>
            <span className="muted">DeGiro transaction exports should import directly. Generic CSVs still work if the core columns are there.</span>
          </label>

          {importError && <div className="notice error">{importError}</div>}
          {importSummary && (
            <div className="notice success">
              {importSummary.mode === 'cleared' ? (
                <span>Imported lots cleared.</span>
              ) : (
                <>
                  <strong>{importSummary.fileName}</strong>: {importSummary.imported} lots {importSummary.mode}, {importSummary.skipped} rows skipped
                  {importSummary.duplicatesIgnored > 0 ? `, ${importSummary.duplicatesIgnored} duplicates ignored` : ''}. Detected format: {importSummary.detectedFormat || 'CSV'}.
                  {importSummary.errors?.length ? ` ${importSummary.errors[0]}` : ''}
                  {importSummary.summaryByFund?.length ? (
                    <span> Summary: {importSummary.summaryByFund.map((item) => `${item.fund} (${item.count} lots)`).join(', ')}.</span>
                  ) : null}
                </>
              )}
            </div>
          )}
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
          {allFunds.map((fund) => (
            <label key={fund} className="field">
              <span>{fund}</span>
              <input className="input" type="number" step="0.01" value={prices[fund] ?? 0} onChange={(e) => setPrices((current) => ({ ...current, [fund]: Number(e.target.value || 0) }))} />
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
                <th>Units</th>
                <th>Trigger date</th>
                <th>Cost</th>
                <th>Value</th>
                <th>Tax 41%</th>
                <th>Source</th>
                <th>Urgency</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lot) => (
                <tr key={lot.id}>
                  <td><span className="pill" style={{ borderColor: FUND_COLORS[lot.fund] || 'rgba(255,255,255,0.2)' }}>{lot.fund}</span></td>
                  <td className="mono small">{lot.date}</td>
                  <td className="mono">{lot.units}</td>
                  <td className="mono small">{formatLongDate(lot.deemedDate)}</td>
                  <td className="mono">{formatEur(lot.cost)}</td>
                  <td className="mono">{formatEur(lot.currentValue)}</td>
                  <td className="mono">{formatEur(lot.taxLiability)}</td>
                  <td className="small">{lot.source === 'imported' ? 'Imported' : 'Seeded'}</td>
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
