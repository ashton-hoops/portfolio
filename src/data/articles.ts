export interface Article {
  slug: string
  title: string
  excerpt: string
  date: string
  readingTime: string
  tags: string[]
  content: string
  // Optional project-style extras (rendered after content when present)
  subtitle?: string
  videos?: { id?: string; src?: string }[]
  features?: string[]
  techStack?: string[]
  links?: { label: string; url: string }[]
  coverImage?: string
  coverImages?: string[]
  // CSS aspect-ratio override for the article-card cover. Defaults to 16/7 if unset.
  // Use the image's natural aspect when it shouldn't be letterboxed (e.g. a wide chart GIF).
  coverAspect?: string
}

export const articles: Article[] = [
  {
    slug: 'defensive-analysis',
    title: 'Defensive Analysis: 2025-26 Season',
    excerpt:
      'I independently tagged 811 half-court defensive possessions across 15 tournament-level opponents using tools I built from scratch. Full report with interactive charts covering PPP by action type, paint touches, contest levels, formations, and miss-zone analysis.',
    date: '2026-05-10',
    readingTime: '10 min read',
    tags: ['Research & Analytics'],
    coverImages: [
      '/images/full-defense-team.png',
      '/images/full-defense-shot-chart.png',
      '/images/full-defense-tagger.png',
      '/images/full-defense-lineups.png',
      '/images/full-defense-trends.png',
      '/images/full-defense-game-detail.png',
    ],
    content: `
During the 2025-26 season I independently tagged every half-court defensive possession across 15 tournament-level opponents. 811 possessions total. Each one was tagged with the play name or formation, the actions involved, the sequence of those actions, the defensive coverage, the shot-contest level, paint touches, scouting role, and the outcome. I built the tagging dashboard, the data pipeline, and the visualization layer from scratch. The goal was to connect exact opponent actions, coverages, and outcomes in a way that standard film and box-score platforms don't capture.

This is a summary of what I found.

## The Setup

The Defense Dashboard I built tracks 14 distinct action types including ball screens, DHOs, pin-downs, flares, staggers, and isolations. For each possession I log the situation (half court, transition, BLOB, SLOB), the offensive formation (5-out, 4-out 1-in, etc.), the action sequence, our defensive coverage (man, zone, switch, etc.), the help and rotation, whether there was a breakdown, and the result (made FG, missed FG, turnover, foul).

With 811 possessions in the database, the sample size is large enough to compare across games and opponents and find trends that actually mean something.

## More Actions Led to Higher PPP and More Paint Touches

Possessions where opponents ran more actions were associated with higher points per possession. Those with no actions or isolations (0.79 PPP) or 1 action (0.76 PPP) stayed well below the 0.99 average, while possessions with 2-3 actions (1.06 PPP), 4-6 actions (1.05 PPP), and 7-9 actions (1.24 PPP) all rose above it.

Paint touch rates followed the same pattern, rising from 12% on no-action possessions to 34% on 1-action possessions all the way up to 90% on 7-9 action possessions. Contest levels stayed similar regardless of action count. This mattered because it showed that the number of actions an offense runs is directly tied to how much they are able to get into the paint and score efficiently. Limiting second and third actions is where the leverage is.

## Which Actions Caused the Most Damage

Among reliable sample sizes, DHOs were associated with the most PPP at 1.23, above the 0.99 average. Pick and pops were held to 0.69 PPP. DHOs generated paint touches only 51% of the time but still averaged 1.23 PPP, which suggests the scoring came from other areas like mid-range or three-point looks off the handoff.

Isolations showed the highest correlation with paint touches at 77%, above the 60% average. Side PNR/PNP actions (73%) and rejected ball screens (69%) were also associated with high paint-touch rates.

## Contest Level and Shot Location

On half-court possessions that ended in a shot attempt, contest level was strongly associated with scoring. The most open looks (4+ ft) produced 1.52 PPP, while the most tightly contested (Heavy / Early High-Hand) held opponents to 0.57 PPP.

Across the seven most common actions, 48% of possessions ended open (4+ ft) or light / late high-hand on average. Pin-downs led to the most open shots at 62% open-or-light, while side PNR/PNP was the most tightly contested at 75% contested or heavy / early high-hand.

## Set and Formation Breakdown

Among reliable sample sizes, Pistol led paint touches at 59%, above the 48% average. Floppy created the least amount of paint touches at 28%. Among lower-sample sets, UCLA (67%) and Zipper (50%) showed the highest paint touch rates.

For PPP by formation, Floppy was the highest at 1.07 PPP, compared to the 0.99 average across all tagged formations. Pistol was best defended at 1.06 PPP.

## What Comes Next

This report establishes a baseline for analyzing half-court defense by tagging actions to outcomes. The next phase would be to focus on scaling this to capture individual assignments, hustle stats, and precise coverage details. Upgrading the tagging process would allow better insight into specific defenders, coverages, and breakdowns. The computer vision pipeline I have been building is designed to eventually automate large portions of this tagging work, which would make it possible to expand the dataset significantly without the manual time commitment.
    `.trim(),
  },
  {
    slug: 'cv-pipeline',
    title: 'Computer Vision Pipeline',
    subtitle: 'Player Tracking & Action Detection',
    excerpt:
      'A custom computer vision pipeline that takes broadcast footage and automatically detects and tracks all 10 players, their court locations, and key actions like screens, DHOs, and shot contests.',
    date: '2026-04-25',
    readingTime: 'Project',
    tags: ['Project'],
    coverImage: '/images/thumb-cv-pipeline.png',
    content: `
Over the past year I've been building a custom computer vision pipeline that takes broadcast footage and automatically detects and tracks all 10 players, their on court locations, and key actions such as passes, screens, DHOs, shot contests, and more. It can process a full game overnight from broadcast video alone to produce tracking quality data and labeled events similar to something like Synergy's in arena camera package, and it can be tailored to a team's specific play style and philosophies.

Beyond the current features, the possibilities and potential are really endless. It could be used to identify individual defenders, quantify pass and shot difficulty, and evaluate players in high school or overseas by measuring things like processing speed in pick and rolls, athletic measurements, and decision patterns. This is the kind of detailed feedback I think recruits would love to see about themselves on a visit.

I'm also actively exploring uses in practice and player workouts to track shooting progress and team drills, as well as tracking shot consistency through release point, arc, and release speed. There's so much potential in a project like this and teams are starting to take advantage, as this work is similar to computer vision models that were reportedly used by the Charlotte Hornets to select Kon Knueppel.
    `.trim(),
    videos: [{ id: 'CV_8cef98e8' }, { id: 'CV_8d2f2fc2' }, { id: 'CV_0fa21c20' }],
  },
  {
    slug: 'shot-chart',
    title: '3D Shot Chart',
    subtitle: 'Interactive Shot Visualization · AP Top 25',
    excerpt:
      "Interactive 3D shot chart covering the 2025-26 AP Top 25 women's D1 teams. Filter by player, game, period, zone, and shot result. Built in Three.js to render shooting data on a real court instead of a flat scatter.",
    date: '2026-04-20',
    readingTime: '3 min read',
    tags: ['Project'],
    coverImage: '/images/thumb-3d-shot-chart.png',
    videos: [{ src: '/videos/shot-chart-demo.mp4' }],
    content: `
## Why 3D?

A flat 2D shot chart is information-dense but abstract. When you watch a game you see spacing, angles, and player positioning all at once, and a 2D chart strips that out and asks the viewer to mentally rebuild what they were just watching. I also think visualizing in this way can lead to better retention and also allows for more interaction.

## What it does

Pick any AP Top 25 team and see their full season at a glance. Filter by player to focus on a primary scorer, designated shooter, or role player. Filter by game to scout a specific opponent or check tendencies in a single matchup. Filter by period, contest level, and shot result to drill into specific situations. Zones mode shows aggregated FG% per area with color coding by efficiency.

## How it was built

The data comes from ESPN's public API, pulled per team and saved as a static dataset so the page doesn't make live calls. Per-player stats and scouting designations are computed in a Python pipeline that runs offline. The court and markers are rendered in Three.js with React handling state and UI.
    `.trim(),
    links: [{ label: 'Open 3D Shot Chart', url: '/#/shot-chart' }],
  },
  {
    slug: 'two-for-one',
    title: "The Optimal Time to Go 2-for-1 in Women's College Basketball",
    excerpt:
      "An analysis of the 2-for-1 strategy in D1 women's basketball, what makes the timing different from the NBA and WNBA, and how often teams get it right.",
    date: '2026-05-26',
    readingTime: '7 min read',
    tags: ['Research & Analytics'],
    coverImage: '/images/two-for-one-cover.gif',
    content: '',
  },
]

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug)
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
