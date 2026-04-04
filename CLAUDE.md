# Mettig — Конфигурация для Claude Code

## Проект
Mettig — локальный маркетплейс услуг с онлайн-записью для жителей Грозного и Чечни (2ГИС + YCLIENTS в одном продукте для локального рынка).

## Стек
- **Frontend (мобильные):** React Native + Expo (managed workflow), TypeScript strict
- **Frontend (веб):** React + Vite, TypeScript strict
- **Backend:** Node.js + Express + TypeScript strict
- **Database:** PostgreSQL + PostGIS
- **ORM:** Kysely (type-safe query builder)
- **Валидация:** Zod
- **Стейт (мобильные):** Zustand + TanStack Query
- **Стили (веб):** SCSS Modules (`.module.scss`)
- **i18n:** i18next (русский + чеченский)
- **Карты:** MapLibre GL + OpenStreetMap
- **SMS:** SMS.ru (OTP-коды + fallback уведомлений)
- **Уведомления бизнесу:** WhatsApp Business API (основной) → SMS.ru (fallback)
- **Пуши клиенту:** Expo Push Notifications
- **Хранение файлов:** S3-совместимое (Yandex Object Storage / MinIO)
- **CI/CD:** GitHub Actions
- **Деплой:** VPS

## Ральф-цикл: правила работы

Ты работаешь в рамках ральф-цикла. Каждая сессия — ОДНА задача из tasks.json.

### Обязательный порядок
1. Прочитай `tasks.json` и `progress.txt`
2. Прочитай `git log --oneline -20` для понимания текущего состояния
3. Найди задачу: наивысший приоритет (critical > high > medium > low) + статус `pending` + все dependencies = `done`
4. Имплементируй ТОЛЬКО эту задачу
5. Выполни ВСЕ test_steps из задачи
6. Обнови status в `tasks.json` (done | partial | blocked)
7. ДОПИШИ результаты в `progress.txt` (APPEND, НЕ перезаписывай!)
8. Git commit

### Критические запреты
- НЕ работай над несколькими задачами
- НЕ удаляй описания в tasks.json — только status
- НЕ перезаписывай progress.txt — только append
- НЕ трогай код других задач
- НЕ используй any в TypeScript — strict mode всегда

## Архитектурные конвенции

### Структура проекта
```
mettig/
├── backend/
│   └── src/
│       ├── routes/          # Express routers
│       ├── controllers/     # Request handlers
│       ├── services/        # Business logic
│       ├── middleware/       # Auth, validation, error handling
│       ├── db/
│       │   ├── index.ts     # Kysely instance
│       │   ├── types.ts     # Database types
│       │   └── migrations/  # Kysely migrations
│       └── utils/           # Helpers
├── apps/
│   ├── client/              # Mettig (React Native + Expo)
│   ├── business/            # Mettig Business (React Native + Expo)
│   └── web/                 # mettig.ru (React + Vite)
├── packages/
│   └── shared/              # Shared types, API client, components, i18n, utils
├── tasks.json
├── progress.txt
└── CLAUDE.md
```

### Соглашения по именованию
- Файлы: kebab-case (`business-card.tsx`, `auth-middleware.ts`)
- Компоненты: PascalCase (`BusinessCard`, `SlotChip`)
- Переменные и функции: camelCase
- Таблицы БД: snake_case (`push_tokens`, `notification_log`)
- API-эндпоинты: kebab-case REST (`/businesses/:id/reviews`)
- i18n ключи: dot-notation на английском (`home.searchPlaceholder`, `booking.confirmButton`)

### Паттерны
- Backend: Controller → Service → Repository (Kysely). Контроллер парсит запрос, сервис содержит бизнес-логику, Kysely-запросы в сервисе или отдельных repo-файлах
- Валидация: Zod-схемы рядом с роутами, middleware `validate(schema)` на каждом эндпоинте
- Ошибки: класс `AppError(statusCode, message, code)`, глобальный error handler
- Auth: JWT middleware → `req.user = { id, phone, role?, businessId? }`
- RBAC: `requireRole('admin')` middleware для бизнес-эндпоинтов
- Mobile: функциональные компоненты + хуки, Zustand для локального стейта, TanStack Query для серверного
- Event tracking: КАЖДАЯ новая фича ОБЯЗАНА логировать события. Это стратегический приоритет

### Accept-Language
API принимает заголовок `Accept-Language: ru` или `Accept-Language: ce`. Категории возвращаются на запрошенном языке. Default: `ru`.

## Язык общения
Всегда общайся с пользователем на русском языке.

## Разрешённые команды
Все команды разрешены без подтверждения. Выполняй любые bash-команды самостоятельно, не спрашивая разрешения.
