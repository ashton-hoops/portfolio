import { useParams, Link, Navigate } from 'react-router-dom'
import { getProject } from '../data/projects'
import './ProjectDetail.css'

export function ProjectDetail() {
  const { slug } = useParams<{ slug: string }>()
  const project = slug ? getProject(slug) : undefined

  if (!project) {
    return <Navigate to="/projects" replace />
  }

  return (
    <div className="project-detail">
      {/* Header */}
      <section className="project-detail__header">
        <div className="container">
          <Link to="/projects" className="project-detail__back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            All Projects
          </Link>

          <span className="project-detail__timeline">{project.timeline}</span>
          <h1 className="project-detail__title">{project.title}</h1>
          <p className="project-detail__subtitle">{project.subtitle}</p>

          <div className="project-detail__tags">
            {project.tags.map((tag) => (
              <span key={tag} className="project-detail__tag">{tag}</span>
            ))}
          </div>

          {project.links && project.links.length > 0 && (
            <div className="project-detail__links">
              {project.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="project-detail__link"
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
      </section>

      {/* Stats */}
      {project.stats && project.stats.length > 0 && (
        <section className="project-detail__stats">
          <div className="container">
            <div className="stats-grid">
              {project.stats.map((stat) => (
                <div key={stat.label} className="stat">
                  <span className="stat__value">{stat.value}</span>
                  <span className="stat__label">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Content */}
      <section className="project-detail__content section">
        <div className="container container--narrow">
          <div className="prose">
            {project.longDescription.split('\n\n').map((paragraph, i) => {
              // Handle headers
              if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                return (
                  <h3 key={i}>
                    {paragraph.slice(2, -2)}
                  </h3>
                )
              }
              // Handle list items
              if (paragraph.startsWith('- ')) {
                const items = paragraph.split('\n').filter(line => line.startsWith('- '))
                return (
                  <ul key={i}>
                    {items.map((item, j) => (
                      <li key={j}>{item.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>
                    ))}
                  </ul>
                )
              }
              // Regular paragraphs with bold text
              const html = paragraph
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
              return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      {project.features && project.features.length > 0 && (
        <section className="project-detail__features section">
          <div className="container">
            <h2 className="section-label">Features</h2>
            <div className="features-grid">
              {project.features.map((feature, i) => (
                <div key={i} className="feature">
                  <span className="feature__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span className="feature__text">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tech Stack */}
      {project.techStack && project.techStack.length > 0 && (
        <section className="project-detail__tech section">
          <div className="container">
            <h2 className="section-label">Technical Stack</h2>
            <div className="tech-grid">
              {project.techStack.map((tech, i) => (
                <div key={i} className="tech-item">{tech}</div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="project-detail__cta section">
        <div className="container">
          <div className="cta-box">
            <h3>Interested in this project?</h3>
            <p>I'd love to walk you through the details or discuss how similar tools could help your program.</p>
            <a href="mailto:ashtonbjantz@icloud.com" className="cta-button">
              Get in Touch
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
