import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './core/auth';
import './index.css';

// AuthProvider sits outside App because it decides *whether* App renders: while
// it is working out who is signed in and fetching their rows, App must not
// mount — every module reads the database synchronously as it renders, so
// mounting early would paint the wrong account's numbers and then jump.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
