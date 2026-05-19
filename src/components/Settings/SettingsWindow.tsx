import React, { useState } from 'react';
import { useSettingsStore } from '../../store/settings';
import { HotkeyRecorder } from './HotkeyRecorder';

type Tab = 'general' | 'hotkeys' | 'model' | 'about';

const NAV: { key: Tab; en: string; zh: string }[] = [
  { key: 'general', en: 'GENERAL', zh: '常规' },
  { key: 'hotkeys', en: 'KEYBIND', zh: '快捷键' },
  { key: 'model', en: 'MODEL', zh: '模型' },
  { key: 'about', en: 'ABOUT', zh: '关于' },
];

export const SettingsWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const {
    voiceMode, setVoiceMode,
    language, setLanguage,
    hotkey, setHotkey, resetHotkey,
  } = useSettingsStore();

  return (
    <div className="nb-shell">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <nav className="nb-sidebar">
        <div className="nb-sidebar-top">
          <div className="nb-sidebar-brand">
            <span className="nb-dot" />
            <span>TINGMO</span>
          </div>
          <div className="nb-sidebar-nav">
            {NAV.map((item) => (
              <button
                key={item.key}
                className={`nb-nav-item ${activeTab === item.key ? 'active' : ''}`}
                onClick={() => setActiveTab(item.key)}
              >
                <span className="nb-nav-en">{item.en}</span>
                <span className="nb-nav-zh">{item.zh}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="nb-sidebar-ver">v0.1.0</div>
      </nav>

      {/* ── Main Content ─────────────────────────────────── */}
      <main className="nb-main">
        {activeTab === 'general' && (
          <section className="nb-section">
            <h2 className="nb-section-title">
              <span className="nb-tag accent">GENERAL</span>
              常规
            </h2>
            <div className="nb-card">
              <div className="nb-row">
                <span className="nb-label">语音模式</span>
                <div className="nb-segmented">
                  <button
                    className={`nb-seg ${voiceMode === 'local' ? 'active' : ''}`}
                    onClick={() => setVoiceMode('local')}
                  >
                    本地
                  </button>
                  <button className="nb-seg" disabled>API</button>
                </div>
              </div>
              <div className="nb-hr" />
              <div className="nb-row">
                <span className="nb-label">识别语言</span>
                <div className="nb-segmented">
                  <button
                    className={`nb-seg ${language === 'zh' ? 'active' : ''}`}
                    onClick={() => setLanguage('zh')}
                  >
                    中文
                  </button>
                  <button
                    className={`nb-seg ${language === 'en' ? 'active' : ''}`}
                    onClick={() => setLanguage('en')}
                  >
                    EN
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'hotkeys' && (
          <section className="nb-section">
            <h2 className="nb-section-title">
              <span className="nb-tag accent">KEYBIND</span>
              快捷键
            </h2>
            <div className="nb-card">
              <HotkeyRecorder
                currentHotkey={hotkey}
                onHotkeyChange={setHotkey}
                onReset={resetHotkey}
              />
            </div>
          </section>
        )}

        {activeTab === 'model' && (
          <section className="nb-section">
            <h2 className="nb-section-title">
              <span className="nb-tag accent">MODEL</span>
              模型
            </h2>
            <div className="nb-card">
              <div className="nb-row">
                <span className="nb-label">引擎</span>
                <span className="nb-value">SenseVoice-Small</span>
              </div>
              <div className="nb-hr" />
              <div className="nb-row">
                <span className="nb-label">推理</span>
                <span className="nb-value">ONNX Runtime</span>
              </div>
              <div className="nb-hr" />
              <div className="nb-row">
                <span className="nb-label">Token</span>
                <span className="nb-value">25,055</span>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'about' && (
          <section className="nb-section">
            <h2 className="nb-section-title">
              <span className="nb-tag accent">ABOUT</span>
              关于
            </h2>
            <div className="nb-card">
              <p className="nb-about-name">TingMo 听墨</p>
              <p className="nb-about-desc">
                桌面 AI 语音输入法。按快捷键开始录音，再次按下停止，语音自动转文字注入光标位置。
              </p>
              <div className="nb-meta">
                <span>Electron</span><span className="meta-dot">·</span>
                <span>React</span><span className="meta-dot">·</span>
                <span>TypeScript</span><span className="meta-dot">·</span>
                <span>SenseVoice</span><span className="meta-dot">·</span>
                <span>ONNX</span>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
};
