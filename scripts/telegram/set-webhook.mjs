#!/usr/bin/env node
import process from 'node:process';

const [,, action = 'info'] = process.argv;
const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_SECRET_TOKEN;

if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN environment variable.');
  process.exit(1);
}

const api = `https://api.telegram.org/bot${token}`;

const call = async (method, params = undefined) => {
  const response = await fetch(`${api}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: params ? JSON.stringify(params) : undefined,
  });

  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(`${method} failed: ${JSON.stringify(payload)}`);
  }

  return payload.result;
};

const main = async () => {
  if (action === 'set') {
    if (!webhookUrl) {
      console.error('Set TELEGRAM_WEBHOOK_URL to use action "set".');
      process.exit(1);
    }

    const result = await call('setWebhook', {
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ['message', 'callback_query', 'inline_query', 'web_app_data'],
      drop_pending_updates: false,
    });

    console.log('Webhook configured:', result);
    return;
  }

  if (action === 'delete') {
    const result = await call('deleteWebhook', { drop_pending_updates: false });
    console.log('Webhook removed:', result);
    return;
  }

  if (action === 'info') {
    const result = await call('getWebhookInfo');
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error(`Unknown action: ${action}. Use: info | set | delete`);
  process.exit(1);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
