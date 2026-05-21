import React from 'react';
import { useI18n } from '../i18n/context';

interface Props {
  text: string;
  onRetry: () => void;
  onCopy: () => void;
}

export const ErrorPanel: React.FC<Props> = ({ text, onRetry, onCopy }) => {
  const { t } = useI18n();
  return (
    <div className="error-panel">
      <span className="error-text" title={text}>{text}</span>
      <div className="error-buttons">
        <button className="retry-btn" onClick={onRetry}>{t('error.retry')}</button>
        <button onClick={onCopy}>{t('error.copy')}</button>
      </div>
    </div>
  );
};
