import logoImg from '../../assets/logo.png'

interface BrandProps {
  /**
   * 'sm' is the in-app top bar, 'lg' is the hero lockup on the auth screens.
   */
  size?: 'sm' | 'lg'
}

/**
 * The Flagraft logo and wordmark, side by side. Kept in one place so the mark
 * size, the wordmark size, and the gap between them stay in step wherever the
 * brand appears.
 *
 * The image is marked decorative because the wordmark beside it already says
 * "Flagraft", and a screen reader should not read the name twice.
 */
export function Brand({ size = 'sm' }: BrandProps) {
  return (
    <div className="brand" data-size={size}>
      <img src={logoImg} alt="" className="brand-logo" />
      <span className="brand-word">Flagraft</span>
    </div>
  )
}
