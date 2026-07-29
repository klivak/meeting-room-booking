// A single short-lived message shown after a successful action, optionally with
// one thing to do about it.
//
// It lives outside React because the component that triggers it — a form or a
// row — is unmounted by the refresh that follows the save, and the message has
// to outlive it. The store is read by <Toaster /> in the app layout.

const DURATION_MS = 4000;
// An undo has to survive the "wait, what did I just do?" pause, and four seconds
// is not that pause.
const ACTION_DURATION_MS = 9000;

export type Toast = {
  message: string;
  /** The one thing offered about it, such as taking a cancellation back. */
  action?: { label: string; run: () => void };
};

let toast: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function showToast(message: string, action?: Toast["action"]) {
  toast = { message, action };
  emit();

  clearTimeout(timer);
  timer = setTimeout(
    () => {
      toast = null;
      emit();
    },
    action ? ACTION_DURATION_MS : DURATION_MS,
  );
}

/** Takes the current message away, which is what running its action does. */
export function dismissToast() {
  clearTimeout(timer);
  toast = null;
  emit();
}

export function subscribeToToast(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export const readToast = () => toast;
export const readNoToast = () => null;
