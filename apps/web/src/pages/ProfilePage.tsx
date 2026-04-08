import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, type UserLanguage } from '@mettig/shared';
import './ProfilePage.css';

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
    <div className="profile-page">
      <div className="page-header">
        <h1 className="page-title">Профиль</h1>
        <p className="page-subtitle">Управление вашим профилем</p>
      </div>

      <div className="profile-container">
        <div className="profile-card">
          <h2 className="card-title">Информация профиля</h2>

          <form onSubmit={handleUpdateProfile} className="profile-form">
            <div className="form-group">
              <label htmlFor="phone" className="form-label">
                Номер телефона
              </label>
              <input
                id="phone"
                type="tel"
                value={user?.phone || ''}
                className="form-input"
                disabled
                readOnly
              />
              <p className="form-hint">Телефон невозможно изменить</p>
            </div>

            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Ваше имя
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Введите ваше имя"
                className="form-input"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="language" className="form-label">
                Язык интерфейса
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as UserLanguage)}
                className="form-input"
                disabled={loading}
              >
                <option value="ru">Русский</option>
                <option value="ce">Чеченский</option>
              </select>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? 'Сохраняю...' : 'Сохранить изменения'}
            </button>
          </form>
        </div>

        <div className="profile-card danger-zone">
          <h2 className="card-title">Безопасность</h2>

          <div className="logout-section">
            <p className="section-description">Выход из аккаунта</p>
            <button
              className="logout-btn"
              onClick={handleLogout}
              disabled={loading}
            >
              Выход
            </button>
          </div>

          <div className="delete-section">
            <p className="section-description">Удаление аккаунта</p>
            <p className="delete-warning">
              Это действие необратимо. Все ваши данные будут удалены.
            </p>

            {!showDeleteConfirm ? (
              <button
                className="delete-btn"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                Удалить аккаунт
              </button>
            ) : (
              <div className="delete-confirm">
                <p className="confirm-message">Вы уверены? Это действие необратимо.</p>
                <div className="confirm-buttons">
                  <button
                    className="cancel-btn"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={loading}
                  >
                    Отмена
                  </button>
                  <button
                    className="confirm-delete-btn"
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
