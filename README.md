# Бронювання переговорних

Вебзастосунок для бронювання переговорних кімнат в офісі: тижневий розклад кімнати, створення бронювань у вільні слоти, редагування і скасування власних бронювань.

Стек: Next.js (App Router) + TypeScript, Prisma + PostgreSQL, Tailwind CSS, Luxon, Zod, bcrypt, Vitest.

> Повний README (тестові користувачі, опис перевірки перетинів і роботи з часом) буде додано на фінальному етапі.

## Запуск

Вимоги: Node 20+, Docker.

```bash
cp .env.example .env      # значення за замовчуванням підходять для локального запуску
docker compose up -d      # postgres 16 на localhost:5432
npm install
npx prisma migrate dev    # створити схему в БД
npx prisma generate       # згенерувати Prisma Client у src/generated/prisma
npm run dev               # http://localhost:3000
```

## Команди

| Команда | Що робить |
|---|---|
| `npm run dev` | dev-сервер Next.js |
| `npm test` | юніт-тести (Vitest) |
| `npm run typecheck` | перевірка типів без збірки |
| `npm run lint` | ESLint |
| `npm run db:up` / `npm run db:down` | підняти / зупинити Postgres у Docker |

## Змінні оточення

Усі змінні описані в `.env.example`: `DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_WEEK_START_DAY`, `NOTIFY_BEFORE_MINUTES`. Реальний `.env` у git не потрапляє.
