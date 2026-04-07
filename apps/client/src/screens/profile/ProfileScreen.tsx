import React, { useCallback, useState } from 'react';
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
  colors,
  typography,
  spacing,
  borderRadius,
  ConfirmationModal,
  type UserLanguage,
} from '@mettig/shared';
import type { ProfileStackScreenProps } from '../../navigation/types';

type Props = ProfileStackScreenProps<'ProfileMain'>;

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

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleLanguageChange = useCallback(
    async (newLanguage: UserLanguage) => {
      if (!user) return;

      setIsLoading(true);
      try {
        await updateProfile({ language: newLanguage });
        await i18n.changeLanguage(newLanguage);
      } catch (error) {
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
    } catch (error) {
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
      await deleteAccount();
      // Navigation will be handled by RootNavigator based on auth state
    } catch (error) {
      Alert.alert(t('common.error'), t('common.error'));
      setIsLoading(false);
    }
  }, [deleteAccount, t]);

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
  const languageIndex = currentLanguage === 'ru' ? 0 : 1;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>{t('profile.title')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        {/* User Info Section */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('profile.nameLabel')}</Text>
              <Text style={styles.infoValue}>{user.name}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('profile.phoneLabel')}</Text>
              <Text style={styles.infoValue}>{user.phone}</Text>
            </View>
          </View>
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
          <View style={styles.languageToggle}>
            <Pressable
              style={[
                styles.languageButton,
                currentLanguage === 'ru' && styles.languageButtonActive,
              ]}
              onPress={() => void handleLanguageChange('ru')}
              disabled={isLoading}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  currentLanguage === 'ru' && styles.languageButtonTextActive,
                ]}
              >
                Русский
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.languageButton,
                currentLanguage === 'ce' && styles.languageButtonActive,
              ]}
              onPress={() => void handleLanguageChange('ce')}
              disabled={isLoading}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  currentLanguage === 'ce' && styles.languageButtonTextActive,
                ]}
              >
                Нохчийн
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          {/* Favorites Button */}
          <TouchableOpacity
            style={styles.button}
            onPress={handleFavoritesPress}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>{t('profile.favorites')}</Text>
            <Text style={styles.buttonArrow}>›</Text>
          </TouchableOpacity>

          {/* About Button */}
          <TouchableOpacity
            style={styles.button}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.buttonText}>{t('profile.about')}</Text>
              <Text style={styles.buttonSubtext}>Mettig v1.0.0</Text>
            </View>
            <Text style={styles.buttonArrow}>›</Text>
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogoutPress}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <Text style={styles.logoutButtonText}>{t('profile.logout')}</Text>
          </TouchableOpacity>

          {/* Delete Account Button */}
          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={handleDeletePress}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <Text style={styles.deleteButtonText}>{t('profile.deleteAccount')}</Text>
          </TouchableOpacity>
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
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  screenTitle: {
    ...typography.h2,
    color: colors.text,
  },
  scrollContent: {
    flexGrow: 1,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  languageToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  languageButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  languageButtonActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  languageButtonText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  languageButtonTextActive: {
    color: colors.accent,
  },
  button: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonText: {
    ...typography.body,
    color: colors.text,
  },
  buttonSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  buttonArrow: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  logoutButton: {
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  logoutButtonText: {
    ...typography.button,
    color: colors.accent,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: colors.coral,
    backgroundColor: colors.coralLight,
  },
  deleteButtonText: {
    ...typography.button,
    color: colors.coral,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
