// Loader.tsx
import React, { useEffect, useState } from "react";

interface LoaderProps {
  isLoading: boolean;
}

const Loader: React.FC<LoaderProps> = ({ isLoading }) => {
  const colors = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B"];
  const statusMessages = [
    "Fetching Schema...",
    "Sending to AI...",
    "Generating Content...",
    "Hang On The Results Are On The Way..."
  ];

  const [colorIndex, setColorIndex] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) return;

    const colorInterval = setInterval(() => {
      setColorIndex((prev) => (prev + 1) % colors.length);
    }, 10000); // color change every 10s

    const statusInterval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statusMessages.length);
    }, 18000); // status text change every 8s

    return () => {
      clearInterval(colorInterval);
      clearInterval(statusInterval);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
      {/* Slightly blurred background */}
      <div className="absolute inset-0 bg-white/20 backdrop-blur-sm"></div>

      {/* Spinner with jumping ball */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Spinner Circle */}
        <div
          className="absolute w-16 h-16 border-3 border-t-transparent border-solid rounded-full animate-spin"
          style={{
            borderColor: `${colors[colorIndex]} transparent ${colors[colorIndex]} transparent`,
          }}
        />

        {/* Jumping Ball */}
        <div
          className="absolute bottom-0 w-5 h-5 rounded-full animate-bounce"
          style={{
            backgroundColor: colors[colorIndex],
            animationTimingFunction: "ease-in-out",
            transformOrigin: "center bottom",
          }}
        />
      </div>

      {/* Status Text */}
      <div className="absolute mt-28 text-gray-700 font-medium text-lg">
        {statusMessages[statusIndex]}
      </div>
    </div>
  );
};

export default Loader;
