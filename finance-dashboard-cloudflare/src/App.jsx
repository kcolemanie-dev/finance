import { useState } from 'react';
import OverviewTab from './components/OverviewTab';
import PortfolioTab from './components/PortfolioTab';
import DeemedDisposalTab from './components/DeemedDisposalTab';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'portfolio', label: 'ETF Portfolio' },
  { id: 'disposal', label: 'Deemed Disposal' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Personal finance agent</p>
          <h1>Finance Dashboard</h1>
          <p className="subtitle">Balances, ETF tracking, cashflow watch-outs, and an Irish deemed disposal planner.</p>
        </div>
      </header>

      <nav className="tabbar">
        {tabs.map((tab) => (
          <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="content-wrap">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'portfolio' && <PortfolioTab />}
        {activeTab === 'disposal' && <DeemedDisposalTab />}
      </main>
    </div>
  );
}
