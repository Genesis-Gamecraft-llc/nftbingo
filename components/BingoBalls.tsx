"use client";

import { motion } from "framer-motion";

export default function BingoBalls() {
  const balls = [
    { color: "bg-pink-500", size: 60, x: -100, y: 50, delay: 0 },
    { color: "bg-blue-500", size: 80, x: 200, y: -100, delay: 1 },
    { color: "bg-yellow-400", size: 70, x: 400, y: 120, delay: 2 },
    { color: "bg-fuchsia-500", size: 50, x: -250, y: -150, delay: 3 },
    { color: "bg-indigo-500", size: 90, x: 300, y: 180, delay: 1.5 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {balls.map((ball, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${ball.color} opacity-40 blur-sm`}
          style={{
            width: ball.size,
            height: ball.size,
            left: `calc(50% + ${ball.x}px)`,
            top: `calc(50% + ${ball.y}px)`,
          }}
          animate={{
            y: [ball.y, ball.y - 40, ball.y],
            x: [ball.x, ball.x + 20, ball.x],
            scale: [1, 1.1, 1],
          }}
          transition={{
            repeat: Infinity,
            duration: 8,
            ease: "easeInOut",
            delay: ball.delay,
          }}
        />
      ))}
    </div>
  );
}
