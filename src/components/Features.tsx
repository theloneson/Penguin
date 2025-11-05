import chatBubble from "@/assets/chat-bubble.png";
import penguinSlide from "@/assets/penguin-slide.png";

// Import your custom feature icons
import realtimeChatIcon from "@/assets/realtime-chat-icon.png";
import virtualHangoutsIcon from "@/assets/virtual-hangouts-icon.png";
import safeSecureIcon from "@/assets/safe-secure-icon.png";
import fastSimpleIcon from "@/assets/fast-simple-icon.png";

const Features = () => {
  const features = [
    {
      icon: realtimeChatIcon,
      title: "REAL-TIME CHAT",
      description: "Connect instantly with friends through seamless text bubbles",
      color: "bg-vibrant-orange",
      iconSize: "w-24 h-24", // Standard size
    },
    {
      icon: virtualHangoutsIcon,
      title: "VIRTUAL HANGOUTS", 
      description: "Walk around rooms with your penguin avatar and meet new people",
      color: "bg-vibrant-yellow",
      iconSize: "w-28 h-28", // Bigger size for this one!
    },
    {
      icon: safeSecureIcon,
      title: "SAFE & SECURE",
      description: "Built with privacy and safety in mind for worry-free chatting",
      color: "bg-vibrant-blue",
      iconSize: "w-24 h-24", // Standard size
    },
    {
      icon: fastSimpleIcon,
      title: "FAST & SIMPLE",
      description: "No complicated setup - just jump in and start vibing",
      color: "bg-vibrant-purple",
      iconSize: "w-24 h-24", // Standard size
    },
  ];

  return (
    <section id="features" className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-7xl font-black italic mb-6 text-black">
            FEATURES BUILT FOR <br />
            <span className="text-vibrant-purple italic">COMFORT</span>
          </h2>
          <p className="text-2xl font-semibold text-black max-w-2xl mx-auto">
            Everything you need to connect, chat, and chill
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className={`${feature.color} p-8 rounded-[2rem] border-4 border-black card-3d transition-all duration-300 hover:scale-105`}
            >
              {/* Custom icon size for each feature */}
              <img 
                src={feature.icon} 
                alt={feature.title}
                className={`${feature.iconSize} mx-auto mb-4 transform hover:scale-110 transition-transform duration-300`} 
              />
              <h3 className="text-2xl font-black mb-3 text-black italic text-center">{feature.title}</h3>
              <p className="text-lg font-semibold text-black text-center">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Rest of the component remains the same */}
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-24">
          <div className="order-2 lg:order-1 bg-vibrant-yellow p-12 rounded-[3rem] border-4 border-black card-3d">
            <img src={chatBubble} alt="Chat Bubbles" className="w-full max-w-md mx-auto transform hover:scale-105 transition-transform duration-300" />
          </div>
          <div className="order-1 lg:order-2 space-y-6">
            <h3 className="text-5xl md:text-6xl font-black italic text-black">
              EXPRESS YOURSELF <br />
              <span className="text-vibrant-orange italic">FREELY</span>
            </h3>
            <p className="text-2xl font-semibold text-black">
              Chat bubbles that float above your penguin avatar make conversations feel natural and fun. No endless scrolling - just pure connection.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h3 className="text-5xl md:text-6xl font-black italic text-black">
              MOVE AROUND, <br />
              <span className="text-vibrant-green italic">EXPLORE, CONNECT</span>
            </h3>
            <p className="text-2xl font-semibold text-black">
              Your penguin avatar can waddle around virtual rooms, slide down icy slopes, and bump into friends. It's a whole vibe.
            </p>
          </div>
          <div className="bg-vibrant-blue p-12 rounded-[3rem] border-4 border-black card-3d">
            <img src={penguinSlide} alt="Penguin Sliding" className="w-full max-w-md mx-auto transform hover:scale-105 transition-transform duration-300" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;