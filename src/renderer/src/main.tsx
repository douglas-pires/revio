// biome-ignore lint/correctness/noUnresolvedImports: @types/react declares StrictMode through its namespace, which Biome's resolver does not follow.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app.component.tsx'
import './styles.css'

const root = document.querySelector('#root')
if (!root) {
  throw new Error('index.html has no #root element')
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
