import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { TaskProvider } from './context/TaskContext.jsx'
import { OrgProvider } from './context/OrgContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OrgProvider>
      <TaskProvider>
        <App />
      </TaskProvider>
    </OrgProvider>
  </React.StrictMode>,
)
