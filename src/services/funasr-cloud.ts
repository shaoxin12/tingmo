import type { IRecognitionProvider, RecognitionResult } from './speech-recognition';

export class FunASRCloudProvider implements IRecognitionProvider {
  readonly name = 'FunASR-Cloud';
  readonly type = 'api' as const;
  readonly vadEnabled = false;
  isReady = false;

  constructor(private apiKey: string, private endpoint: string) {}

  async initialize(): Promise<boolean> {
    if (!this.apiKey || !this.endpoint) {
      console.log('[FunASR-Cloud] No API key or endpoint configured');
      this.isReady = false;
      return false;
    }
    this.isReady = true;
    console.log('[FunASR-Cloud] Ready');
    return true;
  }

  async transcribe(audioBuffer: Buffer, _sampleRate: number, lang?: string): Promise<RecognitionResult> {
    const t0 = performance.now();

    // TODO: POST WAV to cloud ASR endpoint
    // POST <endpoint>/api/recognize with form-data: audio=@audio.wav, language=lang
    // Parse response JSON: { text, language, confidence }

    console.log('[FunASR-Cloud] Transcribe not yet implemented, buffer size:', audioBuffer.length);
    await new Promise(r => setTimeout(r, 300));

    return {
      text: '（云端 ASR 尚未实现）',
      durationMs: performance.now() - t0,
      language: lang || 'zh',
    };
  }

  async dispose(): Promise<void> {
    this.isReady = false;
  }
}
