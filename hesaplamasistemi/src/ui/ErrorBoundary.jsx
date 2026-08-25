import { Component } from 'react'
import { advisor } from '../config/advisor.js'
import { contactService } from '../services/ContactService.js'
import { Icon } from './Icon.jsx'

/**
 * Beklenmedik bir hata olduğunda beyaz ekran yerine ne yapılacağını söyleyen
 * bir sayfa gösterir.
 *
 * Site danışmanın vitrini; tek bir hata bütün sayfayı boş bırakmamalı. Hata
 * kaydı yalnızca tarayıcı konsoluna düşer, hiçbir yere gönderilmez.
 */
export class ErrorBoundary extends Component {
  state = { hata: null }

  static getDerivedStateFromError(hata) {
    return { hata }
  }

  componentDidCatch(hata, bilgi) {
    console.error('Beklenmeyen hata:', hata, bilgi)
  }

  #yenile = () => {
    window.location.assign('/')
  }

  render() {
    if (!this.state.hata) return this.props.children

    return (
      <main className="hata-ekrani">
        <div className="kabuk hata-ekrani__ic">
          <span className="hata-ekrani__isaret" aria-hidden="true">
            <Icon name="alert" />
          </span>
          <h1>Bir şeyler ters gitti</h1>
          <p>
            Hesaplayıcı beklenmedik bir hatayla karşılaştı. Sayfayı yenilemek çoğu zaman yetiyor;
            sürerse {advisor.salutation}’a yazın, hesaplamayı birlikte yapalım.
          </p>

          <div className="hata-ekrani__eylemler">
            <button className="dugme dugme--birincil" type="button" onClick={this.#yenile}>
              Başa dön
            </button>
            <a
              className="dugme dugme--yesil"
              href={contactService.whatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="whatsapp" size={20} />
              WhatsApp’tan yaz
            </a>
            <a className="dugme dugme--ikincil" href={contactService.phoneLink}>
              <Icon name="phone" size={19} />
              {advisor.phone.display}
            </a>
          </div>
        </div>
      </main>
    )
  }
}
