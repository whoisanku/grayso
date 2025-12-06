// Web-safe KeyboardProvider - web doesn't need native keyboard controller
import React from 'react';

interface KeyboardProviderProps {
  children: React.ReactNode;
  statusBarTranslucent?: boolean;
  navigationBarTranslucent?: boolean;
}

export const KeyboardProvider: React.FC<KeyboardProviderProps> = ({ children }) => {
  return <>{children}</>;
};
