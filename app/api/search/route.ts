import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Use OpenAI Chat Completions to synthesize a JSON list of web-search-like results
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that returns a JSON array of up to 10 search results. Each result must be an object with keys: url, title, description. Return only valid JSON (no explanation).',
          },
          { role: 'user', content: `Search the web and return results for: "${query}"` },
        ],
        temperature: 0,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('OpenAI search error:', resp.status, text);
      throw new Error('Search failed');
    }

    const data = await resp.json();
    const assistant = data.choices?.[0]?.message?.content ?? '';

    let results: Array<any> = [];

    try {
      results = JSON.parse(assistant);
      if (!Array.isArray(results)) results = [];
    } catch (err) {
      // Try to extract JSON substring if the model added text around JSON
      const m = assistant.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (m) {
        try {
          const parsed = JSON.parse(m[0]);
          if (Array.isArray(parsed)) results = parsed;
        } catch (e) {
          // fall through
        }
      }
    }

    // Normalize results
    const normalized = (results || []).slice(0, 10).map((r: any) => ({
      url: r.url || r.link || '',
      title: r.title || r.name || r.url || '',
      description: r.description || r.snippet || '',
    }));

    return NextResponse.json({ results: normalized });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}