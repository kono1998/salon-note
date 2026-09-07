import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ConfirmPage from './ConfirmPage.jsx'
import './index.css'

// /confirmed パスのときだけ認証完了ページを表示
const isConfirmPage = window.location.pathname === '/confirmed'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isConfirmPage ? <ConfirmPage /> : <App />}
  </React.StrictMode>,
)
