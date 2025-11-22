import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './utils/registerSW'

// 只在开发环境使用StrictMode，避免生产环境中的双重请求
ReactDOM.createRoot(document.getElementById('root')!).render(
  import.meta.env.DEV ? (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ) : (
    <App />
  )
)

// 注册Service Worker（仅生产环境）
registerServiceWorker().then((registration) => {
  if (registration) {
    console.log('✅ PWA已启用，支持离线访问');
  }
}).catch((error) => {
  console.error('❌ PWA注册失败:', error);
}); 