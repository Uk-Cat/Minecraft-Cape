import { NextRequest, NextResponse } from 'next/server';

const SKIN_PROVIDERS = [
  // Crafatar
  (username: string) => `https://crafatar.com/skins/${username}`,
  // mc-heads.net
  (username: string) => `https://mc-heads.net/skin/${username}`,
  // Minotar (redirects to skin)
  (username: string) => `https://minotar.net/skin/${username}`,
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get('username');
  const type = searchParams.get('type') || 'skin';

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  // Validate username - only allow alphanumeric, underscores, and hyphens
  if (!/^[a-zA-Z0-9_\-]+$/.test(username)) {
    return NextResponse.json({ error: 'Invalid username' }, { status: 400 });
  }

  // Build list of URLs to try
  const urls = SKIN_PROVIDERS.map((fn) => fn(username));

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MinecraftCapeCreator/1.0 (contact@capecreator.app)',
          Accept: 'image/png, image/*',
        },
        redirect: 'follow',
      });

      if (!response.ok) continue;

      const contentType = response.headers.get('content-type') || '';
      // Make sure we got an image back, not HTML error page
      if (!contentType.startsWith('image/')) continue;

      const buffer = await response.arrayBuffer();

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType || 'image/png',
          'Cache-Control': 'public, max-age=300, s-maxage=300',
        },
      });
    } catch {
      // Try next provider
      continue;
    }
  }

  return NextResponse.json(
    { error: 'Could not load skin from any provider. The player may not exist.' },
    { status: 404 }
  );
}