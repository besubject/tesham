import React, { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Group,
  NativeSelect,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, type UserLanguage } from '@mettig/shared';
import styles from './ProfilePage.module.scss';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);

  const [name, setName] = useState(user?.name || '');
  const [language, setLanguage] = useState<UserLanguage>(user?.language || 'ru');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введите имя');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateProfile({ name: name.trim(), language });
      setSuccess('Профиль обновлен');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Не удалось обновить профиль');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    try {
      await logout();
      navigate('/login');
    } catch {
      setError('Не удалось выйти');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteAccount();
      navigate('/login');
    } catch {
      setError('Не удалось удалить аккаунт');
      setLoading(false);
    }
  };

  return (
    <div className={styles.profilePage}>
      <Stack gap="xs">
        <Title order={1}>Профиль</Title>
        <Text c="dimmed">Управление вашим профилем</Text>
      </Stack>

      <Stack gap="lg">
        <Card withBorder radius="xl" padding="xl">
          <Stack gap="lg">
            <Title order={3}>Информация профиля</Title>

            <form onSubmit={handleUpdateProfile}>
              <Stack gap="md">
                <TextInput
                  label="Номер телефона"
                  value={user?.phone || ''}
                  disabled
                  readOnly
                  description="Телефон невозможно изменить"
                />

                <TextInput
                  label="Ваше имя"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  placeholder="Введите ваше имя"
                  disabled={loading}
                />

                <NativeSelect
                  label="Язык интерфейса"
                  value={language}
                  onChange={(e) => setLanguage(e.currentTarget.value as UserLanguage)}
                  data={[
                    { value: 'ru', label: 'Русский' },
                    { value: 'ce', label: 'Чеченский' },
                  ]}
                  disabled={loading}
                />

                {error ? (
                  <Alert color="red" variant="light">
                    {error}
                  </Alert>
                ) : null}

                {success ? (
                  <Alert color="teal" variant="light">
                    {success}
                  </Alert>
                ) : null}

                <Button type="submit" loading={loading} align-self="flex-start">
                  Сохранить изменения
                </Button>
              </Stack>
            </form>
          </Stack>
        </Card>

        <Card withBorder radius="xl" padding="xl" className={styles.dangerZone}>
          <Stack gap="lg">
            <Title order={3}>Безопасность</Title>

            <Stack gap="xs">
              <Text fw={600}>Выход из аккаунта</Text>
              <Text size="sm" c="dimmed">
                Завершить текущую сессию в веб-кабинете.
              </Text>
              <Group>
                <Button variant="light" color="gray" onClick={handleLogout} loading={loading}>
                  Выход
                </Button>
              </Group>
            </Stack>

            <Stack gap="xs">
              <Text fw={600}>Удаление аккаунта</Text>
              <Text size="sm" c="dimmed">
                Это действие необратимо. Все ваши данные будут удалены.
              </Text>

              {!showDeleteConfirm ? (
                <Group>
                  <Button
                    variant="light"
                    color="red"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={loading}
                  >
                    Удалить аккаунт
                  </Button>
                </Group>
              ) : (
                <Alert color="red" variant="light" title="Подтверждение удаления">
                  <Stack gap="md">
                    <Text size="sm">Вы уверены? Это действие необратимо.</Text>
                    <Group>
                      <Button
                        variant="default"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={loading}
                      >
                        Отмена
                      </Button>
                      <Button color="red" onClick={handleDeleteAccount} loading={loading}>
                        Да, удалить
                      </Button>
                    </Group>
                  </Stack>
                </Alert>
              )}
            </Stack>
          </Stack>
        </Card>
      </Stack>
    </div>
  );
};

export default ProfilePage;
