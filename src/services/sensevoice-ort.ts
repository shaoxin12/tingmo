import type { IRecognitionProvider, RecognitionResult } from './speech-recognition';

// ── Mel filterbank constants ──────────────────────────────────
const SAMPLE_RATE = 16000;
const N_FFT = 512;
const HOP_LENGTH = 160;
const WIN_LENGTH = 400;
const N_MELS = 80;
const FMIN = 20;
const FMAX = 8000;
const LFR_M = 7;
const LFR_N = 6;

export const SENSEVOICE_FEATURE_DIM = N_MELS * LFR_M;

// Hamming window
function hammingWindow(length: number): Float32Array {
  const w = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (length - 1));
  }
  return w;
}

// Mel filterbank
function melFilterbank(nFft: number, nMels: number, sampleRate: number, fmin: number, fmax: number): Float32Array[] {
  const nFreqs = nFft / 2 + 1;
  const fftFreqs = new Float32Array(nFreqs);
  for (let i = 0; i < nFreqs; i++) fftFreqs[i] = (i * sampleRate) / nFft;

  const melMin = 2595 * Math.log10(1 + fmin / 700);
  const melMax = 2595 * Math.log10(1 + fmax / 700);
  const melPoints = new Float32Array(nMels + 2);
  for (let i = 0; i < nMels + 2; i++) {
    const mel = melMin + (i * (melMax - melMin)) / (nMels + 1);
    melPoints[i] = 700 * (Math.pow(10, mel / 2595) - 1);
  }

  const filters: Float32Array[] = [];
  for (let i = 0; i < nMels; i++) {
    const f = new Float32Array(nFreqs);
    for (let j = 0; j < nFreqs; j++) {
      const freq = fftFreqs[j];
      if (freq >= melPoints[i] && freq <= melPoints[i + 1]) {
        f[j] = (freq - melPoints[i]) / (melPoints[i + 1] - melPoints[i]);
      } else if (freq >= melPoints[i + 1] && freq <= melPoints[i + 2]) {
        f[j] = (melPoints[i + 2] - freq) / (melPoints[i + 2] - melPoints[i + 1]);
      }
    }
    filters.push(f);
  }
  return filters;
}

// Radix-2 FFT
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let j = 0; j < halfLen; j++) {
        const cos = Math.cos(angle * j);
        const sin = Math.sin(angle * j);
        const tRe = re[i + j + halfLen] * cos - im[i + j + halfLen] * sin;
        const tIm = re[i + j + halfLen] * sin + im[i + j + halfLen] * cos;
        re[i + j + halfLen] = re[i + j] - tRe;
        im[i + j + halfLen] = im[i + j] - tIm;
        re[i + j] += tRe;
        im[i + j] += tIm;
      }
    }
  }
}

// Mel spectrogram
function computeMelSpectrogram(samples: Float32Array): Float32Array[] {
  const window = hammingWindow(WIN_LENGTH);
  const filters = melFilterbank(N_FFT, N_MELS, SAMPLE_RATE, FMIN, FMAX);
  const nFrames = Math.floor((samples.length - WIN_LENGTH) / HOP_LENGTH) + 1;
  if (nFrames <= 0) return [];

  const melSpec: Float32Array[] = [];
  for (let frame = 0; frame < nFrames; frame++) {
    const offset = frame * HOP_LENGTH;
    const re = new Float32Array(N_FFT);
    const im = new Float32Array(N_FFT);
    for (let i = 0; i < WIN_LENGTH; i++) {
      re[i] = samples[offset + i] * window[i];
    }
    fft(re, im);
    const power = new Float32Array(N_FFT / 2 + 1);
    for (let i = 0; i < power.length; i++) {
      power[i] = (re[i] * re[i] + im[i] * im[i]) / N_FFT;
    }
    const mel = new Float32Array(N_MELS);
    for (let i = 0; i < N_MELS; i++) {
      let sum = 0;
      const f = filters[i];
      for (let j = 0; j < f.length; j++) sum += f[j] * power[j];
      mel[i] = Math.log(Math.max(sum, 1e-10));
    }
    melSpec.push(mel);
  }
  return melSpec;
}

// LFR: stack and subsample
function applyLFR(melSpec: Float32Array[]): Float32Array[] {
  const lfrFrames: Float32Array[] = [];
  for (let i = 0; i + LFR_M <= melSpec.length; i += LFR_N) {
    const stacked = new Float32Array(LFR_M * N_MELS);
    for (let j = 0; j < LFR_M; j++) stacked.set(melSpec[i + j], j * N_MELS);
    lfrFrames.push(stacked);
  }
  return lfrFrames;
}

// Global CMVN
function applyCMVN(frames: Float32Array[]): { frames: Float32Array[]; mean: Float32Array; std: Float32Array } {
  const dim = frames[0]?.length ?? 0;
  const mean = new Float32Array(dim);
  const std = new Float32Array(dim);
  if (dim === 0) return { frames, mean, std };

  for (const f of frames) for (let i = 0; i < dim; i++) mean[i] += f[i];
  for (let i = 0; i < dim; i++) mean[i] /= frames.length;
  for (const f of frames) for (let i = 0; i < dim; i++) { const d = f[i] - mean[i]; std[i] += d * d; }
  for (let i = 0; i < dim; i++) std[i] = Math.sqrt(std[i] / frames.length + 1e-8);

  const normalized = frames.map(f => {
    const n = new Float32Array(dim);
    for (let i = 0; i < dim; i++) n[i] = (f[i] - mean[i]) / std[i];
    return n;
  });
  return { frames: normalized, mean, std };
}

// Pad/truncate to target frames
function padToLength(frames: Float32Array[], target: number): Float32Array[] {
  if (frames.length === 0) return Array(target).fill(null).map(() => new Float32Array(LFR_M * N_MELS));
  const dim = frames[0].length;
  const result = frames.slice(0, target);
  while (result.length < target) result.push(new Float32Array(dim));
  return result;
}

export interface SenseVoiceFeatures {
  data: Float32Array;
  frameCount: number;
  featureDim: number;
}

export function buildSenseVoiceFeatures(samples: Float32Array): SenseVoiceFeatures {
  const melSpec = computeMelSpectrogram(samples);
  let frames = applyLFR(melSpec);

  if (frames.length === 0) {
    frames = [new Float32Array(SENSEVOICE_FEATURE_DIM)];
  }

  const data = new Float32Array(frames.length * SENSEVOICE_FEATURE_DIM);
  for (let t = 0; t < frames.length; t++) {
    data.set(frames[t], t * SENSEVOICE_FEATURE_DIM);
  }

  return {
    data,
    frameCount: frames.length,
    featureDim: SENSEVOICE_FEATURE_DIM,
  };
}

// CTC greedy decode
function ctcGreedyDecode(logits: Float32Array, nFrames: number, nTokens: number, blankId: number): number[] {
  const ids: number[] = [];
  let prev = blankId;
  for (let t = 0; t < nFrames; t++) {
    let maxId = 0;
    let maxVal = -Infinity;
    const offset = t * nTokens;
    for (let i = 0; i < nTokens; i++) {
      if (logits[offset + i] > maxVal) { maxVal = logits[offset + i]; maxId = i; }
    }
    if (maxId !== blankId && maxId !== prev) ids.push(maxId);
    prev = maxId;
  }
  return ids;
}

// ── Provider ────────────────────────────────────────────────

export class SenseVoiceORTProvider implements IRecognitionProvider {
  readonly name = 'SenseVoice-ONNX';
  readonly type = 'local' as const;
  isReady = false;

  private tokens: string[] = [];
  private session: any = null;
  private ort: any = null;

  constructor(private modelPath: string, private tokensPath: string) {}

  async initialize(): Promise<boolean> {
    try {
      this.ort = require('onnxruntime-node');
      this.session = await this.ort.InferenceSession.create(this.modelPath);

      const fs = require('fs');
      this.tokens = JSON.parse(fs.readFileSync(this.tokensPath, 'utf-8'));

      this.isReady = true;
      console.log('[SenseVoice] Initialized,', this.tokens.length, 'tokens');
      return true;
    } catch (err: any) {
      console.error('[SenseVoice] Init error:', err.message);
      return false;
    }
  }

  async transcribe(audioBuffer: Buffer, _sampleRate: number, lang?: string): Promise<RecognitionResult> {
    const t0 = performance.now();

    // WAV parsing: 44-byte header, 16-bit PCM mono
    const numSamples = Math.floor((audioBuffer.length - 44) / 2);
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      samples[i] = audioBuffer.readInt16LE(44 + i * 2) / 32768;
    }

    const features = buildSenseVoiceFeatures(samples);

    // SenseVoice language IDs: 0=zh, 1=en, 2=yue, 3=ja, 4=ko, 5=nospeech
    const langId = lang === 'en' ? 1 : 0;
    const feed = {
      speech: new this.ort.Tensor('float32', features.data, [1, features.frameCount, features.featureDim]),
      speech_lengths: new this.ort.Tensor('int32', new Int32Array([features.frameCount]), [1]),
      language: new this.ort.Tensor('int32', new Int32Array([langId]), [1]),
      textnorm: new this.ort.Tensor('int32', new Int32Array([0]), [1]),
    };

    const results = await this.session.run(feed);
    const ctcLogits = results.ctc_logits;
    const logitsData = ctcLogits.data as Float32Array;
    const [, outFrames, nTokens] = ctcLogits.dims as number[];
    const outputLengths = results.encoder_out_lens?.data as Int32Array | undefined;
    const validFrames = Math.min(outputLengths?.[0] ?? outFrames, outFrames);

    // CTC greedy decode
    const tokenIds = ctcGreedyDecode(logitsData, validFrames, nTokens, 0);
    let text = tokenIds.map(id => this.tokens[id] ?? '').join('');
    text = text.replace(/<unk>/g, '').replace(/<s>/g, '').replace(/<\/s>/g, '');
    text = text.replace(/<\|[^|]+\|>/g, '');
    text = text.replace(/▁/g, ' ').trim();

    const durationMs = performance.now() - t0;
    console.log('[SenseVoice] Done in', durationMs.toFixed(0), 'ms:', text.slice(0, 80));

    return {
      text: text || '（未识别到内容）',
      durationMs,
      language: 'zh',
      confidence: 0.8,
    };
  }

  async dispose(): Promise<void> {
    this.session = null;
    this.isReady = false;
  }
}
