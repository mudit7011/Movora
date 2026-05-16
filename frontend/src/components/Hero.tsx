'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { Movie } from '@/types/movie'
import RatingBadge from './RatingBadge'
import GenreChip from './GenreChip'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 },
}

const stagger = {
  show: { transition: { staggerChildren: 0.12 } },
}

interface Props { movie: Movie }

export default function Hero({ movie }: Props) {
  return (
    <section className="relative h-[90vh] w-full overflow-hidden grain">
      {movie.backdropUrl && (
        <Image
          src={movie.backdropUrl}
          alt={movie.title}
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
      )}

      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="absolute inset-0 bg-gradient-to-t from-base via-transparent to-transparent" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col justify-end h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20"
      >
        <motion.div variants={fadeUp} className="flex flex-wrap gap-2 mb-4">
          {movie.genres.slice(0, 3).map(g => (
            <GenreChip key={g} genre={g} />
          ))}
          <RatingBadge rating={movie.rating} />
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="font-display text-5xl sm:text-7xl lg:text-8xl text-white tracking-wide leading-none mb-4 max-w-2xl"
        >
          {movie.title}
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="text-white/70 text-sm sm:text-base max-w-lg mb-8 line-clamp-3"
        >
          {movie.synopsis}
        </motion.p>

        <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
          <Link
            href={`/watch/${movie.slug}`}
            className="inline-flex items-center gap-2 bg-crimson hover:bg-crimson-dark text-white font-semibold px-6 py-3 rounded-lg transition-colors shadow-crimson-glow"
          >
            <span>▶</span> Play Now
          </Link>
          <Link
            href={`/movie/${movie.slug}`}
            className="inline-flex items-center gap-2 glass text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span>ℹ</span> More Info
          </Link>
        </motion.div>
      </motion.div>
    </section>
  )
}
