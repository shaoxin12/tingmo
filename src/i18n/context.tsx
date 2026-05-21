// i18n React Context — provides locale + translate function

import React, { createContext, useContext } from 'react';
import type { Locale } from './translations';
import { translate } from './translations';
import { useSettingsStore } from '../store/settings';

interface I18nContextValue {
  locale: Locale;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh-CN',
  t: (key: string) => translate(key, 'zh-CN'),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const uiLanguage = useSettingsStore((s) => s.uiLanguage);
  const locale = uiLanguage as Locale;

  const value: I18nContextValue = {
    locale,
    t: (key: string) => translate(key, locale),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
