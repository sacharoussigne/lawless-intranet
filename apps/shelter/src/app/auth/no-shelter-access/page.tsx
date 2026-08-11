import { type Metadata } from 'next';
import { Container, Title, Text } from '@mantine/core';
import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/authSession';
import { listAccessibleShelters } from '@/lib/shelter/context';
import { tenantRoutes } from '@/types/routes';
import LogoutButton from '../no-access/LogoutButton';

export const metadata: Metadata = {
  title: 'Aucun refuge accessible',
};

export default async function NoShelterAccessPage() {
  const session = await getAuthSession();
  if (session) {
    const accessible = await listAccessibleShelters(session);
    if (accessible.length > 0) {
      redirect(tenantRoutes(accessible[0].slug).employee.index);
    }
  }

  return (
    <Container size="sm" style={{ marginTop: '10vh' }}>
      <div style={{ textAlign: 'center' }}>
        <Title order={1} size="h1" mb="md" className="shelter-display-title">
          Aucun refuge accessible
        </Title>
        <Text size="lg" mb="xl" c="dimmed">
          Votre compte n&apos;est rattaché à aucun refuge pour le moment. Demandez à un
          administrateur de vous ajouter comme membre, puis reconnectez-vous.
        </Text>
        <LogoutButton />
      </div>
    </Container>
  );
}
