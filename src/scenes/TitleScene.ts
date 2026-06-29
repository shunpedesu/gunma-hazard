import Phaser from "phaser";
import { BGMPlayer } from "../objects/BGMPlayer";
import { setDifficulty, type Difficulty } from "../data/difficulty";

export class TitleScene extends Phaser.Scene {
  constructor() { super({ key: "TitleScene" }); }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0010);

    // 霧
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const fog = this.add.circle(x, y, Phaser.Math.Between(20, 80), 0x220033, 0.15);
      this.tweens.add({
        targets: fog,
        x: x + Phaser.Math.Between(-30, 30), y: y + Phaser.Math.Between(-20, 20),
        alpha: { from: 0.05, to: 0.2 },
        duration: Phaser.Math.Between(3000, 6000), yoyo: true, repeat: -1,
      });
    }

    const title = this.add.text(width / 2, height / 2 - 90, "グンマ\nハザード", {
      fontSize: "52px", fontFamily: "serif", color: "#ff2222",
      stroke: "#000000", strokeThickness: 6, align: "center",
      shadow: { offsetX: 3, offsetY: 3, color: "#880000", blur: 8, fill: true },
    }).setOrigin(0.5);
    this.tweens.add({
      targets: title, scaleX: 1.03, scaleY: 1.03,
      duration: 1500, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });

    this.add.text(width / 2, height / 2 + 8, "〜草津・富岡・赤城 呪われた群馬3連戦〜", {
      fontSize: "14px", color: "#ccaacc", stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5);

    // ステージ紹介（クリック可能）
    const stageData = [
      { label: "STAGE 1:  草津温泉の廃旅館", color: "#ff8888", stage: 1 },
      { label: "STAGE 2:  富岡製糸場の廃墟",  color: "#ffcc88", stage: 2 },
      { label: "STAGE 3:  赤城山の鬼ヶ島",   color: "#88ccff", stage: 3 },
    ];
    stageData.forEach(({ label, color, stage }, i) => {
      const t = this.add.text(width / 2, height / 2 + 42 + i * 24, label, {
        fontSize: "13px", color, stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: t, alpha: 1, duration: 500, delay: 400 + i * 200 });
      t.on("pointerover", () => t.setColor("#ffff00").setText(`► ${label}`));
      t.on("pointerout",  () => t.setColor(color).setText(label));
      t.on("pointerdown", () => goTo("GameScene", { stage }));
    });

    const startBtn = this.add.text(width / 2, height / 2 + 130, "[ スタート ]", {
      fontSize: "26px", color: "#ffffff", stroke: "#000000", strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: startBtn, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000)
      .setDepth(100).setAlpha(1);
    this.tweens.add({ targets: overlay, alpha: 0, duration: 800, ease: "Power1" });

    BGMPlayer.playTitle();

    const goTo = (sceneKey: string, sceneData?: object) => {
      overlay.setDepth(100).setAlpha(0);
      this.tweens.add({
        targets: overlay, alpha: 1, duration: 500, ease: "Power1",
        onComplete: () => { this.scene.stop(); this.scene.start(sceneKey, sceneData); },
      });
    };

    startBtn.on("pointerover", () => startBtn.setColor("#ffff00"));
    startBtn.on("pointerout",  () => startBtn.setColor("#ffffff"));
    startBtn.on("pointerdown", () => goTo("StoryScene"));

    // ─── 難易度選択 ──────────────────────────────────────
    let currentDiff: Difficulty = "normal";
    const diffData: { key: Difficulty; label: string; color: string; desc: string }[] = [
      { key: "easy",   label: "かんたん", color: "#88ff88", desc: "3択クイズ" },
      { key: "normal", label: "ふつう",   color: "#ffee88", desc: "4択クイズ" },
      { key: "hard",   label: "むずかしい", color: "#ff8888", desc: "10秒制限" },
    ];
    const diffBtns: Phaser.GameObjects.Text[] = [];
    this.add.text(width / 2, height - 84, "難易度：", {
      fontSize: "12px", color: "#666666",
    }).setOrigin(0.5);
    diffData.forEach(({ key, label, desc }, i) => {
      const btn = this.add.text(width / 2 - 110 + i * 110, height - 66, `${label}\n${desc}`, {
        fontSize: "12px", color: key === "normal" ? "#ffffff" : "#888888",
        stroke: "#000", strokeThickness: 2, align: "center",
        backgroundColor: key === "normal" ? "#333322" : "transparent",
        padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      diffBtns.push(btn);
      btn.on("pointerdown", () => {
        currentDiff = key;
        setDifficulty(key);
        diffBtns.forEach((b, bi) => {
          b.setColor(bi === i ? "#ffffff" : "#888888");
          b.setBackgroundColor(bi === i ? "#333322" : "transparent");
        });
      });
    });
    setDifficulty("normal");

    this.add.text(width / 2, height - 28, "移動: WASD / 矢印キー　調べる: スペース / Enter　タンスに隠れて鬼から逃げろ！", {
      fontSize: "11px", color: "#666666",
    }).setOrigin(0.5);

    this.input.keyboard!.once("keydown-SPACE", () => goTo("StoryScene"));
    this.input.keyboard!.once("keydown-ENTER", () => goTo("StoryScene"));
  }
}
