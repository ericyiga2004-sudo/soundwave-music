import "./tailwind.css";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.tailwind.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    
    <BrowserRouter>

    <App />
    </BrowserRouter>
  </StrictMode>,
)
