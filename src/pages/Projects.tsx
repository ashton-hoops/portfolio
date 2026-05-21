import { ProjectCard } from '../components/ProjectCard'
import { projects } from '../data/projects'
import './Projects.css'

export function Projects() {
  return (
    <div className="projects-page">
      <section className="projects-page__header">
        <div className="container">
          <h1 className="projects-page__title">Projects</h1>
          <p className="projects-page__subtitle">
            Tools, platforms, and visualizations I've built for basketball analytics.
          </p>
        </div>
      </section>

      <section className="projects-page__grid">
        <div className="container">
          <div className="projects-page__list">
            {projects.map((project) => (
              <ProjectCard key={project.slug} {...project} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
