function hasPhoto(url: string | null) {
  return !!url && /^https?:\/\//.test(url)
}

export function HorseAvatar({
  name,
  photoUrl,
  className = 'h-14 w-14 text-2xl',
}: {
  name: string
  photoUrl: string | null
  className?: string
}) {
  if (hasPhoto(photoUrl)) {
    return (
      <div className={`${className} overflow-hidden rounded-2xl bg-forest/10`}>
        <img
          src={photoUrl!}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    )
  }
  return (
    <div
      className={`${className} flex items-center justify-center rounded-2xl bg-forest/10 font-semibold text-forest`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}
