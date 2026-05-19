import React from 'react';
import { FloatingWindow } from './components/FloatingWindow';
import { SettingsWindow } from './components/Settings/SettingsWindow';

export const App: React.FC = () => {
  const isSettings = window.location.hash === '#/settings';

  if (isSettings) {
    return <SettingsWindow />;
  }

  return <FloatingWindow />;
};
