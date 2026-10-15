'use server';

import { loggedAction } from '@/lib/logs/writer';
import { z } from 'zod';
import { z as zv3 } from 'zod/v3';
import {
  adminUpdateUser,
  changePassword,
  createUser as createAuthUser,
  impersonateUser as impersonateUserAdmin,
  listUsers as listAuthUsers,
  removeUser,
  setRole,
  setUserPassword,
  updateUser as updateAuthUser,
} from '@lawless-intranet/auth-client/admin';
import { getAuthSession } from '@/lib/authSession';
import { type Role } from '@/types/enum/roles';
import { actionErrorParser } from '@/lib/action';
import { requirePlatformAdminContext } from '@/lib/dispensary/serverActionContext';
import { getAuthRequestContext } from '@/lib/authRequest';

const roleEnum = z.enum([
  'user',
  'admin',
  'employee',
  'inventory_manager',
  'inventory_viewer',
  'direction',
]);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  roles: z.array(roleEnum).optional(),
});

const updateUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  roles: z.array(roleEnum).optional(),
});

const setPasswordSchema = z.object({
  userId: z.string(),
  password: z.string().min(8),
});

const deleteUserSchema = z.object({
  id: z.string(),
});

async function getCookieHeader() {
  return (await getAuthRequestContext()).cookieHeader;
}

export async function listUsers(params?: {
  searchValue?: string;
  searchField?: 'email' | 'name';
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}) {
  try {
    const authCtx = await requirePlatformAdminContext();
    if (!authCtx.ok) {
      return { status: authCtx.status, error: authCtx.error };
    }

    const cookieHeader = await getCookieHeader();
    const result = await listAuthUsers(params, cookieHeader);

    return {
      status: 200,
      data: result,
    };
  } catch (error: unknown) {
    return {
      status: 500,
      error:
        error instanceof Error
          ? error.message
          : 'Erreur lors de la récupération des utilisateurs',
    };
  }
}

async function createUserUnlogged(data: z.infer<typeof createUserSchema>) {
  try {
    const validated = createUserSchema.parse(data);
    const authContext = await getAuthRequestContext();

    const result = await createAuthUser(
      {
        email: validated.email,
        password: validated.password,
        name: validated.name,
        role:
          validated.roles && validated.roles.length > 0
            ? validated.roles.join(',')
            : 'user',
      },
      authContext,
    );

    return {
      status: 200,
      data: result,
    };
  } catch (error: unknown) {
    return actionErrorParser(error, "Erreur lors de la création de l'utilisateur");
  }
}

async function updateUserUnlogged(data: z.infer<typeof updateUserSchema>) {
  try {
    const validated = updateUserSchema.parse(data);
    const authContext = await getAuthRequestContext();

    const result = await adminUpdateUser(
      {
        userId: validated.id,
        data: {
          name: validated.name,
        },
      },
      authContext,
    );

    if (validated.roles) {
      await setRole(
        {
          userId: validated.id,
          role: validated.roles as Role[],
        },
        authContext,
      );
    }

    return {
      status: 200,
      data: result,
    };
  } catch (error: unknown) {
    return actionErrorParser(error, "Erreur lors de la mise à jour de l'utilisateur");
  }
}

async function setPasswordUnlogged(data: z.infer<typeof setPasswordSchema>) {
  try {
    const validated = setPasswordSchema.parse(data);
    const authContext = await getAuthRequestContext();

    const result = await setUserPassword(
      {
        userId: validated.userId,
        newPassword: validated.password,
      },
      authContext,
    );

    return {
      status: 200,
      data: result,
    };
  } catch (error: unknown) {
    return actionErrorParser(error, 'Erreur lors du changement de mot de passe');
  }
}

async function deleteUserUnlogged(data: z.infer<typeof deleteUserSchema>) {
  try {
    const validated = deleteUserSchema.parse(data);
    const authContext = await getAuthRequestContext();

    await removeUser({ userId: validated.id }, authContext);

    return {
      status: 200,
      data: { success: true },
    };
  } catch (error: unknown) {
    return actionErrorParser(error, "Erreur lors de la suppression de l'utilisateur");
  }
}

async function impersonateUserUnlogged(userId: string) {
  try {
    const authContext = await getAuthRequestContext();
    const result = await impersonateUserAdmin({ userId }, authContext);

    return {
      status: 200,
      data: result,
    };
  } catch (error: unknown) {
    return {
      status: 500,
      error:
        error instanceof Error ? error.message : "Erreur lors de l'impersonation",
    };
  }
}

const updateMyProfileSchema = zv3.object({
  name: zv3.string().min(1, 'Le nom est requis'),
  image: zv3
    .string()
    .nullable()
    .optional()
    .refine((value) => {
      if (value === undefined || value === null || value.length === 0) return true;

      if (value.startsWith('data:image/')) {
        const match = value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
        if (!match) return false;

        const base64 = match[2] ?? '';
        const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
        const bytes = Math.floor((base64.length * 3) / 4) - padding;
        return bytes <= 1_000_000;
      }

      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }, 'Image invalide (URL ou Data URL base64 ≤ 1MB)'),
});

async function updateMyProfileUnlogged(data: zv3.infer<typeof updateMyProfileSchema>) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return {
        status: 401,
        error: 'Non autorisé',
      };
    }

    const validated = updateMyProfileSchema.parse(data);
    const authContext = await getAuthRequestContext();

    const result = await updateAuthUser(
      {
        name: validated.name,
        image: validated.image === undefined ? undefined : validated.image,
      },
      authContext,
    );

    return {
      status: 200,
      data: result,
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour du profil');
  }
}

const changeMyPasswordSchema = zv3.object({
  currentPassword: zv3.string().min(1, 'Le mot de passe actuel est requis'),
  newPassword: zv3.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

async function changeMyPasswordUnlogged(data: zv3.infer<typeof changeMyPasswordSchema>) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return {
        status: 401,
        error: 'Non autorisé',
      };
    }

    const validated = changeMyPasswordSchema.parse(data);
    const authContext = await getAuthRequestContext();

    const result = await changePassword(
      {
        currentPassword: validated.currentPassword,
        newPassword: validated.newPassword,
        revokeOtherSessions: true,
      },
      authContext,
    );

    return {
      status: 200,
      data: result,
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du changement de mot de passe');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createUser(...args: Parameters<typeof createUserUnlogged>) {
  return loggedAction({ feature: 'platform', event: 'users.createUser' }, args, () =>
    createUserUnlogged(...args),
  );
}

export async function updateUser(...args: Parameters<typeof updateUserUnlogged>) {
  return loggedAction({ feature: 'platform', event: 'users.updateUser' }, args, () =>
    updateUserUnlogged(...args),
  );
}

export async function setPassword(...args: Parameters<typeof setPasswordUnlogged>) {
  // Arguments hold a password: not logged.
  return loggedAction(
    { feature: 'platform', event: 'users.setPassword', context: null },
    args,
    () => setPasswordUnlogged(...args),
  );
}

export async function deleteUser(...args: Parameters<typeof deleteUserUnlogged>) {
  return loggedAction({ feature: 'platform', event: 'users.deleteUser' }, args, () =>
    deleteUserUnlogged(...args),
  );
}

export async function impersonateUser(...args: Parameters<typeof impersonateUserUnlogged>) {
  return loggedAction({ feature: 'platform', event: 'users.impersonateUser' }, args, () =>
    impersonateUserUnlogged(...args),
  );
}

export async function updateMyProfile(...args: Parameters<typeof updateMyProfileUnlogged>) {
  return loggedAction({ feature: 'platform', event: 'users.updateMyProfile' }, args, () =>
    updateMyProfileUnlogged(...args),
  );
}

export async function changeMyPassword(...args: Parameters<typeof changeMyPasswordUnlogged>) {
  // Arguments hold a password: not logged.
  return loggedAction(
    { feature: 'platform', event: 'users.changeMyPassword', context: null },
    args,
    () => changeMyPasswordUnlogged(...args),
  );
}
