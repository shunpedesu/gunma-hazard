// 外部ファイル不要の Web Audio BGM エンジン

type Note = { freq: number; dur: number }; // dur = beats

// ─── 曲データ ──────────────────────────────────────────────────────────────

// タイトル／ストーリー用: コミカルホラーワルツ (Am, 3/4, 108 BPM)
const TITLE_MELODY: Note[] = [
  // m1: E D C (下降)
  { freq: 330, dur: 1 }, { freq: 294, dur: 1 }, { freq: 262, dur: 1 },
  // m2: B hold
  { freq: 247, dur: 2 }, { freq: 247, dur: 1 },
  // m3: A hold
  { freq: 220, dur: 3 },
  // m4: A C E (上昇)
  { freq: 220, dur: 1 }, { freq: 262, dur: 1 }, { freq: 330, dur: 1 },
  // m5: G long F (コミカルな高音)
  { freq: 392, dur: 2 }, { freq: 349, dur: 1 },
  // m6: E D C
  { freq: 330, dur: 1 }, { freq: 294, dur: 1 }, { freq: 262, dur: 1 },
  // m7: B long D
  { freq: 247, dur: 2 }, { freq: 294, dur: 1 },
  // m8: A hold → ループ
  { freq: 220, dur: 3 },
];

// oom-pah-pah ベース (8小節 × 3拍)
const TITLE_BASS: Note[] = [
  // m1-4: Am
  { freq: 110, dur: 1 }, { freq: 165, dur: 1 }, { freq: 165, dur: 1 },
  { freq: 110, dur: 1 }, { freq: 165, dur: 1 }, { freq: 165, dur: 1 },
  { freq: 110, dur: 1 }, { freq: 165, dur: 1 }, { freq: 165, dur: 1 },
  { freq: 110, dur: 1 }, { freq: 165, dur: 1 }, { freq: 165, dur: 1 },
  // m5-6: F
  { freq:  87, dur: 1 }, { freq: 131, dur: 1 }, { freq: 131, dur: 1 },
  { freq:  87, dur: 1 }, { freq: 131, dur: 1 }, { freq: 131, dur: 1 },
  // m7: E
  { freq:  82, dur: 1 }, { freq: 123, dur: 1 }, { freq: 123, dur: 1 },
  // m8: Am
  { freq: 110, dur: 1 }, { freq: 165, dur: 1 }, { freq: 165, dur: 1 },
];

// ゲーム中用: 迷宮群馬 (Am, 4/4, 95 BPM) ─ もう少し緊張感あり
const GAME_MELODY: Note[] = [
  // m1
  { freq: 220, dur: 1.5 }, { freq: 262, dur: 0.5 }, { freq: 247, dur: 1 }, { freq:   0, dur: 1 },
  // m2
  { freq: 196, dur: 1.5 }, { freq: 220, dur: 0.5 }, { freq: 165, dur: 2 },
  // m3
  { freq: 220, dur: 1 }, { freq: 262, dur: 0.5 }, { freq: 294, dur: 0.5 }, { freq: 330, dur: 1 }, { freq: 0, dur: 1 },
  // m4
  { freq: 294, dur: 1 }, { freq: 262, dur: 1 }, { freq: 247, dur: 1 }, { freq: 220, dur: 1 },
  // m5 (やや上昇)
  { freq: 262, dur: 1.5 }, { freq: 294, dur: 0.5 }, { freq: 330, dur: 2 },
  // m6
  { freq: 349, dur: 1 }, { freq: 330, dur: 1 }, { freq: 294, dur: 1 }, { freq: 262, dur: 1 },
  // m7
  { freq: 247, dur: 1 }, { freq:   0, dur: 1 }, { freq: 220, dur: 1 }, { freq: 247, dur: 1 },
  // m8
  { freq: 220, dur: 4 },
];

const GAME_BASS: Note[] = [
  // 8小節 × 4拍, root + fifth 刻み
  ...Array(8).fill(null).flatMap(() => [
    { freq: 110, dur: 1 }, { freq: 165, dur: 1 },
    { freq: 110, dur: 1 }, { freq: 165, dur: 1 },
  ]),
];

// ─── BGMPlayer シングルトン ────────────────────────────────────────────────

class BGMPlayerImpl {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private generation = 0;
  private loopTimeout: ReturnType<typeof setTimeout> | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.55;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  // ─── 再生 ─────────────────────────────────────────────────────────────

  /** タイトル／ストーリー BGM */
  playTitle() { this._start(TITLE_MELODY, TITLE_BASS, 108, 3, 0.28, 0.18); }

  /** ゲーム中 BGM */
  playGame()  { this._start(GAME_MELODY, GAME_BASS, 95, 4, 0.22, 0.16); }

  /** 部屋別テンポ（room 0=緩→4=ボス） */
  playGameRoom(room: number) {
    const bpms = [90, 100, 112, 126, 148];
    const gains: [number, number][] = [[0.20,0.14],[0.22,0.15],[0.24,0.17],[0.27,0.19],[0.30,0.20]];
    const r = Math.min(room, 4);
    this._start(GAME_MELODY, GAME_BASS, bpms[r], 4, gains[r][0], gains[r][1]);
  }

  private _start(
    melody: Note[], bass: Note[],
    bpm: number, _beatsPerMeasure: number,
    melGain: number, bassGain: number,
  ) {
    this.stop(0.3);
    const ctx = this.getCtx();
    const gen = ++this.generation;

    this.bgmGain = ctx.createGain();
    this.bgmGain.gain.setValueAtTime(0, ctx.currentTime);
    this.bgmGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
    this.bgmGain.connect(this.masterGain!);

    const beat = 60 / bpm;
    const scheduleNow = (startTime: number) => {
      if (gen !== this.generation) return;
      const loopDur = this._scheduleTrack(melody, "triangle", melGain, beat, startTime)
      this._scheduleTrack(bass, "sine", bassGain, beat, startTime);

      this.loopTimeout = setTimeout(() => {
        scheduleNow(startTime + loopDur);
      }, Math.max(50, (loopDur - 0.25) * 1000));
    };

    scheduleNow(ctx.currentTime + 0.05);
  }

  /** 音符列をスケジュールし、ループ長(秒)を返す */
  private _scheduleTrack(
    notes: Note[],
    type: OscillatorType,
    gainVal: number,
    beat: number,
    startTime: number,
  ): number {
    const ctx = this.getCtx();
    const bgmGain = this.bgmGain;
    if (!bgmGain) return 0;

    let t = startTime;
    for (const { freq, dur } of notes) {
      if (freq > 0) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        const noteDur = dur * beat * 0.82;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gainVal, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t + noteDur);
        osc.connect(g);
        g.connect(bgmGain);
        osc.start(t);
        osc.stop(t + noteDur);
      }
      t += dur * beat;
    }
    return t - startTime;
  }

  // ─── 停止 ─────────────────────────────────────────────────────────────

  stop(fadeTime = 0.8) {
    this.generation++;
    if (this.loopTimeout) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }
    if (this.bgmGain && this.ctx) {
      const g = this.bgmGain;
      g.gain.cancelScheduledValues(this.ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeTime);
      this.bgmGain = null;
      setTimeout(() => { try { g.disconnect(); } catch {} }, (fadeTime + 0.1) * 1000);
    }
  }

  /** 音量 0〜1 */
  setVolume(v: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(v * 0.55, this.ctx.currentTime);
    }
  }
}

export const BGMPlayer = new BGMPlayerImpl();
