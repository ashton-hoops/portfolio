export interface Project {
  slug: string
  title: string
  subtitle: string
  description: string
  longDescription: string
  tags: string[]
  thumbnail?: string
  featured?: boolean
  timeline: string
  stats?: { label: string; value: string }[]
  features?: string[]
  techStack?: string[]
  links?: { label: string; url: string }[]
}

export const projects: Project[] = [
  {
    slug: 'defense',
    title: 'Defensive Analysis Dashboard',
    subtitle: 'OU Women\'s Basketball · 2024–2026',
    description:
      'A full defensive analytics platform built from scratch. Possession-by-possession film tagging, shot charts, lineup metrics, and statistical reports for coaching staff.',
    longDescription: `
When I started as a practice player for OU Women's Basketball, I noticed a gap. The coaching staff needed a way to systematically break down defensive possessions—not just what happened, but *why* it happened. Commercial tools existed, but none captured the specific defensive concepts our staff cared about.

So I built one.

The Defense Dashboard is a complete film tagging and analytics platform. Every half-court possession gets logged with its situation, offensive action, defensive coverage, help rotations, and outcome. Over 800 possessions later, we have data that actually connects what happens on the floor to what shows up in the box score.

The system tracks 14 distinct action types, from ball screens to DHOs to pin-downs. Each action captures the defensive response: how we played it, whether we helped, whether communication happened, whether it led to a breakdown. This granularity lets us answer questions like "How do we guard horns sets against teams with shooting bigs?" with actual data.
    `.trim(),
    tags: ['React', 'TypeScript', 'Python', 'Flask', 'PostgreSQL', 'SQLite'],
    thumbnail: '/images/thumb-defense.png',
    featured: true,
    timeline: '2024 – Present',
    stats: [
      { label: 'Possessions Tagged', value: '811' },
      { label: 'Action Types', value: '14' },
      { label: 'Opponents Analyzed', value: '15' },
      { label: 'Shot Contests', value: '594' },
    ],
    features: [
      'Possession-by-possession film tagging with video clips',
      'Interactive 2D and 3D shot charts',
      'Lineup metrics and rotation analysis',
      'Opponent scouting reports',
      'Statistical trends and reports for staff',
      'Cloud deployment with secure access controls',
    ],
    techStack: [
      'React + TypeScript frontend with Vite',
      'Python/Flask backend API',
      'SQLite (local) / PostgreSQL (cloud) database',
      'Cloudflare R2 for video storage',
      'JWT authentication with role-based access',
      'Render deployment with auto-deploy from GitHub',
    ],
    links: [
      { label: 'View Demo', url: 'https://ou-basketball-defense.onrender.com' },
    ],
  },
  {
    slug: 'cv-pipeline',
    title: 'Computer Vision Pipeline',
    subtitle: 'Player Tracking & Action Detection',
    description:
      'Computer vision system for automated basketball analysis. Player tracking, court mapping, ball detection, and action recognition from broadcast footage.',
    longDescription: `
Manual film tagging is slow. Really slow. Every possession requires watching, rewinding, tagging multiple fields, and moving on. For one game that's 70+ possessions. For a season, it's hundreds of hours.

The Computer Vision Pipeline is my attempt to automate the tedious parts while keeping humans in the loop for the judgment calls.

**What's Working Today:**

- **Player Tracking**: YOLO-based detection identifies all players on court, tracking their positions frame-by-frame
- **Court Mapping**: Homography transforms broadcast angles to a standardized overhead view, making positions comparable across games
- **Ball Detection**: Tracks the ball, passes, and shots through the possession
- **Screen Detection**: Identifies ball screens and off-ball screens from player movement patterns
- **DHO Detection**: Recognizes dribble handoff actions
- **Contest Analysis**: Measures shot contest distance and positioning

**The Vision:**

This isn't meant to replace human analysis—it's meant to supercharge it. Imagine a world where every possession is pre-tagged with the basic action sequence, and analysts just verify and add context. Or where tracking data generates metrics that film alone can't capture: help rotation speed, closeout distances, player spacing over time.

The pipeline is modular. Each detection component can run independently or chain together. The output feeds directly into the Defense Dashboard for review and refinement.
    `.trim(),
    tags: ['Python', 'OpenCV', 'PyTorch', 'YOLO', 'NumPy'],
    thumbnail: '/images/thumb-cv-pipeline.png',
    timeline: '2024 – Present',
    features: [
      'Player tracking and identification',
      '2D court mapping from broadcast footage',
      'Ball, pass, and shot detection',
      'Screen detection (ball screens, off-ball)',
      'DHO (dribble handoff) recognition',
      'Shot contest level and distance measurement',
    ],
    techStack: [
      'Python for core processing',
      'OpenCV for video and image processing',
      'PyTorch for neural network models',
      'YOLO for object detection',
      'NumPy for numerical operations',
      'FFmpeg for video handling',
    ],
  },
  {
    slug: 'shot-chart',
    title: '3D Shot Chart',
    subtitle: 'Interactive Shot Visualization',
    description:
      'Interactive 3D shot chart visualization. Filter by player, game, shot result, and shot type. Color coding by efficiency or player role.',
    longDescription: `
Traditional 2D shot charts work. But there's something about seeing shots in three dimensions that makes patterns click for players and coaches in a way flat charts don't.

The 3D Shot Chart takes shot location data and renders it on an interactive Three.js court. You can orbit around, zoom in on specific areas, and watch patterns emerge that are harder to see on paper.

**Key Features:**

- **Filtering**: Drill down by player, game, shot result, shot type, or any combination
- **Color Coding**: Toggle between coloring by efficiency (red/green) or player role (primary players, shooters, role players)
- **Interactivity**: Click any shot to see its details—game, player, time, result
- **Aggregation**: Switch between individual shots and heat map zones

The real value is in the conversations it enables. When you can show a player their shot distribution in 3D and compare it to where they're most efficient, the feedback becomes visceral rather than abstract.
    `.trim(),
    tags: ['Three.js', 'React', 'TypeScript', 'D3'],
    thumbnail: '/images/thumb-shot-chart.png',
    timeline: '2024 – Present',
    features: [
      'Full 3D court visualization with Three.js',
      'Filter by player, game, shot result, shot type',
      'Color coding by efficiency or player role',
      'Interactive: orbit, zoom, click for details',
      'Heat map aggregation mode',
      'Responsive design for different screen sizes',
    ],
    techStack: [
      'Three.js for 3D rendering',
      'React for UI components',
      'TypeScript for type safety',
      'D3 for data manipulation',
    ],
  },
  {
    slug: 'play-diagram',
    title: '3D Play Diagram',
    subtitle: 'Animated Basketball Plays',
    description:
      'Animated 3D play diagrams for film study and coaching presentations. Visualize player movement, ball movement, and defensive positioning.',
    longDescription: `
Static play diagrams on whiteboards have limitations. Players move. Timing matters. The relationship between movements is hard to convey with arrows and X's.

The 3D Play Diagram tool animates basketball plays in three dimensions. Define the starting positions, the routes, the screens, the passes—and watch it run. Pause at any point. Rotate to see angles. Show how the defense should respond.

**Use Cases:**

- **Film Study**: Break down opponent sets before games
- **Coaching Presentations**: Illustrate concepts for players
- **Scouting Reports**: Supplement written breakdowns with visual aids
- **Play Design**: Prototype new sets before introducing them

The tool includes a library of common actions (pick and roll, DHO, pin-down, flare) that can be combined into full plays. Export as video or GIF for sharing.
    `.trim(),
    tags: ['Three.js', 'React', 'TypeScript'],
    thumbnail: '/images/thumb-play-diagram.png',
    timeline: '2025 – Present',
    features: [
      'Full 3D court with animated player movement',
      'Ball movement and passing visualization',
      'Defensive positioning overlays',
      'Play library with common actions',
      'Custom play creation',
      'Export to video/GIF',
    ],
    techStack: [
      'Three.js for 3D animation',
      'React for UI and controls',
      'TypeScript for type safety',
    ],
  },
]

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug)
}
