import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipFrame, DistributionHistogram, LeagueComparisonChart } from './charts2'
import './TwoForOne.css'

export default function TwoForOne() {
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
    <article ref={articleRef} className="t41">
      <div className="t41__progress-track">
        <div className="t41__progress-bar" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Header */}
      <header className="t41__header">
        <div className="t41__header-inner">
          <Link to="/research" className="t41__back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to research
          </Link>
          <div className="t41__meta">
            <span>May 26, 2026</span>
            <span className="t41__divider">·</span>
            <span>6 min read</span>
          </div>
          <h1 className="t41__title">The Optimal Time to Go 2-for-1 in Women's College Basketball</h1>
          <p className="t41__subtitle">
            The running clock in Q1, Q2, and Q3 shapes the timing math. The optimal first-shot window is between 0:42 and 0:48 on the game clock.
          </p>
          <div className="t41__tags">
            <span className="t41__tag">Research & Analytics</span>
          </div>
        </div>
      </header>

      <div className="t41__body">
        <div className="t41__container">

          {/* ============ Lead paragraph ============ */}
          <section className="t41__section">
            <p>
              Unlike the WNBA and NBA, college basketball plays with a running clock after made field goals through the first three quarters in the women's game and during the first half of the men's game. This research works through the optimal time to go 2-for-1 based on more than 125,000 opportunities across eight seasons of Division I WBB, and lands on a six-second release window for the ideal first shot.
            </p>
          </section>

          {/* ============ Method ============ */}
          <section className="t41__section">
            <h2>Method</h2>
            <p>
              The math of a 2-for-1 in college basketball has to account for several factors that do not show up clearly in play-by-play data. A made field goal can create three to five seconds of game clock runoff while the ball is picked up and inbounded, and play-by-play logs the moment the play resolves rather than the actual shot release. It also has to account for how much time the offensive team can get on its second possession to take a real shot rather than a heave, along with events that stop the clock entirely, like fouls and out-of-bounds plays.
            </p>
            <p>
              The data I looked at included every possession that started between 50 and 70 seconds remaining in Q1, Q2, or Q3 with a full 30-second shot clock. The ideal outcome is a clean 2-for-1 where the team in possession gets two real shots and the opponent gets at most one real possession plus a possible heave with 5 seconds or less remaining. Turnovers are excluded since the team never got a shot up. Offensive rebounds and fouls that led to free throws are kept in the sample as long as the team's eventual shot still landed in the 0:42 to 0:48 window.
            </p>
          </section>

          {/* ============ The finding ============ */}
          <section className="t41__section">
            <h2>The finding</h2>
            <p>
              After accounting for all factors, the clean 2-for-1 rate peaks when the first shot is released between 0:42 and 0:48 on the game clock. In that window, the strategy converts cleanly about 86 percent of the time.
            </p>
            <p>
              Shooting in this range gives the opponent one real possession, while the 2-for-1 team still holds its second possession for the last shot of the quarter and should have at least seven seconds to do so.
            </p>
            <p>
              The optimal rate drops to 82 percent when the first shot goes up earlier between 0:48 and 0:54, and falls again to 77 percent if the offense waits until 0:36 to 0:42.
            </p>

            <DistributionHistogram />
          </section>

          {/* ============ Manipulating the Clock ============ */}
          <section className="t41__section">
            <h2>Manipulating the Clock</h2>
            <p>
              The five-second inbound rule starts only when the inbounder has the ball in hand. The ball-retrieval phase before that is dead time on the game clock with no shot clock effect. The idea is that a slight delay on the inbound, when the opponent scores around the 1:16 to 1:26 range, can drop the team naturally into the 0:42 to 0:48 release window without bleeding shot clock. The same outcome can be reached by inbounding and letting the ball roll before any offensive player touches it.
            </p>
            <p>
              This can be used as a way to manipulate the clock, although right now it only tends to happen accidentally rather than intentionally. In this example, Texas A&M takes 6 seconds to inbound after the made basket which drops them into the ideal window and gives them 22 - 28 seconds to do so.
            </p>

            <ClipFrame
              src="/videos/two-for-one-texas-am.mp4"
              caption="Oklahoma scores at 1:16. Texas A&M inbounds at 1:10, six seconds of game clock burned without shot clock."
            />
          </section>

          {/* ============ The Utilization Gap with the NBA ============ */}
          <section className="t41__section">
            <h2>The Utilization Gap with the NBA</h2>
            <p>
              A study done across the 2018-19 through 2021-22 NBA seasons showed that NBA teams attempted 2-for-1s at around a 67 percent rate. That number increased dramatically from the league average of 38 percent across the 2007-08 through 2017-18 seasons. Division I women's basketball has not made the same adjustment yet and sits around 35 percent utilization across Division I.
            </p>
            <p>
              The gap may be partially caused by the running clock structure in college basketball, teams playing with less pace and more deliberate end-of-quarter organization, or simply how difficult the timing can be to install consistently from a coaching standpoint.
            </p>

            <LeagueComparisonChart />
          </section>

          {/* Footer */}
          <div className="t41__signoff">
            Data derived from play-by-play via sportsdataverse across all Division I women's basketball games from the 2018-19 through 2025-26 seasons.
            <br /><br />
            Sources: <a href="https://arxiv.org/abs/2412.08840" target="_blank" rel="noreferrer">The Causal Effect of the Two-For-One Strategy in the NBA (Cordova, Hsiao, &amp; Frangenberg, 2024)</a>; <a href="https://cleaningtheglass.com/two-for-one-or-two-for-none/" target="_blank" rel="noreferrer">Two-For-One or Two-For-None? (Falk &amp; Positive Residual, 2018)</a>.
          </div>

        </div>
      </div>
    </article>
  )
}
