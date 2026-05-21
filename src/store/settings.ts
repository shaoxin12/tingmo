import { create } from 'zustand';

export type ASRProvider = 'local' | 'cloud';
export type RecordMode = 'toggle' | 'hold';
export type Language = 'zh' | 'en';
export type TranslateLang = 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es';
export type UILanguage = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko';

export interface DictEntry {
  word: string;
  replace: string;
}

export interface SettingsState {
  asrProvider: ASRProvider;
  recordMode: RecordMode;
  language: Language;
  hotkey: string;
  translateHotkey: string;
  launchAtStartup: boolean;
  muteOnRecord: boolean;
  useDictionary: boolean;
  translateTarget: TranslateLang;
  dictionary: DictEntry[];
  refineEnabled: boolean;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl: string;
  uiLanguage: UILanguage;

  setAsrProvider: (p: ASRProvider) => void;
  setRecordMode: (mode: RecordMode) => void;
  setLanguage: (lang: Language) => void;
  setHotkey: (key: string) => void;
  setTranslateHotkey: (key: string) => void;
  setLaunchAtStartup: (enabled: boolean) => void;
  setMuteOnRecord: (enabled: boolean) => void;
  setUseDictionary: (enabled: boolean) => void;
  setTranslateTarget: (lang: TranslateLang) => void;
  addDictEntry: (entry: DictEntry) => void;
  removeDictEntry: (index: number) => void;
  resetHotkey: () => void;
  resetTranslateHotkey: () => void;
  setRefineEnabled: (enabled: boolean) => void;
  setLlmApiKey: (key: string) => void;
  setLlmModel: (model: string) => void;
  setLlmBaseUrl: (url: string) => void;
  setUiLanguage: (lang: UILanguage) => void;
}

const DEFAULT_HOTKEY = '右 Alt';
const DEFAULT_TRANSLATE_HOTKEY = '右 Alt + 右 Shift';

export const useSettingsStore = create<SettingsState>((set) => ({
  asrProvider: 'local',
  recordMode: 'toggle',
  language: 'zh',
  hotkey: DEFAULT_HOTKEY,
  translateHotkey: DEFAULT_TRANSLATE_HOTKEY,
  launchAtStartup: false,
  muteOnRecord: true,
  useDictionary: true,
  translateTarget: 'en',
  dictionary: [],
  refineEnabled: false,
  llmApiKey: '',
  llmModel: 'gpt-4o-mini',
  llmBaseUrl: 'https://api.openai.com/v1',
  uiLanguage: 'zh-CN',

  setAsrProvider: (p) => set({ asrProvider: p }),
  setRecordMode: (mode) => set({ recordMode: mode }),
  setLanguage: (lang) => set({ language: lang }),
  setHotkey: (key) => set({ hotkey: key }),
  setTranslateHotkey: (key) => set({ translateHotkey: key }),
  setLaunchAtStartup: (enabled) => set({ launchAtStartup: enabled }),
  setMuteOnRecord: (enabled) => set({ muteOnRecord: enabled }),
  setUseDictionary: (enabled) => set({ useDictionary: enabled }),
  setTranslateTarget: (lang) => set({ translateTarget: lang }),
  addDictEntry: (entry) => set((s) => ({ dictionary: [...s.dictionary, entry] })),
  removeDictEntry: (index) => set((s) => ({ dictionary: s.dictionary.filter((_, i) => i !== index) })),
  resetHotkey: () => set({ hotkey: DEFAULT_HOTKEY }),
  resetTranslateHotkey: () => set({ translateHotkey: DEFAULT_TRANSLATE_HOTKEY }),
  setRefineEnabled: (enabled) => set({ refineEnabled: enabled }),
  setLlmApiKey: (key) => set({ llmApiKey: key }),
  setLlmModel: (model) => set({ llmModel: model }),
  setLlmBaseUrl: (url) => set({ llmBaseUrl: url }),
  setUiLanguage: (lang) => set({ uiLanguage: lang }),
}));
