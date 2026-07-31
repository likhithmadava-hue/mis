import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { bootStorage } from './core/db';
import './index.css';

// ── Accounts / login are commented out ───────────────────────────────────
// AuthProvider used to wrap App because it decided *whether* App rendered:
// while it worked out who was signed in and fetched their rows, App had to
// stay unmounted. With no accounts there is nothing to wait for. Uncomment
// the import and the two wrapper lines to bring it back — the restore steps
// are listed in full at the top of App.tsx.
// import { AuthProvider } from './core/auth';

// When MIS is opened through the desktop shortcut, the local vault host serves
// this page and owns the encrypted data folder on disk. bootStorage() pulls
// that vault into the storage cache *before* anything mounts — every module
// reads the database synchronously as it renders, so the data has to be in
// place first. With no host (dev server / file open) it returns immediately and
// storage stays on localStorage.
bootStorage().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      {/* <AuthProvider> */}
      <App />
      {/* </AuthProvider> */}
    </React.StrictMode>
  );
});
