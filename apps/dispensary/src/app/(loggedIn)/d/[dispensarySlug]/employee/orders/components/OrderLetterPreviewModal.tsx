'use client';

import { useEffect, useMemo, useState } from 'react';
import { Stack, Button, Loader, Text } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { generateOrderMailPreview } from '@/app/_actions/mailTemplates';
import { handleAction } from '@/lib/action';
import { buildOrderMailVariables } from '@/lib/mailTemplate/buildOrderMailVariables';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import {
  TemplatePreviewWithForm,
  useTemplatePreviewActions,
} from '@lawless-intranet/mail-template-ui';
import { useOrderDetail } from '../hooks/useOrdersQueries';

interface OrderLetterPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  orderId: string | null;
}

export function OrderLetterPreviewModal({
  opened,
  onClose,
  orderId,
}: OrderLetterPreviewModalProps) {
  const dispensarySlug = useRequiredDispensarySlug();
  const { data: order, isLoading: loadingOrder } = useOrderDetail(
    orderId,
    opened && Boolean(orderId),
  );
  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const orderVariables = useMemo(() => {
    if (!order) return undefined;
    return buildOrderMailVariables({
      type: order.type,
      status: order.status,
      price: order.price,
      company: order.company,
      individualCustomer: order.individualCustomer,
      items: order.items.map((orderItem) => ({
        quantity: orderItem.quantity,
        item: { name: orderItem.item.name },
      })),
    });
  }, [order]);

  const preview = useTemplatePreviewActions(templateContent ?? '', orderVariables, {
    inputsMode: 'disabled',
  });

  useEffect(() => {
    if (opened && order) {
      void loadPreview(order);
    } else {
      setTemplateContent(null);
    }
  }, [opened, order]);

  const loadPreview = async (orderData: NonNullable<typeof order>) => {
    try {
      setLoading(true);
      const result = await generateOrderMailPreview(dispensarySlug, {
        order: {
          type: orderData.type,
          status: orderData.status,
          price: orderData.price,
          company: orderData.company,
          individualCustomer: orderData.individualCustomer,
          items: orderData.items.map((orderItem) => ({
            quantity: orderItem.quantity,
            item: { name: orderItem.item.name },
          })),
        },
      });
      const data = handleAction(result);
      if (data?.templateContent) {
        setTemplateContent(data.templateContent);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors du chargement de l\'aperçu';
      notifications.show({
        title: 'Erreur',
        message,
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!preview.resultContent) return;

    try {
      await navigator.clipboard.writeText(preview.resultContent);
      setCopied(true);
      notifications.show({
        title: 'Succès',
        message: 'Courrier copié dans le presse-papiers',
        color: 'moss',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de copier le courrier',
        color: 'danger',
      });
    }
  };

  const isLoading = loadingOrder || loading;

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Aperçu du courrier"
      size="xl"
      footer={
        preview.resultContent ? (
          <AppModalFooter>
            <Button
              leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              onClick={handleCopy}
              color={copied ? 'moss' : 'sage'}
            >
              {copied ? 'Copié !' : 'Copier le courrier'}
            </Button>
          </AppModalFooter>
        ) : undefined
      }
    >
      {isLoading ? (
        <Stack align="center" py="xl">
          <Loader />
          <Text size="sm" c="dimmed">
            Génération de l&apos;aperçu...
          </Text>
        </Stack>
      ) : templateContent ? (
        <TemplatePreviewWithForm
          templateContent={templateContent}
          variables={orderVariables}
          inputsMode="disabled"
          resultLabel="Courrier généré"
          formRef={preview.formRef}
          onFormChange={preview.setFormContent}
          resultContent={preview.resultContent}
          onResultChange={preview.setEditedContent}
          isManuallyEdited={preview.isManuallyEdited}
          onRegenerate={preview.handleRegenerate}
        />
      ) : (
        <Text c="dimmed" ta="center">
          Aucun aperçu disponible
        </Text>
      )}
    </AppModal>
  );
}
