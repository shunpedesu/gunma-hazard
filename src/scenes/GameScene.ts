import Phaser from "phaser";
import { Player } from "../objects/Player";
import { Enemy } from "../objects/Enemy";
import { SoundManager } from "../objects/SoundManager";
import {
  STAGE_QUIZZES, STAGE_CONFIGS, STAGE_GAMEOVER_MESSAGES, STAGE_SCARE_MESSAGES,
  type GunmaQuiz,
} from "../data/gunma-data";

type ItemKey = "daruma" | "negi" | "key_a" | "key_b";

interface MapItem {
  sprite: Phaser.GameObjects.GameObject;
  key: ItemKey;
  x: number; y: number;
  texKey?: string;
  isQuizPedestal?: boolean;
  quizDone?: boolean;
}
interface Closet { sprite: Phaser.GameObjects.GameObject; x: number; y: number }
interface Door {
  sprite: Phaser.GameObjects.GameObject;
  x: number; y: number;
  requiredItem: ItemKey | "key_ab";
  targetRoom: number;
}

export class GameScene extends Phaser.Scene {
  // ─── state ────────────────────────────────────────────
  private player!: Player;
  private enemies: Enemy[] = [];
  private roomObjects: Phaser.GameObjects.GameObject[] = [];
  private wallBodies: Phaser.Physics.Arcade.StaticGroup[] = [];
  private colliders: Phaser.Physics.Arcade.Collider[] = [];
  private items: MapItem[] = [];
  private closets: Closet[] = [];
  private doors: Door[] = [];
  private inventory: Set<ItemKey> = new Set();
  private currentRoom = 0;
  private stage = 1;
  private enemyTexture = "enemy_konnyaku";
  private quizIndex = 0;
  private sfx!: SoundManager;

  // ─── overlay ──────────────────────────────────────────
  private darkOverlay!: Phaser.GameObjects.Rectangle;
  private overlayFadeSpeed = 0;
  private overlayFadeDone?: () => void;

  // ─── UI ───────────────────────────────────────────────
  private messageBox!: Phaser.GameObjects.Container;
  private messageText!: Phaser.GameObjects.Text;
  private inventoryText!: Phaser.GameObjects.Text;
  private roomLabel!: Phaser.GameObjects.Text;
  private isShowingMessage = false;
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private quizElements: Phaser.GameObjects.GameObject[] = [];
  private isQuizActive = false;
  private onQuizSuccess?: () => void;

  // ─── stamina UI ───────────────────────────────────────
  private staminaBar!: Phaser.GameObjects.Rectangle;
  private staminaBg!: Phaser.GameObjects.Rectangle;

  // ─── misc ─────────────────────────────────────────────
  private wasChased = false;
  private prevTouchInteract = false;
  private scareTimer: ReturnType<typeof setTimeout> | null = null;
  static deathCount = 0;

  constructor() { super({ key: "GameScene" }); }

  // ══════════════════════════════════════════════════════
  create(data?: { stage?: number }) {
    this.stage = data?.stage ?? 1;
    const cfg = STAGE_CONFIGS[this.stage - 1];
    this.enemyTexture = cfg.enemyTexture;
    this.quizIndex = 0;
    this.inventory = new Set();
    this.wasChased = false;

    this.sfx = new SoundManager();
    this.sfx.startAmbient();

    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.enterKey   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    this.player = new Player(this, 100, 240);

    const { width: W, height: H } = this.scale;
    this.darkOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000)
      .setDepth(500).setScrollFactor(0).setAlpha(1);

    this.createUI();
    this.loadRoom(0);
    this.fadeInOverlay(800, () => {
      this.showMessage(`【${cfg.subtitle}】\n${this.roomZeroIntro()}`, 2500);
    });
  }

  private roomZeroIntro(): string {
    return [
      "廃旅館に迷い込んだ。脱出口を探さなければ。",
      "富岡製糸場の廃墟…何かがうごめいている。",
      "赤城山の鬼ヶ島…上毛かるたの呪いが漂う。",
    ][this.stage - 1];
  }

  // ══════════════════════════════════════════════════════
  // ROOM MANAGEMENT
  // ══════════════════════════════════════════════════════
  private loadRoom(index: number) {
    this.colliders.forEach(c => { try { c.destroy(); } catch (_) {} });
    this.colliders = [];
    this.roomObjects.forEach(o => o.destroy());
    this.roomObjects = [];
    this.wallBodies.forEach(g => g.destroy(true));
    this.wallBodies = [];
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
    this.items = [];
    this.closets = [];
    this.doors = [];
    this.quizElements.forEach(o => o.destroy());
    this.quizElements = [];

    if (this.messageTimer) { clearTimeout(this.messageTimer); this.messageTimer = null; }
    this.isShowingMessage = false;
    this.isQuizActive = false;
    this.messageBox?.setVisible(false);

    this.player.isHiding = false;
    this.player.setAlpha(1);
    this.currentRoom = index;

    const builders: (() => void)[][] = [
      [() => this.buildS1R0(), () => this.buildS1R1(), () => this.buildS1R2(), () => this.buildS1R3()],
      [() => this.buildS2R0(), () => this.buildS2R1(), () => this.buildS2R2(), () => this.buildS2R3()],
      [() => this.buildS3R0(), () => this.buildS3R1(), () => this.buildS3R2(), () => this.buildS3R3()],
    ];
    builders[this.stage - 1][index]?.();

    this.wallBodies.forEach(grp => {
      this.colliders.push(this.physics.add.collider(this.player, grp) as unknown as Phaser.Physics.Arcade.Collider);
      this.enemies.forEach(e => {
        this.colliders.push(this.physics.add.collider(e, grp) as unknown as Phaser.Physics.Arcade.Collider);
      });
    });
    this.enemies.forEach(e => {
      this.colliders.push(
        this.physics.add.overlap(this.player, e, this.onCaught as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this) as unknown as Phaser.Physics.Arcade.Collider
      );
    });

    this.player.setDepth(50);
    this.scheduleJumpScare();
  }

  private scheduleJumpScare() {
    if (this.scareTimer) clearTimeout(this.scareTimer);
    const delay = Phaser.Math.Between(22000, 38000);
    this.scareTimer = setTimeout(() => {
      if (!this.player.isDead && !this.player.isHiding && this.enemies.length > 0) {
        this.triggerJumpScare();
      }
    }, delay);
  }

  private triggerJumpScare() {
    const msgs = STAGE_SCARE_MESSAGES[this.stage - 1];
    const msg = Phaser.Utils.Array.GetRandom(msgs) as string;
    this.cameras.main.flash(300, 255, 0, 0, true);
    this.cameras.main.shake(400, 0.015);
    this.sfx.jumpScare();
    setTimeout(() => {
      const e = this.enemies[0];
      if (!e?.active) return;
      const offsetX = this.player.flipX ? 120 : -120;
      e.setPosition(
        Phaser.Math.Clamp(this.player.x + offsetX, 60, 580),
        this.player.y
      );
      e.startChase();
    }, 200);
    setTimeout(() => {
      if (!this.isShowingMessage) this.showMessage(msg, 1800);
    }, 350);
    this.scheduleJumpScare();
  }

  // ══════════════════════════════════════════════════════
  // STAGE 1：草津温泉の廃旅館
  // ══════════════════════════════════════════════════════
  private buildS1R0() {
    this.player.setPosition(80, 240);
    this.drawFloor(0x5a4a30);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      { x: 240, y: 130, w: 20,  h: 120 }, { x: 400, y: 350, w: 120, h: 20 },
    ]);
    this.spawnItem("daruma", 310, 195, "item_daruma");
    this.spawnCloset(510, 100); this.spawnCloset(90, 370);
    this.spawnDoor(608, 240, "daruma", 1);
    this.spawnEnemy(400, 300, [{ x: 400, y: 300 }, { x: 180, y: 300 }, { x: 180, y: 150 }, { x: 400, y: 150 }]);
    this.addLabel("🏚 玄関ホール 〜草津温泉廃旅館〜");
    this.addStoryNote(310, 340, "帳場の日誌：\n「最後の客は…もう出られない」");
  }

  private buildS1R1() {
    this.player.setPosition(80, 240);
    this.drawFloor(0x8a4848);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      { x: 170, y: 110, w: 100, h: 20 }, { x: 470, y: 370, w: 100, h: 20 },
    ]);
    this.spawnQuizPedestal(320, 200, "item_negi");
    this.spawnCloset(100, 100); this.spawnCloset(540, 380);
    this.spawnDoor(608, 240, "negi", 2);
    this.spawnEnemy(400, 350, [{ x: 400, y: 350 }, { x: 200, y: 350 }]);
    this.spawnEnemy(460, 130, [{ x: 460, y: 130 }, { x: 460, y: 300 }], 60);
    this.addLabel("🔔 大広間");
    this.addStoryNote(130, 250, "壁の落書き：\n「上毛かるたを全部言えれば助かるかも…」");
    this.showEntryMessage("…大広間か。何かが見ている気がする。");
  }

  private buildS1R2() {
    this.player.setPosition(80, 240);
    this.drawFloor(0x6a5858);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      { x: 320, y: 160, w: 200, h: 20 }, { x: 320, y: 320, w: 200, h: 20 },
    ]);
    this.spawnItem("key_a", 220, 100, "item_yakimanjuu");
    this.spawnCloset(110, 140); this.spawnCloset(530, 360);
    this.spawnDoor(608, 240, "key_a", 3);
    const e = this.spawnEnemy(400, 240, [{ x: 400, y: 240 }, { x: 150, y: 100 }, { x: 500, y: 380 }], 75);
    (e as any).chaseSpeed = 75;
    this.addLabel("🌑 廊下");
    this.addStoryNote(400, 380, "床の文字：\n「こんにゃくおばけは走るぞ…速いぞ…」");
    this.showEntryMessage("廊下は…暗い。やきまんじゅう型の鍵を探せ。");
  }

  private buildS1R3() {
    this.player.setPosition(80, 240);
    this.drawFloor(0x2e6070);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      { x: 200, y: 200, w: 20,  h: 120 }, { x: 430, y: 290, w: 20,  h: 120 },
    ]);
    const pool = this.add.ellipse(380, 240, 160, 110, 0x1a6677, 0.7).setDepth(1);
    const poolLabel = this.add.text(380, 240, "♨", { fontSize: "32px" }).setOrigin(0.5).setDepth(2);
    this.roomObjects.push(pool, poolLabel);
    this.spawnItem("key_b", 160, 140, "item_yakimanjuu");
    this.spawnCloset(550, 120);
    this.spawnDoor(608, 240, "key_ab", -1);
    this.spawnEnemy(300, 300, [{ x: 300, y: 300 }, { x: 500, y: 150 }], 65);
    this.spawnEnemy(500, 390, [{ x: 500, y: 390 }, { x: 200, y: 390 }], 55);
    this.addLabel("♨ 温泉浴場");
    this.addStoryNote(200, 370, "貼り紙：\n「草津よいとこ一度はおいで\nでも帰れるかな？」");
    this.showEntryMessage("温泉の匂い。でもこんにゃくおばけが2体いる！\n銀のやきまんじゅう鍵を探せ！");
  }

  // ══════════════════════════════════════════════════════
  // STAGE 2：富岡製糸場の廃墟
  // ══════════════════════════════════════════════════════
  private buildS2R0() {
    this.player.setPosition(80, 240);
    this.drawFloor(0x5a4030);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      { x: 320, y: 200, w: 240, h: 20 }, { x: 200, y: 360, w: 20,  h: 120 },
      { x: 440, y: 130, w: 20,  h: 100 },
    ]);
    this.spawnItem("daruma", 300, 140, "item_mayudama");
    this.spawnCloset(500, 80); this.spawnCloset(100, 380);
    this.spawnDoor(608, 240, "daruma", 1);
    this.spawnEnemy(420, 320, [{ x: 420, y: 320 }, { x: 180, y: 320 }, { x: 180, y: 120 }]);
    this.addLabel("🏭 正門広場 〜富岡製糸場廃墟〜");
    this.addStoryNote(300, 380, "案内板の残骸：\n「世界遺産 富岡製糸場…\n1872年の栄光よ、どこへ」");
  }

  private buildS2R1() {
    this.player.setPosition(80, 240);
    this.drawFloor(0x4a5060);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      // 柱（工場らしく）
      { x: 160, y: 160, w: 24, h: 24 }, { x: 320, y: 160, w: 24, h: 24 },
      { x: 480, y: 160, w: 24, h: 24 }, { x: 160, y: 320, w: 24, h: 24 },
      { x: 480, y: 320, w: 24, h: 24 },
    ]);
    this.spawnQuizPedestal(320, 240, "item_negi");
    this.spawnCloset(100, 100); this.spawnCloset(540, 100);
    this.spawnDoor(608, 240, "negi", 2);
    this.spawnEnemy(200, 350, [{ x: 200, y: 350 }, { x: 450, y: 350 }]);
    this.spawnEnemy(450, 120, [{ x: 450, y: 120 }, { x: 200, y: 120 }], 62);
    this.addLabel("🏭 繰糸場（大工場）");
    this.addStoryNote(490, 380, "壁の落書き：\n「糸は命…富岡の知識が鍵だ」");
    this.showEntryMessage("機械の音が聞こえる…いや、足音だ。\nだるまおばけが転がってくる！");
  }

  private buildS2R2() {
    this.player.setPosition(80, 240);
    this.drawFloor(0x705040);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      { x: 320, y: 140, w: 240, h: 20 }, { x: 320, y: 340, w: 240, h: 20 },
      { x: 140, y: 240, w: 20,  h: 160 },
    ]);
    this.spawnItem("key_a", 500, 80, "item_yakimanjuu");
    this.spawnCloset(100, 120); this.spawnCloset(100, 380);
    this.spawnDoor(608, 240, "key_a", 3);
    const e = this.spawnEnemy(350, 240, [{ x: 350, y: 240 }, { x: 550, y: 100 }, { x: 550, y: 400 }], 70);
    (e as any).chaseSpeed = 70;
    this.addLabel("📦 東置繭所");
    this.addStoryNote(380, 380, "繭の山の陰に：\n「積み重ねられたまゆ…\nいや、あれは目だ。」");
    this.showEntryMessage("置繭所…まゆが山積みだ。\n金の糸巻き鍵を見つけろ。");
  }

  private buildS2R3() {
    this.player.setPosition(80, 240);
    this.drawFloor(0x404858);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      { x: 220, y: 180, w: 180, h: 20 }, { x: 420, y: 300, w: 180, h: 20 },
    ]);
    // 紡績機のシルエット
    const loom = this.add.rectangle(380, 240, 100, 60, 0x223344, 0.8).setDepth(1);
    const loomTxt = this.add.text(380, 240, "🕸", { fontSize: "24px" }).setOrigin(0.5).setDepth(2);
    this.roomObjects.push(loom, loomTxt);
    this.spawnItem("key_b", 160, 100, "item_yakimanjuu");
    this.spawnCloset(540, 380);
    this.spawnDoor(608, 240, "key_ab", -1);
    this.spawnEnemy(300, 350, [{ x: 300, y: 350 }, { x: 500, y: 150 }], 65);
    this.spawnEnemy(500, 120, [{ x: 500, y: 120 }, { x: 300, y: 400 }], 58);
    this.addLabel("🛏 女工宿舎の奥");
    this.addStoryNote(200, 380, "女工の手紙：\n「もう帰れない…\nでも絹の技術は守り続ける」");
    this.showEntryMessage("女工宿舎…だるまおばけが２体！\n銀の糸巻き鍵を探して脱出だ！");
  }

  // ══════════════════════════════════════════════════════
  // STAGE 3：赤城山の鬼ヶ島
  // ══════════════════════════════════════════════════════
  private buildS3R0() {
    this.player.setPosition(80, 240);
    this.drawFloor(0x1a4035);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      { x: 200, y: 160, w: 120, h: 20 }, { x: 460, y: 300, w: 120, h: 20 },
      { x: 350, y: 100, w: 20,  h: 80 },
    ]);
    // 大沼の湖
    const lake = this.add.ellipse(450, 180, 140, 90, 0x0a3050, 0.85).setDepth(1);
    const lakeTxt = this.add.text(450, 175, "〰", { fontSize: "18px", color: "#3388aa" }).setOrigin(0.5).setDepth(2);
    this.roomObjects.push(lake, lakeTxt);
    this.spawnItem("daruma", 260, 330, "item_ofuda");
    this.spawnCloset(520, 380); this.spawnCloset(90, 120);
    this.spawnDoor(608, 240, "daruma", 1);
    this.spawnEnemy(380, 340, [{ x: 380, y: 340 }, { x: 180, y: 200 }, { x: 400, y: 120 }]);
    this.addLabel("🏔 大沼湖畔 〜赤城山鬼ヶ島〜");
    this.addStoryNote(260, 100, "石碑の文字：\n「赤城山よ…鶴舞う形の群馬県を\n守り給え」");
  }

  private buildS3R1() {
    this.player.setPosition(80, 240);
    this.drawFloor(0x500010);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      // 鳥居の柱っぽく
      { x: 140, y: 280, w: 20, h: 160 }, { x: 500, y: 200, w: 20, h: 160 },
      { x: 320, y: 390, w: 200, h: 20 },
    ]);
    // 鳥居の横木
    const torii = this.add.rectangle(320, 130, 360, 16, 0xcc2200, 0.9).setDepth(1);
    this.roomObjects.push(torii);
    this.spawnQuizPedestal(320, 240, "item_negi");
    this.spawnCloset(90, 100); this.spawnCloset(550, 400);
    this.spawnDoor(608, 240, "negi", 2);
    this.spawnEnemy(200, 370, [{ x: 200, y: 370 }, { x: 450, y: 370 }], 62);
    this.spawnEnemy(480, 140, [{ x: 480, y: 140 }, { x: 200, y: 140 }], 65);
    this.addLabel("⛩ 鬼の社");
    this.addStoryNote(480, 380, "御札：\n「上毛かるたの呪文を唱えよ\nそうすれば道が開かれる」");
    this.showEntryMessage("上毛かるたの呪いが漂っている…\nかるた怨霊に気をつけろ！");
  }

  private buildS3R2() {
    this.player.setPosition(80, 240);
    this.drawFloor(0x1a2028);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      // 洞窟の岩（不規則な配置）
      { x: 180, y: 180, w: 80, h: 20 }, { x: 460, y: 260, w: 80, h: 20 },
      { x: 310, y: 350, w: 20, h: 80 }, { x: 130, y: 340, w: 60, h: 20 },
    ]);
    this.spawnItem("key_a", 500, 380, "item_magatama_red");
    this.spawnCloset(100, 380);
    this.spawnDoor(608, 240, "key_a", 3);
    const e = this.spawnEnemy(350, 200, [{ x: 350, y: 200 }, { x: 500, y: 380 }, { x: 200, y: 380 }], 72);
    (e as any).chaseSpeed = 72;
    this.addLabel("🪨 黒檜山の洞窟");
    this.addStoryNote(300, 120, "岩に刻まれた文字：\n「黒檜山1828m…\n到達した者だけが進める」");
    this.showEntryMessage("暗い洞窟…赤城の勾玉の鍵がどこかにある。");
  }

  private buildS3R3() {
    this.player.setPosition(80, 240);
    this.drawFloor(0x302840);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      { x: 200, y: 220, w: 20,  h: 140 }, { x: 440, y: 270, w: 20,  h: 140 },
    ]);
    // 山頂の神社
    const shrine = this.add.rectangle(320, 200, 120, 80, 0x221133, 0.85).setDepth(1);
    const shrineTxt = this.add.text(320, 198, "⛩", { fontSize: "28px" }).setOrigin(0.5).setDepth(2);
    // 空の星
    for (let i = 0; i < 20; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(50, 600), Phaser.Math.Between(50, 200),
        Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.3, 0.9)
      ).setDepth(0);
      this.roomObjects.push(star);
    }
    this.roomObjects.push(shrine, shrineTxt);
    this.spawnItem("key_b", 150, 380, "item_magatama_blue");
    this.spawnCloset(520, 120);
    this.spawnDoor(608, 240, "key_ab", -1);
    this.spawnEnemy(300, 370, [{ x: 300, y: 370 }, { x: 500, y: 180 }], 65);
    this.spawnEnemy(500, 350, [{ x: 500, y: 350 }, { x: 200, y: 180 }], 60);
    this.addLabel("⭐ 山頂の神社");
    this.addStoryNote(350, 380, "神社の額：\n「上毛かるたの呪い、\nここに封じられし…」");
    this.showEntryMessage("山頂に着いた！青の勾玉鍵を見つけて\n呪いを打ち破れ！");
  }

  // ══════════════════════════════════════════════════════
  // MAP BUILDING HELPERS
  // ══════════════════════════════════════════════════════
  private drawFloor(color: number) {
    const { width, height } = this.scale;
    for (let x = 32; x < width; x += 32) {
      for (let y = 32; y < height; y += 32) {
        const tile = this.add.rectangle(x, y, 31, 31, color, 1).setDepth(0);
        const border = this.add.rectangle(x, y, 31, 31, 0x000000, 0).setDepth(0);
        border.setStrokeStyle(0.5, 0x000000, 0.3);
        this.roomObjects.push(tile, border);
      }
    }
  }

  private buildWalls(defs: { x: number; y: number; w: number; h: number }[]) {
    const grp = this.physics.add.staticGroup();
    defs.forEach(({ x, y, w, h }) => {
      const r = this.add.rectangle(x, y, w, h, 0x2a1a40, 1).setDepth(2);
      r.setStrokeStyle(1, 0x6633aa, 0.8);
      grp.add(r as unknown as Phaser.GameObjects.GameObject);
      this.roomObjects.push(r);
    });
    this.wallBodies.push(grp);
  }

  private spawnItem(key: ItemKey, x: number, y: number, texKey: string) {
    const tint = key === "key_b" ? 0xccccff : 0xffffff;
    const spr = this.add.sprite(x, y, texKey).setDepth(5).setTint(tint);
    this.tweens.add({ targets: spr, y: y - 7, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const glow = this.add.circle(x, y, 20, 0xffee88, 0.18).setDepth(4);
    this.tweens.add({ targets: glow, alpha: 0.04, duration: 900, yoyo: true, repeat: -1 });
    this.roomObjects.push(spr, glow);
    this.items.push({ sprite: spr, key, x, y, texKey });
  }

  private spawnCloset(x: number, y: number) {
    const spr = this.add.sprite(x, y, "closet").setDepth(5);
    const outline = this.add.rectangle(x, y, 52, 68, 0x000000, 0).setDepth(4);
    outline.setStrokeStyle(2, 0x886600, 0.6);
    this.roomObjects.push(spr, outline);
    this.closets.push({ sprite: spr, x, y });
  }

  private spawnDoor(x: number, y: number, req: ItemKey | "key_ab", targetRoom: number) {
    const isFinal = req === "key_ab";
    const spr = this.add.sprite(x, y, "door").setDepth(5);
    if (isFinal) {
      spr.setTint(0xffd700);
      this.tweens.add({ targets: spr, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });
      const label = this.add.text(x, y + 26, "EXIT", {
        fontSize: "10px", color: "#ffd700", stroke: "#000", strokeThickness: 2,
      }).setOrigin(0.5).setDepth(6);
      this.roomObjects.push(label);
    }
    this.roomObjects.push(spr);
    this.doors.push({ sprite: spr, x, y, requiredItem: req, targetRoom });
  }

  private spawnQuizPedestal(x: number, y: number, _rewardTex: string) {
    const base = this.add.rectangle(x, y, 44, 44, 0x664400, 1).setDepth(4);
    base.setStrokeStyle(2, 0xffaa00, 0.8);
    const icon = this.add.text(x, y, "📋", { fontSize: "22px" }).setOrigin(0.5).setDepth(6);
    this.tweens.add({ targets: icon, angle: 5, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.roomObjects.push(base, icon);
    this.items.push({ sprite: base, key: "negi", x, y, isQuizPedestal: true });
  }

  private spawnEnemy(x: number, y: number, patrol?: { x: number; y: number }[], speed?: number): Enemy {
    const e = new Enemy(this, x, y, this.player, patrol, speed, this.enemyTexture);
    this.enemies.push(e);
    return e;
  }

  private addLabel(room: string) {
    this.roomLabel?.setText(room);
  }

  private addStoryNote(x: number, y: number, text: string) {
    const note = this.add.rectangle(x, y, 14, 18, 0xeedd88, 0.9).setDepth(5).setAngle(6);
    const icon = this.add.text(x, y, "📄", { fontSize: "14px" }).setOrigin(0.5).setDepth(6);
    (note as any)._noteText = text;
    (note as any)._noteX = x;
    (note as any)._noteY = y;
    this.roomObjects.push(note, icon);
  }

  private showEntryMessage(text: string) {
    setTimeout(() => {
      if (!this.isShowingMessage) this.showMessage(text, 2800);
    }, 800);
  }

  // ══════════════════════════════════════════════════════
  // UI
  // ══════════════════════════════════════════════════════
  private createUI() {
    const { width, height } = this.scale;

    this.roomLabel = this.add.text(10, 8, "", {
      fontSize: "13px", color: "#cccccc", stroke: "#000", strokeThickness: 3,
    }).setDepth(600).setScrollFactor(0);

    // ステージ表示
    const cfg = STAGE_CONFIGS[this.stage - 1];
    this.add.text(width - 10, 8, `【${cfg.title}】`, {
      fontSize: "12px", color: "#ffaa44", stroke: "#000", strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(600).setScrollFactor(0);

    this.inventoryText = this.add.text(10, height - 26, "🎒 持ち物：なし", {
      fontSize: "13px", color: "#ffee88", stroke: "#000", strokeThickness: 3,
    }).setDepth(600).setScrollFactor(0);

    this.add.text(width - 10, height - 38, "SHIFT:ダッシュ", {
      fontSize: "11px", color: "#88ccff", stroke: "#000", strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(600).setScrollFactor(0);
    this.staminaBg = this.add.rectangle(width - 10, height - 22, 100, 10, 0x333333)
      .setOrigin(1, 0.5).setDepth(600).setScrollFactor(0);
    this.staminaBar = this.add.rectangle(width - 60, height - 22, 100, 10, 0x44aaff)
      .setOrigin(0.5, 0.5).setDepth(601).setScrollFactor(0);

    const boxBg = this.add.rectangle(width / 2, height - 58, width - 40, 84, 0x000000, 0.88);
    boxBg.setStrokeStyle(1.5, 0x886600, 1);
    this.messageText = this.add.text(width / 2, height - 58, "", {
      fontSize: "14px", color: "#ffffff",
      wordWrap: { width: width - 80 }, align: "center", lineSpacing: 4,
    }).setOrigin(0.5);
    this.messageBox = this.add.container(0, 0, [boxBg, this.messageText]);
    this.messageBox.setDepth(601).setScrollFactor(0).setVisible(false);
  }

  // ══════════════════════════════════════════════════════
  // MESSAGE / QUIZ
  // ══════════════════════════════════════════════════════
  private showMessage(text: string, duration = 2500, onClose?: () => void) {
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.isShowingMessage = true;
    this.messageText.setText(text);
    this.messageBox.setVisible(true);
    this.messageTimer = setTimeout(() => {
      this.messageBox.setVisible(false);
      this.isShowingMessage = false;
      this.messageTimer = null;
      onClose?.();
    }, duration);
  }

  private updateInventoryUI() {
    const txt = [...this.inventory].map(k => this.itemLabel(k)).join("  ");
    this.inventoryText.setText(`🎒 持ち物：${txt || "なし"}`);
  }

  private itemLabel(key: ItemKey): string {
    const labels: Record<number, Record<ItemKey, string>> = {
      1: { daruma: "高崎だるま", negi: "下仁田ネギ", key_a: "やきまんじゅう鍵(金)", key_b: "やきまんじゅう鍵(銀)" },
      2: { daruma: "まゆだま", negi: "絹の帯", key_a: "糸巻き鍵(金)", key_b: "糸巻き鍵(銀)" },
      3: { daruma: "赤城の護符", negi: "上毛かるたの札", key_a: "勾玉の鍵(赤)", key_b: "勾玉の鍵(青)" },
    };
    return labels[this.stage]?.[key] ?? key;
  }

  private showQuiz(quiz: GunmaQuiz, onSuccess: () => void) {
    this.quizElements.forEach(o => o.destroy());
    this.quizElements = [];
    this.isQuizActive = true;
    this.onQuizSuccess = onSuccess;
    this.player.setVelocity(0, 0);
    const { width, height } = this.scale;
    const D = 700, SF = 0;

    const bg = this.add.rectangle(width / 2, height / 2, width - 60, 270, 0x050510)
      .setAlpha(0.95).setDepth(D).setScrollFactor(SF);
    bg.setStrokeStyle(2, 0xffaa00, 1);

    const q = this.add.text(width / 2, height / 2 - 98, `❓ ${quiz.question}`, {
      fontSize: "16px", color: "#ffee88",
      wordWrap: { width: width - 110 }, align: "center",
    }).setOrigin(0.5).setDepth(D + 1).setScrollFactor(SF);

    this.quizElements.push(bg, q);

    quiz.choices.forEach((choice, i) => {
      const btn = this.add.text(width / 2, height / 2 - 46 + i * 46, `${i + 1}. ${choice}`, {
        fontSize: "14px", color: "#dddddd",
        backgroundColor: "#111133", padding: { x: 14, y: 8 },
      }).setOrigin(0.5).setDepth(D + 1).setScrollFactor(SF)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerover", () => btn.setColor("#ffff00").setBackgroundColor("#222255"));
      btn.on("pointerout",  () => btn.setColor("#dddddd").setBackgroundColor("#111133"));
      btn.on("pointerdown", () => this.onQuizAnswer(i, quiz));
      this.quizElements.push(btn);
    });

    [1, 2, 3, 4].forEach(n => {
      this.input.keyboard!.once(`keydown-${n}`, () => {
        if (this.isQuizActive) this.onQuizAnswer(n - 1, quiz);
      });
    });
  }

  private onQuizAnswer(idx: number, quiz: GunmaQuiz) {
    if (!this.isQuizActive) return;
    this.isQuizActive = false;
    this.quizElements.forEach(o => o.destroy());
    this.quizElements = [];
    if (idx === quiz.answer) {
      this.sfx.correct();
      this.cameras.main.flash(400, 0, 180, 0, true);
      this.showMessage(`✅ ${quiz.comment}`, 2800, () => this.onQuizSuccess?.());
    } else {
      this.sfx.wrong();
      this.cameras.main.shake(350, 0.01);
      this.cameras.main.flash(300, 180, 0, 0, true);
      this.showMessage("❌ 不正解！\n群馬をもっと勉強してこい！\n（もう一度調べてみよう）", 2500);
    }
  }

  // ══════════════════════════════════════════════════════
  // INTERACTION
  // ══════════════════════════════════════════════════════
  private checkInteractions() {
    const REACH = 68;
    const px = this.player.x, py = this.player.y;

    // アイテム
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (Math.hypot(px - item.x, py - item.y) >= REACH) continue;

      if (item.isQuizPedestal) {
        if (item.quizDone) { this.showMessage("もう答えた。さあ次へ進め。", 1800); return; }
        item.quizDone = true;
        const quizPool = STAGE_QUIZZES[this.stage - 1];
        const quiz = quizPool[this.quizIndex % quizPool.length];
        this.quizIndex++;
        this.showQuiz(quiz, () => {
          this.inventory.add("negi");
          this.updateInventoryUI();
          this.sfx.pickup();
          this.showMessage(`🎒 ${this.itemLabel("negi")}を手に入れた！\n次の扉が開けられる！`, 2300);
        });
        return;
      }

      this.sfx.pickup();
      this.cameras.main.flash(200, 255, 255, 80, true);
      item.sprite.destroy();
      this.items.splice(i, 1);
      this.inventory.add(item.key);
      this.updateInventoryUI();
      this.showMessage(`🎒 ${this.itemLabel(item.key)}を拾った！`, 2000);
      return;
    }

    // タンス
    for (const c of this.closets) {
      if (Math.hypot(px - c.x, py - c.y) >= REACH) continue;
      if (!this.player.isHiding) {
        this.player.isHiding = true;
        this.player.setAlpha(0.15);
        this.sfx.hide();
        this.showMessage("タンスに隠れた。\n（もう一度スペースキーで出る）", 2000);
      } else {
        this.player.isHiding = false;
        this.player.setAlpha(1);
        this.sfx.hide();
        this.showMessage("タンスから出た。", 1000);
      }
      return;
    }

    // ドア
    for (const door of this.doors) {
      if (Math.hypot(px - door.x, py - door.y) >= REACH) continue;
      if (door.requiredItem === "key_ab") {
        if (this.inventory.has("key_a") && this.inventory.has("key_b")) {
          this.triggerEnding();
        } else {
          const missing = !this.inventory.has("key_a") ? this.itemLabel("key_a") : this.itemLabel("key_b");
          this.showMessage(`鍵が足りない…\n「${missing}」をまだ持っていない。`, 2200);
        }
        return;
      }
      if (this.inventory.has(door.requiredItem)) {
        this.sfx.doorOpen();
        this.loadRoom(door.targetRoom);
        this.darkOverlay.setAlpha(0);
      } else {
        this.cameras.main.shake(200, 0.008);
        this.showMessage(
          `🚪 ドアが開かない…\n「${this.itemLabel(door.requiredItem as ItemKey)}」を先に拾おう！`, 2200
        );
      }
      return;
    }

    // メモ
    for (const obj of this.roomObjects) {
      const noteText = (obj as any)._noteText;
      const nx = (obj as any)._noteX, ny = (obj as any)._noteY;
      if (!noteText) continue;
      if (Math.hypot(px - nx, py - ny) < REACH) {
        this.showMessage(noteText, 3000); return;
      }
    }
  }

  private nearestInteractable(): string | null {
    const REACH = 68;
    const px = this.player.x, py = this.player.y;
    for (const item of this.items) {
      if (Math.hypot(px - item.x, py - item.y) < REACH) {
        return item.isQuizPedestal ? "[ スペース ] クイズ台を調べる"
          : `[ スペース ] ${this.itemLabel(item.key)}を拾う`;
      }
    }
    for (const c of this.closets) {
      if (Math.hypot(px - c.x, py - c.y) < REACH) {
        return this.player.isHiding ? "[ スペース ] タンスから出る" : "[ スペース ] タンスに隠れる";
      }
    }
    for (const d of this.doors) {
      if (Math.hypot(px - d.x, py - d.y) < REACH) return "[ スペース ] ドアを調べる";
    }
    for (const obj of this.roomObjects) {
      if ((obj as any)._noteText && Math.hypot(px - (obj as any)._noteX, py - (obj as any)._noteY) < REACH) {
        return "[ スペース ] メモを読む";
      }
    }
    return null;
  }

  // ══════════════════════════════════════════════════════
  // EVENTS
  // ══════════════════════════════════════════════════════
  private onCaught() {
    if (this.player.isDead || this.player.isHiding || this.isQuizActive) return;
    this.player.isDead = true;
    GameScene.deathCount++;
    this.sfx.jumpScare();
    this.sfx.stopHeartbeat();
    if (this.scareTimer) clearTimeout(this.scareTimer);
    this.cameras.main.shake(600, 0.025);
    this.cameras.main.flash(600, 255, 0, 0, true);
    setTimeout(() => {
      if (!this.scene.isActive()) return;
      this.darkOverlay.setAlpha(1);
      setTimeout(() => {
        this.sfx.destroy();
        this.scene.stop();
        this.scene.start("GameOverScene", { deathCount: GameScene.deathCount, stage: this.stage });
      }, 500);
    }, 1000);
  }

  private triggerEnding() {
    this.player.isDead = true;
    this.sfx.stopHeartbeat();
    this.sfx.clear();
    if (this.scareTimer) clearTimeout(this.scareTimer);
    this.cameras.main.flash(1200, 255, 255, 180, true);
    this.showMessage("…扉が開いた！\n眩しい光の中へ踏み出す。", 2200);
    setTimeout(() => {
      if (!this.scene.isActive()) return;
      this.darkOverlay.setAlpha(1);
      setTimeout(() => {
        this.sfx.destroy();
        this.scene.stop();
        this.scene.start("ClearScene", { deathCount: GameScene.deathCount, stage: this.stage });
      }, 500);
    }, 2500);
  }

  // ══════════════════════════════════════════════════════
  // FADE
  // ══════════════════════════════════════════════════════
  private fadeInOverlay(duration: number, onDone?: () => void) {
    this.darkOverlay.setAlpha(1);
    this.overlayFadeSpeed = 1 / duration;
    this.overlayFadeDone = onDone;
  }

  // ══════════════════════════════════════════════════════
  // UPDATE
  // ══════════════════════════════════════════════════════
  update(_t: number, delta: number) {
    if (this.overlayFadeSpeed > 0 && this.darkOverlay.alpha > 0) {
      const next = this.darkOverlay.alpha - this.overlayFadeSpeed * delta;
      if (next <= 0) {
        this.darkOverlay.setAlpha(0);
        this.overlayFadeSpeed = 0;
        const cb = this.overlayFadeDone;
        this.overlayFadeDone = undefined;
        cb?.();
      } else {
        this.darkOverlay.setAlpha(next);
      }
    }

    if (this.player?.isDead) return;

    this.player?.update(delta);

    const stPct = this.player.stamina / 100;
    const barW = 100;
    this.staminaBar.width = barW * stPct;
    this.staminaBar.x = (this.scale.width - 10) - barW + (barW * stPct) / 2;
    this.staminaBar.setFillStyle(
      this.player.stamina < 25 ? 0xff4444 : this.player.isSprinting ? 0xffaa00 : 0x44aaff
    );

    const moving = (this.player.body as Phaser.Physics.Arcade.Body)?.speed > 10;
    if (moving) this.sfx.scheduleFootstep(true);

    if (!this.isQuizActive) {
      this.enemies.forEach(e => e.update(delta));
    } else {
      this.enemies.forEach(e => e.setVelocity(0, 0));
    }

    const chased = this.enemies.some(e => e.chasing);
    if (chased && !this.wasChased) {
      this.sfx.enemySpot();
      this.sfx.startHeartbeat(110);
    } else if (!chased && this.wasChased) {
      this.sfx.stopHeartbeat();
    }
    this.wasChased = chased;

    const touch = (window as any).__TOUCH__;
    const touchInteract = !!touch?.interact;
    if (!this.isShowingMessage && !this.isQuizActive &&
      (Phaser.Input.Keyboard.JustDown(this.interactKey) ||
       Phaser.Input.Keyboard.JustDown(this.enterKey) ||
       (touchInteract && !this.prevTouchInteract))
    ) {
      this.checkInteractions();
    }
    this.prevTouchInteract = touchInteract;

    if (!this.isShowingMessage && !this.isQuizActive) {
      const hint = this.nearestInteractable();
      if (hint) {
        this.messageBox.setVisible(true);
        this.messageText.setText(hint);
      } else {
        this.messageBox.setVisible(false);
      }
    }
  }

  shutdown() {
    if (this.scareTimer) clearTimeout(this.scareTimer);
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.sfx?.destroy();
  }
}
