interface TagClusterProps {
  tags: string[]
  max?: number
}

export function TagCluster({ tags, max = 3 }: TagClusterProps) {
  const visible = tags.slice(0, max)
  const remaining = tags.length - visible.length

  return (
    <div className="tag-cluster">
      {visible.map((tag) => (
        <span key={tag} className="tag-item">
          {tag}
        </span>
      ))}
      {remaining > 0 && <span className="tag-overflow">+{remaining} more</span>}
    </div>
  )
}
