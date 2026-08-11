import type { ReactNode } from 'react';

export function LoggedInShell({ children }: { children: ReactNode }) {
  return <div className="shelter-shell flex flex-1 flex-col w-full">{children}</div>;
}
