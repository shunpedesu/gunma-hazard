import Phaser from "phaser";

const PAGES = [
  {
    lines: [
      "君の名前は　たかし。",
      "どこにでもいる　サラリーマン。",
      "",
      "ある日、目を覚ましたら",
      "群馬にいた。",
      "",
      "なぜ？　わからない。",
      "海はある？　ない。",
      "",
      "とにかく群馬にいた。",
    ],
    color: "#ddccff",
  },
  {
    lines: [
      "なんとなく出口を探していると",
      "どこからか声が聞こえた。",
      "",
      "「…群馬から逃げられると",
      "　思うなよ？」",
      "",
      "こんにゃくが　しゃべった。",
    ],
    color: "#ffcccc",
  },
  {
    lines: [
      "⚠️  生き残れ！",
      "",
      "おばけに見つかったらダメ。",
      "タンスに隠れてやり過ごせ！",
      "",
      "クイズに答えて鍵を集め、",
      "ドアを開けて次の部屋へ。",
      "",
      "群馬の知識が　命を救う。",
      "（知らなくても何とかなる）",
    ],
    color: "#ccffcc",
  },
  {
    lines: [
      "📱 スマホ操作",
      "　左の🕹️ で移動",
      "　右ボタン → 調べる / 隠れる",
      "　DASH → 少し速く走れる",
      "",
      "⌨️  PC操作",
      "　WASD / 矢印キー で移動",
      "　スペース / Enter で調べる",
      "",
      "（でも群馬から逃げた人は",
      "　まだ誰もいない）",
    ],
    color: "#ffffcc",
  },
];

export class StoryScene extends Phaser.Scene {
  private pageIndex = 0;
  private isTransitioning = false;
  private overlay!: Phaser.GameObjects.Rectangle;
  private pageContainer!: Phaser.GameObjects.Container;

  constructor() { super({ key: "StoryScene" }); }

  create() {
    const { width, height } = this.scale;

    // 背景
    this.add.rectangle(width / 2, height / 2, width, height, 0x080010);

    // 薄い霧パーティクル
    for (let i = 0; i < 12; i++) {
      const fog = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(30, 100),
        0x220033, 0.08
      );
      this.tweens.add({
        targets: fog,
        x: fog.x + Phaser.Math.Between(-40, 40),
        alpha: { from: 0.03, to: 0.12 },
        duration: Phaser.Math.Between(4000, 8000),
        yoyo: true, repeat: -1,
      });
    }

    // ページコンテナ
    this.pageContainer = this.add.container(0, 0);

    // フェードオーバーレイ
    this.overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000)
      .setDepth(50).setAlpha(1);

    // ページ番号インジケーター（下部ドット）
    this.createDots();

    // タップ/クリック/キーで次へ
    this.input.on("pointerdown", () => this.nextPage());
    this.input.keyboard!.on("keydown-SPACE", () => this.nextPage());
    this.input.keyboard!.on("keydown-ENTER", () => this.nextPage());
    this.input.keyboard!.on("keydown-RIGHT", () => this.nextPage());

    // 最初のページを表示
    this.showPage(0, true);
  }

  private createDots() {
    const { width, height } = this.scale;
    this.pageContainer.removeAll(true);
  }

  private showPage(index: number, instant = false) {
    const { width, height } = this.scale;
    const page = PAGES[index];

    // 既存のコンテンツを消す
    this.pageContainer.removeAll(true);

    // ページ番号
    const pageNum = this.add.text(width - 24, height - 24,
      `${index + 1} / ${PAGES.length}`, {
        fontSize: "13px", color: "#555555",
      }).setOrigin(1, 1);
    this.pageContainer.add(pageNum);

    // 「次へ」ヒント
    const hint = this.add.text(width / 2, height - 28,
      index < PAGES.length - 1 ? "タップして次へ ▶" : "タップしてゲーム開始！", {
        fontSize: "14px", color: "#666688",
      }).setOrigin(0.5, 1);
    this.tweens.add({
      targets: hint, alpha: { from: 0.3, to: 1 },
      duration: 900, yoyo: true, repeat: -1,
    });
    this.pageContainer.add(hint);

    // 横線（区切り）
    const lineTop = this.add.rectangle(width / 2, 56, width * 0.8, 1, 0x443355);
    const lineBot = this.add.rectangle(width / 2, height - 50, width * 0.8, 1, 0x443355);
    this.pageContainer.add([lineTop, lineBot]);

    // 本文テキスト（行ごとにアニメ）
    const startY = height / 2 - (page.lines.length * 28) / 2;
    page.lines.forEach((line, i) => {
      const t = this.add.text(width / 2, startY + i * 28, line, {
        fontSize: line === "" ? "10px" : "18px",
        color: line.startsWith("（") ? "#888888" : page.color,
        fontFamily: "serif",
        stroke: "#000000",
        strokeThickness: line.startsWith("（") ? 2 : 4,
        align: "center",
      }).setOrigin(0.5).setAlpha(0);

      this.pageContainer.add(t);

      this.tweens.add({
        targets: t, alpha: 1,
        duration: instant ? 0 : 300,
        delay: instant ? 0 : 100 + i * 120,
        ease: "Sine.easeOut",
      });
    });

    // ドット更新
    PAGES.forEach((_, di) => {
      const dx = width / 2 + (di - (PAGES.length - 1) / 2) * 20;
      const dot = this.add.circle(dx, 36, di === index ? 5 : 3,
        di === index ? 0xaa88ff : 0x443355);
      this.pageContainer.add(dot);
    });

    // フェードイン
    this.tweens.add({
      targets: this.overlay, alpha: 0,
      duration: instant ? 200 : 400,
      ease: "Power1",
      onComplete: () => { this.isTransitioning = false; },
    });
  }

  private nextPage() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    // フェードアウト
    this.tweens.add({
      targets: this.overlay, alpha: 1,
      duration: 300, ease: "Power1",
      onComplete: () => {
        this.pageIndex++;
        if (this.pageIndex >= PAGES.length) {
          // ゲーム開始
          this.scene.stop();
          this.scene.start("GameScene", { stage: 1 });
        } else {
          this.showPage(this.pageIndex);
        }
      },
    });
  }
}
