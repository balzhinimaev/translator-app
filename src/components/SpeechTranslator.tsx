import { useState, useEffect, useRef } from 'react';
import { registerUser, createSpeechTranslationSocket } from '../api';
import type { 
  StreamingClientMessage, 
  StreamingServerMessage
} from '../types';

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

const voiceOptions = [
  { value: 'alloy', name: 'Alloy' },
  { value: 'echo', name: 'Echo' },
  { value: 'fable', name: 'Fable' },
  { value: 'onyx', name: 'Onyx' },
  { value: 'nova', name: 'Nova' },
  { value: 'shimmer', name: 'Shimmer' },
];

// Кодек будет определяться динамически при получении первого аудио-чанка.

/**
 * Пробуем угадать кодек по первым байтам аудио данных.
 * @returns MIME-type для MediaSource.addSourceBuffer
 */
const sniffCodec = (bytes: Uint8Array): string => {
  console.log('Определение кодека по байтам:', Array.from(bytes.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  
  // ADTS AAC frame   ff f1 / ff f9 / ff f3 / ff f0
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) {
    console.log('Обнаружен ADTS AAC');
    return 'audio/aac';
  }
  // MP3 frame sync   ff fa / ff fb
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    console.log('Обнаружен MP3');
    return 'audio/mpeg';
  }
  // ID3 (mp3 metadata at start)
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    console.log('Обнаружен MP3 с ID3');
    return 'audio/mpeg';
  }
  // Fallback – контейнер MP4/AAC (нужен фрагментированый mp4)
  console.log('Используем fallback MP4/AAC кодек');
  return 'audio/mp4; codecs="mp4a.40.2"';
};

export const SpeechTranslator = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [srcLang, setSrcLang] = useState('en');
  const [dstLang, setDstLang] = useState('ru');
  const [transcribedText, setTranscribedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [status, setStatus] = useState('Готов к работе');
  
  const [isStreamingMode, setIsStreamingMode] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [isAudioPlayerVisible, setIsAudioPlayerVisible] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentRequestIdRef = useRef<string>('');
  
  // Refs для MediaSource API
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const audioQueue = useRef<ArrayBuffer[]>([]);
  const isPlaying = useRef(false);
  const streamingIntervalRef = useRef<number | null>(null);
  const isStreamEnding = useRef(false);
  const selectedMimeCodec = useRef<string>('');

  useEffect(() => {
    // Проверяем поддержку MediaSource API
    if (!window.MediaSource) {
      console.error('MediaSource API не поддерживается в этом браузере');
      setStatus('Ошибка: MediaSource API не поддерживается в этом браузере');
      return;
    }

    const initData = window.Telegram?.WebApp?.initData;

    if (!initData) {
      console.error("Telegram WebApp initData not found.");
      setStatus('Ошибка: Telegram initData не найден.');
      return;
    }

    const connect = async () => {
      try {
        setStatus('Подключение к серверу...');
        const { wsToken } = await registerUser(initData);
        
        const socket = createSpeechTranslationSocket(wsToken);
        socketRef.current = socket;
        setupSocket(socket);

      } catch (error) {
        console.error('Failed to connect:', error);
        setStatus('Ошибка: Не удалось подключиться к сервису перевода');
      }
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
      }
      if (audioPlayerRef.current?.src) {
        URL.revokeObjectURL(audioPlayerRef.current.src);
      }
    };
  }, []);

  const setupSocket = (socket: WebSocket) => {
    socket.onopen = () => {
      console.log('Speech WebSocket connected');
      setIsConnected(true);
      setStatus('Подключено к серверу');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // В данный момент вся логика только для потокового режима
        handleStreamingModeMessage(data as StreamingServerMessage);
      } catch (err) {
        console.error("Не удалось обработать WebSocket сообщение:", event.data, err);
      }
    };

    socket.onclose = () => {
      console.log('Speech WebSocket disconnected');
      setIsConnected(false);
      setIsProcessing(false);
      setStatus('Соединение потеряно');
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
      }
    };

    socket.onerror = (error) => {
      console.error('Speech WebSocket error:', error);
      setStatus('Ошибка соединения');
      setIsConnected(false);
      setIsProcessing(false);
    };
  };
  
  const handleStreamingModeMessage = (data: StreamingServerMessage) => {
    console.log('Получено сообщение от WS:', data); // Логируем каждое сообщение

    switch (data.type) {
      case 'streaming_started':
        console.log('Потоковая сессия начата');
        setStatus('Потоковая сессия активна');
        break;
      case 'info':
        if (data.message) {
          console.log('Инфо от сервера:', data.message);
          setStatus(data.message);
        }
        break;
      case 'chunk_processing_started':
        console.log('Обработка чанка записи...');
        setStatus('Обработка записи...');
        break;
      case 'partial_stt_result':
        if (data.payload?.accumulated_text) setTranscribedText(data.payload.accumulated_text);
        break;
      case 'partial_translation_chunk':
        if (data.payload?.accumulated_translation) setTranslatedText(data.payload.accumulated_translation);
        break;
      case 'translated_audio_chunk':
        console.log('Обработка translated_audio_chunk...');
        if (data.payload?.audio_base64) {
          console.log(`Получен аудио-чанк, размер base64: ${data.payload.audio_base64.length}`);
          try {
            const binaryString = window.atob(data.payload.audio_base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            console.log(`Декодирован аудио-чанк, размер: ${bytes.length} байт`);

            // Если MediaSource ещё не создан – определяем кодек и инициируем его.
            console.log('Проверяем MediaSource:', !!mediaSourceRef.current, 'SourceBuffer:', !!sourceBufferRef.current);
            if (!mediaSourceRef.current || !sourceBufferRef.current) {
              const codec = sniffCodec(bytes);
              console.log('Определён кодек:', codec);
              initializeMediaSource(codec);
            } else {
              console.log('MediaSource уже инициализирован, состояние:', mediaSourceRef.current.readyState);
            }

            audioQueue.current.push(bytes.buffer);
            console.log(`Добавлен в очередь, всего в очереди: ${audioQueue.current.length} чанков`);
            
            // Сбросим флаг завершения, если получили новый чанк
            if (isStreamEnding.current) {
              console.log('Получен аудио чанк после streaming_ended, сбрасываем флаг завершения');
              isStreamEnding.current = false;
            }
            
            // Попробуем воспроизвести только если MediaSource готов
            if (!isPlaying.current && sourceBufferRef.current) {
              console.log('Вызываем playNextInQueue, так как SourceBuffer готов');
              playNextInQueue();
            } else if (!sourceBufferRef.current) {
              console.log('SourceBuffer не готов, ждем инициализации MediaSource');
            }
          } catch(e) {
            console.error("Ошибка декодирования или добавления аудио-чанка в очередь:", e);
          }
        } else {
          console.warn('Сообщение translated_audio_chunk пришло без payload.audio_base64');
        }
        break;
      case 'final_stream_ended':
        console.log("Поток аудио завершен.");
        setStatus('Аудио полностью получено, завершаем...');
        // Ничего не делаем здесь. Ждём 'streaming_ended', чтобы корректно закрыть MSE после всех чанков
        break;
      case 'streaming_ended':
        console.log("Сессия полностью завершена.");
        setStatus('Завершение сессии...');
        setIsProcessing(false);
        
        // Устанавливаем флаг завершения с задержкой, чтобы дать время на получение последних чанков
        setTimeout(() => {
          console.log('Устанавливаем флаг завершения стрима');
          isStreamEnding.current = true;
          playNextInQueue();
        }, 500);
        break;
      default:
        // Эта строка поможет отловить любые неизвестные типы сообщений
        console.warn(`Получено необработанное сообщение: тип '${(data as StreamingServerMessage).type}'`);
    }
  };

  const initializeMediaSource = (codec: string) => {
    selectedMimeCodec.current = codec;
    console.log('Инициализация MediaSource с кодеком:', codec);
    console.log('MediaSource.isTypeSupported:', MediaSource.isTypeSupported(codec));

    if (!MediaSource.isTypeSupported(codec)) {
      console.warn(`MediaSource не поддерживает ${codec}`);
      
      // Попробуем альтернативные кодеки
      const alternatives = ['audio/mpeg', 'audio/mp4; codecs="mp4a.40.2"', 'audio/aac'];
      for (const alt of alternatives) {
        if (MediaSource.isTypeSupported(alt)) {
          console.log(`Используем альтернативный кодек: ${alt}`);
          codec = alt;
          selectedMimeCodec.current = alt;
          break;
        }
      }
      
      if (!MediaSource.isTypeSupported(codec)) {
        setStatus(`Ошибка: Браузер не поддерживает кодек ${codec}.`);
        return;
      }
    }
    
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    
    if (audioPlayerRef.current) {
      // Очистим предыдущий src если он был
      if (audioPlayerRef.current.src) {
        URL.revokeObjectURL(audioPlayerRef.current.src);
      }
      audioPlayerRef.current.src = URL.createObjectURL(mediaSource);
      console.log('MediaSource URL создан и установлен в audio element');
    }
    
    const onSourceOpen = () => {
      console.log('MediaSource открыт, создаем SourceBuffer');
      if (!mediaSourceRef.current) {
        console.error('MediaSource недоступен в onSourceOpen');
        return;
      }
      
      try {
        sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer(codec);
        console.log('SourceBuffer создан успешно, очередь содержит:', audioQueue.current.length, 'чанков');
        sourceBufferRef.current.addEventListener('updateend', playNextInQueue);
        sourceBufferRef.current.addEventListener('error', (e) => {
          console.error('Ошибка SourceBuffer:', e);
        });
        
        // Начинаем воспроизведение, если есть данные в очереди
        if (audioQueue.current.length > 0) {
          console.log('Запускаем воспроизведение накопленных чанков');
          playNextInQueue();
        }
      } catch (e) {
        console.error('Ошибка создания SourceBuffer:', e);
        setStatus(`Ошибка: Не удалось создать SourceBuffer для ${codec}`);
      }
    };
    
    mediaSource.addEventListener('sourceopen', onSourceOpen, { once: true });
    mediaSource.addEventListener('sourceended', () => {
      console.log('MediaSource завершен');
    });
    mediaSource.addEventListener('error', (e) => {
      console.error('Ошибка MediaSource:', e);
    });

    setIsAudioPlayerVisible(true);
  };
  
  const playNextInQueue = () => {
    console.log('playNextInQueue вызван, очередь:', audioQueue.current.length, 'элементов');
    
    if (!sourceBufferRef.current) {
      console.log('SourceBuffer недоступен');
      return;
    }
    
    if (sourceBufferRef.current.updating) {
      console.log('SourceBuffer обновляется, ждем...');
      return;
    }
    
    if (audioQueue.current.length === 0) {
      console.log('Очередь аудио пуста');
      // Если очередь пуста и пришёл сигнал о завершении — закрываем MediaSource
      if (isStreamEnding.current && mediaSourceRef.current?.readyState === 'open') {
        console.log('Завершаем MediaSource - endOfStream()');
        try {
          mediaSourceRef.current.endOfStream();
          isStreamEnding.current = false;
          setStatus('Аудио готово к воспроизведению');
        } catch (e) {
          console.error('Ошибка при endOfStream:', e);
        }
      }
      isPlaying.current = false;
      return;
    }
    
    isPlaying.current = true;
    const audioChunk = audioQueue.current.shift()!;
    console.log('Добавляем аудио чанк в SourceBuffer, размер:', audioChunk.byteLength, 'байт');
    
    try {
      sourceBufferRef.current.appendBuffer(audioChunk);
      console.log('Аудио чанк успешно добавлен в SourceBuffer');
    } catch(e) {
      console.error("Критическая ошибка при добавлении чанка в SourceBuffer:", e);
      console.error("MediaSource readyState:", mediaSourceRef.current?.readyState);
      console.error("SourceBuffer buffered:", sourceBufferRef.current?.buffered);
      audioQueue.current = [];
      isPlaying.current = false;
      return;
    }
    
    // Проверяем статус плеера и пытаемся запустить воспроизведение
    if (audioPlayerRef.current) {
      console.log('Audio player paused:', audioPlayerRef.current.paused, 'readyState:', audioPlayerRef.current.readyState);
      if (audioPlayerRef.current.paused) {
        audioPlayerRef.current.play().then(() => {
          console.log('Воспроизведение запущено успешно');
        }).catch(e => {
          console.error("Ошибка при попытке воспроизведения:", e);
          isPlaying.current = false;
        });
      }
    }
  };

  const encodeAudioToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        const binary = Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join('');
        resolve(btoa(binary));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  };

  const sendAccumulatedChunks = async () => {
    if (audioChunksRef.current.length === 0) return;

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];
    
    try {
      const base64Audio = await encodeAudioToBase64(audioBlob);
      const chunkMessage: StreamingClientMessage = {
        type: 'audio_chunk',
        request_id: currentRequestIdRef.current,
        payload: { audio_chunk: base64Audio }
      };

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(chunkMessage));
      }
    } catch (error) {
      console.error('Ошибка отправки аудио чанка:', error);
    }
  };

  const startRecording = async () => {
    setTranscribedText('');
    setTranslatedText('');
    audioQueue.current = [];
    isPlaying.current = false;
    isStreamEnding.current = false;
    
    // Сбрасываем предыдущие MediaSource и SourceBuffer
    if (mediaSourceRef.current) {
      try {
        if (mediaSourceRef.current.readyState === 'open') {
          mediaSourceRef.current.endOfStream();
        }
      } catch {
        console.log('Предыдущий MediaSource уже закрыт');
      }
      mediaSourceRef.current = null;
    }
    sourceBufferRef.current = null;
    
    // Инициализируем MediaSource позже, когда получим первый аудио-чанк и поймём кодек

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const requestId = crypto.randomUUID();
      currentRequestIdRef.current = requestId;

      const startMessage: StreamingClientMessage = {
        type: 'start_streaming',
        request_id: requestId,
        payload: { src_lang: srcLang, dst_lang: dstLang, voice: selectedVoice, speed: voiceSpeed }
      };

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(startMessage));
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
          if (totalSize > 50000) {
            sendAccumulatedChunks();
          }
        }
      };

      streamingIntervalRef.current = setInterval(() => {
        if (audioChunksRef.current.length > 0) {
          sendAccumulatedChunks();
        }
      }, 6000);

      mediaRecorder.start(2000);
      setIsRecording(true);
      setIsProcessing(true);
      setStatus('Потоковая запись...');
    } catch (error) {
      console.error('Ошибка доступа к микрофону:', error);
      setStatus('Ошибка: Нет доступа к микрофону');
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
    }

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());

    if (audioChunksRef.current.length > 0) {
      await sendAccumulatedChunks();
    }

    const endMessage: StreamingClientMessage = {
      type: 'end_streaming',
      request_id: currentRequestIdRef.current,
      payload: {} as Record<string, never>
    };

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(endMessage));
    }
    setStatus('Завершение сессии...');
  };

  const handleSwapLanguages = () => {
    setSrcLang(dstLang);
    setDstLang(srcLang);
  };

  const handleModeChange = (streaming: boolean) => {
    if (isRecording) {
      setStatus('Остановите запись перед сменой режима');
      return;
    }
    setIsStreamingMode(streaming);
    setTranscribedText('');
    setTranslatedText('');
    setIsAudioPlayerVisible(false);
    setStatus('Готов к работе');
  };

  return (
    <div>
      {/* Status & Player */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
        <div className="status-indicator">
            <div className={`status-dot ${isConnected ? 'connected' : ''}`}></div>
            <span>{isConnected ? 'Подключен к серверу' : 'Нет соединения'}</span>
        </div>
        <div className="status-indicator">
            <span>{status}</span>
        </div>
        {isAudioPlayerVisible && (
            <div className="audio-player-container" style={{marginBottom: '16px'}}>
                <audio ref={audioPlayerRef} controls style={{ width: '100%' }} />
            </div>
        )}
      </div>

      {/* Mode selector */}
      <div className="mode-selector" style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Режим работы:</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleModeChange(false)}
            disabled={isRecording}
            className={`mode-button ${!isStreamingMode ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: !isStreamingMode ? '#007bff' : 'transparent',
              color: !isStreamingMode ? 'white' : 'inherit',
              cursor: isRecording ? 'not-allowed' : 'pointer'
            }}
          >
            Обычный режим
          </button>
          <button
            onClick={() => handleModeChange(true)}
            disabled={isRecording}
            className={`mode-button ${isStreamingMode ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: isStreamingMode ? '#007bff' : 'transparent',
              color: isStreamingMode ? 'white' : 'inherit',
              cursor: isRecording ? 'not-allowed' : 'pointer'
            }}
          >
            Потоковый режим
          </button>
        </div>
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

      {/* Streaming mode settings */}
      {isStreamingMode && (
        <div className="streaming-settings" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                Голос:
              </label>
              <select 
                value={selectedVoice} 
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="voice-select"
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                {voiceOptions.map(voice => (
                  <option key={voice.value} value={voice.value}>{voice.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                Скорость: {voiceSpeed}
              </label>
              <input
                type="range"
                min="0.25"
                max="4.0"
                step="0.25"
                value={voiceSpeed}
                onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                className="speed-slider"
              />
            </div>
          </div>
        </div>
      )}

      {/* Record button */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!isConnected || (isProcessing && !isStreamingMode)}
          className={`record-button ${isRecording ? 'recording' : ''}`}
        >
          {isRecording ? '🛑' : '🎤'}
        </button>
        <div style={{ 
          marginTop: '12px', 
          fontSize: '14px', 
          color: 'var(--tg-theme-hint-color)',
          fontWeight: 500
        }}>
          {isRecording 
            ? `Нажмите, чтобы остановить ${isStreamingMode ? '(потоковый режим)' : ''}` 
            : `Нажмите, чтобы начать запись ${isStreamingMode ? '(потоковый режим)' : ''}`
          }
        </div>
      </div>

      {/* Results */}
      {(transcribedText || translatedText) && (
        <div className="result-section">
          {(transcribedText) && (
            <div className="result-item">
              <div className="result-label">
                {isStreamingMode ? 'Распознаваемый текст (в реальном времени)' : 'Распознанный текст'}
              </div>
              <div className="result-text transcribed">
                {transcribedText}
              </div>
            </div>
          )}
          
          {translatedText && (
            <div className="result-item">
              <div className="result-label">
                {isStreamingMode ? 'Переводимый текст (в реальном времени)' : 'Переведенный текст'}
              </div>
              <div className="result-text translated">
                {translatedText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 