type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeWaitlistLocalRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyWaitlistLocalRefresh(): void {
  for (const listener of listeners) {
    listener();
  }
}
