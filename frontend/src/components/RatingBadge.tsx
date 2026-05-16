interface Props { rating: number }

export default function RatingBadge({ rating }: Props) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold bg-black/60 px-2 py-0.5 rounded">
      <span>★</span>
      <span>{rating.toFixed(1)}</span>
    </span>
  )
}
