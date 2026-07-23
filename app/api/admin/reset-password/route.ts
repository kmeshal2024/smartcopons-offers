import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

/**
 * Reset the admin password, authorised by APP_SECRET.
 *
 * The seed creates the admin with `upsert({ update: {} })`, so re-running it
 * never changes an existing password — which left the production login
 * unreachable once ADMIN_PASSWORD drifted from what was originally seeded.
 * bcrypt hashes cannot be reversed, so recovery needs a deliberate reset.
 *
 * Guarded by APP_SECRET (the same secret the cron routes use) rather than a
 * session, since being locked out is exactly the situation this handles.
 *
 *   curl -X POST "https://sa.smartcopons.com/api/admin/reset-password" \
 *     -H "Content-Type: application/json" \
 *     -d '{"key":"$APP_SECRET","email":"admin@smartcopons.com","password":"<new>"}'
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { key, email, password } = body as {
      key?: string
      email?: string
      password?: string
    }

    const appSecret = process.env.APP_SECRET
    if (!appSecret || key !== appSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'email and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 10) {
      return NextResponse.json(
        { error: 'Password must be at least 10 characters' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      // List which admin accounts do exist, so a typo is obvious.
      const accounts = await prisma.user.findMany({ select: { email: true } })
      return NextResponse.json(
        { error: 'No user with that email', existingAccounts: accounts.map(a => a.email) },
        { status: 404 }
      )
    }

    await prisma.user.update({
      where: { email },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    })

    return NextResponse.json({ success: true, email, updatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Password reset failed:', error)
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
  }
}
