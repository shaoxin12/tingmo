import { app } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

// ── Types ───────────────────────────────────────────────────────
export interface HistoryEntry {
  id: string;
  text: string;
  charCount: number;
  timestamp: number;
  originalText?: string;
  provider?: string;
}

export interface Stats {
  totalDurationMs: number;
  totalCharCount: number;
  totalSessions: number;
}

// ── Paths ───────────────────────────────────────────────────────
function dataDir(): string {
  const dir = join(app.getPath('userData'), 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function statsPath(): string { return join(dataDir(), 'stats.json'); }
function historyPath(): string { return join(dataDir(), 'history.json'); }

// ── Stats ───────────────────────────────────────────────────────
let statsCache: Stats | null = null;

export function loadStats(): Stats {
  if (statsCache) return statsCache;
  try {
    statsCache = JSON.parse(readFileSync(statsPath(), 'utf-8'));
  } catch {
    statsCache = { totalDurationMs: 0, totalCharCount: 0, totalSessions: 0 };
  }
  return statsCache as Stats;
}

function saveStats(s: Stats): void {
  statsCache = s;
  writeFileSync(statsPath(), JSON.stringify(s), 'utf-8');
}

export function addRecordingStats(durationMs: number, charCount: number): void {
  const s = loadStats();
  s.totalDurationMs += durationMs;
  s.totalCharCount += charCount;
  s.totalSessions += 1;
  saveStats(s);
}

// ── History ─────────────────────────────────────────────────────
let historyCache: HistoryEntry[] | null = null;

export function loadHistory(): HistoryEntry[] {
  if (historyCache) return historyCache;
  try {
    historyCache = JSON.parse(readFileSync(historyPath(), 'utf-8'));
  } catch {
    historyCache = [];
  }
  return historyCache as HistoryEntry[];
}

function saveHistory(h: HistoryEntry[]): void {
  historyCache = h;
  writeFileSync(historyPath(), JSON.stringify(h), 'utf-8');
}

export function addHistoryEntry(text: string, charCount: number, originalText?: string, provider?: string | null): HistoryEntry {
  const entry: HistoryEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    charCount,
    timestamp: Date.now(),
    ...(originalText ? { originalText } : {}),
    ...(provider ? { provider } : {}),
  };
  const h = loadHistory();
  h.unshift(entry); // newest first
  // Keep last 200 entries
  if (h.length > 200) h.length = 200;
  saveHistory(h);
  return entry;
}

export function clearHistory(): void {
  saveHistory([]);
  statsCache = { totalDurationMs: 0, totalCharCount: 0, totalSessions: 0 };
  saveStats(statsCache);
}
