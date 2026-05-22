import { useState, useEffect, useCallback } from 'react';

export type VoiceState = 'idle' | 'recording' | 'recognizing' | 'refining' | 'success' | 'error';

interface VoiceInputState {
  state: VoiceState;
  charCount: number | null;
  errorText: string | null;
}

export function useVoiceInput() {
  const [voiceState, setVoiceState] = useState<VoiceInputState>({
    state: 'idle',
    charCount: null,
    errorText: null,
  });
  const [translateMode, setTranslateMode] = useState(false);

  useEffect(() => {
    const api = window.tingmo;
    if (!api) return;

    const unsub1 = api.onVoiceStateChange((data) => {
      setVoiceState((prev) => ({
        ...prev,
        state: data.state as VoiceState,
      }));
      if (data.state === 'idle') setTranslateMode(false);
    });

    const unsub2 = api.onRecognitionDone((data) => {
      setVoiceState({
        state: 'success',
        charCount: data.charCount,
        errorText: null,
      });
    });

    const unsub3 = api.onInjectFailed((data) => {
      setVoiceState({
        state: 'error',
        charCount: null,
        errorText: data.text,
      });
    });

    const unsub4 = api.onTranslateMode?.((data: { enabled: boolean }) => {
      setTranslateMode(data.enabled);
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4?.();
    };
  }, []);

  const retry = useCallback(async () => {
    if (voiceState.errorText) {
      await window.tingmo?.retryInject(voiceState.errorText);
    }
  }, [voiceState.errorText]);

  const copy = useCallback(async () => {
    if (voiceState.errorText) {
      await window.tingmo?.copyText(voiceState.errorText);
    }
  }, [voiceState.errorText]);

  const finish = useCallback(async () => {
    await window.tingmo?.finishRecording();
  }, []);

  const cancel = useCallback(async () => {
    await window.tingmo?.cancelRecording();
  }, []);

  return {
    state: voiceState.state,
    charCount: voiceState.charCount,
    errorText: voiceState.errorText,
    translateMode,
    retry,
    copy,
    finish,
    cancel,
  };
}
