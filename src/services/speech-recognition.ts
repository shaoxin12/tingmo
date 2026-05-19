export interface RecognitionResult {
  text: string;
  durationMs: number;
  language?: string;
  confidence?: number;
}

export interface IRecognitionProvider {
  readonly name: string;
  readonly type: 'local' | 'api';

  initialize(): Promise<boolean>;
  transcribe(audioBuffer: Buffer, sampleRate: number, lang?: string): Promise<RecognitionResult>;
  dispose(): Promise<void>;
  readonly isReady: boolean;
}
