import { Link } from 'react-router-dom'
import { articles, formatDate } from '../data/articles'
import './Research.css'

export function Research() {
  return (
    <div className="research-page">
      <section className="research-page__header section--sm">
        <div className="container">
          <h1 className="research-page__title">Research</h1>
          <p className="research-page__subtitle">
            Analysis, findings, and thoughts on basketball analytics, visualization, and the tools I'm building.
          </p>
        </div>
      </section>

      <section className="research-page__list section">
        <div className="container container--narrow">
          {articles.map((article) => (
            <Link key={article.slug} to={`/research/${article.slug}`} className="article-card">
              <div className="article-card__meta">
                <span className="article-card__date">{formatDate(article.date)}</span>
                <span className="article-card__divider">&middot;</span>
                <span className="article-card__time">{article.readingTime}</span>
              </div>

              <h2 className="article-card__title">{article.title}</h2>
              <p className="article-card__excerpt">{article.excerpt}</p>

              <div className="article-card__tags">
                {article.tags.map((tag) => (
                  <span key={tag} className="article-card__tag">{tag}</span>
                ))}
              </div>

              <span className="article-card__cta">
                Read Article
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
