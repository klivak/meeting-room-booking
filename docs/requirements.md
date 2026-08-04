# Meeting Room Booking — Requirements Specification

> Source: UA-Skills technical assignment · event2 (competition for junior developers).
> This document is a structured, numbered version of the requirements for further work on the project.
> Version 1.1 · 2026-07-27

---

## 1. Project Goal

A small web application for booking meeting rooms in an office. An employee opens a room's schedule, sees occupied slots, and books free time. Users can cancel their own bookings; other people's bookings must not be touched (neither via the UI nor via the API).

## 2. Roles

| Role          | Description                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Guest         | Unauthenticated visitor. Only registration and login are available; the rest of the app is behind login (see DEC-1)   |
| User          | Registered employee. Views the schedule of all rooms, creates bookings, edits and cancels **only their own** bookings |
| Administrator | **Does not exist.** Rooms are created via seed; no separate admin panel is required                                   |

## 3. Global Conventions (Domain Constants)

| Parameter                         | Value                                                    |
| --------------------------------- | -------------------------------------------------------- |
| Office timezone                   | `Europe/Kyiv`                                            |
| Working hours                     | 09:00–19:00 **office time**, identical for all rooms     |
| Grid step / time granularity      | 30 minutes                                               |
| Minimum booking duration          | 30 minutes                                               |
| Maximum booking duration          | 4 hours                                                  |
| Time storage in DB                | UTC                                                      |
| Time display in UI                | User's timezone (detected from the browser)              |
| Working-hours validation          | Always in office time, regardless of the user's timezone |
| First day of the week in the grid | Monday by default, configurable (see DEC-2)              |

---

## 4. Functional Requirements

### FR-1. Authentication

- **FR-1.1** Registration with fields: name, email, password.
- **FR-1.2** Login (email + password) and logout.
- **FR-1.3** The session persists after a page reload (persist session: cookie/session/token — implementer's choice).
- **FR-1.4** Email is unique. Uniqueness is checked **case-insensitively** and **ignoring leading/trailing whitespace**: `Ivan@x.com` and `ivan@x.com` are the same address. (In practice: normalize with `trim().toLowerCase()` before storing and comparing.)
- **FR-1.5** Name: non-empty; displayed in the schedule as the booking author; uniqueness is **not** required.
- **FR-1.6** Password: 8 to 72 characters; no composition rules. (72 is the bcrypt upper limit.)
- **FR-1.7** All checks are performed **on the server**; errors are shown to the user as clear, human-readable messages.

### FR-2. Rooms

- **FR-2.1** 5–6 meeting rooms are created via seed. Attributes: name, floor, capacity.
- **FR-2.2** No CRUD admin panel for rooms is required.
- **FR-2.3** Working hours are the same for all rooms: 09:00–19:00 office time (`Europe/Kyiv`).

### FR-3. Room Schedule (Weekly Grid)

- **FR-3.1** Weekly grid: days horizontally, time vertically, 30-minute slots.
- **FR-3.2** Occupied slots are visible to all users: the **booking title** and **who booked it** (author's name) are displayed.
- **FR-3.3** Week navigation: forward and backward (no depth limit specified in the spec).
- **FR-3.4** Visual reference: Google Calendar week view.
- **FR-3.5** The grid is built from scratch (table or CSS grid); ready-made calendar components are forbidden (see TECH-5).

### FR-4. User Timezone

- **FR-4.1** All times in the interface are displayed in the user's timezone, detected from the browser (`Intl.DateTimeFormat().resolvedOptions().timeZone` or equivalent).
- **FR-4.2** A user in a different timezone sees the same grid **shifted**: the 10:00–10:30 slot in Kyiv time is displayed as 09:00–09:30 for a user in Berlin.
- **FR-4.3** If the user's timezone differs from the office timezone, the interface makes this explicit (e.g., a label showing the office timezone next to the grid).
- **FR-4.4** Working-hours validation is still performed in office time (i.e., the "working window" on the user's grid may be shifted, e.g., 08:00–18:00 in Berlin).

### FR-5. Creating a Booking

- **FR-5.1** The user selects: room, date, start time, end time; and enters a booking title.
- **FR-5.2** Validation rules (all of them enforced on the server):
  - **FR-5.2.1** Title is required, 1 to 100 characters.
  - **FR-5.2.2** Start and end times are multiples of 30 minutes.
  - **FR-5.2.3** Duration: from 30 minutes to 4 hours inclusive.
  - **FR-5.2.4** Bookings only within working hours (09:00–19:00 office time).
  - **FR-5.2.5** Bookings only in the future (a time in the past is rejected).
  - **FR-5.2.6** A booking must not overlap with an existing booking in the same room.
  - **FR-5.2.7** Back-to-back bookings **do not conflict**: the end of one may coincide with the start of another. Example: 10:00–11:00 and 11:00–12:00 are two valid bookings.

#### Formalized Overlap Rule (Basis for Unit Tests)

Intervals are treated as half-open `[start, end)`. Two bookings A and B in the same room conflict if and only if:

```
A.start < B.end && B.start < A.end
```

Consequences:

- `A.end == B.start` → no conflict (back-to-back);
- partial overlap → conflict;
- exact match → conflict;
- one interval fully inside another → conflict;
- bookings on adjacent days → no conflict.

### FR-6. Booking Errors

- **FR-6.1** If a booking cannot be created, the user sees a clear message with the specific reason: slot is occupied / outside working hours / time is in the past (plus any other FR-5.2 rule violations).
- **FR-6.2** Checks are performed on the server, not only in the form. Client-side validation is auxiliary; the server is the source of truth.

### FR-7. Cancelling a Booking

- **FR-7.1** A user can cancel **their own** booking.
- **FR-7.2** Another user's booking cannot be cancelled: neither via the interface nor via a direct API request (server-side ownership check; expected response — 403).

### FR-8. My Bookings

- **FR-8.1** A dedicated page listing the current user's bookings; two sections or tabs:
  - **FR-8.1.1** **Upcoming**: soonest first; each row has a cancel button.
  - **FR-8.1.2** **Past**: most recent first; with pagination or lazy loading (infinite scroll / "load more").
- **FR-8.2** Each list row shows: date, time, room, and booking title.
- **FR-8.3** Times, as everywhere, are displayed in the user's timezone.
- **FR-8.4** Clicking a row navigates to that room's grid at the corresponding week.

### FR-9. Editing a Booking

- **FR-9.1** A user can edit **their own** booking: room, date, start time, end time, title.
- **FR-9.2** Another user's booking cannot be edited: neither via the interface nor via a direct API request (server-side ownership check; expected response — 403).
- **FR-9.3** **All** FR-5.2 validation rules apply to the updated values (30-minute granularity, duration, working hours, future time, no overlaps).
- **FR-9.4** In the overlap check, the booking being edited is excluded from the set of existing bookings (otherwise it would conflict with itself).
- **FR-9.5** A booking can be edited while it has not yet ended (the same condition as for cancellation — see DEC-7). Finished and cancelled bookings cannot be edited.
- **FR-9.6** Editing errors are surfaced the same way as creation errors (FR-6).

---

## 5. Interface Requirements (UI)

A thought-through interface is expected, not "a form on top of a database."

- **UI-1** A consistent style on all screens: spacing, typography, colors. Any styling approach is acceptable (Tailwind, CSS Modules, etc.).
- **UI-2** Every screen has **loading**, **empty**, and **error** states: "no bookings," an unavailable server, and an empty grid must not look like a white screen or an endless spinner.
- **UI-3** In forms, errors are shown **next to the corresponding fields**; the submit button is disabled while a request is in flight.
- **UI-4** The grid visually highlights the **current day** and the **current time**.
- **UI-5** The user's own bookings are visually distinct from other people's bookings in the grid.
- **UI-6** Booking cancellation requires confirmation: a confirmation dialog or an undo option.
- **UI-7** The layout does not break at different screen widths. A full mobile experience is a bonus (BONUS-8), but the layout must not degrade.

---

## 6. Technical Requirements

- **TECH-1** Language: **TypeScript** (frontend and backend).
- **TECH-2** Frontend: **React** or **Next.js**.
- **TECH-3** Backend: **NestJS**, **Express**, or **Next.js API routes** — implementer's choice.
- **TECH-4** Database: **PostgreSQL**, **MySQL**, or **SQLite** — implementer's choice.
- **TECH-5** The schedule grid is built **from scratch** (table or CSS grid). Ready-made calendar components such as FullCalendar are **forbidden**: this layout and logic are part of the assignment.
- **TECH-6** Time is stored in **UTC**.
- **TECH-7** Passwords are stored hashed: **bcrypt** or **argon2**.
- **TECH-8** Seeds:
  - rooms (e.g., "Aquarium", "Mars", "Gagarin") — 5–6 of them, with floor and capacity;
  - two test users (credentials in the README);
  - a few demo bookings.
- **TECH-9** Unit tests for the interval-overlap logic; required cases:
  - back-to-back (end == start) → no conflict;
  - partial overlap → conflict;
  - exact match → conflict;
  - adjacent days → no conflict.
    Run with: `npm test`.
- **TECH-10** Secrets and settings live in env; the repository contains an **`.env.example`**.

---

## 7. Bonus Requirements (Extra Points)

- **BONUS-1** Docker compose that brings everything up with a single command.
- **BONUS-2** Email confirmation in dev mode: no real SMTP needed, the confirmation link is printed to the server log; **booking is not allowed until the email is confirmed**.
- **BONUS-3** Weekly recurring bookings (e.g., "every Tuesday, 8 occurrences") with cancellation of a single occurrence or the entire series.
- **BONUS-4** Race-condition protection: two users click "book" on the same slot simultaneously → exactly one booking ends up in the database. The chosen solution (transaction, exclusion constraint, unique index, locking, etc.) is described in the README.
- **BONUS-5** End-of-booking notification:
  - if the next slot in the room is occupied, the author of the current booking receives an in-app notification (bell or toast) N minutes before its end;
  - the notification is delivered **exactly once**;
  - the notification is **not** delivered if either of the two bookings is cancelled;
  - N is configured via env (`NOTIFY_BEFORE_MINUTES`), default 10 minutes.
- **BONUS-6** API integration tests: booking creation and cancellation, validation rejections.
- **BONUS-7** Room filter by capacity.
- **BONUS-8** Full mobile experience: the grid is comfortable to use on a phone.

---

## 8. Deliverables

- **DEL-1** A Git repository with a **meaningful commit history**. A project uploaded as a single commit lowers the score.
- **DEL-2** A README containing:
  - how to run the project;
  - how to apply the seeds;
  - test user credentials;
  - the list of implemented bonus items;
  - a couple of short paragraphs in your own words: how the overlap check works and how time is stored.
- **DEL-3** The project must be runnable per the README **on a clean machine without reading the source code**.

---

## 9. Evaluation Criteria

| Criterion                                                                    | Weight |
| ---------------------------------------------------------------------------- | ------ |
| Works per the "What must work" list (FR-1…FR-8)                              | 40     |
| Code quality: readability, structure, no junk or dead code                   | 25     |
| UI/UX: expectations of the "Interface" section, grid clarity, overall polish | 20     |
| README and commit history                                                    | 15     |

- Bonus items add points **on top**.
- The participant must be ready to explain any part of their code: a follow-up call with "why is it written this way" questions is possible after review.
- **Disqualification** with no score awarded: submitting someone else's solution under your own name, participating from two or more accounts, collusion between participants.

---

## 10. Additional Clarifications (Decisions Made)

Items not explicitly defined in the spec. The decisions below are settled and binding on par with the rest of the requirements.

- **DEC-1** The schedule is not viewable without logging in. "Occupied slots are visible to everyone" means "to all authenticated users"; the entire app is behind login, and an unauthenticated visitor only gets registration and login.
- **DEC-2** The first day of the week in the grid is Monday by default, but the value is **configurable** (env/setting, e.g. `WEEK_START_DAY`) so it can be switched to Sunday without code changes.
- **DEC-3** "Only in the future" = the booking **start** time must be strictly later than the current server time at the moment of creation.
- **DEC-4** Editing a booking **is in scope** — see FR-9.
- **DEC-5** Cancellation is implemented as a **soft delete** (a "cancelled" flag plus a cancellation timestamp), not a physical delete: this is more convenient for BONUS-5 (the "cancelled" check). Cancelled bookings disappear from the grid and lists and take no part in the overlap check.
- **DEC-6** All time conversions go through an IANA-timezone library (e.g., `date-fns-tz` / `luxon` / `Temporal`), not a fixed offset — that way DST transitions in `Europe/Kyiv` (when the "working window" shifts in UTC) are handled correctly automatically.
- **DEC-7** A booking can be cancelled while it has **not yet ended** — including one that has already started. The same rule applies to editing (FR-9.5).
- **DEC-8** Week navigation has no hard limit, forward or backward.

---

## 11. Consolidated Readiness Checklist (Definition of Done)

- [ ] FR-1: registration, login, logout, persisted session, email normalization, server-side validation
- [ ] FR-2: seed with 5–6 rooms (name, floor, capacity)
- [ ] FR-3: weekly grid of 30-minute slots, week navigation, visibility of others' bookings with author
- [ ] FR-4: display in the user's timezone, office-timezone indicator, validation in office time
- [ ] FR-5: booking creation with all validation rules
- [ ] FR-6: clear server-side errors with reasons
- [ ] FR-7: cancel own bookings; others' forbidden at the API level
- [ ] FR-8: "My Bookings" page (upcoming/past, pagination, navigation to the grid)
- [ ] FR-9: editing own bookings with full validation; others' forbidden at the API level
- [ ] DEC-1…DEC-8: app behind login, configurable week start, soft delete, IANA timezones
- [ ] UI-1…UI-7: states, errors next to fields, current day/time highlighting, cancellation confirmation, responsiveness
- [ ] TECH-1…TECH-10: TypeScript, allowed stack, UTC, password hashing, seeds, overlap unit tests (`npm test`), `.env.example`
- [ ] DEL-1…DEL-3: commit history, complete README, runs on a clean machine
- [ ] (optional) BONUS-1…BONUS-8
