import React from 'react';
import { Card, Stack, Text } from '@mantine/core';

export const EmptyState = (): React.JSX.Element => {
  return (
    <Card withBorder radius="lg" padding="xl">
      <Stack gap={4} align="center">
        <Text fw={600}>Нет записей</Text>
        <Text size="sm" c="dimmed" ta="center">
          Когда появятся бронирования, они будут отображаться здесь.
        </Text>
      </Stack>
    </Card>
  );
};
