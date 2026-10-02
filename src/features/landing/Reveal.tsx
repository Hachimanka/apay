import type { ReactNode } from 'react'
import { motion } from 'motion/react'

/** Fades and rises content into view on scroll. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  center = true,
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  center?: boolean
}) {
  return (
    <Reveal className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3.5 py-1 text-xs font-bold tracking-wider text-primary uppercase">
        <span className="size-1.5 rounded-full bg-primary" />
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl lg:text-[2.75rem]">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{description}</p>}
    </Reveal>
  )
}
