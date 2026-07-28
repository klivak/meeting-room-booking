// A single short-lived message shown after a successful action.
//
// It lives outside React because the component that triggers it — a form or a
// row — is unmounted by the refresh that follows the save, and the message has
// to outlive it. The store is read by <Toaster /> in the app layout.

const DURATION_MS = 4000;

let message: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function showToast(next: string) {
  message = next;
  emit();

  clearTimeout(timer);
  timer = setTimeout(() => {
    message = null;
    emit();
  }, DURATION_MS);
}

export function subscribeToToast(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export const readToast = () => message;
export const readNoToast = () => null;
