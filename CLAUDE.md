# 听墨 (TingMo) — Windows 桌面 AI 语音输入法

按右 Alt 开始录音，说话，再按右 Alt 停止，语音自动转文字注入光标。SenseVoice-Small ONNX 本地识别。

## 技术栈

Electron 33 + React 18 + TypeScript + Vite | esbuild 编译主进程 | koffi FFI 调 Win32 API | onnxruntime-node | Zustand

## 运行

```bash
npm run dev            # Vite dev server (端口 5173)
npm run electron:dev   # 构建主进程 + 启动 Electron (NODE_ENV=development)
npm run build          # 完整构建
```

开发需两个终端：`npm run dev` + `npm run electron:dev`。

## 架构

| 进程 | 职责 |
|------|------|
| Main (`electron/main.ts`) | 生命周期、键盘钩子、文字注入、托盘、SenseVoice 推理 |
| Renderer (`src/`) | React UI：浮窗胶囊、设置窗口、音频采集 |
| Preload (`electron/preload.ts`) | contextBridge 暴露 `window.tingmo` |

### 状态机

```
IDLE →(右Alt)→ RECORDING →(右Alt)→ RECOGNIZING → SUCCESS/ERROR →(1.5s)→ IDLE
```

### 数据流

1. 右 Alt 按下 → `SetWindowsHookExW` 消费按键 → Main 发 `voice:state-change` → 浮窗显示
2. 渲染进程 Web Audio API 采集 PCM（系统采样率）→ 波形实时绘制
3. 再按右 Alt → 停止采集 → **线性插值重采样到 16kHz** → 编码 WAV → IPC `voice:transcribe`
4. Main 进程 SenseVoice ONNX 推理（FFT→Mel→LFR→CMVN→CTC）→ 得到文字
5. `SendInput + KEYEVENTF_UNICODE` 逐字符注入（预分配 Buffer 复用，不经过剪贴板）
6. 成功 1.5s 后自动隐藏；失败显示重试/复制

**关键**: Windows 音频硬件不支持 16kHz，必须重采样后送 SenseVoice。

## 核心文件

```
electron/
├── main.ts              # App 生命周期、IPC、窗口、SenseVoice 初始化
├── preload.ts           # window.tingmo API
├── hotkey.ts            # SetWindowsHookExW 低层键盘钩子
├── hotkey-events.ts     # 按键去重、状态跟踪
├── text-inserter.ts     # SendInput Unicode 逐字符注入
└── tray.ts              # 系统托盘（动态色图标）

src/
├── App.tsx              # hash 路由: / → 浮窗, /#/settings → 设置
├── components/
│   ├── FloatingWindow.tsx  # 胶囊 140×48px（呼吸灯+波形/状态/错误面板）
│   ├── Waveform.tsx        # Canvas 64 条历史柱状波形
│   ├── ErrorPanel.tsx      # 重试/复制按钮
│   └── Settings/
│       ├── SettingsWindow.tsx  # 新粗野主义：侧边栏+卡片，纯白黑框硬阴影
│       └── HotkeyRecorder.tsx  # 键盘录制
├── hooks/
│   ├── useVoiceInput.ts   # 状态机 hook（IPC 监听）
│   └── useAudioCapture.ts # Web Audio 采集 + 16kHz 重采样 + WAV
├── services/
│   ├── sensevoice-ort.ts  # FFT/Mel/LFR/CMVN/CTC 全流程（纯 TS）
│   └── mock-recognition.ts
├── store/settings.ts      # Zustand（voiceMode, language, hotkey）
└── styles/global.css

models/sensevoice-small/   # model.onnx (241MB) + tokens.json (25055) + config.yaml
```

## 设计

### 浮窗胶囊
140×48px 胶囊形，深色毛玻璃，录音时呼吸灯+波形，状态文字，失败时行内重试/复制。无按钮，纯右 Alt 控制。位置在任务栏上方 56px。

### 设置窗口 — 新粗野主义
纯白底 `#FFF`、3px 纯黑直角边框、`3px 3px 0 #000` 硬阴影、橙色 `#FF5A1F` 点缀。左侧 175px 导航栏（双语标签 `GENERAL 常规`，激活黑底白字）。右侧卡片式内容区，10px 黑底滚动条。窗口 560×520，最小 480×400，可缩放。

## 关键细节

- **快捷键**: `waitForHotkeyRelease()` 注入前等右 Alt 松开（轮询 GetAsyncKeyState，最多 1200ms）
- **floatingReady**: `did-finish-load` 后设 true，**隐藏时不清除**（否则重显示后 IPC 消息丢失）
- **autoDismissTimer**: 跟踪自动隐藏定时器，右 Alt 按下时清除避免打断新录音
- **语言**: setting store 的 language (`zh`/`en`) 通过 IPC 传入 SenseVoice（语言 ID: 0=中文, 1=English）
- **托盘**: 运行时动态生成 16×16 位图，recording=红色, recognizing=蓝色, default=青色

## 已知限制

仅切换模式、仅 Win x64、需麦克风权限、无开机自启/更新/润色。
