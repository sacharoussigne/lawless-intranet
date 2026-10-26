'use server';

import { z } from 'zod/v3';
import prisma from '@/lib/prisma';
import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/business/tenantWhere';
import { getMemberDescription } from '@/lib/business/memberDescription';
import { getBusinessUserName } from '@/lib/people/userProfiles';
import { getServerCookieHeader } from '@/lib/documents/mailDocuments';
import { PAYROLL_REPORT_TYPE_EMPLOYES } from '@/lib/payroll/constants';
import { payrollReportResultSchema } from '@/lib/payroll/schema';
import {
  buildPayrollLetterVariables,
  PAYROLL_LETTER_TEMPLATE_TYPE,
  type LetterGender,
} from '@/lib/payroll/letter/variables';
import { findBusinessProfiles } from '@/lib/businessDiscordProfile/queries';
import { fetchUserProfiles } from '@/lib/authUsers';
import { pickProfileDisplayName } from '@/lib/people/displayName';
import { payrollNameKey } from '@/lib/payroll/mergeWeeklyActivity';
import type { PayrollReportResult } from '@/lib/payroll/schema';
import { buildUserTemplateRenderContext, renderTemplate } from '@lawless-intranet/mail-template-engine';
import {
  createTemplate,
  listTemplates,
  updateTemplate,
} from '@lawless-intranet/documents-client/server';
import type { TemplateRecord } from '@lawless-intranet/types';

const letterViewGuard = {
  feature: 'payroll' as const,
  permission: { resource: 'payroll_reports' as const, action: 'view', message: 'Accès refusé' },
};

/** Editing the letter is part of the payroll settings. */
const letterEditGuard = {
  feature: 'payroll' as const,
  permission: { resource: 'payroll_reports' as const, action: 'create', message: 'Accès refusé' },
};

const DEFAULT_LETTER_NAME = 'Lettre à la mairie';

const saveLetterSchema = z.object({
  content: z.string().trim().min(1, 'Le contenu est requis').max(100_000, 'Le contenu est trop long'),
});

export type PayrollLetterTemplate = { id: string; name: string; content: string } | null;

type PayrollEmployee = PayrollReportResult['employees'][number];

/**
 * Gender of each report line, from the intranet account of its person (found by
 * account number, then by name); best effort, unknown when auth does not answer.
 */
async function letterGenderResolver(businessId: string): Promise<(employee: PayrollEmployee) => LetterGender | null> {
  const profiles = (await findBusinessProfiles(prisma, businessId)).filter((p) => p.userId);
  const users = await fetchUserProfiles(profiles.map((p) => p.userId as string)).catch(() => new Map());
  const byAccount = new Map<number, LetterGender>();
  const byName = new Map<string, LetterGender>();
  for (const profile of profiles) {
    const gender = users.get(profile.userId as string)?.gender as LetterGender | undefined;
    if (!gender) continue;
    if (profile.accountNumber != null) byAccount.set(profile.accountNumber, gender);
    byName.set(payrollNameKey(pickProfileDisplayName(profile, '')), gender);
  }
  return (employee) =>
    (employee.id != null ? byAccount.get(employee.id) : undefined) ?? byName.get(payrollNameKey(employee.name)) ?? null;
}

/** The business's city hall letter template (one per business), if any. */
async function findLetterTemplate(businessId: string): Promise<TemplateRecord | null> {
  const result = await listTemplates(
    { type: PAYROLL_LETTER_TEMPLATE_TYPE, scopeId: businessId, ownerScope: 'org', pageSize: 1 },
    { cookieHeader: await getServerCookieHeader() },
  );
  return result.items[0] ?? null;
}

export async function getPayrollLetterTemplate(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, letterViewGuard);
    if (!ctx.ok) return ctx.response;
    const template = await findLetterTemplate(ctx.tenant.businessId);
    const data: PayrollLetterTemplate = template
      ? { id: template.id, name: template.name, content: template.content }
      : null;
    return { status: 200 as const, data };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors du chargement de la lettre à la mairie');
  }
}

async function savePayrollLetterTemplateUnlogged(businessSlug: string, input: unknown) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, letterEditGuard);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;
    const { content } = saveLetterSchema.parse(input);
    const cookieHeader = await getServerCookieHeader();

    const existing = await findLetterTemplate(businessId);
    const template = existing
      ? await updateTemplate(existing.id, { content }, { cookieHeader })
      : await createTemplate(
          {
            type: PAYROLL_LETTER_TEMPLATE_TYPE,
            scopeId: businessId,
            ownerId: null,
            name: DEFAULT_LETTER_NAME,
            content,
          },
          { cookieHeader },
        );

    const data: PayrollLetterTemplate = { id: template.id, name: template.name, content: template.content };
    return { status: 200 as const, data };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de l’enregistrement de la lettre à la mairie');
  }
}

export async function savePayrollLetterTemplate(...args: Parameters<typeof savePayrollLetterTemplateUnlogged>) {
  return loggedAction(
    { feature: 'payroll', event: 'payroll.saveLetterTemplate', context: null },
    args,
    () => savePayrollLetterTemplateUnlogged(...args),
  );
}

/**
 * City hall letter of an « Employés » report, rendered from its current lines
 * (the report stays editable: nothing is stored). 404 without a letter template.
 */
export async function generatePayrollLetter(businessSlug: string, input: unknown) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, letterViewGuard);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;
    const { reportId } = z.object({ reportId: z.string().min(1) }).parse(input);

    const report = await prisma.payrollWeeklyReport.findFirst({
      where: { id: reportId, ...tenantWhere(businessId) },
      select: { weekStart: true, weekEnd: true, reportType: true, resultJson: true },
    });
    if (!report) return { status: 404 as const, error: 'Rapport introuvable' };
    if (report.reportType !== PAYROLL_REPORT_TYPE_EMPLOYES) {
      return { status: 422 as const, error: 'La lettre à la mairie ne concerne que les rapports « Employés ».' };
    }
    const parsed = payrollReportResultSchema.safeParse(report.resultJson);
    if (!parsed.success) return { status: 422 as const, error: 'Ce rapport n’a pas de lignes lisibles.' };

    const template = await findLetterTemplate(businessId);
    if (!template) {
      return {
        status: 404 as const,
        error: 'Aucune lettre à la mairie : à rédiger dans Paramètres › Salaires.',
      };
    }

    const content = renderTemplate(
      template.content,
      buildUserTemplateRenderContext({
        inputs: {},
        username: await getBusinessUserName(businessId, ctx.session.user.id, ctx.session.user.name || 'Utilisateur'),
        userDescription: (await getMemberDescription(businessId, ctx.session.user.id)) ?? '',
        userGender: ctx.session.user.gender ?? 'male',
        variables: buildPayrollLetterVariables({
          weekStart: report.weekStart,
          weekEnd: report.weekEnd,
          result: parsed.data,
          genderOf: await letterGenderResolver(businessId),
        }),
      }),
    );

    return { status: 200 as const, data: { content, templateName: template.name } };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la génération de la lettre à la mairie');
  }
}
