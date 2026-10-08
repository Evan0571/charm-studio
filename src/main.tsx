import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
const App = lazy(() => import('./App'));
const AssetStudio = lazy(() => import('./AssetStudio'));
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Suspense fallback={<p>正在加载 LOOP…</p>}>{location.pathname === '/asset-studio' ? <AssetStudio /> : <App/>}</Suspense></React.StrictMode>);
