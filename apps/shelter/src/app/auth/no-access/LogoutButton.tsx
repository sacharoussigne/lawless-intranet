'use client';

import { Button } from '@mantine/core';
import { authClient } from '@lawless-intranet/auth-client/browser';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/');
          router.refresh();
        },
      },
    });
  };

  return (
    <Button onClick={handleLogout} variant="light" color="terracotta">
      Se déconnecter
    </Button>
  );
}
