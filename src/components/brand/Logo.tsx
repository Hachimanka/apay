import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/cn'

type LogoProps = { to?: string; className?: string }

/** Circle "A" mark from the Aznar logo (same mark as AZone). */
export function LogoMark({ className, animate }: { className?: string; animate?: boolean }) {
  const reduce = useReducedMotion()
  const play = animate && !reduce
  return (
    <motion.img
      src="/apay-mark.png"
      alt=""
      aria-hidden
      draggable={false}
      initial={play ? { scale: 0.3, rotate: -120, opacity: 0 } : false}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className={cn('size-10 shrink-0 select-none', className)}
    />
  )
}

/** Mark spins in first, then "Pay" slides out from behind it — the mark itself is the "A" in APay. Replays whenever it mounts (e.g. expanding the sidebar). */
export function Logo({ to = '/', className }: LogoProps) {
  const reduce = useReducedMotion()

  return (
    <Link to={to} className={cn('group inline-flex items-center gap-1.5', className)} aria-label="APay home">
      <span className="relative z-10 transition-transform duration-300 group-hover:-rotate-6">
        <LogoMark animate className="size-10" />
      </span>
      {/* overflow-hidden clips the word so it appears to come out of the mark */}
      <span className="-ml-1 overflow-hidden py-1 pl-1">
        <motion.span
          initial={reduce ? false : { x: '-110%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="block text-[1.6rem] leading-none font-extrabold tracking-tight text-brand transition-colors group-hover:text-brand-700"
        >
          Pay
        </motion.span>
      </span>
    </Link>
  )
}
