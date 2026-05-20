'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { PlayIcon, PlusIcon } from '@heroicons/react/24/solid'
import { StarIcon } from '@heroicons/react/24/solid'
import type { Movie } from '@/types/movie'

interface Props { movie: Movie }

export default function FeaturedBanner({ movie }: Props) {
  if (!movie) return null

  return (
    <section className="py-12 px-6 lg:px-12 w-full max-w-7xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="relative w-full aspect-[21/9] sm:aspect-[25/9] rounded-2xl overflow-hidden group shadow-2xl"
      >
        {/* Background Image */}
        {movie.backdropUrl && (
          <Image
            src={movie.backdropUrl}
            alt={movie.title}
            fill
            className="object-cover object-top transition-transform duration-[1.5s] group-hover:scale-105"
            sizes="(max-width: 1280px) 100vw, 1280px"
          />
        )}
        
        {/* Dark Gradient Overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-16 w-full md:w-2/3 lg:w-1/2">
          
          {/* Metadata Row */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">16+</span>
            <span className="text-white/70 text-sm font-medium">|</span>
            <span className="text-white/90 text-sm font-medium">{movie.releaseYear}</span>
            {movie.runtime > 0 && (
              <>
                <span className="text-white/70 text-sm font-medium">|</span>
                <span className="text-white/90 text-sm font-medium">{movie.runtime} min</span>
              </>
            )}
            <span className="text-white/70 text-sm font-medium">|</span>
            <div className="flex items-center gap-0.5 text-white/90">
               {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} className={`w-3.5 h-3.5 ${i < Math.round(movie.rating / 2) ? 'text-white' : 'text-white/30'}`} />
               ))}
            </div>
          </div>

          {/* Title */}
          <h2 className="font-display text-4xl sm:text-5xl text-white tracking-widest leading-none mb-4">
            {movie.title}
          </h2>

          {/* Synopsis */}
          <p className="text-white/70 text-sm sm:text-[15px] leading-relaxed mb-8 line-clamp-3">
            {movie.synopsis}
          </p>

          {/* Actions & Links */}
          <div className="flex items-center justify-between mt-auto pb-4">
             <div className="flex items-center gap-4 text-xs font-medium text-white/50">
               <Link href={`/movie/${movie.slug}`} className="hover:text-white transition-colors">Informations</Link>
               <Link href={`/movie/${movie.slug}`} className="hover:text-white transition-colors">Trailer</Link>
               <Link href={`/movie/${movie.slug}`} className="hover:text-white transition-colors">Reviews</Link>
             </div>
             
             <div className="flex items-center gap-4">
                <Link
                  href={`/watch/${movie.slug}`}
                  className="flex items-center gap-2 bg-primary text-black font-bold px-6 py-2.5 rounded-md hover:bg-primary-light transition-colors"
                >
                  <PlayIcon className="w-4 h-4" />
                  Watch
                </Link>
                <button className="flex items-center gap-2 text-white font-semibold hover:text-primary transition-colors text-sm uppercase tracking-wide">
                  <PlusIcon className="w-5 h-5" />
                  My List
                </button>
             </div>
          </div>
          
        </div>
      </motion.div>
    </section>
  )
}
