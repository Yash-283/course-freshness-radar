import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

function start() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Prototype build only (VITE_MOCK=1): use sample data instead of the real server
if (import.meta.env.VITE_MOCK === '1') {
  import('./mock.js').then(({ installMock }) => { installMock(); start(); });
} else {
  start();
}
