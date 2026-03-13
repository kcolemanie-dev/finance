import { useEffect, useMemo, useState } from 'react';
import { formatEur, toInputDate } from '../lib/format';
import { loadJson, saveJson } from '../lib/storage';
import { getOverviewAnalysis } from '../lib/api';

const ACCOUNT_KEYS = [
  'BOI Current',
  'BOI Savings',
  'DeGiro Portfolio',
  'Credit Union',
  'Revolut',
  'Revolut Robo-Advisor',
  'Zurich Pension',
  'Zurich Investment',
];

const LIQUID_KEYS = ['BOI Current', 'BOI Savings', 'Credit Union', 'Revolut'];
const UPCOMING_TEMPLATE = [
  { id: crypto.randomUUID(), name: 'Car insurance', amount: '', dueDate: '', category: 'Annual', notes: '' },
  { id: crypto.randomUUID(), name: 'NCT / service', amount: '', dueDate: '', category: 'Car', notes: '' },
];

function emptyAccounts() {
  return Object.fromEntries(ACCOUNT_KEYS.map((key) => [key, '']));
}

export default function OverviewTab() {
  const [accounts, setAccounts] = useState(emptyAccounts);
  const [snapshotDate, setSnapshotDate] = useState(toInputDate());
  const [history, setHistory] = useState([]);
  const [upcoming, setUpcoming] = useState(UPCOMING_TEMPLATE);
  const [notes, setNotes] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  useEffect(() => {
    setHistory(loadJson('fd-history', []));
    setUpcoming(loadJson('fd-upcoming', UPCOMING_TEMPLATE));
    setNotes(loadJson('fd-notes', ''));
  }, []);

  useEffect(() => saveJson('fd-upcoming', upcoming), [upcoming]);
  useEffect(() => saveJson('fd-notes', notes), [notes]);

  const total = useMemo(
    () => Object.values(accounts).reduce((sum, value) => sum + (parseFloat(value) || 0), 0),
    [accounts]
  );
  const liquid = useMemo(
    () => LIQUID_KEYS.reduce((sum, key) => sum + (parseFloat(accounts[key]) || 0), 0),
    [accounts]
  );
  const invested = total - liquid;
  const next90Days = upcoming.reduce((sum, item) => {
    if (!item.dueDate || !item.amount) return sum;
    const days = Math.floor((new Date(item.dueDate) - new Date()) / 86400000);
    return days >= 0 && days <= 90 ? sum + Number(item.amount) : sum;
  }, 0);

  function saveSnapshot() {
    const entry = { date: snapshotDate, accounts, total, liquid, invested };
    const updated = [...history.filter((row) => row.date !== snapshotDate), entry].sort((a, b) => a.date.localeCompare(b.date));
    setHistory(updated);
    saveJson('fd-history', updated);
  }

  function deleteSnapshot(date) {
    const updated = history.filter((row) => row.date !== date);
    setHistory(updated);
    saveJson('fd-history', updated);
  }

  async function runAnalysis() {
    saveSnapshot();
    setLoading(true);
    setAnalysis('');
    try {
      const data = await getOverviewAnalysis({
        snapshotDate,
        accounts,
        total,
        liquid,
        invested,
        history,
        upcoming,
        notes,
      });
      setAnalysis(data.analysis);
    } catch (error) {
      setAnalysis(error.message || 'Unable to analyse right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid cols-2 gap-xl">
      <section className="card span-2">
        <div className="section-head">
          <div>
            <p className="eyebrow">Financial overview</p>
            <h2>Current balances</h2>
          </div>
          <input className="input" type="date" value={snapshotDate} onChange={(e) => setSnapshotDate(e.target.value)} />
        </div>

        <div className="account-grid">
          {ACCOUNT_KEYS.map((key) => (
            <label key={key} className="field">
              <span>{key}</span>
              <input
                className="input"
                inputMode="decimal"
                type="number"
                placeholder="0.00"
                value={accounts[key]}
                onChange={(e) => setAccounts((current) => ({ ...current, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>

        <div className="stats-row">
          <div className="stat-box">
            <small>Total net worth</small>
            <strong>{formatEur(total)}</strong>
          </div>
          <div className="stat-box">
            <small>Liquid cash</small>
            <strong>{formatEur(liquid)}</strong>
          </div>
          <div className="stat-box">
            <small>Invested / growth</small>
            <strong>{formatEur(invested)}</strong>
          </div>
          <div className="stat-box warn">
            <small>Known next 90 days</small>
            <strong>{formatEur(next90Days)}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-head compact">
          <div>
            <p className="eyebrow">Upcoming cashflow</p>
            <h2>Known bills & reminders</h2>
          </div>
          <button
            className="button secondary"
            onClick={() =>
              setUpcoming((rows) => [
                ...rows,
                { id: crypto.randomUUID(), name: '', amount: '', dueDate: '', category: '', notes: '' },
              ])
            }
          >
            Add row
          </button>
        </div>

        <div className="list-stack">
          {upcoming.map((item, index) => (
            <div key={item.id} className="mini-card">
              <div className="row split gap-md mobile-stack">
                <input
                  className="input"
                  placeholder="Expense or income"
                  value={item.name}
                  onChange={(e) =>
                    setUpcoming((rows) => rows.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))
                  }
                />
                <input
                  className="input"
                  type="number"
                  placeholder="Amount"
                  value={item.amount}
                  onChange={(e) =>
                    setUpcoming((rows) => rows.map((row, i) => (i === index ? { ...row, amount: e.target.value } : row)))
                  }
                />
                <input
                  className="input"
                  type="date"
                  value={item.dueDate}
                  onChange={(e) =>
                    setUpcoming((rows) => rows.map((row, i) => (i === index ? { ...row, dueDate: e.target.value } : row)))
                  }
                />
              </div>
              <div className="row split gap-md mobile-stack">
                <input
                  className="input"
                  placeholder="Category"
                  value={item.category}
                  onChange={(e) =>
                    setUpcoming((rows) => rows.map((row, i) => (i === index ? { ...row, category: e.target.value } : row)))
                  }
                />
                <input
                  className="input"
                  placeholder="Notes"
                  value={item.notes}
                  onChange={(e) =>
                    setUpcoming((rows) => rows.map((row, i) => (i === index ? { ...row, notes: e.target.value } : row)))
                  }
                />
                <button className="button ghost" onClick={() => setUpcoming((rows) => rows.filter((_, i) => i !== index))}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Context for analysis</p>
        <h2>Notes & concerns</h2>
        <textarea
          className="textarea"
          rows="10"
          placeholder="Salary changes, upcoming travel, worries about cashflow, bonus timing, mortgage goals..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button className="button primary full-width" disabled={loading || total === 0} onClick={runAnalysis}>
          {loading ? 'Analysing…' : 'Save snapshot & analyse'}
        </button>
        {analysis && <div className="analysis-box"><pre>{analysis}</pre></div>}
      </section>

      <section className="card span-2">
        <div className="section-head compact">
          <div>
            <p className="eyebrow">Snapshot history</p>
            <h2>{history.length} saved snapshots</h2>
          </div>
          <button className="button secondary" onClick={() => setShowHistory((s) => !s)}>{showHistory ? 'Hide' : 'Show'}</button>
        </div>
        {showHistory && (
          <div className="list-stack">
            {history.length === 0 && <p className="muted">No snapshots yet.</p>}
            {history.map((row) => (
              <div key={row.date} className="history-row">
                <div>
                  <strong>{row.date}</strong>
                  <p className="muted">Liquid {formatEur(row.liquid)} · Invested {formatEur(row.invested)}</p>
                </div>
                <div className="row gap-sm">
                  <span className="mono">{formatEur(row.total)}</span>
                  <button className="button ghost" onClick={() => deleteSnapshot(row.date)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
