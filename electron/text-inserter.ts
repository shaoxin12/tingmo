const koffi = require('koffi');

const INPUT_KEYBOARD = 1;
const KEYEVENTF_UNICODE = 0x0004;
const KEYEVENTF_KEYUP = 0x0002;

const user32 = koffi.load('user32.dll');

const SendInput = user32.func(
  'SendInput',
  'uint32',
  ['uint32', 'void *', 'int32'],
);

export interface InjectResult {
  success: boolean;
  charCount: number;
  durationMs: number;
}

// INPUT struct on x64: type(4) + pad(4) + union(32) = 40 bytes
// KEYBDINPUT within union: wVk(2) + wScan(2) + dwFlags(4) + time(4) + padding(4) + dwExtraInfo(8) = 24
const INPUT_SIZE = 40;
// Pre-allocate reusable buffer to avoid repeated koffi.as() pointer invalidation
const inputBuf = Buffer.alloc(INPUT_SIZE);

function fillInputStruct(codePoint: number, flags: number): void {
  inputBuf.fill(0);
  let offset = 0;
  offset = inputBuf.writeUInt32LE(INPUT_KEYBOARD, offset); // type
  offset += 4;                                              // padding
  offset = inputBuf.writeUInt16LE(0, offset);              // wVk
  offset = inputBuf.writeUInt16LE(codePoint, offset);      // wScan (Unicode codepoint)
  offset = inputBuf.writeUInt32LE(flags, offset);           // dwFlags
  offset = inputBuf.writeUInt32LE(0, offset);              // time
  // dwExtraInfo at offset 24 (8-byte aligned)
  inputBuf.writeBigUInt64LE(0n, 24);
}

export async function injectText(text: string): Promise<InjectResult> {
  const start = performance.now();

  for (const ch of text) {
    const codePoint = ch.codePointAt(0) ?? 0;

    fillInputStruct(codePoint, KEYEVENTF_UNICODE);
    const ptr = koffi.as(inputBuf, 'void *');
    SendInput(1, ptr, INPUT_SIZE);

    fillInputStruct(codePoint, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP);
    const ptr2 = koffi.as(inputBuf, 'void *');
    SendInput(1, ptr2, INPUT_SIZE);
  }

  return {
    success: true,
    charCount: text.length,
    durationMs: performance.now() - start,
  };
}
