import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { Amplify } from 'aws-amplify'

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_GnCIG73ys',
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '1obcsv8bdepedripltq6j7n6c7',
      loginWith: {
        email: true,
      }
    }
  }
});

createRoot(document.getElementById('root')).render(
    <App />,
)
