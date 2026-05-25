'use client'

import { motion, type Variants } from 'framer-motion'

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

const staggerContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

interface ScrollRevealProps {
  children: React.ReactNode
  className?: string
  stagger?: boolean
}

export function ScrollReveal({ children, className, stagger = false }: ScrollRevealProps) {
  return (
    <motion.div
      className={className}
      variants={stagger ? staggerContainerVariants : fadeUpVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
    >
      {children}
    </motion.div>
  )
}

export function ScrollRevealItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div className={className} variants={fadeUpVariants}>
      {children}
    </motion.div>
  )
}
