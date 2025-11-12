import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useCurrentAccount, useSignPersonalMessage, useSuiClient } from '@mysten/dapp-kit';
import { SessionKey } from '@mysten/seal';
import {
  loadSessionKey,
  saveSessionKey,
  clearSessionKey,
  clearAllExpiredSessions
} from '../utils/sessionStorage';

interface SessionKeyContextProps {
  sessionKey: SessionKey | null;
  isInitializing: boolean;
  error: Error | null;
  clearSession: () => void;
  initializeManually: () => Promise<void>;
}

const SessionKeyContext = createContext<SessionKeyContextProps | undefined>(undefined);

const PACKAGE_ID = '0xdf7ed29b942c2bf66c544bd2cf9714a7c90198ef552d74dd79ff2b8bba3af290';
const TTL_MINUTES = 30;

export const SessionKeyProvider = ({ children }: { children: ReactNode }) => {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const clearSession = () => {
    if (currentAccount?.address) {
      clearSessionKey(currentAccount.address, PACKAGE_ID);
      setSessionKey(null);
    }
  };

  useEffect(() => {
    clearAllExpiredSessions();
  }, []);

  const initializeManually = async () => {
    if (!currentAccount?.address) {
      setSessionKey(null);
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const newSessionKey = await SessionKey.create({
        address: currentAccount.address,
        packageId: PACKAGE_ID,
        ttlMin: TTL_MINUTES,
        suiClient,
      });

      const message = await signPersonalMessage({
        message: newSessionKey.getPersonalMessage(),
      });

      await newSessionKey.setPersonalMessageSignature(message.signature);

      saveSessionKey(currentAccount.address, PACKAGE_ID, newSessionKey);
      console.log('New session key created and saved');

      setSessionKey(newSessionKey);
    } catch (err) {
      console.error('Error initializing session key:', err);
      setError(err instanceof Error ? err : new Error('Failed to initialize session key'));
      setSessionKey(null);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    const loadCachedSession = async () => {
      if (!currentAccount?.address) {
        setSessionKey(null);
        return;
      }

      const cachedSessionData = loadSessionKey(currentAccount.address, PACKAGE_ID);

      if (cachedSessionData) {
        console.log('Loading cached session key');
        try {
          const restoredSessionKey = SessionKey.import(cachedSessionData, suiClient);

          if (!restoredSessionKey.isExpired()) {
            setSessionKey(restoredSessionKey);
            console.log('Successfully loaded cached session key');
            return;
          } else {
            console.log('Cached session key is expired, manual initialization required');
            clearSessionKey(currentAccount.address, PACKAGE_ID);
            setSessionKey(null);
          }
        } catch (error) {
          console.error('Failed to import cached session key:', error);
          clearSessionKey(currentAccount.address, PACKAGE_ID);
          setSessionKey(null);
        }
      } else {
        console.log('No cached session key found, manual initialization required');
        setSessionKey(null);
      }
    };

    loadCachedSession();
  }, [currentAccount?.address, suiClient]);

  useEffect(() => {
    if (!currentAccount?.address && sessionKey) {
      console.log('Wallet disconnected, clearing session');
      setSessionKey(null);
    }
  }, [currentAccount?.address, sessionKey]);

  return (
    <SessionKeyContext.Provider value={{ sessionKey, isInitializing, error, clearSession, initializeManually }}>
      {children}
    </SessionKeyContext.Provider>
  );
};

export const useSessionKey = () => {
  const context = useContext(SessionKeyContext);
  if (context === undefined) {
    throw new Error('useSessionKey must be used within a SessionKeyProvider');
  }
  return context;
};