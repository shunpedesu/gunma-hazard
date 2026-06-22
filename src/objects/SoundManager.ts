// Web Audio API を使ったサウンドエンジン（外部ファイル不要）
export class SoundManager {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private footstepTimeout: ReturnType<typeof setTimeout> | null = null;
  private ambientOsc: OscillatorNode | null = null;

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  // ─── 基本波形生成 ───────────────────────────────────
  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    gainVal = 0.3,
    delay = 0
  ) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, this.ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(gainVal, this.ctx.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(this.ctx.currentTime + delay);
    osc.stop(this.ctx.currentTime + delay + duration);
  }

  private playNoise(duration: number, gainVal = 0.2, cutoff = 2000, delay = 0) {
    const bufSize = this.ctx.sampleRate * duration;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(this.ctx.currentTime + delay);
  }

  // ─── ゲームサウンド ──────────────────────────────────

  /** アイテム取得音 */
  pickup() {
    this.resume();
    this.playTone(523, 0.12, "sine", 0.25);
    this.playTone(659, 0.12, "sine", 0.25, 0.1);
    this.playTone(784, 0.2, "sine", 0.25, 0.2);
  }

  /** ドアを開く音 */
  doorOpen() {
    this.resume();
    this.playNoise(0.4, 0.15, 800);
    this.playTone(180, 0.4, "sawtooth", 0.1, 0.05);
  }

  /** 足音（プレイヤー移動中） */
  footstep() {
    this.resume();
    this.playNoise(0.06, 0.08, 400);
    this.playTone(80, 0.05, "sine", 0.06);
  }

  /** ジャンプスケア（捕まった） */
  jumpScare() {
    this.resume();
    // 低音ドーン
    this.playTone(40, 1.5, "sawtooth", 0.6);
    this.playTone(50, 1.5, "sawtooth", 0.5, 0.02);
    // 甲高い悲鳴ノイズ
    this.playNoise(0.3, 0.5, 8000);
    this.playNoise(0.3, 0.4, 6000, 0.1);
  }

  /** タンスに隠れる音 */
  hide() {
    this.resume();
    this.playNoise(0.3, 0.1, 300);
    this.playTone(130, 0.3, "sine", 0.08, 0.1);
  }

  /** クイズ正解音 */
  correct() {
    this.resume();
    [0, 0.1, 0.2, 0.3].forEach((d, i) => {
      this.playTone([523, 659, 784, 1047][i], 0.15, "sine", 0.2, d);
    });
  }

  /** クイズ不正解音 */
  wrong() {
    this.resume();
    this.playTone(200, 0.3, "sawtooth", 0.3);
    this.playTone(150, 0.4, "sawtooth", 0.3, 0.15);
  }

  /** ゲームクリア音 */
  clear() {
    this.resume();
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((n, i) => this.playTone(n, 0.3, "sine", 0.25, i * 0.12));
  }

  /** 敵発見音（ドキドキ） */
  enemySpot() {
    this.resume();
    this.playTone(220, 0.2, "sawtooth", 0.3);
    this.playTone(165, 0.3, "sawtooth", 0.3, 0.15);
  }

  /** 心拍音（敵が近い） */
  startHeartbeat(bpm = 80) {
    this.stopHeartbeat();
    const interval = (60 / bpm) * 1000;
    this.heartbeatInterval = setInterval(() => {
      this.resume();
      this.playTone(60, 0.08, "sine", 0.25);
      this.playTone(55, 0.06, "sine", 0.2, 0.1);
    }, interval);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /** 環境音（ループ） */
  startAmbient() {
    this.resume();
    if (this.ambientOsc) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.value = 55;
    filter.type = "lowpass";
    filter.frequency.value = 200;
    gain.gain.value = 0.04;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    this.ambientOsc = osc;
  }

  stopAmbient() {
    if (this.ambientOsc) {
      this.ambientOsc.stop();
      this.ambientOsc = null;
    }
  }

  /** 足音の間隔管理 */
  scheduleFootstep(isMoving: boolean) {
    if (!isMoving) return;
    if (this.footstepTimeout) return;
    this.footstep();
    this.footstepTimeout = setTimeout(() => {
      this.footstepTimeout = null;
    }, 320);
  }

  destroy() {
    this.stopHeartbeat();
    this.stopAmbient();
    if (this.footstepTimeout) clearTimeout(this.footstepTimeout);
    this.ctx.close();
  }
}
