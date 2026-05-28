import { Link } from 'react-router-dom'
import { articles, formatDate } from '../data/articles'
import { MediaPreview } from '../components/MediaPreview'
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
          {articles.map((article) => {
            const hasPreview =
              (article.videos && article.videos.length > 0) ||
              (article.coverImages && article.coverImages.length > 0) ||
              Boolean(article.coverImage)
            return (
              <Link key={article.slug} to={`/research/${article.slug}`} className="article-card">
                {hasPreview && (
                  <div
                    className="article-card__cover"
                    style={article.coverAspect ? { aspectRatio: article.coverAspect } : undefined}
                  >
                    {article.videos && article.videos.length > 0 ? (
                      <MediaPreview
                        videos={article.videos}
                        alt={article.title}
                        poster={article.coverImage}
                      />
                    ) : article.coverImages && article.coverImages.length > 0 ? (
                      <MediaPreview images={article.coverImages} alt={article.title} />
                    ) : article.coverImage ? (
                      <img src={article.coverImage} alt="" loading="lazy" />
                    ) : null}
                  </div>
                )}

                <div className="article-card__body">
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
                    {article.tags.includes('Project') ? 'Read Project' : 'Read Research'}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
