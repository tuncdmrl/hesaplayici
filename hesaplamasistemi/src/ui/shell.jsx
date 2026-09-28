import { advisor, site } from '../config/advisor.js'
import { contactService } from '../services/ContactService.js'
import { useRoute } from '../app/Router.jsx'
import { Icon } from './Icon.jsx'

/** Teslimat ayına vurulan kırmızı mühür — sitenin imza öğesi. */
export function Stamp({
  top = 'Teslimat',
  main,
  large = false,
  animate = false,
  className = '',
  ...rest
}) {
  return (
    <span
      {...rest}
      className={`damga ${large ? 'damga--iri' : ''} ${animate ? 'damga--vur' : ''} ${className}`}
      role="img"
      aria-label={`${top}: ${main}`}
    >
      <span className="damga__ust" aria-hidden="true">
        {top}
      </span>
      <span className="damga__ana" aria-hidden="true">
        {main}
      </span>
    </span>
  )
}

/**
 * Marka işareti: kırmızı degrade rozetin üzerinde dolu bir anahtar.
 * Anahtar ekseni 45° döndürülmüş; halka ile sap ayrı yollar olduğundan
 * üst üste bindikleri yerde tek gövde gibi görünür.
 */
export function BrandMark({ className = '' }) {
  return (
    <span className={`marka__isaret ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <g transform="rotate(45 12 12)" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M12 2.8a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4Zm0 2.55a1.65 1.65 0 1 0 0 3.3 1.65 1.65 0 0 0 0-3.3Z"
          />
          <path d="M10.9 9.8h2.2v5.4h3.1v1.7h-3.1v1.4h2.3v1.7h-2.3v.9a1.1 1.1 0 0 1-2.2 0V9.8Z" />
        </g>
      </svg>
    </span>
  )
}

export function SiteHeader() {
  const { path, navigate } = useRoute()
  const isHome = path === '/'

  return (
    <header className="ust-bar">
      <div className="kabuk ust-bar__ic">
        <a
          className="marka"
          href="/"
          onClick={(event) => {
            event.preventDefault()
            navigate('/')
          }}
        >
          <BrandMark />
          <span className="marka__yazi">
            <span className="marka__ad">{site.name}</span>
            <span className="marka__alt">{advisor.fullName} ile</span>
          </span>
        </a>

        <span className="ust-bar__ara" />

        {!isHome && (
          <button className="ust-bar__geri" type="button" onClick={() => navigate('/')}>
            <Icon name="arrowLeft" size={18} />
            Başa dön
          </button>
        )}

        <a className="ust-bar__telefon" href={contactService.phoneLink}>
          <Icon name="phone" size={17} />
          {advisor.phone.display}
        </a>
      </div>
    </header>
  )
}

export function WhatsAppButton({ plan = null }) {
  return (
    <a
      className="wp-dugme"
      href={contactService.whatsAppLink(plan)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Danışmanlık için WhatsApp'tan ${advisor.fullName}'e yazın`}
    >
      <Icon name="whatsapp" />
      <span className="wp-dugme__yazi">Danışmanlık için tıklayın</span>
    </a>
  )
}

export function SiteFooter() {
  return (
    <footer className="alt-bilgi">
      <div className="kabuk alt-bilgi__ic">
        <div className="alt-bilgi__ust">
          <div className="alt-bilgi__kisi">
            <BrandMark />
            <span>
              <strong className="alt-bilgi__ad">{advisor.fullName}</strong>
              <span className="alt-bilgi__unvan">{advisor.title}</span>
            </span>
          </div>

          <div className="alt-bilgi__iletisim">
            <a href={contactService.phoneLink}>{advisor.phone.display}</a>
            <a href={`mailto:${advisor.email}`}>{advisor.email}</a>
            <a href={contactService.whatsAppLink()} target="_blank" rel="noopener noreferrer">
              WhatsApp’tan yaz
            </a>
          </div>
        </div>

        <p className="alt-bilgi__yasal">{site.disclaimer}</p>

        <p className="alt-bilgi__kredi">
          Created by{' '}
          <a
            href="https://tuncdemirel.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tunç Demirel
          </a>
        </p>
      </div>
    </footer>
  )
}
