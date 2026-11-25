import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/db.js';

// Claude API list prices, USD per million tokens [input, output] (checked Nov 2026)
const PRICES = { haiku: [0.10, 0.50], sonnet: [2.00, 10.00] };
const priceFor = (model) => (model.includes('sonnet') ? PRICES.sonnet : PRICES.haiku);

export const MODELS = {
  triage: process.env.AI_MODEL_TRIAGE || 'claude-haiku-5-5',
  judge:  process.env.AI_MODEL_JUDGE  || 'claude-haiku-5-5',
  review: process.env.AI_MODEL_REVIEW || 'claude-sonnet-5-5',
};

const CAP = Number(process.env.AI_MONTHLY_CAP_USD || 4.5);
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const logUsage = db.prepare(`
  INSERT INTO ai_usage (at, model, purpose, inputTokens, outputTokens, costUsd)
  VALUES (?, ?, ?, ?, ?, ?)`);

// How much AI has cost so far this calendar month
export function monthSpend() {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return db.prepare('SELECT COALESCE(SUM(costUsd), 0) AS s FROM ai_usage WHERE at >= ?')
           .get(start.toISOString()).s;
}

// Find the JSON in Claude's reply and parse it
function parseJson(text) {
  const match = text.match(/[\[{][\s\S]*[\]}]/);
  if (!match) throw new Error('AI reply had no JSON');
  return JSON.parse(match[0]);
}

// Ask Claude and get JSON back. Records cost; refuses if the monthly cap is reached.
// Ask Claude for structured data. Records cost; refuses if the monthly cap is reached.
// If `schema` is given, Claude must fill in that exact structure (reliable, no broken JSON).
export async function askJson({ model, system, prompt, maxTokens = 1500, purpose, schema }) {
  const spent = monthSpend();
  if (spent >= CAP) {
    throw new Error(`Monthly AI cap reached ($${spent.toFixed(2)} of $${CAP}) - AI paused until next month`);
  }

  const params = {
    model,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt }],
  };
  if (schema) {
    params.tools = [{
      name: 'submit_result',
      description: 'Submit the result in exactly this structure.',
      input_schema: schema,
    }];
    params.tool_choice = { type: 'tool', name: 'submit_result' }; // Claude must use the form
  }

  const res = await client.messages.create(params);

  // Record cost
  const u = res.usage;
  const [inPrice, outPrice] = priceFor(model);
  const cost =
    ((u.input_tokens + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1) * inPrice +
     u.output_tokens * outPrice) / 1e6;
  logUsage.run(new Date().toISOString(), model, purpose, u.input_tokens, u.output_tokens, cost);

  if (res.stop_reason === 'max_tokens') throw new Error('AI reply was cut off (max_tokens) - try a smaller batch');

  if (schema) {
    const block = res.content.find((b) => b.type === 'tool_use');
    if (!block) throw new Error('AI did not return the structured result');
    return block.input; // already a proper JavaScript object
  }
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return parseJson(text);
}