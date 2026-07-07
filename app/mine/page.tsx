import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/auth";
import { myStands } from "@/lib/server/feed";
import StandCard from "@/components/StandCard";
import UserMenu from "@/components/UserMenu";

function pageHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/mine?${qs}` : "/mine";
}

export default async function MyStandsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/");
  const { q = "", page = "1" } = await searchParams;
  const query = q.trim();
  const requested = Math.max(1, Number.parseInt(page, 10) || 1);
  const result = await myStands(user.id, query, requested - 1);

  return (
    <main className="home">
      <div className="home-body">
        <header className="page-header">
          <h1>My Stands</h1>
          <nav className="home-nav">
            <Link className="btn" href="/">
              ← Back to the stands
            </Link>
            <Link className="btn btn-primary" href="/studio">
              Curate today&apos;s stand
            </Link>
            <UserMenu name={user.name} picture={user.picture} />
          </nav>
        </header>

        <section className="feed-section">
          <form className="mine-search" action="/mine">
            <input
              className="stand-input"
              type="search"
              name="q"
              placeholder="Search your posted stands…"
              defaultValue={query}
            />
            <button className="btn" type="submit">
              Search
            </button>
            {query && (
              <Link className="btn" href="/mine">
                Clear
              </Link>
            )}
          </form>

          <h2>
            {result.total === 1 ? "1 posted stand" : `${result.total} posted stands`}
            {query ? ` matching “${query}”` : ""}
          </h2>

          {result.stands.length === 0 ? (
            <p className="feed-empty">
              {query
                ? "Nothing in your history matches that."
                : "You haven't posted a stand yet — build one in the studio and share it."}
            </p>
          ) : (
            <div className="feed-grid">
              {result.stands.map((stand) => (
                <StandCard key={stand.id} stand={stand} />
              ))}
            </div>
          )}

          {result.pageCount > 1 && (
            <div className="pager pager-wide">
              {result.page > 0 ? (
                <Link className="btn" href={pageHref(query, result.page)}>
                  ‹ Prev
                </Link>
              ) : (
                <span className="btn" aria-disabled>
                  ‹ Prev
                </span>
              )}
              <span className="pager-label">
                {result.page + 1}
                {" / "}
                {result.pageCount}
              </span>
              {result.page < result.pageCount - 1 ? (
                <Link className="btn" href={pageHref(query, result.page + 2)}>
                  Next ›
                </Link>
              ) : (
                <span className="btn" aria-disabled>
                  Next ›
                </span>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
