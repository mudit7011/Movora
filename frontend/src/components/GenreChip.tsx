interface Props { genre: string }

export default function GenreChip({ genre }: Props) {
  return (
    <span className="text-xs font-medium text-white/70 bg-white/10 border border-white/10 px-2 py-0.5 rounded-full">
      {genre}
    </span>
  )
}
