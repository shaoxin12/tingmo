import React, { useEffect, useRef, useState } from 'react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { useSettingsStore } from '../store/settings';
import { useI18n } from '../i18n/context';
import { BreathingLight } from './BreathingLight';
import { Waveform } from './Waveform';
import { StatusOverlay } from './StatusOverlay';
import { ErrorPanel } from './ErrorPanel';

export const FloatingWindow: React.FC = () => {
  const { state, errorText, translateMode, retry, copy } = useVoiceInput();
  const { audioLevel, startCapture, stopCapture } = useAudioCapture();
  const { t } = useI18n();
  const language = useSettingsStore((s) => s.language);
  const translateTarget = useSettingsStore((s) => s.translateTarget);
  const useDictionary = useSettingsStore((s) => s.useDictionary);
  const dictionary = useSettingsStore((s) => s.dictionary);
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
      const result = stopCapture();
      setToneClass('');
      if (result && !sentAudioRef.current) {
        sentAudioRef.current = true;
        const opts = {
          translate: translateMode,
          translateTarget,
          dictionary: useDictionary ? dictionary : [],
        };
        window.tingmo.transcribe(result.wav, language, opts);
      } else if (!result) {
        window.tingmo?.reportCaptureError(t('error.noAudioCaptured'));
      }
    } else if (state === 'success') {
      setToneClass('success');
    } else if (state === 'error') {
      setToneClass('error');
    }
  }, [state, startCapture, stopCapture, language, translateMode, translateTarget, useDictionary, dictionary, t]);

  if (state === 'idle') return null;

  return (
    <div className={`floating-window capsule ${state} ${toneClass}`} title={errorText ?? ''}>
      <div className="capsule-body">
        <BreathingLight state={state} />
        {state === 'recording' && <Waveform audioLevel={audioLevel} />}
        {state === 'recognizing' && <StatusOverlay text={t('status.recognizing')} />}
        {state === 'refining' && <StatusOverlay text={t('status.refining')} />}
        {state === 'success' && <StatusOverlay text={t('status.success')} />}
        {state === 'error' && (
          errorText ? (
            <ErrorPanel text={errorText} onRetry={retry} onCopy={copy} />
          ) : (
            <StatusOverlay text={t('status.error')} />
          )
        )}
      </div>
    </div>
  );
};
