#!/usr/bin/env node
import crypto from 'node:crypto';
import process from 'node:process';

const [,, initDataArg] = process.argv;
const initData = initDataArg ?? process.env.TELEGRAM_INIT_DATA;
const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!initData) {
  console.error('Provide initData as first argument or TELEGRAM_INIT_DATA env var.');
  process.exit(1);
}

if (!botToken) {
  console.error('Set TELEGRAM_BOT_TOKEN to validate init data signature.');
  process.exit(1);
}

const params = new URLSearchParams(initData);
const hash = params.get('hash');
if (!hash) {
  console.error('initData does not contain hash.');
  process.exit(1);
}
params.delete('hash');

const dataCheckString = [...params.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
const signature = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

console.log(`Signature valid: ${signature === hash}`);
if (signature !== hash) {
  process.exit(1);
}

const userRaw = params.get('user');
if (userRaw) {
  try {
    console.log('User payload:', JSON.stringify(JSON.parse(userRaw), null, 2));
  } catch {
    console.log('User payload (raw):', userRaw);
  }
}
