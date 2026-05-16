'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import type { Movie } from '@/types/movie'
import RatingBadge from './RatingBadge'

interface Props {
  movie: Movie
}

export default function MovieCard({ movie }: Props) {
  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="group relative flex-shrink-0 w-40 sm:w-44 cursor-pointer"
    >
      <Link href={`/movie/${movie.slug}`}>
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden ring-1 ring-white/10 group-hover:ring-crimson group-hover:shadow-crimson-glow transition-all duration-300">
          {movie.posterUrl ? (
            <Image
              src={movie.posterUrl}
              alt={movie.title}
              fill
              sizes="(max-width: 640px) 160px, 176px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center text-muted text-xs">
              No Poster
            </div>
          )}
          <div className="absolute inset-0 bg-card-fade opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute top-2 right-2">
            <RatingBadge rating={movie.rating} />
          </div>
        </div>

        <div className="mt-2 px-0.5">
          <p className="text-sm font-medium text-white line-clamp-1">{movie.title}</p>
          <p className="text-xs text-muted mt-0.5">{movie.language[0] ?? ''}</p>
        </div>
      </Link>
    </motion.div>
  )
}
