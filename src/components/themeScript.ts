import { THEME_STORAGE_KEY } from "@/components/theme";

// The script that resolves the stored theme before the first paint, and the
// hash the Content-Security-Policy names it by.
//
// It lives in its own module because two very different places need it: the
// layout renders it, and the middleware has to allow it. Keeping the string and
// the hash side by side is what makes it obvious they must change together —
// and themeScript.test.ts is what makes sure they did.

/** Resolves the stored preference before the first paint, so switching to the dark theme and reloading does not flash a white page. */
export const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

/**
 * SHA-256 of exactly that string, as CSP spells it.
 *
 * A hash rather than a nonce, even though the policy carries a nonce for Next's
 * own scripts. Browsers blank out the nonce attribute once they have applied the
 * policy, so React reads "" on the client where the server wrote a value and
 * reports a hydration mismatch on every page. A hash has no such problem and is
 * stricter besides: it pins this exact script rather than whatever happens to
 * carry the right nonce.
 */
export const THEME_SCRIPT_HASH =
  "sha256-XGoBHnVRx7Q2S808hkzZ6+0cky8Enjk+rKm3wmAdcL0=";
