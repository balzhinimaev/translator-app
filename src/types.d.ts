// src/types.d.ts

// Минимальное описание интерфейса WebApp для типизации
interface TelegramWebApp {
  initData?: string;
  ready: () => void;
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
    header_bg_color?: string;
    accent_text_color?: string;
    section_bg_color?: string;
    section_header_text_color?: string;
    subtitle_text_color?: string;
    destructive_text_color?: string;
  };
  // Добавьте другие свойства по необходимости
}

// Расширяем глобальный интерфейс Window
declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

// Типы для речевых переводов (обычный режим)
export interface SpeechTranslationRequest {
  type: "speech_translate_request";
  request_id: string;
  payload: {
    audio_data: string; // base64 encoded audio
    src_lang: string;
    dst_lang: string;
    format?: string; // audio format (wav, mp3, etc.)
  };
}

export interface SpeechTranslationResponse {
  type: "speech_translate_chunk" | "speech_translate_done" | "speech_error" | "speech_info";
  request_id?: string;
  payload?: {
    // Для speech_translate_chunk - промежуточные данные
    transcribed_text?: string; // распознанный текст
    translated_text?: string; // переведенный текст
    // Для speech_translate_done - финальный результат
    final_audio?: string; // base64 encoded translated audio
    audio_format?: string; // формат аудио
  };
  error?: string;
  details?: string;
  message?: string;
}

// Типы для потокового режима
export interface StreamingStartMessage {
  type: 'start_streaming';
  request_id: string;
  payload: {
    src_lang: string;
    dst_lang: string;
    voice: string;
    speed: number;
  };
}

export interface StreamingAudioChunkMessage {
  type: 'audio_chunk';
  request_id: string;
  payload: {
    audio_chunk: string; // base64 encoded audio chunk
  };
}

export interface StreamingEndMessage {
  type: 'end_streaming';
  request_id: string;
  payload: Record<string, never>;
}

export type StreamingClientMessage = StreamingStartMessage | StreamingAudioChunkMessage | StreamingEndMessage;

export interface StreamingServerMessage {
  type: 'streaming_started' | 'partial_stt_result' | 'partial_translation_chunk' | 'translated_audio_chunk' | 'final_stream_ended' | 'info' | 'chunk_processing_started' | 'streaming_ended';
  request_id?: string;
  payload?: {
    // Для streaming_started
    session_id?: string;
    // Для partial_stt_result
    accumulated_text?: string;
    // Для partial_translation_chunk
    accumulated_translation?: string;
    // Для translated_audio_chunk
    audio_base64?: string; // base64 encoded translated audio chunk
  };
  error?: string;
  message?: string;
}

export {}; // Этот экспорт нужен, чтобы TypeScript считал файл модулем 