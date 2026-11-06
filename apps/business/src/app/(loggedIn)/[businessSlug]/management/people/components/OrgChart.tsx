'use client';

import { Fragment } from 'react';
import { Badge, Group, Paper, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { apothecaryBooleanPills } from '@/lib/apothecaryPill';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { groupStaffByGrade } from '@/lib/staff/orgChart';
import type { BusinessPerson } from '@/lib/people/types';
import classes from './OrgChart.module.scss';

/** Current staff by grade level, top first; a card opens the person's history. */
export function OrgChart({
  people,
  onOpenPerson,
}: {
  people: BusinessPerson[];
  onOpenPerson: (person: BusinessPerson) => void;
}) {
  const { formatRpDate } = useRpCalendar();
  const levels = groupStaffByGrade(people.filter((person) => person.employment.active));

  if (levels.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="xl">
        Personne n&apos;est employé pour le moment : embauchez depuis le parcours d&apos;une personne
        (liste, bouton historique).
      </Text>
    );
  }

  return (
    <div className={classes.chart}>
      {levels.map((level, index) => (
        <Fragment key={level.key}>
          {index > 0 && <div className={classes.connector} aria-hidden />}
          <Stack gap="sm" className={classes.level}>
            <Group justify="center" gap="xs">
              <Text size="lg" className={classes.levelTitle}>
                {level.label}
              </Text>
              <Badge variant="outline" radius="sm" style={apothecaryBooleanPills.no}>
                {level.people.length}
              </Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="sm">
              {level.people.map((person) => (
                <UnstyledButton
                  key={person.discordUserId}
                  onClick={() => onOpenPerson(person)}
                  aria-label={`Parcours de ${person.displayName}`}
                >
                  <Paper withBorder p="sm" className={classes.card}>
                    <Text size="sm" fw={600}>
                      {person.displayName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {person.role ?? 'Sans grade'}
                      {' · '}
                      {person.accountNumber != null ? `compte n°${person.accountNumber}` : 'sans n° de compte'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Depuis le {formatRpDate(person.employment.since)}
                    </Text>
                  </Paper>
                </UnstyledButton>
              ))}
            </SimpleGrid>
          </Stack>
        </Fragment>
      ))}
    </div>
  );
}
