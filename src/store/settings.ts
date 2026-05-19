import { create } from 'zustand';

export type VoiceMode = 'local' | 'api';
export type RecordMode = 'toggle' | 'hold';
export type Language = 'zh' | 'en';

export interface SettingsState {
  voiceMode: VoiceMode;
  recordMode: RecordMode;
  language: Language;
  hotkey: string;
  launchAtStartup: boolean;

  setVoiceMode: (mode: VoiceMode) => void;
  setRecordMode: (mode: RecordMode) => void;
  setLanguage: (lang: Language) => void;
  setHotkey: (key: string) => void;
  setLaunchAtStartup: (enabled: boolean) => void;
  resetHotkey: () => void;
}

const DEFAULT_HOTKEY = '右 Alt';

export const useSettingsStore = create<SettingsState>((set) => ({
  voiceMode: 'local',
  recordMode: 'toggle',
  language: 'zh',
  hotkey: DEFAULT_HOTKEY,
  launchAtStartup: false,

  setVoiceMode: (mode) => set({ voiceMode: mode }),
  setRecordMode: (mode) => set({ recordMode: mode }),
  setLanguage: (lang) => set({ language: lang }),
  setHotkey: (key) => set({ hotkey: key }),
  setLaunchAtStartup: (enabled) => set({ launchAtStartup: enabled }),
  resetHotkey: () => set({ hotkey: DEFAULT_HOTKEY }),
}));
