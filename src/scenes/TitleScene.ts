import Phaser from "phaser";

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

    // ステージ紹介
    const stages = ["STAGE 1: 草津温泉の廃旅館", "STAGE 2: 富岡製糸場の廃墟", "STAGE 3: 赤城山の鬼ヶ島"];
    const colors = ["#ff8888", "#ffcc88", "#88ccff"];
    stages.forEach((s, i) => {
      const t = this.add.text(width / 2, height / 2 + 42 + i * 22, s, {
        fontSize: "13px", color: colors[i], stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 500, delay: 400 + i * 200 });
    });

    const startBtn = this.add.text(width / 2, height / 2 + 128, "[ スタート ]", {
      fontSize: "26px", color: "#ffffff", stroke: "#000000", strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: startBtn, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000)
      .setDepth(100).setAlpha(1);
    this.tweens.add({ targets: overlay, alpha: 0, duration: 800, ease: "Power1" });

    const goStart = () => {
      overlay.setDepth(100).setAlpha(0);
      this.tweens.add({
        targets: overlay, alpha: 1, duration: 500, ease: "Power1",
        onComplete: () => { this.scene.stop(); this.scene.start("GameScene", { stage: 1 }); },
      });
    };

    startBtn.on("pointerover", () => startBtn.setColor("#ffff00"));
    startBtn.on("pointerout",  () => startBtn.setColor("#ffffff"));
    startBtn.on("pointerdown", goStart);

    this.add.text(width / 2, height - 58, "移動: WASD / 矢印キー　調べる: スペース / Enter", {
      fontSize: "13px", color: "#888888",
    }).setOrigin(0.5);
    this.add.text(width / 2, height - 38, "タンスに隠れて鬼から逃げろ！", {
      fontSize: "13px", color: "#888866",
    }).setOrigin(0.5);

    this.input.keyboard!.once("keydown-SPACE", goStart);
    this.input.keyboard!.once("keydown-ENTER", goStart);
  }
}
