// The title being typed in the booking panel, read by the grid behind it so the
// picked range already carries the name of the meeting.
//
// It lives outside React for the same reason the toast does: the panel and the
// schedule are siblings under a server component, and there is no shared parent
// to hold the state in. One string, written by whichever form is open and
// cleared when it closes.

let draft = "";
const listeners = new Set<() => void>();

export function setDraftTitle(next: string) {
  if (next === draft) {
    return;
  }

  draft = next;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToDraftTitle(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export const readDraftTitle = () => draft;
// The server renders no draft: nothing has been typed before the page exists.
export const readNoDraftTitle = () => "";
