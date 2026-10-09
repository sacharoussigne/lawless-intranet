'use client';

import { Card, Divider, Group, SimpleGrid, Text, Title, UnstyledButton } from '@mantine/core';
import { IconCircleCheckFilled } from '@tabler/icons-react';
import { originOf, useAppTheme, type ThemeDefinition } from '@lawless-intranet/host-kit/theme';
import { SHELTER_THEMES } from '@/lib/themes';
import classes from './AppearanceCard.module.scss';

/** Miniature page drawn with the theme's own values (not the active theme's variables). */
function ThemePreview({ theme }: { theme: ThemeDefinition }) {
  const { tokens, soft } = theme;
  return (
    <div className={classes.preview} style={{ background: tokens.bg }} aria-hidden>
      <div className={classes.previewHeader} style={{ background: tokens.surface, borderColor: tokens.border }}>
        <span className={classes.previewDot} style={{ background: tokens.terracotta }} />
        <span className={classes.previewLine} style={{ background: tokens.ink, width: '38%' }} />
      </div>
      <div className={classes.previewCard} style={{ background: tokens.surface, borderColor: tokens.border }}>
        <span className={classes.previewLine} style={{ background: tokens.ink, width: '70%' }} />
        <span className={classes.previewLine} style={{ background: tokens.muted, width: '52%' }} />
        <Group gap={6} mt={4} wrap="nowrap">
          <span
            className={classes.previewPill}
            style={{ background: soft.terracotta?.strong, borderColor: soft.terracotta?.border, color: soft.terracotta?.text }}
          >
            Adopté
          </span>
          <span className={classes.previewButton} style={{ background: tokens.terracotta }} />
        </Group>
      </div>
    </div>
  );
}

/** « Apparence » section: one card per theme, applied with the reveal animation from the card. */
export function AppearanceCard() {
  const { themeId, setTheme } = useAppTheme();

  return (
    <Card withBorder shadow="sm" radius="md" padding="lg">
      <Title order={3}>Apparence</Title>
      <Text c="dimmed" size="sm" mt={4} mb="md">
        Thème du refuge, enregistré dans votre compte.
      </Text>
      <Divider mb="md" />

      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
        {SHELTER_THEMES.map((theme) => {
          const active = theme.id === themeId;
          return (
            <UnstyledButton
              key={theme.id}
              className={classes.option}
              data-active={active || undefined}
              aria-pressed={active}
              onClick={(event) => setTheme(theme.id, { origin: originOf(event.currentTarget) })}
            >
              <ThemePreview theme={theme} />
              <Group justify="space-between" wrap="nowrap" mt="xs" px={4}>
                <div>
                  <Text size="sm" fw={600}>
                    {theme.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {theme.scheme === 'dark' ? 'Sombre' : 'Clair'}
                  </Text>
                </div>
                {active ? <IconCircleCheckFilled size={20} className={classes.check} /> : null}
              </Group>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
    </Card>
  );
}
