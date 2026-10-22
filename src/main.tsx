import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import { restoreViewPreference } from './view-preference';

restoreViewPreference();
createRoot(document.getElementById('root')!).render(<App />);
