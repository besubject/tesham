import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, tokenStorage, trackEvent } from '@mettig/shared';
import type { BusinessDetailDto, ServiceItemDto, StaffItemDto } from '@mettig/shared';
import type { BusinessProfileStackScreenProps } from '../../navigation/types';

type Props = BusinessProfileStackScreenProps<'ProfileMain'>;

const BASE_URL = 'https://mettig.ru';
const SLUG_REGEX = /^[a-z0-9-]{3,50}$/;

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Day = (typeof DAYS)[number];
const DAY_LABELS: Record<Day, string> = {
  mon: 'Пн',
  tue: 'Вт',
  wed: 'Ср',
  thu: 'Чт',
  fri: 'Пт',
  sat: 'Сб',
  sun: 'Вс',
};

type WorkingHoursValue = { open: string; close: string } | string | null;

function normalizeDayHours(value: WorkingHoursValue): { open: string; close: string } | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const [open, close] = value.split('-').map((part) => part.trim());
    if (!open || !close) return null;
    return { open, close };
  }
  if (typeof value.open !== 'string' || typeof value.close !== 'string') return null;
  return { open: value.open, close: value.close };
}

function normalizeWorkingHours(
  value: Record<string, WorkingHoursValue> | null | undefined,
): Record<Day, { open: string; close: string } | null> {
  const source = value ?? {};
  return {
    mon: normalizeDayHours(source['mon'] ?? null),
    tue: normalizeDayHours(source['tue'] ?? null),
    wed: normalizeDayHours(source['wed'] ?? null),
    thu: normalizeDayHours(source['thu'] ?? null),
    fri: normalizeDayHours(source['fri'] ?? null),
    sat: normalizeDayHours(source['sat'] ?? null),
    sun: normalizeDayHours(source['sun'] ?? null),
  };
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function decodeJwtRole(token: string): 'admin' | 'employee' | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as { role?: string };
    if (payload.role === 'admin' || payload.role === 'employee') return payload.role;
    return null;
  } catch {
    return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

function SectionCard({ title, children, action }: SectionCardProps): React.JSX.Element {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

interface FieldRowProps {
  label: string;
  value: string;
  editMode: boolean;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'url';
}

function FieldRow({
  label,
  value,
  editMode,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: FieldRowProps): React.JSX.Element {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editMode ? (
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? label}
          placeholderTextColor="#B0B0AA"
          keyboardType={keyboardType}
          autoCapitalize="none"
        />
      ) : (
        <Text style={styles.fieldValue} numberOfLines={2}>
          {value || '—'}
        </Text>
      )}
    </View>
  );
}

interface ServiceRowProps {
  item: ServiceItemDto;
  isAdmin: boolean;
  onEdit: (item: ServiceItemDto) => void;
  onDelete: (id: string) => void;
}

function ServiceRow({ item, isAdmin, onEdit, onDelete }: ServiceRowProps): React.JSX.Element {
  return (
    <View style={styles.listRow}>
      <View style={styles.listRowInfo}>
        <Text style={styles.listRowName}>{item.name}</Text>
        <Text style={styles.listRowSub}>
          {item.price} ₽ · {item.duration_minutes} мин
        </Text>
      </View>
      {isAdmin && (
        <View style={styles.listRowActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onEdit(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.iconBtnText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onDelete(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.iconBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

interface StaffRowProps {
  item: StaffItemDto;
  isAdmin: boolean;
  onDelete: (id: string) => void;
}

function StaffRow({ item, isAdmin, onDelete }: StaffRowProps): React.JSX.Element {
  return (
    <View style={styles.listRow}>
      <View style={styles.listRowInfo}>
        <Text style={styles.listRowName}>{item.name}</Text>
        <Text style={styles.listRowSub}>{item.role === 'admin' ? 'Администратор' : 'Сотрудник'}</Text>
      </View>
      {isAdmin && (
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => onDelete(item.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.iconBtnText}>🗑</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type EditFields = {
  name: string;
  address: string;
  phone: string;
  instagram_url: string;
  website_url: string;
  cancellation_threshold_minutes: string;
  remind_24h: boolean;
  remind_30min: boolean;
  working_hours: Record<Day, { open: string; close: string } | null>;
};

type ServiceFormState = {
  visible: boolean;
  editId: string | null;
  name: string;
  price: string;
  duration: string;
};

type StaffFormState = {
  visible: boolean;
  name: string;
  phone: string;
  role: 'admin' | 'employee';
};

export function BusinessProfileScreen(_props: Props): React.JSX.Element {
  const [profile, setProfile] = useState<BusinessDetailDto | null>(null);
  const [staff, setStaff] = useState<StaffItemDto[]>([]);
  const [services, setServices] = useState<ServiceItemDto[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [slugEditMode, setSlugEditMode] = useState(false);
  const [slugInput, setSlugInput] = useState('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<EditFields>({
    name: '',
    address: '',
    phone: '',
    instagram_url: '',
    website_url: '',
    cancellation_threshold_minutes: '0',
    remind_24h: true,
    remind_30min: true,
    working_hours: {
      mon: { open: '09:00', close: '18:00' },
      tue: { open: '09:00', close: '18:00' },
      wed: { open: '09:00', close: '18:00' },
      thu: { open: '09:00', close: '18:00' },
      fri: { open: '09:00', close: '18:00' },
      sat: null,
      sun: null,
    },
  });

  const [serviceForm, setServiceForm] = useState<ServiceFormState>({
    visible: false,
    editId: null,
    name: '',
    price: '',
    duration: '',
  });

  const [staffForm, setStaffForm] = useState<StaffFormState>({
    visible: false,
    name: '',
    phone: '',
    role: 'employee',
  });

  // ─── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const token = await tokenStorage.getAccessToken();
      if (token) setIsAdmin(decodeJwtRole(token) === 'admin');

      const [profileRes, staffRes, servicesRes] = await Promise.all([
        apiClient.get<{ profile: BusinessDetailDto }>('/business/profile'),
        apiClient.get<{ staff: StaffItemDto[] }>('/business/staff'),
        apiClient.get<{ services: ServiceItemDto[] }>('/business/services'),
      ]);

      const p = profileRes.data.profile;
      setProfile(p);
      setStaff(staffRes.data.staff);
      setServices(servicesRes.data.services);

      const editHours = normalizeWorkingHours(
        p.working_hours as Record<string, WorkingHoursValue> | undefined,
      );

      setEditFields({
        name: p.name ?? '',
        address: p.address ?? '',
        phone: p.phone ?? '',
        instagram_url: p.instagram_url ?? '',
        website_url: p.website_url ?? '',
        cancellation_threshold_minutes: String(p.cancellation_threshold_minutes ?? 0),
        remind_24h: p.reminder_settings?.remind_24h ?? true,
        remind_30min: p.reminder_settings?.remind_30min ?? true,
        working_hours: editHours,
      });

      setError(null);
    } catch {
      setError('Не удалось загрузить профиль');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  // ─── Profile save ────────────────────────────────────────────────────────────

  const handleSaveProfile = useCallback(async () => {
    setSaving(true);
    try {
      const threshold = parseInt(editFields.cancellation_threshold_minutes, 10);
      const payload: Record<string, unknown> = {
        name: editFields.name.trim(),
        address: editFields.address.trim(),
        phone: editFields.phone.trim(),
        instagram_url: editFields.instagram_url.trim() || null,
        website_url: editFields.website_url.trim() || null,
        cancellation_threshold_minutes: isNaN(threshold) ? 0 : threshold,
        reminder_settings: {
          remind_24h: editFields.remind_24h,
          remind_30min: editFields.remind_30min,
        },
        working_hours: editFields.working_hours as Record<string, unknown>,
      };

      const { data } = await apiClient.patch<{ profile: BusinessDetailDto }>('/business/profile', payload);
      setProfile(data.profile);
      setEditMode(false);
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  }, [editFields]);

  const handleCancelEdit = useCallback(() => {
    if (!profile) return;
    setEditFields({
      name: profile.name ?? '',
      address: profile.address ?? '',
      phone: profile.phone ?? '',
      instagram_url: profile.instagram_url ?? '',
      website_url: profile.website_url ?? '',
      cancellation_threshold_minutes: String(profile.cancellation_threshold_minutes ?? 0),
      remind_24h: profile.reminder_settings?.remind_24h ?? true,
      remind_30min: profile.reminder_settings?.remind_30min ?? true,
      working_hours: normalizeWorkingHours(
        profile.working_hours as Record<string, WorkingHoursValue> | undefined,
      ),
    });
    setEditMode(false);
  }, [profile]);

  // ─── Services CRUD ───────────────────────────────────────────────────────────

  const handleOpenAddService = useCallback(() => {
    setServiceForm({ visible: true, editId: null, name: '', price: '', duration: '' });
  }, []);

  const handleOpenEditService = useCallback((item: ServiceItemDto) => {
    setServiceForm({
      visible: true,
      editId: item.id,
      name: item.name,
      price: String(item.price),
      duration: String(item.duration_minutes),
    });
  }, []);

  const handleSaveService = useCallback(async () => {
    const name = serviceForm.name.trim();
    const price = parseInt(serviceForm.price, 10);
    const duration = parseInt(serviceForm.duration, 10);

    if (!name || isNaN(price) || isNaN(duration) || price < 0 || duration < 1) {
      Alert.alert('Ошибка', 'Проверьте все поля услуги');
      return;
    }

    try {
      if (serviceForm.editId) {
        const { data } = await apiClient.patch<{ service: ServiceItemDto }>(
          `/business/services/${serviceForm.editId}`,
          { name, price, duration_minutes: duration },
        );
        setServices(prev => prev.map(s => (s.id === serviceForm.editId ? data.service : s)));
      } else {
        const { data } = await apiClient.post<{ service: ServiceItemDto }>('/business/services', {
          name,
          price,
          duration_minutes: duration,
        });
        setServices(prev => [...prev, data.service]);
      }
      setServiceForm({ visible: false, editId: null, name: '', price: '', duration: '' });
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить услугу');
    }
  }, [serviceForm]);

  const handleDeleteService = useCallback((id: string) => {
    Alert.alert('Удалить услугу?', 'Это действие нельзя отменить', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/business/services/${id}`);
            setServices(prev => prev.filter(s => s.id !== id));
          } catch {
            Alert.alert('Ошибка', 'Не удалось удалить услугу');
          }
        },
      },
    ]);
  }, []);

  // ─── Staff CRUD ──────────────────────────────────────────────────────────────

  const handleOpenAddStaff = useCallback(() => {
    setStaffForm({ visible: true, name: '', phone: '', role: 'employee' });
  }, []);

  const handleSaveStaff = useCallback(async () => {
    const name = staffForm.name.trim();
    const phone = staffForm.phone.trim();

    if (!name || !phone) {
      Alert.alert('Ошибка', 'Введите имя и телефон');
      return;
    }

    try {
      const { data } = await apiClient.post<{ staff: StaffItemDto }>('/business/staff', {
        name,
        phone,
        role: staffForm.role,
      });
      setStaff(prev => [...prev, data.staff]);
      setStaffForm({ visible: false, name: '', phone: '', role: 'employee' });
    } catch {
      Alert.alert('Ошибка', 'Не удалось добавить сотрудника');
    }
  }, [staffForm]);

  const handleDeleteStaff = useCallback((id: string) => {
    Alert.alert('Удалить сотрудника?', 'Это действие нельзя отменить', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/business/staff/${id}`);
            setStaff(prev => prev.filter(s => s.id !== id));
          } catch {
            Alert.alert('Ошибка', 'Не удалось удалить сотрудника');
          }
        },
      },
    ]);
  }, []);

  // ─── Public link handlers ────────────────────────────────────────────────────

  const handleCopyLink = useCallback(async (url: string, key: string) => {
    Clipboard.setString(url);
    setCopiedKey(key);
    void trackEvent({ event_type: 'link_copied', payload: { url } });
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const handleShareLink = useCallback(async (url: string) => {
    try {
      await Share.share({ message: url });
      void trackEvent({ event_type: 'link_shared', payload: { url } });
    } catch {
      // User cancelled share — no error needed
    }
  }, []);

  const handleOpenSlugEdit = useCallback(() => {
    setSlugInput(profile?.slug ?? '');
    setSlugError(null);
    setSlugEditMode(true);
  }, [profile]);

  const handleSaveSlug = useCallback(async () => {
    const slug = slugInput.trim().toLowerCase();
    if (!SLUG_REGEX.test(slug)) {
      setSlugError('Допускаются только строчные буквы a–z, цифры 0–9 и дефис (3–50 символов)');
      return;
    }
    setSlugSaving(true);
    setSlugError(null);
    try {
      const { data } = await apiClient.patch<{ profile: BusinessDetailDto }>('/business/profile', { slug });
      setProfile(data.profile);
      setSlugEditMode(false);
    } catch (err: unknown) {
      const status = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
      if (status === 'SLUG_CONFLICT') {
        setSlugError('Этот адрес уже занят. Попробуйте другой');
      } else {
        setSlugError('Не удалось сохранить ссылку');
      }
    } finally {
      setSlugSaving(false);
    }
  }, [slugInput]);

  // ─── Render states ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Профиль не найден'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); void loadData(); }}>
          <Text style={styles.retryBtnText}>Повторить</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const wh = editFields.working_hours;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Заведение</Text>
        {isAdmin && !editMode && (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditMode(true)} activeOpacity={0.7}>
            <Text style={styles.editBtnText}>Изменить</Text>
          </TouchableOpacity>
        )}
        {isAdmin && editMode && (
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelEdit} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={() => { void handleSaveProfile(); }}
              activeOpacity={0.7}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Сохранить</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* ── Основная информация ── */}
        <SectionCard title="Основная информация">
          <FieldRow
            label="Название"
            value={editMode ? editFields.name : (profile.name ?? '')}
            editMode={editMode}
            onChangeText={t => setEditFields(f => ({ ...f, name: t }))}
          />
          <FieldRow
            label="Адрес"
            value={editMode ? editFields.address : (profile.address ?? '')}
            editMode={editMode}
            onChangeText={t => setEditFields(f => ({ ...f, address: t }))}
          />
          <FieldRow
            label="Телефон"
            value={editMode ? editFields.phone : (profile.phone ?? '')}
            editMode={editMode}
            onChangeText={t => setEditFields(f => ({ ...f, phone: t }))}
            keyboardType="phone-pad"
          />
          <FieldRow
            label="Instagram"
            value={editMode ? editFields.instagram_url : (profile.instagram_url ?? '')}
            editMode={editMode}
            onChangeText={t => setEditFields(f => ({ ...f, instagram_url: t }))}
            placeholder="https://instagram.com/..."
            keyboardType="url"
          />
          <FieldRow
            label="Сайт"
            value={editMode ? editFields.website_url : (profile.website_url ?? '')}
            editMode={editMode}
            onChangeText={t => setEditFields(f => ({ ...f, website_url: t }))}
            placeholder="https://..."
            keyboardType="url"
          />
        </SectionCard>

        {/* ── Часы работы ── */}
        <SectionCard title="Часы работы">
          {DAYS.map(day => {
            const hours = wh[day];
            if (editMode) {
              return (
                <View key={day} style={styles.hoursRow}>
                  <Text style={styles.dayLabel}>{DAY_LABELS[day]}</Text>
                  <TouchableOpacity
                    style={[styles.dayToggle, hours !== null && styles.dayToggleActive]}
                    onPress={() =>
                      setEditFields(f => ({
                        ...f,
                        working_hours: {
                          ...f.working_hours,
                          [day]: hours !== null ? null : { open: '09:00', close: '18:00' },
                        },
                      }))
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayToggleText, hours !== null && styles.dayToggleTextActive]}>
                      {hours !== null ? 'Открыто' : 'Закрыто'}
                    </Text>
                  </TouchableOpacity>
                  {hours !== null && (
                    <View style={styles.hoursInputs}>
                      <TextInput
                        style={styles.timeInput}
                        value={hours.open}
                        onChangeText={t =>
                          setEditFields(f => ({
                            ...f,
                            working_hours: { ...f.working_hours, [day]: { open: t, close: hours.close } },
                          }))
                        }
                        placeholder="09:00"
                        placeholderTextColor="#B0B0AA"
                        maxLength={5}
                      />
                      <Text style={styles.timeSeparator}>–</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={hours.close}
                        onChangeText={t =>
                          setEditFields(f => ({
                            ...f,
                            working_hours: { ...f.working_hours, [day]: { open: hours.open, close: t } },
                          }))
                        }
                        placeholder="18:00"
                        placeholderTextColor="#B0B0AA"
                        maxLength={5}
                      />
                    </View>
                  )}
                </View>
              );
            }
            const profileHours = normalizeDayHours(
              (profile.working_hours as Record<string, WorkingHoursValue> | undefined)?.[day] ?? null,
            );
            return (
              <View key={day} style={styles.hoursRow}>
                <Text style={styles.dayLabel}>{DAY_LABELS[day]}</Text>
                <Text style={styles.hoursText}>
                  {profileHours !== null ? `${profileHours.open} – ${profileHours.close}` : 'Закрыто'}
                </Text>
              </View>
            );
          })}
        </SectionCard>

        {/* ── Фото заведения ── */}
        <SectionCard
          title={`Фото заведения (${profile.photos.length}/5)`}
          action={
            isAdmin && profile.photos.length < 5 ? (
              <TouchableOpacity
                onPress={() => Alert.alert('Загрузка фото', 'Будет доступно после подключения хранилища (TASK-034)')}
                activeOpacity={0.7}
              >
                <Text style={styles.sectionAction}>+ Добавить</Text>
              </TouchableOpacity>
            ) : undefined
          }
        >
          {profile.photos.length === 0 ? (
            <Text style={styles.emptyText}>Нет фото</Text>
          ) : (
            profile.photos.map((url, idx) => (
              <View key={idx} style={styles.photoRow}>
                <Text style={styles.photoUrl} numberOfLines={1}>{url}</Text>
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => Alert.alert('Удаление фото', 'Будет доступно после подключения хранилища (TASK-034)')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.iconBtnText}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </SectionCard>

        {/* ── Портфолио ── */}
        <SectionCard
          title={`Портфолио (${profile.portfolio_photos.length})`}
          action={
            isAdmin ? (
              <TouchableOpacity
                onPress={() => Alert.alert('Загрузка фото', 'Будет доступно после подключения хранилища (TASK-034)')}
                activeOpacity={0.7}
              >
                <Text style={styles.sectionAction}>+ Добавить</Text>
              </TouchableOpacity>
            ) : undefined
          }
        >
          {profile.portfolio_photos.length === 0 ? (
            <Text style={styles.emptyText}>Нет фото в портфолио</Text>
          ) : (
            profile.portfolio_photos.map((url, idx) => (
              <View key={idx} style={styles.photoRow}>
                <Text style={styles.photoUrl} numberOfLines={1}>{url}</Text>
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => Alert.alert('Удаление фото', 'Будет доступно после подключения хранилища (TASK-034)')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.iconBtnText}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </SectionCard>

        {/* ── Услуги ── */}
        <SectionCard
          title="Услуги"
          action={
            isAdmin ? (
              <TouchableOpacity onPress={handleOpenAddService} activeOpacity={0.7}>
                <Text style={styles.sectionAction}>+ Добавить</Text>
              </TouchableOpacity>
            ) : undefined
          }
        >
          {services.length === 0 && !serviceForm.visible && (
            <Text style={styles.emptyText}>Нет услуг</Text>
          )}
          {services.map(item => (
            <ServiceRow
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              onEdit={handleOpenEditService}
              onDelete={handleDeleteService}
            />
          ))}
          {serviceForm.visible && (
            <View style={styles.inlineForm}>
              <Text style={styles.inlineFormTitle}>
                {serviceForm.editId ? 'Редактировать услугу' : 'Новая услуга'}
              </Text>
              <TextInput
                style={styles.formInput}
                value={serviceForm.name}
                onChangeText={t => setServiceForm(f => ({ ...f, name: t }))}
                placeholder="Название услуги"
                placeholderTextColor="#B0B0AA"
              />
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.formInput, styles.formInputHalf]}
                  value={serviceForm.price}
                  onChangeText={t => setServiceForm(f => ({ ...f, price: t }))}
                  placeholder="Цена ₽"
                  placeholderTextColor="#B0B0AA"
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.formInput, styles.formInputHalf]}
                  value={serviceForm.duration}
                  onChangeText={t => setServiceForm(f => ({ ...f, duration: t }))}
                  placeholder="Длит. мин"
                  placeholderTextColor="#B0B0AA"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.formCancelBtn}
                  onPress={() => setServiceForm({ visible: false, editId: null, name: '', price: '', duration: '' })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.formCancelBtnText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.formSaveBtn}
                  onPress={() => { void handleSaveService(); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.formSaveBtnText}>Сохранить</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SectionCard>

        {/* ── Сотрудники ── */}
        <SectionCard
          title="Сотрудники"
          action={
            isAdmin ? (
              <TouchableOpacity onPress={handleOpenAddStaff} activeOpacity={0.7}>
                <Text style={styles.sectionAction}>+ Добавить</Text>
              </TouchableOpacity>
            ) : undefined
          }
        >
          {staff.length === 0 && !staffForm.visible && (
            <Text style={styles.emptyText}>Нет сотрудников</Text>
          )}
          {staff.map(item => (
            <StaffRow key={item.id} item={item} isAdmin={isAdmin} onDelete={handleDeleteStaff} />
          ))}
          {staffForm.visible && isAdmin && (
            <View style={styles.inlineForm}>
              <Text style={styles.inlineFormTitle}>Новый сотрудник</Text>
              <TextInput
                style={styles.formInput}
                value={staffForm.name}
                onChangeText={t => setStaffForm(f => ({ ...f, name: t }))}
                placeholder="Имя"
                placeholderTextColor="#B0B0AA"
              />
              <TextInput
                style={styles.formInput}
                value={staffForm.phone}
                onChangeText={t => setStaffForm(f => ({ ...f, phone: t }))}
                placeholder="Телефон"
                placeholderTextColor="#B0B0AA"
                keyboardType="phone-pad"
              />
              <View style={styles.roleRow}>
                <Text style={styles.fieldLabel}>Роль:</Text>
                <TouchableOpacity
                  style={[styles.roleChip, staffForm.role === 'employee' && styles.roleChipActive]}
                  onPress={() => setStaffForm(f => ({ ...f, role: 'employee' }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleChipText, staffForm.role === 'employee' && styles.roleChipTextActive]}>
                    Сотрудник
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleChip, staffForm.role === 'admin' && styles.roleChipActive]}
                  onPress={() => setStaffForm(f => ({ ...f, role: 'admin' }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleChipText, staffForm.role === 'admin' && styles.roleChipTextActive]}>
                    Администратор
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.formCancelBtn}
                  onPress={() => setStaffForm({ visible: false, name: '', phone: '', role: 'employee' })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.formCancelBtnText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.formSaveBtn}
                  onPress={() => { void handleSaveStaff(); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.formSaveBtnText}>Добавить</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SectionCard>

        {/* ── Ссылка для записи ── */}
        <SectionCard
          title="Ссылка для записи"
          action={
            isAdmin && !slugEditMode ? (
              <TouchableOpacity onPress={handleOpenSlugEdit} activeOpacity={0.7}>
                <Text style={styles.sectionAction}>Изменить</Text>
              </TouchableOpacity>
            ) : undefined
          }
        >
          {/* Ссылка заведения */}
          <View style={styles.linkBlock}>
            <Text style={styles.linkBlockLabel}>Ссылка заведения</Text>
            {profile.slug ? (
              <>
                <Text style={styles.linkText} numberOfLines={1}>
                  {`${BASE_URL}/b/${profile.slug}`}
                </Text>
                <View style={styles.linkActions}>
                  <TouchableOpacity
                    style={styles.linkBtn}
                    onPress={() => { void handleCopyLink(`${BASE_URL}/b/${profile.slug}`, 'business'); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.linkBtnText}>
                      {copiedKey === 'business' ? 'Скопировано!' : 'Копировать'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.linkBtn, styles.linkBtnShare]}
                    onPress={() => { void handleShareLink(`${BASE_URL}/b/${profile.slug}`); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.linkBtnText, styles.linkBtnShareText]}>Поделиться</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={styles.linkEmpty}>Ссылка ещё не задана</Text>
            )}
          </View>

          {/* Редактирование slug */}
          {isAdmin && slugEditMode && (
            <View style={styles.inlineForm}>
              <Text style={styles.inlineFormTitle}>Адрес страницы</Text>
              <Text style={styles.slugHint}>
                Только строчные буквы a–z, цифры 0–9 и дефис (3–50 символов)
              </Text>
              <TextInput
                style={styles.formInput}
                value={slugInput}
                onChangeText={t => setSlugInput(t.toLowerCase())}
                placeholder="my-barbershop"
                placeholderTextColor="#B0B0AA"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {slugError ? <Text style={styles.slugErrorText}>{slugError}</Text> : null}
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.formCancelBtn}
                  onPress={() => setSlugEditMode(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.formCancelBtnText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formSaveBtn, slugSaving && styles.saveBtnDisabled]}
                  onPress={() => { void handleSaveSlug(); }}
                  activeOpacity={0.7}
                  disabled={slugSaving}
                >
                  {slugSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.formSaveBtnText}>Сохранить</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Персональные ссылки мастеров */}
          {profile.slug && staff.length > 0 && (
            <>
              <View style={styles.linkDivider} />
              <Text style={styles.linkSubsectionTitle}>Ссылки мастеров</Text>
              {staff.map(item => {
                const staffUrl = `${BASE_URL}/b/${profile.slug}/${item.id}`;
                const copiedId = `staff-${item.id}`;
                return (
                  <View key={item.id} style={styles.staffLinkRow}>
                    <View style={styles.staffLinkInfo}>
                      <Text style={styles.staffLinkName}>{item.name}</Text>
                      <Text style={styles.staffLinkUrl} numberOfLines={1}>{staffUrl}</Text>
                    </View>
                    <View style={styles.staffLinkBtns}>
                      <TouchableOpacity
                        style={styles.iconLinkBtn}
                        onPress={() => { void handleCopyLink(staffUrl, copiedId); }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.iconLinkBtnText}>
                          {copiedKey === copiedId ? '✓' : '⎘'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconLinkBtn}
                        onPress={() => { void handleShareLink(staffUrl); }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.iconLinkBtnText}>↗</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </SectionCard>

        {/* ── Настройки ── */}
        <SectionCard title="Настройки">
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Порог отмены (мин)</Text>
            {editMode ? (
              <TextInput
                style={[styles.fieldInput, styles.fieldInputShort]}
                value={editFields.cancellation_threshold_minutes}
                onChangeText={t => setEditFields(f => ({ ...f, cancellation_threshold_minutes: t }))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#B0B0AA"
              />
            ) : (
              <Text style={styles.fieldValue}>{profile.cancellation_threshold_minutes} мин</Text>
            )}
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>Напоминание за 24 ч</Text>
            <Switch
              value={editMode ? editFields.remind_24h : (profile.reminder_settings?.remind_24h ?? true)}
              onValueChange={v => { if (editMode) setEditFields(f => ({ ...f, remind_24h: v })); }}
              disabled={!editMode}
              trackColor={{ true: COLORS.primary, false: '#D0D0C8' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>Напоминание за 30 мин</Text>
            <Switch
              value={editMode ? editFields.remind_30min : (profile.reminder_settings?.remind_30min ?? true)}
              onValueChange={v => { if (editMode) setEditFields(f => ({ ...f, remind_30min: v })); }}
              disabled={!editMode}
              trackColor={{ true: COLORS.primary, false: '#D0D0C8' }}
              thumbColor="#fff"
            />
          </View>
        </SectionCard>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Colors & Styles ──────────────────────────────────────────────────────────

const COLORS = {
  primary: '#1D6B4F',
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  border: '#E8E8E4',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B65',
  textMuted: '#B0B0AA',
  danger: '#D14343',
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  editBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  saveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    minWidth: 90,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    width: 110,
    flexShrink: 0,
  },
  fieldValue: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.bg,
  },
  fieldInputShort: {
    width: 80,
    flex: 0,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  dayLabel: {
    width: 28,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  hoursText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  dayToggle: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayToggleActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}18`,
  },
  dayToggleText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  dayToggleTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  hoursInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  timeInput: {
    width: 52,
    fontSize: 13,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    textAlign: 'center',
    backgroundColor: COLORS.bg,
  },
  timeSeparator: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  listRowInfo: {
    flex: 1,
  },
  listRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  listRowSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  listRowActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
  iconBtnText: {
    fontSize: 16,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  photoUrl: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 16,
    textAlign: 'center',
  },
  inlineForm: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.bg,
    gap: 8,
  },
  inlineFormTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  formInput: {
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formInputHalf: {
    flex: 1,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}18`,
  },
  roleChipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  roleChipTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  formCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  formCancelBtnText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  formSaveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  formSaveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  linkBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  linkBlockLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  linkText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
    marginBottom: 8,
  },
  linkEmpty: {
    fontSize: 14,
    color: COLORS.textMuted,
    paddingBottom: 8,
  },
  linkActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  linkBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  linkBtnShare: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  linkBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  linkBtnShareText: {
    color: '#fff',
  },
  linkDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  linkSubsectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  staffLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  staffLinkInfo: {
    flex: 1,
  },
  staffLinkName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  staffLinkUrl: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  staffLinkBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  iconLinkBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLinkBtnText: {
    fontSize: 15,
    color: COLORS.primary,
  },
  slugHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  slugErrorText: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 4,
  },
  bottomPad: {
    height: 40,
  },
});
