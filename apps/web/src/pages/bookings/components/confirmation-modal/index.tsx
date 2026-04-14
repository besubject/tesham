import React from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { CONFIRMATION_MODAL_COPY } from './constants';
import { ConfirmationModalProps } from './types';

const confirmationDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export const ConfirmationModal = ({
  confirmation,
  isSubmitting,
  onClose,
  onConfirm,
}: ConfirmationModalProps): React.JSX.Element => {
  const content = confirmation ? CONFIRMATION_MODAL_COPY[confirmation.action] : null;
  const bookingDate = confirmation
    ? confirmationDateFormatter.format(new Date(confirmation.booking.slot_date))
    : null;

  return (
    <Modal
      opened={Boolean(confirmation)}
      onClose={isSubmitting ? () => undefined : onClose}
      title={content?.title ?? ''}
      size="sm"
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          {content?.description}
        </Text>

        {confirmation && (
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Клиент: {confirmation.booking.client_name ?? 'Клиент'}
            </Text>
            <Text size="sm" c="dimmed">
              Услуга: {confirmation.booking.service_name}
            </Text>
            <Text size="sm" c="dimmed">
              Запись: {bookingDate}, {confirmation.booking.slot_start_time}
            </Text>
          </Stack>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={isSubmitting}>
            Назад
          </Button>
          <Button color={content?.confirmColor} loading={isSubmitting} onClick={onConfirm}>
            {content?.confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
