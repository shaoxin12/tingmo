import { spawn, ChildProcess } from 'child_process';

// ── PowerShell COM backend ─────────────────────────────────────
// Long-running PowerShell process that compiles a C# wrapper for
// IAudioEndpointVolume once, then responds to stdin commands.
// No OSD popup, no system-wide registry changes.

const PS_SCRIPT = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumerator { }

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  void _0(); void _1(); void _2(); void _3();
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IntPtr endpoint);
}

[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  void _0(); void _1(); void _2();
  int Activate(ref Guid iid, int clsCtx, IntPtr p, out IntPtr iface);
}

[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  void _r(); void _u(); void _g();
  void _0(); void _1(); void _2(); void _3(); void _4();
  void _5(); void _6(); void _7(); void _8(); void _9();
  void _a(); void _b();
  int SetMute(bool mute, IntPtr ctx);
  int GetMute(out bool mute);
}

public static class Audio {
  static IAudioEndpointVolume vol;
  static void Init() {
    if (vol != null) return;
    var enu = (IMMDeviceEnumerator)new MMDeviceEnumerator();
    IntPtr dp; enu.GetDefaultAudioEndpoint(0, 0, out dp);
    var dev = (IMMDevice)Marshal.GetTypedObjectForIUnknown(dp, typeof(IMMDevice));
    Guid iid = typeof(IAudioEndpointVolume).GUID;
    IntPtr vp; dev.Activate(ref iid, 7, IntPtr.Zero, out vp);
    vol = (IAudioEndpointVolume)Marshal.GetTypedObjectForIUnknown(vp, typeof(IAudioEndpointVolume));
  }
  public static void Mute()   { Init(); vol.SetMute(true, IntPtr.Zero); }
  public static void Unmute() { Init(); vol.SetMute(false, IntPtr.Zero); }
  public static bool IsMuted(){ Init(); bool m; vol.GetMute(out m); return m; }
}
"@
[Console]::WriteLine("READY")
while ($true) {
  $cmd = [Console]::In.ReadLine()
  if ($cmd -eq $null) { break }
  try {
    if ($cmd -eq "mute") {
      [Audio]::Mute()
      [Console]::WriteLine("OK")
    } elseif ($cmd -eq "unmute") {
      [Audio]::Unmute()
      [Console]::WriteLine("OK")
    } elseif ($cmd -eq "state") {
      if ([Audio]::IsMuted()) {
        [Console]::WriteLine("1")
      } else {
        [Console]::WriteLine("0")
      }
    } else {
      [Console]::WriteLine("ERR:unknown")
    }
  } catch {
    [Console]::WriteLine("ERR:" + $_.Exception.Message)
  }
}
`;

let psProc: ChildProcess | null = null;
let ready = false;
let pendingResolve: ((v: string) => void) | null = null;
let warmPromise: Promise<void> | null = null;

function ensurePS(): Promise<void> {
  if (ready) return Promise.resolve();
  if (warmPromise) return warmPromise;

  warmPromise = new Promise<void>((resolve, reject) => {
    psProc = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    // Accumulate line output
    let lineBuf = '';
    psProc.stdout!.on('data', (data: Buffer) => {
      lineBuf += data.toString();
      const lines = lineBuf.split('\n');
      lineBuf = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (!ready && trimmed === 'READY') {
          ready = true;
          resolve();
          continue;
        }

        if (pendingResolve) {
          const cb = pendingResolve;
          pendingResolve = null;
          cb(trimmed);
        }
      }
    });

    psProc.stderr!.on('data', (d: Buffer) => {
      console.error('[AudioDucking PS]', d.toString().trim());
    });

    psProc.on('exit', (code: number | null) => {
      console.log('[AudioDucking] PS exited:', code);
      psProc = null;
      ready = false;
      warmPromise = null;
      if (pendingResolve) {
        pendingResolve('ERR:ps exited');
        pendingResolve = null;
      }
    });

    // Timeout
    setTimeout(() => {
      if (!ready) {
        reject(new Error('PS warm-up timeout'));
        warmPromise = null;
      }
    }, 8000);
  });

  return warmPromise;
}

function sendCmd(cmd: string): Promise<string> {
  return ensurePS().then(() => new Promise<string>((resolve) => {
    pendingResolve = resolve;
    psProc!.stdin!.write(cmd + '\n');
  }));
}

// ── State ──────────────────────────────────────────────────────
let ducking = false;
let wasMutedBefore: boolean | null = null;

// ── Public API ──────────────────────────────────────────────────
export async function duckSystemAudio(): Promise<void> {
  if (ducking) return;
  ducking = true;

  const state = await sendCmd('state');
  wasMutedBefore = state === '1';
  if (!wasMutedBefore) {
    await sendCmd('mute');
  }
}

export async function unduckSystemAudio(): Promise<void> {
  if (!ducking) return;
  ducking = false;

  if (!wasMutedBefore) {
    await sendCmd('unmute');
  }
  wasMutedBefore = null;
}
