import React, { useState } from 'react';
import { Card, Group, Progress, SimpleGrid, Stack, Table, Tabs, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@mettig/shared';
import { STATS_COPY, STATS_PERIOD_TABS } from './constants';
import { BusinessStatsResponseDto, StatsPeriod } from './types';
import { getSourcePercentage } from './utils';
import styles from './index.module.scss';

export const StatsPage = () => {
  const [period, setPeriod] = useState<StatsPeriod>('month');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['business-stats', period],
    queryFn: async () => {
      const { data } = await apiClient.get<BusinessStatsResponseDto>('/business/stats', {
        params: { period },
      });
      return data.stats;
    },
  });

  return (
    <div className={styles.statsPage}>
      <Stack gap="xs">
        <Title order={1}>{STATS_COPY.title}</Title>
        <Text c="dimmed">{STATS_COPY.subtitle}</Text>
      </Stack>

      <Tabs
        color="#191a2d"
        value={period}
        onChange={(value) => setPeriod((value as StatsPeriod) ?? 'month')}
        keepMounted={false}
      >
        <Tabs.List>
          {STATS_PERIOD_TABS.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {isLoading ? (
        <Card withBorder radius="lg" padding="xl">
          <Text c="dimmed" ta="center">
            {STATS_COPY.loading}
          </Text>
        </Card>
      ) : !stats ? (
        <Card withBorder radius="lg" padding="xl">
          <Text c="dimmed" ta="center">
            {STATS_COPY.empty}
          </Text>
        </Card>
      ) : (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: stats.avg_rating !== null ? 3 : 2 }} spacing="lg">
            <Card withBorder radius="xl" padding="lg">
              <Stack gap={4} align="center">
                <Text className={styles.metricValue}>{stats.bookings_count}</Text>
                <Text c="dimmed" size="sm">
                  {STATS_COPY.bookings}
                </Text>
              </Stack>
            </Card>

            {stats.avg_rating !== null ? (
              <Card withBorder radius="xl" padding="lg">
                <Stack gap={4} align="center">
                  <Group gap={8} align="center">
                    <Text className={styles.metricValue}>{stats.avg_rating.toFixed(1)}</Text>
                    <Text fz="1.5rem">⭐</Text>
                  </Group>
                  <Text c="dimmed" size="sm">
                    {STATS_COPY.rating}
                  </Text>
                </Stack>
              </Card>
            ) : null}

            <Card withBorder radius="xl" padding="lg">
              <Stack gap={4} align="center">
                <Text className={styles.metricValue}>{stats.show_rate_pct}%</Text>
                <Text c="dimmed" size="sm">
                  {STATS_COPY.showRate}
                </Text>
                <Text c="dimmed" size="xs" ta="center">
                  {STATS_COPY.showRateHint}
                </Text>
              </Stack>
            </Card>
          </SimpleGrid>

          <Card withBorder radius="xl" padding="lg">
            <Stack gap="lg">
              <Title order={3}>{STATS_COPY.sourcesTitle}</Title>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                <Card withBorder radius="lg" padding="md">
                  <Stack gap="sm">
                    <Text fw={600}>{STATS_COPY.sourceApp}</Text>
                    <Group justify="space-between" align="baseline">
                      <Text fz="2rem" fw={700}>
                        {stats.by_source.app}
                      </Text>
                      <Text c="dimmed">
                        {getSourcePercentage(stats.by_source.app, stats.bookings_count)}%
                      </Text>
                    </Group>
                    <Progress
                      value={getSourcePercentage(stats.by_source.app, stats.bookings_count)}
                      color="red"
                      radius="xl"
                    />
                  </Stack>
                </Card>

                <Card withBorder radius="lg" padding="md">
                  <Stack gap="sm">
                    <Text fw={600}>{STATS_COPY.sourceWalkIn}</Text>
                    <Group justify="space-between" align="baseline">
                      <Text fz="2rem" fw={700}>
                        {stats.by_source.walk_in}
                      </Text>
                      <Text c="dimmed">
                        {getSourcePercentage(stats.by_source.walk_in, stats.bookings_count)}%
                      </Text>
                    </Group>
                    <Progress
                      value={getSourcePercentage(stats.by_source.walk_in, stats.bookings_count)}
                      color="orange"
                      radius="xl"
                    />
                  </Stack>
                </Card>
              </SimpleGrid>
            </Stack>
          </Card>

          {stats.by_staff.length > 0 ? (
            <Card withBorder radius="xl" padding="lg">
              <Stack gap="lg">
                <Title order={3}>{STATS_COPY.byStaffTitle}</Title>
                <Table.ScrollContainer minWidth={480}>
                  <Table highlightOnHover striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{STATS_COPY.byStaffName}</Table.Th>
                        <Table.Th>{STATS_COPY.byStaffBookings}</Table.Th>
                        <Table.Th>{STATS_COPY.byStaffShowRate}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {stats.by_staff.map((staff) => (
                        <Table.Tr key={staff.staff_id}>
                          <Table.Td>{staff.staff_name}</Table.Td>
                          <Table.Td>{staff.bookings_count}</Table.Td>
                          <Table.Td>{staff.show_rate_pct}%</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Stack>
            </Card>
          ) : null}
        </Stack>
      )}
    </div>
  );
};
