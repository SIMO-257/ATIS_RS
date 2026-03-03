import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import QuestionnaireForm from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QuestionnaireForm />
  </StrictMode>,
)
