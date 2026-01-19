// src/App.tsx
import { useEffect, useState } from 'react';
import { Translator } from './components/Translator';
import { SpeechTranslator } from './components/SpeechTranslator';
import './App.css';

function App() {
  const [mode, setMode] = useState<'text' | 'speech'>('text');

  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      
      // Применяем тему Telegram к CSS переменным
      const themeParams = window.Telegram.WebApp.themeParams;
      const root = document.documentElement;
      
      if (themeParams.bg_color) {
        root.style.setProperty('--tg-theme-bg-color', themeParams.bg_color);
      }
      if (themeParams.text_color) {
        root.style.setProperty('--tg-theme-text-color', themeParams.text_color);
      }
      if (themeParams.hint_color) {
        root.style.setProperty('--tg-theme-hint-color', themeParams.hint_color);
      }
      if (themeParams.button_color) {
        root.style.setProperty('--tg-theme-button-color', themeParams.button_color);
      }
      if (themeParams.button_text_color) {
        root.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color);
      }
      if (themeParams.secondary_bg_color) {
        root.style.setProperty('--tg-theme-secondary-bg-color', themeParams.secondary_bg_color);
      }
      if (themeParams.section_bg_color) {
        root.style.setProperty('--tg-theme-section-bg-color', themeParams.section_bg_color);
      }
      if (themeParams.section_header_text_color) {
        root.style.setProperty('--tg-theme-section-header-text-color', themeParams.section_header_text_color);
      }
      if (themeParams.subtitle_text_color) {
        root.style.setProperty('--tg-theme-subtitle-text-color', themeParams.subtitle_text_color);
      }
      if (themeParams.destructive_text_color) {
        root.style.setProperty('--tg-theme-destructive-text-color', themeParams.destructive_text_color);
      }
    }
  }, []);

  return (
    <div className="App">
      <header className="app-header">
        <h1 className="app-title">🌍 Переводчик</h1>
        <div className="mode-selector">
          <button
            className={`mode-button ${mode === 'text' ? 'active' : ''}`}
            onClick={() => setMode('text')}
          >
            📝 Текст
          </button>
          <button
            className={`mode-button ${mode === 'speech' ? 'active' : ''}`}
            onClick={() => setMode('speech')}
          >
            🎤 Речь
          </button>
        </div>
      </header>

      <main className="app-content">
        {mode === 'speech' ? <SpeechTranslator /> : <Translator />}
      </main>
    </div>
  );
}

export default App;