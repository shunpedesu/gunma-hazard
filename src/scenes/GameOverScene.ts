import Phaser from "phaser";
import { STAGE_GAMEOVER_MESSAGES, STAGE_CONFIGS } from "../data/gunma-data";

export class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: "GameOverScene" }); }

  create(data?: { deathCount?: number; stage?: number }) {
    const { width, height } = this.scale;
    const deathCount = data?.deathCount ?? 0;
    const stage = data?.stage ?? 1;
    const cfg = STAGE_CONFIGS[stage - 1];

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000);
    const flash = this.add.rectangle(width / 2, height / 2, width, height, 0x440000);
    this.tweens.add({ targets: flash, alpha: 0, duration: 1200, ease: "Power2" });

    const titles = ["つかまった…", "またつかまった…", "何度つかまるんだ…", "群馬を甘く見るな！", "もう諦めろ。"];
    const titleIdx = Math.min(deathCount - 1, titles.length - 1);
    const titleText = deathCount > 0 ? titles[Math.max(0, titleIdx)] : "つかまった…";

    this.add.text(width / 2, height / 2 - 108, titleText, {
      fontSize: "36px", fontFamily: "serif",
      color: "#ff2222", stroke: "#000000", strokeThickness: 5,
    }).setOrigin(0.5);

    // 敵の名前
    this.add.text(width / 2, height / 2 - 68, `「${cfg.enemyName}」にやられた！`, {
      fontSize: "15px", color: "#ff8888", stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5);

    const msgs = STAGE_GAMEOVER_MESSAGES[stage - 1];
    const msg = Phaser.Utils.Array.GetRandom(msgs) as string;
    this.add.text(width / 2, height / 2 - 35, `「${msg}」`, {
      fontSize: "17px", color: "#ffcccc", stroke: "#000000", strokeThickness: 3,
      wordWrap: { width: width - 60 }, align: "center",
    }).setOrigin(0.5);

    if (deathCount > 0) {
      const countColor = deathCount >= 5 ? "#ff4444" : deathCount >= 3 ? "#ffaa44" : "#aaaaaa";
      this.add.text(width / 2, height / 2 + 16, `💀 通算死亡 ${deathCount} 回`, {
        fontSize: "14px", color: countColor, stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5);
    }

    // ステージ表示
    this.add.text(width / 2, height / 2 + 38, `【${cfg.subtitle}】`, {
      fontSize: "13px", color: "#888888", stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5);

    const hints = [
      "💡 タンスに隠れれば鬼をやり過ごせる",
      "💡 Shiftキーでダッシュ！でもスタミナに注意",
      "💡 クイズ中は鬼が止まる！落ち着いて答えよう",
      "💡 怪しいと思ったらすぐタンスへ",
      "💡 上毛かるたを覚えればクイズは楽勝",
    ];
    this.add.text(width / 2, height / 2 + 58, Phaser.Utils.Array.GetRandom(hints) as string, {
      fontSize: "13px", color: "#888866", stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5);

    // フェードイン
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000)
      .setDepth(100).setAlpha(1);
    this.tweens.add({ targets: overlay, alpha: 0, duration: 600, ease: "Power1" });

    const retryBtn = this.add.text(width / 2 - 85, height / 2 + 90, "[ もう一度 ]", {
      fontSize: "22px", color: "#ffffff", stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const titleBtn = this.add.text(width / 2 + 85, height / 2 + 90, "[ タイトルへ ]", {
      fontSize: "22px", color: "#aaaaaa", stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const goTo = (key: string, sceneData?: object) => {
      overlay.setDepth(100).setAlpha(0);
      this.tweens.add({
        targets: overlay, alpha: 1, duration: 400, ease: "Power1",
        onComplete: () => { this.scene.stop(); this.scene.start(key, sceneData); },
      });
    };

    retryBtn.on("pointerover", () => retryBtn.setColor("#ffff00"));
    retryBtn.on("pointerout",  () => retryBtn.setColor("#ffffff"));
    retryBtn.on("pointerdown", () => goTo("GameScene", { stage }));

    titleBtn.on("pointerover", () => titleBtn.setColor("#ffff00"));
    titleBtn.on("pointerout",  () => titleBtn.setColor("#aaaaaa"));
    titleBtn.on("pointerdown", () => goTo("TitleScene"));

    this.input.keyboard!.once("keydown-ENTER", () => goTo("GameScene", { stage }));
  }
}
