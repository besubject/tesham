import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, type UserLanguage } from '@mettig/shared';
import styles from './ProfilePage.module.scss';

function ProfilePage(): React.JSX.Element {
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
    } catch (err) {
      setError('Не удалось обновить профиль');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      navigate('/login');
    } catch (err) {
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
    } catch (err) {
      setError('Не удалось удалить аккаунт');
      setLoading(false);
    }
  };

  return (
    <div className={styles.profilePage}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Профиль</h1>
        <p className={styles.pageSubtitle}>Управление вашим профилем</p>
      </div>

      <div className={styles.profileContainer}>
        <div className={styles.profileCard}>
          <h2 className={styles.cardTitle}>Информация профиля</h2>

          <form onSubmit={handleUpdateProfile} className={styles.profileForm}>
            <div className={styles.formGroup}>
              <label htmlFor="phone" className={styles.formLabel}>
                Номер телефона
              </label>
              <input
                id="phone"
                type="tel"
                value={user?.phone || ''}
                className={styles.formInput}
                disabled
                readOnly
              />
              <p className={styles.formHint}>Телефон невозможно изменить</p>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="name" className={styles.formLabel}>
                Ваше имя
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Введите ваше имя"
                className={styles.formInput}
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="language" className={styles.formLabel}>
                Язык интерфейса
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as UserLanguage)}
                className={styles.formInput}
                disabled={loading}
              >
                <option value="ru">Русский</option>
                <option value="ce">Чеченский</option>
              </select>
            </div>

            {error && <div className={styles.errorMessage}>{error}</div>}
            {success && <div className={styles.successMessage}>{success}</div>}

            <button type="submit" className={styles.saveBtn} disabled={loading}>
              {loading ? 'Сохраняю...' : 'Сохранить изменения'}
            </button>
          </form>
        </div>

        <div className={[styles.profileCard, styles.dangerZone].join(' ')}>
          <h2 className={styles.cardTitle}>Безопасность</h2>

          <div className={styles.logoutSection}>
            <p className={styles.sectionDescription}>Выход из аккаунта</p>
            <button
              className={styles.logoutBtn}
              onClick={handleLogout}
              disabled={loading}
            >
              Выход
            </button>
          </div>

          <div className={styles.deleteSection}>
            <p className={styles.sectionDescription}>Удаление аккаунта</p>
            <p className={styles.deleteWarning}>
              Это действие необратимо. Все ваши данные будут удалены.
            </p>

            {!showDeleteConfirm ? (
              <button
                className={styles.deleteBtn}
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                Удалить аккаунт
              </button>
            ) : (
              <div className={styles.deleteConfirm}>
                <p className={styles.confirmMessage}>Вы уверены? Это действие необратимо.</p>
                <div className={styles.confirmButtons}>
                  <button
                    className={styles.cancelBtn}
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={loading}
                  >
                    Отмена
                  </button>
                  <button
                    className={styles.confirmDeleteBtn}
                    onClick={handleDeleteAccount}
                    disabled={loading}
                  >
                    {loading ? 'Удаляю...' : 'Да, удалить'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
