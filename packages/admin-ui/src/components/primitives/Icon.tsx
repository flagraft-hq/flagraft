export type IconName =
  | 'flag'
  | 'flagFilled'
  | 'layers'
  | 'target'
  | 'key'
  | 'history'
  | 'settings'
  | 'plus'
  | 'search'
  | 'chevronDown'
  | 'chevronRight'
  | 'check'
  | 'minus'
  | 'x'
  | 'moon'
  | 'sun'
  | 'alert'
  | 'info'
  | 'trash'
  | 'edit'
  | 'copy'
  | 'eye'
  | 'eyeOff'
  | 'filter'
  | 'keyboard'
  | 'cmd'
  | 'code'
  | 'bolt'
  | 'shield'
  | 'book'
  | 'refresh'
  | 'sparkles'
  | 'arrowRight'
  | 'play'
  | 'user'
  | 'palette'
  | 'more'

interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: IconName
  size?: number
}

/**
 * `size` is given in design pixels but rendered in rem, so icons grow and
 * shrink with the global scale knob in base.css instead of staying pinned
 * at their design size while the text around them changes.
 */
export function Icon({ name, size = 16, className = '', ...rest }: IconProps) {
  const rem = `${size / 16}rem`
  const svgProps = {
    width: rem,
    height: rem,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    ...rest,
  }

  const icons: Record<IconName, React.JSX.Element> = {
    flag: (
      <>
        <path d="M5 21V4" />
        <path d="M5 4h11l-1.5 3.5L16 11H5" />
      </>
    ),
    flagFilled: (
      <>
        <path d="M5 21V4" />
        <path d="M5 4h11l-1.5 3.5L16 11H5z" fill="currentColor" />
      </>
    ),
    layers: (
      <>
        <path d="M12 3 3 8l9 5 9-5-9-5z" />
        <path d="M3 13l9 5 9-5" />
        <path d="M3 18l9 5 9-5" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      </>
    ),
    key: (
      <>
        <path d="M14 9.5a5 5 0 1 0-5 5L10 16l2 2 1-1 1 1 2-2-1-1 1-1-1-1 1-1-1-1" />
        <circle cx="14" cy="9.5" r="1.2" fill="currentColor" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 8v5l3 2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8L4.2 7a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    chevronDown: (
      <>
        <path d="m6 9 6 6 6-6" />
      </>
    ),
    chevronRight: (
      <>
        <path d="m9 6 6 6-6 6" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 5 5L20 7" />
      </>
    ),
    minus: (
      <>
        <path d="M5 12h14" />
      </>
    ),
    x: (
      <>
        <path d="M6 6l12 12M18 6 6 18" />
      </>
    ),
    moon: (
      <>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    alert: (
      <>
        <path d="M12 9v4M12 17h.01" />
        <path d="m10.3 3.9-8 13.5A2 2 0 0 0 4 20.4h16a2 2 0 0 0 1.7-3l-8-13.5a2 2 0 0 0-3.4 0z" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 12h1v5h1" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      </>
    ),
    edit: (
      <>
        <path d="M11 4H4v16h16v-7" />
        <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M9.9 5a8.6 8.6 0 0 1 2.1-.3c6 0 10 7 10 7a16 16 0 0 1-2.4 3.2M6.6 6.6A16 16 0 0 0 2 12s4 7 10 7a8.6 8.6 0 0 0 4.5-1.3" />
        <path d="m9.9 9.9 4.2 4.2" />
        <path d="M2 2l20 20" />
      </>
    ),
    filter: (
      <>
        <path d="M3 5h18M6 12h12M10 19h4" />
      </>
    ),
    keyboard: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12" />
      </>
    ),
    cmd: (
      <>
        <path d="M15 9V6a3 3 0 1 1 3 3h-3zM15 9v6M15 15h3a3 3 0 1 1-3 3v-3zM15 15H9M9 15v3a3 3 0 1 1-3-3h3zM9 9H6a3 3 0 1 1 3-3v3z" />
      </>
    ),
    code: (
      <>
        <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
      </>
    ),
    bolt: (
      <>
        <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </>
    ),
    book: (
      <>
        <path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" />
        <path d="M4 16a4 4 0 0 1 4-4h12" />
      </>
    ),
    refresh: (
      <>
        <path d="M3 12a9 9 0 0 1 15.7-6L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.7 6L3 16M3 21v-5h5" />
      </>
    ),
    sparkles: (
      <>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
      </>
    ),
    arrowRight: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    play: (
      <>
        <path d="M6 4v16l14-8z" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    palette: (
      <>
        <path d="M12 22a10 10 0 1 1 10-10c0 2-1.6 3-3.5 3H17a2 2 0 0 0-1.8 2.8 2 2 0 0 1-1.8 2.8c-.5.1-1 .2-1.4.4" />
        <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" />
        <circle cx="12" cy="6.5" r="1.2" fill="currentColor" />
        <circle cx="16.5" cy="9.5" r="1.2" fill="currentColor" />
      </>
    ),
  }

  return <svg {...svgProps}>{icons[name] || icons.flag}</svg>
}
