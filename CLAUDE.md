# 听墨 (TingMo) v0.2.0 — Windows 桌面 AI 语音输入法

按右 Alt 开始录音，说话，再按右 Alt 停止，语音自动转文字注入光标。右 Alt + 右 Shift 触发翻译模式。

**v0.2.0**: Paraformer-large INT8 本地 ASR + CT-Transformer 标点 + LLM 润色（OpenAI 兼容 API）

## 技术栈

Electron 33 + React 18 + TypeScript + Vite | esbuild 编译主进程 | koffi FFI 调 Win32 API | onnxruntime-node | Zustand | 5 语言 i18n

## 运行

```bash
npm run dev            # Vite dev server (端口 5173)
npm run electron:dev   # 构建主进程 + 启动 Electron
npm run build          # 完整构建: tsc + vite build + esbuild main/preload
npm run build:main     # 仅构建主进程和 preload
npm run electron:build # 构建 + electron-builder 打包 NSIS 安装程序
```

开发需两个终端：`npm run dev` + `npm run electron:dev`。

## 架构

```
┌─ Main Process (electron/) ─────────────────────────────┐
│  main.ts          App 生命周期、IPC、ASR 推理管线、     │
│                   LLM 润色、词典纠错、统计/历史、       │
│                   单实例锁 + second-instance 处理       │
│  hotkey.ts        SetWindowsHookExW 低层键盘钩子        │
│  hotkey-events.ts 按键去重、右 Alt 状态跟踪             │
│  text-inserter.ts SendInput Unicode 逐字符注入 (koffi)  │
│  tray.ts          系统托盘（状态叠加色点、ASR 切换）     │
│  tray-i18n.ts     托盘菜单翻译                          │
│  audio-ducking.ts PowerShell COM 静音系统音频           │
│  stats-history.ts 统计/历史持久化                       │
│  preload.ts       contextBridge 暴露 window.tingmo API  │
├────────────────────────────────────────────────────────┤
│  Renderer (src/)                                       │
│  App.tsx          路由: / → 浮窗, /#/settings → 设置   │
│  components/      浮窗胶囊 + 设置窗口 (NB 风格)         │
│  hooks/           状态机 hook + 音频采集 hook           │
│  services/        ASR 接口 + LLM 接口 + 模型下载        │
│  store/           Zustand 全局状态 (注意: 不持久化)     │
│  i18n/            5 语言 React Context                  │
└────────────────────────────────────────────────────────┘
```

### 状态机

```
IDLE →(右Alt按下)→ RECORDING →(右Alt按下)→ RECOGNIZING →(LLM)→ REFINING → SUCCESS/ERROR →(1.5s)→ IDLE
```

`REFINING` 仅在 LLM 润色/翻译时出现，离线或未配置时跳过，直接从 RECOGNIZING 到 SUCCESS/ERROR。

### 数据流

1. 右 Alt 按下 → `SetWindowsHookExW` 低层钩子（全局，不依赖焦点窗口）→ `hotkey-events.ts` 去重 → 回调 main.ts
2. Main 发 `voice:state-change` → 渲染进程显示浮窗胶囊
3. 渲染进程 Web Audio API (`useAudioCapture`) 采集 PCM → 线性插值重采样 48→16kHz → 编码 WAV → IPC `voice:transcribe`
4. Main 进程处理：
   - **Fbank 特征提取**（Hamming窗→FFT(radix-2)→Mel filterbank→log→LFR(7帧叠6帧步)→CMVN 归一化）→ 560维特征
   - **Paraformer-large ONNX** 推理 → CTC greedy decode → token IDs → 文字
   - **CT-Transformer 标点**（可选，`punct-tokens.json` 272727 tokens）→ `，。？、`
   - **词典模糊纠错**（Levenshtein 编辑距离，短词≤1，长词≤2）→ 修正同音误判
   - **LLM 润色**（可选，需 API Key + 联网）→ 去口语 + 结构化(Markdown) + 保留专属词汇
   - **LLM 翻译**（可选）：复用润色 provider，切换 System Prompt
5. `waitForHotkeyRelease()` 等待右 Alt 松开 → `SendInput + KEYEVENTF_UNICODE` 逐字符注入光标位置
6. 统计/历史持久化到 `userData/data/stats.json` + `history.json`（上限 200 条）
7. 成功 1.5s 后隐藏浮窗；失败显示重试/复制按钮

## 核心文件

```
electron/
├── main.ts              # App 生命周期、IPC handlers、ASR 推理管线、LLM 润色、
│                        #   词典纠错(applyDictionary/levenshtein)、统计/历史、模型下载
├── preload.ts           # window.tingmo API (IPC bridge) 类型定义与实现
├── hotkey.ts            # SetWindowsHookExW 低层键盘钩子 (koffi FFI)
├── hotkey-events.ts     # 按键去重、右 Alt 按下/释放状态跟踪
├── text-inserter.ts     # SendInput + KEYEVENTF_UNICODE 逐字符注入 (koffi)
├── tray.ts              # 系统托盘 — 状态叠加色点 + 菜单(ASR切换/录音模式/设置/退出)
├── tray-i18n.ts         # 托盘菜单 5 语言翻译
├── audio-ducking.ts     # 录音时 PowerShell COM (IAudioEndpointVolume) 静音系统音频
└── stats-history.ts     # 统计/历史持久化到 userData/data/

src/
├── App.tsx              # I18nProvider + hash 路由: / → 浮窗, /#/settings → 设置
├── env.d.ts             # window.tingmo 类型声明
├── main.tsx             # React entry (createRoot)
├── i18n/
│   ├── translations.ts  # 5 语言翻译字典 (~116 个 key)
│   └── context.tsx       # React i18n Context + Provider + useI18n() hook
├── components/
│   ├── FloatingWindow.tsx  # 胶囊 140×48px (呼吸灯+波形/状态/错误面板)
│   ├── BreathingLight.tsx  # 呼吸灯动画 (recording=脉冲, recognizing=旋转环)
│   ├── Waveform.tsx        # Canvas 波形 (64柱状历史, rAF 驱动)
│   ├── ErrorPanel.tsx      # 重试/复制按钮
│   ├── StatusOverlay.tsx   # 状态文字覆盖层
│   └── Settings/
│       ├── SettingsWindow.tsx  # NB 风格设置窗口 (175px侧边栏+卡片+5语言)
│       ├── HotkeyRecorder.tsx  # 快捷键录制器 (keydown/keyup捕获, i18n修饰键名)
│       ├── NbSelect.tsx       # 自定义 NB 下拉菜单
│       ├── HistoryPanel.tsx   # 历史记录 + 统计摘要
│       └── DictionaryPanel.tsx # 单输入词典 (标签展示 + × 删除)
├── hooks/
│   ├── useVoiceInput.ts   # 状态机 hook — 监听 IPC 事件, 暴漏 retry/copy/finish/cancel
│   └── useAudioCapture.ts # Web Audio 采集 + 16kHz 重采样 + WAV 编码 + RMS 停顿检测
├── services/
│   ├── speech-recognition.ts  # IRecognitionProvider 接口
│   ├── funasr-ort.ts         # Paraformer + CT-Transformer ONNX (纯 JS Fbank/LFR/CMVN/CTC)
│   ├── funasr-cloud.ts       # 云端 ASR 骨架 (待实现)
│   ├── llm-refine.ts         # IRefinementProvider 接口 + System Prompt 构建
│   ├── llm-openai.ts         # OpenAI 兼容 API 实现 (fetch + AbortController 8s 超时)
│   ├── model-downloader.ts   # 首次启动从 GitHub Releases 下载模型 tar.gz
│   └── mock-recognition.ts   # 开发用 mock 识别
├── store/settings.ts      # Zustand store (全局状态, 内存中不持久化)
└── styles/global.css      # 全局样式 (胶囊毛玻璃/NB设置/波形/历史/词典/开关/输入框)
```

## 模型文件

存放于 `%APPDATA%/tingmo/models/funasr/`，首次启动缺失时自动从 GitHub Releases 下载：

| 文件 | 大小 | 用途 | 必需 |
|------|------|------|------|
| `paraformer-large-int8.onnx` | 228 MB | ASR 引擎 (Paraformer-large INT8) | ✅ |
| `tokens.json` | 60 KB | ASR 词表 (8404 tokens) | ✅ |
| `am.mvn` | 11 KB | CMVN 归一化参数 (Kaldi 格式) | ✅ |
| `config.json` | 1 KB | 模型配置 | ✅ |
| `ct-transformer.onnx` | 73 MB | CT-Transformer 标点 (INT8) | ✅ |
| `punct-tokens.json` | 4 MB | 标点词表 (272727 tokens) | ✅ |

GitHub Release: https://github.com/shaoxin12/tingmo/releases

## 设置窗口

NB (Neo-Brutalism) 风格：纯白底 `#FFF`、黑色 3px 边框、橙色 `#FF5A1F` 点缀。左侧 175px 导航栏（5 个单标签按钮，激活黑底白字），右侧卡片式内容区。

| 标签 | 内容 |
|------|------|
| **历史** | 累计时长、累计字数、最近记录（时间戳+内容）、清空按钮 |
| **词典** | 单输入添加词汇、标签展示、× 删除、模糊纠错说明 |
| **模型** | Paraformer-large INT8 / CT-Transformer / FSMN-VAD / ONNX Runtime / ~304 MB |
| **设置** | 语音模式(本地/API)、识别语言(中/英)、快捷键录制、翻译目标语言、开机自启/录音静音/启用词典/LLM 配置 |
| **关于** | 应用名 + 简介 + 技术栈标签 |

### 界面语言

侧边栏底部语言下拉切换（简体中文 / 繁體中文 / English / 日本語 / 한국어）。首启根据 `app.getLocale()` 自动检测。

## 词典系统

两层生效：
- **始终**：ASR 输出后 Levenshtein 模糊纠错（短词容错 ≤1 编辑距离，长词 ≤2）
- **LLM 启用时**：System Prompt 中声明专属词汇保持不修改

词典面板：输入一个词 → 添加 → 以 NB 标签展示 → × 删除。当前版本 word 和 replace 字段相同（即仅做匹配纠正，不支持替换为不同文本）。

## IPC API (`window.tingmo`)

| 方法 | 方向 | 用途 |
|------|------|------|
| `onVoiceStateChange(cb)` | Main→Renderer | 状态变化事件（返回 unsubscribe） |
| `onRecognitionDone(cb)` | Main→Renderer | 识别完成 (charCount, durationMs) |
| `onInjectFailed(cb)` | Main→Renderer | 注入失败（返回识别文本供重试） |
| `onModelProgress(cb)` | Main→Renderer | 模型下载进度 |
| `onTranslateMode(cb)` | Main→Renderer | 翻译模式激活通知 |
| `openSettings()` | Renderer→Main | 打开设置窗口（已打开则聚焦） |
| `transcribe(buf, lang?, opts?)` | Renderer→Main | 发送音频 WAV，opts: {translate, translateTarget, dictionary} |
| `retryInject(text)` | Renderer→Main | 重试注入 |
| `copyText(text)` | Renderer→Main | 复制到剪贴板 |
| `reportCaptureError(msg)` | Renderer→Main | 报告音频采集错误 |
| `getStats()` | Renderer→Main | 获取统计数据 |
| `getHistory()` | Renderer→Main | 获取历史记录 |
| `clearHistory()` | Renderer→Main | 清空历史+统计 |
| `setTranslateModifier(key)` | Renderer→Main | 设置翻译修饰键 VK 码 |
| `getSystemLocale()` | Renderer→Main | 获取系统语言 |
| `setUiLanguage(lang)` | Renderer→Main | 设置界面语言（同步更新托盘菜单） |
| `getApiKey()` | Renderer→Main | 读取加密的 API Key |
| `setApiKey(key)` | Renderer→Main | 加密存储 API Key |
| `saveLlmSettings(settings)` | Renderer→Main | 持久化 LLM 配置（refineEnabled, model, baseUrl, asrProvider） |
| `initRefinement()` | Renderer→Main | 初始化/重新初始化润色引擎 |
| `getRefinementStatus()` | Renderer→Main | 查询润色状态 |

## 已知架构问题（待后续修复）

### 1. 设置不持久化 (Zustand store)
`src/store/settings.ts` 的 Zustand 状态（快捷键、词典、UI 语言、静音开关等）仅在内存中，重启后丢失。LLM 相关配置通过 `saveLlmSettings` 持久化到 `userData/data/llm-settings.json`，API Key 通过 `safeStorage` 加密存储。需要统一持久化层。

### 2. 快捷键硬编码为右 Alt
`electron/hotkey.ts` 的低层键盘钩子只监听 `VK_RMENU` (0xA5)。设置界面的"语音输入"快捷键录制器只更新 UI 显示，不改变实际钩子行为。需要重构 hotkey.ts 使其可配置。

### 3. 托盘 ASR 切换需重启生效
托盘菜单的本地/API 切换会持久化到 `llm-settings.json` 并重新初始化识别引擎，但 FunASRCloudProvider 的 `transcribe()` 方法是骨架（返回占位文本），需要实现云端 ASR API 调用。

### 4. 翻译引擎提示不准确
设置界面"翻译引擎"标签在未启用 LLM 润色时显示"未启用（需先开启 LLM 润色）"，但翻译功能实际上也需要 LLM API Key 且复用润色 provider。更准确的说法是翻译需要 LLM 配置完整。

### 5. 卸载清理
`assets/uninstall.nsh` 在卸载时会删除 `%APPDATA%/tingmo/` 全部数据（模型 + 统计 + 配置）。升级安装时不会触发卸载，所以数据安全。

## 开发注意事项

- **仅 Win x64**: onnxruntime-node 和 koffi FFI 均仅支持 Windows x64
- **开发时 2 个终端**: Vite dev server (5173) + Electron main process — 主进程通过 `LOAD_URL` 连接 Vite，否则加载 `dist/index.html`
- **CSP**: `index.html` 中设置了严格的 CSP（仅 `'self'` + `'unsafe-inline'` + `blob:`），修改时注意不要破坏内联脚本（下载窗口用 data: URL 不受此 CSP 限制）
- **esbuild 不检查类型**: `build:main` 使用 esbuild 编译，不做类型检查。`build:renderer` 的 `tsc` 步骤负责类型检查
- **模型下载需要 tar**: Windows 上 `tar` 需要在 PATH 中（Git Bash 自带或 Windows 10+ 内置）
- **PowerShell 依赖**: 音频静音功能依赖 PowerShell 执行 COM 脚本，需要 ExecutionPolicy 允许
- **kb win**: 全局键盘钩子 `SetWindowsHookExW` 可能被杀毒软件拦截，需添加白名单
- **文件权限**: 模型存放于 `%APPDATA%`，不需要管理员权限
