import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { ToastProvider } from './context/ToastContext.tsx';
import { NetworkResilienceProvider } from './context/NetworkResilienceContext.tsx';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <NetworkResilienceProvider>
      <App />
    </NetworkResilienceProvider>
  </ToastProvider>
);
