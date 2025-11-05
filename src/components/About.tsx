import logoIcon from "@/assets/logo-icon.png";

const About = () => {
  return (
    <section id="about" className="py-24 bg-vibrant-purple">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <h2 className="text-5xl md:text-7xl font-black italic text-black">
              ABOUT <br />
              <span className="text-white italic">PENGUIN</span>
            </h2>
            <div className="space-y-6 text-black text-xl font-semibold">
              <p>
                Penguin was born from a simple idea: what if online chatting could feel as cozy and fun as hanging out with friends in real life?
              </p>
              <p>
                Inspired by the early days of Club Penguin's predecessor, we're bringing back that nostalgic vibe of waddling around virtual rooms and chatting through text bubbles.
              </p>
              <p>
                No pressure, no complicated features - just pure connection and comfort in a world of friendly penguins.
              </p>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="bg-white p-12 rounded-[3rem] border-4 border-black card-3d">
              <img src={logoIcon} alt="Penguin" className="w-full max-w-sm mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;