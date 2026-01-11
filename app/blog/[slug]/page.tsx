export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllPosts, getPostBySlug } from "../../../lib/blog";

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const post = getPostBySlug(slug);
  if (!post) return notFound();

  const { title, description, date, coverImage, tags } = post.frontmatter;

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-white to-slate-100 overflow-hidden">
      {/* Hero band */}
      <section className="relative overflow-hidden bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white py-16 px-6 text-center">
        {/* Decorative glow */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 left-20 h-24 w-24 bg-white/10 rounded-full blur-2xl animate-pulse" />
          <div className="absolute bottom-0 right-16 h-16 w-16 bg-white/20 rounded-full blur-xl animate-ping" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          {date ? <div className="text-sm opacity-90 mb-2">{date}</div> : null}

          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">{title}</h1>

          {description ? <p className="text-lg opacity-90">{description}</p> : null}

          {/* Buttons INSIDE gradient = white with pink text */}
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/blog"
              className="rounded-xl bg-white text-pink-600 font-semibold px-6 py-3 shadow hover:bg-slate-100 transition"
            >
              ← Back to Blog
            </Link>

            <Link
              href="/mint-nftbingo-cards"
              className="rounded-xl bg-white text-pink-600 font-semibold px-6 py-3 shadow hover:bg-slate-100 transition"
            >
              Mint Cards
            </Link>
          </div>
        </div>
      </section>

      {/* Article content */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          {coverImage ? (
            <div className="mb-8 overflow-hidden rounded-xl border border-slate-200">
              <Image
                src={coverImage}
                alt={title}
                width={1200}
                height={630}
                className="h-auto w-full"
                priority
              />
            </div>
          ) : null}

          {/* Professional article typography */}
          <article className="max-w-none text-slate-800">
            <MDXRemote
              source={post.content}
              components={{
                h2: (props) => (
                  <h2
                    {...props}
                    className="mt-12 mb-4 text-3xl font-bold tracking-tight text-slate-900"
                  />
                ),
                h3: (props) => (
                  <h3
                    {...props}
                    className="mt-10 mb-3 text-2xl font-semibold text-slate-900"
                  />
                ),
                p: (props) => (
                  <p {...props} className="mb-6 text-[18px] leading-[1.75]" />
                ),
                ul: (props) => (
                  <ul {...props} className="mb-6 list-disc pl-6 text-[18px] leading-[1.7]" />
                ),
                li: (props) => <li {...props} className="mb-2" />,
                strong: (props) => (
                  <strong {...props} className="font-semibold text-slate-900" />
                ),
              }}
            />
          </article>

          {/* Tags at bottom (clickable) */}
          {tags?.length ? (
            <div className="mt-10 pt-6 border-t border-slate-200">
              <div className="text-sm font-semibold text-slate-700 mb-3">
                Tags
              </div>

              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Link
                    key={t}
                    href={`/blog?tag=${encodeURIComponent(t)}`}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:border-pink-300 hover:text-pink-700 transition"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {/* Bottom CTAs — outside gradient = full gradient buttons */}
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/blog"
              className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-6 py-3 rounded-xl shadow hover:scale-105 transition"
            >
              Back to Blog
            </Link>

            <Link
              href="/mint-nftbingo-cards"
              className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-6 py-3 rounded-xl shadow hover:scale-105 transition"
            >
              Mint Cards
            </Link>
          </div>
        </div>
      </section>

      {/* Footer — matches Home */}
      <footer className="border-t border-slate-200 py-8 text-center text-slate-500 text-sm">
        © {new Date().getFullYear()} NFTBingo • Built on Solana • nftbingo.net
      </footer>
    </main>
  );
}
