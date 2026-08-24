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
          <span className="marka__isaret" aria-hidden="true">
            <Icon name="key" />
          </span>
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
      aria-label={`WhatsApp'tan ${advisor.fullName}'e yaz`}
    >
      <Icon name="whatsapp" />
      <span className="wp-dugme__yazi">{advisor.salutation}’a yaz</span>
    </a>
  )
}

export function SiteFooter() {
  return (
    <footer className="alt-bilgi">
      <div className="kabuk alt-bilgi__ic">
        <div className="alt-bilgi__ust">
          <div className="alt-bilgi__kisi">
            <span className="marka__isaret" aria-hidden="true">
              <Icon name="key" />
            </span>
            <span>
              <strong className="alt-bilgi__ad">{advisor.fullName}</strong>
              <span className="alt-bilgi__unvan">
                {advisor.company} · {advisor.title}
              </span>
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
      </div>
    </footer>
  )
}
