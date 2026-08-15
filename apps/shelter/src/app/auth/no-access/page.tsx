import { type Metadata } from 'next';
import { Container, Title, Text } from '@mantine/core';
import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/authSession';
import { can, resolvePermissions } from '@/lib/shelter/permissionsCatalog';
import LogoutButton from './LogoutButton';

export const metadata: Metadata = {
  title: 'Accès refusé',
};

export default async function NoAccessPage() {
  const session = await getAuthSession();
  if (session?.user?.role) {
    const effective = resolvePermissions({ roles: session.user.role });
    if (can(effective, 'application', 'access')) {
      redirect('/');
    }
  }

  return (
    <Container size="sm" style={{ marginTop: '10vh' }}>
      <div style={{ textAlign: 'center' }}>
        <Title order={1} size="h1" mb="md" className="shelter-display-title">
          Accès refusé
        </Title>
        <Text size="lg" mb="xl" c="dimmed">
          Vous n&apos;avez pas accès à cette application. Contactez un administrateur pour
          obtenir les permissions nécessaires.
        </Text>
        <LogoutButton />
      </div>
    </Container>
  );
}
