import React, { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Group,
  Input,
  Loader,
  Paper,
  PinInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiClient, initI18n, sendCode, useTranslation } from '@mettig/shared';
import { IMaskInput } from 'react-imask';
import { PHONE_MASK } from 'src/constants';
import styles from './index.module.scss';
import { buildDays, PUBLIC_BOOKING_DAYS_COUNT } from './constants';
import { BookingStep, BusinessData, SlotItem } from './types';
import { findStaffBySlug, formatDuration, formatPrice, getPhoneDigits, setOgTags } from './utils';

// ─── Component ────────────────────────────────────────────────────────────────

const DAYS = buildDays(PUBLIC_BOOKING_DAYS_COUNT);

export function PublicBookingPage(): React.JSX.Element {
  const { slug, staffSlug } = useParams<{ slug: string; staffSlug?: string }>();
  const [searchParams] = useSearchParams();

  // i18n — detect lang from ?lang=ce query param
  const lang = searchParams.get('lang') === 'ce' ? 'ce' : 'ru';
  useEffect(() => {
    initI18n(lang);
  }, [lang]);

  const { t } = useTranslation();

  // Booking flow state
  const [step, setStep] = useState<BookingStep>('staff');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(DAYS[0]?.value ?? '');
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);

  // Verify step
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [smsStep, setSmsStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneDigits = getPhoneDigits(phone);
  const isPhoneValid = phoneDigits.length === 10;
  const isCodeValid = code.length === 6;

  // ── Fetch business ──────────────────────────────────────────────────────────

  const {
    data: business,
    isLoading: businessLoading,
    isError: businessError,
  } = useQuery<BusinessData>({
    queryKey: ['public-business', slug],
    queryFn: async () => {
      const { data } = await apiClient.get<{ business: BusinessData }>(
        `/public/business/${slug ?? ''}`,
        { headers: { 'Accept-Language': lang } },
      );
      return data.business;
    },
    enabled: !!slug,
    retry: false,
  });

  // Pre-select staff from URL param
  useEffect(() => {
    if (business && staffSlug) {
      const found = findStaffBySlug(business.staff, staffSlug);
      if (found) {
        setSelectedStaffId(found.id);
        setStep('service');
      }
    }
  }, [business, staffSlug]);

  // ── OG tags ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (business) {
      const image = business.photos?.[0] ?? null;
      setOgTags(
        `${business.name} — запись онлайн | Mettig`,
        `${business.category_name} · ${business.address}. Онлайн-запись через Mettig.`,
        image,
      );
    }
    return () => {
      document.title = 'Mettig Business';
    };
  }, [business]);

  // ── Fetch slots ─────────────────────────────────────────────────────────────

  const { data: slots = [], isLoading: slotsLoading } = useQuery<SlotItem[]>({
    queryKey: ['public-slots', slug, selectedStaffId, selectedDate],
    queryFn: async () => {
      const params: Record<string, string> = { date: selectedDate };
      if (selectedStaffId) params['staff_id'] = selectedStaffId;
      const { data } = await apiClient.get<{ slots: SlotItem[] }>(
        `/public/business/${slug ?? ''}/slots`,
        { params },
      );
      return data.slots.filter((s) => !s.is_booked);
    },
    enabled: !!slug && step === 'datetime',
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSendCode = async () => {
    if (!isPhoneValid) {
      setError(t('auth.invalidPhone'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendCode(`+7${phoneDigits}`);
      setSmsStep('code');
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBooking = async () => {
    if (!isCodeValid) {
      setError(t('auth.invalidCode'));
      return;
    }
    if (!selectedSlot || !selectedServiceId || !slug) return;

    setLoading(true);
    setError(null);
    try {
      await apiClient.post('/public/bookings', {
        slug,
        staff_id: selectedSlot.staff_id,
        service_id: selectedServiceId,
        slot_id: selectedSlot.id,
        phone: `+7${phoneDigits}`,
        code,
        name: name.trim() || undefined,
      });
      setStep('done');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { code?: string } } };
      const errCode = axiosErr.response?.data?.code;
      if (errCode === 'INVALID_CODE') {
        setError(t('auth.invalidCode'));
      } else if (errCode === 'CODE_EXPIRED') {
        setError(t('auth.codeExpired'));
      } else {
        setError(t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('staff');
    setSelectedStaffId(null);
    setSelectedServiceId(null);
    setSelectedDate(DAYS[0]?.value ?? '');
    setSelectedSlot(null);
    setPhone('');
    setName('');
    setCode('');
    setSmsStep('phone');
    setError(null);
  };

  // ── Render helpers ───────────────────────────────────────────────────────────

  if (businessLoading) {
    return (
      <Box className={styles.centered}>
        <Loader size="lg" />
      </Box>
    );
  }

  if (businessError || !business) {
    return (
      <Box className={styles.centered}>
        <Stack align="center" gap="md">
          <Text fz={48}>🔍</Text>
          <Title order={2}>{t('publicBooking.notFound')}</Title>
          <Text c="dimmed">{t('publicBooking.notFoundMessage')}</Text>
        </Stack>
      </Box>
    );
  }

  const selectedStaff = business.staff.find((s) => s.id === selectedStaffId) ?? null;
  const selectedService = business.services.find((s) => s.id === selectedServiceId) ?? null;

  const stepIndex: Record<BookingStep, number> = {
    staff: 0,
    service: 1,
    datetime: 2,
    verify: 3,
    done: 4,
  };

  // ── Step content ─────────────────────────────────────────────────────────────

  const renderStepStaff = () => (
    <Stack gap="sm">
      <Title order={3}>{t('booking.selectMaster')}</Title>

      {/* Any master */}
      <UnstyledButton
        className={`${styles.staffCard} ${selectedStaffId === null ? styles.selected : ''}`}
        onClick={() => {
          setSelectedStaffId(null);
          setStep('service');
        }}
      >
        <Group gap="sm">
          <Avatar size={48} color="teal">
            ★
          </Avatar>
          <div>
            <Text fw={500}>{t('publicBooking.anyMaster')}</Text>
          </div>
        </Group>
      </UnstyledButton>

      {business.staff.map((member) => (
        <UnstyledButton
          key={member.id}
          className={`${styles.staffCard} ${selectedStaffId === member.id ? styles.selected : ''}`}
          onClick={() => {
            setSelectedStaffId(member.id);
            setStep('service');
          }}
        >
          <Group gap="sm">
            <Avatar src={member.avatar_url ?? undefined} size={48} color="teal">
              {member.name[0]}
            </Avatar>
            <div>
              <Text fw={500}>{member.name}</Text>
              {member.role ? (
                <Text size="sm" c="dimmed">
                  {member.role}
                </Text>
              ) : null}
            </div>
          </Group>
        </UnstyledButton>
      ))}
    </Stack>
  );

  const renderStepService = () => (
    <Stack gap="sm">
      <Group gap="xs">
        <Button variant="subtle" size="xs" onClick={() => setStep('staff')}>
          ← {t('common.back')}
        </Button>
        <Title order={3}>{t('booking.selectService')}</Title>
      </Group>

      {business.services.map((service) => (
        <UnstyledButton
          key={service.id}
          className={`${styles.serviceCard} ${selectedServiceId === service.id ? styles.selected : ''}`}
          onClick={() => {
            setSelectedServiceId(service.id);
            setStep('datetime');
          }}
        >
          <Group justify="space-between">
            <div>
              <Text fw={500}>{service.name}</Text>
              <Text size="sm" c="dimmed">
                {formatDuration(service.duration_minutes)}
              </Text>
            </div>
            <Text fw={600} c="teal">
              {formatPrice(service.price)}
            </Text>
          </Group>
        </UnstyledButton>
      ))}
    </Stack>
  );

  const renderStepDatetime = () => (
    <Stack gap="md">
      <Group gap="xs">
        <Button variant="subtle" size="xs" onClick={() => setStep('service')}>
          ← {t('common.back')}
        </Button>
        <Title order={3}>{t('booking.selectDate')}</Title>
      </Group>

      {/* Date picker strip */}
      <div className={styles.dateStrip}>
        {DAYS.map((day) => (
          <UnstyledButton
            key={day.value}
            className={`${styles.dayChip} ${selectedDate === day.value ? styles.selected : ''}`}
            onClick={() => {
              setSelectedDate(day.value);
              setSelectedSlot(null);
            }}
          >
            {day.label}
          </UnstyledButton>
        ))}
      </div>

      {/* Slots */}
      <Title order={4}>{t('booking.selectSlot')}</Title>

      {slotsLoading ? (
        <Box className={styles.centered} style={{ minHeight: 80 }}>
          <Loader size="sm" />
        </Box>
      ) : slots.length === 0 ? (
        <Text c="dimmed" ta="center" py="md">
          {t('booking.noSlots')}
        </Text>
      ) : (
        <SimpleGrid cols={4} spacing="xs">
          {slots.map((slot) => (
            <UnstyledButton
              key={slot.id}
              className={`${styles.slotChip} ${selectedSlot?.id === slot.id ? styles.selected : ''}`}
              onClick={() => setSelectedSlot(slot)}
            >
              {slot.start_time}
            </UnstyledButton>
          ))}
        </SimpleGrid>
      )}

      {selectedSlot ? (
        <Button fullWidth size="md" color="teal" onClick={() => setStep('verify')}>
          {t('common.next')} →
        </Button>
      ) : null}
    </Stack>
  );

  const renderStepVerify = () => (
    <Stack gap="md">
      <Group gap="xs">
        <Button variant="subtle" size="xs" onClick={() => setStep('datetime')}>
          ← {t('common.back')}
        </Button>
        <Title order={3}>{t('booking.confirmTitle')}</Title>
      </Group>

      {/* Summary card */}
      <Card withBorder radius="md" p="md">
        <Stack gap={4}>
          {selectedStaff ? (
            <Group gap="xs">
              <Text size="sm" c="dimmed" w={80}>
                Мастер:
              </Text>
              <Text size="sm" fw={500}>
                {selectedStaff.name}
              </Text>
            </Group>
          ) : null}
          {selectedService ? (
            <Group gap="xs">
              <Text size="sm" c="dimmed" w={80}>
                Услуга:
              </Text>
              <Text size="sm" fw={500}>
                {selectedService.name}
              </Text>
            </Group>
          ) : null}
          {selectedSlot ? (
            <Group gap="xs">
              <Text size="sm" c="dimmed" w={80}>
                Время:
              </Text>
              <Text size="sm" fw={500}>
                {selectedDate}, {selectedSlot.start_time}
              </Text>
            </Group>
          ) : null}
          {selectedService ? (
            <Group gap="xs">
              <Text size="sm" c="dimmed" w={80}>
                Цена:
              </Text>
              <Text size="sm" fw={600} c="teal">
                {formatPrice(selectedService.price)}
              </Text>
            </Group>
          ) : null}
        </Stack>
      </Card>

      {/* SMS verification */}
      {smsStep === 'phone' ? (
        <Stack gap="sm">
          <Input
            component={IMaskInput}
            mask={PHONE_MASK}
            label={t('auth.phoneLabel')}
            placeholder="+7 (___) ___-__-__"
            value={phone}
            onAccept={(value: unknown) => {
              setPhone(String(value));
              if (error) setError(null);
            }}
            disabled={loading}
            size="md"
            inputMode="tel"
            autoFocus
          />
          <TextInput
            label={t('publicBooking.yourName')}
            placeholder={t('publicBooking.yourNamePlaceholder')}
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            disabled={loading}
            size="md"
          />
          {error ? (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          ) : null}
          <Button
            fullWidth
            size="md"
            color="teal"
            loading={loading}
            disabled={!isPhoneValid}
            onClick={handleSendCode}
          >
            {t('auth.sendCode')}
          </Button>
        </Stack>
      ) : (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {t('publicBooking.codeFrom')} +7{phoneDigits}
          </Text>
          <PinInput
            length={6}
            oneTimeCode
            type="number"
            autoFocus
            value={code}
            onChange={(value: string) => {
              setCode(value);
              if (error) setError(null);
            }}
            disabled={loading}
            size="md"
          />
          {error ? (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          ) : null}
          <Button
            fullWidth
            size="md"
            color="teal"
            loading={loading}
            disabled={!isCodeValid}
            onClick={handleCreateBooking}
          >
            {t('booking.confirmButton')}
          </Button>
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => {
              setSmsStep('phone');
              setCode('');
              setError(null);
            }}
            disabled={loading}
            styles={{ root: { alignSelf: 'center' } }}
          >
            ← Изменить номер
          </Button>
        </Stack>
      )}
    </Stack>
  );

  const renderStepDone = () => (
    <Stack gap="xl" align="center">
      <Text fz={64} ta="center">
        ✅
      </Text>
      <Stack gap="xs" align="center">
        <Title order={2} ta="center">
          {t('booking.successTitle')}
        </Title>
        <Text c="dimmed" ta="center">
          {t('booking.successMessage')}
        </Text>
      </Stack>

      {/* Download CTA */}
      <Paper withBorder radius="xl" p="lg" w="100%">
        <Stack gap="sm" align="center">
          <Text fw={600} ta="center">
            {t('publicBooking.downloadApp')}
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            {t('publicBooking.downloadHint')}
          </Text>
          <Group gap="sm" justify="center">
            <Button
              component="a"
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              variant="filled"
              color="dark"
              size="sm"
              leftSection="🍎"
            >
              {t('publicBooking.appStore')}
            </Button>
            <Button
              component="a"
              href="https://play.google.com"
              target="_blank"
              rel="noopener noreferrer"
              variant="filled"
              color="dark"
              size="sm"
              leftSection="▶"
            >
              {t('publicBooking.googlePlay')}
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Button variant="subtle" color="teal" onClick={handleReset}>
        {t('booking.bookAgain')}
      </Button>
    </Stack>
  );

  // ── Main render ──────────────────────────────────────────────────────────────

  const currentStepIndex = stepIndex[step];

  return (
    <Box className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        {business.photos?.[0] ? (
          <img
            src={business.photos[0]}
            alt={business.name}
            className={styles.heroImage}
            loading="lazy"
          />
        ) : (
          <div className={styles.heroPlaceholder} />
        )}
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <Text size="sm" c="white" opacity={0.85}>
            {business.category_icon} {business.category_name}
          </Text>
          <Title order={1} c="white">
            {business.name}
          </Title>
          <Text size="sm" c="white" opacity={0.85}>
            📍 {business.address}
          </Text>
          {business.avg_rating !== null ? (
            <Text size="sm" c="white" opacity={0.85}>
              ⭐ {business.avg_rating} ({business.review_count} {t('business.reviews')})
            </Text>
          ) : null}
        </div>
      </div>

      {/* Step indicator */}
      {step !== 'done' ? (
        <div className={styles.stepBar}>
          {(['staff', 'service', 'datetime', 'verify'] as const).map((s, i) => (
            <div
              key={s}
              className={`${styles.stepDot} ${i <= currentStepIndex ? styles.stepActive : ''}`}
            />
          ))}
        </div>
      ) : null}

      {/* Content */}
      <div className={styles.content}>
        {step === 'staff' && renderStepStaff()}
        {step === 'service' && renderStepService()}
        {step === 'datetime' && renderStepDatetime()}
        {step === 'verify' && renderStepVerify()}
        {step === 'done' && renderStepDone()}
      </div>
    </Box>
  );
}
