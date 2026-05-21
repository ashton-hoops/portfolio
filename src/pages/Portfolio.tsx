import { Link } from 'react-router-dom'
import { ProjectCard } from '../components/ProjectCard'
import { projects } from '../data/projects'
import './Portfolio.css'

const HEADSHOT = '/images/ashton-portrait.jpg'

const SKILLS = [
  'Advanced Analytics',
  'Computer Vision',
  'Machine Learning',
  'Software Development',
  '3D Visualization',
]

export function Portfolio() {
  return (
    <div className="portfolio">
      {/* ==================================================================
         HERO — two columns: about (left) + projects (right)
         ================================================================== */}
      <section className="masthead">
        <div className="container--wide masthead__inner">
          {/* LEFT: About */}
          <aside className="masthead__about">
            <p className="masthead__location">Norman, Oklahoma</p>

            <div className="masthead__main">
              <div className="masthead__headshot">
                <img src={HEADSHOT} alt="Ashton Jantz" />
              </div>
              <div className="masthead__heading">
                <h1 className="masthead__name">Ashton Jantz</h1>
                <p className="masthead__role">Basketball Analytics &amp; Research</p>
                <p className="masthead__status">Seeking graduate assistant roles · 2026–27</p>
              </div>
            </div>

            <p className="masthead__bio">
              Passionate about the game and understanding what drives winning. Focused on
              evaluating opponent actions, coverages, and outcomes, combining film and data
              to generate insights, and using analytics and research to support coaching
              staff and players.
            </p>

            <dl className="masthead__facts">
              <div>
                <dt>Skills</dt>
                <dd className="masthead__skills">
                  {SKILLS.map((skill) => (
                    <span key={skill} className="masthead__skill">{skill}</span>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Education</dt>
                <dd>B.B.A. Sports Business · OU '26</dd>
              </div>
              <div>
                <dt>On the floor</dt>
                <dd>OU WBB practice player, 2024–26</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>
                  <a href="mailto:ashtonbjantz@icloud.com">ashtonbjantz@icloud.com</a>
                  <br />
                  <a href="tel:14056969206">(405) 696-9206</a>
                </dd>
              </div>
            </dl>

            <div className="masthead__cta">
              <Link to="/pdf/all" className="btn btn--primary">
                View portfolio deck →
              </Link>
              <a href="mailto:ashtonbjantz@icloud.com" className="btn btn--ghost">
                Get in touch
              </a>
              <Link to="/resume" className="btn btn--ghost">
                View resume
              </Link>
            </div>
          </aside>

          {/* RIGHT: Projects */}
          <main className="masthead__work">
            <div className="masthead__work-head">
              <p className="eyebrow">Selected Work</p>
              <Link to="/projects" className="masthead__work-link">
                All projects →
              </Link>
            </div>
            <div className="masthead__work-grid">
              {projects.map((project) => (
                <ProjectCard key={project.slug} {...project} />
              ))}
            </div>
          </main>
        </div>
      </section>
    </div>
  )
}
