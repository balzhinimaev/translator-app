// src/api/index.ts
import axios from "axios";

// Укажите базовый URL вашего бэкенда.
// Для локальной разработки, когда бэкенд на localhost:3000
const API_BASE_URL = "/v1/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

/**
 * Регистрирует пользователя и возвращает токен для WebSocket.
 * @param initData Данные для инициализации из Telegram Web App.
 * @returns Промис, который разрешается объектом с wsToken.
 */
export const registerUser = async (
  initData: string
): Promise<{ wsToken: string }> => {
  const response = await apiClient.post("/users/register", { initData });
  return response.data; // Ожидаем { wsToken: '...' }
};

/**
 * Создает и возвращает WebSocket-соединение для стриминга перевода текста.
 * @param wsToken Токен для WebSocket, полученный при регистрации.
 * @returns Экземпляр WebSocket.
 */
export const createTranslationSocket = (wsToken: string): WebSocket => {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsPath = `/v1/api/stream/translate?token=${wsToken}`;
  const wsUrl = `${wsProtocol}//${window.location.host}${wsPath}`;

  return new WebSocket(wsUrl);
};

/**
 * Создает и возвращает WebSocket-соединение для перевода речи.
 * Поддерживает как обычный режим (speech_translate_request), 
 * так и потоковый режим (start_streaming/audio_chunk/end_streaming).
 * @param wsToken Токен для WebSocket, полученный при регистрации.
 * @returns Экземпляр WebSocket.
 */
export const createSpeechTranslationSocket = (wsToken: string): WebSocket => {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsPath = `/v1/api/stream/speech?token=${wsToken}`;
  const wsUrl = `${wsProtocol}//${window.location.host}${wsPath}`;

  return new WebSocket(wsUrl);
};
