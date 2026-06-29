import Phaser from "phaser";
import { STAGE_CONFIGS } from "../data/gunma-data";

export class ClearScene extends Phaser.Scene {
  constructor() { super({ key: "ClearScene" }); }

  create(data?: { deathCount?: number; stage?: number; elapsedMs?: number }) {
    const { width, height } = this.scale;
    const deathCount = data?.deathCount ?? 0;
    const stage = data?.stage ?? 1;
    const elapsedMs = data?.elapsedMs ?? 0;
    const bestKey = `gunma_best_stage${stage}`;
    const prevBest = parseInt(localStorage.getItem(bestKey) ?? "0", 10);
    const isNewBest = elapsedMs > 0 && (prevBest === 0 || elapsedMs < prevBest);
    if (isNewBest) localStorage.setItem(bestKey, String(elapsedMs));
    const fmtTime = (ms: number) => {
      const m = Math.floor(ms / 60000).toString().padStart(2, "0");
      const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
      return `${m}:${s}`;
    };
    const isFinalStage = stage >= 3;
    const cfg = STAGE_CONFIGS[stage - 1];

    this.cameras.main.setBackgroundColor(isFinalStage ? 0x0a1a0a : 0x0a0a1a);

    // 星
    for (let i = 0; i < 60; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, width), Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 3), 0xffffff, Phaser.Math.FloatBetween(0.2, 0.9)
      );
      this.tweens.add({
        targets: star, alpha: 0.1,
        duration: Phaser.Math.Between(800, 2500),
        yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }

    // タイトル
    const titleStr = isFinalStage ? "🎊 全ステージ クリア！！ 🎊" : `STAGE ${stage} CLEAR!`;
    const clearText = this.add.text(width / 2, height / 2 - 130, titleStr, {
      fontSize: isFinalStage ? "38px" : "52px",
      fontFamily: "serif",
      color: isFinalStage ? "#ffd700" : "#88ffaa",
      stroke: "#004400",
      strokeThickness: 7,
      shadow: { offsetX: 3, offsetY: 3, color: "#003300", blur: 10, fill: true },
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({
      targets: clearText, alpha: 1,
      scaleX: { from: 0.5, to: 1 }, scaleY: { from: 0.5, to: 1 },
      duration: 800, ease: "Back.easeOut",
    });

    // サブタイトル
    const sub = this.add.text(width / 2, height / 2 - 82, `【${cfg.subtitle}】 脱出成功！`, {
      fontSize: "16px", color: "#ccffcc",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 700 });

    // クリアメッセージ
    cfg.clearMessage.split("\n").forEach((line, i) => {
      const t = this.add.text(width / 2, height / 2 - 46 + i * 26, line, {
        fontSize: "15px", color: "#ffffff",
        stroke: "#000000", strokeThickness: 3, align: "center",
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, y: t.y - 5, duration: 600, delay: 900 + i * 200, ease: "Sine.easeOut" });
    });

    // 全クリア専用メッセージ
    if (isFinalStage) {
      const finalMsg = this.add.text(width / 2, height / 2 + 38, "群馬県より：「また来てね★」", {
        fontSize: "18px", color: "#ffd700",
        stroke: "#000000", strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: finalMsg, alpha: 1, duration: 600, delay: 1800 });
    }

    // E2: クリアタイム
    if (elapsedMs > 0) {
      const timeStr = isNewBest
        ? `⏱ クリアタイム: ${fmtTime(elapsedMs)}  🏅 ベスト更新！`
        : `⏱ クリアタイム: ${fmtTime(elapsedMs)}  (ベスト: ${fmtTime(prevBest)})`;
      const timeObj = this.add.text(width / 2, height - 126, timeStr, {
        fontSize: "14px", color: isNewBest ? "#ffd700" : "#88ffcc",
        stroke: "#000000", strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0).setDepth(5);
      this.tweens.add({ targets: timeObj, alpha: 1, duration: 600, delay: 2600 });
    }

    // 死亡評価
    const evalStr = deathCount === 0 ? "🏆 一度もやられず！完璧な冒険！" :
                    deathCount <= 3  ? `💪 ${deathCount}回やられて見事クリア！` :
                    deathCount <= 8  ? `😅 ${deathCount}回も…でもクリア！` :
                                       `💀 ${deathCount}回やられてようやく…`;
    const evalObj = this.add.text(width / 2, height - 100, evalStr, {
      fontSize: "15px", color: "#ffee88",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0).setDepth(5);
    this.tweens.add({ targets: evalObj, alpha: 1, duration: 600, delay: 2800 });

    // フェードインオーバーレイ
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000)
      .setDepth(100).setAlpha(1);
    this.tweens.add({ targets: overlay, alpha: 0, duration: 1200, ease: "Power1" });

    const goTo = (key: string, sceneData?: object) => {
      overlay.setDepth(100).setAlpha(0);
      this.tweens.add({
        targets: overlay, alpha: 1, duration: 500, ease: "Power1",
        onComplete: () => { this.scene.stop(); this.scene.start(key, sceneData); },
      });
    };

    // ボタン
    const btnY = height - 65;

    if (!isFinalStage) {
      // 次のステージへ
      const nextBtn = this.add.text(width / 2, btnY, `[ ステージ ${stage + 1} へ！ ]`, {
        fontSize: "24px", color: "#88ff88",
        stroke: "#000000", strokeThickness: 4,
      }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: nextBtn, alpha: 1, duration: 600, delay: 3000 });
      // 点滅
      this.tweens.add({ targets: nextBtn, alpha: 0.3, duration: 500, yoyo: true, repeat: -1, delay: 3600 });

      nextBtn.on("pointerover", () => nextBtn.setColor("#ffffff"));
      nextBtn.on("pointerout",  () => nextBtn.setColor("#88ff88"));
      nextBtn.on("pointerdown", () => goTo("GameScene", { stage: stage + 1 }));
      this.input.keyboard!.once("keydown-ENTER", () => goTo("GameScene", { stage: stage + 1 }));
      this.input.keyboard!.once("keydown-SPACE", () => goTo("GameScene", { stage: stage + 1 }));

      // タイトルへ（小さめ）
      const titleBtn = this.add.text(width - 20, btnY, "[ タイトルへ ]", {
        fontSize: "16px", color: "#888888",
        stroke: "#000000", strokeThickness: 2,
      }).setOrigin(1, 0.5).setAlpha(0).setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: titleBtn, alpha: 1, duration: 600, delay: 3200 });
      titleBtn.on("pointerover", () => titleBtn.setColor("#ffff00"));
      titleBtn.on("pointerout",  () => titleBtn.setColor("#888888"));
      titleBtn.on("pointerdown", () => goTo("TitleScene"));
    } else {
      // 全クリア後：もう一度 / タイトルへ
      const retryBtn = this.add.text(width / 2 - 90, btnY, "[ もう一度 ]", {
        fontSize: "22px", color: "#ffffff",
        stroke: "#000000", strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });
      const titleBtn = this.add.text(width / 2 + 90, btnY, "[ タイトルへ ]", {
        fontSize: "22px", color: "#aaaaaa",
        stroke: "#000000", strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: [retryBtn, titleBtn], alpha: 1, duration: 600, delay: 3200 });

      retryBtn.on("pointerover", () => retryBtn.setColor("#ffff00"));
      retryBtn.on("pointerout",  () => retryBtn.setColor("#ffffff"));
      retryBtn.on("pointerdown", () => goTo("GameScene", { stage: 1 }));

      titleBtn.on("pointerover", () => titleBtn.setColor("#ffff00"));
      titleBtn.on("pointerout",  () => titleBtn.setColor("#aaaaaa"));
      titleBtn.on("pointerdown", () => goTo("TitleScene"));
    }

    // 花火（全クリアはより派手に）
    const fireworkCount = isFinalStage ? 30 : 14;
    this.time.addEvent({ delay: 400, repeat: fireworkCount, callback: () => this.spawnFirework() });
  }

  private spawnFirework() {
    const { width, height } = this.scale;
    const cx = Phaser.Math.Between(80, width - 80);
    const cy = Phaser.Math.Between(60, height / 2);
    const color = Phaser.Utils.Array.GetRandom([
      0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xffd700,
    ]) as number;
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const dist = Phaser.Math.Between(40, 90);
      const p = this.add.circle(cx, cy, Phaser.Math.Between(2, 5), color, 1).setDepth(10);
      this.tweens.add({
        targets: p,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: Phaser.Math.Between(600, 1000), ease: "Power2",
        onComplete: () => p.destroy(),
      });
    }
  }
}
