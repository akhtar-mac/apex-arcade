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

    // 2. MSG91 Real Provider
    if (Config.smsProvider === 'MSG91' && Config.msg91AuthKey) {
      try {
        console.log(`[SMS GATEWAY] 🚀 Dispatching live SMS via MSG91 to +91 ${cleanPhone}...`);
        const url = `https://api.msg91.com/api/v5/otp?template_id=default&mobile=91${cleanPhone}&authkey=${Config.msg91AuthKey}&otp=${otp}`;
        const res = await fetch(url, { method: 'POST' });
        const data: any = await res.json();
        if (data.type === 'success') {
          console.log(`[SMS GATEWAY] ✅ MSG91 delivered successfully to +91 ${cleanPhone}`);
          return { success: true, provider: 'MSG91', message: 'OTP sent via MSG91' };
        } else {
          console.warn(`[SMS GATEWAY] ⚠️ MSG91 rejected: ${data.message || 'Unknown error'}`);
        }
      } catch (err: any) {
        console.error(`[SMS GATEWAY] ❌ MSG91 connection error:`, err.message);
      }
    }

    // 3. No SMS key. Development can use ALLOW_DEMO_OTP. Production cannot invent a code.
    if (!Config.isProduction && Config.allowDemoOtp) {
      console.log(`[SMS] Dev OTP for +91 ${cleanPhone} is ${otp}. It is not returned by the API.`);
      return { success: true, provider: 'DEV', message: 'OTP stored for development' };
    }

    console.error(`[SMS] No SMS provider configured for +91 ${cleanPhone}.`);
    return { success: false, provider: 'NONE', message: 'SMS is not configured' };
  }
}
