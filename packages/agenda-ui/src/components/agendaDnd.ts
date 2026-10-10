import type { PointerEvent as ReactPointerEvent, SyntheticEvent } from 'react';
import { PointerSensor, TouchSensor, useSensor } from '@dnd-kit/core';

const PRESS_HOLD_ACTIVATION = { delay: 220, tolerance: 8 };
/** Touch: a quick swipe scrolls the page; holding still a bit longer starts the drag. */
const TOUCH_PRESS_HOLD_ACTIVATION = { delay: 250, tolerance: 8 };

/** Mouse and pen only: touch goes through the TouchSensor, which lets the page scroll. */
class MousePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent }: ReactPointerEvent) =>
        nativeEvent.pointerType !== 'touch' && nativeEvent.isPrimary && nativeEvent.button === 0,
    },
  ];
}

/** Press-and-hold drag sensors (mouse + touch), to spread into useSensors. */
export function usePressHoldSensors() {
  return [
    useSensor(MousePointerSensor, { activationConstraint: PRESS_HOLD_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_PRESS_HOLD_ACTIVATION }),
  ] as const;
}

function stopDragEvent(event: SyntheticEvent) {
  event.stopPropagation();
}

/** Spread on controls inside a draggable row (checkbox, buttons, inputs) so they never start a drag. */
export const stopDragProps = {
  onPointerDown: stopDragEvent,
  onTouchStart: stopDragEvent,
};
