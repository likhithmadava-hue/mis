import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// ── Accounts / login are commented out ───────────────────────────────────
// AuthProvider used to wrap App because it decided *whether* App rendered:
// while it worked out who was signed in and fetched their rows, App had to
// stay unmounted. With no accounts there is nothing to wait for. Uncomment
// the import and the two wrapper lines to bring it back — the restore steps
// are listed in full at the top of App.tsx.
// import { AuthProvider } from './core/auth';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* <AuthProvider> */}
    <App />
    {/* </AuthProvider> */}
  </React.StrictMode>
);
