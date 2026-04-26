import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@mettig/shared';
import { trackEvent } from '@mettig/shared/src/utils/track-event';
import * as SecureStore from 'expo-secure-store';
import type { StatsStackScreenProps } from '../../navigation/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type BroadcastAudience = 'all' | 'regulars' | 'sleeping' | 'lost' | 'new';

type WizardStep = 1 | 2 | 3;
type ScreenTab = 'create' | 'history';

interface SegmentCounts {
  regulars: number;
  sleeping: number;
  lost: number;
  not_visited: number;
  new: number;
}

interface BroadcastListItem {
  id: string;
  audience: BroadcastAudience;
  title: string;
  body: string;
  created_at: string;
  sent_at: string | null;
  total_recipients: number;
  delivered_count: number;
  skipped_no_token: number;
  skipped_rate_limit: number;
}

interface BroadcastListResult {
  broadcasts: BroadcastListItem[];
  next_cursor: string | null;
}

interface CreateBroadcastResult {
  broadcast: BroadcastListItem;
}

type Props = StatsStackScreenProps<'BroadcastsScreen'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeJwtRole(token: string): 'admin' | 'employee' | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as { role?: string };
    if (payload.role === 'admin' || payload.role === 'employee') {
      return payload.role;
    }
    return null;
  } catch {
    return null;
  }
}

const AUDIENCE_OPTIONS: Array<{ key: BroadcastAudience; label: string; description: string }> = [
  { key: 'all', label: 'Все клиенты', description: 'Весь список клиентов' },
  { key: 'regulars', label: 'Постоянные', description: '2+ визита за 90 дней' },
  { key: 'sleeping', label: 'Спящие', description: 'Были 30–180 дней назад' },
  { key: 'lost', label: 'Пропавшие', description: 'Не приходили 180+ дней' },
  { key: 'new', label: 'Новые', description: 'Первый визит за 30 дней' },
];

const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  all: 'Все',
  regulars: 'Постоянные',
  sleeping: 'Спящие',
  lost: 'Пропавшие',
  new: 'Новые',
};

function getSegmentCount(audience: BroadcastAudience, counts: SegmentCounts): number {
  if (audience === 'all') {
    return counts.regulars + counts.sleeping + counts.lost + counts.new + counts.not_visited;
  }
  if (audience === 'new') return counts.new;
  return counts[audience];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${day}.${month}.${year} ${h}:${m}`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  visible: boolean;
}

function Toast({ message, visible }: ToastProps): React.JSX.Element | null {
  if (!visible) return null;
  return (
    <View style={styles.toast} pointerEvents="none">
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

// ─── Progress indicator ───────────────────────────────────────────────────────

function StepIndicator({ current }: { current: WizardStep }): React.JSX.Element {
  return (
    <View style={styles.stepIndicator}>
      {([1, 2, 3] as WizardStep[]).map((step) => (
        <React.Fragment key={step}>
          <View
            style={[
              styles.stepDot,
              current >= step && styles.stepDotActive,
              current === step && styles.stepDotCurrent,
            ]}
          >
            <Text style={[styles.stepDotText, current >= step && styles.stepDotTextActive]}>
              {step}
            </Text>
          </View>
          {step < 3 && (
            <View style={[styles.stepLine, current > step && styles.stepLineActive]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

// ─── Step 1: Audience ─────────────────────────────────────────────────────────

interface AudienceStepProps {
  selected: BroadcastAudience;
  onSelect: (a: BroadcastAudience) => void;
  counts: SegmentCounts | null;
  countsLoading: boolean;
  onNext: () => void;
}

function AudienceStep({
  selected,
  onSelect,
  counts,
  countsLoading,
  onNext,
}: AudienceStepProps): React.JSX.Element {
  const totalCount = counts != null ? getSegmentCount(selected, counts) : null;
  // walk-in clients (not_visited) won't have push tokens — they're skipped
  const skippedNoApp =
    selected === 'all' && counts != null ? counts.not_visited : 0;

  return (
    <ScrollView contentContainerStyle={styles.wizardContent}>
      <Text style={styles.wizardStepTitle}>Шаг 1 из 3 — Аудитория</Text>
      <Text style={styles.wizardStepHint}>Выберите, кому отправить рассылку</Text>

      <View style={styles.radioGroup}>
        {AUDIENCE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.radioRow, selected === opt.key && styles.radioRowSelected]}
            onPress={() => onSelect(opt.key)}
            accessibilityLabel={opt.label}
            activeOpacity={0.7}
          >
            <View style={[styles.radioCircle, selected === opt.key && styles.radioCircleActive]}>
              {selected === opt.key && <View style={styles.radioInner} />}
            </View>
            <View style={styles.radioTextBlock}>
              <Text style={styles.radioLabel}>{opt.label}</Text>
              <Text style={styles.radioDesc}>{opt.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.audienceCounter}>
        {countsLoading ? (
          <ActivityIndicator color="#1D6B4F" size="small" />
        ) : totalCount != null ? (
          <>
            <Text style={styles.audienceCounterText}>
              Получат{' '}
              <Text style={styles.audienceCounterBold}>{totalCount - skippedNoApp}</Text>{' '}
              клиентов
            </Text>
            {skippedNoApp > 0 && (
              <Text style={styles.audienceCounterSkipped}>
                {skippedNoApp} без приложения будут пропущены
              </Text>
            )}
          </>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={onNext}
        accessibilityLabel="Далее"
      >
        <Text style={styles.primaryButtonText}>Далее →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Step 2: Message ──────────────────────────────────────────────────────────

interface MessageStepProps {
  title: string;
  body: string;
  onTitleChange: (t: string) => void;
  onBodyChange: (b: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function MessageStep({
  title,
  body,
  onTitleChange,
  onBodyChange,
  onNext,
  onBack,
}: MessageStepProps): React.JSX.Element {
  const titleOk = title.trim().length > 0 && title.length <= 40;
  const bodyOk = body.trim().length > 0 && body.length <= 160;

  return (
    <ScrollView contentContainerStyle={styles.wizardContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.wizardStepTitle}>Шаг 2 из 3 — Сообщение</Text>

      <Text style={styles.fieldLabel}>Заголовок</Text>
      <View style={[styles.inputWrap, title.length > 40 && styles.inputWrapError]}>
        <TextInput
          style={styles.textInput}
          value={title}
          onChangeText={onTitleChange}
          placeholder="Например: Скидка 20% для постоянных"
          placeholderTextColor="#B8B8B4"
          maxLength={50}
          returnKeyType="next"
          accessibilityLabel="Заголовок рассылки"
        />
        <Text style={[styles.charCounter, title.length > 40 && styles.charCounterError]}>
          {title.length}/40
        </Text>
      </View>

      <Text style={styles.fieldLabel}>Текст</Text>
      <View style={[styles.inputWrap, styles.inputWrapMultiline, body.length > 160 && styles.inputWrapError]}>
        <TextInput
          style={[styles.textInput, styles.textInputMultiline]}
          value={body}
          onChangeText={onBodyChange}
          placeholder="Ваше сообщение..."
          placeholderTextColor="#B8B8B4"
          multiline
          numberOfLines={4}
          maxLength={180}
          accessibilityLabel="Текст рассылки"
        />
        <Text style={[styles.charCounter, body.length > 160 && styles.charCounterError]}>
          {body.length}/160
        </Text>
      </View>

      <View style={styles.hintBlock}>
        <Text style={styles.hintTitle}>Используйте подстановки:</Text>
        <Text style={styles.hintText}>
          {'{first_name}'} — имя клиента{'\n'}
          {'{business_name}'} — название заведения
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onBack} accessibilityLabel="Назад">
          <Text style={styles.secondaryButtonText}>← Назад</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, styles.buttonFlex, (!titleOk || !bodyOk) && styles.primaryButtonDisabled]}
          onPress={titleOk && bodyOk ? onNext : undefined}
          accessibilityLabel="Далее"
        >
          <Text style={styles.primaryButtonText}>Далее →</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Step 3: Preview ──────────────────────────────────────────────────────────

interface PreviewStepProps {
  audience: BroadcastAudience;
  title: string;
  body: string;
  onSend: () => void;
  onBack: () => void;
  isSending: boolean;
}

function PreviewStep({
  audience,
  title,
  body,
  onSend,
  onBack,
  isSending,
}: PreviewStepProps): React.JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.wizardContent}>
      <Text style={styles.wizardStepTitle}>Шаг 3 из 3 — Превью</Text>
      <Text style={styles.wizardStepHint}>Так клиенты увидят ваше уведомление</Text>

      {/* Push notification mock */}
      <View style={styles.pushPreview}>
        <View style={styles.pushHeader}>
          <View style={styles.pushAppIcon} />
          <Text style={styles.pushAppName}>Mettig</Text>
          <Text style={styles.pushTime}>сейчас</Text>
        </View>
        <Text style={styles.pushTitle} numberOfLines={1}>{title || 'Заголовок'}</Text>
        <Text style={styles.pushBody} numberOfLines={3}>{body || 'Текст сообщения'}</Text>
      </View>

      <View style={styles.previewMeta}>
        <Text style={styles.previewMetaLabel}>Аудитория:</Text>
        <Text style={styles.previewMetaValue}>{AUDIENCE_LABELS[audience]}</Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onBack}
          disabled={isSending}
          accessibilityLabel="Назад"
        >
          <Text style={styles.secondaryButtonText}>← Назад</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, styles.buttonFlex, isSending && styles.primaryButtonDisabled]}
          onPress={!isSending ? onSend : undefined}
          accessibilityLabel="Отправить рассылку"
        >
          {isSending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Отправить</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Success view ─────────────────────────────────────────────────────────────

interface SuccessViewProps {
  broadcast: BroadcastListItem;
  onReset: () => void;
}

function SuccessView({ broadcast, onReset }: SuccessViewProps): React.JSX.Element {
  const delivered = broadcast.delivered_count;
  const skipped = broadcast.skipped_no_token + broadcast.skipped_rate_limit;
  return (
    <View style={styles.successContainer}>
      <Text style={styles.successIcon}>✅</Text>
      <Text style={styles.successTitle}>Рассылка отправлена!</Text>
      <View style={styles.successStats}>
        <View style={styles.successStatItem}>
          <Text style={styles.successStatValue}>{delivered}</Text>
          <Text style={styles.successStatLabel}>Доставлено</Text>
        </View>
        {skipped > 0 && (
          <View style={styles.successStatItem}>
            <Text style={[styles.successStatValue, styles.successStatSkipped]}>{skipped}</Text>
            <Text style={styles.successStatLabel}>Пропущено</Text>
          </View>
        )}
      </View>
      {skipped > 0 && (
        <Text style={styles.successSkippedHint}>
          Пропущены клиенты без приложения или с ограничением частоты
        </Text>
      )}
      <TouchableOpacity
        style={[styles.primaryButton, { marginTop: 32 }]}
        onPress={onReset}
        accessibilityLabel="Создать ещё одну рассылку"
      >
        <Text style={styles.primaryButtonText}>Создать ещё</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Create tab ───────────────────────────────────────────────────────────────

interface CreateTabProps {
  businessName: string | null;
}

function CreateTab({ businessName: _businessName }: CreateTabProps): React.JSX.Element {
  const [step, setStep] = useState<WizardStep>(1);
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sentBroadcast, setSentBroadcast] = useState<BroadcastListItem | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const queryClient = useQueryClient();

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3500);
  }, []);

  // Fetch segment counts
  const { data: segmentsData, isLoading: countsLoading } = useQuery({
    queryKey: ['client-segments'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ segments: SegmentCounts }>('/business/clients/segments');
      return data.segments;
    },
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<CreateBroadcastResult>('/business/broadcasts', {
        audience,
        title: title.trim(),
        body: body.trim(),
      });
      return data.broadcast;
    },
    onSuccess: (broadcast) => {
      setSentBroadcast(broadcast);
      void queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      void trackEvent({
        event_type: 'broadcast_created',
        payload: { audience, title_len: title.length, body_len: body.length },
      });
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { code?: string } } };
      if (apiErr.response?.data?.code === 'DAILY_LIMIT_EXCEEDED') {
        showToast('Уже была рассылка сегодня. Следующую можно будет отправить завтра.');
      } else {
        showToast('Не удалось отправить рассылку. Попробуйте ещё раз.');
      }
    },
  });

  const handleSelectAudience = useCallback(
    (a: BroadcastAudience) => {
      setAudience(a);
      void trackEvent({ event_type: 'broadcast_audience_selected', payload: { audience: a } });
    },
    [],
  );

  const handleReset = useCallback(() => {
    setStep(1);
    setAudience('all');
    setTitle('');
    setBody('');
    setSentBroadcast(null);
  }, []);

  if (sentBroadcast != null) {
    return <SuccessView broadcast={sentBroadcast} onReset={handleReset} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <StepIndicator current={step} />

      {step === 1 && (
        <AudienceStep
          selected={audience}
          onSelect={handleSelectAudience}
          counts={segmentsData ?? null}
          countsLoading={countsLoading}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <MessageStep
          title={title}
          body={body}
          onTitleChange={setTitle}
          onBodyChange={setBody}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <PreviewStep
          audience={audience}
          title={title}
          body={body}
          onSend={() => createMutation.mutate()}
          onBack={() => setStep(2)}
          isSending={createMutation.isPending}
        />
      )}

      <Toast message={toastMsg} visible={toastVisible} />
    </View>
  );
}

// ─── Broadcast row ────────────────────────────────────────────────────────────

interface BroadcastRowProps {
  item: BroadcastListItem;
  onPress: (item: BroadcastListItem) => void;
}

function BroadcastRow({ item, onPress }: BroadcastRowProps): React.JSX.Element {
  const skipped = item.skipped_no_token + item.skipped_rate_limit;
  return (
    <TouchableOpacity
      style={styles.broadcastRow}
      onPress={() => onPress(item)}
      accessibilityLabel={`Рассылка ${item.title}`}
      activeOpacity={0.7}
    >
      <View style={styles.broadcastRowHeader}>
        <Text style={styles.broadcastRowAudience}>{AUDIENCE_LABELS[item.audience]}</Text>
        <Text style={styles.broadcastRowDate}>{formatDate(item.created_at)}</Text>
      </View>
      <Text style={styles.broadcastRowTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.broadcastRowBody} numberOfLines={2}>
        {item.body.length > 50 ? item.body.slice(0, 50) + '…' : item.body}
      </Text>
      <View style={styles.broadcastRowStats}>
        <Text style={styles.broadcastRowStat}>✓ {item.delivered_count} доставлено</Text>
        {skipped > 0 && (
          <Text style={[styles.broadcastRowStat, styles.broadcastRowStatSkipped]}>
            {skipped} пропущено
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Broadcast detail modal ───────────────────────────────────────────────────

interface BroadcastDetailModalProps {
  item: BroadcastListItem | null;
  onClose: () => void;
}

function BroadcastDetailModal({ item, onClose }: BroadcastDetailModalProps): React.JSX.Element {
  if (item == null) return <></>;
  const skipped = item.skipped_no_token + item.skipped_rate_limit;

  return (
    <Modal visible={item != null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalAudience}>{AUDIENCE_LABELS[item.audience]}</Text>
              <Text style={styles.modalDate}>{formatDate(item.created_at)}</Text>
            </View>
            <Text style={styles.modalTitle}>{item.title}</Text>
            <Text style={styles.modalBody}>{item.body}</Text>

            <View style={styles.modalStats}>
              <View style={styles.modalStatItem}>
                <Text style={styles.modalStatValue}>{item.total_recipients}</Text>
                <Text style={styles.modalStatLabel}>Всего</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={styles.modalStatValue}>{item.delivered_count}</Text>
                <Text style={styles.modalStatLabel}>Доставлено</Text>
              </View>
              {skipped > 0 && (
                <View style={styles.modalStatItem}>
                  <Text style={[styles.modalStatValue, styles.successStatSkipped]}>{skipped}</Text>
                  <Text style={styles.modalStatLabel}>Пропущено</Text>
                </View>
              )}
            </View>
          </ScrollView>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={onClose}
            accessibilityLabel="Закрыть"
          >
            <Text style={styles.modalCloseText}>Закрыть</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── History tab ──────────────────────────────────────────────────────────────

function HistoryTab(): React.JSX.Element {
  const [selectedItem, setSelectedItem] = useState<BroadcastListItem | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } =
    useInfiniteQuery({
      queryKey: ['broadcasts'],
      queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
        const params: Record<string, string | number> = { limit: 20 };
        if (pageParam) params['cursor'] = pageParam;
        const { data: resp } = await apiClient.get<BroadcastListResult>('/business/broadcasts', {
          params,
        });
        return resp;
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.next_cursor ?? undefined,
    });

  const broadcasts = data?.pages.flatMap((p) => p.broadcasts) ?? [];

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1D6B4F" size="large" />
      </View>
    );
  }

  if (error != null && broadcasts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Не удалось загрузить историю</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => void refetch()}
          accessibilityLabel="Повторить"
        >
          <Text style={styles.retryText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyTitle}>Нет рассылок</Text>
        <Text style={styles.emptyHint}>Создайте первую рассылку во вкладке «Создать»</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={broadcasts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BroadcastRow item={item} onPress={setSelectedItem} />
        )}
        contentContainerStyle={styles.historyList}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color="#1D6B4F" style={{ marginVertical: 16 }} />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
      <BroadcastDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </>
  );
}

// ─── BroadcastsScreen ─────────────────────────────────────────────────────────

export function BroadcastsScreen({ navigation: _navigation }: Props): React.JSX.Element {
  const [tab, setTab] = useState<ScreenTab>('create');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Resolve role once on mount
  useEffect(() => {
    void (async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (token) {
          setIsAdmin(decodeJwtRole(token) === 'admin');
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      }
    })();
  }, []);

  const hasTrackedOpen = useRef(false);
  useEffect(() => {
    if (isAdmin === true && !hasTrackedOpen.current) {
      hasTrackedOpen.current = true;
      void trackEvent({ event_type: 'broadcast_wizard_opened', payload: {} });
    }
  }, [isAdmin]);

  // Loading role
  if (isAdmin === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color="#1D6B4F" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // Employee guard
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Рассылки</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.lockedIcon}>🔒</Text>
          <Text style={styles.lockedTitle}>Доступно только администратору</Text>
          <Text style={styles.lockedHint}>Обратитесь к владельцу заведения</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Рассылки</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'create' && styles.tabItemActive]}
          onPress={() => setTab('create')}
          accessibilityLabel="Создать рассылку"
        >
          <Text style={[styles.tabLabel, tab === 'create' && styles.tabLabelActive]}>
            Создать
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'history' && styles.tabItemActive]}
          onPress={() => setTab('history')}
          accessibilityLabel="История рассылок"
        >
          <Text style={[styles.tabLabel, tab === 'history' && styles.tabLabelActive]}>
            История
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {tab === 'create' ? <CreateTab businessName={null} /> : <HistoryTab />}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A18',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    color: '#C4462A',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1D6B4F',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A18',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 14,
    color: '#8A8A86',
    textAlign: 'center',
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E4',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#1D6B4F',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8A8A86',
  },
  tabLabelActive: {
    color: '#1D6B4F',
    fontWeight: '600',
  },
  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
    gap: 0,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8E8E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#1D6B4F',
  },
  stepDotCurrent: {
    backgroundColor: '#1D6B4F',
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A8A86',
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E8E8E4',
  },
  stepLineActive: {
    backgroundColor: '#1D6B4F',
  },
  // Wizard
  wizardContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  wizardStepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A18',
    marginBottom: 4,
  },
  wizardStepHint: {
    fontSize: 13,
    color: '#8A8A86',
    marginBottom: 20,
  },
  // Radio
  radioGroup: {
    gap: 8,
    marginBottom: 20,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  radioRowSelected: {
    borderColor: '#1D6B4F',
    backgroundColor: '#F0FAF6',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C8C8C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#1D6B4F',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1D6B4F',
  },
  radioTextBlock: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A18',
  },
  radioDesc: {
    fontSize: 12,
    color: '#8A8A86',
    marginTop: 2,
  },
  // Audience counter
  audienceCounter: {
    minHeight: 48,
    backgroundColor: '#F0FAF6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audienceCounterText: {
    fontSize: 14,
    color: '#1A1A18',
    textAlign: 'center',
  },
  audienceCounterBold: {
    fontWeight: '700',
    color: '#1D6B4F',
  },
  audienceCounterSkipped: {
    fontSize: 12,
    color: '#8A8A86',
    marginTop: 4,
    textAlign: 'center',
  },
  // Form
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C5C58',
    marginBottom: 6,
    marginTop: 12,
  },
  inputWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  inputWrapMultiline: {
    paddingBottom: 4,
  },
  inputWrapError: {
    borderColor: '#C4462A',
  },
  textInput: {
    fontSize: 15,
    color: '#1A1A18',
    minHeight: 36,
  },
  textInputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  charCounter: {
    fontSize: 11,
    color: '#B8B8B4',
    textAlign: 'right',
    marginTop: 2,
  },
  charCounterError: {
    color: '#C4462A',
  },
  hintBlock: {
    backgroundColor: '#F5F5F2',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginBottom: 24,
  },
  hintTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5C5C58',
    marginBottom: 4,
  },
  hintText: {
    fontSize: 12,
    color: '#8A8A86',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  buttonFlex: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#1D6B4F',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#B8B8B4',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#F5F5F2',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5C5C58',
  },
  // Preview
  pushPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  pushHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  pushAppIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#1D6B4F',
  },
  pushAppName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5C5C58',
    flex: 1,
  },
  pushTime: {
    fontSize: 11,
    color: '#B8B8B4',
  },
  pushTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A18',
    marginBottom: 4,
  },
  pushBody: {
    fontSize: 13,
    color: '#5C5C58',
    lineHeight: 18,
  },
  previewMeta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  previewMetaLabel: {
    fontSize: 13,
    color: '#8A8A86',
  },
  previewMetaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A18',
  },
  // Success
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A18',
    marginBottom: 24,
    textAlign: 'center',
  },
  successStats: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 12,
  },
  successStatItem: {
    alignItems: 'center',
  },
  successStatValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1D6B4F',
  },
  successStatSkipped: {
    color: '#B07415',
  },
  successStatLabel: {
    fontSize: 13,
    color: '#8A8A86',
    marginTop: 4,
  },
  successSkippedHint: {
    fontSize: 12,
    color: '#8A8A86',
    textAlign: 'center',
    marginTop: 8,
  },
  // History
  historyList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 10,
  },
  broadcastRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    padding: 14,
  },
  broadcastRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  broadcastRowAudience: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D6B4F',
    backgroundColor: '#F0FAF6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  broadcastRowDate: {
    fontSize: 12,
    color: '#8A8A86',
  },
  broadcastRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A18',
    marginBottom: 4,
  },
  broadcastRowBody: {
    fontSize: 13,
    color: '#5C5C58',
    lineHeight: 18,
    marginBottom: 8,
  },
  broadcastRowStats: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0EE',
    paddingTop: 8,
  },
  broadcastRowStat: {
    fontSize: 12,
    color: '#5C5C58',
  },
  broadcastRowStatSkipped: {
    color: '#B07415',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8E8E4',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalAudience: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D6B4F',
    backgroundColor: '#F0FAF6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modalDate: {
    fontSize: 12,
    color: '#8A8A86',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A18',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    color: '#5C5C58',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalStats: {
    flexDirection: 'row',
    gap: 24,
    backgroundColor: '#F5F5F2',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A18',
  },
  modalStatLabel: {
    fontSize: 11,
    color: '#8A8A86',
    marginTop: 2,
  },
  modalCloseButton: {
    backgroundColor: '#F5F5F2',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5C5C58',
  },
  // Toast
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1A1A18',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  // Access denied
  lockedIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  lockedTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A18',
    marginBottom: 6,
    textAlign: 'center',
  },
  lockedHint: {
    fontSize: 14,
    color: '#8A8A86',
    textAlign: 'center',
  },
});
