'use client';

import type { ReactNode } from 'react';
import { Group, Text } from '@mantine/core';

export type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header style={{ marginBottom: 'var(--mantine-spacing-xl)' }}>
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <div>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--disp-font-display)',
              fontWeight: 400,
              fontSize: '2rem',
              lineHeight: 1.25,
              color: 'var(--disp-ink)',
            }}
          >
            {title}
          </h1>
          {description && (
            <Text
              mt="xs"
              style={{
                color: 'var(--disp-ink-muted)',
                maxWidth: '42rem',
              }}
            >
              {description}
            </Text>
          )}
        </div>
        {actions && <div>{actions}</div>}
      </Group>
      <hr
        className="disp-section-divider"
        style={{ marginTop: 'var(--mantine-spacing-md)' }}
      />
    </header>
  );
}
