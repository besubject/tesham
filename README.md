# Mettig — Local Marketplace Services Platform

Mettig — локальный маркетплейс услуг с онлайн-записью для жителей Грозного и Чечни. Это полное решение 2ГИС + YCLIENTS в одном продукте для локального рынка.

## 🎯 Стек технологий

### Frontend
- **Мобильное приложение клиента:** React Native + Expo
- **Мобильное приложение бизнеса:** React Native + Expo
- **Веб-панель:** React + Vite + TypeScript

### Backend
- **API сервер:** Node.js + Express + TypeScript
- **База данных:** PostgreSQL + PostGIS
- **ORM:** Kysely (type-safe query builder)
- **Хранилище файлов:** S3-совместимое (MinIO / Yandex Object Storage)

### Инструменты
- **Валидация:** Zod
- **State management:** Zustand + TanStack Query
- **i18n:** i18next (русский + чеченский)
- **SMS:** SMS.ru
- **Уведомления:** WhatsApp Business API + Expo Push Notifications

## 🚀 Быстрый старт

### Требования
- **Docker** и **docker-compose** (версия 3.9+)
- **Node.js** 18+ (для локальной разработки без Docker)
- **npm** или **yarn**

### Способ 1: С помощью Docker (рекомендуется)

```bash
# 1. Клонировать репозиторий
git clone https://github.com/mettig/mettig.git
cd mettig

# 2. Запустить автоматическую настройку
./scripts/setup.sh
```

Скрипт автоматически:
- ✅ Создаст `.env` из `.env.example`
- ✅ Запустит Docker контейнеры (PostgreSQL, MinIO, Backend)
- ✅ Выполнит миграции базы данных
- ✅ Заполнит БД тестовыми данными

### Способ 2: Вручную без скрипта

```bash
# Скопировать конфигурацию
cp .env.example .env

# Запустить Docker контейнеры
docker-compose up -d

# Дождаться инициализации (30 сек)
sleep 30

# Выполнить миграции
docker-compose exec backend npm run db:migrate

# Заполнить данные
docker-compose exec backend npm run db:seed
```

### Способ 3: Локальная разработка (без Docker)

```bash
# Установить зависимости
npm install

# Настроить PostgreSQL локально
# (создать БД, пользователя, установить PostGIS)
createdb -U postgres mettig

# Запустить бэкенд
cd backend && npm run dev

# В отдельном терминале: запустить веб-приложение
cd apps/web && npm run dev

# В отдельном терминале: запустить мобильное приложение клиента
cd apps/client && npm start
```

## 📚 Использование

### Доступные сервисы (после запуска Docker)

| Сервис | URL | Описание |
|--------|-----|---------|
| **Backend API** | http://localhost:3000 | REST API сервер |
| **PostgreSQL** | `postgres://mettig:mettig_dev_password@localhost:5432/mettig` | База данных |
| **MinIO Console** | http://localhost:9001 | Управление S3 хранилищем (minioadmin/minioadmin) |
| **MinIO API** | http://localhost:9000 | S3-совместимый API |

### Основные команды

```bash
# Docker контейнеры
docker-compose up -d        # Запустить контейнеры
docker-compose down         # Остановить контейнеры
docker-compose logs -f      # Просмотреть логи
docker-compose ps           # Статус контейнеров

# Разработка
npm run dev                 # Запустить в режиме разработки
npm run build              # Собрать для продакшена
npm run lint               # Проверка кода (ESLint)
npm run typecheck          # Проверка TypeScript типов

# База данных (в контейнере)
docker-compose exec backend npm run db:migrate    # Миграции
docker-compose exec backend npm run db:rollback   # Откат миграций
docker-compose exec backend npm run db:seed       # Заполнение данных
docker-compose exec backend npm run db:check      # Проверка БД

# Монолит операции
npm run format             # Форматирование кода (Prettier)
npm run format:check       # Проверка форматирования
npm run lint --workspaces  # Lint для всех workspace'ов
```

### Структура проекта

```
mettig/
├── apps/
│   ├── client/              # Мобильное приложение клиента (React Native + Expo)
│   ├── business/            # Мобильное приложение бизнеса (React Native + Expo)
│   └── web/                 # Веб-панель (React + Vite + TypeScript)
├── backend/
│   ├── src/
│   │   ├── routes/          # Express роуты
│   │   ├── controllers/     # Контроллеры (обработчики запросов)
│   │   ├── services/        # Бизнес-логика
│   │   ├── middleware/      # Middleware (auth, validation, error)
│   │   ├── db/              # Kysely database layer
│   │   └── utils/           # Утилиты и хелперы
│   └── Dockerfile           # Контейнер для бэкенда
├── packages/
│   └── shared/              # Общие типы, API клиент, i18n, компоненты
├── scripts/
│   └── setup.sh             # Скрипт автоматической настройки
├── docker-compose.yml       # Docker композиция для локальной разработки
├── .env.example             # Пример конфигурации
└── README.md                # Этот файл
```

## 🔐 环境переменных

Все переменные окружения описаны в `.env.example`:

### Базовая конфигурация
```env
NODE_ENV=development
BACKEND_PORT=3000
```

### База данных
```env
DB_HOST=postgres
DB_PORT=5432
DB_USER=mettig
DB_PASSWORD=mettig_dev_password
DB_NAME=mettig
```

### S3 / MinIO
```env
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=mettig-uploads
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
```

### SMS и уведомления
```env
JWT_SECRET=dev_jwt_secret_change_in_production
SMS_RU_API_KEY=demo_key
WHATSAPP_BUSINESS_API_KEY=demo_key
```

## 🧪 Тестирование

```bash
# Запустить тесты (бэкенд)
docker-compose exec backend npm run test

# Запустить с coverage
docker-compose exec backend npm run test -- --coverage
```

## 📝 Миграции БД

### Создать новую миграцию
```bash
# Добавить файл миграции в backend/src/db/migrations/
# Формат: YYYY-MM-DD-HH-mm-ss-description.ts

docker-compose exec backend npm run db:migrate
```

### Откатить последнюю миграцию
```bash
docker-compose exec backend npm run db:rollback
```

## 🐛 Отладка

### Просмотр логов контейнеров
```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f minio
```

### Подключение к PostgreSQL напрямую
```bash
docker-compose exec postgres psql -U mettig -d mettig
```

### Проверка состояния Healthchecks
```bash
# Проверка PostgreSQL
docker exec mettig-postgres pg_isready -U mettig

# Проверка MinIO
docker exec mettig-minio curl -s http://localhost:9000/minio/health/live
```

## 🚨 Решение проблем

### "docker: command not found"
Установите Docker: https://docs.docker.com/get-docker/

### "PostgreSQL connection refused"
```bash
# Перезапустить контейнеры
docker-compose restart postgres

# Проверить статус
docker-compose ps
```

### "MinIO bucket does not exist"
```bash
# MinIO консоль доступна на http://localhost:9001
# Создать bucket вручную или через скрипт seed
docker-compose exec backend npm run db:seed
```

### "Port 3000 already in use"
```bash
# Изменить порт в .env
BACKEND_PORT=3001

# Перезапустить
docker-compose restart backend
```

## 📚 API документация

API документация доступна в комментариях к коду и примерах запросов.

### Основные endpoints:

**Авторизация**
- `POST /auth/send-code` — отправка SMS кода
- `POST /auth/verify-code` — верификация кода

**Клиент (Мобильное приложение)**
- `GET /businesses` — список заведений
- `GET /businesses/:id` — детали заведения
- `GET /categories` — категории услуг
- `GET /bookings` — мои записи
- `POST /bookings` — создать запись
- `GET /favorites` — мои избранные
- `POST /favorites` — добавить в избранное

**Бизнес (Веб-панель)**
- `GET /business/bookings` — записи клиентов
- `PATCH /business/bookings/:id` — изменить статус записи
- `GET /business/stats` — статистика
- `GET /business/staff` — сотрудники
- `POST /business/staff` — добавить сотрудника
- `GET /business/services` — услуги
- `POST /business/services` — добавить услугу

Полная API документация: [/backend/API.md](/backend/API.md)

## 🤝 Контрибьютинг

1. Создайте feature branch: `git checkout -b feature/amazing-feature`
2. Коммитьте изменения: `git commit -m 'feat: добавить amazing feature'`
3. Пушьте в репозиторий: `git push origin feature/amazing-feature`
4. Откройте Pull Request

### Правила кодирования

- ✅ TypeScript strict mode обязателен
- ✅ Используйте Prettier для форматирования
- ✅ Следуйте соглашениям об именовании (kebab-case для файлов, camelCase для переменных)
- ✅ Добавьте unit тесты для критического кода
- ✅ Обновите документацию если изменился API

## 📜 Лицензия

MIT License — свободно используйте и модифицируйте.

## 📧 Контакты

- Issues: https://github.com/mettig/mettig/issues
- Email: hello@mettig.ru
- Telegram: @mettig_team

---

**Метtig** — Маркетплейс услуг нового поколения для локальных рынков 🚀
