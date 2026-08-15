import { type Metadata } from 'next';
import { Container, Title, Text } from '@mantine/core';
import LogoutButton from '../no-access/LogoutButton';

export const metadata: Metadata = {
  title: 'Droits insuffisants',
};

export default function NoManagementAccessPage() {
  return (
    <Container size="sm" style={{ marginTop: '10vh' }}>
      <div style={{ textAlign: 'center' }}>
        <Title order={1} size="h1" mb="md" className="shelter-display-title">
          Droits insuffisants
        </Title>
        <Text size="lg" mb="xl" c="dimmed">
          Cette page nécessite des droits administrateur.
        </Text>
        <LogoutButton />
      </div>
    </Container>
  );
}
