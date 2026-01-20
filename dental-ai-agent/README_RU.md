# Dental AI Agent (Telegram + WhatsApp/SMS + Voice) + CRM

Шаблон AI-администратора стоматологической клиники (русский язык):
- консультации (администратор + общая инфо по ортодонтии, без диагноза)
- запись/перенос/отмена
- проверка существующих записей по телефону
- каналы: Telegram, Twilio SMS/WhatsApp, Twilio Voice (Media Streams realtime)
- интеграция с CRM (провайдер `generic` или `squire`-заглушка)

## Быстрый старт локально
```bash
npm install
copy .env.example .env   # Windows
# или: cp .env.example .env   # Mac/Linux
npm run start
```

## Подключение Telegram
Webhook:
```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" ^
  -d "url=<PUBLIC_BASE_URL>/telegram/webhook"
```

## Подключение Twilio SMS/WhatsApp
Twilio Console → Messaging webhook:
- SMS: `<PUBLIC_BASE_URL>/twilio/inbound-sms`
- WhatsApp: `<PUBLIC_BASE_URL>/twilio/inbound-whatsapp`

## Входящие звонки Twilio (realtime)
Twilio Console → Phone Number → Voice → "A Call Comes In":
`<PUBLIC_BASE_URL>/twilio/incoming-call` (POST)

## Деплой без ngrok
Размести на Render/Railway/Fly/VPS, получи домен и укажи `PUBLIC_BASE_URL`.
Затем проставь вебхуки в Telegram и Twilio.

## Что менять
- Промпт: `src/agent/systemPromptRu.js`
- Инструменты (CRM): `src/agent/tools.js`
- CRM провайдеры: `src/crm/providers/*`
- Каналы:
  - Telegram: `src/channels/telegram.js`
  - Twilio SMS/WhatsApp: `src/channels/twilioMessaging.js`
  - Twilio Voice realtime: `src/channels/twilioVoiceRealtime.js`


## Squareup / Square Bookings (Appointments) настройка
Этот проект поддерживает `CRM_PROVIDER=squareup` через Square Bookings API. citeturn0search4turn1view0turn0search0turn0search3

Нужно:
1) Создать приложение в Square Developer Dashboard и получить `SQUARE_ACCESS_TOKEN`.
2) Узнать `SQUARE_LOCATION_ID` (Square Locations API или из кабинета).
3) Получить **service_variation_id** для каждой услуги (Catalog Item Variation ID). Добавь маппинг:
   `SQUARE_SERVICE_MAP_JSON={"Консультация ортодонта":"VARIATION_ID_1", ...}`
4) Добавь список team member IDs (Square Team API) — часто обязателен для создания бронирования:
   `SQUARE_TEAM_MEMBER_IDS_JSON=["TM...","TM..."]`

Проверка доступности (поиск слотов) в Square делается через:
`POST /v2/bookings/availability/search`. citeturn0search1turn1view3
(в шаблоне пока используется простая логика записи/проверки существующих записей; при желании добавлю полноценный подбор свободных слотов по availability.)


## Где хостить, чтобы работало 24/7 (без ngrok)
Тебе нужен хостинг, который выдаёт публичный домен и держит Node.js постоянно включенным:

### Самые простые
- **Render** (Web Service) — быстро, есть бесплатные/платные планы
- **Railway** — удобно, быстро
- **Fly.io** — хорошо для стабильной работы
(везде логика одинаковая: подключаешь GitHub → задаёшь переменные окружения → деплоишь)

### VPS (лучший контроль)
- Hetzner / DigitalOcean / OVH / AWS Lightsail — ставишь Node.js и запускаешь через pm2 + Nginx.

Минимально:
1) Загружаешь код на сервер
2) `npm install`
3) заполняешь переменные окружения
4) `npm run start`
5) настраиваешь домен + HTTPS (Nginx + certbot)

После деплоя:
- в `.env` ставишь `PUBLIC_BASE_URL=https://твой-домен`
- в Telegram и Twilio указываешь вебхуки на твой домен.
