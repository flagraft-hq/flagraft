interface TagClusterProps {
  tags: string[]
  max?: number
}

/**
 * Turns a tag name into a color-dot class. Non-letters are stripped so
 * names like "kill-switch" and "a11y" map to stable class suffixes.
 */
function tagDotClass(tag: string): string {
  return 'tag-dot tag-' + tag.replace(/[^a-z]/g, '')
}

/**
 * Compact tag display: up to `max` colored dots that reveal the full list of
 * tag chips in a popover on hover. Matches the redesigned flags row, which
 * keeps the row dense and surfaces the labels only when needed.
 */
export function TagCluster({ tags, max = 3 }: TagClusterProps) {
  if (!tags || tags.length === 0) {
    return <span className="tag-cluster" />
  }

  return (
    <span className="tag-cluster" aria-label={`tags: ${tags.join(', ')}`}>
      <span className="tag-dots">
        {tags.slice(0, max).map((tag) => (
          <span key={tag} className={tagDotClass(tag)} />
        ))}
      </span>
      <span className="tag-popover" role="tooltip">
        {tags.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
          </span>
        ))}
      </span>
    </span>
  )
}
