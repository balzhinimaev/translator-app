import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Это позволит подключаться к вашему dev-серверу из сети
    hmr: {
      // Указываем внешний хост, через который будет идти подключение
      host: "websupps.site",
      // Указываем протокол secure websocket
      protocol: "wss",
      // Клиент HMR будет подключаться к стандартному порту HTTPS
      clientPort: 443,
      // Путь должен точно соответствовать location в Nginx
      path: "/vite-hmr/",
    },
    watch: {
      usePolling: true,
    },
    // Явно разрешаем хост, к которому обращается ваше приложение
    allowedHosts: [
      "websupps.site",
      // Добавьте сюда также хост от ngrok, если используете его
      ".ngrok-free.app",
    ],
  },
});
