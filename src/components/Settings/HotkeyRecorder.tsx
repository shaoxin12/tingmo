import React, { useState, useCallback, useEffect, useRef } from 'react';

interface Props {
  currentHotkey: string;
  onHotkeyChange: (key: string) => void;
  onReset: () => void;
}

const KEY_NAMES: Record<string, string> = {
  'Control': 'Ctrl',
  'Alt': 'Alt',
  'Shift': 'Shift',
  'Meta': 'Win',
  'AltGraph': 'Right Alt',
};

export const HotkeyRecorder: React.FC<Props> = ({ currentHotkey, onHotkeyChange, onReset }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
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

    if (!['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
      'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'].includes(e.code)) {
      const keyName = KEY_NAMES[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key);
      parts.push(keyName);
    }

    setRecordedKeys(parts);
  }, [isRecording]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (!isRecording) return;
    e.preventDefault();

    keysRef.current.delete(e.code);

    if (keysRef.current.size === 0 && recordedKeys.length > 0) {
      const hotkey = recordedKeys.join(' + ');
      onHotkeyChange(hotkey);
      setIsRecording(false);
      setRecordedKeys([]);
    }
  }, [isRecording, recordedKeys, onHotkeyChange]);

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

  return (
    <>
      <div className="nb-row">
        <span className="nb-label">当前快捷键</span>
        <span className={`nb-key ${isRecording ? 'recording' : ''}`}>
          {isRecording
            ? (recordedKeys.length > 0 ? recordedKeys.join(' + ') : '请按键...')
            : currentHotkey}
        </span>
      </div>
      <div className="nb-actions">
        <button
          className={`nb-btn ${isRecording ? '' : 'primary'}`}
          onClick={() => { setIsRecording(true); setRecordedKeys([]); keysRef.current.clear(); }}
          disabled={isRecording}
        >
          {isRecording ? 'RECORDING...' : '录制新快捷键'}
        </button>
        <button className="nb-btn" onClick={onReset} disabled={isRecording}>
          恢复默认
        </button>
      </div>
    </>
  );
};
