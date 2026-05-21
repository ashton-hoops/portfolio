import { Link, NavLink } from 'react-router-dom'
import './Header.css'

export function Header() {
  return (
    <header className="header">
      <div className="header__container container">
        <Link to="/" className="header__logo">
          <span className="header__logo-text">Ashton Jantz</span>
        </Link>

        <nav className="header__nav">
          <NavLink to="/" className="header__link" end>
            Portfolio
          </NavLink>
          <NavLink to="/projects" className="header__link">
            Projects
          </NavLink>
          <NavLink to="/research" className="header__link">
            Research
          </NavLink>
          <NavLink to="/shot-chart" className="header__link">
            3D Shot Chart
          </NavLink>
        </nav>

        <a href="mailto:ashtonbjantz@icloud.com" className="header__contact" title="Email Ashton">
          Seeking GA Position · 2026–27
        </a>
      </div>
    </header>
  )
}
