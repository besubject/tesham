import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { initI18n } from '@mettig/shared';
import App from './App';
import './styles/index.scss';

initI18n('ru');

const rootElement = document.getElementById('root');

if (rootElement == null) {
  throw new Error('Root element #root was not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <MantineProvider>
      <App />
    </MantineProvider>
  </React.StrictMode>,
);
