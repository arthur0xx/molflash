import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, ExternalLink, Link2 } from "lucide-react";
import { notFound } from "next/navigation";
import { BlogMarkdown } from "@/components/blog-markdown";
import { getPublicBlogPostBySlug, getPublicBlogSnapshot } from "@/lib/repository";
import { safeJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

function dateLabel(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ar-MA", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublicBlogPostBySlug(slug);
  if (!post) return { title: "المقال غير موجود | ChriGsm" };
  return { title: `${post.title} | مدونة ChriGsm`, description: post.seoDescription || post.excerpt, alternates: { canonical: `/blog/${post.slug}` }, openGraph: { title: post.title, description: post.seoDescription || post.excerpt, images: post.coverImageUrl ? [{ url: post.coverImageUrl, alt: post.coverImageAlt || post.title }] : undefined, type: "article", publishedTime: post.publishedAt, modifiedTime: post.updatedAt } };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [post, snapshot] = await Promise.all([getPublicBlogPostBySlug(slug), getPublicBlogSnapshot()]);
  if (!post) notFound();
  const category = snapshot.categories.find((item) => item.id === post.categoryId);
  const services = snapshot.services.filter((service) => post.serviceIds.includes(service.id));
  const relatedPosts = snapshot.posts.filter((item) => item.id !== post.id && (item.categoryId === post.categoryId || item.serviceIds.some((id) => post.serviceIds.includes(id)))).slice(0, 3);
  const jsonLd = safeJsonLd({ "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.seoDescription || post.excerpt, datePublished: post.publishedAt, dateModified: post.updatedAt, image: post.coverImageUrl ? [post.coverImageUrl] : undefined, inLanguage: "ar", author: { "@type": "Organization", name: "ChriGsm" }, publisher: { "@type": "Organization", name: "ChriGsm" }, mainEntityOfPage: { "@type": "WebPage", "@id": `/blog/${post.slug}` } });
  return <main className="store-shell blog-post-shell"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }}/><nav className="breadcrumbs" aria-label="مسار التنقل"><Link href="/">الرئيسية</Link><span>/</span><Link href="/blog">المدونة</Link><span>/</span><span>{post.title}</span></nav><article className="blog-article"><header className="article-header"><p className="eyebrow">{category?.name || "مقال"}</p><h1>{post.title}</h1><p>{post.excerpt}</p><time dateTime={post.publishedAt}>{dateLabel(post.publishedAt)}</time>{post.coverImageUrl ? <Image className="article-cover" src={post.coverImageUrl} alt={post.coverImageAlt || `صورة ${post.title}`} width={1440} height={810} priority sizes="(max-width: 760px) 100vw, 960px"/> : null}</header><BlogMarkdown markdown={post.markdown}/></article>{services.length ? <section className="article-services"><div className="section-heading"><p className="eyebrow">خدمات مرتبطة</p><h2>اطلب الخدمة المذكورة في المقال</h2></div><div className="related-service-grid">{services.map((service) => <Link className="related-service" href={`/service/${service.slug}`} key={service.id}><span><Link2 size={18}/>{service.title}</span><ArrowRight size={18}/></Link>)}</div></section> : null}{post.sources.length ? <section className="article-sources"><div className="section-heading"><p className="eyebrow">مصادر</p><h2>روابط للمراجعة</h2></div><ol>{post.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer"><span>{source.title}</span><ExternalLink size={15}/></a></li>)}</ol></section> : null}{relatedPosts.length ? <section className="related-posts"><div className="section-heading"><p className="eyebrow">تابع القراءة</p><h2>مقالات ذات صلة</h2></div><div>{relatedPosts.map((item) => <Link href={`/blog/${item.slug}`} key={item.id}><BookOpen size={18}/><span>{item.title}</span><ArrowRight size={17}/></Link>)}</div></section> : null}</main>;
}
