import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ConfirmPage from './ConfirmPage.jsx'
import LegalNotice from './LegalNotice.jsx'
import './index.css'

// /confirmed パスのときだけ認証完了ページを表示
const isConfirmPage = window.location.pathname === '/confirmed'
// /legal パスのときは特定商取引法に基づく表記を表示
const isLegalPage = window.location.pathname === '/legal'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isConfirmPage ? <ConfirmPage /> : isLegalPage ? <LegalNotice /> : <App />}
  </React.StrictMode>,
)
