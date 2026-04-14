import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CopyButton,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { apiClient } from '@mettig/shared';
import type { BusinessDetailDto, StaffItemDto } from '@mettig/shared';
import styles from './index.module.scss';
import { LINK_PAGE_BASE_URL, LINK_PAGE_SLUG_REGEX } from './constants';
import { ProfileResponse, StaffResponse } from './types';

export const BusinessLinkPage = () => {
  const [profile, setProfile] = useState<BusinessDetailDto | null>(null);
  const [staff, setStaff] = useState<StaffItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slugInput, setSlugInput] = useState('');
  const [slugEditMode, setSlugEditMode] = useState(false);
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugSuccess, setSlugSuccess] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [profileRes, staffRes] = await Promise.all([
          apiClient.get<ProfileResponse>('/business/profile'),
          apiClient.get<StaffResponse>('/business/staff'),
        ]);
        setProfile(profileRes.data.profile);
        setStaff(staffRes.data.staff);
      } catch {
        setError('Не удалось загрузить данные');
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, []);

  const handleOpenSlugEdit = () => {
    setSlugInput(profile?.slug ?? '');
    setSlugError(null);
    setSlugSuccess(false);
    setSlugEditMode(true);
  };

  const handleSaveSlug = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = slugInput.trim().toLowerCase();
    if (!LINK_PAGE_SLUG_REGEX.test(slug)) {
      setSlugError('Допускаются только строчные буквы a–z, цифры 0–9 и дефис (3–50 символов)');
      return;
    }
    setSlugSaving(true);
    setSlugError(null);
    try {
      const { data } = await apiClient.patch<ProfileResponse>('/business/profile', { slug });
      setProfile(data.profile);
      setSlugEditMode(false);
      setSlugSuccess(true);
      setTimeout(() => setSlugSuccess(false), 3000);
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
      if (code === 'SLUG_CONFLICT') {
        setSlugError('Этот адрес уже занят. Попробуйте другой');
      } else {
        setSlugError('Не удалось сохранить ссылку');
      }
    } finally {
      setSlugSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.centered}>
        <Loader size="md" color="teal" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={styles.centered}>
        <Text c="red">{error ?? 'Профиль не найден'}</Text>
      </div>
    );
  }

  const businessUrl = profile.slug ? `${LINK_PAGE_BASE_URL}/b/${profile.slug}` : null;

  return (
    <div className={styles.linkPage}>
      <Stack gap="xs">
        <Title order={1}>Ссылка для записи</Title>
        <Text c="dimmed">
          Поделитесь ссылкой с клиентами — они смогут записаться без приложения
        </Text>
      </Stack>

      <Stack gap="lg">
        {/* Ссылка заведения */}
        <Card withBorder radius="xl" padding="xl">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Title order={3}>Ссылка заведения</Title>
              <Button variant="light" size="xs" onClick={handleOpenSlugEdit}>
                Изменить адрес
              </Button>
            </Group>

            {businessUrl ? (
              <Stack gap="xs">
                <div className={styles.urlBox}>
                  <Text size="sm" fw={500} c="teal" className={styles.urlText}>
                    {businessUrl}
                  </Text>
                  <Group gap="xs">
                    <CopyButton value={businessUrl} timeout={2000}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Скопировано!' : 'Копировать'} withArrow>
                          <Button
                            size="xs"
                            variant={copied ? 'filled' : 'light'}
                            color={copied ? 'teal' : 'gray'}
                            onClick={copy}
                          >
                            {copied ? 'Скопировано!' : 'Копировать'}
                          </Button>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>
                </div>
              </Stack>
            ) : (
              <Alert color="yellow" variant="light">
                Ссылка ещё не задана. Нажмите «Изменить адрес», чтобы задать уникальный адрес
                страницы.
              </Alert>
            )}

            {slugSuccess ? (
              <Alert color="teal" variant="light">
                Ссылка обновлена
              </Alert>
            ) : null}

            {/* Форма редактирования slug */}
            {slugEditMode && (
              <Card withBorder radius="md" padding="md" className={styles.editSlugCard}>
                <form onSubmit={handleSaveSlug}>
                  <Stack gap="md">
                    <Text size="sm" c="dimmed">
                      {LINK_PAGE_BASE_URL}/b/
                      <Text span c="dark" fw={500}>
                        {slugInput || 'my-barbershop'}
                      </Text>
                    </Text>
                    <TextInput
                      label="Адрес страницы"
                      description="Только строчные буквы a–z, цифры 0–9 и дефис (3–50 символов)"
                      placeholder="my-barbershop"
                      value={slugInput}
                      onChange={(e) => setSlugInput(e.currentTarget.value.toLowerCase())}
                      error={slugError}
                      disabled={slugSaving}
                      autoComplete="off"
                    />
                    <Group>
                      <Button
                        variant="default"
                        onClick={() => setSlugEditMode(false)}
                        disabled={slugSaving}
                      >
                        Отмена
                      </Button>
                      <Button type="submit" color="teal" loading={slugSaving}>
                        Сохранить
                      </Button>
                    </Group>
                  </Stack>
                </form>
              </Card>
            )}
          </Stack>
        </Card>

        {/* Персональные ссылки мастеров */}
        {businessUrl && staff.length > 0 && (
          <Card withBorder radius="xl" padding="xl">
            <Stack gap="md">
              <Title order={3}>Ссылки мастеров</Title>
              <Text size="sm" c="dimmed">
                Каждый мастер может поделиться персональной ссылкой — клиент сразу попадёт к нему
              </Text>
              <Stack gap="xs">
                {staff.map((member) => {
                  const staffUrl = `${LINK_PAGE_BASE_URL}/b/${profile.slug}/${member.id}`;
                  return (
                    <div key={member.id} className={styles.staffRow}>
                      <Stack gap={2} className={styles.staffInfo}>
                        <Text size="sm" fw={600}>
                          {member.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {staffUrl}
                        </Text>
                      </Stack>
                      <CopyButton value={staffUrl} timeout={2000}>
                        {({ copied, copy }) => (
                          <Tooltip label={copied ? 'Скопировано!' : 'Копировать'} withArrow>
                            <Button
                              size="xs"
                              variant={copied ? 'filled' : 'light'}
                              color={copied ? 'teal' : 'gray'}
                              onClick={copy}
                            >
                              {copied ? '✓' : 'Копировать'}
                            </Button>
                          </Tooltip>
                        )}
                      </CopyButton>
                    </div>
                  );
                })}
              </Stack>
            </Stack>
          </Card>
        )}
      </Stack>
    </div>
  );
};

export default BusinessLinkPage;
