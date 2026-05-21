import { Link } from 'react-router-dom'
import './ProjectCard.css'

interface ProjectCardProps {
  title: string
  subtitle: string
  description: string
  tags: string[]
  slug: string
  thumbnail?: string
  featured?: boolean
}

export function ProjectCard({
  title,
  subtitle,
  description,
  tags,
  slug,
  thumbnail,
  featured = false,
}: ProjectCardProps) {
  return (
    <Link to={`/projects/${slug}`} className={`project-card ${featured ? 'project-card--featured' : ''}`}>
      <div className="project-card__image">
        {thumbnail ? (
          <img src={thumbnail} alt={title} />
        ) : (
          <div className="project-card__placeholder">
            <span>{title.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
      </div>

      <div className="project-card__content">
        <span className="project-card__subtitle">{subtitle}</span>
        <h3 className="project-card__title">{title}</h3>
        <p className="project-card__description">{description}</p>

        <div className="project-card__tags">
          {tags.map((tag) => (
            <span key={tag} className="project-card__tag">
              {tag}
            </span>
          ))}
        </div>

        <span className="project-card__cta">
          View Project
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  )
}
