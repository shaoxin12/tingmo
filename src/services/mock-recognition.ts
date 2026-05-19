import type { IRecognitionProvider, RecognitionResult } from './speech-recognition';

const MOCK_TEXTS = [
  '这是一段通过听墨语音输入法识别出来的文字。',
  '今天天气不错，适合出去走走。',
  '你好，我在测试语音输入功能。',
];

export class MockRecognitionProvider implements IRecognitionProvider {
  readonly name = 'Mock';
  readonly type = 'api' as const;
  isReady = true;

  async initialize(): Promise<boolean> {
    return true;
  }

  async transcribe(_audioBuffer: Buffer, _sampleRate: number, _lang?: string): Promise<RecognitionResult> {
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));
    const text = MOCK_TEXTS[Math.floor(Math.random() * MOCK_TEXTS.length)];
    return {
      text,
      durationMs: 300,
      language: 'zh',
      confidence: 0.95,
    };
  }

  async dispose(): Promise<void> {
    // no-op
  }
}
