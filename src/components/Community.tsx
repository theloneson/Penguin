import { Button } from "../components/ui/button";

// Import your custom community icons
import activeUsersIcon from "@/assets/active-users-icon.png";
import messagesSentIcon from "@/assets/messages-sent-icon.png";
import friendshipsMadeIcon from "@/assets/friendships-made-icon.png";

const Community = () => {
  const stats = [
    { 
      icon: activeUsersIcon, 
      value: "10K+", 
      label: "ACTIVE USERS", 
      color: "bg-vibrant-orange" 
    },
    { 
      icon: messagesSentIcon, 
      value: "1M+", 
      label: "MESSAGES SENT", 
      color: "bg-vibrant-yellow" 
    },
    { 
      icon: friendshipsMadeIcon, 
      value: "50K+", 
      label: "FRIENDSHIPS MADE", 
      color: "bg-vibrant-pink" 
    },
  ];

  return (
    <section id="community" className="py-24 bg-vibrant-black">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-7xl font-black italic mb-6 text-white">
            JOIN THE <br />
            <span className="text-vibrant-green italic">PENGUIN COMMUNITY</span>
          </h2>
          <p className="text-2xl font-semibold text-white max-w-2xl mx-auto">
            Thousands of penguins are already vibing. Be part of something special.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className={`${stat.color} p-12 rounded-[2rem] border-4 border-black text-center card-3d transition-all duration-300 hover:scale-105 group`}
            >
              {/* Your Custom Community Icon with Hover Effects */}
              <img 
                src={stat.icon} 
                alt={stat.label}
                className="w-24 h-24 mx-auto mb-4 transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300" 
              />
              <div className="text-6xl font-black italic mb-2 text-black">{stat.value}</div>
              <div className="text-xl font-bold text-black">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button 
            size="lg" 
            className="bg-vibrant-purple hover:bg-vibrant-purple/90 text-black border-4 border-black text-2xl px-12 py-8 rounded-full font-black btn-3d transition-all duration-300 hover:scale-105"
          >
            START YOUR JOURNEY
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Community;