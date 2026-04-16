import { Modal, Stack, Select, TextInput, Switch, Group, Button, Text, Input } from '@mantine/core';
import { apiClient, trackEvent } from '@mettig/shared';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { IMaskInput } from 'react-imask';
import { PHONE_MASK } from 'src/constants';
import { WalkInModalProps, StaffListDto, ServicesListDto, CurrentStaffDto } from './types';
import { normalizePhone } from './utils';

export const WalkInModal = ({ opened, onClose, onCreated }: WalkInModalProps) => {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: staffData } = useQuery<StaffListDto>({
    queryKey: ['business-staff'],
    queryFn: async () => {
      const { data } = await apiClient.get<StaffListDto>('/business/staff');
      return data;
    },
    enabled: opened,
  });

  const { data: currentStaffData } = useQuery<CurrentStaffDto>({
    queryKey: ['business-staff-me'],
    queryFn: async () => {
      const { data } = await apiClient.get<CurrentStaffDto>('/business/staff/me');
      return data;
    },
    enabled: opened,
  });

  const { data: servicesData } = useQuery<ServicesListDto>({
    queryKey: ['business-services'],
    queryFn: async () => {
      const { data } = await apiClient.get<ServicesListDto>('/business/services');
      return data;
    },
    enabled: opened,
  });

  const staffOptions = (staffData?.staff ?? []).map((s) => ({ value: s.id, label: s.name }));
  const serviceOptions = (servicesData?.services ?? []).map((s) => ({
    value: s.id,
    label: `${s.name} — ${s.price.toLocaleString('ru-RU')} ₽`,
  }));
  const currentStaff = currentStaffData?.staff ?? null;
  const isAdmin = currentStaff?.role === 'admin';

  useEffect(() => {
    if (opened) {
      void trackEvent({ event_type: 'walk_in_form_opened' });
    }
  }, [opened]);

  useEffect(() => {
    if (!opened || !currentStaff) return;

    if (isAdmin) {
      setStaffId((prev) => prev ?? staffData?.staff[0]?.id ?? null);
    } else {
      setStaffId(currentStaff.id);
    }
  }, [currentStaff, isAdmin, opened, staffData]);

  const handleSubmit = async () => {
    if (!serviceId) {
      setError('Выберите услугу');
      return;
    }
    if (!staffId) {
      setError('Выберите мастера');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const normalizedPhone = normalizePhone(clientPhone.trim());

      await apiClient.post('/business/bookings/walk-in', {
        staff_id: staffId,
        service_id: serviceId,
        client_name: clientName.trim() || undefined,
        client_phone: normalizedPhone,
        time: useCustomTime && customTime ? customTime : undefined,
      });
      await trackEvent({
        event_type: 'walk_in_booking_created',
        payload: { has_phone: Boolean(clientPhone.trim()) },
      });
      // Reset form
      setStaffId(null);
      setServiceId(null);
      setClientName('');
      setClientPhone('');
      setUseCustomTime(false);
      setCustomTime('');
      setError(null);
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Не удалось добавить клиента');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Оффлайн-клиент" size="md" centered>
      <Stack gap="md">
        {isAdmin ? (
          <Select
            label="Мастер"
            placeholder="Выберите мастера"
            data={staffOptions}
            value={staffId}
            onChange={setStaffId}
            required
          />
        ) : (
          <Stack gap={2}>
            <Text size="sm" fw={500}>
              Мастер
            </Text>
            <Text size="sm" c="dimmed">
              {currentStaff?.name}
            </Text>
          </Stack>
        )}

        <Select
          label="Услуга"
          placeholder="Выберите услугу"
          data={serviceOptions}
          value={serviceId}
          onChange={setServiceId}
          required
        />

        <TextInput
          label="Имя клиента (необязательно)"
          placeholder="Клиент"
          value={clientName}
          onChange={(e) => setClientName(e.currentTarget.value)}
        />

        <Input
          component={IMaskInput}
          mask={PHONE_MASK}
          label="Телефон (необязательно)"
          placeholder="+7 (___) ___-__-__"
          value={clientPhone}
          onChange={(e) => setClientPhone(e.currentTarget.value)}
        />

        <Switch
          label="Указать конкретное время"
          checked={useCustomTime}
          onChange={(e) => setUseCustomTime(e.currentTarget.checked)}
        />

        {useCustomTime && (
          <TextInput
            label="Время (ЧЧ:ММ)"
            placeholder="14:30"
            value={customTime}
            onChange={(e) => setCustomTime(e.currentTarget.value)}
            maxLength={5}
          />
        )}

        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}

        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button color="teal" loading={submitting} onClick={() => void handleSubmit()}>
            Добавить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
