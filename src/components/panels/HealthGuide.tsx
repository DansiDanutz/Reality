/**
 * How health works in Reality — the in-game guide.
 * Every mechanic is calibrated to real human physiology (WHO / CDC / EFSA
 * reference figures); full research mapping in docs/plan/02-HEALTH-SYSTEM.md.
 */

interface GuideSection {
  icon: string
  title: string
  reality: string
  inGame: string
}

const SECTIONS: GuideSection[] = [
  {
    icon: '💧',
    title: 'Water',
    reality:
      'Your body is roughly 60% water. Adults need about 2–2.5 liters a day (EFSA reference), and you can only survive around 3 days without any — it is the most urgent need a human has. Even mild dehydration (1–2%) measurably reduces concentration and mood.',
    inGame:
      'The Water bar drains in about 24 real hours awake — faster while working or at the gym. Below 0 your health drops twice as fast as starving. A $1 bottle restores half the bar. While you are away, your citizen buys water before anything else.',
  },
  {
    icon: '🍽',
    title: 'Food',
    reality:
      'Adults run on roughly 2,000–2,500 kcal a day — about three meals. The body survives weeks without food, but strength, focus and immunity fall within days. Cooking at home is consistently cheaper and healthier than eating out.',
    inGame:
      'The Food bar covers about 22 real hours; plan ~3 meals a day. Below 15 you are too weak to start a shift. Empty for hours and your health drains. A home-cooked meal ($9) fills more per dollar than takeaway — exactly like real life.',
  },
  {
    icon: '😴',
    title: 'Sleep',
    reality:
      'Sleep is when the body repairs itself: memory consolidates, the immune system rebuilds, hormones reset. Adults need 7–9 hours a night (National Sleep Foundation / CDC). Chronic short sleep raises the risk of heart disease, diabetes and depression.',
    inGame:
      'A night is 8 real hours; energy refills continuously (+16/h in your own home, +11/h sleeping rough), so waking early is always fair. Energy at 0 drains health. Owning a home makes every night count for more.',
  },
  {
    icon: '🧼',
    title: 'Hygiene',
    reality:
      'Handwashing alone cuts respiratory infections by ~20% and diarrheal disease by ~30% (CDC). Hygiene is the quiet foundation of public health — most of the last century\'s gain in life expectancy came from it.',
    inGame:
      'Hygiene decays about 3/h. Public showers cost $5; a home gives you one for free every night. Low hygiene doesn\'t kill you — but future versions tie it to illness events and job prospects, like reality does.',
  },
  {
    icon: '🎭',
    title: 'Fun & mental health',
    reality:
      'Chronic stress raises cortisol, which damages sleep, immunity and the cardiovascular system. Leisure, social time and exercise are not luxuries — the WHO counts mental health as half of health.',
    inGame:
      'The Fun bar decays slowly but steadily. Movies, gyms, concerts and trips restore it. Exercise costs energy and water now but pays your mood — the trade-off is real.',
  },
  {
    icon: '❤️',
    title: 'Health (HP)',
    reality:
      'Health is not a number you spend — it is the output of everything above. Triage in medicine follows the "rule of 3s": ~3 minutes without air, ~3 days without water, ~3 weeks without food.',
    inGame:
      'HP follows the same triage: dehydration drains it fastest (−6/h), then starvation or exhaustion (−3/h). Kept fed, hydrated and rested, your body heals itself (+2/h). Below 20 HP you cannot work — recovery becomes your only job, like real life.',
  },
]

export default function HealthGuide() {
  return (
    <section className="panel" aria-label="How health works">
      <h2 className="panel-title">How health works</h2>
      <p className="panel-sub">
        Reality runs on real rules. Every number below is calibrated to real human physiology — the same
        figures the WHO, CDC and EFSA publish — compressed onto your real clock.
      </p>
      <p className="panel-sub">
        The daily loop is simple: survive first, then work, study, help your neighborhood, and build the home or business that makes the next day easier. Builds take real hours, and the map shows how long is left.
      </p>

      {SECTIONS.map((s) => (
        <article className="guide-section" key={s.title}>
          <h3 className="guide-title">
            <span aria-hidden>{s.icon}</span> {s.title}
          </h3>
          <p className="guide-real">{s.reality}</p>
          <p className="guide-game">
            <strong>In Reality:</strong> {s.inGame}
          </p>
        </article>
      ))}

      <p className="panel-sub">
        One sentence to remember: <strong className="gold">drink, eat, sleep — then build your empire.</strong>
      </p>
    </section>
  )
}
