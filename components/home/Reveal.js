"use client";

import { motion } from "framer-motion";

const riseVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: (delay) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: (delay || 0) / 1000 },
  }),
};

export default function Reveal({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -10% 0px" }}
      custom={delay}
      variants={riseVariants}
    >
      {children}
    </motion.div>
  );
}
