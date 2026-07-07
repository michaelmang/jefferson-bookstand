import Link from "next/link";
import { getSessionUser, googleClientId } from "@/lib/server/auth";
import { todaysStands, weeklyMostTreasured } from "@/lib/server/feed";
import { PAINTINGS, paintingUrl } from "@/lib/paintings";
import GoogleSignIn from "@/components/GoogleSignIn";
import StandCard from "@/components/StandCard";
import UserMenu from "@/components/UserMenu";

export default async function Home() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <main className="landing">
        <div
          className="landing-art"
          style={{ backgroundImage: `url(${paintingUrl(PAINTINGS.philosopher, 1800)})` }}
        />
        <div className="landing-veil" />
        <div className="landing-card">
          <p className="overline">A reading society</p>
          <h1>Jefferson&apos;s Revolving Bookstand</h1>
          <div className="fleuron" aria-hidden>
            ❦
          </div>
          <p>
            Curate five papers a day on a spinning bookstand, the way Jefferson kept five books open
            at Monticello. Post your stand, stamp the ones you treasure, and leave letters for their
            curators.
          </p>
          <GoogleSignIn clientId={googleClientId()} />
        </div>
        <p className="art-credit">
          {PAINTINGS.philosopher.artist} — <em>{PAINTINGS.philosopher.title}</em>
        </p>
      </main>
    );
  }

  const today = await todaysStands(user.id);
  const treasured = await weeklyMostTreasured(user.id);

  return (
    <main className="home">
      <div className="home-hero">
        <div
          className="home-hero-art"
          style={{ backgroundImage: `url(${paintingUrl(PAINTINGS.astronomer, 1800)})` }}
        />
        <div className="home-hero-veil" />
        <header className="home-header">
          <div className="home-masthead">
            <p className="overline">The Commons of the reading society</p>
            <h1>Jefferson&apos;s Revolving Bookstand</h1>
          </div>
          <nav className="home-nav">
            <Link className="btn btn-primary" href="/studio">
              Curate today&apos;s stand
            </Link>
            <Link className="btn" href="/mine">
              My stands
            </Link>
            <UserMenu name={user.name} picture={user.picture} />
          </nav>
        </header>
        <p className="art-credit">
          {PAINTINGS.astronomer.artist} — <em>{PAINTINGS.astronomer.title}</em>
        </p>
      </div>

      <div className="home-body">
        <section className="feed-section">
          <h2 className="section-title">
            <span>Today&apos;s stands</span>
          </h2>
          {today.length === 0 ? (
            <p className="feed-empty">
              No stands posted today yet. <Link href="/studio">Be the first</Link>
              {" — rest five papers and share them."}
            </p>
          ) : (
            <div className="feed-grid">
              {today.map((stand) => (
                <StandCard key={stand.id} stand={stand} />
              ))}
            </div>
          )}
        </section>

        <section className="feed-section">
          <h2 className="section-title">
            <span>Most treasured this week</span>
          </h2>
          {treasured.length === 0 ? (
            <p className="feed-empty">Nothing has been stamped this week.</p>
          ) : (
            <div className="feed-grid">
              {treasured.map((stand) => (
                <StandCard key={stand.id} stand={stand} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
