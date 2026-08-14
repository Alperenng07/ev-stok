export type PermissionGuide = {
  title: string
  steps: string[]
  /** Mümkünse tarayıcı/OS ayar sayfası */
  settingsUrl: string | null
  settingsLabel: string | null
}

function detectBrowser(): 'chrome' | 'edge' | 'firefox' | 'safari' | 'other' {
  const ua = navigator.userAgent
  if (/Edg\//i.test(ua)) return 'edge'
  if (/Firefox\//i.test(ua)) return 'firefox'
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'safari'
  if (/Chrome\//i.test(ua) || /Chromium\//i.test(ua)) return 'chrome'
  return 'other'
}

/** Konum izni reddedildiğinde kullanıcıya gösterilecek net adımlar. */
export function getLocationPermissionGuide(): PermissionGuide {
  const browser = detectBrowser()
  const host = window.location.host

  if (browser === 'chrome') {
    return {
      title: 'Chrome konum izni',
      steps: [
        `Adres çubuğundaki kilit / ayar simgesine tıkla.`,
        `“Konum”u Bul → İzin ver olarak değiştir.`,
        `Sayfayı yenile (Ctrl+F5) ve tekrar dene.`,
        `Görünmüyorsa: chrome://settings/content/location adresinden “${host}” sitesini kontrol et.`,
      ],
      settingsUrl: 'chrome://settings/content/location',
      settingsLabel: 'Chrome konum ayarlarını aç',
    }
  }

  if (browser === 'edge') {
    return {
      title: 'Edge konum izni',
      steps: [
        `Adres çubuğundaki kilit simgesine tıkla → Site izinleri / Konum → İzin ver.`,
        `Sayfayı yenile ve tekrar dene.`,
        `Gerekirse: edge://settings/content/location`,
      ],
      settingsUrl: 'edge://settings/content/location',
      settingsLabel: 'Edge konum ayarlarını aç',
    }
  }

  if (browser === 'firefox') {
    return {
      title: 'Firefox konum izni',
      steps: [
        `Adres çubuğundaki kilit simgesine tıkla → Bağlantı güvenli / İzinler → Konum → İzin ver.`,
        `Sayfayı yenile.`,
        `about:preferences#privacy içinde “İzinler → Konum” bölümünden siteyi kontrol edebilirsin.`,
      ],
      settingsUrl: 'about:preferences#privacy',
      settingsLabel: 'Firefox gizlilik ayarlarını aç',
    }
  }

  if (browser === 'safari') {
    return {
      title: 'Safari konum izni',
      steps: [
        `Safari → Ayarlar (veya Tercihler) → Web Siteleri → Konum.`,
        `“${host}” için İzin Ver seç.`,
        `Sayfayı yenile.`,
      ],
      settingsUrl: null,
      settingsLabel: null,
    }
  }

  return {
    title: 'Konum izni',
    steps: [
      `Tarayıcıda bu site (${host}) için konum iznini aç.`,
      `Adres çubuğundaki kilit / site bilgisi simgesinden Konum → İzin ver.`,
      `Sayfayı yenileyip tekrar dene.`,
    ],
    settingsUrl: null,
    settingsLabel: null,
  }
}

/**
 * Tarayıcı ayar sayfasını açmayı dener.
 * chrome:// ve about: linkleri çoğu siteden engellenir; o zaman false döner.
 */
export function tryOpenBrowserLocationSettings(url: string | null): boolean {
  if (!url) return false
  try {
    const w = window.open(url, '_blank', 'noopener,noreferrer')
    return Boolean(w)
  } catch {
    return false
  }
}
