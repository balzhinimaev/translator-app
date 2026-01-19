// src/components/Translator.tsx
import { useState, useEffect, useRef } from 'react';
import { registerUser, createTranslationSocket } from '../api';

const supportedLanguages = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
];

export const Translator = () => {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [srcLang, setSrcLang] = useState('en');
  const [dstLang, setDstLang] = useState('ru');
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;

    if (!initData) {
      console.error("Telegram WebApp initData not found.");
      setResult('Ошибка: Telegram initData не найден. Откройте приложение через Telegram.');
      return;
    }

    const connect = async () => {
      try {
        console.log('Регистрация пользователя...');
        const { wsToken } = await registerUser(initData);
        console.log('Получен токен:', wsToken.substring(0, 20) + '...');
        
        const socket = createTranslationSocket(wsToken);
        socketRef.current = socket;

        socket.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
        
            switch (data.type) {
              case 'translate_chunk':
                if (data.payload?.delta) {
                  setResult(prevText => prevText + data.payload.delta);
                }
                break;
        
              case 'translate_done':
                console.log('Перевод завершен:', data.payload?.translated_text);
                setIsLoading(false);
                break;
              
              case 'error':
                console.error('Ошибка от сервера:', data.error, data.details);
                setResult(`Ошибка: ${data.error || 'Неизвестная ошибка'}`);
                setIsLoading(false);
                break;
                  
              case 'info':
                console.log('Инфо от сервера:', data.message);
                break;
                
              default:
                console.warn('Получено сообщение неизвестного типа:', data.type);
            }
          } catch (err) {
            console.error("Не удалось обработать WebSocket сообщение:", event.data, err);
          }
        };

        socket.onclose = (event) => {
          console.log('WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
          setIsConnected(false);
          setIsLoading(false);
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          
          if (socket.readyState === WebSocket.CONNECTING) {
            setResult('Ошибка: Не удалось подключиться к серверу переводов. Проверьте настройки бэкенда.');
          } else {
            setResult('Ошибка соединения с сервисом переводов.');
          }
          setIsConnected(false);
          setIsLoading(false);
        };

      } catch (error) {
        console.error('Failed to connect:', error);
        if (error instanceof Error) {
          setResult(`Ошибка подключения: ${error.message}`);
        } else {
          setResult('Ошибка: Не удалось подключиться к сервису переводов.');
        }
      }
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const handleTranslate = () => {
    if (!text.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    setIsLoading(true);
    setResult('');

    const message = JSON.stringify({
      type: "translate_request",
      request_id: crypto.randomUUID(),
      payload: {
        text: text,
        src_lang: srcLang,
        dst_lang: dstLang,
      }
    });

    socketRef.current.send(message);
  };

  const handleSwapLanguages = () => {
    setSrcLang(dstLang);
    setDstLang(srcLang);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleTranslate();
    }
  };

  return (
    <div>
      {/* Status */}
      <div className="status-indicator">
        <div className={`status-dot ${isConnected ? 'connected' : ''}`}></div>
        <span>{isConnected ? 'Подключен к серверу' : 'Нет соединения'}</span>
      </div>

      {/* Language selector */}
      <div className="language-selector">
        <select 
          value={srcLang} 
          onChange={(e) => setSrcLang(e.target.value)}
          className="language-select"
        >
          {supportedLanguages.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.name}</option>
          ))}
        </select>
        
        <button 
          onClick={handleSwapLanguages} 
          className="swap-button"
          title="Поменять языки местами"
        >
          ⇄
        </button>

        <select 
          value={dstLang} 
          onChange={(e) => setDstLang(e.target.value)}
          className="language-select"
        >
          {supportedLanguages.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.name}</option>
          ))}
        </select>
      </div>

      {/* Input */}
      <div className="input-section">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Введите текст для перевода..."
          className="text-input"
          rows={4}
        />
      </div>

      {/* Translate button */}
      <button 
        onClick={handleTranslate} 
        disabled={!isConnected || isLoading || !text.trim()}
        className="primary-button"
      >
        {isLoading && <div className="loading-spinner"></div>}
        {isLoading ? 'Перевод...' : 'Перевести'}
      </button>

      {/* Result */}
      {result && (
        <div className="result-section">
          <div className="result-item">
            <div className="result-label">Результат перевода</div>
            <div className={`result-text ${result.startsWith('Ошибка') ? 'error' : 'translated'}`}>
              {result}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};