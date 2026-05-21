import { useParams, Link, Navigate } from 'react-router-dom'
import { getArticle, formatDate } from '../data/articles'
import './Article.css'

export function Article() {
  const { slug } = useParams<{ slug: string }>()
  const article = slug ? getArticle(slug) : undefined

  if (!article) {
    return <Navigate to="/research" replace />
  }

  // Parse markdown-like content into HTML
  const renderContent = (content: string) => {
    return content.split('\n\n').map((block, i) => {
      // H2 headers
      if (block.startsWith('## ')) {
        return <h2 key={i}>{block.slice(3)}</h2>
      }
      // Numbered lists
      if (block.match(/^\d+\.\s/)) {
        const items = block.split('\n').filter(line => line.match(/^\d+\.\s/))
        return (
          <ol key={i}>
            {items.map((item, j) => (
              <li key={j} dangerouslySetInnerHTML={{
                __html: item.replace(/^\d+\.\s/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')
              }} />
            ))}
          </ol>
        )
      }
      // Bullet lists
      if (block.startsWith('- ')) {
        const items = block.split('\n').filter(line => line.startsWith('- '))
        return (
          <ul key={i}>
            {items.map((item, j) => (
              <li key={j} dangerouslySetInnerHTML={{
                __html: item.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')
              }} />
            ))}
          </ul>
        )
      }
      // Regular paragraphs
      const html = block
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
      return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />
    })
  }

  return (
    <article className="article-page">
      {/* Header */}
      <header className="article-page__header">
        <div className="container container--narrow">
          <Link to="/research" className="article-page__back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            All Articles
          </Link>

          <div className="article-page__meta">
            <span>{formatDate(article.date)}</span>
            <span className="article-page__divider">&middot;</span>
            <span>{article.readingTime}</span>
          </div>

          <h1 className="article-page__title">{article.title}</h1>

          <div className="article-page__tags">
            {article.tags.map((tag) => (
              <span key={tag} className="article-page__tag">{tag}</span>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="article-page__content section">
        <div className="container container--narrow">
          <div className="article-prose">
            {renderContent(article.content)}
          </div>
        </div>
      </div>

      {/* Author */}
      <footer className="article-page__footer">
        <div className="container container--narrow">
          <div className="author-card">
            <div className="author-card__avatar">AJ</div>
            <div className="author-card__info">
              <span className="author-card__name">Ashton Jantz</span>
              <span className="author-card__bio">
                Former practice player at OU Women's Basketball. Building analytics tools for basketball.
              </span>
            </div>
            <a href="mailto:ashtonbjantz@icloud.com" className="author-card__link">
              Get in Touch
            </a>
          </div>
        </div>
      </footer>
    </article>
  )
}
