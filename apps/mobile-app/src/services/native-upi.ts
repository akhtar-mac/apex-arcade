import { Capacitor } from '@capacitor/core';

export type UpiProvider = 'phonepe' | 'gpay' | 'paytm' | 'bhim' | 'generic';

export interface UpiIntentParams {
  merchantUpiId: string;
  merchantName: string;
  amount: number;
  orderId: string;
  note?: string;
}

export class NativeUpiService {
  /**
   * Checks if app is running as a compiled native Android APK container
   */
  static isNativeAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  /**
   * Generates strict NPCI compliant UPI Intent URI
   */
  static generateUpiUri(params: UpiIntentParams): string {
    const note = params.note || `APEX-${params.orderId}`;
    return `upi://pay?pa=${encodeURIComponent(params.merchantUpiId)}&pn=${encodeURIComponent(params.merchantName)}&am=${params.amount.toFixed(2)}&cu=INR&tr=${encodeURIComponent(params.orderId)}&tn=${encodeURIComponent(note)}`;
  }

  /**
   * Generates direct app deep links for Indian payment apps
   */
  static getDeepLinks(params: UpiIntentParams) {
    const baseUri = this.generateUpiUri(params);
    const queryPart = baseUri.replace('upi://pay?', '');

    return {
      phonepe: `phonepe://pay?${queryPart}`,
      gpay: `tez://upi/pay?${queryPart}`,
      paytm: `paytmmp://pay?${queryPart}`,
      bhim: `bhim://pay?${queryPart}`,
      generic: baseUri
    };
  }

  /**
   * Launches native Indian UPI app on the player's device
   */
  static launchUpiApp(provider: UpiProvider, params: UpiIntentParams): { success: boolean; url: string } {
    const links = this.getDeepLinks(params);
    const targetUrl = links[provider] || links.generic;

    console.log(`[NATIVE UPI] 🚀 Launching ${provider.toUpperCase()} intent:`, targetUrl);

    if (typeof window !== 'undefined') {
      try {
        // Direct intent invocation on mobile device
        window.location.href = targetUrl;
        return { success: true, url: targetUrl };
      } catch (err: any) {
        console.warn(`[NATIVE UPI] ⚠️ Could not trigger ${provider} directly, falling back to generic UPI chooser:`, err.message);
        window.location.href = links.generic;
        return { success: false, url: links.generic };
      }
    }

    return { success: false, url: targetUrl };
  }
}

/**
 * Tactile Haptic Vibration Feedback for native Android experience
 */
export class HapticFeedback {
  static isAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  // Subtle tap on chip select (15ms)
  static chipSelect() {
    if (this.isAvailable()) {
      try { navigator.vibrate(15); } catch {}
    }
  }

  // Firm pulse on bet confirmation (35ms)
  static betPlaced() {
    if (this.isAvailable()) {
      try { navigator.vibrate(35); } catch {}
    }
  }

  // Double pulse when countdown hits 10s locked state (50ms - 40ms - 50ms)
  static roundLocked() {
    if (this.isAvailable()) {
      try { navigator.vibrate([50, 40, 50]); } catch {}
    }
  }

  // Victory celebration rhythm on winning round (100ms - 50ms - 150ms - 50ms - 200ms)
  static winCelebration() {
    if (this.isAvailable()) {
      try { navigator.vibrate([100, 50, 150, 50, 200]); } catch {}
    }
  }
}
