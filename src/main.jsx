import * as React from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/600.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@xyflow/react/dist/style.css';
import './index.css';

import App from './App.jsx';
import { AuthGate } from './auth/AuthGate.jsx';

class Boundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err) {
    console.error(err);
  }
  render() {
    if (this.state.err)
      return (
        <div className="grid h-full place-items-center p-6 text-center text-fg2">
          <div>
            <b className="text-[15px] text-fg">Vult hit a problem drawing this view.</b>
            <p className="mt-1.5">Reload the page to start again.</p>
          </div>
        </div>
      );
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Boundary>
      <AuthGate>
        <App />
      </AuthGate>
    </Boundary>
  </React.StrictMode>
);
