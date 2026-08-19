"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import type { BlogCategory, BlogPost } from "@/lib/types";

type Props = { posts: BlogPost[]; categories: BlogCategory[] };

function dateLabel(value?: string) {
  if (!value) return "حديثًا";
  return new Intl.DateTimeFormat("ar-MA", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

export function BlogBrowser({ posts, categories }: Props) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const normalized = query.trim().toLocaleLowerCase();
  const visiblePosts = useMemo(() => posts.filter((post) => {
    if (categoryId !== "all" && post.categoryId !== categoryId) return false;
    if (!normalized) return true;
    return [post.title, post.excerpt, ...post.tags].join(" ").toLocaleLowerCase().includes(normalized);
  }), [posts, categoryId, normalized]);

  return <section className="blog-browser">
    <div className="catalog-toolbar blog-toolbar"><label className="catalog-search"><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في الشروحات والأدوات" aria-label="البحث في المدونة"/></label></div>
    <div className="category-filter-row" aria-label="تصنيفات المدونة"><button type="button" className={categoryId === "all" ? "filter-active" : ""} onClick={() => setCategoryId("all")}>كل المقالات</button>{categories.map((category) => <button type="button" className={categoryId === category.id ? "filter-active" : ""} onClick={() => setCategoryId(category.id)} key={category.id}>{category.name}</button>)}</div>
    {visiblePosts.length ? <div className="blog-grid">{visiblePosts.map((post) => {
      const category = categories.find((item) => item.id === post.categoryId);
      return <article className="blog-card" key={post.id}><Link className="blog-card-link" href={`/blog/${post.slug}`} aria-label={`قراءة ${post.title}`}>
        {post.coverImageUrl ? <Image className="blog-cover" src={post.coverImageUrl} alt={post.coverImageAlt || `صورة ${post.title}`} width={720} height={405} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"/> : <div className="blog-cover-placeholder"><BookOpen size={30}/></div>}
        <div className="blog-card-copy"><span className="blog-category" style={{ "--blog-color": category?.color || "#1479ff" } as React.CSSProperties}>{category?.name || "مقال"}</span><h2>{post.title}</h2><p>{post.excerpt}</p><div><time dateTime={post.publishedAt}>{dateLabel(post.publishedAt)}</time><span>قراءة المقال ←</span></div></div>
      </Link></article>;
    })}</div> : <div className="empty-state"><BookOpen size={26}/><h2>لا توجد مقالات مطابقة</h2><p>غيّر عبارة البحث أو التصنيف للعثور على شرح آخر.</p></div>}
  </section>;
}
