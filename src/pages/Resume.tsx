import './Resume.css'

export function Resume() {
  return (
    <div className="resume">
      <div className="resume__container container--wide">
        {/* ---------- Header strip ---------- */}
        <header className="resume__top">
          <div className="resume__top-left">
            <h1 className="resume__name">Ashton Jantz</h1>
            <p className="resume__role">Basketball Analytics &amp; Software Development</p>
          </div>
          <div className="resume__top-right">
            <span>ashtonbjantz@icloud.com</span>
            <span>(405) 696-9206</span>
            <span>Norman, OK</span>
            <a href="/resume.pdf" target="_blank" rel="noreferrer" className="resume__pdf">
              Download PDF
            </a>
          </div>
        </header>

        {/* ---------- Two-column body ---------- */}
        <div className="resume__body">
          {/* LEFT — bio / skills / education / references */}
          <aside className="resume__side">
            <section className="resume__block">
              <h2 className="resume__label">Profile</h2>
              <p className="resume__bio">
                Recent OU graduate passionate about the game and what drives winning. Combines
                two seasons of on-floor experience as a Women's Basketball practice player with
                self-taught software engineering to build defensive analytics tools for coaching
                staffs.
              </p>
            </section>

            <section className="resume__block">
              <h2 className="resume__label">Education</h2>
              <div className="resume__edu">
                <strong>B.B.A., Sports Business</strong>
                <span>University of Oklahoma · May 2026</span>
                <em>Sports Analytics concentration</em>
              </div>
            </section>

            <section className="resume__block">
              <h2 className="resume__label">Skills</h2>
              <div className="resume__skill-group">
                <span className="resume__skill-key">Code</span>
                <span className="resume__skill-val">Python · TypeScript · React · SQL · R</span>
              </div>
              <div className="resume__skill-group">
                <span className="resume__skill-key">Data</span>
                <span className="resume__skill-val">Tableau · Three.js · D3 · Pandas · Excel</span>
              </div>
              <div className="resume__skill-group">
                <span className="resume__skill-key">CV / ML</span>
                <span className="resume__skill-val">OpenCV · PyTorch · YOLO · NumPy</span>
              </div>
              <div className="resume__skill-group">
                <span className="resume__skill-key">Basketball</span>
                <span className="resume__skill-val">Film breakdown · Scouting · Play design</span>
              </div>
            </section>

            <section className="resume__block">
              <h2 className="resume__label">References</h2>
              <div className="resume__ref">
                <strong>Cal Watson</strong>
                <span>Director of Scouting &amp; Analytics</span>
                <em>Alabama WBB</em>
              </div>
              <div className="resume__ref">
                <strong>Michael Neal</strong>
                <span>Director of Player Development</span>
                <em>Oklahoma WBB</em>
              </div>
              <p className="resume__ref-note">Contact info available upon request.</p>
            </section>
          </aside>

          {/* RIGHT — experience */}
          <main className="resume__main">
            <h2 className="resume__label resume__label--main">Experience</h2>

            <article className="resume__job">
              <div className="resume__job-head">
                <div>
                  <h3 className="resume__job-title">Practice Player</h3>
                  <span className="resume__job-org">University of Oklahoma Women's Basketball</span>
                </div>
                <span className="resume__job-date">2024 – 2026</span>
              </div>
              <ul className="resume__job-bullets">
                <li>Ran scout team simulations of opponent sets for two seasons of preparation.</li>
                <li>Designed and built a full defensive analytics platform for the program — film tagging, shot charts, lineup metrics, and statistical reports — from scratch.</li>
                <li>Tagged 811 half-court possessions across 15 tournament-level opponents.</li>
              </ul>
            </article>

            <article className="resume__job">
              <div className="resume__job-head">
                <div>
                  <h3 className="resume__job-title">Founder</h3>
                  <span className="resume__job-org">Hoops &amp; Heritage</span>
                </div>
                <span className="resume__job-date">2021 – Present</span>
              </div>
              <ul className="resume__job-bullets">
                <li>Design brand making decorative mini basketball hoops as functional art.</li>
                <li>Built brand, product line, e-commerce, and wholesale program from zero.</li>
                <li>Collaborations with NBA players, art institutions, and independent retailers.</li>
              </ul>
            </article>

            <article className="resume__job">
              <div className="resume__job-head">
                <div>
                  <h3 className="resume__job-title">Head Coach, 5th–7th Grade Teams</h3>
                  <span className="resume__job-org">Norman Optimist Club Basketball</span>
                </div>
                <span className="resume__job-date">2021 – 2024</span>
              </div>
              <ul className="resume__job-bullets">
                <li>Practice planning, game strategy, and player development for youth teams.</li>
              </ul>
            </article>

            <h2 className="resume__label resume__label--main resume__label--spaced">Selected Projects</h2>
            <article className="resume__job">
              <div className="resume__job-head">
                <div>
                  <h3 className="resume__job-title">Defensive Analysis Dashboard</h3>
                  <span className="resume__job-org">React · Python · PostgreSQL · Cloudflare R2</span>
                </div>
                <span className="resume__job-date">2024 – Present</span>
              </div>
              <ul className="resume__job-bullets">
                <li>Possession-by-possession film tagging, 3D shot charts, lineup metrics.</li>
              </ul>
            </article>

            <article className="resume__job">
              <div className="resume__job-head">
                <div>
                  <h3 className="resume__job-title">Computer Vision Pipeline</h3>
                  <span className="resume__job-org">Python · OpenCV · PyTorch · YOLO</span>
                </div>
                <span className="resume__job-date">2024 – Present</span>
              </div>
              <ul className="resume__job-bullets">
                <li>Player tracking, court mapping, screen / DHO detection from broadcast film.</li>
              </ul>
            </article>
          </main>
        </div>
      </div>
    </div>
  )
}
