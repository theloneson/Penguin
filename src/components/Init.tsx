import { useState, useEffect } from "react";
import {
  useConnectWallet,
  useCurrentAccount,
  useWallets,
  ConnectModal
} from "@mysten/dapp-kit";
import {
  isEnokiWallet,
  type EnokiWallet,
  type AuthProvider,
} from "@mysten/enoki";
import { motion } from 'framer-motion';
import { FaWallet, FaGoogle, FaSpinner } from 'react-icons/fa';
import DesktopLayout from "./DesktopLayout";
import { useMessaging } from '../hooks/useMessaging';
import { useSessionKey } from '../providers/SessionKeyProvider';

// Import Loveable.dev components
import Navigation from "./Navigation";
import Hero from "./Hero";
import Features from "./Features";
import About from "./About";
import Community from "./Community";
import Footer from "./Footer";

export function Init() {
  const currentAccount = useCurrentAccount();
  const [open, setOpen] = useState(false);
  const [showWalletFlow, setShowWalletFlow] = useState(false);
  const { mutate: connect } = useConnectWallet();
  const { sessionKey, isInitializing, initializeManually } = useSessionKey();
  const { isReady } = useMessaging();

  useEffect(() => {
    if (showWalletFlow && currentAccount && !sessionKey && !isInitializing) {
      initializeManually();
    }
  }, [showWalletFlow, currentAccount, sessionKey, isInitializing, initializeManually]);

  const wallets = useWallets().filter(isEnokiWallet);
  const walletsByProvider = wallets.reduce(
    (map, wallet) => map.set(wallet.provider, wallet),
    new Map<AuthProvider, EnokiWallet>()
  );

  const googleWallet = walletsByProvider.get("google");

  const handleOpenConnectModal = () => {
    setOpen(true);
  };

  const handleStartChatting = () => {
    setShowWalletFlow(true);
    if (!currentAccount) {
      setOpen(true);
    }
  };

  // If user is fully connected and ready, show the main app
  if (currentAccount && sessionKey && isReady) {
    return <DesktopLayout />;
  }

  // Only show wallet flow if user has initiated connection
  if (showWalletFlow) {
    // If user needs to sign session key
    if (currentAccount && !sessionKey && !isInitializing) {
      return (
        <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center titillium-web-regular">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-700/30">
              <FaWallet className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-200 mb-3 titillium-web-bold">Sign Session Key</h2>
            <p className="text-gray-400 text-base mb-8 max-w-md">
              To enable secure messaging, please sign a session key. This allows the app to encrypt and decrypt messages for 30 minutes without repeated confirmations.
            </p>
            <div className="space-y-4 max-w-sm mx-auto">
              <motion.button
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 border border-indigo-400 transition-colors group"
                onClick={initializeManually}
                disabled={isInitializing}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex-shrink-0">
                  <FaWallet className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-medium titillium-web-regular">
                  {isInitializing ? 'SIGNING...' : 'SIGN SESSION KEY'}
                </span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      );
    }

    // Loading when initializing session
    if (currentAccount && isInitializing) {
      return (
        <div className="w-full h-full bg-white flex flex-col items-center justify-center titillium-web-regular px-6">
          <motion.div
            className="max-w-md w-full text-center px-10 py-12 bg-white rounded-[2rem] border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,0.15)]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className="w-20 h-20 rounded-full bg-vibrant-purple border-4 border-black flex items-center justify-center mx-auto mb-6">
              <FaSpinner className="w-8 h-8 text-black animate-spin" />
            </div>
            <h2 className="text-2xl font-black text-black mb-3 titillium-web-bold">Initializing...</h2>
            <p className="text-black/70 text-base font-bold mb-6">
              Sign to set up your secure messaging session. This only takes a moment.
            </p>
          </motion.div>
        </div>
      );
    }
  }

  // MAIN LANDING PAGE - Show this first by default!
  return (
    <div className="min-h-screen">
      <Navigation 
        onConnectWallet={() => {
          setShowWalletFlow(true);
          if (!currentAccount) {
            setOpen(true);
          }
        }} 
        onOpenConnectModal={handleOpenConnectModal}
      />
      <Hero onStartChatting={handleStartChatting} />
      <Features />
      <About />
      <Community />
      <Footer />
      
      {/* Wallet Connection Modal */}
      <ConnectModal
        trigger={<button className="hidden">Connect Wallet</button>}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

export default Init;