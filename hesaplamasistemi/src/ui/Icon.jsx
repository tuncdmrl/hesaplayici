/**
 * Tek bir SVG kütüphanesi. Yeni bir simge eklemek için kayda bir satır eklemek
 * yeterli; boyut, çizgi kalınlığı ve renk her yerde aynı davranır.
 */
const PATHS = {
  key: 'M15.5 3a5.5 5.5 0 0 1 4.2 9.05L18 13.75l1.5 1.5-2 2-1.5-1.5-1.6 1.6-1.5-1.5-2.2 2.2-2.9.4.4-2.9L14.9 8.4A5.5 5.5 0 0 1 15.5 3Zm1.6 3.4a1.4 1.4 0 1 0 2 2 1.4 1.4 0 0 0-2-2Z',
  home: 'm3 11 9-8 9 8 M5 10v10h14V10 M9 20v-6h6v6',
  workplace: 'M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16M17 9h3v12M8 7h5M8 11h5M8 15h5M2 21h20',
  vehicle:
    'm5 17-1-1v-4l2-5h12l2 5v4l-1 1 M5 12h14M7 17v2M17 17v2 M6.6 14.5h1.2M16.2 14.5h1.2',
  motorcycle:
    'M5.5 18.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18.5 18.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M8.5 15.5h6.5l-4-6H8 M13 9.5h3l2.5 6 M14 6h3',
  calendar: 'M3 5h18v16H3z M16 3v4M8 3v4M3 10h18 M9 16l2 2 4-5',
  wallet: 'M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12 M20 11h-5a2 2 0 1 0 0 4h5',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  check: 'm5 12 4 4L19 6',
  alert: 'M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z M12 9v4M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5M12 8h.01',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z m8.6-4.5 6.8-4M8.6 13.5l6.8 4',
  phone:
    'M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2.5 2.5 0 0 1-2.7 2.5A17 17 0 0 1 3 5.7 2.5 2.5 0 0 1 5.5 3Z',
  mail: 'M3 6h18v12H3z m0 0 9 7 9-7',
  lock: 'M6 11h12v10H6z M9 11V8a3 3 0 0 1 6 0v3',
  whatsapp:
    'M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.7a8.5 8.5 0 1 1 16.3-3.8Z M8.4 7.8c.2-.5.4-.5.8-.5h.5c.2 0 .4.1.5.4l.8 2c.1.3.1.5-.1.7l-.6.8c-.2.2-.2.4 0 .7.6 1 1.4 1.8 2.4 2.4.3.2.5.2.7 0l.8-1c.2-.2.4-.3.7-.2l2 .9c.3.1.4.3.4.5 0 .4-.2 1.4-.8 1.9-.6.5-1.4.8-2.4.5-1.1-.3-2.5-.8-4.1-2.2-1.3-1.2-2.3-2.6-2.7-3.7-.4-1.1 0-2.5.3-3.2Z',
  edit: 'M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z M13.5 6.5l4 4',
  phoneAdd: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z M12 8v6M9 11h6',
  iosShare: 'M12 3v11 M8.5 6.5 12 3l3.5 3.5 M7 10H5.5a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18.5 10H17',
  plusSquare: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M12 8.5v7M8.5 12h7',
  menuDots: 'M12 6.5h.01M12 12h.01M12 17.5h.01',
  close: 'M6 6l12 12 M18 6 6 18',
  arrowDown: 'M12 4v15M6 13l6 6 6-6',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z',
}

export function Icon({ name, size = 24, className, ...rest }) {
  const definition = PATHS[name]
  if (!definition) return null

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {definition.split(' M').map((segment, index) => (
        <path key={index} d={index === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  )
}
