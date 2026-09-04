import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const couponSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters'),
  discountText: z.string().min(2, 'Discount text is required'),
  url: z.string().url('Invalid URL'),
  description: z.string().optional(),
  storeId: z.string().min(1, 'Store is required'),
  isActive: z.boolean().default(true),
})

export const bulkCouponItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  code: z.string().min(1, 'Code is required'),
  discountText: z.string().min(1, 'Discount text is required'),
  url: z.string().default('#'),
  description: z.string().optional(),
  storeName: z.string().min(1, 'Store name is required'),
  isActive: z.boolean().default(true),
})

export const bulkCouponSchema = z.object({
  coupons: z.array(bulkCouponItemSchema).min(1, 'At least 1 coupon required').max(100, 'Max 100 coupons per batch'),
})

// NOT z.coerce: coercion runs before the nullable check, and new Date(null)
// is 1970-01-01 — an empty "starts at" would silently become a start date.
const optionalDate = z.preprocess(
  v => (v === '' || v == null ? null : new Date(v as string)),
  z.date().nullable()
).optional()

const optionalPositiveInt = z.preprocess(
  v => (v === '' || v == null ? null : Number(v)),
  z.number().int().positive().nullable()
).optional()

export const bannerSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  imageUrl: z.string().url('Image URL must be a valid URL'),
  // http-only mirrors the DB CHECK; a mismatch here would surface as a raw 500.
  targetUrl: z.string().url('Target URL must be a valid URL').startsWith('http', 'Target URL must start with http'),
  placement: z.enum(['home_top', 'home_middle', 'offers', 'coupons', 'flyers', 'product', 'stores']),
  country: z.enum(['SA', 'AE']).default('SA'),
  isActive: z.boolean().default(true),
  startsAt: optionalDate,
  endsAt: optionalDate,
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  width: optionalPositiveInt,
  height: optionalPositiveInt,
})

export const storeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  logo: z.string().url().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
})
