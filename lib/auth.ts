import { cookies } from 'next/headers'
import { createHmac } from 'crypto'

const SESSION_COOKIE_NAME = 'session'
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

interface SessionData {
  userId: string
  email: string
  role: string
  exp: number
}

function getSecret(): string {
  const secret = process.env.APP_SECRET
  if (!secret) {
    throw new Error('APP_SECRET environment variable is required')
  }
  return secret
}

function signData(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('hex')
}

export function createSession(userId: string, email: string, role: string): string {
  const exp = Date.now() + SESSION_DURATION
  const sessionData: SessionData = { userId, email, role, exp }
  const payload = JSON.stringify(sessionData)
  const signature = signData(payload)
  return `${Buffer.from(payload).toString('base64')}.${signature}`
}

export function verifySession(token: string): SessionData | null {
  try {
    const [payloadB64, signature] = token.split('.')
    if (!payloadB64 || !signature) return null

    const payload = Buffer.from(payloadB64, 'base64').toString('utf-8')
    const expectedSignature = signData(payload)

    if (signature !== expectedSignature) return null

    const data: SessionData = JSON.parse(payload)
    
    if (data.exp < Date.now()) return null

    return data
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  })
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function requireAdmin(): Promise<SessionData> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }
  return session
}
