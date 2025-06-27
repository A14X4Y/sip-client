# 🚀 SIP-клиент

Веб-клиент для SIP-звонков через WebRTC.

Репозиторий: [https://github.com/A14X4Y/sip-client](https://github.com/A14X4Y/sip-client)

---

## 🧭 Запуск проекта

Вы можете запустить проект двумя способами: через Docker или вручную через Node.js.

### ✅ Вариант 1: Запуск через Docker

```bash
git clone https://github.com/A14X4Y/sip-client.git
cd sip-client
docker compose up -d
```

Откройте в браузере:
```
http://localhost:3000
```

---

### ✅ Вариант 2: Запуск вручную (без Docker)

```bash
git clone https://github.com/A14X4Y/sip-client.git
cd sip-client
npm i
npm run dev
```

Откройте в браузере:
```
http://localhost:3000
```

---

## 🧩 Параметры URL

Можно передать настройки SIP-клиента через URL-параметры.

| Параметр        | Пример значения                                 | Описание                                                        |
|-----------------|--------------------------------------------------|-----------------------------------------------------------------|
| `websocketUrl`  | `"wss://vidu.crowncode.dev/sip"`                | WebSocket URL SIP-сервера                                       |
| `username`      | `"SIP"`                                          | Логин SIP-пользователя                                          |
| `password`      | `"secret"`                                       | Пароль                                                          |
| `domain`        | `"vidu.crowncode.dev"`                           | Домен SIP-сервера                                               |
| `enableVideo`   | `"true"` или `"false"`                           | Включить видео или только аудио                                 |
| `callTo`        | `"43a27aaf5d70faa8@vidu.crowncode.dev"`          | SIP URI вызываемого абонента                                    |

---

## ✅ Пример ссылки

```text
http://localhost:3000/?websocketUrl="wss://vidu.crowncode.dev/sip"&username="SIP"&password="secret"&domain="vidu.crowncode.dev"&enableVideo="false"&callTo="43a27aaf5d70faa8@vidu.crowncode.dev"
```

