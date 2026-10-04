import { config, smsEnabled } from './config.ts'

/** Sends an SMS through Twilio. Returns false (never throws) when SMS is unconfigured or fails. */
export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!smsEnabled()) return false
  const { accountSid, authToken, fromNumber } = config.twilio
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, '')
  if (/^\d{10}$/.test(digits)) return `+91${digits}` // Indian mobile numbers without a country code
  if (/^0\d{10}$/.test(digits)) return `+91${digits.slice(1)}`
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null
}
