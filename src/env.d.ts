/// <reference types="vite/client" />

interface TingMoAPI {
  onVoiceStateChange: (cb: (data: { state: string }) => void) => () => void;
  onAudioLevel: (cb: (level: number) => void) => () => void;
  onRecognitionDone: (cb: (data: { charCount: number; durationMs: number }) => void) => () => void;
  onInjectFailed: (cb: (data: { text: string }) => void) => () => void;
  openSettings: () => Promise<void>;
  finishRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  reportCaptureError: (message: string) => Promise<void>;
  retryInject: (text: string) => Promise<{ success: boolean }>;
  copyText: (text: string) => Promise<void>;
  transcribe: (audioBuffer: ArrayBuffer, language?: string) => Promise<void>;
}

declare global {
  interface Window {
    tingmo: TingMoAPI;
  }
}
