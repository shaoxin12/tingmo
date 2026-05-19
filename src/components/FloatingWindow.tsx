import React, { useEffect, useRef, useState } from 'react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { useSettingsStore } from '../store/settings';
import { BreathingLight } from './BreathingLight';
import { Waveform } from './Waveform';
import { StatusOverlay } from './StatusOverlay';
import { ErrorPanel } from './ErrorPanel';

export const FloatingWindow: React.FC = () => {
  const { state, errorText, retry, copy } = useVoiceInput();
  const { audioLevel, startCapture, stopCapture } = useAudioCapture();
  const language = useSettingsStore((s) => s.language);
  const [toneClass, setToneClass] = useState('');
  const sentAudioRef = useRef(false);

  useEffect(() => {
    if (state === 'recording') {
      startCapture();
      setToneClass('');
      sentAudioRef.current = false;
    } else if (state === 'idle') {
      stopCapture();
      setToneClass('');
      sentAudioRef.current = false;
    } else if (state === 'recognizing') {
      const wavBuffer = stopCapture();
      setToneClass('');
      if (wavBuffer && !sentAudioRef.current) {
        sentAudioRef.current = true;
        window.tingmo?.transcribe(wavBuffer, language);
      } else if (!wavBuffer) {
        window.tingmo?.reportCaptureError('没有采集到音频，请检查麦克风权限');
      }
    } else if (state === 'success') {
      setToneClass('success');
    } else if (state === 'error') {
      setToneClass('error');
    }
  }, [state, startCapture, stopCapture]);

  if (state === 'idle') return null;

  return (
    <div className={`floating-window capsule ${state} ${toneClass}`} title={errorText ?? ''}>
      <div className="capsule-body">
        <BreathingLight state={state} />
        {state === 'recording' && <Waveform audioLevel={audioLevel} />}
        {state === 'recognizing' && <StatusOverlay text="识别中" />}
        {state === 'success' && <StatusOverlay text="完成" />}
        {state === 'error' && (
          errorText ? (
            <ErrorPanel text={errorText} onRetry={retry} onCopy={copy} />
          ) : (
            <StatusOverlay text="失败" />
          )
        )}
      </div>
    </div>
  );
};
