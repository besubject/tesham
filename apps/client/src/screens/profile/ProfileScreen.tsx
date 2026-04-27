import React, { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  useAuthStore,
  sendDeleteAccountCode,
  colors,
  monoFont,
  spacing,
  ConfirmationModal,
  CodeConfirmationModal,
  type UserLanguage,
} from '@mettig/shared';
import type { ProfileStackScreenProps } from '../../navigation/types';

type Props = ProfileStackScreenProps<'ProfileMain'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);

  const [isLoading, setIsLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteCodeModal, setShowDeleteCodeModal] = useState(false);
  const [showEmailBanner, setShowEmailBanner] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteCodeError, setDeleteCodeError] = useState<string | null>(null);
  const [isResendingDeleteCode, setIsResendingDeleteCode] = useState(false);

  const EMAIL_BANNER_KEY = 'mettig_email_banner_count';
  const EMAIL_BANNER_MAX = 5;

  useEffect(() => {
    if (!user || (user.email && user.email_verified)) return;
    void (async () => {
      const raw = await SecureStore.getItemAsync(EMAIL_BANNER_KEY);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count < EMAIL_BANNER_MAX) {
        setShowEmailBanner(true);
        await SecureStore.setItemAsync(EMAIL_BANNER_KEY, String(count + 1));
      }
    })();
  }, [user]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleLanguageChange = useCallback(
    async (newLanguage: UserLanguage) => {
      if (!user) return;

      setIsLoading(true);
      try {
        await updateProfile({ language: newLanguage });
        await i18n.changeLanguage(newLanguage);
      } catch {
        Alert.alert(t('common.error'), t('common.error'));
      } finally {
        setIsLoading(false);
      }
    },
    [user, updateProfile, i18n, t],
  );

  const handleLogoutPress = useCallback(() => {
    setShowLogoutModal(true);
  }, []);

  const handleLogoutConfirm = useCallback(async () => {
    setShowLogoutModal(false);
    setIsLoading(true);
    try {
      await logout();
      // Navigation will be handled by RootNavigator based on auth state
    } catch {
      Alert.alert(t('common.error'), t('common.error'));
      setIsLoading(false);
    }
  }, [logout, t]);

  const handleDeletePress = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    setShowDeleteModal(false);
    setIsLoading(true);
    try {
      await sendDeleteAccountCode();
      setDeleteCode('');
      setDeleteCodeError(null);
      setShowDeleteCodeModal(true);
    } catch {
      Alert.alert(t('common.error'), t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const handleDeleteCodeConfirm = useCallback(async () => {
    setIsLoading(true);
    setDeleteCodeError(null);
    try {
      await deleteAccount(deleteCode);
      // Navigation will be handled by RootNavigator based on auth state
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } }).response?.data
        ?.error?.code;
      if (code === 'INVALID_CODE' || code === 'CODE_EXPIRED') {
        setDeleteCodeError(t('profile.deleteCodeInvalid'));
      } else {
        Alert.alert(t('common.error'), t('common.error'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [deleteAccount, deleteCode, t]);

  const handleDeleteCodeResend = useCallback(async () => {
    setIsResendingDeleteCode(true);
    setDeleteCodeError(null);
    try {
      await sendDeleteAccountCode();
    } catch {
      Alert.alert(t('common.error'), t('common.error'));
    } finally {
      setIsResendingDeleteCode(false);
    }
  }, [t]);

  const handleFavoritesPress = useCallback(() => {
    navigation.navigate('Favorites');
  }, [navigation]);

  // ── Loading state ────────────────────────────────────────────────────────

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const currentLanguage = user.language || 'ru';
  const initials = getInitials(user.name ?? 'МК');

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Page header */}
      <View style={styles.topBar}>
        <Text style={styles.topBarLeft}>Я</Text>
        <Text style={styles.topBarRight}>Tesham</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + name card */}
        <View style={styles.padded}>
          <View style={styles.profileCard}>
            <View style={styles.profileRow}>
              {/* Initials block */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user.name}</Text>
                <Text style={styles.profilePhone}>{user.phone}</Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={[styles.statCell, { alignItems: 'flex-start' }]}>
                <Text style={styles.statNum}>—</Text>
                <Text style={styles.statLabel}>записей</Text>
              </View>
              <View style={[styles.statCell, styles.statCellBordered, { alignItems: 'center' }]}>
                <Text style={styles.statNum}>—</Text>
                <Text style={styles.statLabel}>избранных</Text>
              </View>
              <View style={[styles.statCell, styles.statCellBordered, { alignItems: 'flex-end' }]}>
                <Text style={styles.statNum}>—</Text>
                <Text style={styles.statLabel}>★</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Email banner */}
        {showEmailBanner && (
          <View style={styles.padded}>
            <TouchableOpacity
              style={styles.emailBanner}
              activeOpacity={0.85}
              onPress={() => {
                setShowEmailBanner(false);
                navigation.navigate('EmailSetup');
              }}
            >
              <View style={styles.emailDot} />
              <View style={styles.emailBannerText}>
                <Text style={styles.emailBannerTitle}>Подтвердите email</Text>
                <Text style={styles.emailBannerSub}>
                  Чтобы восстановить доступ при потере телефона
                </Text>
              </View>
              <Text style={styles.emailBannerArrow}>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Settings: Аккаунт */}
        <View style={styles.padded}>
          <Text style={styles.groupLabel}>Аккаунт</Text>
          <View style={styles.settingsCard}>
            {/* Email row */}
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => navigation.navigate('EmailSetup')}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsRowText}>
                {'Email · '}
                {user.email && user.email_verified
                  ? user.email
                  : user.email
                    ? 'не подтверждён'
                    : 'не привязан'}
              </Text>
              <Text style={styles.settingsArrow}>›</Text>
            </TouchableOpacity>

            {/* Language toggle */}
            <View style={[styles.settingsRow, styles.settingsRowBordered]}>
              <Text style={styles.settingsRowText}>Язык</Text>
              <View style={styles.langToggle}>
                <Pressable
                  style={[styles.langBtn, currentLanguage === 'ru' && styles.langBtnActive]}
                  onPress={() => void handleLanguageChange('ru')}
                  disabled={isLoading}
                >
                  <Text style={[styles.langBtnText, currentLanguage === 'ru' && styles.langBtnTextActive]}>
                    Рус
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.langBtn, currentLanguage === 'ce' && styles.langBtnActive]}
                  onPress={() => void handleLanguageChange('ce')}
                  disabled={isLoading}
                >
                  <Text style={[styles.langBtnText, currentLanguage === 'ce' && styles.langBtnTextActive]}>
                    Нох
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Settings: Активность */}
        <View style={styles.padded}>
          <Text style={styles.groupLabel}>Активность</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={handleFavoritesPress}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsRowText}>{t('profile.favorites')}</Text>
              <Text style={styles.settingsArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.settingsRow, styles.settingsRowBordered]}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <View>
                <Text style={styles.settingsRowText}>{t('profile.about')}</Text>
                <Text style={styles.settingsRowSub}>Mettig v1.0.0</Text>
              </View>
              <Text style={styles.settingsArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings: Прочее */}
        <View style={styles.padded}>
          <Text style={styles.groupLabel}>Прочее</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={handleLogoutPress}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsRowText}>{t('profile.logout')}</Text>
              <Text style={styles.settingsArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.settingsRow, styles.settingsRowBordered]}
              onPress={handleDeletePress}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={[styles.settingsRowText, styles.deleteText]}>
                {t('profile.deleteAccount')}
              </Text>
              <Text style={[styles.settingsArrow, { color: colors.coral }]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      )}

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        visible={showLogoutModal}
        title={t('profile.logout')}
        message={t('profile.logoutConfirm')}
        confirmLabel={t('common.yes')}
        cancelLabel={t('common.no')}
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowLogoutModal(false)}
        isLoading={false}
      />

      {/* Delete Account Confirmation Modal */}
      <ConfirmationModal
        visible={showDeleteModal}
        title={t('profile.deleteAccount')}
        message={t('profile.deleteConfirm')}
        confirmLabel={t('common.yes')}
        cancelLabel={t('common.no')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteModal(false)}
        isLoading={false}
        destructive
      />

      <CodeConfirmationModal
        visible={showDeleteCodeModal}
        title={t('profile.deleteCodeTitle')}
        message={t('profile.deleteCodeMessage')}
        phoneLabel={user?.phone ?? undefined}
        code={deleteCode}
        error={deleteCodeError}
        confirmLabel={t('profile.deleteCodeConfirm')}
        cancelLabel={t('common.no')}
        resendLabel={t('profile.deleteCodeResend')}
        onChangeCode={(value) => {
          setDeleteCode(value);
          if (deleteCodeError) setDeleteCodeError(null);
        }}
        onConfirm={() => {
          void handleDeleteCodeConfirm();
        }}
        onCancel={() => {
          if (isLoading || isResendingDeleteCode) return;
          setShowDeleteCodeModal(false);
          setDeleteCode('');
          setDeleteCodeError(null);
        }}
        onResend={() => {
          void handleDeleteCodeResend();
        }}
        isSubmitting={isLoading}
        isResending={isResendingDeleteCode}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
  },
  topBarLeft: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  topBarRight: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },

  scrollContent: { flexGrow: 1 },
  padded: { paddingHorizontal: 18, paddingBottom: 14 },

  // Profile card
  profileCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.surface,
    letterSpacing: -1,
  },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  profilePhone: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.textMuted,
    marginTop: 6,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statCell: {
    flex: 1,
    paddingHorizontal: 8,
  },
  statCellBordered: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.text,
  },
  statLabel: {
    fontFamily: monoFont,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 2,
  },

  // Email banner
  emailBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    borderRadius: 14,
    padding: 14,
  },
  emailDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.accent,
    flexShrink: 0,
  },
  emailBannerText: { flex: 1, minWidth: 0 },
  emailBannerTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  emailBannerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  emailBannerArrow: { fontSize: 18, color: colors.text },

  // Settings groups
  groupLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingsRowBordered: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  settingsRowText: {
    fontSize: 14,
    color: colors.text,
  },
  settingsRowSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  settingsArrow: {
    fontSize: 18,
    color: colors.textMuted,
  },
  deleteText: {
    color: colors.coral,
  },

  // Language toggle
  langToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  langBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  langBtnActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  langBtnText: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  langBtnTextActive: {
    color: colors.accent,
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(58,57,53,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
