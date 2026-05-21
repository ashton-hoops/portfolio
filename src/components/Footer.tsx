import './Footer.css'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer__container container">
        <div className="footer__brand">
          <span className="footer__logo">Ashton Jantz</span>
          <span className="footer__tagline">Basketball Analytics & Software Development</span>
        </div>

        <div className="footer__contact">
          <a href="mailto:ashtonbjantz@icloud.com" className="footer__link">
            ashtonbjantz@icloud.com
          </a>
          <a href="tel:14056969206" className="footer__link">
            (405) 696-9206
          </a>
        </div>

        <div className="footer__meta">
          <span>&copy; {currentYear} Ashton Jantz</span>
          <span className="footer__divider">&middot;</span>
          <span>Norman, OK</span>
        </div>
      </div>
    </footer>
  )
}
