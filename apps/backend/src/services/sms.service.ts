import { Config } from '../config.js';

export class SmsService {
  /**
   * Dispatches real SMS OTP via configured Indian telecom provider (Fast2SMS / MSG91)
   * Falls back gracefully to Demo mode if keys are not configured
   */
  static async sendOtp(phoneNumber: string, otp: string): Promise<{ success: boolean; provider: string; message: string }> {
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);

    // 1. FAST2SMS Real Provider
    if (Config.smsProvider === 'FAST2SMS' && Config.fast2SmsApiKey) {
      try {
        console.log(`[SMS GATEWAY] 🚀 Dispatching live SMS via Fast2SMS to +91 ${cleanPhone}...`);
        const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': Config.fast2SmsApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: otp,
            numbers: cleanPhone
          })
        });

        const data: any = await res.json();
        if (data.return === true) {
          console.log(`[SMS GATEWAY] ✅ Fast2SMS delivered successfully to +91 ${cleanPhone}. Request ID: ${data.request_id}`);
          return { success: true, provider: 'FAST2SMS', message: 'OTP sent via Fast2SMS' };
        } else {
          console.warn(`[SMS GATEWAY] ⚠️ Fast2SMS rejected: ${data.message || 'Unknown error'}. Falling back to demo mode.`);
        }
      } catch (err: any) {
        console.error(`[SMS GATEWAY] ❌ Fast2SMS connection error:`, err.message);
      }
    }

    // 2. MSG91 Real Provider (India DLT Compliant OTP Gateway)
    if (Config.smsProvider === 'MSG91' && Config.msg91AuthKey) {
      try {
        console.log(`[SMS GATEWAY] 🚀 Dispatching live SMS via MSG91 to +91 ${cleanPhone}...`);
        const templateId = Config.msg91TemplateId || 'default';
        const url = new URL('https://control.msg91.com/api/v5/otp');
        url.searchParams.set('template_id', templateId);
        url.searchParams.set('mobile', `91${cleanPhone}`);
        url.searchParams.set('authkey', Config.msg91AuthKey);
        url.searchParams.set('otp', otp);
        url.searchParams.set('otp_expiry', '10');
        if (Config.msg91SenderId) {
          url.searchParams.set('sender', Config.msg91SenderId);
        }

        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'authkey': Config.msg91AuthKey
          },
          body: JSON.stringify({
            template_id: templateId,
            mobile: `91${cleanPhone}`,
            otp,
            otp_expiry: 10,
            ...(Config.msg91SenderId ? { sender: Config.msg91SenderId } : {})
          })
        });

        const data: any = await res.json().catch(() => ({}));
        if (data.type === 'success' || (res.status === 200 && !data.error)) {
          console.log(`[SMS GATEWAY] ✅ MSG91 delivered successfully to +91 ${cleanPhone}. Message: ${data.message || 'Delivered'}`);
          return { success: true, provider: 'MSG91', message: data.message || 'OTP sent via MSG91' };
        } else {
          console.warn(`[SMS GATEWAY] ⚠️ MSG91 rejected dispatch: ${data.message || JSON.stringify(data)}`);
        }
      } catch (err: any) {
        console.error(`[SMS GATEWAY] ❌ MSG91 connection error:`, err.message);
      }
    }

    // 3. No SMS key. Development can use ALLOW_DEMO_OTP. Production cannot invent a code.
    if (!Config.isProduction && Config.allowDemoOtp) {
      console.log(`[SMS] Development OTP stored for masked phone ending ${cleanPhone.slice(-2)}.`);
      return { success: true, provider: 'DEV', message: 'OTP stored for development' };
    }

    console.error(`[SMS] No SMS provider configured for +91 ${cleanPhone}.`);
    return { success: false, provider: 'NONE', message: 'SMS is not configured' };
  }
}
