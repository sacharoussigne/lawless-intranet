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
    <header style={{ marginBottom: 'var(--mantine-spacing-md)' }}>
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <div>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--disp-font-display, inherit)',
              fontWeight: 400,
              fontSize: '1.75rem',
              color: 'var(--disp-ink, inherit)',
            }}
          >
            {title}
          </h1>
          {description && (
            <Text size="sm" c="dimmed" mt={4}>
              {description}
            </Text>
          )}
        </div>
        {actions && <div>{actions}</div>}
      </Group>
      <hr
        className="disp-section-divider"
        style={{
          marginTop: 'var(--mantine-spacing-md)',
          marginBottom: 'var(--mantine-spacing-md)',
          border: 'none',
          borderTop: '1px solid var(--disp-border, var(--mantine-color-slate-3, #d8d0c4))',
        }}
      />
    </header>
  );
}
