import { useEffect, useRef } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { getArticle, formatDate } from '../data/articles'
import { CVDemoCarousel } from '../components/CVDemoCarousel'
import './Article.css'

// Single-video demo (no carousel chrome, no clip counter). Used when the
// article only has one video — currently the 3D Shot Chart. Loops on repeat,
// autoplays muted, click-to-fullscreen.
function SingleVideoDemo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.muted = true
    el.loop = true
    el.playsInline = true
    const attempt = () => el.play().catch(() => {})
    if (el.readyState >= 2) attempt()
    else el.addEventListener('canplay', attempt, { once: true })
  }, [src])
  const handleClick = () => {
    const el = ref.current
    if (!el) return
    const anyEl = el as HTMLVideoElement & {
      webkitRequestFullscreen?: () => void
      webkitEnterFullscreen?: () => void
    }
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
    else if (anyEl.webkitRequestFullscreen) anyEl.webkitRequestFullscreen()
    else if (anyEl.webkitEnterFullscreen) anyEl.webkitEnterFullscreen()
  }
  return (
    <div className="article-page__single-video">
      <video
        ref={ref}
        src={src}
        autoPlay
        muted
        playsInline
        loop
        preload="auto"
        onClick={handleClick}
      />
      <span className="article-page__single-video-hint" aria-hidden="true">⤢ Click to expand</span>
    </div>
  )
}

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
            All Research
          </Link>

          <div className="article-page__meta">
            <span>{formatDate(article.date)}</span>
            <span className="article-page__divider">&middot;</span>
            <span>{article.readingTime}</span>
          </div>

          <h1 className="article-page__title">{article.title}</h1>

          {article.subtitle && (
            <p className="article-page__subtitle">{article.subtitle}</p>
          )}

          <div className="article-page__tags">
            {article.tags.map((tag) => (
              <span key={tag} className="article-page__tag">{tag}</span>
            ))}
          </div>

          {article.links && article.links.length > 0 && (
            <div className="article-page__links">
              {article.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target={link.url.startsWith('http') ? '_blank' : undefined}
                  rel={link.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="article-page__link"
                >
                  {link.label}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Video demo */}
      {article.videos && article.videos.length > 0 && (
        <section className="article-page__demo">
          <div className="container container--narrow">
            {article.videos.length === 1 ? (
              <SingleVideoDemo src={article.videos[0].src ?? ''} />
            ) : (
              <CVDemoCarousel clips={article.videos} label={`${article.title} demo`} />
            )}
          </div>
        </section>
      )}

      {/* Content */}
      <div className="article-page__content section">
        <div className="container container--narrow">
          <div className="article-prose">
            {renderContent(article.content)}
          </div>
        </div>
      </div>

      {/* Features */}
      {article.features && article.features.length > 0 && (
        <section className="article-page__features">
          <div className="container container--narrow">
            <h2 className="article-page__section-label">Features</h2>
            <ul className="article-page__features-list">
              {article.features.map((feature, i) => (
                <li key={i}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Tech Stack */}
      {article.techStack && article.techStack.length > 0 && (
        <section className="article-page__tech">
          <div className="container container--narrow">
            <h2 className="article-page__section-label">Technical Stack</h2>
            <ul className="article-page__tech-list">
              {article.techStack.map((tech, i) => (
                <li key={i}>{tech}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

    </article>
  )
}
