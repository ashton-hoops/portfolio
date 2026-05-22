import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  VerticalBarChart,
  HorizontalBarChart,
  StackedBarChart,
  Callout,
  StatCard,
} from './charts'
import {
  pppByActionCount, PPP_BY_ACTION_COUNT_AVG,
  paintTouchByActionCount, PAINT_TOUCH_BY_ACTION_COUNT_AVG,
  paintTouchByAction, PAINT_TOUCH_BY_ACTION_AVG,
  pppByAction, PPP_BY_ACTION_AVG,
  pppByContest, PPP_BY_CONTEST_AVG,
  contestByAction, CONTEST_AVG_OPEN_LIGHT,
  paintTouchByFormation, PAINT_TOUCH_BY_FORMATION_AVG,
  pppByFormation, PPP_BY_FORMATION_AVG,
  taggedFields,
} from './data'
import './DefensiveAnalysis.css'

export default function DefensiveAnalysis() {
  const articleRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const el = articleRef.current
      if (!el) return
      const { top, height } = el.getBoundingClientRect()
      const vh = window.innerHeight
      setProgress(Math.min(1, Math.max(0, -top / (height - vh))))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <article ref={articleRef} className="da">
      {/* Progress bar */}
      <div className="da__progress-track">
        <div className="da__progress-bar" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* ================================================================
          Header
          ================================================================ */}
      <header className="da__header">
        <div className="da__header-inner">
          <Link to="/research" className="da__back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            All Research
          </Link>

          <div className="da__meta">
            <span>May 10, 2026</span>
            <span className="da__meta-dot">&middot;</span>
            <span>10 min read</span>
          </div>

          <h1 className="da__title">Defensive Analysis: 2025-26 Season</h1>

          <p className="da__subtitle">
            811 Oklahoma defensive possessions tagged across 15 tournament-level opponents, connecting actions,
            coverages, and outcomes in a way standard film and box-score platforms don't capture.
          </p>

          <div className="da__tags">
            {['Defense', 'Film Study', 'Research', 'Data'].map((t) => (
              <span key={t} className="da__tag">{t}</span>
            ))}
          </div>

          <div className="da__stats-row">
            <StatCard value="811" label="Possessions Tagged" />
            <StatCard value="15" label="Opponents" />
            <StatCard value="14" label="Action Types" />
            <StatCard value="594" label="Shot Contests" />
          </div>
        </div>
      </header>

      {/* ================================================================
          Content
          ================================================================ */}
      <div className="da__content">

        {/* --- Intro --- */}
        <section className="da__section">
          <div className="da__prose">
            <p>
              During the 2025-26 season I independently tagged every half-court defensive
              possession across 15 tournament-level opponents with available full game footage
              (excluding SEC tournament versus LSU). Each of the 811 possessions was tagged with
              the play name or formation, the actions involved, the sequence of those actions,
              the defensive coverage, the shot-contest level, paint touches, scouting role, and
              the outcome. I built the tagging dashboard, the data pipeline, and the visualization
              layer from scratch to support this work.
            </p>
            <p>
              The goal was to connect exact opponent actions, coverages, and outcomes in a way
              that standard film and box-score platforms don't capture. The dashboard incorporates
              team-specific scouting designations (Primary Players, Shooters, and Role Players)
              along with shot-chart and play-by-play data.
            </p>
          </div>
        </section>

        {/* --- Tools Built --- */}
        <section className="da__section">
          <h2 className="da__h2">Tools Built for This Project</h2>
          <div className="da__prose">
            <p>
              I designed and programmed the Defense Dashboard from scratch as a custom
              film-tagging and analytics platform for half-court defense. I tagged 811
              possessions across 15 tournament-level opponents, with each individual action,
              pass, contest level, and more recorded to find what actions, plays, and triggers
              caused the most difficulty for the Oklahoma defense. It also incorporated scouting
              designations such as Primary Players, Shooters, and Role Players, along with 3D
              shot charts, lineup building tools, head-to-head comparison, and other analytics.
            </p>
          </div>

          <div className="da__slideshow">
            <div className="da__slideshow-wrap">
              {[
                { thumb: '/images/thumb-defense.png', alt: 'Defense Dashboard — game-by-game overview' },
                { thumb: '/images/thumb-defense-game-detail.png', alt: 'Game detail — clip browser' },
                { thumb: '/images/thumb-defense-tagger.png', alt: 'Clip tagger — video tagging interface' },
                { thumb: '/images/thumb-defense-shot-chart.png', alt: 'Shot chart — court-mapped attempts' },
                { thumb: '/images/thumb-defense-team.png', alt: 'Team analytics — defensive metrics' },
                { thumb: '/images/thumb-defense-trends.png', alt: 'Performance trends — game-by-game line chart' },
                { thumb: '/images/thumb-defense-players.png', alt: 'Players — roster ledger' },
                { thumb: '/images/thumb-defense-lineups.png', alt: 'Lineups — 5-player combinations' },
                { thumb: '/images/thumb-defense-twoplayer.png', alt: 'Two-player combinations' },
                { thumb: '/images/thumb-defense-h2h.png', alt: 'Head-to-head — on/off comparison' },
              ].map((img) => (
                <img key={img.alt} src={img.thumb} alt={img.alt} loading="lazy" />
              ))}
            </div>
          </div>

          <div className="da__dashboard-link-row">
            <a
              href="https://ou-basketball-defense.onrender.com"
              target="_blank"
              rel="noopener noreferrer"
              className="da__dashboard-link"
            >
              <span className="da__dashboard-link-text">
                <span className="da__dashboard-link-label">VIEW DASHBOARD</span>
                <span className="da__dashboard-link-url">ou-basketball-defense.onrender.com</span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
          </div>
        </section>

        {/* --- The Setup --- */}
        <section className="da__section">
          <h2 className="da__h2">What Was Tagged in the Dashboard</h2>
          <div className="da__prose">
            <p>
              Each half-court possession was tagged with the play name or formation (Horns Flare,
              Zipper Pin-Down, Spain PNR, etc.), the actions involved (DHO, Flare, Pin-Down, Get
              Action, etc.), the sequence of those actions, the defensive coverage, and the
              shot-contest level.
            </p>
          </div>

          <div className="da__table-wrap">
            <table className="da__table">
              <thead>
                <tr>
                  <th>Tagged Field</th>
                  <th>What It Captures</th>
                </tr>
              </thead>
              <tbody>
                {taggedFields.map((row) => (
                  <tr key={row.field}>
                    <td>{row.field}</td>
                    <td>{row.captures}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="da__prose">
            <p>
              With 811 possessions in the database, the sample size is large enough to compare
              across games and opponents and find trends that actually mean something.
            </p>
          </div>
        </section>

        {/* --- Finding 1 --- */}
        <section className="da__section">
          <h2 className="da__h2">Did More Actions Correlate With an Increase in PPP and Paint Touches?</h2>

          <Callout>
            <p>
              Possessions where opponents ran more actions were associated with higher PPP.
              Those with No Actions/ISO (<strong>0.79 PPP</strong>) or 1 Action (
              <strong>0.76 PPP</strong>) stayed well below the 0.99 average, while
              possessions with 2-3 Actions (<strong>1.06 PPP</strong>), 4-6 Actions (
              <strong>1.05 PPP</strong>), and 7-9 Actions (<strong>1.24 PPP</strong>) all rose
              above it. The same pattern holds when passes are included in the count.
            </p>
          </Callout>

          <div className="da__chart-wide">
            <VerticalBarChart
              title="OPPONENT PPP BY NUMBER OF ACTIONS"
              data={pppByActionCount}
              avg={PPP_BY_ACTION_COUNT_AVG}
              avgLabel="AVG 0.99 (Half-Court Possessions)"
              maxValue={1.5}
            />
          </div>

          <Callout>
            <p>
              Paint touch rates were associated with action count, rising from{' '}
              <strong>34%</strong> on 1-action possessions to <strong>90%</strong> on 7-9-action
              possessions. Contest levels stayed similar regardless of action count.
            </p>
          </Callout>

          <div className="da__chart-wide">
            <VerticalBarChart
              title="OPPONENT PAINT TOUCH % BY NUMBER OF ACTIONS"
              data={paintTouchByActionCount}
              avg={PAINT_TOUCH_BY_ACTION_COUNT_AVG}
              avgLabel="AVG 60% (Half-Court Possessions)"
              unit="%"
              maxValue={100}
            />
          </div>
        </section>

        {/* --- Finding 2 --- */}
        <section className="da__section">
          <h2 className="da__h2">Which Specific Actions Correlate With an Increase in PPP and Paint Touches?</h2>

          <Callout>
            <p>
              Among reliable sample sizes, Isolations showed the highest correlation with paint
              touches at <strong>77%</strong>, above the 60% average. Side PNR/PNP actions (
              <strong>73%</strong>) and Rejected Ball Screens (<strong>69%</strong>) were also
              associated with high frequency of paint touches. Among lower-sample actions, Fake
              DHO/Keeps, Ghost Screens, and Cross Screens also showed significant correlation
              with paint touches.
            </p>
          </Callout>

          <div className="da__chart-wide">
            <HorizontalBarChart
              title="OPPONENT PAINT TOUCH %"
              data={paintTouchByAction}
              avg={PAINT_TOUCH_BY_ACTION_AVG}
              avgLabel={`AVG ${PAINT_TOUCH_BY_ACTION_AVG}% · Half-Court Possessions`}
              unit="%"
              maxValue={100}
            />
          </div>

          <Callout>
            <p>
              Among reliable sample sizes, DHOs were associated with the most PPP at{' '}
              <strong>1.23 PPP</strong>, above the 0.99 PPP average. Pick &amp; Pops were held to{' '}
              <strong>0.69 PPP</strong>. DHOs generated paint touches only 51% of the time but
              still averaged 1.23 PPP. Among lower-sample actions, Back Screen (
              <strong>1.58 PPP</strong>), Stagger (<strong>1.36 PPP</strong>), Ghost Screen (
              <strong>1.29 PPP</strong>) showed the highest PPP.
            </p>
          </Callout>

          <div className="da__chart-wide">
            <HorizontalBarChart
              title="OPPONENT PPP"
              data={pppByAction}
              avg={PPP_BY_ACTION_AVG}
              avgLabel={`AVG ${PPP_BY_ACTION_AVG} · Half-Court Possessions`}
              maxValue={1.8}
            />
          </div>
        </section>

        {/* --- Finding 3 --- */}
        <section className="da__section">
          <h2 className="da__h2">Contest Level by Last Action</h2>

          <Callout>
            <p>
              On half-court possessions that ended in a shot attempt, contest level was strongly
              associated with scoring. The most open looks (4+ ft) produced{' '}
              <strong>1.52 PPP</strong>, while the most tightly contested (Heavy / Early
              High-Hand) held opponents to <strong>0.57 PPP</strong>.
            </p>
          </Callout>

          <div className="da__chart-wide">
            <HorizontalBarChart
              title="OPPONENT PPP BY CONTEST LEVEL"
              data={pppByContest}
              avg={PPP_BY_CONTEST_AVG}
              avgLabel={`AVG ${PPP_BY_CONTEST_AVG} · Possessions W/ FGA`}
              maxValue={1.8}
            />
          </div>

          <Callout>
            <p>
              Across the seven most common actions,{' '}
              <strong>{CONTEST_AVG_OPEN_LIGHT}%</strong> of possessions ended Open (4+ ft) or
              Light / Late High-Hand on average. Pin-Downs led to the most open shots at{' '}
              <strong>62%</strong> open-or-light, while Side PNR/PNP was the most tightly
              contested at <strong>75%</strong> contested or heavy / early high-hand.
            </p>
          </Callout>

          <div className="da__chart-wide">
            <StackedBarChart
              title="CONTEST LEVEL BY ACTION"
              data={contestByAction}
              avgLabel={`AVG ${CONTEST_AVG_OPEN_LIGHT}% Open/Light · Half-Court Possessions W/ FGA`}
            />
          </div>
        </section>

        {/* --- Finding 4 --- */}
        <section className="da__section">
          <h2 className="da__h2">Opp PPP by OU Miss Zone</h2>

          <Callout>
            <p>
              OU's shot distance was associated with how much the opponent scored on the next
              possession. Wing or top-of-key 3 misses produced <strong>1.22 PPP</strong>, basically
              the same as an OU live-ball turnover (<strong>1.21</strong>). Inside-the-arc misses
              correlated with OU's lowest opp PPP: rim (0.66), paint + short midrange (0.61), and
              long midrange (0.76).
            </p>
          </Callout>

          <div className="da__chart-wide">
            <figure className="da-court-img">
              <img
                src="/images/da-court-diagram.png"
                alt="Opp PPP on next possession by OU miss zone — at rim 0.66, paint 0.61, long midrange 0.76, corner 3 1.18, wing 3 1.22, top of key 3 1.22, after OU live-ball turnover 1.21 PPP"
                loading="lazy"
              />
            </figure>
          </div>
        </section>

        {/* --- Finding 5 --- */}
        <section className="da__section">
          <h2 className="da__h2">Set &amp; Formation Breakdown</h2>

          <Callout>
            <p>
              Among reliable sample sizes, Pistol led paint touches at <strong>59%</strong>, above
              the 48% average. Floppy created the least paint touches at <strong>28%</strong>.
              Among lower-sample sets, UCLA (<strong>67%</strong>) and Zipper (
              <strong>50%</strong>) showed the highest paint touch rates.
            </p>
          </Callout>

          <div className="da__chart-wide">
            <HorizontalBarChart
              title="OPPONENT PAINT TOUCH % BY FORMATION / SET"
              data={paintTouchByFormation}
              avg={PAINT_TOUCH_BY_FORMATION_AVG}
              avgLabel={`AVG ${PAINT_TOUCH_BY_FORMATION_AVG}% · Tagged Play / Set`}
              unit="%"
              maxValue={100}
            />
          </div>

          <Callout>
            <p>
              Among reliable sample sizes, Floppy was the highest at <strong>1.33 PPP</strong>,
              vs the 1.07 PPP average. Pistol was best defended at <strong>1.06 PPP</strong>.
              Among lower-sample sets, UCLA (<strong>1.56 PPP</strong>) showed the highest PPP.
            </p>
          </Callout>

          <div className="da__chart-wide">
            <HorizontalBarChart
              title="OPPONENT PPP BY FORMATION / SET"
              data={pppByFormation}
              avg={PPP_BY_FORMATION_AVG}
              avgLabel={`AVG ${PPP_BY_FORMATION_AVG} · Tagged Play / Set`}
              maxValue={1.8}
            />
          </div>
        </section>

        {/* --- Summary --- */}
        <section className="da__section">
          <h2 className="da__h2">Summary</h2>
          <div className="da__prose">
            <p>
              This report establishes a baseline for analyzing half-court defense by tagging
              actions to outcomes. The next phase would be to focus on scaling this to capture
              individual assignments, hustle stats, and precise coverage details. Upgrading the
              tagging process would allow better insight into specific defenders, coverages, and
              breakdowns.
            </p>
            <p>
              Specifically, that means continuing the computer-vision pipeline to automate
              detection of matchups, actions, and screens, attaching the defender of record to
              every offensive event instead of just the final shot, and tracking deflections and
              prevented passes to build out a defensive disruption category. Other priorities are
              tagging help defense on drives, capturing box-out, splitting fouls into on-ball and
              off-ball, and tracking emergency switches.
            </p>
          </div>
        </section>
      </div>

    </article>
  )
}
