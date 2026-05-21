import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/context';

interface Props {
  currentHotkey: string;
  onHotkeyChange: (key: string) => void;
  onReset: () => void;
}

// Map key codes to i18n keys
function keyCodeToI18n(code: string): string {
  if (code.includes('Right')) {
    if (code.startsWith('Control')) return 'hotkey.key.rightCtrl';
    if (code.startsWith('Alt')) return 'hotkey.key.rightAlt';
    if (code.startsWith('Shift')) return 'hotkey.key.rightShift';
  }
  if (code.includes('Left')) {
    if (code.startsWith('Control')) return 'hotkey.key.leftCtrl';
    if (code.startsWith('Alt')) return 'hotkey.key.leftAlt';
    if (code.startsWith('Shift')) return 'hotkey.key.leftShift';
  }
  if (code.startsWith('Meta')) return 'hotkey.key.win';
  return '';
}

export const HotkeyRecorder: React.FC<Props> = ({ currentHotkey, onHotkeyChange, onReset }) => {
  const { t } = useI18n();
  const [isRecording, setIsRecording] = useState(false);
  const [display, setDisplay] = useState('');
  const keysRef = useRef<Set<string>>(new Set());

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isRecording) return;
    e.preventDefault();
    e.stopPropagation();
    keysRef.current.add(e.code);

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Win');

    const i18nKey = keyCodeToI18n(e.code);
    if (i18nKey) {
      parts.push(t(i18nKey));
    } else if (!['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
      'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'].includes(e.code)) {
      parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    }

    setDisplay(parts.join(' + '));
  }, [isRecording, t]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (!isRecording) return;
    e.preventDefault();
    keysRef.current.delete(e.code);
    if (keysRef.current.size === 0 && display) {
      onHotkeyChange(display);
      setIsRecording(false);
    }
  }, [isRecording, display, onHotkeyChange]);

  useEffect(() => {
    if (isRecording) {
      window.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('keyup', handleKeyUp, true);
      return () => {
        window.removeEventListener('keydown', handleKeyDown, true);
        window.removeEventListener('keyup', handleKeyUp, true);
      };
    }
  }, [isRecording, handleKeyDown, handleKeyUp]);

  const handleClick = () => {
    if (!isRecording) {
      setIsRecording(true);
      setDisplay('');
      keysRef.current.clear();
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReset();
  };

  return (
    <div className="hotkey-row">
      <span
        className={`nb-key hotkey-target ${isRecording ? 'recording' : ''}`}
        onClick={handleClick}
        title={isRecording ? t('hotkey.recordingTooltip') : t('hotkey.clickToReset')}
      >
        {isRecording ? (display || t('hotkey.recordingPlaceholder')) : currentHotkey}
      </span>
      <button className="hotkey-reset" onClick={handleReset} title={t('hotkey.resetToDefault')}>↺</button>
    </div>
  );
};
