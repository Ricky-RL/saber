import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Extension from '../src/pages/Extension'
import { AuthProvider } from '../src/contexts/Auth'
import '../src/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Extension />
    </AuthProvider>
  </StrictMode>,
)
