import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ConfirmPage from './ConfirmPage.jsx'
import CustomerForm from './CustomerForm.jsx'
import './index.css'

// /confirmed パスのときだけ認証完了ページを表示
const isConfirmPage = window.location.pathname === '/confirmed'
// /register パスのときはお客様自己登録フォームを表示（?salon=<オーナーのuser_id> でどのサロン宛か判定）
const isRegisterPage = window.location.pathname === '/register'
const salonId = new URLSearchParams(window.location.search).get('salon')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isConfirmPage ? <ConfirmPage />
      : isRegisterPage ? <CustomerForm salonId={salonId} />
      : <App />}
  </React.StrictMode>,
)
