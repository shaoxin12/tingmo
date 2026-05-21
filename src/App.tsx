import React, { useEffect } from 'react';
import { I18nProvider } from './i18n/context';
import { useSettingsStore } from './store/settings';
import { FloatingWindow } from './components/FloatingWindow';
import { SettingsWindow } from './components/Settings/SettingsWindow';

const AppInner: React.FC = () => {
  const isSettings = window.location.hash === '#/settings';

  if (isSettings) {
    return <SettingsWindow />;
  }

  return <FloatingWindow />;
};

export const App: React.FC = () => {
  const setUiLanguage = useSettingsStore((s) => s.setUiLanguage);

  // Detect system language on first load
  useEffect(() => {
    window.tingmo?.getSystemLocale().then((locale) => {
      if (locale) setUiLanguage(locale as any);
    }).catch(() => {});
  }, [setUiLanguage]);

  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
};
