# Приложение Переводчика Речи (Speech Translator)

Телеграм Web App для перевода речи в реальном времени с поддержкой двух режимов работы: обычного и потокового.

## Возможности

### 🎤 Два Режима Записи

#### Обычный Режим
- Записываете речь полностью
- Останавливаете запись
- Отправляете весь файл на сервер
- Получаете результат перевода

#### Потоковый Режим (NEW!)
- Начинаете запись
- Отправляете аудио чанками каждые 1.5 секунды
- Получаете промежуточные результаты в реальном времени
- Видите распознавание речи и перевод по мере говорения

### 🌍 Поддерживаемые Языки
- Английский (English)
- Русский (Русский)
- Немецкий (Deutsch)
- Французский (Français)
- Испанский (Español)
- Итальянский (Italiano)
- Китайский (中文)
- Японский (日本語)

### 🎙️ Настройки Голоса (Потоковый Режим)
- **6 вариантов голоса**: Alloy, Echo, Fable, Onyx, Nova, Shimmer
- **Настройка скорости**: от 0.25x до 4.0x
- **Качественный синтез речи** для озвучивания переводов

## Технические Детали

### WebSocket Протокол для Потокового Режима

#### Сообщения от клиента к серверу:

1. **Начало потоковой сессии**:
```json
{
  "type": "start_streaming",
  "request_id": "uuid",
  "payload": {
    "src_lang": "ru",
    "dst_lang": "en",
    "voice": "alloy",
    "speed": 1.0
  }
}
```

2. **Отправка аудио-чанка** (каждые 1.5 сек):
```json
{
  "type": "audio_chunk",
  "request_id": "uuid",
  "payload": {
    "audio_chunk": "base64_encoded_audio_chunk"
  }
}
```

3. **Завершение сессии**:
```json
{
  "type": "end_streaming",
  "request_id": "uuid",
  "payload": {}
}
```

#### Сообщения от сервера к клиенту:
- `streaming_started` - сессия готова к работе
- `partial_stt_result` - частичный результат распознавания речи
- `partial_translation_chunk` - частичный перевод (стриминг)
- `final_audio_ready` - готовое аудио перевода

### Архитектура

- **Frontend**: React + TypeScript + Vite
- **WebSocket API**: Для связи с бэкендом
- **MediaRecorder API**: Для записи аудио в браузере
- **Web Audio API**: Для воспроизведения переведенного аудио
- **Telegram Web App API**: Интеграция с Telegram

## Установка и Запуск

1. **Установка зависимостей**:
```bash
npm install
```

2. **Разработка**:
```bash
npm run dev
```

3. **Сборка для продакшена**:
```bash
npm run build
```

4. **Предварительный просмотр сборки**:
```bash
npm run preview
```

## Структура Проекта

```
src/
├── api/
│   └── index.ts          # WebSocket API функции
├── components/
│   ├── SpeechTranslator.tsx  # Основной компонент
│   └── Translator.tsx        # Текстовый переводчик
├── types.d.ts            # TypeScript типы
├── App.tsx               # Главный компонент
├── App.css               # Стили приложения
└── main.tsx              # Точка входа
```

## Как Использовать

### Обычный Режим
1. Выберите языки перевода
2. Нажмите кнопку микрофона 🎤
3. Говорите, затем нажмите 🛑 для остановки
4. Дождитесь результата и воспроизведения аудио

### Потоковый Режим
1. Переключитесь в "Потоковый режим"
2. Настройте голос и скорость (опционально)
3. Выберите языки перевода
4. Нажмите кнопку микрофона 🎤
5. Говорите - видите результаты в реальном времени
6. Нажмите 🛑 для завершения сессии

## Технические Требования

- Современный браузер с поддержкой MediaRecorder API
- Разрешение на доступ к микрофону
- Стабильное интернет-соединение для потокового режима
- Telegram для использования в качестве Web App

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
