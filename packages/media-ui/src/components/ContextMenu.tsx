'use client';

import { useCallback, useState, type MouseEvent, type ReactNode } from 'react';
import { Menu } from '@mantine/core';

type ContextMenuState = { x: number; y: number; content: ReactNode } | null;

/** Right-click menu state: `open` replaces the browser menu with `content` at the cursor. */
export function useContextMenu() {
  const [state, setState] = useState<ContextMenuState>(null);

  const open = useCallback((event: MouseEvent, content: ReactNode) => {
    event.preventDefault();
    event.stopPropagation();
    setState({ x: event.clientX, y: event.clientY, content });
  }, []);

  const close = useCallback(() => setState(null), []);

  return { state, open, close };
}

/**
 * Mantine menu anchored to an invisible point at the cursor. Remounted per position
 * so the dropdown never animates from the previous location.
 */
export function ContextMenu({ state, onClose }: { state: ContextMenuState; onClose: () => void }) {
  if (!state) return null;

  return (
    <Menu
      key={`${state.x}:${state.y}`}
      opened
      onChange={(opened) => {
        if (!opened) onClose();
      }}
      position="bottom-start"
      offset={2}
      width={230}
      shadow="md"
      withinPortal
    >
      <Menu.Target>
        <div
          aria-hidden
          style={{ position: 'fixed', left: state.x, top: state.y, width: 0, height: 0, pointerEvents: 'none' }}
        />
      </Menu.Target>
      <Menu.Dropdown
        onContextMenu={(event) => event.preventDefault()}
        // Touch: holding an entry must not select its text.
        style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        {state.content}
      </Menu.Dropdown>
    </Menu>
  );
}
