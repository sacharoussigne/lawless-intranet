'use client';

import type { ModalProps } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { MOBILE_MEDIA_QUERY } from '@/lib/navigation/mobileNav';

/** Phones: modals open full screen and slide up, like a native sheet. Spread on any `<Modal>`. */
export function useMobileModalProps(): Pick<ModalProps, 'fullScreen' | 'transitionProps'> {
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY) ?? false;
  return isMobile ? { fullScreen: true, transitionProps: { transition: 'slide-up', duration: 200 } } : {};
}
