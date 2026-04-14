import React from 'react';
import { Card, Loader } from '@mantine/core';
import styles from '../../index.module.scss';

export const LoadingState = (): React.JSX.Element => {
  return (
    <Card withBorder className={styles.loader} radius="lg" padding="xl">
      <Loader size={30} />
    </Card>
  );
};
