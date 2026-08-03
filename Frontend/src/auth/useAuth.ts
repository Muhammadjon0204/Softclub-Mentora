import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from './authContext';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth должен вызываться внутри <AuthProvider>');
  }
  return context;
}
