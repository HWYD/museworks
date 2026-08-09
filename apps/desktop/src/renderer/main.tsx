import { createRoot } from 'react-dom/client';

import { App } from './app.js';
import './global.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing renderer root element');
}

createRoot(root).render(<App />);
