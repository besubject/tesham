import React from 'react';
import { Group, Text } from '@mantine/core';
import { DetailsRowProps } from './types';

export const DetailsRow = ({ label, value }: DetailsRowProps): React.JSX.Element => {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Text c="dimmed" fw={600} size="sm">
        {label}
      </Text>
      <Text ta="right" fw={500} size="sm">
        {value}
      </Text>
    </Group>
  );
};
