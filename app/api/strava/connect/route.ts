import { NextRequest, NextResponse } from 'next/server';
import { authorizeUrl } from '@/lib/strava';

export async function GET(req: NextRequest) {
  const invite = (req.nextUrl.searchParams.get('invite') || '').replace(/[^a-f0-9]/gi, '');
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const res = NextResponse.redirect(authorizeUrl(`${nonce}.${invite}`));
  res.cookies.set('runz_oauth', nonce, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' });
  return res;
}
