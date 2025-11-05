import { Button } from "../components/ui/button";
import logoLight from "@/assets/logo-light.png";
import { useCurrentAccount, useWallets, useConnectWallet } from "@mysten/dapp-kit";
import { isEnokiWallet } from "@mysten/enoki";
import { motion } from 'framer-motion';

// Import your custom icons
import walletIcon from "@/assets/wallet-icon.png";
import googleIcon from "@/assets/google-icon.png";

interface NavigationProps {
  onConnectWallet: () => void;
  onOpenConnectModal: () => void;
}

const Navigation = ({ onConnectWallet, onOpenConnectModal }: NavigationProps) => {
  const currentAccount = useCurrentAccount();
  const { mutate: connect } = useConnectWallet();
  const wallets = useWallets().filter(isEnokiWallet);
  const googleWallet = wallets.find(wallet => wallet.provider === "google");

  const handleWalletConnect = () => {
    onConnectWallet();
    onOpenConnectModal();
  };

  const handleGoogleSignIn = () => {
    onConnectWallet();
    if (googleWallet) {
      connect({ wallet: googleWallet });
    }
  };

  if (currentAccount) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b-4 border-black">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <img src={logoLight} alt="PenguinChat" className="h-12" />
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-black font-bold text-lg hover:text-vibrant-purple transition-colors">
                FEATURES
              </a>
              <a href="#about" className="text-black font-bold text-lg hover:text-vibrant-purple transition-colors">
                ABOUT
              </a>
              <a href="#community" className="text-black font-bold text-lg hover:text-vibrant-purple transition-colors">
                COMMUNITY
              </a>
            </div>
            {/* Connected State - Small Penguin Style */}
            <div className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-[2rem] border-3 border-black shadow-lg relative overflow-hidden group">
              <div className="absolute inset-0 bg-vibrant-green rounded-[2rem] transform scale-x-100 transition-transform duration-300" />
              <img src={walletIcon} alt="Wallet" className="w-7 h-7 transform z-10" />
              <span className="font-bold text-sm z-10 relative">CONNECTED</span>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b-4 border-black">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <img src={logoLight} alt="PenguinChat" className="h-12" />
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-black font-bold text-lg hover:text-vibrant-purple transition-colors">
              FEATURES
            </a>
            <a href="#about" className="text-black font-bold text-lg hover:text-vibrant-purple transition-colors">
              ABOUT
            </a>
            <a href="#community" className="text-black font-bold text-lg hover:text-vibrant-purple transition-colors">
              COMMUNITY
            </a>
          </div>
          
          <div className="flex gap-2">
            {/* Wallet Button - Small Penguin Style */}
            <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
              <button 
                onClick={handleWalletConnect}
                className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-[2rem] border-3 border-black shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden"
              >
                {/* Animated gradient border glow */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-vibrant-green to-emerald-400 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur group-hover:blur-0" />
                {/* Animated fill effect */}
                <div className="absolute inset-0 bg-vibrant-green rounded-[2rem] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                
                {/* Big icon in small button */}
                <img 
                  src={walletIcon} 
                  alt="Wallet" 
                  className="w-8 h-8 transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 z-10" 
                />
                <span className="font-bold text-sm z-10 relative">CONNECT WALLET</span>
              </button>
            </motion.div>

            {/* Google Button - Small Penguin Style */}
            {googleWallet && (
              <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                <button 
                  onClick={handleGoogleSignIn}
                  className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-[2rem] border-3 border-black shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden"
                >
                  {/* Animated gradient border glow */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-vibrant-purple to-purple-500 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur group-hover:blur-0" />
                  {/* Animated fill effect */}
                  <div className="absolute inset-0 bg-vibrant-purple rounded-[2rem] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                  
                  {/* Big icon in small button */}
                  <img 
                    src={googleIcon} 
                    alt="Google" 
                    className="w-8 h-8 transform group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 z-10" 
                  />
                  <span className="font-bold text-sm z-10 relative">SIGN IN WITH GOOGLE</span>
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;