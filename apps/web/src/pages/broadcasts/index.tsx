import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@mettig/shared';
import { tokenStorage } from '@mettig/shared';
import { trackEvent } from '../../utils/track-event';
import styles from './index.module.scss';

// ─── Types ────────────────────────────────────────────────────────────────────

type BroadcastAudience = 'all' | 'regulars' | 'sleeping' | 'lost' | 'new';
type WizardStep = 1 | 2 | 3;

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

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getSegmentCount(audience: BroadcastAudience, counts: SegmentCounts): number {
  if (audience === 'all') {
    return counts.regulars + counts.sleeping + counts.lost + counts.new + counts.not_visited;
  }
  if (audience === 'new') return counts.new;
  return counts[audience];
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

// ─── Wizard steps ─────────────────────────────────────────────────────────────

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
  const skippedNoApp = selected === 'all' && counts != null ? counts.not_visited : 0;

  return (
    <div className={styles.wizardStep}>
      <p className={styles.stepHint}>Выберите, кому отправить рассылку</p>
      <div className={styles.radioGroup}>
        {AUDIENCE_OPTIONS.map((opt) => (
          <label
            key={opt.key}
            className={[styles.radioRow, selected === opt.key ? styles.radioRowActive : '']
              .filter(Boolean)
              .join(' ')}
          >
            <input
              type="radio"
              className={styles.radioInput}
              name="audience"
              value={opt.key}
              checked={selected === opt.key}
              onChange={() => onSelect(opt.key)}
            />
            <div className={styles.radioCircle}>
              {selected === opt.key && <div className={styles.radioInner} />}
            </div>
            <div>
              <div className={styles.radioLabel}>{opt.label}</div>
              <div className={styles.radioDesc}>{opt.description}</div>
            </div>
          </label>
        ))}
      </div>

      <div className={styles.audienceCounter}>
        {countsLoading ? (
          <span className={styles.dimmed}>Загрузка...</span>
        ) : totalCount != null ? (
          <>
            <span>
              Получат{' '}
              <strong>{totalCount - skippedNoApp}</strong>{' '}
              клиентов
            </span>
            {skippedNoApp > 0 && (
              <span className={styles.skippedHint}>
                {skippedNoApp} без приложения будут пропущены
              </span>
            )}
          </>
        ) : null}
      </div>

      <div className={styles.wizardActions}>
        <button className={styles.primaryBtn} onClick={onNext}>
          Далее →
        </button>
      </div>
    </div>
  );
}

interface MessageStepProps {
  title: string;
  body: string;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
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
    <div className={styles.wizardStep}>
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Заголовок</label>
        <input
          className={[styles.textInput, title.length > 40 ? styles.inputError : '']
            .filter(Boolean)
            .join(' ')}
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Например: Скидка 20% для постоянных"
          maxLength={50}
        />
        <span
          className={[styles.charCounter, title.length > 40 ? styles.charCounterError : '']
            .filter(Boolean)
            .join(' ')}
        >
          {title.length}/40
        </span>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Текст</label>
        <textarea
          className={[styles.textarea, body.length > 160 ? styles.inputError : '']
            .filter(Boolean)
            .join(' ')}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="Ваше сообщение..."
          rows={4}
          maxLength={180}
        />
        <span
          className={[styles.charCounter, body.length > 160 ? styles.charCounterError : '']
            .filter(Boolean)
            .join(' ')}
        >
          {body.length}/160
        </span>
      </div>

      <div className={styles.hintBlock}>
        <p className={styles.hintTitle}>Подстановки:</p>
        <p className={styles.hintText}>
          {'{first_name}'} — имя клиента · {'{business_name}'} — название заведения
        </p>
      </div>

      <div className={styles.wizardActions}>
        <button className={styles.ghostBtn} onClick={onBack}>
          ← Назад
        </button>
        <button
          className={styles.primaryBtn}
          onClick={onNext}
          disabled={!titleOk || !bodyOk}
        >
          Далее →
        </button>
      </div>
    </div>
  );
}

interface ConfirmStepProps {
  audience: BroadcastAudience;
  title: string;
  body: string;
  counts: SegmentCounts | null;
  onSend: () => void;
  onBack: () => void;
  isSending: boolean;
}

function ConfirmStep({
  audience,
  title,
  body,
  counts,
  onSend,
  onBack,
  isSending,
}: ConfirmStepProps): React.JSX.Element {
  const totalCount = counts != null ? getSegmentCount(audience, counts) : null;
  const skippedNoApp = audience === 'all' && counts != null ? counts.not_visited : 0;
  const willReceive = totalCount != null ? totalCount - skippedNoApp : null;

  return (
    <div className={styles.wizardStep}>
      <p className={styles.stepHint}>Проверьте рассылку перед отправкой</p>

      <div className={styles.previewCard}>
        <div className={styles.previewHeader}>
          <span className={styles.previewIcon}>📢</span>
          <span className={styles.previewTitle}>{title}</span>
        </div>
        <p className={styles.previewBody}>{body}</p>
      </div>

      <div className={styles.confirmMeta}>
        <div className={styles.confirmRow}>
          <span className={styles.confirmLabel}>Аудитория</span>
          <span className={styles.confirmValue}>{AUDIENCE_LABELS[audience]}</span>
        </div>
        {willReceive != null && (
          <div className={styles.confirmRow}>
            <span className={styles.confirmLabel}>Получат</span>
            <span className={styles.confirmValue}>{willReceive} клиентов</span>
          </div>
        )}
      </div>

      <div className={styles.wizardActions}>
        <button className={styles.ghostBtn} onClick={onBack} disabled={isSending}>
          ← Назад
        </button>
        <button className={styles.sendBtn} onClick={onSend} disabled={isSending}>
          {isSending ? 'Отправка...' : '📨 Отправить'}
        </button>
      </div>
    </div>
  );
}

// ─── BroadcastsPage ───────────────────────────────────────────────────────────

export function BroadcastsPage(): React.JSX.Element {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Decode JWT role
  useEffect(() => {
    tokenStorage.getAccessToken().then((token) => {
      if (!token) { setIsAdmin(false); return; }
      const role = decodeJwtRole(token);
      setIsAdmin(role === 'admin');
    }).catch(() => setIsAdmin(false));
  }, []);

  const showToast = (msg: string): void => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };

  // Segment counts
  const { data: countsData, isLoading: countsLoading } = useQuery({
    queryKey: ['client-segments'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ segments: SegmentCounts }>(
        '/business/clients/segments',
      );
      return data.segments;
    },
    staleTime: 60_000,
  });

  // Broadcasts list
  const {
    data: broadcastsPages,
    isLoading: broadcastsLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['business-broadcasts'],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '20' };
      if (typeof pageParam === 'string') params['cursor'] = pageParam;
      const { data } = await apiClient.get<BroadcastListResult>('/business/broadcasts', {
        params,
      });
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    staleTime: 30_000,
  });

  const broadcasts = broadcastsPages?.pages.flatMap((p) => p.broadcasts) ?? [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: {
      audience: BroadcastAudience;
      title: string;
      body: string;
    }) => {
      const { data } = await apiClient.post<CreateBroadcastResult>(
        '/business/broadcasts',
        payload,
      );
      return data.broadcast;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business-broadcasts'] });
      setWizardOpen(false);
      resetWizard();
      showToast('Рассылка успешно отправлена!');
      void trackEvent({ event_type: 'broadcast_created', payload: { audience } });
    },
    onError: () => showToast('Не удалось отправить рассылку'),
  });

  const resetWizard = (): void => {
    setStep(1);
    setAudience('all');
    setMsgTitle('');
    setMsgBody('');
  };

  const openWizard = useCallback((): void => {
    resetWizard();
    setWizardOpen(true);
    void trackEvent({ event_type: 'broadcast_wizard_opened' });
  }, []);

  const handleAudienceSelect = (a: BroadcastAudience): void => {
    setAudience(a);
    void trackEvent({ event_type: 'broadcast_audience_selected', payload: { audience: a } });
  };

  const handleSend = (): void => {
    createMutation.mutate({ audience, title: msgTitle, body: msgBody });
  };

  // Infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isAdmin === null) {
    return (
      <div className={styles.page}>
        <div className={styles.centered}>
          <span className={styles.dimmed}>Загрузка...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.centered}>
          <span className={styles.accessIcon}>🔒</span>
          <p className={styles.accessTitle}>Нет доступа</p>
          <p className={styles.dimmed}>Только администратор может управлять рассылками</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Рассылки</h1>
        <button className={styles.createBtn} onClick={openWizard}>
          + Создать рассылку
        </button>
      </div>

      {/* Broadcasts history */}
      {broadcastsLoading ? (
        <div className={styles.list}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeleton} style={{ height: 96 }} />
          ))}
        </div>
      ) : broadcasts.length === 0 ? (
        <div className={styles.centered}>
          <span className={styles.emptyIcon}>📢</span>
          <p className={styles.emptyTitle}>Рассылок пока нет</p>
          <p className={styles.dimmed}>Создайте первую рассылку для клиентов</p>
        </div>
      ) : (
        <div className={styles.list}>
          {broadcasts.map((b) => (
            <div key={b.id} className={styles.broadcastCard}>
              <div className={styles.broadcastTop}>
                <div className={styles.broadcastInfo}>
                  <span className={styles.broadcastTitle}>{b.title}</span>
                  <span className={styles.broadcastAudience}>
                    {AUDIENCE_LABELS[b.audience]}
                  </span>
                </div>
                <span className={styles.broadcastDate}>
                  {formatDateTime(b.sent_at ?? b.created_at)}
                </span>
              </div>
              <p className={styles.broadcastBody}>{b.body}</p>
              <div className={styles.broadcastStats}>
                <span>Получили: <strong>{b.delivered_count}</strong></span>
                <span>Всего: <strong>{b.total_recipients}</strong></span>
                {b.skipped_no_token > 0 && (
                  <span className={styles.dimmed}>
                    Без токена: {b.skipped_no_token}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={loaderRef} className={styles.loaderSentinel}>
        {isFetchingNextPage && (
          <span className={styles.dimmed}>Загрузка...</span>
        )}
      </div>

      {/* Wizard modal */}
      {wizardOpen && (
        <div className={styles.modalOverlay} onClick={(e) => {
          if (e.target === e.currentTarget) { setWizardOpen(false); resetWizard(); }
        }}>
          <div className={styles.modal}>
            {/* Modal header */}
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Новая рассылка</h2>
              <button
                className={styles.closeBtn}
                onClick={() => { setWizardOpen(false); resetWizard(); }}
              >
                ✕
              </button>
            </div>

            {/* Step indicator */}
            <div className={styles.stepIndicator}>
              {([1, 2, 3] as WizardStep[]).map((s) => (
                <React.Fragment key={s}>
                  <div
                    className={[
                      styles.stepDot,
                      step >= s ? styles.stepDotDone : '',
                      step === s ? styles.stepDotCurrent : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {s}
                  </div>
                  {s < 3 && (
                    <div
                      className={[styles.stepLine, step > s ? styles.stepLineDone : '']
                        .filter(Boolean)
                        .join(' ')}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Step titles */}
            <div className={styles.stepTitleRow}>
              <span className={step === 1 ? styles.stepTitleActive : styles.stepTitleInactive}>
                Аудитория
              </span>
              <span className={step === 2 ? styles.stepTitleActive : styles.stepTitleInactive}>
                Сообщение
              </span>
              <span className={step === 3 ? styles.stepTitleActive : styles.stepTitleInactive}>
                Подтверждение
              </span>
            </div>

            {/* Step content */}
            {step === 1 && (
              <AudienceStep
                selected={audience}
                onSelect={handleAudienceSelect}
                counts={countsData ?? null}
                countsLoading={countsLoading}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <MessageStep
                title={msgTitle}
                body={msgBody}
                onTitleChange={setMsgTitle}
                onBodyChange={setMsgBody}
                onNext={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <ConfirmStep
                audience={audience}
                title={msgTitle}
                body={msgBody}
                counts={countsData ?? null}
                onSend={handleSend}
                onBack={() => setStep(2)}
                isSending={createMutation.isPending}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
