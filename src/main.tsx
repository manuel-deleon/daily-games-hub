import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,     // 2 min: data considered "fresh"
      gcTime: 10 * 60 * 1000,        // 10 min: keep in cache
      refetchOnWindowFocus: false,    // Don't re-fetch when switching tabs
      retry: 1,
    },
  },
})

export { queryClient }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
