# Перевірка API вручну

Приклади для ручної перевірки бронювань. Потрібні підняті БД (`docker compose up -d`), застосований сід (`npx prisma db seed`) і запущений сервер (`npm run dev`).

Усі часи в тілі запиту — ISO-рядки в UTC. Робочі години перевіряються за київським часом, тому влітку `09:00` у Києві це `06:00Z`, а взимку `07:00Z`.

## Логін і збереження сесії

```bash
curl -s -c alice.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'

curl -s -c bob.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"password123"}'
```

Далі cookie підставляється через `-b alice.txt`. Без нього кожен ендпоїнт має віддати `401 UNAUTHORIZED`.

Id кімнати можна взяти зі списку:

```bash
curl -s -b alice.txt http://localhost:3000/api/rooms
```

## Створення

Підставте id кімнати замість `ROOM` і майбутні робочі години замість дат.

```bash
# 201 — вільний слот
curl -s -b alice.txt -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"roomId":"ROOM","title":"Planning","startsAt":"2026-08-27T07:00:00.000Z","endsAt":"2026-08-27T08:00:00.000Z"}'

# 201 — впритул до попереднього, це НЕ конфлікт
curl -s -b alice.txt -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"roomId":"ROOM","title":"Demo","startsAt":"2026-08-27T08:00:00.000Z","endsAt":"2026-08-27T09:00:00.000Z"}'

# 409 SLOT_TAKEN — перетин із наявним
curl -s -b alice.txt -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"roomId":"ROOM","title":"Clash","startsAt":"2026-08-27T08:30:00.000Z","endsAt":"2026-08-27T09:00:00.000Z"}'
```

Очікувані відмови при створенні:

| Що надсилаємо           | Відповідь                             |
| ----------------------- | ------------------------------------- |
| дата в минулому         | `400 TIME_IN_PAST`                    |
| `19:30–20:00` за Києвом | `400 OUTSIDE_WORKING_HOURS`           |
| початок о `10:15`       | `400 TIME_NOT_ALIGNED`                |
| тривалість 5 годин      | `400 DURATION_INVALID`                |
| порожня назва           | `400 TITLE_INVALID`, `field: "title"` |
| неіснуюча кімната       | `404 NOT_FOUND`, `field: "roomId"`    |
| без cookie              | `401 UNAUTHORIZED`                    |

## Редагування і скасування

`BOOKING` — id бронювання, створеного Алісою.

```bash
# 200 — зміна лише назви, час не рухається (дозволено навіть якщо бронювання вже триває)
curl -s -b alice.txt -X PATCH http://localhost:3000/api/bookings/BOOKING \
  -H "Content-Type: application/json" -d '{"title":"Planning v2"}'

# 200 — той самий час ще раз: редаговане бронювання виключається з перевірки перетинів
curl -s -b alice.txt -X PATCH http://localhost:3000/api/bookings/BOOKING \
  -H "Content-Type: application/json" \
  -d '{"startsAt":"2026-08-27T07:00:00.000Z","endsAt":"2026-08-27T08:00:00.000Z"}'

# 409 SLOT_TAKEN — перенос на зайнятий сусідній слот
curl -s -b alice.txt -X PATCH http://localhost:3000/api/bookings/BOOKING \
  -H "Content-Type: application/json" \
  -d '{"startsAt":"2026-08-27T08:00:00.000Z","endsAt":"2026-08-27T09:00:00.000Z"}'

# 403 FORBIDDEN — чуже бронювання, і через API теж
curl -s -b bob.txt -X PATCH http://localhost:3000/api/bookings/BOOKING \
  -H "Content-Type: application/json" -d '{"title":"hijack"}'
curl -s -b bob.txt -X DELETE http://localhost:3000/api/bookings/BOOKING

# 204 — скасування власного
curl -s -b alice.txt -X DELETE http://localhost:3000/api/bookings/BOOKING

# 404 NOT_FOUND — скасоване вважається неіснуючим
curl -s -b alice.txt -X DELETE http://localhost:3000/api/bookings/BOOKING
```

Після скасування слот звільняється: повторне створення на той самий час має віддати `201`.

## Читання

```bash
# розклад кімнати за тиждень; weekStart — понеділок 00:00 у UTC
curl -s -b alice.txt "http://localhost:3000/api/rooms/ROOM/bookings?weekStart=2026-08-24T00:00:00.000Z"

# свої бронювання
curl -s -b alice.txt "http://localhost:3000/api/my-bookings?scope=upcoming"
curl -s -b alice.txt "http://localhost:3000/api/my-bookings?scope=past"

# наступна сторінка минулих
curl -s -b alice.txt "http://localhost:3000/api/my-bookings?scope=past&cursor=NEXT_CURSOR"
```

У відповіді розкладу чужі бронювання приходять із іменем автора і `isMine: false`, свої — з `isMine: true`.

## Примітка для Windows

Консоль Windows може псувати кирилицю в `-d '...'`. Якщо назва бронювання зберігається як `????`, покладіть тіло запиту у файл у UTF-8 і надсилайте його: `curl --data-binary @body.json`.
