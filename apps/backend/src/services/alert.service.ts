import { redactSensitive } from '@arcade/shared-utils';
import { Config } from '../config.js';

export interface AlertPayload {
  event: string;
  severity: 'info' | 'warning' | 'critical';
  at: string;
  detail: Record<string, unknown>;
}

export function buildAlert(event: string, severity: AlertPayload['severity'], detail: Record<string, unknown> = {}): AlertPayload {
  return {
    event,
    severity,
    at: new Date().toISOString(),
    detail: redactSensitive(detail) as Record<string, unknown>
  };
}

/**
 * Log a structured event and, when configured, POST it to a test or operator receiver.
 * A loopback receiver is a local test double. It is not an external notification.
 */
export async function emitAlert(event: string, severity: AlertPayload['severity'], detail: Record<string, unknown> = {}): Promise<void> {
  const payload = buildAlert(event, severity, detail);
  console.warn(JSON.stringify(payload));
  const raw = (process.env.ALERT_WEBHOOK_URL || '').trim();
  if (!raw) return;
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    console.warn(JSON.stringify({ event: 'alert_delivery_failed', reason: 'invalid_url' }));
    return;
  }
  const loopback = target.hostname === '127.0.0.1' || target.hostname === 'localhost';
  if (!loopback && (Config.isPublicDeployment ? target.protocol !== 'https:' : true)) {
    console.warn(JSON.stringify({ event: 'alert_delivery_skipped', reason: loopback ? 'loopback' : 'non_https_or_non_public' }));
    return;
  }
  if (!loopback && target.protocol !== 'https:') return;
  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1000)
    });
    if (!response.ok) {
      console.warn(JSON.stringify({ event: 'alert_delivery_failed', status: response.status, host: target.host }));
    }
  } catch {
    console.warn(JSON.stringify({ event: 'alert_delivery_failed', host: target.host }));
  }
}
