import './Footer.css'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__container container">
        <div className="footer__brand">
          <span className="footer__logo">Ashton Jantz</span>
          <span className="footer__tagline">Basketball Analytics &amp; Software Development</span>
        </div>

        <div className="footer__contact">
          <a href="mailto:ashtonbjantz@icloud.com" className="footer__link">
            ashtonbjantz@icloud.com
          </a>
          <span className="footer__divider" aria-hidden="true">&middot;</span>
          <a href="tel:14056969206" className="footer__link">
            (405) 696-9206
          </a>
        </div>
      </div>
    </footer>
  )
}
