import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SENSEVOICE_FEATURE_DIM,
  buildSenseVoiceFeatures,
} from './sensevoice-ort';

test('SenseVoice preprocessing outputs LFR frames with 560 feature values each', () => {
  const sampleRate = 16000;
  const samples = new Float32Array(sampleRate);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.2;
  }

  const features = buildSenseVoiceFeatures(samples);

  assert.equal(SENSEVOICE_FEATURE_DIM, 560);
  assert.equal(features.featureDim, 560);
  assert.ok(features.frameCount > 0);
  assert.notEqual(features.frameCount, 80);
  assert.equal(features.data.length, features.frameCount * SENSEVOICE_FEATURE_DIM);
});
