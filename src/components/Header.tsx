import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import './Header.css'

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Close the mobile menu whenever the route changes (so tapping a link
  // closes it after navigation completes).
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Close on Escape.
  useEffect(() => {
    if (!menuOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [menuOpen])

  return (
    <header className="header">
      <div className="header__container container">
        {/* Hamburger — only rendered on mobile via CSS. */}
        <button
          type="button"
          className={`header__hamburger${menuOpen ? ' header__hamburger--open' : ''}`}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <Link to="/" className="header__logo">
          <span className="header__logo-text">Ashton Jantz</span>
        </Link>

        <nav className="header__nav">
          <NavLink to="/" className="header__link" end>
            Portfolio
          </NavLink>
          <NavLink to="/research" className="header__link">
            Research
          </NavLink>
          <NavLink to="/shot-chart" className="header__link">
            3D Shot Chart
          </NavLink>
        </nav>

        <div className="header__contact-wrap">
          <span className="header__contact">
            Seeking GA Position · 2026–27
          </span>
        </div>
      </div>

      {/* Mobile popup menu — hidden on desktop. */}
      {menuOpen && (
        <>
          <button
            type="button"
            className="header__menu-backdrop"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="header__menu" aria-label="Mobile navigation">
            <NavLink to="/" className="header__menu-link" end>
              Portfolio
            </NavLink>
            <NavLink to="/research" className="header__menu-link">
              Research
            </NavLink>
            <NavLink to="/shot-chart" className="header__menu-link">
              3D Shot Chart
            </NavLink>
          </nav>
        </>
      )}
    </header>
  )
}
