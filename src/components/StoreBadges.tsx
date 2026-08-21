/**
 * Enlaces oficiales a tiendas (Apple, Google Play, AppGallery).
 * Reutilizado en el hero desktop (oculto vía padre) y en el bloque solo-móvil del IdP.
 */
export const MI_ETB_STORE_LINKS = {
  appStore: 'https://apps.apple.com/co/app/mi-etb/id1129336425',
  googlePlay: 'https://play.google.com/store/apps/details?id=com.etb.mietb&hl=es_CO',
  appGallery: 'https://appgallery.huawei.com/#/search/Mi%20ETB',
} as const;

export function StoreBadges() {
  return (
    <div className="login-hero-badges" role="group" aria-label="Descarga la app Mi ETB en tiendas móviles">
      <a
        href={MI_ETB_STORE_LINKS.appStore}
        className="app-badge app-badge--apple"
        aria-label="Descargar Mi ETB en App Store"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg className="app-badge__icon app-badge__icon--apple" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-194.3 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
        </svg>
        <span className="app-badge__copy">
          <small>Descárgalo en</small>
          <br />
          <b>App Store</b>
        </span>
      </a>
      <a
        href={MI_ETB_STORE_LINKS.googlePlay}
        className="app-badge app-badge--google"
        aria-label="Descargar Mi ETB en Google Play"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg className="app-badge__icon app-badge__icon--google" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path fill="#00A0FF" d="M95.5 20.9c-7.9 8.2-12.5 20.9-12.5 37.1v396c0 16.2 4.6 28.9 12.5 37.1L300.7 256 95.5 20.9Z" />
          <path fill="#00F076" d="M365.2 191.9 300.7 256 95.5 20.9c12.5-13 32.9-14.5 55.9-1.4l213.8 172.4Z" />
          <path fill="#FFCE00" d="m365.2 320.1-64.5-64.1L95.5 491.1c12.5 13 32.9 14.5 55.9 1.4l213.8-172.4Z" />
          <path fill="#FF3D00" d="m365.2 191.9 68.1 38.8c27.5 15.7 27.5 35 0 50.6l-68.1 38.8-64.5-64.1 64.5-64.1Z" />
        </svg>
        <span className="app-badge__copy">
          <small>Disponible en</small>
          <br />
          <b>Google Play</b>
        </span>
      </a>
      <a
        href={MI_ETB_STORE_LINKS.appGallery}
        className="app-badge app-badge--huawei"
        aria-label="Buscar Mi ETB en AppGallery"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg className="app-badge__icon app-badge__icon--huawei" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="4" y="4" width="88" height="88" rx="22" fill="#C7000B" />
          <path fill="#FFFFFF" d="M30 36.5h36c4.1 0 7.5 3.4 7.5 7.5v22.5c0 4.1-3.4 7.5-7.5 7.5H30c-4.1 0-7.5-3.4-7.5-7.5V44c0-4.1 3.4-7.5 7.5-7.5Zm8.4-4.2c1.4-7.2 5.2-11.8 9.6-11.8s8.2 4.6 9.6 11.8h-5.8c-1-4-2.6-6.1-3.8-6.1s-2.8 2.1-3.8 6.1h-5.8Zm-3 14.5c0 2 1.6 3.6 3.6 3.6s3.6-1.6 3.6-3.6-1.6-3.6-3.6-3.6-3.6 1.6-3.6 3.6Zm18 0c0 2 1.6 3.6 3.6 3.6s3.6-1.6 3.6-3.6-1.6-3.6-3.6-3.6-3.6 1.6-3.6 3.6Z" />
        </svg>
        <span className="app-badge__copy">
          <small>Explóralo en</small>
          <br />
          <b>AppGallery</b>
        </span>
      </a>
    </div>
  );
}
