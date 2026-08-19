import { z } from "zod";
import type { BlogPost, BlogPostStatus } from "./types";

const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "الرابط المختصر غير صحيح").min(2).max(120);
const httpsUrl = z.string().trim().url("الرابط غير صحيح").refine((value) => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "يجب أن يبدأ الرابط بـ https://");
const cloudinaryImageUrl = httpsUrl.refine((value) => {
  try { return new URL(value).hostname === "res.cloudinary.com"; } catch { return false; }
}, "الصورة يجب أن تأتي من Cloudinary المهيأ");
const cloudinaryBlogPublicId = z.string().trim().regex(/^chrigsm\/blog\/[a-z0-9_-]+\/[a-z0-9_-]+$/i, "معرف صورة المقال غير صحيح").max(220);
const categoryName = z.string().trim().min(2, "اسم التصنيف قصير جدًا").max(90);
const categoryDescription = z.string().trim().max(500, "وصف التصنيف طويل جدًا");
const categoryColor = z.string().trim().regex(/^#[0-9a-f]{6}$/i, "لون التصنيف غير صحيح");
const categoryOrder = z.number().int().min(0).max(9999);
const sourceSchema = z.object({ title: z.string().trim().min(2, "اسم المصدر قصير جدًا").max(180), url: httpsUrl.max(2000) });
const tagsSchema = z.array(z.string().trim().min(2).max(40)).max(12, "الحد الأقصى 12 وسمًا");
const serviceIdsSchema = z.array(z.string().trim().min(1).max(128)).max(8, "الحد الأقصى 8 خدمات مرتبطة");
const sourcesSchema = z.array(sourceSchema).max(16, "الحد الأقصى 16 مصدرًا");
const titleSchema = z.string().trim().min(6, "عنوان المقال قصير جدًا").max(180);
const excerptSchema = z.string().trim().min(20, "ملخص المقال قصير جدًا").max(420);
const markdownSchema = z.string().trim().min(80, "اكتب محتوى المقال أولًا").max(60000, "محتوى المقال طويل جدًا");
const categoryIdSchema = z.string().trim().min(1, "اختر تصنيفًا للمقال").max(128);
const altSchema = z.string().trim().min(3, "أضف نصًا بديلًا واضحًا للصورة").max(180);
const seoTitleSchema = z.string().trim().min(6).max(70);
const seoDescriptionSchema = z.string().trim().min(40).max(170);
const canonicalUrlSchema = httpsUrl.max(2000);
const layoutSchema = z.enum(["standard", "guide", "comparison"]);
const statusSchema = z.enum(["draft", "published", "archived"]);

export const blogCategorySchema = z.object({
  name: categoryName,
  slug: slugSchema,
  description: categoryDescription.optional(),
  color: categoryColor.default("#1479ff"),
  order: categoryOrder.default(0),
  isActive: z.boolean().default(true),
});

export const blogCategoryPatchSchema = z.object({
  name: categoryName.optional(),
  slug: slugSchema.optional(),
  description: categoryDescription.optional(),
  color: categoryColor.optional(),
  order: categoryOrder.optional(),
  isActive: z.boolean().optional(),
});

export const blogSourceSchema = sourceSchema;

export const blogPostSchema = z.object({
  title: titleSchema,
  slug: slugSchema,
  excerpt: excerptSchema,
  markdown: markdownSchema,
  categoryId: categoryIdSchema,
  tags: tagsSchema.default([]),
  serviceIds: serviceIdsSchema.default([]),
  sources: sourcesSchema.default([]),
  coverImageUrl: cloudinaryImageUrl.optional(),
  coverImagePublicId: cloudinaryBlogPublicId.optional(),
  coverImageAlt: altSchema.optional(),
  seoTitle: seoTitleSchema.optional(),
  seoDescription: seoDescriptionSchema.optional(),
  canonicalUrl: canonicalUrlSchema.optional(),
  noIndex: z.boolean().default(false),
  layout: layoutSchema.default("standard"),
  status: statusSchema.default("draft"),
}).superRefine((post, context) => {
  if (Boolean(post.coverImageUrl) !== Boolean(post.coverImagePublicId)) context.addIssue({ code: "custom", message: "صورة الغلاف تحتاج رابطًا ومعرفًا صالحين من Cloudinary" });
  if (post.coverImageUrl && !post.coverImageAlt) context.addIssue({ code: "custom", path: ["coverImageAlt"], message: "اكتب نصًا بديلًا لصورة الغلاف" });
  if (new Set(post.tags.map((tag) => tag.toLocaleLowerCase("ar"))).size !== post.tags.length) context.addIssue({ code: "custom", path: ["tags"], message: "الأوسمة يجب أن تكون فريدة" });
  if (new Set(post.serviceIds).size !== post.serviceIds.length) context.addIssue({ code: "custom", path: ["serviceIds"], message: "الخدمات المرتبطة يجب أن تكون فريدة" });
  if (new Set(post.sources.map((source) => source.url)).size !== post.sources.length) context.addIssue({ code: "custom", path: ["sources"], message: "روابط المصادر يجب أن تكون فريدة" });
  if (post.status === "published" && post.noIndex) context.addIssue({ code: "custom", path: ["noIndex"], message: "لا تنشر المقال مع منع الفهرسة إلا بعد قرار SEO واضح" });
});

export const blogPostPatchSchema = z.object({
  title: titleSchema.optional(),
  slug: slugSchema.optional(),
  excerpt: excerptSchema.optional(),
  markdown: markdownSchema.optional(),
  categoryId: categoryIdSchema.optional(),
  tags: tagsSchema.optional(),
  serviceIds: serviceIdsSchema.optional(),
  sources: sourcesSchema.optional(),
  coverImageUrl: cloudinaryImageUrl.optional(),
  coverImagePublicId: cloudinaryBlogPublicId.optional(),
  coverImageAlt: altSchema.optional(),
  seoTitle: seoTitleSchema.optional(),
  seoDescription: seoDescriptionSchema.optional(),
  canonicalUrl: canonicalUrlSchema.optional(),
  noIndex: z.boolean().optional(),
  layout: layoutSchema.optional(),
  status: statusSchema.optional(),
  clearCoverImage: z.boolean().optional(),
});

export function publicBlogPost(post: BlogPost) {
  const { createdBy, updatedBy, ...publicPost } = post;
  void createdBy;
  void updatedBy;
  return publicPost;
}

export function blogStatusLabel(status: BlogPostStatus) {
  return { draft: "مسودة", published: "منشور", archived: "مؤرشف" }[status];
}
