'use client';

import { motion, HTMLMotionProps, type Variants } from 'framer-motion';
import { ReactNode } from 'react';

interface AnimatedWrapperProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  variants?: Variants;
  className?: string;
}

export function AnimatedWrapper({
  children,
  variants,
  className = '',
  ...props
}: AnimatedWrapperProps) {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function FadeIn({ children, className = '', ...props }: Omit<AnimatedWrapperProps, 'variants'>) {
  return (
    <AnimatedWrapper
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }}
      className={className}
      {...props}
    >
      {children}
    </AnimatedWrapper>
  );
}

export function FadeInUp({ children, className = '', delay = 0, ...props }: Omit<AnimatedWrapperProps, 'variants'> & { delay?: number }) {
  return (
    <AnimatedWrapper
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: { duration: 0.4, ease: 'easeOut', delay }
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </AnimatedWrapper>
  );
}

export function FadeInDown({ children, className = '', delay = 0, ...props }: Omit<AnimatedWrapperProps, 'variants'> & { delay?: number }) {
  return (
    <AnimatedWrapper
      variants={{
        hidden: { opacity: 0, y: -20 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: { duration: 0.4, ease: 'easeOut', delay }
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </AnimatedWrapper>
  );
}

export function ScaleIn({ children, className = '', ...props }: Omit<AnimatedWrapperProps, 'variants'>) {
  return (
    <AnimatedWrapper
      variants={{
        hidden: { opacity: 0, scale: 0.9 },
        visible: { 
          opacity: 1, 
          scale: 1,
          transition: { duration: 0.3, ease: 'easeOut' }
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </AnimatedWrapper>
  );
}

export function StaggerContainer({ children, className = '', ...props }: Omit<AnimatedWrapperProps, 'variants'>) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1,
          },
        },
      }}
      initial="hidden"
      animate="visible"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '', ...props }: Omit<AnimatedWrapperProps, 'variants'>) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: { duration: 0.3 }
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
