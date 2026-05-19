import React from 'react';

interface Props {
  text: string;
  onRetry: () => void;
  onCopy: () => void;
}

export const ErrorPanel: React.FC<Props> = ({ text, onRetry, onCopy }) => {
  return (
    <div className="error-panel">
      <span className="error-text" title={text}>{text}</span>
      <div className="error-buttons">
        <button className="retry-btn" onClick={onRetry}>重试</button>
        <button onClick={onCopy}>复制</button>
      </div>
    </div>
  );
};
