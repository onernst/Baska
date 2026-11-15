// Baska assistant: a Supabase Edge Function that talks to Claude.
// The Anthropic API key stays on the server (secret ANTHROPIC_API_KEY); the app never sees it.
// Claude replies with text and/or "tool" requests; the app carries those out with the
// signed-in person's own permissions, so it can only touch lists they belong to.

const MODEL = 'claude-haiku-5-5';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `You are the assistant inside Baska, a shared shopping-list app.
Help the user with their lists: answer questions about what's on them, and carry out commands
by calling the tools (add, update, remove items; open or create lists; filter by store; find recipes).
Rules:
- Use the app state you are given; don't invent items, lists or people.
- When the user asks for a change, call the tool(s) rather than describing what they could do.
- If a request is ambiguous (e.g. two items match), ask a short question instead of guessing.
- Removing items is permanent; only do it when the user clearly asks.
- After acting, confirm in one short sentence. Keep answers brief and friendly.
- Statuses: needed (to buy), got, out (out of stock), substituted.`;

const TOOLS = [
  {
    name: 'add_items',
    description: 'Add one or more items to a list. Defaults: the open list, no store, the user as the person.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              qty: { type: 'integer', minimum: 1 },
              store: { type: 'string' },
              person: { type: 'string', description: 'Who the item is for' },
              list: { type: 'string', description: 'List name; omit for the open list' },
            },
            required: ['name'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'update_item',
    description: 'Change an item on the open list: its status, store, person, or move it to another list.',
    input_schema: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'Item name as shown on the list' },
        status: { type: 'string', enum: ['needed', 'got', 'out', 'substituted'] },
        note: { type: 'string', description: 'Status note, e.g. what was bought instead' },
        store: { type: 'string' },
        person: { type: 'string' },
        list: { type: 'string', description: 'Move the item to this list' },
      },
      required: ['item'],
    },
  },
  {
    name: 'remove_item',
    description: 'Permanently remove an item from the open list.',
    input_schema: {
      type: 'object',
      properties: { item: { type: 'string' } },
      required: ['item'],
    },
  },
  {
    name: 'open_list',
    description: 'Switch the app to another list.',
    input_schema: { type: 'object', properties: { list: { type: 'string' } }, required: ['list'] },
  },
  {
    name: 'create_list',
    description: 'Create a new list and open it.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'filter_store',
    description: 'Show only items for one store. Use "All" to show every store.',
    input_schema: { type: 'object', properties: { store: { type: 'string' } }, required: ['store'] },
  },
  {
    name: 'find_recipes',
    description: 'Search a recipe database by dish name and get ingredients.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'The assistant is not set up yet (missing ANTHROPIC_API_KEY).' }, 500);

  try {
    const { messages, context } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 60) {
      return json({ error: 'Bad request' }, 400);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: `${SYSTEM}\n\nCurrent app state (JSON):\n${JSON.stringify(context ?? {}).slice(0, 30000)}`,
        tools: TOOLS,
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return json({ error: data?.error?.message || 'The AI service returned an error.' }, 502);
    }
    return json({ content: data.content, stop_reason: data.stop_reason });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
