import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import './styles/index.css'

const isDev = import.meta.env.DEV
const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
}

ReactDOM.createRoot(document.getElementById('root')).render(
  isDev ? (
    <React.StrictMode>
      <BrowserRouter future={routerFuture}>
        <AuthProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  ) : (
    <BrowserRouter future={routerFuture}>
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  ),
)
