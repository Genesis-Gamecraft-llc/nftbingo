import Link from "next/link";
import Image from "next/image";
import { getAllPosts } from "../../lib/blog";

export const metadata = {
  title: "Blog | NFTBingo",
  description: "Guides, explainers, and updates for NFTBingo.",
};

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams?: Promise<{ tag?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const activeTag = typeof sp.tag === "string" ? sp.tag : undefined;

  const posts = getAllPosts();

  const allTags = Array.from(new Set(posts.flatMap((p) => p.frontmatter.tags ?? []))).sort((a, b) =>
    a.localeCompare(b)
  );

  const filteredPosts = activeTag
    ? posts.filter((p) => (p.frontmatter.tags ?? []).includes(activeTag))
    : posts;

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-white to-slate-100 overflow-hidden">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white py-24 px-6 text-center">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 left-20 h-24 w-24 bg-white/10 rounded-full blur-2xl animate-pulse" />
          <div className="absolute bottom-0 right-16 h-16 w-16 bg-white/20 rounded-full blur-xl animate-ping" />
        </div>

        <h1 className="relative text-5xl md:text-7xl font-extrabold mb-6 z-10">
          NFTBingo Blog
        </h1>

        <p className="relative max-w-2xl mx-auto text-lg opacity-90 z-10">
          Guides for new players, explainers for non-native English speakers, and project updates as we build on{" "}
          <span className="font-bold text-yellow-200">Solana</span>.
        </p>

        <div className="relative mt-10 flex flex-wrap justify-center gap-4 z-10">
          <Link
            href="/mint-nftbingo-cards"
            className="rounded-xl bg-white text-pink-600 font-semibold px-8 py-4 shadow hover:bg-slate-100 transition"
          >
            Mint Cards
          </Link>

          <Link
            href="/join-community"
            className="rounded-xl bg-white text-pink-600 font-semibold px-8 py-4 shadow hover:bg-slate-100 transition"
          >
            Join Community
          </Link>
        </div>
      </section>

      {/* Tag cloud */}
      <section className="max-w-5xl mx-auto py-16 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Browse by Topic</h2>
        <p className="text-lg text-slate-600 leading-relaxed">Click a tag to filter articles by topic.</p>

        {allTags.length > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {allTags.map((tag) => {
              const isActive = tag === activeTag;

              return (
                <Link
                  key={tag}
                  href={`/blog?tag=${encodeURIComponent(tag)}`}
                  className={
                    isActive
                      ? "rounded-full bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-4 py-2 shadow"
                      : "rounded-full border border-slate-200 bg-white text-slate-700 font-medium px-4 py-2 shadow-sm hover:border-pink-300 hover:text-pink-700 transition"
                  }
                >
                  {tag}
                </Link>
              );
            })}

            {activeTag && (
              <Link
                href="/blog"
                className="rounded-full bg-white border border-slate-200 text-slate-600 font-medium px-4 py-2 shadow-sm hover:text-pink-600 transition"
              >
                Clear
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Posts */}
      <section className="max-w-6xl mx-auto grid gap-8 px-6 pb-20">
        {filteredPosts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-slate-600">
            No posts found{activeTag ? <> for tag <strong>{activeTag}</strong></> : null}.
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.slug} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col md:flex-row gap-5">
                {/* Thumbnail */}
                {post.frontmatter.coverImage ? (
                  <div className="shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 w-full md:w-[220px]">
                    <Image
                      src={post.frontmatter.coverImage}
                      alt={post.frontmatter.title}
                      width={440}
                      height={260}
                      className="h-auto w-full"
                    />
                  </div>
                ) : null}

                {/* Text */}
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold mb-2 text-slate-900">
                        {post.frontmatter.title}
                      </h3>

                      {post.frontmatter.description && (
                        <p className="text-slate-600 leading-relaxed">{post.frontmatter.description}</p>
                      )}

                      {post.frontmatter.tags?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {post.frontmatter.tags.map((t) => (
                            <Link
                              key={t}
                              href={`/blog?tag=${encodeURIComponent(t)}`}
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:border-pink-300 hover:text-pink-700 transition"
                            >
                              {t}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {post.frontmatter.date && (
                      <div className="text-sm text-slate-500 whitespace-nowrap">{post.frontmatter.date}</div>
                    )}
                  </div>

                  <div className="mt-6">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center justify-center bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-5 py-2 rounded-xl shadow hover:scale-105 transition"
                    >
                      Read Post →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-slate-500 text-sm">
        © {new Date().getFullYear()} NFTBingo • Built on Solana • nftbingo.net
      </footer>
    </main>
  );
}
