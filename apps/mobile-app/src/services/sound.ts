/**
 * Centralized Betting Sound Manager for Apex Arcade
 * Web Audio API Synthesis + Native Female Hostess Voice
 * 100% Offline, Zero Latency, Mobile Autoplay Compliant
 */

export type SoundEffectType =
  | 'bet_now'
  | 'bet_placed'
  | 'bet_closed'
  | 'bet_won'
  | 'bet_lost'
  | 'coin'
  | 'button_click'
  | 'error'
  | 'success'
  | 'notification';

class BettingSoundManager {
  private ctx: AudioContext | null = null;
  private _enabled: boolean = true;
  private isUnlocked: boolean = false;
  private lastSoundTime: Map<string, number> = new Map();
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('apex_sound_enabled');
      this._enabled = stored === null ? true : stored === 'true';

      const unlockAudio = () => {
        this.unlock();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };

      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });

      // Cache SpeechSynthesis voices
      if ('speechSynthesis' in window) {
        const loadVoices = () => {
          try {
            this.voices = window.speechSynthesis.getVoices() || [];
          } catch {}
        };
        loadVoices();
        if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
          window.speechSynthesis.onvoiceschanged = loadVoices;
        }
      }
    }
  }

  public get enabled(): boolean {
    return this._enabled;
  }

  public set enabled(val: boolean) {
    this._enabled = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('apex_sound_enabled', String(val));
    }
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    if (this.isUnlocked) return;
    try {
      const ctx = this.getContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        // Play silent 1-sample buffer to satisfy iOS/Android autoplay policy
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        this.isUnlocked = true;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        this.voices = window.speechSynthesis.getVoices() || [];
      }
    } catch {
      // AudioContext policy suppression
    }
  }

  private shouldRateLimit(key: string, minIntervalMs: number): boolean {
    const now = Date.now();
    const last = this.lastSoundTime.get(key) || 0;
    if (now - last < minIntervalMs) return true;
    this.lastSoundTime.set(key, now);
    return false;
  }

  /**
   * Natural female voice selector for arcade dealer/hostess announcements
   */
  private getFemaleVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    if (!this.voices || this.voices.length === 0) {
      try {
        this.voices = window.speechSynthesis.getVoices() || [];
      } catch {}
    }
    const list = this.voices;
    if (!list || list.length === 0) return null;

    // 1. Natural female named voice (Samantha, Karen, Victoria, Zira, Jenny, Moira, Tessa, etc.)
    const femaleRegex = /(female|woman|samantha|karen|victoria|zira|moira|tessa|veena|lekha|jenny|aria|natasha|sonia|google.*female)/i;
    const female = list.find(v => femaleRegex.test(v.name));
    if (female) return female;

    // 2. High quality Google/Microsoft/Apple English voice
    const naturalEn = list.find(v => (v.lang.startsWith('en-IN') || v.lang.startsWith('en-US') || v.lang.startsWith('en-GB')) && /google|natural|online/i.test(v.name));
    if (naturalEn) return naturalEn;

    // 3. Fallback to any English or primary voice
    const anyEn = list.find(v => v.lang.startsWith('en'));
    return anyEn || list[0] || null;
  }

  /**
   * Speak announcement using female voice (1-2 seconds duration)
   */
  public speak(text: string, priority = true) {
    if (!this._enabled || typeof window === 'undefined') return;
    if (!('speechSynthesis' in window)) return;

    try {
      if (priority) {
        window.speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = this.getFemaleVoice();
      if (voice) {
        utterance.voice = voice;
      }
      // Crisp, energetic arcade hostess delivery (1-2 sec)
      utterance.pitch = 1.18;
      utterance.rate = 1.08;
      utterance.volume = 1.0;

      window.speechSynthesis.speak(utterance);
    } catch {}
  }

  /**
   * 1. bet_now: Upbeat upward arpeggio chime + Female Voice announcement "Bet now!"
   */
  public playBetNow() {
    if (!this._enabled) return;
    try {
      const ctx = this.getContext();
      if (ctx) {
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.06);
          gain.gain.setValueAtTime(0.14, now + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.16);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.18);
        });
      }
    } catch {}

    // Female voice: "Bet now!" (1-2 seconds)
    this.speak('Bet now!');
  }

  /**
   * 2. bet_placed: Metallic coins stacking/dropping on the bet box (COIN SOUND)
   */
  public playBetPlaced() {
    this.playCoin();
  }

  /**
   * 3. bet_closed: Countdown lock bell + Female Voice announcement "Bet closed!"
   */
  public playBetClosed() {
    if (!this._enabled) return;
    try {
      const ctx = this.getContext();
      if (ctx) {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.22);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.28);
      }
    } catch {}

    // Female voice: "Bet closed!" (1-2 seconds)
    this.speak('Bet closed!');
  }

  /**
   * 4. bet_won: Royal celebratory fanfare + Female Voice announcement "XXX won!"
   */
  public playBetWon(cardName?: string) {
    if (!this._enabled) return;
    try {
      const ctx = this.getContext();
      if (ctx) {
        const now = ctx.currentTime;
        // 5-note royal trumpet fanfare: G4 -> C5 -> E5 -> G5 -> C6
        const notes = [
          { freq: 392.0, time: 0, dur: 0.12 },
          { freq: 523.25, time: 0.12, dur: 0.12 },
          { freq: 659.25, time: 0.24, dur: 0.12 },
          { freq: 783.99, time: 0.36, dur: 0.2 },
          { freq: 1046.5, time: 0.56, dur: 0.45 }
        ];

        notes.forEach(({ freq, time, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + time);

          gain.gain.setValueAtTime(0.24, now + time);
          gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + time);
          osc.stop(now + time + dur + 0.02);
        });
      }
    } catch {}

    // Female voice: "XXX won!" (1-2 seconds)
    const announcement = cardName ? `${cardName} won!` : 'You won!';
    this.speak(announcement);
  }

  /**
   * 5. bet_lost: Subtle, respectful, non-jarring low-frequency chime for losses
   */
  public playBetLost() {
    if (!this._enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(329.63, now); // E4
      osc.frequency.linearRampToValueAtTime(261.63, now + 0.28); // C4

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.32);
    } catch {}
  }

  /**
   * 6. coin: Authentic metallic coin clink with multi-harmonic resonance & felt bounce
   */
  public playCoin() {
    if (!this._enabled || this.shouldRateLimit('coin', 30)) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Realistic double coin clink (primary drop + felt micro-bounce)
      const drops = [
        { time: 0, gain: 0.18, freq: 3600 },
        { time: 0.028, gain: 0.11, freq: 4300 }
      ];

      drops.forEach(d => {
        // High overtone impact chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(d.freq, now + d.time);
        osc.frequency.exponentialRampToValueAtTime(d.freq * 0.72, now + d.time + 0.05);

        gain.gain.setValueAtTime(d.gain, now + d.time);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + d.time + 0.07);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + d.time);
        osc.stop(now + d.time + 0.08);

        // Warm metallic ring body
        const ringOsc = ctx.createOscillator();
        const ringGain = ctx.createGain();
        ringOsc.type = 'triangle';
        ringOsc.frequency.setValueAtTime(1920, now + d.time);

        ringGain.gain.setValueAtTime(d.gain * 0.45, now + d.time);
        ringGain.gain.exponentialRampToValueAtTime(0.0001, now + d.time + 0.11);

        ringOsc.connect(ringGain);
        ringGain.connect(ctx.destination);
        ringOsc.start(now + d.time);
        ringOsc.stop(now + d.time + 0.12);
      });
    } catch {}
  }

  /**
   * 7. button_click: Subtle 10-15ms mechanical click for UI taps / buttons
   */
  public playButtonClick() {
    if (!this._enabled || this.shouldRateLimit('click', 50)) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.015);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.025);
    } catch {}
  }

  /**
   * 8. error: Muted double-beep or buzz for invalid actions / insufficient balance
   */
  public playError() {
    if (!this._enabled || this.shouldRateLimit('error', 150)) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      
      [0, 0.09].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, now + offset);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, now + offset);

        gain.gain.setValueAtTime(0.1, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.07);
      });
    } catch {}
  }

  /**
   * 9. success: Pleasant chord resolution for successful actions
   */
  public playSuccess() {
    if (!this._enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // Warm major 3rd/5th chime
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.14, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.25);
      });
    } catch {}
  }

  /**
   * 10. notification: Soft alert bell for live announcements or result draw
   */
  public playNotification() {
    if (!this._enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // Friendly two-tone bell (A5 -> C#6)
      const bells = [
        { freq: 880.0, time: 0 },
        { freq: 1108.73, time: 0.1 }
      ];

      bells.forEach(({ freq, time }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + time);

        gain.gain.setValueAtTime(0.12, now + time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + time);
        osc.stop(now + time + 0.3);
      });
    } catch {}
  }

  // Backward compatibility alias methods
  public playChip() {
    this.playCoin();
  }

  public playTick() {
    this.playNotification();
  }

  public playWin(cardName?: string) {
    this.playBetWon(cardName);
  }
}

export const sound = new BettingSoundManager();
