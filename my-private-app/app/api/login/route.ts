import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || '').trim();
    const password = String(body?.password || '');

    if (email !== 'admin@private.local' || password !== 'private123') {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password.' },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ success: true, user: { email, role: 'Owner' } });
    response.cookies.set('private_app_session', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, message: 'Login failed.' },
      { status: 400 },
    );
  }
}
