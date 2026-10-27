import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerWapperServiceWorker } from './serviceWorker.ts';

registerWapperServiceWorker();

createRoot(document.getElementById('root')!).render(<App />);
