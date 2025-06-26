import Link from "next/link";
import React, { useState, useEffect } from "react";
import Settings from "./Settings";

type NavigationProps = {
  logo: string;
  title: string;
  navigation: {
    link: { title: string; href: string }[];
  };
};

const Navigation: React.FC<NavigationProps> = ({ logo, title, navigation }) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [aiModel, setAIModel] = useState<string>("gemini-2.0-flash");

  const getAIModel = (e: React.SyntheticEvent) => {
    setAIModel((e.target as HTMLInputElement).value);
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleMenuToggle = (menuName: string) => {
    if (isMobile) {
      setActiveMenu(activeMenu === menuName ? null : menuName);
    }
  };

  const handleMouseEnter = (menuName: string) => {
    if (!isMobile) {
      setActiveMenu(menuName);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setActiveMenu(null);
    }
  };

  return (
    <div className="w-full">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          
          {/* Logo and Title */}
          <div className="flex items-center gap-4">
            {logo && (
              <img src={logo} alt="Logo" className="h-10 w-auto" />
            )}
            <h1 className="text-xl font-semibold">{title}</h1>
          </div>

          <Settings model={aiModel} setAIModel={getAIModel} />
        </div>

        {/* Navigation Links */}
        {navigation?.link?.length > 0 && (
          <nav className="mt-4">
            <ul className="flex gap-4">
              {navigation.link.map((link) => (
                <li key={link.title}>
                  <Link href={link.href} className="hover:underline">
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
};

export default Navigation;
