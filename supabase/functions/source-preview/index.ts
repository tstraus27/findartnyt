const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get('url');
  if (!rawUrl) {
    return new Response('Missing url parameter.', { status: 400, headers: corsHeaders });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Unsupported protocol.');
  } catch {
    return new Response('Invalid source URL.', { status: 400, headers: corsHeaders });
  }

  const upstream = await fetch(target, {
    headers: {
      'User-Agent': 'FindArtNYCReviewBot/1.0',
      Accept: 'text/html,application/xhtml+xml'
    }
  });
  const contentType = upstream.headers.get('content-type') || 'text/html; charset=utf-8';
  const html = await upstream.text();
  const base = `<base href="${upstream.url}">`;
  const withBase = html.includes('<head')
    ? html.replace(/<head([^>]*)>/i, `<head$1>${base}`)
    : `${base}${html}`;

  return new Response(withBase, {
    status: upstream.status,
    headers: {
      ...corsHeaders,
      'Content-Type': contentType,
      'X-Frame-Options': '',
      'Content-Security-Policy': ''
    }
  });
});
