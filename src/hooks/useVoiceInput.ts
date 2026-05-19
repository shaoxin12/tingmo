import { useState, useEffect, useCallback } from 'react';

export type VoiceState = 'idle' | 'recording' | 'recognizing' | 'success' | 'error';

interface VoiceInputState {
  state: VoiceState;
  charCount: number | null;
  errorText: string | null;
}

declare global {
  interface Window {
    tingmo: {
      onVoiceStateChange: (cb: (data: { state: VoiceState }) => void) => () => void;
      onRecognitionDone: (cb: (data: { charCount: number; durationMs: number }) => void) => () => void;
      onInjectFailed: (cb: (data: { text: string }) => void) => () => void;
      finishRecording: () => Promise<void>;
      cancelRecording: () => Promise<void>;
      reportCaptureError: (message: string) => Promise<void>;
      retryInject: (text: string) => Promise<{ success: boolean }>;
      copyText: (text: string) => Promise<void>;
      transcribe: (audioBuffer: ArrayBuffer, language?: string) => Promise<void>;
    };
  }
}

export function useVoiceInput() {
  const [voiceState, setVoiceState] = useState<VoiceInputState>({
    state: 'idle',
    charCount: null,
    errorText: null,
  });

  useEffect(() => {
    const api = window.tingmo;
    if (!api) return;

    const unsub1 = api.onVoiceStateChange((data) => {
      setVoiceState((prev) => ({
        ...prev,
        state: data.state,
      }));
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

    return () => {
      unsub1();
      unsub2();
      unsub3();
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
    retry,
    copy,
    finish,
    cancel,
  };
}
