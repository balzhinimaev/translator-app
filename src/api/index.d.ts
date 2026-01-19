/**
 * Регистрирует пользователя и возвращает токен для WebSocket.
 * @param initData Данные для инициализации из Telegram Web App.
 * @returns Промис, который разрешается объектом с wsToken.
 */
export declare const registerUser: (initData: string) => Promise<{
    wsToken: string;
}>;
/**
 * Создает и возвращает WebSocket-соединение для стриминга перевода текста.
 * @param wsToken Токен для WebSocket, полученный при регистрации.
 * @returns Экземпляр WebSocket.
 */
export declare const createTranslationSocket: (wsToken: string) => WebSocket;
/**
 * Создает и возвращает WebSocket-соединение для перевода речи.
 * Поддерживает как обычный режим (speech_translate_request),
 * так и потоковый режим (start_streaming/audio_chunk/end_streaming).
 * @param wsToken Токен для WebSocket, полученный при регистрации.
 * @returns Экземпляр WebSocket.
 */
export declare const createSpeechTranslationSocket: (wsToken: string) => WebSocket;
