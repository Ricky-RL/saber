import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Extension from '@/pages/Extension'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Extension />
  </StrictMode>,
)
