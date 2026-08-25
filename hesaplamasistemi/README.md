# Ödeme Planı Hesaplayıcı

Merve Demirel (Pendik Şube Müdürü) için tasarruf finansmanı ödeme planı
hesaplayıcı. Kullanıcı hedef tutarını girer; teslimat ayını, vadesini ve ay ay
ödeme tablosunu görür, planı PDF olarak indirir ve tek dokunuşla WhatsApp’tan
gönderir.

Backend yoktur. Tüm hesaplama tarayıcıda çalışır; girilen hiçbir bilgi sunucuya
gönderilmez.

---

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ üretir
npm run preview    # üretim çıktısını yerelde açar
npm test           # hesaplama motorunun kural testleri
```

## Vercel’e yükleme

Depoyu Vercel’e bağlamak yeterli. `vercel.json` framework’ü, derleme komutunu ve
tek sayfa uygulaması için gereken yönlendirmeleri içerir:

| Ayar | Değer |
| --- | --- |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |

---

## Nereyi değiştirmeli?

Sık istenen değişikliklerin tamamı iki dosyada toplanmıştır.

### Kişi ve iletişim bilgileri → `src/config/advisor.js`

İsim, unvan, şube, telefon (hem `tel:` hem WhatsApp), e-posta ve yasal uyarı
metni burada. Siteyi başka bir danışmana uyarlamak için yalnızca bu dosya
yeterlidir.

### İş kuralları → `src/config/planPolicy.js`

| Ayar | Şu anki değer |
| --- | --- |
| Azami vade | Ev / iş yeri 200 ay, otomobil / motosiklet 110 ay |
| En erken teslimat | 6. ay |
| Organizasyon ücreti | Hedef tutarın %7’si; yarısı 1. ay, kalanı 2–5. aylara bölünür |
| Teslimat için birikim şartı | Hedef tutarın %45’i |
| Taksit dengesi | En yüksek taksit, en düşüğün en fazla 3 katı |
| Yuvarlama | Taksitler tam TL; kuruşlu taksit oluşmaz |

**Yeni ürün eklemek** için `ASSET_TYPES` listesine bir `new AssetType({...})`
satırı eklemek yeterlidir; form, sonuç ekranı ve PDF yeni ürünü kendiliğinden
tanır.

---

## Mimari

Kod, ileride genişletilebilsin diye katmanlara ayrılmış ve iş kuralları
nesne yönelimli biçimde modellenmiştir. Arayüz hesaplamanın nasıl yapıldığını
bilmez; yalnızca `PlanService` ile konuşur.

```
src/
├─ config/            Değiştirilmesi beklenen her şey
│  ├─ advisor.js         Danışman ve site metinleri
│  └─ planPolicy.js      Oranlar, vade sınırları, ürünler
│
├─ domain/            Hesaplama motoru (arayüzden tamamen bağımsız)
│  ├─ Money.js           Kuruş aritmetiği, TR biçimlendirme, girdi ayrıştırma
│  ├─ MonthKey.js        "2026-08" ay anahtarları üzerinde takvim aritmetiği
│  ├─ PlanInput.js       Doğrulanmış, değiştirilemez kullanıcı tercihleri
│  ├─ PlanResult.js      Sonuç, ay ay satırlar ve öneriler
│  ├─ Violation.js       Kural ihlali türleri
│  ├─ OrganizationFeeSchedule.js
│  ├─ patterns/
│  │  ├─ InstallmentPattern.js     Taksit artış stratejileri (eşit, dönemsel…)
│  │  └─ AfterDeliveryPolicy.js    Teslimat sonrası ödeme stratejileri
│  ├─ schedule/
│  │  ├─ ScheduleBuilder.js        Mod başına ham taksit dizisi üretimi
│  │  └─ InstallmentNormalizer.js  Tam lira yuvarlama ve taksit dengeleme
│  ├─ PlanEvaluator.js   Teslimat/birikim şartları, tablo, ihlaller
│  ├─ PlanCalculator.js  Motorun dış yüzü (mod başına strateji)
│  ├─ RecommendationEngine.js  "Şunu değiştirirsen olur" önerileri
│  └─ PlanService.js     Arayüzün konuştuğu tek nokta
│
├─ app/               Uygulama durumu ve yönlendirme
│  ├─ Store.js           useSyncExternalStore tabanı
│  ├─ Router.jsx         Bağımlılıksız yönlendirici
│  ├─ PlanSession.jsx    Oturum durumu (sessionStorage’a yazılır)
│  ├─ CalculatorForm.js  Form metinleri ↔ PlanInput çevirisi
│  └─ useInstallPrompt.js  "Telefona ekle" akışı
│
├─ services/
│  ├─ ContactService.js  WhatsApp / telefon / e-posta bağlantıları
│  ├─ PdfService.js      PDF indirme ve paylaşma
│  └─ pdf/
│     ├─ PlanPdfDocument.js  A4 belge çizimi
│     └─ fonts/              Türkçe destekli küçültülmüş Roboto (26 KB)
│
├─ pages/             HomePage · CalculatorPage · ResultPage
├─ ui/                Icon, form alanları, üst bar / alt bilgi / mühür
└─ styles/            Belirteçler ve sayfa bazlı CSS
```

### Yeni bir ödeme tercihi eklemek

`AfterDeliveryPolicy` (veya taksit modu için `InstallmentPattern`) sınıfından
türetin, `amountAfter` / `amountAt` metodunu yazın ve ilgili `from()`
fabrikasına bir `case` ekleyin. Motorun geri kalanı değişmez.

---

## Hesaplama motoru

Motor iki modda çalışır:

- **Teslimat tarihine göre** — teslimat ayı bilinir, seçilen tarihi tutturan
  aylık taksit ikili aramayla bulunur.
- **Aylık bütçeye göre** — taksit bilinir, şartların sağlandığı en erken
  teslimat ayı hesaplanır.

Plan oluşmazsa `RecommendationEngine` devreye girer: tek bir değişkeni (taksit,
peşinat, hedef tutar veya teslimat tarihi) ikili aramayla en küçük geçerli
değerine çeker ve her öneriyi yeniden hesaplayarak doğrular. Ekranda görünen her
alternatif gerçekten hesaplanmış ve geçerli çıkmış bir plandır.

`npm test`, 600 rastgele senaryoda şu değişmezleri doğrular: taksit toplamının
finansman bakiyesine eşit olması, taksitlerin tam lira olması, 3 kat sınırı,
teslimat ayında %45 birikimin oluşması, organizasyon ücretinin tam tahsil
edilmesi ve önerilerin geçerliliği.

---

## PDF

`jspdf` ve gömülü font yaklaşık 400 KB tuttuğu için PDF modülü yalnızca kullanıcı
düğmeye bastığında indirilir (dinamik import). jsPDF’in yerleşik fontları `ğ`,
`İ`, `ş` gibi karakterleri basamadığından, Roboto yalnızca ihtiyaç duyulan
karakterlere indirgenip (~26 KB) gömülüdür.

Font dosyaları depoda hazır gelir. Karakter kümesini değiştirmek gerekirse:

```bash
npm run pdf:fonts     # src/services/pdf/fonts/ altını yeniden üretir
npm run pdf:preview   # tarayıcı olmadan örnek bir PDF üretir
```

## Tasarım değişikliklerini gözle karşılaştırma

Ekran görüntülerini alan bir yardımcı betik var. Önce üretim çıktısını yerelde
açın, sonra betiği çalıştırın:

```bash
npm run build
npm run preview -- --port 5199    # ayrı bir terminalde
npm run shots                     # ekrangoruntuleri/ altına yazar
```

Masaüstü, tablet ve mobil genişliklerde beş ekranı (ana sayfa, iki form, sonuç,
plan çıkmayan senaryo) yakalar ve konsolda hata olup olmadığını bildirir.
Chrome başka bir yerde kuruluysa `CHROME_PATH` ortam değişkenini kullanın.

## Simgeler ve PWA

Site telefona kurulabilir (ana ekrana eklenir, ilk açılıştan sonra çevrimdışı
çalışır). Simgeler `public/favicon.svg` dosyasından üretilir:

```bash
npm run icons
```
