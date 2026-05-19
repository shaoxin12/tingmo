import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VK_RMENU,
  WM_KEYDOWN,
  WM_KEYUP,
  WM_SYSKEYDOWN,
  WM_SYSKEYUP,
  getRightAltEventAction,
} from './hotkey-events';

test('right alt key-down is consumed and triggers once until release', () => {
  const first = getRightAltEventAction({
    nCode: 0,
    message: WM_SYSKEYDOWN,
    vkCode: VK_RMENU,
    wasPressed: false,
  });

  assert.deepEqual(first, {
    consume: true,
    nextWasPressed: true,
    triggerPressed: true,
  });

  const repeat = getRightAltEventAction({
    nCode: 0,
    message: WM_KEYDOWN,
    vkCode: VK_RMENU,
    wasPressed: true,
  });

  assert.deepEqual(repeat, {
    consume: true,
    nextWasPressed: true,
    triggerPressed: false,
  });
});

test('right alt key-up is consumed and resets pressed state', () => {
  const result = getRightAltEventAction({
    nCode: 0,
    message: WM_SYSKEYUP,
    vkCode: VK_RMENU,
    wasPressed: true,
  });

  assert.deepEqual(result, {
    consume: true,
    nextWasPressed: false,
    triggerPressed: false,
  });
});

test('non-right-alt and inactive hook events pass through unchanged', () => {
  assert.deepEqual(getRightAltEventAction({
    nCode: 0,
    message: WM_KEYDOWN,
    vkCode: 0x41,
    wasPressed: true,
  }), {
    consume: false,
    nextWasPressed: true,
    triggerPressed: false,
  });

  assert.deepEqual(getRightAltEventAction({
    nCode: -1,
    message: WM_SYSKEYUP,
    vkCode: VK_RMENU,
    wasPressed: true,
  }), {
    consume: false,
    nextWasPressed: true,
    triggerPressed: false,
  });
});
