'use server';

import { z } from 'zod';
import {
  adminUpdateUser,
  createUser as createAuthUser,
  impersonateUser as impersonateUserAdmin,
  listUsers as listAuthUsers,
  removeUser,
  setRole,
  setUserPassword,
} from '@lawless-intranet/auth-client/admin';
import { type Role } from '@/types/enum/roles';
import { actionErrorParser } from '@/lib/action';
import { requirePlatformAdminContext } from '@/lib/shelter/serverActionContext';
import { getAuthRequestContext } from '@/lib/authRequest';

const roleEnum = z.enum(['user', 'admin', 'employee', 'direction']);

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

    const result = await listAuthUsers(params, (await getAuthRequestContext()).cookieHeader);

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

export async function createUser(data: z.infer<typeof createUserSchema>) {
  try {
    const authCtx = await requirePlatformAdminContext();
    if (!authCtx.ok) {
      return { status: authCtx.status, error: authCtx.error };
    }

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

export async function updateUser(data: z.infer<typeof updateUserSchema>) {
  try {
    const authCtx = await requirePlatformAdminContext();
    if (!authCtx.ok) {
      return { status: authCtx.status, error: authCtx.error };
    }

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

export async function setPassword(data: z.infer<typeof setPasswordSchema>) {
  try {
    const authCtx = await requirePlatformAdminContext();
    if (!authCtx.ok) {
      return { status: authCtx.status, error: authCtx.error };
    }

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

export async function deleteUser(data: z.infer<typeof deleteUserSchema>) {
  try {
    const authCtx = await requirePlatformAdminContext();
    if (!authCtx.ok) {
      return { status: authCtx.status, error: authCtx.error };
    }

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

export async function impersonateUser(userId: string) {
  try {
    const authCtx = await requirePlatformAdminContext();
    if (!authCtx.ok) {
      return { status: authCtx.status, error: authCtx.error };
    }

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
