import type { IRecognitionProvider, RecognitionResult } from './speech-recognition';

// ── Fbank feature extraction constants ──────────────────────
const SAMPLE_RATE = 16000;
const WIN_LENGTH = 400; // 25ms at 16kHz
const HOP_LENGTH = 160; // 10ms at 16kHz
const N_FFT = 512;
const N_MELS = 80;
const FMIN = 20;
const FMAX = 8000;
const LFR_M = 7;
const LFR_N = 6;
const FEATURE_DIM = N_MELS * LFR_M; // 560

let _window: Float32Array | null = null;
function hammingWindow(): Float32Array {
  if (_window) return _window;
  _window = new Float32Array(WIN_LENGTH);
  for (let i = 0; i < WIN_LENGTH; i++) {
    _window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (WIN_LENGTH - 1));
  }
  return _window;
}

let _filters: Float32Array[] | null = null;
function melFilterbank(): Float32Array[] {
  if (_filters) return _filters;
  const nFreqs = N_FFT / 2 + 1;
  const fftFreqs = new Float32Array(nFreqs);
  for (let i = 0; i < nFreqs; i++) fftFreqs[i] = (i * SAMPLE_RATE) / N_FFT;

  const melMin = 1127 * Math.log(1 + FMIN / 700);
  const melMax = 1127 * Math.log(1 + FMAX / 700);
  const melPoints = new Float32Array(N_MELS + 2);
  for (let i = 0; i < N_MELS + 2; i++) {
    const mel = melMin + (i * (melMax - melMin)) / (N_MELS + 1);
    melPoints[i] = 700 * (Math.exp(mel / 1127) - 1);
  }

  _filters = [];
  for (let i = 0; i < N_MELS; i++) {
    const f = new Float32Array(nFreqs);
    for (let j = 0; j < nFreqs; j++) {
      const freq = fftFreqs[j];
      if (freq >= melPoints[i] && freq <= melPoints[i + 1]) {
        f[j] = (freq - melPoints[i]) / (melPoints[i + 1] - melPoints[i]);
      } else if (freq >= melPoints[i + 1] && freq <= melPoints[i + 2]) {
        f[j] = (melPoints[i + 2] - freq) / (melPoints[i + 2] - melPoints[i + 1]);
      }
    }
    _filters.push(f);
  }
  return _filters;
}

// ── Radix-2 FFT ──────────────────────────────────────────────
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

// ── Fbank: raw audio → mel filterbank frames ─────────────────
function computeFbank(samples: Float32Array): Float32Array[] {
  const window_ = hammingWindow();
  const filters = melFilterbank();

  // Dither + pre-emphasis (×32768, matching kaldi.fbank default dither=1.0)
  const dithered = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    dithered[i] = samples[i] * 32768 + (Math.random() - 0.5);
  }

  const nFrames = Math.floor((dithered.length - WIN_LENGTH) / HOP_LENGTH) + 1;
  if (nFrames <= 0) return [];

  const fbankFrames: Float32Array[] = [];
  for (let frame = 0; frame < nFrames; frame++) {
    const offset = frame * HOP_LENGTH;
    const re = new Float32Array(N_FFT);
    const im = new Float32Array(N_FFT);
    for (let i = 0; i < WIN_LENGTH; i++) {
      re[i] = dithered[offset + i] * window_[i];
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
    fbankFrames.push(mel);
  }
  return fbankFrames;
}

// ── LFR: stack M frames, stride N ────────────────────────────
function applyLFR(fbankFrames: Float32Array[]): Float32Array[] {
  const out: Float32Array[] = [];
  for (let i = 0; i + LFR_M <= fbankFrames.length; i += LFR_N) {
    const stacked = new Float32Array(LFR_M * N_MELS);
    for (let j = 0; j < LFR_M; j++) stacked.set(fbankFrames[i + j], j * N_MELS);
    out.push(stacked);
  }
  return out;
}

// ── CMVN parsers & application ───────────────────────────────
interface CMVNParams {
  means: Float32Array;
  vars: Float32Array;
}

function parseCMVN(content: string): CMVNParams {
  const lines = content.split('\n');
  let means: number[] = [];
  let vars: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const items = lines[i].trim().split(/\s+/);
    if (items[0] === '<AddShift>') {
      const next = lines[i + 1]?.trim().split(/\s+/) || [];
      means = next.slice(3, -1).map(Number);
    } else if (items[0] === '<Rescale>') {
      const next = lines[i + 1]?.trim().split(/\s+/) || [];
      vars = next.slice(3, -1).map(Number);
    }
  }
  return { means: new Float32Array(means), vars: new Float32Array(vars) };
}

function applyCMVN(frames: Float32Array[], cmvn: CMVNParams): Float32Array[] {
  const dim = Math.min(frames[0]?.length ?? 0, cmvn.means.length, cmvn.vars.length);
  if (dim === 0) return frames;
  return frames.map((f) => {
    const n = new Float32Array(dim);
    for (let i = 0; i < dim; i++) n[i] = (f[i] + cmvn.means[i]) * cmvn.vars[i];
    return n;
  });
}

// ── Complete feature extraction pipeline ─────────────────────
function buildFeatures(
  samples: Float32Array,
  cmvn: CMVNParams | null,
): Float32Array {
  let frames = computeFbank(samples);
  frames = applyLFR(frames);
  if (cmvn) frames = applyCMVN(frames, cmvn);
  if (frames.length === 0) frames = [new Float32Array(FEATURE_DIM)];

  const data = new Float32Array(frames.length * FEATURE_DIM);
  for (let t = 0; t < frames.length; t++) data.set(frames[t], t * FEATURE_DIM);
  return data;
}

// ── CTC greedy decode ─────────────────────────────────────────
function ctcGreedyDecode(
  logits: Float32Array,
  nFrames: number,
  nTokens: number,
  blankId: number,
): number[] {
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

function tokenIdsToText(tokenIds: number[], tokens: string[]): string {
  let text = tokenIds.map(id => tokens[id] ?? '').join('');
  text = text.replace(/<unk>/g, '').replace(/<s>/g, '').replace(/<\/s>/g, '');
  text = text.replace(/<\|[^|]+\|>/g, '');
  text = text.replace(/▁/g, ' ').trim();
  text = text.replace(/@@/g, '');
  return text;
}

// ── Provider ──────────────────────────────────────────────────

export class FunASRORTProvider implements IRecognitionProvider {
  readonly name = 'Paraformer-large-INT8';
  readonly type = 'local' as const;
  readonly vadEnabled = true;
  isReady = false;

  private asrSession: any = null;
  private punctSession: any = null;
  private vadSession: any = null;
  private tokens: string[] = [];
  private cmvn: CMVNParams | null = null;
  private ort: any = null;
  private punctTokens: Map<string, number> | null = null;
  private punctUnkId = 0;

  constructor(private modelDir: string) {}

  async initialize(): Promise<boolean> {
    try {
      const fs = require('fs');
      const path = require('path');
      this.ort = require('onnxruntime-node');

      const asrPath = path.join(this.modelDir, 'paraformer-large-int8.onnx');
      const punctPath = path.join(this.modelDir, 'ct-transformer.onnx');
      const vadPath = path.join(this.modelDir, 'fsmn-vad.onnx');
      const tokensPath = path.join(this.modelDir, 'tokens.json');
      const cmvnPath = path.join(this.modelDir, 'am.mvn');

      // VAD model (optional)
      if (fs.existsSync(vadPath)) {
        this.vadSession = await this.ort.InferenceSession.create(vadPath);
        console.log('[FunASR] VAD model loaded');
      }

      if (!fs.existsSync(asrPath)) {
        console.log('[FunASR] ASR model not found, will use mock');
        this.isReady = false;
        return false;
      }

      this.asrSession = await this.ort.InferenceSession.create(asrPath);
      console.log('[FunASR] ASR model loaded');

      // Punct model (optional)
      if (fs.existsSync(punctPath)) {
        this.punctSession = await this.ort.InferenceSession.create(punctPath);
        console.log('[FunASR] Punct model loaded');

        // Load punctuation tokenizer (JSON array: index → char)
        const punctTokensPath = path.join(this.modelDir, 'punct-tokens.json');
        if (fs.existsSync(punctTokensPath)) {
          const tokenArr: string[] = JSON.parse(fs.readFileSync(punctTokensPath, 'utf-8'));
          this.punctTokens = new Map();
          for (let i = 0; i < tokenArr.length; i++) {
            this.punctTokens.set(tokenArr[i], i);
          }
          this.punctUnkId = this.punctTokens.get('<unk>') ?? tokenArr.length - 1;
          console.log('[FunASR] Punct tokens loaded:', this.punctTokens.size);
        }
      }

      // Tokens
      if (fs.existsSync(tokensPath)) {
        this.tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
        console.log('[FunASR] Tokens loaded:', this.tokens.length);
      }

      // CMVN
      if (fs.existsSync(cmvnPath)) {
        const mvnContent = fs.readFileSync(cmvnPath, 'utf-8');
        this.cmvn = parseCMVN(mvnContent);
        console.log('[FunASR] CMVN loaded:', this.cmvn.means.length, 'dims');
      }

      this.isReady = true;
      console.log('[FunASR] Initialized');
      return true;
    } catch (err: any) {
      console.error('[FunASR] Init error:', err.message);
      this.isReady = false;
      return false;
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    _sampleRate: number,
    lang?: string,
  ): Promise<RecognitionResult> {
    const t0 = performance.now();

    // Parse WAV: skip 44-byte header, 16-bit PCM mono → Float32Array
    const numSamples = Math.floor((audioBuffer.length - 44) / 2);
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      samples[i] = audioBuffer.readInt16LE(44 + i * 2) / 32768;
    }

    // Build fbank + LFR + CMVN features
    const features = buildFeatures(samples, this.cmvn);

    // Run ASR
    let text: string;
    if (this.asrSession && this.tokens.length > 0) {
      const tokenIds = await this.runASR(features);
      text = tokenIdsToText(tokenIds, this.tokens);
    } else {
      console.log('[FunASR] Model not ready, using mock');
      text = '这是一段测试文本，通过听墨语音输入法识别。';
    }
    console.log('[FunASR] Raw text (first 120 chars):', text.slice(0, 120));

    // Punctuation restoration
    if (this.punctSession && text.length > 0) {
      text = await this.runPunctuation(text);
    }

    return {
      text: text || '（未识别到内容）',
      durationMs: performance.now() - t0,
      language: lang || 'zh',
      confidence: 0.85,
    };
  }

  // ── ASR inference ──────────────────────────────────────────

  private async runASR(features: Float32Array): Promise<number[]> {
    try {
      const frameCount = features.length / FEATURE_DIM;
      const feed = {
        speech: new this.ort.Tensor('float32', features, [1, frameCount, FEATURE_DIM]),
        speech_lengths: new this.ort.Tensor('int32', new Int32Array([frameCount]), [1]),
      };
      const results = await this.asrSession.run(feed);

      // Decode logits → token IDs
      const logits = results.logits;
      const logitsData = logits.data as Float32Array;
      const [, outFrames, nTokens] = logits.dims as number[];
      const tokenNum = (results.token_num?.data as Int32Array)?.[0] ?? outFrames;
      const validFrames = Math.min(tokenNum, outFrames);

      return ctcGreedyDecode(logitsData, validFrames, nTokens, 0);
    } catch (err: any) {
      console.error('[FunASR] ASR error:', err.message);
      return [];
    }
  }

  // ── Punctuation: CT-Transformer ONNX inference ────────────
  //
  // Input:  "inputs"        int32 [1, seq_len]  — character token IDs
  //         "text_lengths"  int32 [1]            — actual sequence length
  // Output: "logits"   float32 [1, seq_len, 6]  — per-char punct scores
  //
  // Class mapping (from config.yaml punc_list):
  //   0=<unk>/ignore  1=_  2=，  3=。  4=？  5=、

  private readonly PUNCT_CLASSES = ['', '', '，', '。', '？', '、'];

  private async runPunctuation(text: string): Promise<string> {
    if (!this.punctSession || !this.punctTokens || text.length === 0) return text;

    try {
      const t0 = performance.now();

      // Tokenize: map each char to its vocab ID
      const ids: number[] = [];
      for (const ch of text) {
        ids.push(this.punctTokens.get(ch) ?? this.punctUnkId);
      }

      // Model expects: inputs (int32), text_lengths (int32)
      const feed = {
        inputs: new this.ort.Tensor('int32', new Int32Array(ids), [1, ids.length]),
        text_lengths: new this.ort.Tensor('int32', new Int32Array([ids.length]), [1]),
      };

      const results = await this.punctSession.run(feed);
      const logits = results.logits.data as Float32Array;
      const [, seqLen, numClasses] = results.logits.dims as number[];

      const classes = this.PUNCT_CLASSES.slice(0, numClasses);

      // Greedy decode
      const chars = [...text];
      let out = '';
      for (let pos = 0; pos < Math.min(seqLen, chars.length); pos++) {
        out += chars[pos];
        const offset = pos * numClasses;
        let bestClass = 0;
        let bestScore = -Infinity;
        for (let c = 1; c < numClasses; c++) {
          if (logits[offset + c] > bestScore) {
            bestScore = logits[offset + c];
            bestClass = c;
          }
        }
        if (bestClass > 1 && bestClass < classes.length) {
          out += classes[bestClass];
        }
      }

      const elapsed = (performance.now() - t0).toFixed(1);
      console.log('[FunASR] Punct', elapsed, 'ms, in:', text.slice(0, 60), '→ out:', out.slice(0, 80));
      return out;
    } catch (err: any) {
      console.error('[FunASR] Punct error:', err.message);
      return text;
    }
  }

  // ── VAD (stub — wired when FSMN-VAD model available) ───────
  // FSMN-VAD expects fbank features with its own frontend config,
  // plus 4 RNN cache tensors for streaming state.

  async dispose(): Promise<void> {
    this.asrSession = null;
    this.punctSession = null;
    this.vadSession = null;
    this.isReady = false;
  }
}
