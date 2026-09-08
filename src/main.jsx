import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ConfirmPage from './ConfirmPage.jsx'
import LegalNotice from './LegalNotice.jsx'
import CustomerForm from './CustomerForm.jsx'
import './index.css'

// /confirmed パスのときだけ認証完了ページを表示
const isConfirmPage = window.location.pathname === '/confirmed'
// /legal パスのときは特定商取引法に基づく表記を表示
const isLegalPage = window.location.pathname === '/legal'
// /register パスのときはお客様用の新規カルテ登録フォームを表示（QRコードから遷移）
const isRegisterPage = window.location.pathname === '/register'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isConfirmPage ? <ConfirmPage /> : isLegalPage ? <LegalNotice /> : isRegisterPage ? <CustomerForm /> : <App />}
  </React.StrictMode>,
)
