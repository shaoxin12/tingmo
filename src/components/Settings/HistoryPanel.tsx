import React, { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/context';

interface Stats {
  totalDurationMs: number;
  totalCharCount: number;
  totalSessions: number;
}

interface HistoryEntry {
  id: string;
  text: string;
  charCount: number;
  timestamp: number;
}

function formatDuration(ms: number, t: (key: string) => string): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return totalSec + t('history.unit.seconds');
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min + t('history.unit.minutes') + ' ' + sec + t('history.unit.seconds');
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const HistoryPanel: React.FC = () => {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const load = () => {
    window.tingmo?.getStats().then(setStats);
    window.tingmo?.getHistory().then(setHistory);
  };

  useEffect(() => { load(); }, []);

  const handleClear = async () => {
    await window.tingmo?.clearHistory();
    setHistory([]);
    setStats({ totalDurationMs: 0, totalCharCount: 0, totalSessions: 0 });
  };

  return (
    <section className="nb-section">
      <h2 className="nb-section-title">
        <span className="nb-tag accent">{t('section.history')}</span>
      </h2>

      {/* Stats summary */}
      {stats && (
        <div className="nb-card" style={{ marginBottom: 12 }}>
          <div className="nb-row">
            <span className="nb-label">{t('history.totalDuration')}</span>
            <span className="nb-value">{formatDuration(stats.totalDurationMs, t)}</span>
          </div>
          <div className="nb-hr" />
          <div className="nb-row">
            <span className="nb-label">{t('history.totalCharCount')}</span>
            <span className="nb-value">{stats.totalCharCount.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* History list */}
      {history.length > 0 && (
        <>
          <div className="nb-row" style={{ marginBottom: 8 }}>
            <span className="nb-label">{t('history.recentRecords')}</span>
            <button className="nb-btn" onClick={handleClear}>{t('history.clear')}</button>
          </div>
          <div className="nb-card" style={{ padding: 0 }}>
            {history.map((entry) => (
              <div key={entry.id} className="history-item">
                <div className="history-meta">
                  <span>{formatTime(entry.timestamp)}</span>
                  <span>{entry.charCount} {t('history.unit.characters')}</span>
                </div>
                <div className="history-text">{entry.text}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {history.length === 0 && !stats && (
        <div className="nb-card">
          <p style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            {t('history.empty')}
          </p>
        </div>
      )}
    </section>
  );
};
