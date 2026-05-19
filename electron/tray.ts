import { Tray, Menu, nativeImage } from 'electron';

let voiceMode: 'local' | 'api' = 'local';

function createTrayIcon(state: 'default' | 'recording' | 'recognizing'): Electron.NativeImage {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = Math.floor(i / size);
    const cx = size / 2;
    const cy = size / 2;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    const idx = i * 4;

    if (dist < 6) {
      if (state === 'recording') {
        canvas[idx] = 255;
        canvas[idx + 1] = 85;
        canvas[idx + 2] = 85;
        canvas[idx + 3] = 255;
      } else if (state === 'recognizing') {
        canvas[idx] = 74;
        canvas[idx + 1] = 144;
        canvas[idx + 2] = 255;
        canvas[idx + 3] = 255;
      } else {
        canvas[idx] = 0;
        canvas[idx + 1] = 229;
        canvas[idx + 2] = 255;
        canvas[idx + 3] = 255;
      }
    } else if (dist < 7) {
      const alpha = Math.max(0, (7 - dist) * 255);
      if (state === 'recording') {
        canvas[idx] = 255;
        canvas[idx + 1] = 85;
        canvas[idx + 2] = 85;
        canvas[idx + 3] = Math.min(255, alpha);
      } else if (state === 'recognizing') {
        canvas[idx] = 74;
        canvas[idx + 1] = 144;
        canvas[idx + 2] = 255;
        canvas[idx + 3] = Math.min(255, alpha);
      } else {
        canvas[idx] = 0;
        canvas[idx + 1] = 229;
        canvas[idx + 2] = 255;
        canvas[idx + 3] = Math.min(255, alpha);
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

export function createTray(openSettings: () => void): Tray {
  const icon = createTrayIcon('default');
  const tray = new Tray(icon);
  tray.setToolTip('听墨');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '语音模式',
      submenu: [
        {
          label: '本地',
          type: 'radio',
          checked: voiceMode === 'local',
          click: () => { voiceMode = 'local'; },
        },
        {
          label: 'API',
          type: 'radio',
          checked: voiceMode === 'api',
          click: () => { voiceMode = 'api'; },
        },
      ],
    },
    {
      label: '录音模式',
      submenu: [
        {
          label: '切换',
          type: 'radio',
          checked: true,
        },
        {
          label: '按住',
          type: 'radio',
          enabled: false,
          checked: false,
        },
      ],
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => openSettings(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        const { app } = require('electron');
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => openSettings());

  return tray;
}

export function updateTrayState(
  existingTray: Tray | null,
  state: 'default' | 'recording' | 'recognizing',
): void {
  if (!existingTray || existingTray.isDestroyed()) return;
  const icon = createTrayIcon(state);
  existingTray.setImage(icon);
}
