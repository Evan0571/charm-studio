import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { LanguageProvider, useLanguage } from './Language';
const App = lazy(() => import('./App'));
const AssetStudio = lazy(() => import('./AssetStudio'));
function Loading() { const { tr } = useLanguage(); return <p>{tr('正在加载 LOOP…')}</p>; }
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LanguageProvider><Suspense fallback={<Loading/>}>{location.pathname === '/asset-studio' ? <AssetStudio /> : <App/>}</Suspense></LanguageProvider></React.StrictMode>);
