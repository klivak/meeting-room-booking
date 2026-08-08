# Meeting Room Booking — Promo Video

An isolated Remotion project for two localized versions of the 36-second product promo. Both versions include background music.

## Commands

```bash
cd marketing
npm install
npm run studio
npm run typecheck
npm run still
npm run render
```

Outputs are written to `marketing/out/` and are not committed. The Ukrainian and English compositions are `MeetingRoomsPromoUk` and `MeetingRoomsPromoEn` at 1920×1080, 30 fps, 36 seconds. Both use `public/music.mp3` as background music.

## Asset refresh

The localized images in `public/app/uk/` and `public/app/en/` are curated Playwright captures from the running application. With the app available at `http://localhost:3000` and `e2e/.auth/user.json` prepared, run `npm run capture:assets` after a visual redesign.

## Audio workflow

1. The background track is loaded from `public/music.mp3` and mixed at 22% volume with short fades.
