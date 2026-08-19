"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { BookOpen, CheckCircle2, Copy, Eye, FilePlus2, ImagePlus, Link2, Pencil, Plus, Save, Send, Sparkles, Tag, Trash2, Upload, X } from "lucide-react";
import type { BlogCategory, BlogLayout, BlogPost, BlogSource, Service } from "@/lib/types";
import { BlogMarkdown } from "@/components/blog-markdown";
import { firebaseServices } from "@/lib/firebase/client";
import { requestSignedMediaUpload, uploadSignedMediaImage } from "@/lib/media-upload";

type BlogSnapshot = { categories: BlogCategory[]; posts: BlogPost[]; services: Service[] };
type CategoryDraft = { name: string; slug: string; description: string; color: string; order: string; isActive: boolean };
type PostDraft = { title: string; slug: string; excerpt: string; markdown: string; categoryId: string; tagsInput: string; serviceIds: string[]; sources: BlogSource[]; coverImageUrl: string; coverImagePublicId: string; coverImageAlt: string; seoTitle: string; seoDescription: string; canonicalUrl: string; noIndex: boolean; layout: BlogLayout };

const emptySnapshot = (): BlogSnapshot => ({ categories: [], posts: [], services: [] });
const emptyCategory = (order = 0): CategoryDraft => ({ name: "", slug: "", description: "", color: "#1479ff", order: String(order), isActive: true });
const emptyPost = (categoryId = ""): PostDraft => ({ title: "", slug: "", excerpt: "", markdown: "# عنوان المقال\n\nاكتب المقال هنا بصيغة Markdown.", categoryId, tagsInput: "", serviceIds: [], sources: [], coverImageUrl: "", coverImagePublicId: "", coverImageAlt: "", seoTitle: "", seoDescription: "", canonicalUrl: "", noIndex: false, layout: "standard" });
const fromPost = (post: BlogPost): PostDraft => ({ title: post.title, slug: post.slug, excerpt: post.excerpt, markdown: post.markdown, categoryId: post.categoryId, tagsInput: post.tags.join("، "), serviceIds: post.serviceIds, sources: post.sources, coverImageUrl: post.coverImageUrl || "", coverImagePublicId: post.coverImagePublicId || "", coverImageAlt: post.coverImageAlt || "", seoTitle: post.seoTitle || "", seoDescription: post.seoDescription || "", canonicalUrl: post.canonicalUrl || "", noIndex: post.noIndex === true, layout: post.layout });

function dateLabel(value?: string) {
  if (!value) return "لم تُنشر بعد";
  return new Intl.DateTimeFormat("ar-MA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export function AdminBlogManager({ onNotice }: { onNotice: (message: string) => void }) {
  const firebase = useMemo(() => firebaseServices(), []);
  const [snapshot, setSnapshot] = useState<BlogSnapshot>(() => emptySnapshot());
  const [loading, setLoading] = useState(() => Boolean(firebase));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);
  const [postDraft, setPostDraft] = useState<PostDraft>(() => emptyPost());
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(() => emptyCategory());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const request = useCallback(async <T,>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> => {
    const user = firebase?.auth.currentUser;
    if (!user) throw new Error("سجّل الدخول بحساب المالك أولًا.");
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    const result = await response.json().catch(() => ({})) as T & { error?: string };
    if (!response.ok) throw new Error(result.error || "تعذر إتمام العملية.");
    return result;
  }, [firebase]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await request<{ snapshot: BlogSnapshot }>("/api/admin/blog/posts", "GET");
      setSnapshot(result.snapshot);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "تعذر تحميل بيانات المدونة.");
    } finally { setLoading(false); }
  }, [onNotice, request]);

  useEffect(() => {
    if (!firebase) return;
    return onAuthStateChanged(firebase.auth, (user) => { if (user) void load(); else { setSnapshot(emptySnapshot()); setLoading(false); } });
  }, [firebase, load]);

  const posts = useMemo(() => snapshot.posts.filter((post) => [post.title, post.excerpt, post.tags.join(" ")].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [query, snapshot.posts]);
  const activePost = postId ? snapshot.posts.find((post) => post.id === postId) : undefined;

  function openPost(post?: BlogPost) {
    if (post) { setPostId(post.id); setPostDraft(fromPost(post)); } else { setPostId(null); setPostDraft(emptyPost(snapshot.categories.find((category) => category.isActive)?.id || "")); }
    setPreviewOpen(false);
  }

  function openCategory(category?: BlogCategory) {
    if (category) { setCategoryId(category.id); setCategoryDraft({ name: category.name, slug: category.slug, description: category.description || "", color: category.color, order: String(category.order), isActive: category.isActive }); }
    else { setCategoryId(null); setCategoryDraft(emptyCategory((snapshot.categories.at(-1)?.order || 0) + 10)); }
  }

  function postPayload(status: BlogPost["status"]) {
    const tags = postDraft.tagsInput.split(/[,،]/).map((item) => item.trim()).filter(Boolean);
    return { title: postDraft.title.trim(), slug: postDraft.slug.trim().toLowerCase(), excerpt: postDraft.excerpt.trim(), markdown: postDraft.markdown.trim(), categoryId: postDraft.categoryId, tags, serviceIds: postDraft.serviceIds, sources: postDraft.sources.map((source) => ({ title: source.title.trim(), url: source.url.trim() })).filter((source) => source.title || source.url), ...(postDraft.coverImageUrl ? { coverImageUrl: postDraft.coverImageUrl, coverImagePublicId: postDraft.coverImagePublicId, coverImageAlt: postDraft.coverImageAlt.trim() } : postId && activePost?.coverImageUrl ? { clearCoverImage: true } : {}), ...(postDraft.seoTitle.trim() ? { seoTitle: postDraft.seoTitle.trim() } : {}), ...(postDraft.seoDescription.trim() ? { seoDescription: postDraft.seoDescription.trim() } : {}), ...(postDraft.canonicalUrl.trim() ? { canonicalUrl: postDraft.canonicalUrl.trim() } : {}), noIndex: postDraft.noIndex, layout: postDraft.layout, status };
  }

  async function savePost(action: "draft" | "publish" | "archive") {
    try {
      setSaving(true);
      const status = action === "publish" ? "published" : action === "archive" ? "archived" : "draft" as BlogPost["status"];
      if (postId) await request(`/api/admin/blog/posts/${postId}`, "PATCH", postPayload(status));
      else {
        if (action !== "draft") throw new Error("احفظ المقال كمسودة أولًا، ثم راجعه واضغط نشر صريح.");
        const result = await request<{ post: BlogPost }>("/api/admin/blog/posts", "POST", postPayload("draft"));
        setPostId(result.post.id);
      }
      await load();
      onNotice(action === "publish" ? "تم نشر المقال بعد المراجعة." : action === "archive" ? "تمت أرشفة المقال وإخفاؤه من المدونة العامة." : "تم حفظ المسودة بأمان.");
    } catch (error) { onNotice(error instanceof Error ? error.message : "تعذر حفظ المقال."); }
    finally { setSaving(false); }
  }

  async function removePost() {
    if (!postId || !activePost) return;
    if (!window.confirm(`حذف مسودة «${activePost.title}»؟ لا يمكن استعادة الحذف.`)) return;
    try { setSaving(true); await request(`/api/admin/blog/posts/${postId}`, "DELETE"); openPost(); await load(); onNotice("تم حذف المسودة."); }
    catch (error) { onNotice(error instanceof Error ? error.message : "تعذر حذف المقال."); }
    finally { setSaving(false); }
  }

  async function saveCategory() {
    const order = Number(categoryDraft.order);
    if (!Number.isInteger(order) || order < 0) { onNotice("رتبة التصنيف يجب أن تكون رقمًا صحيحًا موجبًا أو صفرًا."); return; }
    const payload = { ...categoryDraft, name: categoryDraft.name.trim(), slug: categoryDraft.slug.trim().toLowerCase(), description: categoryDraft.description.trim() || undefined, order };
    try { setSaving(true); if (categoryId) await request(`/api/admin/blog/categories/${categoryId}`, "PATCH", payload); else await request("/api/admin/blog/categories", "POST", payload); setCategoryId(null); setCategoryDraft(emptyCategory()); await load(); onNotice("تم حفظ تصنيف المدونة."); }
    catch (error) { onNotice(error instanceof Error ? error.message : "تعذر حفظ التصنيف."); }
    finally { setSaving(false); }
  }

  async function removeCategory(category: BlogCategory) {
    if (!window.confirm(`حذف تصنيف «${category.name}»؟ لا يمكن حذفه إن كان مرتبطًا بمقالات.`)) return;
    try { setSaving(true); await request(`/api/admin/blog/categories/${category.id}`, "DELETE"); if (categoryId === category.id) { setCategoryId(null); setCategoryDraft(emptyCategory()); } await load(); onNotice("تم حذف تصنيف المدونة."); }
    catch (error) { onNotice(error instanceof Error ? error.message : "تعذر حذف التصنيف."); }
    finally { setSaving(false); }
  }

  async function uploadCover(file: File) {
    if (postDraft.title.trim().length < 2) { onNotice("اكتب عنوان المقال أولًا قبل رفع صورة الغلاف."); return; }
    try {
      const user = firebase?.auth.currentUser;
      if (!user) throw new Error("سجّل الدخول بحساب المالك لرفع الصورة.");
      setUploading(true);
      const signed = await requestSignedMediaUpload(await user.getIdToken(), "/api/admin/blog/media/signature", { postId: postId || undefined, title: postDraft.title.trim() });
      const asset = await uploadSignedMediaImage(file, signed, "chrigsm/blog/", "رفع غلاف المقال");
      setPostDraft((draft) => ({ ...draft, coverImageUrl: asset.imageUrl, coverImagePublicId: asset.imagePublicId }));
      onNotice("رُفعت صورة الغلاف. احفظ المسودة لتثبيتها في المقال.");
    } catch (error) { onNotice(error instanceof Error ? error.message : "تعذر رفع غلاف المقال."); }
    finally { setUploading(false); }
  }

  if (loading) return <section className="cmc-card"><div className="empty-state"><BookOpen size={25}/><h2>جارٍ تحميل المدونة</h2><p>يتم جلب المقالات والتصنيفات عبر جلسة المالك المحمية.</p></div></section>;

  return <section className="blog-manager" aria-label="إدارة المدونة"><div className="blog-manager-top"><div><p className="eyebrow">المالك فقط · Markdown آمن</p><h2>إدارة المدونة</h2><p>المسودة لا تظهر للزوار. النشر قرار صريح منفصل بعد المراجعة.</p></div><button className="primary-button" type="button" onClick={() => openPost()} disabled={saving}><FilePlus2 size={16}/> مقال جديد</button></div><div className="blog-manager-layout"><aside className="blog-manager-list"><div className="blog-list-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في المقالات" aria-label="البحث في مقالات المدونة"/><span>{snapshot.posts.length} مقال</span></div><div className="blog-post-list">{posts.map((post) => <button type="button" key={post.id} className={post.id === postId ? "active" : ""} onClick={() => openPost(post)}><span className={`blog-status ${post.status}`}>{post.status === "published" ? "منشور" : post.status === "archived" ? "مؤرشف" : "مسودة"}</span><b>{post.title}</b><small>{dateLabel(post.publishedAt || post.updatedAt)}</small></button>)}{!posts.length && <div className="blog-list-empty">لا توجد مقالات بعد. ابدأ بمسودة جديدة.</div>}</div></aside><div className="blog-editor-panel"><div className="blog-editor-heading"><div><p className="eyebrow">{activePost ? activePost.status === "published" ? "مقال منشور" : activePost.status === "archived" ? "مقال مؤرشف" : "مسودة" : "مسودة جديدة"}</p><h3>{postId ? "تحرير المقال" : "مقال جديد"}</h3></div><div className="row-actions"><button type="button" className="filter-button" onClick={() => setPreviewOpen((value) => !value)}><Eye size={14}/>{previewOpen ? "المحرر" : "المعاينة"}</button>{postId && activePost?.status !== "published" && <button type="button" className="danger-button" onClick={() => void removePost()} disabled={saving}><Trash2 size={14}/> حذف</button>}</div></div>{previewOpen ? <div className="blog-admin-preview"><header><h1>{postDraft.title || "عنوان المقال"}</h1><p>{postDraft.excerpt || "ملخص المقال سيظهر هنا."}</p></header><BlogMarkdown markdown={postDraft.markdown || "اكتب محتوى المقال لمعاينته."}/></div> : <><div className="blog-form-grid"><label className="editor-field wide">عنوان المقال<input value={postDraft.title} onChange={(event) => setPostDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="مثال: دليل تفعيل أداة GSM" disabled={saving}/></label><label className="editor-field">الرابط المختصر (إنجليزي)<input dir="ltr" value={postDraft.slug} onChange={(event) => setPostDraft((draft) => ({ ...draft, slug: event.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase() }))} placeholder="gsm-tool-guide" disabled={saving}/></label><label className="editor-field">التصنيف<select value={postDraft.categoryId} onChange={(event) => setPostDraft((draft) => ({ ...draft, categoryId: event.target.value }))} disabled={saving}><option value="">اختر التصنيف</option>{snapshot.categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.isActive ? "" : " (معطل)"}</option>)}</select></label><label className="editor-field wide">ملخص قصير<textarea value={postDraft.excerpt} onChange={(event) => setPostDraft((draft) => ({ ...draft, excerpt: event.target.value }))} placeholder="ملخص واضح يظهر في بطاقة المقال ومحركات البحث." disabled={saving}/></label><label className="editor-field wide">محتوى المقال بصيغة Markdown<textarea className="blog-markdown-input" dir="rtl" value={postDraft.markdown} onChange={(event) => setPostDraft((draft) => ({ ...draft, markdown: event.target.value }))} placeholder="# عنوان فرعي\n\nاكتب المحتوى هنا..." disabled={saving}/></label><label className="editor-field wide">الوسوم (افصل بالفاصلة)<input value={postDraft.tagsInput} onChange={(event) => setPostDraft((draft) => ({ ...draft, tagsInput: event.target.value }))} placeholder="GSM، شروحات، صيانة" disabled={saving}/></label><label className="editor-field">تخطيط المقال<select value={postDraft.layout} onChange={(event) => setPostDraft((draft) => ({ ...draft, layout: event.target.value as BlogLayout }))} disabled={saving}><option value="standard">مقال قياسي</option><option value="guide">دليل خطوة بخطوة</option><option value="comparison">مقارنة</option></select></label><label className="editor-field editor-toggle"><input type="checkbox" checked={postDraft.noIndex} onChange={(event) => setPostDraft((draft) => ({ ...draft, noIndex: event.target.checked }))} disabled={saving}/> منع الفهرسة مؤقتًا</label></div><section className="blog-editor-section"><div className="blog-subheading"><div><ImagePlus size={17}/><h4>غلاف المقال</h4></div></div><div className="blog-cover-control">{postDraft.coverImageUrl ? <Image src={postDraft.coverImageUrl} width={300} height={170} alt={postDraft.coverImageAlt || "معاينة غلاف المقال"}/> : <span><ImagePlus size={22}/> لا توجد صورة غلاف</span>}<div><label className="filter-button upload-label"><Upload size={14}/>{uploading ? "جارٍ الرفع..." : "رفع أو استبدال"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); event.currentTarget.value = ""; }} disabled={saving || uploading}/></label>{postDraft.coverImageUrl && <button className="danger-button" type="button" onClick={() => setPostDraft((draft) => ({ ...draft, coverImageUrl: "", coverImagePublicId: "", coverImageAlt: "" }))} disabled={saving || uploading}><X size={14}/> إزالة</button>}<label className="editor-field">النص البديل للصورة<input value={postDraft.coverImageAlt} onChange={(event) => setPostDraft((draft) => ({ ...draft, coverImageAlt: event.target.value }))} placeholder="وصف واضح لصورة الغلاف" disabled={saving}/></label></div></div></section><section className="blog-editor-section"><div className="blog-subheading"><div><Link2 size={17}/><h4>الخدمات المرتبطة</h4></div><small>تظهر للزائر أسفل المقال إن كانت مفعلة.</small></div><div className="blog-service-picker">{snapshot.services.map((service) => <label key={service.id}><input type="checkbox" checked={postDraft.serviceIds.includes(service.id)} onChange={(event) => setPostDraft((draft) => ({ ...draft, serviceIds: event.target.checked ? [...draft.serviceIds, service.id] : draft.serviceIds.filter((id) => id !== service.id) }))} disabled={saving}/><span>{service.title}</span>{!service.isActive && <small>معطلة</small>}</label>)}</div></section><section className="blog-editor-section"><div className="blog-subheading"><div><BookOpen size={17}/><h4>المصادر الخارجية</h4></div><button className="filter-button" type="button" onClick={() => setPostDraft((draft) => ({ ...draft, sources: [...draft.sources, { title: "", url: "" }] }))} disabled={saving}><Plus size={14}/> إضافة مصدر</button></div><div className="blog-source-list">{postDraft.sources.map((source, index) => <div key={`${index}-${source.url}`}><input value={source.title} onChange={(event) => setPostDraft((draft) => ({ ...draft, sources: draft.sources.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) }))} placeholder="اسم المصدر" disabled={saving}/><input dir="ltr" value={source.url} onChange={(event) => setPostDraft((draft) => ({ ...draft, sources: draft.sources.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item) }))} placeholder="https://..." disabled={saving}/><button className="icon-action-button" type="button" aria-label="حذف المصدر" onClick={() => setPostDraft((draft) => ({ ...draft, sources: draft.sources.filter((_, itemIndex) => itemIndex !== index) }))} disabled={saving}><Trash2 size={15}/></button></div>)}</div></section><section className="blog-editor-section"><div className="blog-subheading"><div><Tag size={17}/><h4>SEO المتقدم</h4></div></div><div className="blog-form-grid"><label className="editor-field">عنوان SEO (اختياري)<input value={postDraft.seoTitle} onChange={(event) => setPostDraft((draft) => ({ ...draft, seoTitle: event.target.value }))} maxLength={70} disabled={saving}/></label><label className="editor-field">وصف SEO (اختياري)<input value={postDraft.seoDescription} onChange={(event) => setPostDraft((draft) => ({ ...draft, seoDescription: event.target.value }))} maxLength={170} disabled={saving}/></label><label className="editor-field wide">الرابط القانوني (اختياري)<input dir="ltr" value={postDraft.canonicalUrl} onChange={(event) => setPostDraft((draft) => ({ ...draft, canonicalUrl: event.target.value }))} placeholder="https://..." disabled={saving}/></label></div></section></>}<footer className="blog-editor-actions"><button className="filter-button" type="button" onClick={() => void savePost("draft")} disabled={saving}><Save size={15}/>{saving ? "جارٍ الحفظ..." : "حفظ مسودة"}</button>{postId && activePost?.status !== "published" && <button className="primary-button" type="button" onClick={() => void savePost("publish")} disabled={saving}><Send size={15}/> نشر بعد المراجعة</button>}{postId && activePost?.status === "published" && <button className="outline-button" type="button" onClick={() => void savePost("archive")} disabled={saving}><CheckCircle2 size={15}/> أرشفة المقال</button>}</footer></div></div><BlogAiPanel title={postDraft.title} excerpt={postDraft.excerpt} markdown={postDraft.markdown} tags={postDraft.tagsInput.split(/[,،]/).map((tag) => tag.trim()).filter(Boolean)} onNotice={onNotice} onInsert={(draft) => { setPostDraft((previous) => ({ ...previous, markdown: draft })); setPreviewOpen(false); }}/><section className="blog-category-manager"><div className="blog-manager-top"><div><p className="eyebrow">تنظيم المحتوى</p><h3>تصنيفات المدونة</h3></div><button className="filter-button" type="button" onClick={() => openCategory()}><Plus size={14}/> تصنيف جديد</button></div><div className="blog-category-editor"><label className="editor-field">الاسم<input value={categoryDraft.name} onChange={(event) => setCategoryDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="مثال: شروحات الأدوات" disabled={saving}/></label><label className="editor-field">الرابط المختصر<input dir="ltr" value={categoryDraft.slug} onChange={(event) => setCategoryDraft((draft) => ({ ...draft, slug: event.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase() }))} placeholder="tool-guides" disabled={saving}/></label><label className="editor-field">اللون<input type="color" value={categoryDraft.color} onChange={(event) => setCategoryDraft((draft) => ({ ...draft, color: event.target.value }))} disabled={saving}/></label><label className="editor-field">الرتبة<input type="number" min="0" value={categoryDraft.order} onChange={(event) => setCategoryDraft((draft) => ({ ...draft, order: event.target.value }))} disabled={saving}/></label><label className="editor-field wide">وصف مختصر<input value={categoryDraft.description} onChange={(event) => setCategoryDraft((draft) => ({ ...draft, description: event.target.value }))} disabled={saving}/></label><label className="editor-field editor-toggle"><input type="checkbox" checked={categoryDraft.isActive} onChange={(event) => setCategoryDraft((draft) => ({ ...draft, isActive: event.target.checked }))} disabled={saving}/> ظاهر في المدونة</label><button className="primary-button small" type="button" onClick={() => void saveCategory()} disabled={saving}><Save size={14}/> {categoryId ? "حفظ التصنيف" : "إضافة التصنيف"}</button>{categoryId && <button type="button" className="filter-button" onClick={() => openCategory()} disabled={saving}>إلغاء التعديل</button>}</div><div className="blog-category-list">{snapshot.categories.map((category) => <article key={category.id}><span style={{ background: category.color }}/><div><b>{category.name}</b><small>{category.isActive ? "ظاهر" : "مخفي"} · {snapshot.posts.filter((post) => post.categoryId === category.id).length} مقال</small></div><button type="button" className="filter-button" onClick={() => openCategory(category)}><Pencil size={14}/> تعديل</button><button type="button" className="icon-action-button danger-icon" aria-label={`حذف ${category.name}`} onClick={() => void removeCategory(category)} disabled={saving}><Trash2 size={15}/></button></article>)}</div></section></section>;
}


type BlogAiStatus = { enabled: boolean; configured: boolean; provider?: string; model?: string; endpointHost?: string; protocol?: string; actions: Array<"outline" | "draft" | "rewrite" | "titles" | "seo"> };

function BlogAiPanel({ title, excerpt, markdown, tags, onNotice, onInsert }: { title: string; excerpt: string; markdown: string; tags: string[]; onNotice: (message: string) => void; onInsert: (draft: string) => void }) {
  const firebase = useMemo(() => firebaseServices(), []);
  const [status, setStatus] = useState<BlogAiStatus | null>(null);
  const [action, setAction] = useState<BlogAiStatus["actions"][number]>("draft");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [running, setRunning] = useState(false);

  const authenticatedRequest = useCallback(async <T,>(method: "GET" | "POST", body?: unknown): Promise<T> => {
    const user = firebase?.auth.currentUser;
    if (!user) throw new Error("سجّل الدخول بحساب المالك أولًا.");
    const response = await fetch("/api/admin/blog/ai", { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    const payload = await response.json().catch(() => ({})) as T & { error?: string };
    if (!response.ok) throw new Error(payload.error || "تعذر التواصل مع مساعد المدونة.");
    return payload;
  }, [firebase]);

  useEffect(() => {
    if (!firebase) return;
    return onAuthStateChanged(firebase.auth, (user) => {
      if (!user) { setStatus(null); return; }
      void authenticatedRequest<{ ai: BlogAiStatus }>("GET").then((result) => setStatus(result.ai)).catch((error) => onNotice(error instanceof Error ? error.message : "تعذر التحقق من موصل AI."));
    });
  }, [authenticatedRequest, firebase, onNotice]);

  async function run() {
    if (prompt.trim().length < 8) { onNotice("اكتب طلبًا واضحًا من 8 أحرف على الأقل لمساعد المدونة."); return; }
    try {
      setRunning(true);
      const response = await authenticatedRequest<{ draft: string; usage: { used: number; limit: number } }>("POST", { action, prompt: prompt.trim(), title, excerpt, markdown, tags });
      setResult(response.draft);
      onNotice(`وصلت مسودة AI للمراجعة. استُخدم ${response.usage.used} من ${response.usage.limit} طلبًا اليوم.`);
    } catch (error) { onNotice(error instanceof Error ? error.message : "تعذر إنشاء مسودة AI."); }
    finally { setRunning(false); }
  }

  const actionLabels: Record<BlogAiStatus["actions"][number], string> = { outline: "مخطط مقال", draft: "مسودة كاملة", rewrite: "تحسين النص", titles: "عناوين وSEO", seo: "SEO ووسوم" };
  return <section className="blog-ai-panel"><div className="blog-ai-heading"><div><p className="eyebrow">موصل خارجي · محصور في المدونة</p><h3><Sparkles size={19}/> مساعد الكتابة</h3><p>لا يحفظ ولا ينشر ولا يصل إلى العملاء أو الطلبات. راجع الناتج ثم اختر إدراجه في المحرر.</p></div>{status?.configured && <span className="blog-ai-status"><CheckCircle2 size={14}/>{status.provider} · {status.model}</span>}</div>{status && !status.configured ? <div className="blog-ai-unconfigured"><h4>الموصل غير مفعّل بعد</h4><p>لا تظهر رموز الوصول هنا. أضف إعدادات الخادم الآمنة ثم فعّل الموصل. يُقبل فقط رابط HTTPS ضمن المضيفين المسموحين.</p><code>CONTENT_AI_ENABLED · CONTENT_AI_API_URL · CONTENT_AI_API_TOKEN · CONTENT_AI_MODEL · CONTENT_AI_ALLOWED_HOSTS</code></div> : status?.configured ? <div className="blog-ai-workspace"><div className="blog-ai-config"><span>المضيف المسموح: <b>{status.endpointHost}</b></span><span>البروتوكول: <b>{status.protocol === "gemini-generate-content" ? "Gemini" : "OpenAI-compatible"}</b></span></div><div className="blog-ai-controls"><select value={action} onChange={(event) => setAction(event.target.value as BlogAiStatus["actions"][number])} disabled={running}>{status.actions.map((item) => <option key={item} value={item}>{actionLabels[item]}</option>)}</select><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="مثال: اكتب دليلًا عمليًا للمبتدئين، واذكر أن أي خطوات حساسة تحتاج مراجعة قبل التنفيذ." disabled={running}/><button type="button" className="primary-button" onClick={() => void run()} disabled={running}><Sparkles size={15}/>{running ? "جارٍ الكتابة..." : "إنشاء مسودة للمراجعة"}</button></div>{result && <div className="blog-ai-result"><div><h4>ناتج للمراجعة فقط</h4><div className="row-actions"><button type="button" className="filter-button" onClick={() => void navigator.clipboard?.writeText(result).then(() => onNotice("تم نسخ المسودة."))}><Copy size={14}/> نسخ</button><button type="button" className="primary-button small" onClick={() => { onInsert(result); onNotice("أُدرجت المسودة في المحرر. راجعها ثم احفظها يدويًا."); }}><Pencil size={14}/> إدراج في المحرر</button></div></div><textarea value={result} onChange={(event) => setResult(event.target.value)} aria-label="مسودة AI قابلة للمراجعة"/></div>}</div> : <div className="blog-ai-loading">جارٍ التحقق من إعداد موصل الكتابة…</div>}</section>;
}
