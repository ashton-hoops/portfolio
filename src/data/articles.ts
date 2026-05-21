export interface Article {
  slug: string
  title: string
  excerpt: string
  date: string
  readingTime: string
  tags: string[]
  content: string
}

export const articles: Article[] = [
  {
    slug: 'defensive-rotations-800-possessions',
    title: 'What 800 Possessions Taught Me About Defensive Rotations',
    excerpt:
      'After tagging every half-court possession from a full season, patterns emerged that changed how I think about help defense, communication, and where breakdowns actually happen.',
    date: '2026-05-10',
    readingTime: '8 min read',
    tags: ['Defense', 'Film Study', 'Research'],
    content: `
When you tag 800+ defensive possessions by hand, you start to see things differently.

Not better, necessarily—just differently. The game slows down. Patterns that felt intuitive become measurable. And some of the things you *thought* were problems turn out to be symptoms of something else entirely.

This is what I learned from a season of tagging every half-court possession for OU Women's Basketball.

## The Setup

The Defense Dashboard I built tracks 14 distinct action types: ball screens, DHOs, pin-downs, flares, staggers, cuts, posts, isolations, and more. For each possession, I log:

- The **situation** (half court, transition, BLOB, SLOB)
- The **offensive formation** (5-out, 4-out 1-in, etc.)
- The **action sequence** (what they ran)
- Our **defensive coverage** (man, zone, switch, etc.)
- The **help and rotation**
- Whether there was a **breakdown**
- The **result** (made FG, missed FG, turnover, foul)

With 811 possessions in the database, the sample size is large enough to spot real trends—not just noise.

## Finding #1: Breakdowns Cluster at the Second Action

The single biggest surprise was where breakdowns happen.

I expected them to cluster at the point of attack—the ball screen, the isolation, the initial action. But the data told a different story: **62% of defensive breakdowns occurred on the second or third action of a possession**, not the first.

What does that mean practically?

It means the defense handles the initial action fine. We show on the ball screen, we contain the drive, we force a pass. But then the offense swings the ball and runs *another* action—a weak-side pin-down, a DHO in the corner, a duck-in post—and that's where we lose.

The implication is clear: we're not drilling second-action rotations enough. We're practicing how to guard ball screens. We're not practicing what happens *after* we guard the ball screen.

## Finding #2: Communication Predicts Results More Than Coverage

Before this project, I would have bet money that our *coverage scheme* was the biggest factor in defensive success. Switch versus show. Drop versus hedge.

Wrong.

When I added a "communication" tag to possessions (Good / Partial / Poor), the correlation was striking: **possessions with "Good" communication had a 58% stop rate, versus 41% with "Poor" communication**—regardless of coverage.

Put another way: a well-communicated hedge beats a poorly-communicated switch. Every time.

This has obvious coaching implications. If your team is struggling defensively, don't just tweak the scheme. Check whether players are talking. Are they calling out screens early? Are they IDing cutters? Are they confirming switches?

The data says that's where the leverage is.

## Finding #3: Paint Touches Are the Canary in the Coal Mine

One metric I tracked obsessively was **paint touches**—any time the offense got the ball in the lane, whether they scored or not.

Here's the thing: paint touches didn't just correlate with points. They correlated with *future* breakdowns.

When the offense got a paint touch on one action, our defense was **2.3x more likely to break down on the next action**. The paint touch scrambles the defense. Players help, then don't recover. Rotations lag. The second action catches us out of position.

This reframed how I think about "good defense." A possession where we give up a paint touch but force a miss isn't a win—it's a warning. The offense found a crack. They'll probe it again.

## Finding #4: Transition Defense Is a Different Sport

This wasn't a surprise, but the data made it visceral.

Our transition defense (early offense / secondary break situations) had a **29% stop rate**. Our half-court defense had a **52% stop rate**.

When I dug deeper, the problem wasn't effort or speed—it was role clarity. In transition, we didn't have consistent rules for who takes ball, who protects rim, who matches up. So we'd end up with two players on the ball and no one in the paint. Or three players in the paint and a shooter wide open.

The fix was simple: establish rules. Ball = X1. Rim = X5. Match = closest. Once we codified it, transition defense improved—not because we ran faster, but because we stopped thinking.

## Finding #5: Shot Contests Are Overrated (Kind Of)

This one's counterintuitive.

Coaches love shot contests. Close out hard, get a hand up, don't foul. And yes, contested shots go in less often than open ones.

But here's what the data showed: **the correlation between contest quality and shot result was weaker than expected**. Shots with "tight" contests had a 38% make rate. Shots with "moderate" contests had a 42% make rate. Not much difference.

What *did* correlate strongly? **Shot location.**

A moderately contested three from the corner went in more often than a tightly contested mid-range pull-up. The contest mattered less than where the shot came from.

The takeaway isn't "don't contest shots." It's "don't trade location for contest." A closeout that runs the shooter off the line but gives up a mid-range is a win. A closeout that contests but lets them shoot from the corner is a loss.

## What I'm Still Figuring Out

This project raised as many questions as it answered:

- **How do we quantify help defense *before* the breakdown?** Right now I'm tagging outcomes, not processes. I want to tag rotations that *prevented* breakdowns, not just ones that failed.
- **What's the right way to weight possessions?** A breakdown in the first quarter versus a breakdown in crunch time—are they equal? The data treats them the same. Maybe it shouldn't.
- **Can computer vision automate any of this?** Tagging 811 possessions took forever. If the CV pipeline can pre-tag action types with 80% accuracy, human review becomes verification instead of creation.

## The Bottom Line

Data doesn't replace coaching. It sharpens it.

After this project, I don't watch film the same way. I see the second action before the first one finishes. I listen for communication. I track paint touches like they're turnovers.

And when the defense breaks down, I don't just ask "what happened?" I ask "what happened *before* what happened?"

That's what 800 possessions taught me.
    `.trim(),
  },
  {
    slug: 'why-3d-visualization',
    title: 'Why 3D? Building Visualizations That Connect with Players',
    excerpt:
      'Most analytics tools are built for analysts. I wanted to build something coaches could show players in a film session and have it click immediately.',
    date: '2026-05-05',
    readingTime: '6 min read',
    tags: ['Visualization', 'Tools', 'Development'],
    content: `
Here's a confession: I built the 3D shot chart because I thought it would look cool.

That's it. No grand vision. No user research. I had learned Three.js for another project, and I thought, "What if I rendered shots in 3D?"

But then something unexpected happened.

I showed it to a coach. She leaned in, grabbed the mouse, and started orbiting around the court. "Oh," she said, "so that's why they keep going to that spot." She'd looked at 2D shot charts before. She'd seen the same data. But something about the 3D view made it click.

That moment changed how I think about analytics tools.

## The Problem with Analytics

Most analytics tools are built by analysts, for analysts.

They're dense. They're precise. They require training to interpret. And they assume the user *wants* to engage with data.

But coaches and players don't want to engage with data. They want to win games. Data is a means to an end—and if the data doesn't connect to what they're trying to do, it's just noise.

The 2D shot chart is a perfect example. It's information-dense. Every shot is a dot. Color shows make/miss. Position shows location. It's efficient.

But it's also abstract. The court is flat. The player isn't there. The context is stripped away.

When you watch a game, you see shots in 3D. You see the arc. You see where the defender was. You see the shooter's feet. The 2D chart disconnects from that experience.

## Why 3D Works

The 3D shot chart doesn't add information. It adds *presence*.

When you orbit around the court, you're simulating what it feels like to be on the floor. You're looking at the basket from the shooter's perspective. You're seeing the spacing from the defender's angle.

That simulation creates connection. It bridges the gap between abstract data and felt experience.

Coaches told me things like:

- "I can show this to players and they *get it*."
- "This is how I actually see the game in my head."
- "The 2D chart says the same thing, but this one tells a story."

The data is identical. The experience is different.

## Building for Connection, Not Precision

This realization shifted how I approach every visualization.

The first question isn't "what data do I need to show?" It's "what experience do I want to create?" Who's the user? What do they already understand? What's the gap between what they know and what they need to know?

For the 3D play diagram tool, the answer was similar: coaches see plays in motion. Static X's and O's are abstractions. Animation reconnects the diagram to the real thing.

For the shot chart filters, the answer was: players care about *their* shots, not the team's. So the default view is individual, not aggregate. You start with yourself, then zoom out.

For the defensive dashboard, the answer was: coaches need to answer specific questions in film sessions. "What happened on horns sets against Texas A&M?" The interface is built around questions, not around data dumps.

## The Technical Part (Briefly)

The 3D shot chart uses Three.js to render a court with realistic textures, lines, and lighting. Each shot is a small sphere positioned at its (x, y) coordinate with a fixed z-height (I experimented with varying height by shot arc, but it was more confusing than helpful).

Performance was a challenge. Rendering hundreds of spheres with shadows tanks the frame rate. I ended up using instanced meshes for the shot markers, which lets Three.js batch them into a single draw call. Shadows are disabled on the markers and only applied to the court.

Interactivity is handled through raycasting. When you click, the system calculates which object (if any) is under the cursor. If it's a shot marker, a detail panel appears with game, player, time, and result.

The hardest part was camera controls. Three.js has built-in orbit controls, but they needed tuning to feel right. I limited the vertical rotation so you can't flip under the court. I set boundaries so the camera can't zoom through the floor. Small things, but they make the difference between "this feels professional" and "this feels like a tech demo."

## What I'd Do Differently

If I rebuilt the 3D shot chart today, I'd add:

1. **Comparative views**: Show two players' shots side-by-side. Or your shots this game versus your season average. Context is everything.

2. **Animation**: Let the user "play" the shots in sequence. See the flow of the game. Where did they start shooting? Where did they end up?

3. **Integration with video**: Click a shot, watch the clip. This is technically possible now—the data links to video files—but the UI isn't built for it.

4. **Mobile support**: Right now it's desktop-only. That's a limitation. Players don't sit at desktops.

## The Takeaway

Analytics tools succeed when they fit into existing workflows.

Coaches already watch film. They already draw plays on whiteboards. They already talk to players in huddles.

The question isn't "how do we get coaches to use analytics?" It's "how do we make analytics *feel* like film, whiteboards, and huddles?"

3D visualization is one answer. It's not the only answer. But it's an answer that works because it meets people where they are—in the three-dimensional, motion-filled world of basketball.

Not in spreadsheets. Not in dashboards. On the court.
    `.trim(),
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
