import logoLight from "@/assets/logo-light.png";
import { Twitter, Github, MessageCircle, Instagram, Youtube } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-vibrant-green py-16 border-t-4 border-black">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-12 gap-12 mb-16">
          {/* Logo and CTA Section */}
          <div className="lg:col-span-7 space-y-8">
            <div className="text-6xl md:text-7xl font-black italic text-black">
              GET <br />
              <span className="text-white italic">PENGUIN</span>
            </div>
            <p className="text-2xl font-bold text-black max-w-md">
              Download Penguin. <br />
              Then make it all happen.
            </p>
          </div>

          {/* Links Section */}
          <div className="lg:col-span-5">
            <div className="grid grid-cols-2 gap-12">
              <div>
                <h4 className="font-black text-xl mb-6 text-black">NAVIGATE</h4>
                <ul className="space-y-4">
                  <li>
                    <a href="/" className="text-black font-bold hover:text-white transition-colors text-lg">
                      HOME
                    </a>
                  </li>
                  <li>
                    <a href="#features" className="text-black font-bold hover:text-white transition-colors text-lg">
                      FEATURES
                    </a>
                  </li>
                  <li>
                    <a href="#about" className="text-black font-bold hover:text-white transition-colors text-lg">
                      ABOUT
                    </a>
                  </li>
                  <li>
                    <a href="#community" className="text-black font-bold hover:text-white transition-colors text-lg">
                      COMMUNITY
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-black text-xl mb-6 text-black">LEGAL</h4>
                <ul className="space-y-4">
                  <li>
                    <a href="#" className="text-black font-bold hover:text-white transition-colors text-lg">
                      PRIVACY NOTICE
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-black font-bold hover:text-white transition-colors text-lg">
                      TERMS OF SERVICE
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Social Icons */}
        <div className="flex flex-wrap gap-4 mb-12">
          <a href="#" className="bg-white rounded-3xl p-6 border-4 border-black social-3d">
            <MessageCircle className="w-8 h-8 text-black" />
          </a>
          <a href="#" className="bg-white rounded-3xl p-6 border-4 border-black social-3d">
            <Twitter className="w-8 h-8 text-black" />
          </a>
          <a href="#" className="bg-white rounded-3xl p-6 border-4 border-black social-3d">
            <Instagram className="w-8 h-8 text-black" />
          </a>
          <a href="#" className="bg-white rounded-3xl p-6 border-4 border-black social-3d">
            <Youtube className="w-8 h-8 text-black" />
          </a>
        </div>

        {/* Copyright */}
        <div className="text-black font-bold text-lg">
          © 2025 PENGUIN, INC.
        </div>
      </div>
    </footer>
  );
};

export default Footer;