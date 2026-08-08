# Manual UI Audit

Playwright audit baseline: production Docker build, Ukrainian and English, light and dark themes, 1366×768 desktop, 768×1024 tablet, and 360×780 phone.

## Resolved regressions

### Phone notification panel stays inside the viewport

- The panel is anchored to the phone viewport and becomes scrollable when its content is taller than the available space.
- `e2e/screens.spec.ts` checks both horizontal bounds at desktop and phone widths.

### Mobile booking sheet closes with its exit motion

- The sheet remains mounted while the downward animation runs, then closes and restores the schedule.
- `e2e/mobile-sheet.spec.ts` verifies the animation and final hidden state.

### Booking selection keeps the weekly grid width stable

- The selection label stays inside the Sunday column instead of widening the schedule.
- `e2e/booking.spec.ts` verifies that the scroll width does not change after selecting a range.

## Product decisions to review manually

### Horizontal rails do not advertise that they scroll

- On a 360 px room list, the `12+` capacity option is intentionally only partly visible.
- On tablet schedule pages, the last room card is partly visible in the horizontal room rail.
- The clipping hints that more content exists, but there is no explicit swipe affordance. Verify with a real phone whether the gesture is discoverable enough.

### English UI keeps Ukrainian seed content

- Interface labels translate correctly, while room names, demo booking titles, and demo user names remain Ukrainian because they are database content.
- Decide whether this is desirable for the submission demo. Translating seed data by locale would be a product feature, not a missing UI translation.

### English date entry can be ambiguous

- The English date picker displays a locale-formatted value such as `8 / 10 / 2026`.
- Verify whether reviewers will read it as August 10 or October 8. The calendar popover removes the ambiguity, but an ISO-like visual format may be clearer for this product.

### Long booking titles truncate on phone

- The first card in “My bookings” shortens a long title to keep the time and actions visible.
- Verify that opening the row or edit panel exposes the full title and that the truncation is acceptable.

## Manual matrix

For each combination below, check keyboard focus, text clipping, overlay position, and horizontal scrolling:

| Language  | Theme       | Widths         |
| --------- | ----------- | -------------- |
| Ukrainian | Light, dark | 360, 768, 1366 |
| English   | Light, dark | 360, 768, 1366 |

Pages and interactions:

1. Room list: capacity filters, floor headings, availability rows, room rail.
2. Schedule: previous/next navigation, Today, timezone notice, sidebar/room rail.
3. Booking: select/date popovers near viewport edges, recurrence row, error messages.
4. Phone booking: tap slot, resize handle, expand/collapse by tap and swipe.
5. My bookings: upcoming/past tabs, long titles, edit and cancel confirmation.
6. Header: notification panel, mobile menu, language and theme switches.
7. Guest screens: login, registration, validation errors, password visibility.
8. Empty/error pages: free week, no bookings, notifications, 404.
