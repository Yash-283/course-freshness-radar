import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { askJson, MODELS, monthSpend } from './client.js';

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('⚠ ANTHROPIC_API_KEY is empty in .env');
  process.exit(1);
}

// 1) Which models can this key use?
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const list = await client.models.list({ limit: 50 });
console.log('Models your key can use:');
for (const m of list.data) console.log(`  - ${m.id}`);

// 2) One tiny real call with the triage model
console.log(`\nTest call with ${MODELS.triage} ...`);
const reply = await askJson({
  model: MODELS.triage,
  system: 'Reply with JSON only.',
  prompt: 'Return {"status":"ok","course":"Course Freshness Radar"}',
  maxTokens: 50,
  purpose: 'test',
});
console.log('Reply:', reply);
console.log(`AI spend this month: $${monthSpend().toFixed(5)}`);