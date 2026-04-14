# Промпт: добавление 3 новых фич в Mettig

Ты — архитектор проекта Mettig. Тебе нужно обновить PRD и tasks.json тремя новыми функциями. Ниже — PRD-секции для каждой фичи и соответствующие задачи.

## Контекст

Все 41 задач (TASK-001 — TASK-041) завершены. Проект на стадии MVP: работает бэкенд (Express + Kysely + PostgreSQL), клиентское приложение (React Native + Expo), бизнес-приложение (React Native + Expo), веб-панель (React + Vite). Реализованы: аутентификация, поиск бизнесов, онлайн-запись, отзывы, избранное, статистика, пуш-уведомления, event tracking.

---

## Задание

### 1. Прочитай текущий PRD.md, tasks.json и progress.txt
### 2. Добавь в PRD.md следующие секции (append в конец раздела 3 «Основные функции», перед разделом 4)
### 3. Добавь в tasks.json новые задачи (TASK-042 и далее) в формате существующих задач
### 4. НЕ меняй ничего в существующих задачах и секциях PRD

---

## PRD — Новые секции

### 3.15 Публичная ссылка для онлайн-записи (Public Booking Link)

**Суть:**
Мастер или администратор генерирует уникальную публичную ссылку на запись. Ссылку можно отправить клиенту в WhatsApp, Telegram, Instagram — клиент открывает её в браузере и записывается БЕЗ установки приложения Mettig.

**Аналоги:** YCLIENTS (ссылка на виджет записи), Calendly (публичная страница), Booksy (share booking link).

**Формат ссылки:** `https://mettig.ru/b/{business_slug}` — для записи ко всему заведению, `https://mettig.ru/b/{business_slug}/{staff_slug}` — для записи к конкретному мастеру.

**Slug:** Генерируется автоматически из названия бизнеса (транслитерация + kebab-case, например `barbershop-sultan`). Администратор может изменить slug вручную. Slug уникален глобально.

**Поток для клиента (без приложения):**
1. Клиент переходит по ссылке в браузере
2. Видит мини-страницу бизнеса: название, фото, рейтинг, список мастеров
3. Выбирает мастера (или уже выбран, если ссылка на конкретного мастера)
4. Видит доступные слоты на ближайшие дни
5. Выбирает услугу и слот
6. Вводит имя и номер телефона (верификация SMS-кодом — используем существующий /auth/send-code и /auth/verify-code)
7. Запись подтверждена — экран «Готово» с деталями
8. Бизнесу уходит стандартное уведомление о новой записи

**Поток для мастера/администратора:**
1. В Mettig Business → Профиль заведения → блок «Ссылка для записи»
2. Видит свою ссылку, может скопировать одним тапом
3. Кнопка «Поделиться» — стандартный Share Sheet (WhatsApp, Telegram, Instagram и т.д.)
4. Администратор может изменить slug
5. У каждого мастера — персональная ссылка (профиль мастера → «Моя ссылка»)

**Веб-страница записи (mettig.ru/b/...):**
- Отдельный лёгкий роут в apps/web/ (НЕ требует авторизации для просмотра)
- Минималистичный дизайн, быстрая загрузка (< 2сек), mobile-first
- SEO-friendly: title, description, Open Graph теги (для красивого превью в мессенджерах)
- После записи — CTA «Скачайте Mettig для управления записями» с ссылками на App Store / Google Play

**Acceptance criteria:**
- Публичная ссылка доступна без авторизации
- Запись через ссылку создаёт полноценный Booking в БД с source = 'link'
- Клиент получает SMS-подтверждение после записи
- Бизнес получает стандартное уведомление о новой записи
- Open Graph теги корректно отображаются при вставке ссылки в WhatsApp/Telegram
- Страница загружается < 2 секунд на 3G
- Мастер может скопировать и поделиться ссылкой за 2 тапа
- Slug уникален, валидируется при изменении

---

### 3.16 Добавление оффлайн-клиента (Manual Booking / Walk-in)

**Суть:**
Мастер или администратор в разделе «Статистика» (или из экрана записей) может быстро добавить клиента, который пришёл без онлайн-записи (walk-in). Это нужно для точного учёта статистики: show rate, загруженность, источник клиентов (из Mettig vs пришли сами).

**Поток (минимум усилий):**
1. На экране «Записи» (Bookings) — кнопка «+ Добавить клиента» (FAB или в header)
2. Quick-форма:
   - Выбор мастера (для admin — выпадающий список; для employee — автоматически текущий мастер)
   - Выбор услуги (выпадающий список услуг заведения)
   - Имя клиента (текстовое поле, опционально — можно оставить «Клиент»)
   - Телефон клиента (опционально — для будущей связи)
   - Время (по умолчанию — текущее время, можно выбрать другое)
3. Тап «Добавить» — запись создаётся со статусом `completed` и source = `walk_in`
4. Не требуется: SMS-верификация, выбор слота (создаётся автоматически), подтверждение клиентом

**Детали реализации:**
- При создании walk-in записи автоматически создаётся Slot (если нет свободного на это время) + Booking
- Если телефон указан и пользователь с таким телефоном существует — привязываем к нему. Иначе — user_id = null (анонимный walk-in)
- source = 'walk_in' — уже поддерживается в BookingSource enum
- В статистике walk-in записи учитываются отдельно от app-записей (уже есть поле source в bookings)

**Acceptance criteria:**
- Мастер может добавить оффлайн-клиента за < 15 секунд (3 поля + тап)
- Запись создаётся с source = 'walk_in' и status = 'completed'
- В статистике walk-in записи отображаются с пометкой источника
- Администратор может добавить запись к любому мастеру
- Сотрудник — только к себе
- Event tracking: логируется событие `walk_in_booking_created`
- Работает и в мобильном приложении (Mettig Business), и на веб-панели (mettig.ru)

---

### 3.17 Чат между мастером и клиентом

**Суть:**
После онлайн-записи клиент может написать мастеру прямо из приложения Mettig. Чат привязан к конкретной записи — это не мессенджер общего назначения, а канал коммуникации по поводу визита (уточнить детали, прислать фото желаемой стрижки и т.д.).

**Расположение для клиента:**
- Вкладка «Записи» → карточка записи → иконка чата (💬) в правом верхнем углу карточки
- Иконка показывается только для записей со статусом `confirmed` (активных)
- При наличии непрочитанных сообщений — бейдж с количеством на иконке

**Расположение для мастера (Mettig Business):**
- Экран «Записи» → карточка записи → иконка чата
- Отдельная секция «Сообщения» (опционально на будущее, для MVP — только из карточки записи)

**Функциональность (MVP):**
- Текстовые сообщения
- Отправка фото (одного за раз, сжатие на клиенте)
- Индикатор прочитано / не прочитано
- Пуш-уведомление при новом сообщении (для обеих сторон)
- Чат закрывается (read-only) после завершения записи (status = completed / cancelled / no_show)

**Что НЕ входит в MVP:**
- Голосовые сообщения
- Видеозвонки
- Групповые чаты
- Чат без привязки к записи

**Модель данных:**

Таблица `chat_messages`:
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| booking_id | FK → Booking | Привязка к записи |
| sender_id | FK → User | Отправитель |
| sender_role | enum: 'client', 'staff' | Роль отправителя |
| message_type | enum: 'text', 'image' | Тип сообщения |
| content | string | Текст или URL фото |
| is_read | boolean | Прочитано получателем |
| created_at | timestamp | Время отправки |

**Технические решения:**
- Транспорт: HTTP polling (MVP) → WebSocket (позже). Для MVP достаточно polling каждые 5 секунд при открытом чате + пуш-уведомления при закрытом
- Фото: загрузка через существующий S3 upload flow
- Пуш: через существующую систему Expo Push Notifications

**Acceptance criteria:**
- Клиент может открыть чат из карточки активной записи
- Мастер может открыть чат из карточки записи в Mettig Business
- Текстовые сообщения доставляются в течение 10 секунд (polling)
- Фото загружается и отображается корректно
- Пуш-уведомление приходит при новом сообщении (приложение в фоне)
- Бейдж непрочитанных сообщений на иконке чата
- Чат становится read-only после завершения/отмены записи
- RBAC: клиент видит только свои чаты, мастер — только чаты своих записей, администратор — все чаты

---

## Задачи (tasks.json)

Добавь следующие задачи в массив `tasks` в tasks.json. Формат идентичен существующим задачам.

```json
{
  "id": "TASK-042",
  "category": "infrastructure",
  "priority": "high",
  "description": "Миграция БД: добавить колонку slug (unique) в таблицу businesses, таблицу chat_messages, обновить enum BookingSource добавив 'link'. Индексы: unique на businesses.slug, B-tree на chat_messages(booking_id, created_at), B-tree на chat_messages(sender_id)",
  "acceptance_criteria": [
    "Миграция 007_public_links_chat.ts создана и применяется",
    "Колонка businesses.slug добавлена (varchar, unique, nullable на первом этапе — заполняется при генерации)",
    "Таблица chat_messages создана со всеми полями из PRD",
    "BookingSource enum расширен: 'app' | 'walk_in' | 'link'",
    "Индексы созданы: unique на slug, composite на chat_messages(booking_id, created_at)",
    "Rollback корректно удаляет таблицу и колонку",
    "types.ts обновлён: ChatMessageTable, BookingSource расширен"
  ],
  "test_steps": [
    "npm run db:migrate применяет миграцию без ошибок",
    "npm run db:rollback откатывает корректно",
    "npx tsc --noEmit в backend/ проходит",
    "SELECT column_name FROM information_schema.columns WHERE table_name='businesses' AND column_name='slug' — возвращает строку",
    "SELECT * FROM information_schema.tables WHERE table_name='chat_messages' — таблица существует"
  ],
  "dependencies": [],
  "status": "pending"
},
{
  "id": "TASK-043",
  "category": "functional",
  "priority": "high",
  "description": "Backend: генерация и управление slug для бизнесов. Утилита транслитерации (кириллица → латиница + kebab-case). Авто-генерация slug при создании бизнеса. API: PATCH /business/profile для обновления slug с валидацией уникальности. Seed: добавить slug всем существующим бизнесам",
  "acceptance_criteria": [
    "Утилита transliterate(name) → slug создана (src/utils/transliterate.ts)",
    "При создании бизнеса slug генерируется автоматически",
    "Если slug занят — добавляется суффикс (-2, -3...)",
    "PATCH /business/profile поддерживает обновление slug",
    "Валидация slug: только a-z, 0-9, дефис, 3-50 символов",
    "Проверка уникальности при обновлении (409 Conflict если занят)",
    "Seed обновлён: все тестовые бизнесы получают slug",
    "GET /businesses/:id возвращает slug в ответе"
  ],
  "test_steps": [
    "Тест transliterate: 'Барбершоп Султан' → 'barbershop-sultan'",
    "Тест transliterate: дубликат → 'barbershop-sultan-2'",
    "PATCH /business/profile { slug: 'my-shop' } обновляет slug",
    "PATCH /business/profile { slug: 'занятый-slug' } возвращает 409",
    "npm run db:seed заполняет slug для всех бизнесов",
    "npm run lint && npm test проходят"
  ],
  "dependencies": ["TASK-042"],
  "status": "pending"
},
{
  "id": "TASK-044",
  "category": "functional",
  "priority": "high",
  "description": "Backend API: публичная запись через ссылку. GET /public/business/:slug (информация о бизнесе без авторизации), GET /public/business/:slug/slots?staff_id=&date= (доступные слоты), POST /public/bookings (создание записи с SMS-верификацией, source='link'). Event tracking: booking_via_link",
  "acceptance_criteria": [
    "GET /public/business/:slug возвращает бизнес с мастерами, услугами, рейтингом (без авторизации)",
    "GET /public/business/:slug/slots возвращает свободные слоты с фильтрацией по staff_id и date",
    "POST /public/bookings принимает { slug, staff_id, service_id, slot_id, phone, code, name }",
    "SMS-верификация обязательна (используется существующий auth flow)",
    "Запись создаётся с source = 'link'",
    "При создании — стандартное уведомление бизнесу",
    "Event tracking: событие booking_via_link с payload { business_id, slug, staff_id }",
    "Rate limiting на публичные эндпоинты (отдельный лимит от основного API)",
    "Zod-валидация на все входные данные"
  ],
  "test_steps": [
    "GET /public/business/barbershop-sultan без токена возвращает 200 с данными",
    "GET /public/business/nonexistent возвращает 404",
    "GET /public/business/barbershop-sultan/slots возвращает слоты",
    "POST /public/bookings с валидными данными создаёт запись с source='link'",
    "POST /public/bookings без SMS-кода возвращает 401",
    "Event booking_via_link записывается в таблицу events",
    "npm run lint && npm test проходят"
  ],
  "dependencies": ["TASK-043"],
  "status": "pending"
},
{
  "id": "TASK-045",
  "category": "ui",
  "priority": "high",
  "description": "Веб-страница публичной записи: mettig.ru/b/:slug и mettig.ru/b/:slug/:staffSlug. React-роут в apps/web/ — мини-страница бизнеса с выбором мастера, услуги, слота. SMS-верификация. Mobile-first, Open Graph теги, CTA 'Скачайте Mettig'",
  "acceptance_criteria": [
    "Роут /b/:slug отображает страницу бизнеса с мастерами, услугами, слотами",
    "Роут /b/:slug/:staffSlug предвыбирает конкретного мастера",
    "Пошаговый флоу: мастер → услуга → дата/слот → телефон + SMS → подтверждение",
    "Mobile-first дизайн, корректное отображение на iOS Safari и Android Chrome",
    "Open Graph теги: og:title (название бизнеса), og:description, og:image (первое фото бизнеса)",
    "После записи: экран 'Готово' + CTA со ссылками на App Store / Google Play",
    "Страница загружается < 2сек на 3G (ленивая загрузка фото)",
    "i18n: поддержка ru/ce через Accept-Language или query param ?lang=ce",
    "Graceful error handling: бизнес не найден, нет слотов, ошибка сети"
  ],
  "test_steps": [
    "Открыть /b/barbershop-sultan — отображается страница бизнеса",
    "Открыть /b/nonexistent — 404 страница",
    "Полный флоу записи проходит успешно в мобильном браузере",
    "Вставить ссылку в WhatsApp — корректное превью (OG теги)",
    "npx tsc --noEmit в apps/web/ проходит"
  ],
  "dependencies": ["TASK-044"],
  "status": "pending"
},
{
  "id": "TASK-046",
  "category": "ui",
  "priority": "high",
  "description": "Mettig Business: UI для публичной ссылки. В профиле заведения — блок 'Ссылка для записи' с кнопками 'Копировать' и 'Поделиться'. У каждого мастера — персональная ссылка. Возможность редактирования slug администратором",
  "acceptance_criteria": [
    "Экран профиля заведения: блок со ссылкой, кнопка копирования (Clipboard API), кнопка Share Sheet",
    "Администратор может нажать 'Изменить ссылку' → редактировать slug → сохранить",
    "Валидация slug на клиенте (a-z, 0-9, дефис, 3-50 символов)",
    "Ошибка если slug занят (409 от сервера → пользователю понятное сообщение)",
    "Персональная ссылка мастера отображается в профиле мастера",
    "Кнопка 'Поделиться' открывает системный Share Sheet",
    "Event tracking: link_copied, link_shared",
    "Реализовано и в мобильном (Mettig Business), и на веб-панели (mettig.ru)"
  ],
  "test_steps": [
    "В профиле заведения отображается ссылка",
    "Тап 'Копировать' — ссылка в буфере обмена",
    "Тап 'Поделиться' — открывается Share Sheet",
    "Изменение slug сохраняется успешно",
    "Дублирующий slug показывает ошибку",
    "npx tsc --noEmit в apps/business/ и apps/web/ проходит"
  ],
  "dependencies": ["TASK-044", "TASK-045"],
  "status": "pending"
},
{
  "id": "TASK-047",
  "category": "functional",
  "priority": "high",
  "description": "Backend API: добавление оффлайн-клиента (walk-in). POST /business/bookings/walk-in — быстрое создание записи с source='walk_in', status='completed'. Автоматическое создание слота, опциональная привязка к существующему пользователю по телефону",
  "acceptance_criteria": [
    "POST /business/bookings/walk-in принимает { staff_id, service_id, client_name?, client_phone?, time? }",
    "Если time не указан — используется текущее время",
    "Автоматически создаётся Slot (is_booked=true) + Booking (status='completed', source='walk_in')",
    "Если client_phone указан и User с таким телефоном существует — booking.user_id = этот user",
    "Если client_phone указан, но User нет — user_id = null, телефон сохраняется в метаданных",
    "RBAC: admin может указать любой staff_id, employee — только свой",
    "Event tracking: walk_in_booking_created с payload { business_id, staff_id, has_phone }",
    "Zod-валидация: client_name опционально, client_phone опционально (формат +7...)"
  ],
  "test_steps": [
    "POST /business/bookings/walk-in с минимальными данными (staff_id + service_id) создаёт запись",
    "Созданная запись имеет source='walk_in', status='completed'",
    "Slot автоматически создан с корректным временем",
    "С client_phone существующего пользователя — user_id привязан",
    "Employee не может создать walk-in для чужого мастера (403)",
    "Event walk_in_booking_created записан",
    "npm run lint && npm test проходят"
  ],
  "dependencies": ["TASK-042"],
  "status": "pending"
},
{
  "id": "TASK-048",
  "category": "ui",
  "priority": "high",
  "description": "Mettig Business: UI для добавления оффлайн-клиента. Кнопка '+ Добавить клиента' на экране записей (FAB). Quick-форма: мастер, услуга, имя (опц.), телефон (опц.), время. Минимум тапов для быстрого добавления",
  "acceptance_criteria": [
    "FAB-кнопка '+ Добавить клиента' на экране записей",
    "Модальное окно / bottom sheet с quick-формой",
    "Для admin: dropdown выбора мастера, для employee — предзаполнен текущим мастером",
    "Dropdown выбора услуги из списка услуг заведения",
    "Поле имени клиента (опционально, placeholder 'Клиент')",
    "Поле телефона (опционально, маска +7 (___) ___-__-__)",
    "Выбор времени: по умолчанию 'Сейчас', переключатель на выбор другого времени",
    "Кнопка 'Добавить' — запись создаётся, форма закрывается, список обновляется",
    "Event tracking: walk_in_form_opened, walk_in_booking_created",
    "Реализовано и в мобильном, и на веб-панели"
  ],
  "test_steps": [
    "FAB-кнопка видна на экране записей",
    "Тап → открывается форма с предзаполненными значениями",
    "Заполнение service_id + тап 'Добавить' → запись создана за < 15 секунд",
    "Запись появляется в списке с пометкой 'Walk-in'",
    "npx tsc --noEmit в apps/business/ и apps/web/ проходит"
  ],
  "dependencies": ["TASK-047"],
  "status": "pending"
},
{
  "id": "TASK-049",
  "category": "functional",
  "priority": "high",
  "description": "Backend API: чат между мастером и клиентом. GET /bookings/:id/messages (список сообщений с пагинацией), POST /bookings/:id/messages (отправка текста/фото), PATCH /bookings/:id/messages/read (пометить как прочитанные). GET /bookings/:id/messages/unread-count. Пуш при новом сообщении",
  "acceptance_criteria": [
    "GET /bookings/:id/messages возвращает сообщения с пагинацией (cursor-based по created_at)",
    "POST /bookings/:id/messages принимает { message_type: 'text'|'image', content: string }",
    "Для image — content = URL из S3 (клиент загружает фото через существующий /upload)",
    "PATCH /bookings/:id/messages/read помечает все непрочитанные от другой стороны как прочитанные",
    "GET /bookings/:id/messages/unread-count возвращает количество непрочитанных",
    "Пуш-уведомление при новом сообщении (через существующий Expo Push flow)",
    "RBAC: доступ только для участников записи (client user_id или staff user_id) + admin бизнеса",
    "Сообщения можно отправлять только если booking.status = 'confirmed'",
    "После завершения/отмены записи — только чтение (POST возвращает 403)",
    "Event tracking: chat_message_sent с payload { booking_id, sender_role, message_type }",
    "Zod-валидация: content не пустой, message_type валидный"
  ],
  "test_steps": [
    "POST /bookings/:id/messages отправляет текстовое сообщение",
    "GET /bookings/:id/messages возвращает сообщения в хронологическом порядке",
    "PATCH /bookings/:id/messages/read обнуляет unread-count",
    "POST на завершённую запись возвращает 403",
    "Пользователь без доступа к записи получает 403",
    "Admin бизнеса имеет доступ ко всем чатам своего бизнеса",
    "Пуш-уведомление отправляется при новом сообщении",
    "npm run lint && npm test проходят"
  ],
  "dependencies": ["TASK-042"],
  "status": "pending"
},
{
  "id": "TASK-050",
  "category": "ui",
  "priority": "high",
  "description": "Mettig (клиент): UI чата на экране записей. Иконка 💬 на карточке активной записи (status=confirmed). Бейдж непрочитанных. Экран чата: список сообщений, ввод текста, отправка фото. Polling каждые 5 секунд при открытом чате",
  "acceptance_criteria": [
    "На карточке записи (BookingsScreen) — иконка чата для записей со status='confirmed'",
    "Бейдж с количеством непрочитанных сообщений на иконке",
    "Экран чата: список сообщений (свои справа, чужие слева), поле ввода, кнопка отправки",
    "Кнопка 'Фото' — выбор из галереи, сжатие, загрузка в S3, отправка как image-сообщение",
    "Polling: запрос новых сообщений каждые 5 секунд при открытом экране чата",
    "При открытии чата — PATCH read (пометить прочитанными)",
    "Пуш-уведомление при получении сообщения (приложение в фоне) — тап открывает чат",
    "Для завершённых записей: чат read-only, поле ввода скрыто, показано 'Чат завершён'",
    "Event tracking: chat_opened, chat_message_sent"
  ],
  "test_steps": [
    "На карточке активной записи отображается иконка чата",
    "На карточке завершённой записи иконка чата отсутствует или неактивна",
    "Тап на иконку → открывается экран чата с историей сообщений",
    "Отправка текстового сообщения — появляется в списке",
    "Отправка фото — сжимается, загружается, отображается",
    "Бейдж непрочитанных обновляется",
    "npx tsc --noEmit в apps/client/ проходит"
  ],
  "dependencies": ["TASK-049"],
  "status": "pending"
},
{
  "id": "TASK-051",
  "category": "ui",
  "priority": "high",
  "description": "Mettig Business: UI чата для мастера/администратора. Иконка чата на карточке записи в BookingsScreen. Экран чата идентичен клиентскому. Admin видит чаты всех мастеров, employee — только свои",
  "acceptance_criteria": [
    "На карточке записи в Mettig Business — иконка чата для confirmed записей",
    "Бейдж непрочитанных на иконке",
    "Экран чата: список сообщений, поле ввода, кнопка фото",
    "Admin видит чаты всех записей своего бизнеса",
    "Employee видит чаты только своих записей",
    "Polling + пуш-уведомления аналогично клиентскому приложению",
    "На веб-панели (mettig.ru) — та же функциональность чата",
    "Event tracking: chat_opened, chat_message_sent (sender_role='staff')"
  ],
  "test_steps": [
    "Иконка чата на карточке записи в Mettig Business",
    "Мастер может открыть чат и отправить сообщение",
    "Admin видит чаты всех мастеров",
    "На веб-панели чат работает корректно",
    "npx tsc --noEmit в apps/business/ и apps/web/ проходит"
  ],
  "dependencies": ["TASK-049", "TASK-050"],
  "status": "pending"
}
```

---

## Порядок выполнения

Рекомендуемый порядок (по зависимостям):

1. **TASK-042** — Миграция БД (slug + chat_messages + enum) — ПЕРВЫМ, разблокирует всё остальное
2. **TASK-043** → **TASK-044** → **TASK-045** → **TASK-046** — Публичная ссылка (backend → API → веб-страница → UI в бизнес-приложении)
3. **TASK-047** → **TASK-048** — Walk-in (backend → UI)
4. **TASK-049** → **TASK-050** → **TASK-051** — Чат (backend → клиент UI → бизнес UI)

Параллельные ветки после TASK-042:
- Ветка 1: TASK-043 (slug) → далее публичная ссылка
- Ветка 2: TASK-047 (walk-in API)
- Ветка 3: TASK-049 (chat API)

---

## Напоминание

- Следуй ральф-циклу: одна задача за итерацию
- TypeScript strict, без any
- Event tracking ОБЯЗАТЕЛЕН для каждой фичи
- Zod-валидация на всех эндпоинтах
- Тесты для всех новых API
- Конвенции именования из CLAUDE.md
- i18n ключи на английском (dot-notation)
- progress.txt — ТОЛЬКО append
