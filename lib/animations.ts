import { Variants, Transition, MotionProps } from 'framer-motion';

// Animation presets for common UI patterns
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
};

export const scaleOut: Variants = {
  visible: { opacity: 1, scale: 1 },
  hidden: { 
    opacity: 0, 
    scale: 0.9,
    transition: { duration: 0.2, ease: 'easeIn' }
  },
};

export const slideIn: Variants = {
  hidden: { x: '100%' },
  visible: { 
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
};

export const slideOut: Variants = {
  visible: { x: 0 },
  hidden: { 
    x: '100%',
    transition: { duration: 0.3, ease: 'easeIn' }
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3 }
  },
};

// Micro-interaction animations
export const hoverScale: MotionProps = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.95 },
  transition: { duration: 0.2 },
};

export const hoverLift: MotionProps = {
  whileHover: { y: -4, boxShadow: '0 8px 25px rgba(0,0,0,0.15)' },
  transition: { duration: 0.2 },
};

export const buttonPress: MotionProps = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.1 },
};

export const cardHover: MotionProps = {
  whileHover: { 
    y: -8, 
    boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
    transition: { duration: 0.3 }
  },
};

// Transition presets
export const smoothTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

export const bouncyTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 10,
};

export const quickTransition: Transition = {
  duration: 0.2,
  ease: 'easeInOut',
};

// Page transition variants
export const pageTransition: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    x: 20,
    transition: { duration: 0.3, ease: 'easeIn' }
  },
};

// Modal variants
export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.3 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.2 }
  },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    scale: 0.9, 
    y: 20,
    transition: { duration: 0.2, ease: 'easeIn' }
  },
};

// List item variants
export const listItem: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3 }
  },
  exit: { 
    opacity: 0, 
    x: 20,
    transition: { duration: 0.2 }
  },
};

// Notification variants
export const notificationSlide: Variants = {
  hidden: { opacity: 0, x: 100, y: -50 },
  visible: { 
    opacity: 1, 
    x: 0, 
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    x: 100,
    transition: { duration: 0.3, ease: 'easeIn' }
  },
};

// Loading animation variants
export const pulse: Variants = {
  animate: {
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const spin: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

export const bounce: Variants = {
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Chart animation variants
export const chartBar: Variants = {
  hidden: { scaleY: 0 },
  visible: { 
    scaleY: 1,
    transition: { duration: 0.5, ease: 'easeOut' }
  },
};

export const chartLine: Variants = {
  hidden: { pathLength: 0 },
  visible: { 
    pathLength: 1,
    transition: { duration: 1, ease: 'easeOut' }
  },
};

// Dashboard widget variants
export const widgetEnter: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  },
};

// Tab content variants
export const tabContent: Variants = {
  hidden: { opacity: 0, x: 10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    x: -10,
    transition: { duration: 0.2, ease: 'easeIn' }
  },
};

// Skeleton loading animation
export const skeletonShimmer: Variants = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0'],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};
