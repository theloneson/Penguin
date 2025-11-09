import { Button } from "../components/ui/button";
import mascot from "@/assets/mascot.jpg";
import { useCurrentAccount } from "@mysten/dapp-kit";

interface HeroProps {
  onStartChatting: () => void;
}

const Hero = ({ onStartChatting }: HeroProps) => {
  const currentAccount = useCurrentAccount();

  const handleStartChatting = () => {
    onStartChatting(); 
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-vibrant-blue overflow-hidden">
      <div className="container mx-auto px-6 py-32 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="text-left space-y-8">
            <h1 className="text-6xl md:text-8xl font-black italic leading-[0.9] text-black">
              CHAT, CHILL, <br />
              <span className="text-white">AND VIBE</span>
            </h1>
            <p className="text-2xl md:text-3xl font-semibold text-black max-w-xl">
              Where connection meets comfort in your own virtual penguin world
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                onClick={handleStartChatting}
                className="bg-black text-white hover:bg-black/90 text-xl px-10 py-7 rounded-full font-bold transform hover:translate-y-[-4px] transition-all duration-200"
                style={{ boxShadow: '0 8px 0 0 rgba(0,0,0,0.8)' }}
              >
                START CHATTING
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-4 border-black bg-white text-black hover:bg-black hover:text-white text-xl px-10 py-7 rounded-full font-bold transform hover:translate-y-[-4px] transition-all duration-200"
                style={{ boxShadow: '0 8px 0 0 rgba(0,0,0,0.8)' }}
              >
                LEARN MORE
              </Button>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="relative transform hover:translate-y-[-8px] transition-transform duration-300">
              <img 
                src={mascot} 
                alt="PenguinChat Mascot" 
                className="w-full max-w-lg rounded-[4rem] border-4 border-black animate-float"
                style={{ 
                  boxShadow: '0 20px 0 0 rgba(0,0,0,0.8), 0 30px 60px rgba(0,0,0,0.3)' 
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;