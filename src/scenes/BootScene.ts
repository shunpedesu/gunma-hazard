import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: "BootScene" }); }

  preload() {
    const { width, height } = this.scale;
    const loadingText = this.add.text(width / 2, height / 2 - 20, "ロード中...", {
      fontSize: "20px", color: "#ffffff",
    }).setOrigin(0.5);
    const bar = this.add.rectangle(width / 2 - 150, height / 2 + 20, 0, 16, 0xff4444);
    const barBg = this.add.rectangle(width / 2, height / 2 + 20, 300, 16, 0x333333).setOrigin(0.5);
    barBg.setDepth(0); bar.setDepth(1);
    this.load.on("progress", (v: number) => { bar.width = 300 * v; bar.x = width / 2 - 150; });
    this.load.on("complete", () => loadingText.destroy());
  }

  create() {
    this.createSprites();
    this.scene.start("TitleScene");
  }

  private createSprites() {
    // ─── プレイヤー（サラリーマン タカシ）──────────────────
    if (!this.textures.exists("player")) {
      const g = this.add.graphics();
      const p = (color: number, x: number, y: number, w: number, h: number) => {
        g.fillStyle(color); g.fillRect(x, y, w, h);
      };
      // 黒髪
      p(0x111111, 10, 0, 12, 3);
      p(0x111111, 8,  1, 16, 5);
      p(0x111111, 8,  0,  3, 7);
      p(0x111111, 21, 0,  3, 7);
      // 顔（肌色）
      p(0xF0C080, 9,  3, 14, 10);
      // 目
      p(0x3a2a10, 11, 6,  2,  2);
      p(0x3a2a10, 19, 6,  2,  2);
      // 口
      p(0xCC7755, 13, 10,  6,  1);
      // 白シャツ（襟元）
      p(0xEEEEEE, 11, 13,  4,  3);
      p(0xEEEEEE, 17, 13,  4,  3);
      // ネクタイ（赤）
      p(0xDD2222, 14, 13,  4,  10);
      p(0xCC1111, 15, 23,  2,  3);
      // 紺スーツ（上着）
      p(0x1a3060, 8,  13, 16, 13);
      p(0x1a3060, 8,  13,  4, 13); // 左ラペル
      p(0x1a3060, 20, 13,  4, 13); // 右ラペル
      // 腕（スーツ袖）
      p(0x1a3060, 4,  14,  5, 10);
      p(0x1a3060, 23, 14,  5, 10);
      // 手（肌色）
      p(0xF0C080, 4,  24,  4,  3);
      p(0xF0C080, 24, 24,  4,  3);
      // ズボン（紺）
      p(0x15254d, 9,  26,  6, 10);
      p(0x15254d, 17, 26,  6, 10);
      // 靴（黒）
      p(0x111111, 8,  34,  7,  3);
      p(0x111111, 17, 34,  7,  3);
      g.generateTexture("player", 32, 37); g.destroy();
    }

    // ─── 敵：こんにゃくおばけ（ステージ1）───────────────
    if (!this.textures.exists("enemy_konnyaku")) {
      const g = this.add.graphics();
      // こんにゃくの体（灰紫色の四角っぽいブロック）
      g.fillStyle(0x7755aa);
      g.fillRoundedRect(2, 6, 32, 32, 6);
      // 表面のブツブツ（こんにゃく感）
      g.fillStyle(0x9977cc);
      g.fillCircle(8, 10, 3); g.fillCircle(16, 8, 3); g.fillCircle(24, 10, 3);
      g.fillCircle(6, 20, 2); g.fillCircle(28, 20, 2);
      // 恐怖の目
      g.fillStyle(0xffffff);
      g.fillEllipse(11, 18, 10, 12); g.fillEllipse(25, 18, 10, 12);
      g.fillStyle(0xff0000);
      g.fillEllipse(12, 19, 5, 7); g.fillEllipse(26, 19, 5, 7);
      g.fillStyle(0x000000);
      g.fillCircle(13, 20, 2); g.fillCircle(27, 20, 2);
      // 口
      g.fillStyle(0x220011);
      g.fillRect(12, 30, 12, 3);
      g.fillStyle(0xffffff);
      g.fillTriangle(13, 30, 16, 27, 19, 30);
      g.fillTriangle(19, 30, 22, 27, 25, 30);
      g.generateTexture("enemy_konnyaku", 36, 42); g.destroy();
    }

    // ─── 敵：だるまおばけ（ステージ2）───────────────────
    if (!this.textures.exists("enemy_daruma")) {
      const g = this.add.graphics();
      // 赤い丸いだるまの体
      g.fillStyle(0xcc2222);
      g.fillEllipse(20, 22, 36, 40);
      // 白い眉毛（だるまっぽく）
      g.fillStyle(0xffffff);
      g.fillEllipse(11, 12, 14, 6); g.fillEllipse(29, 12, 14, 6);
      // 恐怖の目（白く光る）
      g.fillStyle(0xffffcc);
      g.fillEllipse(12, 16, 10, 13); g.fillEllipse(28, 16, 10, 13);
      g.fillStyle(0x000000);
      g.fillEllipse(13, 17, 6, 9); g.fillEllipse(29, 17, 6, 9);
      g.fillStyle(0xff4444);
      g.fillCircle(14, 18, 2); g.fillCircle(30, 18, 2);
      // 白いひげ
      g.fillStyle(0xffffff);
      g.fillEllipse(20, 34, 20, 8);
      // 黒い口
      g.fillStyle(0x110000);
      g.fillEllipse(20, 30, 14, 6);
      g.generateTexture("enemy_daruma", 40, 44); g.destroy();
    }

    // ─── 敵：かるた怨霊（ステージ3）─────────────────────
    if (!this.textures.exists("enemy_karuta")) {
      const g = this.add.graphics();
      // かるたの札の形（白い長方形）
      g.fillStyle(0xeeeeff);
      g.fillRoundedRect(2, 0, 32, 40, 3);
      g.lineStyle(2, 0x8888ff, 1);
      g.strokeRoundedRect(2, 0, 32, 40, 3);
      // 「鶴」の文字っぽい装飾
      g.fillStyle(0x3333cc);
      g.fillRect(14, 4, 8, 2); g.fillRect(14, 4, 2, 8);
      g.fillRect(20, 4, 2, 8); g.fillRect(14, 10, 8, 2);
      g.fillRect(10, 14, 16, 2); g.fillRect(17, 14, 2, 6);
      // 恐怖の目（浮かんでいる感）
      g.fillStyle(0xff3333);
      g.fillEllipse(13, 28, 9, 11); g.fillEllipse(25, 28, 9, 11);
      g.fillStyle(0xffff00);
      g.fillEllipse(13, 28, 5, 7); g.fillEllipse(25, 28, 5, 7);
      g.fillStyle(0x000000);
      g.fillCircle(14, 29, 2); g.fillCircle(26, 29, 2);
      // 幽霊っぽい底
      g.fillStyle(0xeeeeff);
      g.fillRect(2, 36, 32, 8);
      for (let i = 0; i < 4; i++) {
        g.fillTriangle(2 + i * 8, 44, 6 + i * 8, 38, 10 + i * 8, 44);
      }
      g.generateTexture("enemy_karuta", 36, 48); g.destroy();
    }

    // ─── アイテム：やきまんじゅう型の鍵 ─────────────────
    if (!this.textures.exists("item_yakimanjuu")) {
      const g = this.add.graphics();
      // まんじゅうの丸い部分
      g.fillStyle(0x8b4513);
      g.fillEllipse(12, 14, 22, 20);
      // 焦げ目
      g.fillStyle(0x5c2d0a);
      g.fillEllipse(10, 12, 14, 10);
      g.fillCircle(16, 9, 4);
      // 串（鍵の柄）
      g.fillStyle(0x8b6914);
      g.fillRect(20, 16, 12, 4);
      g.fillRect(28, 12, 4, 4); g.fillRect(28, 20, 4, 4);
      // 照り感
      g.fillStyle(0xc86418, 0.6);
      g.fillEllipse(9, 10, 8, 6);
      g.generateTexture("item_yakimanjuu", 34, 28); g.destroy();
    }

    // ─── アイテム：まゆだま ───────────────────────────────
    if (!this.textures.exists("item_mayudama")) {
      const g = this.add.graphics();
      // 繭の白い楕円
      g.fillStyle(0xfff8f0);
      g.fillEllipse(16, 18, 28, 22);
      // 繭の縦線（糸感）
      g.lineStyle(1, 0xddccbb, 0.8);
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(6 + i * 5, 8); g.lineTo(4 + i * 5, 28);
        g.strokePath();
      }
      // 光沢
      g.fillStyle(0xffffff, 0.7);
      g.fillEllipse(10, 13, 8, 5);
      g.generateTexture("item_mayudama", 32, 36); g.destroy();
    }

    // ─── アイテム：護符 ───────────────────────────────────
    if (!this.textures.exists("item_ofuda")) {
      const g = this.add.graphics();
      // 護符の紙（白い長方形）
      g.fillStyle(0xfffde7);
      g.fillRect(6, 0, 20, 32);
      g.lineStyle(1, 0xccaa66, 1);
      g.strokeRect(6, 0, 20, 32);
      // 赤い文字っぽい模様
      g.fillStyle(0xcc2200);
      g.fillRect(14, 4, 4, 3); g.fillRect(12, 9, 8, 2);
      g.fillRect(14, 13, 4, 3); g.fillRect(12, 18, 8, 2);
      g.fillRect(14, 22, 4, 3); g.fillRect(11, 27, 10, 2);
      // 上部の折り返し
      g.fillStyle(0xffe082);
      g.fillRect(6, 0, 20, 5);
      g.generateTexture("item_ofuda", 32, 36); g.destroy();
    }

    // ─── アイテム：勾玉 ──────────────────────────────────
    if (!this.textures.exists("item_magatama_red")) {
      const g = this.add.graphics();
      g.fillStyle(0xcc2244);
      g.fillCircle(14, 14, 12);
      g.fillStyle(0xcc2244);
      g.fillTriangle(14, 26, 26, 14, 28, 28);
      g.fillCircle(26, 22, 4);
      g.fillStyle(0xff6688, 0.6);
      g.fillCircle(10, 10, 5);
      g.lineStyle(1, 0x881122, 1);
      g.strokeCircle(14, 14, 12);
      g.generateTexture("item_magatama_red", 32, 32); g.destroy();
    }
    if (!this.textures.exists("item_magatama_blue")) {
      const g = this.add.graphics();
      g.fillStyle(0x224488);
      g.fillCircle(14, 14, 12);
      g.fillStyle(0x224488);
      g.fillTriangle(14, 26, 26, 14, 28, 28);
      g.fillCircle(26, 22, 4);
      g.fillStyle(0x6688ff, 0.6);
      g.fillCircle(10, 10, 5);
      g.lineStyle(1, 0x112244, 1);
      g.strokeCircle(14, 14, 12);
      g.generateTexture("item_magatama_blue", 32, 32); g.destroy();
    }

    // ─── アイテム：だるま（ステージ1起点） ───────────────
    if (!this.textures.exists("item_daruma")) {
      const g = this.add.graphics();
      g.fillStyle(0xdd2222); g.fillEllipse(16, 18, 28, 32);
      g.fillStyle(0xffffff); g.fillEllipse(16, 13, 18, 14);
      g.fillStyle(0x000000);
      g.fillEllipse(11, 12, 5, 6); g.fillEllipse(21, 12, 5, 6);
      g.generateTexture("item_daruma", 32, 36); g.destroy();
    }

    // ─── アイテム：ネギ ───────────────────────────────────
    if (!this.textures.exists("item_negi")) {
      const g = this.add.graphics();
      g.fillStyle(0x228822); g.fillRect(13, 0, 6, 20);
      g.fillStyle(0xeeeebb); g.fillRect(11, 20, 10, 18);
      g.fillStyle(0x99cc55);
      g.fillEllipse(5, 6, 12, 8); g.fillEllipse(10, 2, 10, 7);
      g.generateTexture("item_negi", 32, 38); g.destroy();
    }

    // ─── タンス ───────────────────────────────────────────
    if (!this.textures.exists("closet")) {
      const g = this.add.graphics();
      g.fillStyle(0x8B6914); g.fillRect(0, 0, 48, 64);
      g.fillStyle(0x6B4F10); g.fillRect(4, 4, 40, 56);
      g.fillStyle(0xA07820);
      g.fillRect(8, 8, 14, 44); g.fillRect(26, 8, 14, 44);
      g.fillStyle(0xffd700);
      g.fillCircle(19, 30, 3); g.fillCircle(33, 30, 3);
      g.generateTexture("closet", 48, 64); g.destroy();
    }

    // ─── ドア ─────────────────────────────────────────────
    if (!this.textures.exists("door")) {
      const g = this.add.graphics();
      g.fillStyle(0x5c3a10); g.fillRect(4, 0, 24, 32);
      g.fillStyle(0xffd700); g.fillCircle(24, 16, 3);
      g.generateTexture("door", 32, 32); g.destroy();
    }

    // ─── 緑の鍵（3色目） ─────────────────────────────────
    if (!this.textures.exists("item_yakimanjuu_green")) {
      const g = this.add.graphics();
      g.fillStyle(0x228844); g.fillEllipse(12, 14, 22, 20);
      g.fillStyle(0x115522); g.fillEllipse(10, 12, 14, 10); g.fillCircle(16, 9, 4);
      g.fillStyle(0x336622); g.fillRect(20, 16, 12, 4);
      g.fillRect(28, 12, 4, 4); g.fillRect(28, 20, 4, 4);
      g.fillStyle(0x44cc66, 0.6); g.fillEllipse(9, 10, 8, 6);
      g.generateTexture("item_yakimanjuu_green", 34, 28); g.destroy();
    }
    if (!this.textures.exists("item_magatama_green")) {
      const g = this.add.graphics();
      g.fillStyle(0x228833); g.fillCircle(14, 14, 12);
      g.fillStyle(0x228833); g.fillTriangle(14, 26, 26, 14, 28, 28);
      g.fillCircle(26, 22, 4);
      g.fillStyle(0x55ee88, 0.6); g.fillCircle(10, 10, 5);
      g.lineStyle(1, 0x114422, 1); g.strokeCircle(14, 14, 12);
      g.generateTexture("item_magatama_green", 32, 32); g.destroy();
    }
    if (!this.textures.exists("item_silk_green")) {
      const g = this.add.graphics();
      g.fillStyle(0x33aa55); g.fillEllipse(16, 18, 28, 22);
      g.lineStyle(1, 0x55cc77, 0.8);
      for (let i = 0; i < 5; i++) {
        g.beginPath(); g.moveTo(6 + i * 5, 8); g.lineTo(4 + i * 5, 28); g.strokePath();
      }
      g.fillStyle(0xaaffbb, 0.7); g.fillEllipse(10, 13, 8, 5);
      g.generateTexture("item_silk_green", 32, 36); g.destroy();
    }

    // ─── ボス祠（封印の石碑） ─────────────────────────────
    if (!this.textures.exists("boss_shrine")) {
      const g = this.add.graphics();
      g.fillStyle(0x442244); g.fillRect(4, 0, 32, 42);
      g.fillStyle(0x552255); g.fillRect(6, 2, 28, 36);
      g.lineStyle(2, 0xaa44aa, 0.9); g.strokeRect(6, 2, 28, 36);
      // 紋様
      g.fillStyle(0xff44ff, 0.7);
      g.fillRect(18, 6, 4, 12); g.fillRect(12, 10, 16, 4);
      g.fillRect(16, 22, 8, 8);
      // 台座
      g.fillStyle(0x331133); g.fillRect(0, 38, 40, 8);
      g.generateTexture("boss_shrine", 40, 46); g.destroy();
    }

    // ─── 鍵（汎用） ──────────────────────────────────────
    if (!this.textures.exists("item_key")) {
      const g = this.add.graphics();
      g.fillStyle(0xffd700);
      g.fillCircle(10, 10, 8);
      g.fillStyle(0x1a1020); g.fillCircle(10, 10, 4);
      g.fillStyle(0xffd700);
      g.fillRect(15, 8, 14, 4);
      g.fillRect(23, 12, 4, 4); g.fillRect(19, 12, 4, 4);
      g.generateTexture("item_key", 32, 24); g.destroy();
    }

    // ─── 暗号メモ ─────────────────────────────────────────
    if (!this.textures.exists("item_cipher")) {
      const g = this.add.graphics();
      g.fillStyle(0xfffde7); g.fillRect(0, 2, 26, 32);
      g.lineStyle(1, 0xccaa66); g.strokeRect(0, 2, 26, 32);
      g.fillStyle(0xff3311); g.fillRect(0, 2, 26, 7); // 赤いヘッダー
      g.fillStyle(0xffffff); g.fillRect(2, 4, 22, 3);
      g.lineStyle(1, 0xaabb88);
      for (let i = 0; i < 4; i++) {
        g.beginPath(); g.moveTo(3, 13 + i * 6); g.lineTo(23, 13 + i * 6); g.strokePath();
      }
      g.fillStyle(0x334411); // 文字っぽい点
      g.fillRect(3, 12, 8, 2); g.fillRect(3, 18, 12, 2);
      g.fillRect(3, 24, 6, 2);
      g.generateTexture("item_cipher", 26, 34); g.destroy();
    }

    // ─── 金庫 ─────────────────────────────────────────────
    if (!this.textures.exists("safe")) {
      const g = this.add.graphics();
      g.fillStyle(0x445566); g.fillRect(0, 0, 38, 38);
      g.fillStyle(0x334455); g.fillRect(2, 2, 34, 34);
      g.lineStyle(2, 0x667788); g.strokeRect(2, 2, 34, 34);
      // ダイヤル
      g.fillStyle(0x778899); g.fillCircle(17, 19, 9);
      g.fillStyle(0x556677); g.fillCircle(17, 19, 6);
      g.fillStyle(0xaabbcc); g.fillCircle(17, 19, 2);
      // ハンドル
      g.fillStyle(0x889999); g.fillRect(28, 14, 6, 10); g.fillRect(30, 12, 4, 4); g.fillRect(30, 24, 4, 4);
      // 鍵穴
      g.fillStyle(0x223344); g.fillCircle(32, 19, 3); g.fillRect(31, 19, 2, 5);
      g.generateTexture("safe", 38, 38); g.destroy();
    }

    // ─── フロア・壁・ライト ───────────────────────────────
    if (!this.textures.exists("floor")) {
      const g = this.add.graphics();
      g.fillStyle(0x3a2e1e); g.fillRect(0, 0, 32, 32);
      g.lineStyle(1, 0x4a3e2e); g.strokeRect(0, 0, 32, 32);
      g.generateTexture("floor", 32, 32); g.destroy();
    }
    if (!this.textures.exists("wall")) {
      const g = this.add.graphics();
      g.fillStyle(0x1a1020); g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x2a1a30); g.fillRect(2, 2, 28, 28);
      g.generateTexture("wall", 32, 32); g.destroy();
    }
    if (!this.textures.exists("light_circle")) {
      const size = 320, cx = size / 2;
      const g = this.add.graphics();
      const steps = 24;
      for (let i = steps; i >= 0; i--) {
        const r = (cx * i) / steps;
        const alpha = 1 - i / steps;
        g.fillStyle(0xffffff, alpha); g.fillCircle(cx, cx, r);
      }
      g.generateTexture("light_circle", size, size); g.destroy();
    }
  }
}
