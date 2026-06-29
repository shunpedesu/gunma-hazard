import Phaser from "phaser";
import { Player } from "../objects/Player";
import { Enemy } from "../objects/Enemy";
import { SoundManager } from "../objects/SoundManager";
import { BGMPlayer } from "../objects/BGMPlayer";
import {
  STAGE_QUIZZES, STAGE_CONFIGS, STAGE_GAMEOVER_MESSAGES, STAGE_SCARE_MESSAGES,
  ROOM_NOTES, TAKASHI_MONOLOGUE, GUNMA_TRIVIA_HIDING,
  type GunmaQuiz,
} from "../data/gunma-data";
import { getDifficulty } from "../data/difficulty";

type ItemKey = "daruma" | "negi" | "key_a" | "key_b" | "key_c" | "cipher" | "master_key";

interface Closet { sprite: Phaser.GameObjects.GameObject; x: number; y: number }
interface Door {
  sprite: Phaser.GameObjects.GameObject;
  x: number; y: number;
  requiredItem: ItemKey | "key_ab" | "master_ab" | "master_abc" | "none";
  targetRoom: number;
  isBackDoor?: boolean;
  spawnPos?: { x: number; y: number };
}
interface MapItem {
  sprite: Phaser.GameObjects.GameObject;
  key: ItemKey;
  x: number; y: number;
  texKey?: string;
  isQuizPedestal?: boolean;
  quizDone?: boolean;
  isSafe?: boolean;
  isBossShrine?: boolean;
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
  private pendingOnClose?: () => void;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private quizElements: Phaser.GameObjects.GameObject[] = [];
  private isQuizActive = false;
  private onQuizSuccess?: () => void;

  // ─── stamina UI ───────────────────────────────────────
  private staminaBar!: Phaser.GameObjects.Rectangle;
  private staminaBg!: Phaser.GameObjects.Rectangle;

  // ─── danger vignette & hint ───────────────────────────
  private dangerVignette!: Phaser.GameObjects.Rectangle;
  private hintLabel!: Phaser.GameObjects.Text;

  // ─── misc ─────────────────────────────────────────────
  private hidingTriviaText: Phaser.GameObjects.Text | null = null;
  private wasChased = false;
  private prevTouchInteract = false;
  private scareTimer: ReturnType<typeof setTimeout> | null = null;
  static deathCount = 0;

  // ─── E2: タイマー ─────────────────────────────────────
  private stageStartTime = 0;
  private timerText!: Phaser.GameObjects.Text;

  // ─── A1: ミニマップ ───────────────────────────────────
  private minimapGfx!: Phaser.GameObjects.Graphics;
  private visitedRooms: Set<number> = new Set();

  // ─── D3: ボス ─────────────────────────────────────────
  private bossRoom = false;
  private bossDefeated = false;
  private bossEnemy: Enemy | null = null;
  private bossQuizChain = 0;

  // ─── C2: ハードモード タイマー ────────────────────────
  private quizTimerEl: Phaser.GameObjects.Text | null = null;
  private quizTimerInterval: ReturnType<typeof setInterval> | null = null;

  constructor() { super({ key: "GameScene" }); }

  // ══════════════════════════════════════════════════════
  create(data?: { stage?: number }) {
    this.stage = data?.stage ?? 1;
    if (this.stage === 1) GameScene.deathCount = 0;
    const cfg = STAGE_CONFIGS[this.stage - 1];
    this.enemyTexture = cfg.enemyTexture;
    this.quizIndex = 0;
    this.inventory = new Set();
    this.wasChased = false;

    this.sfx = new SoundManager();
    this.sfx.startAmbient();
    BGMPlayer.playGame();
    this.stageStartTime = Date.now();
    this.visitedRooms = new Set();

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
  private loadRoom(index: number, fromBack = false, spawnPos?: { x: number; y: number }) {
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

    this.hideHidingTrivia();
    this.player.isHiding = false;
    this.player.setAlpha(1);
    this.currentRoom = index;
    this.visitedRooms.add(index);
    this.bossRoom = false;

    const builders: (() => void)[][] = [
      [() => this.buildS1R0(), () => this.buildS1R1(), () => this.buildS1R2(), () => this.buildS1R3(), () => this.buildS1R4()],
      [() => this.buildS2R0(), () => this.buildS2R1(), () => this.buildS2R2(), () => this.buildS2R3(), () => this.buildS2R4()],
      [() => this.buildS3R0(), () => this.buildS3R1(), () => this.buildS3R2(), () => this.buildS3R3(), () => this.buildS3R4()],
    ];
    builders[this.stage - 1][index]?.();
    if (spawnPos) {
      this.player.setPosition(spawnPos.x, spawnPos.y);
    } else if (fromBack) {
      this.player.setPosition(560, 240);
    }
    BGMPlayer.playGameRoom(index);

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
      // プレイヤーから離れた画面端に出現（最低250px離す）
      const candidates = [
        { x: 60,  y: 60  }, { x: 320, y: 60  }, { x: 580, y: 60  },
        { x: 60,  y: 240 }, { x: 580, y: 240 },
        { x: 60,  y: 420 }, { x: 320, y: 420 }, { x: 580, y: 420 },
      ];
      const far = candidates.filter(p =>
        Math.hypot(p.x - this.player.x, p.y - this.player.y) >= 250
      );
      const pos = Phaser.Utils.Array.GetRandom(far.length > 0 ? far : candidates) as { x: number; y: number };
      e.setPosition(pos.x, pos.y);
      e.startChase();
    }, 200);
    setTimeout(() => {
      if (!this.isShowingMessage) {
        const spotPool = TAKASHI_MONOLOGUE.spot[Math.min(this.stage, TAKASHI_MONOLOGUE.spot.length) - 1];
        const spotVoice = Phaser.Utils.Array.GetRandom(spotPool) as string;
        this.showMessage(`${msg}\n\nたかし：「${spotVoice}」`, 2000);
      }
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
    this.spawnSafe(170, 390);
    this.spawnCloset(510, 100); this.spawnCloset(90, 370);
    this.spawnDoor(608, 240, "daruma", 1);
    this.spawnEnemy(400, 300, [{ x: 400, y: 300 }, { x: 180, y: 300 }, { x: 180, y: 150 }, { x: 400, y: 150 }]);
    this.addLabel("🏚 玄関ホール 〜草津温泉廃旅館〜");
    this.addStoryNote(310, 340, "帳場の日誌：\n「最後の客は…もう出られない」\n\n金庫の暗号は「かるたの枚数」とある。");
    this.addStoryNote(160, 110, "旅館の看板：\n「名物 焼きまんじゅう定食\n（現在営業しておりません）」");
    this.addStoryNote(500, 380, "壁の落書き：\n「県庁所在地は前橋！\n　高崎じゃないぞ！！！」");
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
    this.spawnBackDoor(52, 240, 0);
    this.spawnCloset(100, 100); this.spawnCloset(540, 380);
    this.spawnDoor(608, 240, "negi", 2);
    this.spawnSideDoor(320, 440, 4);
    this.spawnEnemy(400, 350, [{ x: 400, y: 350 }, { x: 200, y: 350 }]);
    this.spawnEnemy(460, 130, [{ x: 460, y: 130 }, { x: 460, y: 300 }], 60);
    this.addLabel("🔔 大広間");
    this.addStoryNote(130, 250, "壁の落書き：\n「上毛かるたを全部言えれば助かるかも…」");
    this.addStoryNote(470, 150, "古い案内板：\n「湯畑まで徒歩5分\n（逃げ場はない）」");
    this.addStoryNote(300, 400, "メモ書き：\n「下仁田ネギを持て\nこんにゃくは辛い物が苦手\n…のはずだった」");
    this.showEntryMessage("…大広間か。緑の扉が下にある！");
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
    if (!this.inventory.has("cipher")) this.spawnItem("cipher", 420, 320, "item_cipher");
    this.spawnBackDoor(52, 240, 1);
    this.spawnCloset(110, 140); this.spawnCloset(530, 360);
    this.spawnDoor(608, 240, "key_a", 3);
    const e = this.spawnEnemy(400, 240, [{ x: 400, y: 240 }, { x: 150, y: 100 }, { x: 500, y: 380 }], 75);
    (e as any).chaseSpeed = 75;
    this.addLabel("🌑 廊下");
    this.addStoryNote(400, 380, "床の文字：\n「こんにゃくおばけは走るぞ…速いぞ…」");
    this.addStoryNote(150, 180, "ポスターの残骸：\n「伊香保の石段 365段\n　1年365日分の後悔がある」");
    this.showEntryMessage("廊下は…暗い。やきまんじゅう型の鍵と\n暗号メモを探せ。玄関の金庫に使えるはず！");
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
    this.spawnBackDoor(52, 240, 2);
    this.spawnCloset(550, 120);
    this.spawnDoor(608, 240, "master_abc", -1);
    this.spawnEnemy(300, 300, [{ x: 300, y: 300 }, { x: 500, y: 150 }], 65);
    this.spawnEnemy(500, 390, [{ x: 500, y: 390 }, { x: 200, y: 390 }], 55);
    this.addLabel("♨ 温泉浴場");
    this.addStoryNote(200, 370, "貼り紙：\n「草津よいとこ一度はおいで\nでも帰れるかな？」");
    this.addStoryNote(520, 100, "温度計：\n「源泉温度：約55℃\n　pH約2.0（強酸性）\n　こんにゃくが溶ける」");
    this.showEntryMessage("温泉の匂い。こんにゃくおばけが2体！\n鍵3本とマスターキーで出口を開けろ！");
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
    this.spawnSafe(170, 390);
    this.spawnCloset(500, 80); this.spawnCloset(100, 380);
    this.spawnDoor(608, 240, "daruma", 1);
    this.spawnEnemy(420, 320, [{ x: 420, y: 320 }, { x: 180, y: 320 }, { x: 180, y: 120 }]);
    this.addLabel("🏭 正門広場 〜富岡製糸場廃墟〜");
    this.addStoryNote(300, 380, "案内板の残骸：\n「世界遺産 富岡製糸場…\n1872年の栄光よ、どこへ」\n\n金庫の暗号は「世界遺産登録年」とある。");
    this.addStoryNote(150, 150, "フランス語の手紙：\n「Cher Paul,\nJe suis perdu à Gunma...\n（群馬で迷子です）」");
    this.addStoryNote(500, 100, "工場の記録簿：\n「本日の生産量：生糸3kg\n　使用繭：45,000個\n　だるまの目：血走っている」");
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
    this.spawnBackDoor(52, 240, 0);
    this.spawnCloset(100, 100); this.spawnCloset(540, 100);
    this.spawnDoor(608, 240, "negi", 2);
    this.spawnSideDoor(320, 440, 4);
    this.spawnEnemy(200, 350, [{ x: 200, y: 350 }, { x: 450, y: 350 }]);
    this.spawnEnemy(450, 120, [{ x: 450, y: 120 }, { x: 200, y: 120 }], 62);
    this.addLabel("🏭 繰糸場（大工場）");
    this.addStoryNote(490, 380, "壁の落書き：\n「糸は命…富岡の知識が鍵だ」");
    this.addStoryNote(220, 240, "工員の日記：\n「今日も繭を数えた\n15,000個目で\n　指が繭に見えてきた」");
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
    if (!this.inventory.has("cipher")) this.spawnItem("cipher", 300, 360, "item_cipher");
    this.spawnBackDoor(52, 240, 1);
    this.spawnCloset(100, 120); this.spawnCloset(100, 380);
    this.spawnDoor(608, 240, "key_a", 3);
    const e = this.spawnEnemy(350, 240, [{ x: 350, y: 240 }, { x: 550, y: 100 }, { x: 550, y: 400 }], 70);
    (e as any).chaseSpeed = 70;
    this.addLabel("📦 東置繭所");
    this.addStoryNote(380, 380, "繭の山の陰に：\n「積み重ねられたまゆ…\nいや、あれは目だ。」");
    this.addStoryNote(200, 130, "ポスター：\n「西の西陣、東の桐生\n　～絹の都 群馬～\n（逃げても桐生には戻れない）」");
    this.showEntryMessage("置繭所…まゆが山積みだ。\n糸巻き鍵と設計図の暗号を探せ。正門の金庫に使えるはず！");
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
    this.spawnBackDoor(52, 240, 2);
    this.spawnCloset(540, 380);
    this.spawnDoor(608, 240, "master_abc", -1);
    this.spawnEnemy(300, 350, [{ x: 300, y: 350 }, { x: 500, y: 150 }], 65);
    this.spawnEnemy(500, 120, [{ x: 500, y: 120 }, { x: 300, y: 400 }], 58);
    this.addLabel("🛏 女工宿舎の奥");
    this.addStoryNote(200, 380, "女工の手紙：\n「もう帰れない…\nでも絹の技術は守り続ける」");
    this.addStoryNote(420, 110, "宿舎の規則書：\n「一、上州の誇りを忘れるな\n二、群馬の食文化を愛せよ\n三、だるまを怒らせるな」");
    this.showEntryMessage("女工宿舎…だるまおばけが２体！\n鍵3本と大金庫の鍵で脱出だ！");
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
    this.spawnSafe(170, 390);
    this.spawnCloset(520, 380); this.spawnCloset(90, 120);
    this.spawnDoor(608, 240, "daruma", 1);
    this.spawnEnemy(380, 340, [{ x: 380, y: 340 }, { x: 180, y: 200 }, { x: 400, y: 120 }]);
    this.addLabel("🏔 大沼湖畔 〜赤城山鬼ヶ島〜");
    this.addStoryNote(260, 100, "石碑の文字：\n「赤城山よ…鶴舞う形の群馬県を\n守り給え」\n\n封印の金庫の暗号は「県庁所在地」とある。");
    this.addStoryNote(130, 350, "登山者の遺言：\n「大沼は綺麗だった\nワカサギも美味しかった\n　でも帰れなかった」");
    this.addStoryNote(500, 300, "看板：\n「大沼ワカサギ釣り\n　（冬季のみ）\n海はないがこれがある」");
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
    this.spawnBackDoor(52, 240, 0);
    this.spawnCloset(90, 100); this.spawnCloset(550, 400);
    this.spawnDoor(608, 240, "negi", 2);
    this.spawnSideDoor(320, 440, 4);
    this.spawnEnemy(200, 370, [{ x: 200, y: 370 }, { x: 450, y: 370 }], 62);
    this.spawnEnemy(480, 140, [{ x: 480, y: 140 }, { x: 200, y: 140 }], 65);
    this.addLabel("⛩ 鬼の社");
    this.addStoryNote(480, 380, "御札：\n「上毛かるたの呪文を唱えよ\nそうすれば道が開かれる」");
    this.addStoryNote(220, 220, "上毛かるたの断片：\n「つ：鶴舞う形の群馬県\nら：雷と空風 義理人情\nす：裾野は長し 赤城山」");
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
    if (!this.inventory.has("cipher")) this.spawnItem("cipher", 200, 270, "item_cipher");
    this.spawnBackDoor(52, 240, 1);
    this.spawnCloset(100, 380);
    this.spawnDoor(608, 240, "key_a", 3);
    const e = this.spawnEnemy(350, 200, [{ x: 350, y: 200 }, { x: 500, y: 380 }, { x: 200, y: 380 }], 72);
    (e as any).chaseSpeed = 72;
    this.addLabel("🪨 黒檜山の洞窟");
    this.addStoryNote(300, 120, "岩に刻まれた文字：\n「黒檜山1828m…\n到達した者だけが進める」");
    this.addStoryNote(520, 380, "地図の切れ端：\n「群馬県の形＝鶴\n　でも正直ラクダにも見える\n　（公式見解は鶴）」");
    this.showEntryMessage("暗い洞窟…勾玉の鍵とかるたの御神符を探せ。\n湖畔の金庫に使えるはず！");
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
    this.spawnBackDoor(52, 240, 2);
    this.spawnCloset(520, 120);
    // ─── D3 ボス部屋セットアップ ─────────────────────────
    this.bossRoom = true;
    this.bossDefeated = false;
    this.spawnBossShrine(320, 340);
    // ボス（大将軍）：巨大かるた怨霊
    const boss = new Enemy(this, 500, 200, this.player,
      [{ x: 500, y: 200 }, { x: 150, y: 350 }], 88, "enemy_karuta");
    (boss as any).setScale(2.2);
    this.bossEnemy = boss;
    this.enemies.push(boss);
    this.spawnDoor(608, 240, "master_abc", -1);
    this.addLabel("⭐ 山頂の神社【大将軍】");
    this.addStoryNote(480, 110, "封印の碑文：\n「上毛かるたの問いに3度答えよ\nさすれば大将軍は眠りにつく」");
    this.addStoryNote(150, 150, "嬬恋村からの手紙：\n「キャベツ届けようとしたら\n大将軍に止められた」");
    this.showEntryMessage("⚠ 上毛かるた大将軍が現れた！\n封印の石碑でクイズを3問答えて倒せ！");
  }

  private buildS1R4() {
    this.player.setPosition(320, 80); // 上から入場
    this.drawFloor(0x2a1a40);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      { x: 200, y: 300, w: 120, h: 20 }, { x: 450, y: 300, w: 100, h: 20 },
    ]);
    this.spawnItem("key_c", 320, 300, "item_yakimanjuu_green");
    this.spawnCloset(100, 380); this.spawnCloset(540, 400);
    this.spawnBackDoor(320, 52, 1, { x: 320, y: 400 }); // 上壁から戻る→R1の下ドア付近
    this.spawnEnemy(480, 200, [{ x: 480, y: 200 }, { x: 150, y: 380 }], 70);
    this.addLabel("🔮 秘密の蔵【緑の鍵】");
    this.addStoryNote(160, 180, "蔵の奥の手紙：\n「3本の鍵が揃えば\n怨霊に勝てる…かもしれない」");
    this.addStoryNote(460, 400, "焦げた紙切れ：\n「緑の鍵は特別な力を持つ\n草津の湯が封じ込めた魔力」");
    this.showEntryMessage("緑色の鍵がある！でも敵もいる！\n素早く取って逃げろ！");
  }

  private buildS2R4() {
    this.player.setPosition(320, 80); // 上から入場
    this.drawFloor(0x2a3020);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      { x: 320, y: 220, w: 200, h: 20 }, { x: 150, y: 370, w: 100, h: 20 },
    ]);
    this.spawnItem("key_c", 480, 340, "item_silk_green");
    this.spawnCloset(100, 160); this.spawnCloset(530, 420);
    this.spawnBackDoor(320, 52, 1, { x: 320, y: 400 }); // 上壁から戻る→R1の下ドア付近
    this.spawnEnemy(350, 360, [{ x: 350, y: 360 }, { x: 500, y: 140 }], 68);
    this.addLabel("🏭 絹の倉庫【緑の鍵】");
    this.addStoryNote(280, 130, "絹の製造記録：\n「緑の帯に秘密が宿る\n富岡の職人だけが知る技」");
    this.addStoryNote(130, 270, "蜘蛛の巣だらけの棚：\n「…糸と鍵と呪い\n全部まとめて持っていけ」");
    this.showEntryMessage("緑の鍵がここにある！\nだるまおばけに気をつけろ！");
  }

  private buildS3R4() {
    this.player.setPosition(320, 80); // 上から入場
    this.drawFloor(0x100820);
    this.buildWalls([
      { x: 320, y: 16,  w: 640, h: 32 }, { x: 320, y: 464, w: 640, h: 32 },
      { x: 16,  y: 240, w: 32,  h: 480 }, { x: 624, y: 240, w: 32,  h: 480 },
      { x: 400, y: 270, w: 20,  h: 160 }, { x: 220, y: 180, w: 140, h: 20 },
    ]);
    const glow = this.add.circle(320, 280, 60, 0x4400aa, 0.3).setDepth(1);
    this.tweens.add({ targets: glow, alpha: 0.1, duration: 1200, yoyo: true, repeat: -1 });
    this.roomObjects.push(glow);
    this.spawnItem("key_c", 320, 280, "item_magatama_green");
    this.spawnCloset(100, 400); this.spawnCloset(520, 130);
    this.spawnBackDoor(320, 52, 1, { x: 320, y: 400 }); // 上壁から戻る→R1の下ドア付近
    this.spawnEnemy(500, 370, [{ x: 500, y: 370 }, { x: 150, y: 160 }], 72);
    this.addLabel("🌌 奥社の祭壇【緑の勾玉】");
    this.addStoryNote(480, 130, "祭壇の碑文：\n「赤・青・緑の三玉\n大将軍への鍵となる」");
    this.addStoryNote(180, 360, "かるた怨霊の独り言：\n「な：なる沼田の城\n　をお前には渡さぬ…」");
    this.showEntryMessage("緑の勾玉が光っている！\nかるた怨霊がいる！急いで取れ！");
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

  private spawnSideDoor(x: number, y: number, targetRoom: number) {
    const spr = this.add.sprite(x, y, "door").setDepth(5).setTint(0x44ff88).setScale(0.9);
    const label = this.add.text(x, y + 26, "緑の扉", {
      fontSize: "10px", color: "#88ffcc", stroke: "#000", strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6);
    this.roomObjects.push(spr, label);
    this.doors.push({ sprite: spr, x, y, requiredItem: "none", targetRoom });
  }

  private spawnDoor(x: number, y: number, req: ItemKey | "key_ab" | "master_ab" | "master_abc" | "none", targetRoom: number) {
    const isFinal = req === "key_ab" || req === "master_ab" || req === "master_abc";
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

  private spawnSafe(x: number, y: number) {
    const spr = this.add.sprite(x, y, "safe").setDepth(5);
    const label = this.add.text(x, y + 26, "金庫", {
      fontSize: "10px", color: "#aabbcc", stroke: "#000", strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6);
    this.tweens.add({ targets: spr, alpha: 0.7, duration: 1200, yoyo: true, repeat: -1 });
    this.roomObjects.push(spr, label);
    this.items.push({ sprite: spr, key: "master_key", x, y, isSafe: true });
  }

  private spawnBossShrine(x: number, y: number) {
    const spr = this.add.sprite(x, y, "boss_shrine").setDepth(6);
    this.tweens.add({ targets: spr, alpha: 0.55, duration: 900, yoyo: true, repeat: -1 });
    const label = this.add.text(x, y + 30, "封印の石碑", {
      fontSize: "11px", color: "#cc88ff", stroke: "#000", strokeThickness: 2,
    }).setOrigin(0.5).setDepth(7);
    this.roomObjects.push(spr, label);
    this.items.push({ sprite: spr, key: "key_c", x, y, isBossShrine: true });
  }

  private showBossQuiz() {
    const quizPool = STAGE_QUIZZES[2];
    const quiz = this.shuffleQuizChoices(quizPool[(this.quizIndex + this.bossQuizChain) % quizPool.length]);
    const chain = this.bossQuizChain;
    this.bossQuizChain++;
    this.showQuiz(quiz, () => {
      if (this.bossQuizChain >= 3) {
        this.defeatBoss();
      } else {
        this.showMessage(
          `✨ 第${chain + 1}問クリア！あと${3 - this.bossQuizChain}問！\n\nたかし：「もう少しだ…群馬の力！」`,
          2000, () => this.showBossQuiz()
        );
      }
    });
  }

  private defeatBoss() {
    this.bossDefeated = true;
    this.bossEnemy?.destroy();
    this.bossEnemy = null;
    this.enemies = this.enemies.filter(e => e.active);
    this.cameras.main.flash(1500, 200, 100, 255, true);
    this.cameras.main.shake(500, 0.02);
    this.sfx.clear();
    this.showMessage(
      "⭐ 上毛かるた大将軍を封印した！\n3本の鍵とマスターキーで出口を開けろ！\nたかし：「群馬の知識が…俺たちを救った！」",
      3500
    );
  }

  private spawnBackDoor(x: number, y: number, targetRoom: number, spawnPos?: { x: number; y: number }) {
    const spr = this.add.sprite(x, y, "door").setDepth(5).setTint(0x44aaff);
    const onTopWall = y < 60;
    const labelOffsetY = onTopWall ? 22 : -22;
    const labelText = onTopWall ? "↑戻る" : "←戻る";
    const label = this.add.text(x, y + labelOffsetY, labelText, {
      fontSize: "10px", color: "#88ccff", stroke: "#000", strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6);
    this.roomObjects.push(spr, label);
    this.doors.push({ sprite: spr, x, y, requiredItem: "none", targetRoom, isBackDoor: true, spawnPos });
  }

  private shuffleQuizChoices(quiz: GunmaQuiz): GunmaQuiz {
    const correctAnswer = quiz.choices[quiz.answer];
    const shuffled = [...quiz.choices].sort(() => Math.random() - 0.5);
    return { ...quiz, choices: shuffled, answer: shuffled.indexOf(correctAnswer) };
  }

  private showSafeQuiz() {
    const safeQuizzes: GunmaQuiz[] = [
      { question: "🔐 金庫の暗号：上毛かるたは全部で何枚？",
        choices: ["44枚", "48枚", "36枚", "52枚"], answer: 0,
        comment: "全44枚！群馬の魂が詰まっている。金庫が開いた！" },
      { question: "🔐 金庫の暗号：富岡製糸場が世界遺産登録された年は？",
        choices: ["2014年", "2007年", "2010年", "2019年"], answer: 0,
        comment: "2014年！明治の絹産業の象徴。大金庫が開いた！" },
      { question: "🔐 金庫の暗号：群馬県の県庁所在地はどこ？",
        choices: ["前橋市", "高崎市", "桐生市", "太田市"], answer: 0,
        comment: "前橋市！高崎じゃないぞ！封印が解かれた！" },
    ];
    this.showQuiz(this.shuffleQuizChoices(safeQuizzes[this.stage - 1]), () => {
      this.inventory.add("master_key");
      this.updateInventoryUI();
      this.sfx.pickup();
      this.cameras.main.flash(600, 255, 220, 100, true);
      this.showMessage(
        `🗝️ ${this.itemLabel("master_key")}を手に入れた！\nこれで最後の扉が開けられる！\n\nたかし：「群馬の知識が鍵になるとは…！」`,
        3000
      );
    });
  }

  private spawnEnemy(x: number, y: number, patrol?: { x: number; y: number }[], speed?: number): Enemy {
    const e = new Enemy(this, x, y, this.player, patrol, speed, this.enemyTexture);
    this.enemies.push(e);
    return e;
  }

  private addLabel(room: string) {
    const total = 5;
    const dots = Array.from({ length: total }, (_, i) => i === this.currentRoom ? "●" : "○").join("");
    this.roomLabel?.setText(`${room}  ${dots}`);
    this.updateMinimap();
  }

  private updateMinimap() {
    if (!this.minimapGfx) return;
    this.minimapGfx.clear();
    const W = this.scale.width;
    const rooms = [
      { id: 0, mx: W - 118, my: 30 },
      { id: 1, mx: W - 94,  my: 30 },
      { id: 2, mx: W - 70,  my: 30 },
      { id: 3, mx: W - 46,  my: 30 },
      { id: 4, mx: W - 94,  my: 48 },
    ];
    const connections = [[0, 1], [1, 2], [2, 3], [1, 4]];
    connections.forEach(([a, b]) => {
      const ra = rooms[a], rb = rooms[b];
      this.minimapGfx.lineStyle(1, 0x556655, 0.7);
      this.minimapGfx.beginPath();
      this.minimapGfx.moveTo(ra.mx, ra.my);
      this.minimapGfx.lineTo(rb.mx, rb.my);
      this.minimapGfx.strokePath();
    });
    rooms.forEach(({ id, mx, my }) => {
      const visited = this.visitedRooms.has(id);
      const isCurrent = id === this.currentRoom;
      const color = isCurrent ? 0xffff44 : visited ? 0x44ff88 : 0x334433;
      this.minimapGfx.fillStyle(color, isCurrent ? 1 : visited ? 0.9 : 0.5);
      this.minimapGfx.fillCircle(mx, my, isCurrent ? 5 : 4);
    });
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

    // インタラクトヒント（メッセージボックスとは別の軽量表示）
    this.hintLabel = this.add.text(width / 2, height - 12, "", {
      fontSize: "12px", color: "#ffdd88",
      stroke: "#000", strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(602).setScrollFactor(0);

    // E2: タイマー
    this.timerText = this.add.text(width / 2, 8, "00:00", {
      fontSize: "13px", color: "#88ffcc", stroke: "#000", strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(600).setScrollFactor(0);

    // A1: ミニマップ
    this.minimapGfx = this.add.graphics().setDepth(600).setScrollFactor(0);
    this.add.text(width - 120, 14, "MAP", {
      fontSize: "9px", color: "#556655", stroke: "#000", strokeThickness: 2,
    }).setDepth(600).setScrollFactor(0);

    // 危険ビネット（敵が追いかけているとき赤く光る画面外枠）
    this.dangerVignette = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setDepth(490).setScrollFactor(0);
    this.dangerVignette.setStrokeStyle(24, 0xff0000, 0);
  }

  // ══════════════════════════════════════════════════════
  // MESSAGE / QUIZ
  // ══════════════════════════════════════════════════════
  private showMessage(text: string, duration = 2500, onClose?: () => void) {
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.pendingOnClose = onClose;
    this.isShowingMessage = true;
    this.messageText.setText(text);
    this.messageBox.setVisible(true);
    this.messageTimer = setTimeout(() => {
      this.messageBox.setVisible(false);
      this.isShowingMessage = false;
      this.messageTimer = null;
      const cb = this.pendingOnClose;
      this.pendingOnClose = undefined;
      cb?.();
    }, duration);
  }

  private updateInventoryUI() {
    const txt = [...this.inventory].map(k => this.itemLabel(k)).join("  ");
    this.inventoryText.setText(`🎒 持ち物：${txt || "なし"}`);
  }

  private itemLabel(key: ItemKey): string {
    if (key === "cipher")     return ["暗号メモ", "設計図の暗号", "かるたの御神符"][this.stage - 1];
    if (key === "master_key") return ["マスターキー", "大金庫の鍵", "封印の鍵"][this.stage - 1];
    const labels: Record<number, Partial<Record<ItemKey, string>>> = {
      1: { daruma: "高崎だるま", negi: "下仁田ネギ", key_a: "やきまんじゅう鍵(金)", key_b: "やきまんじゅう鍵(銀)", key_c: "やきまんじゅう鍵(緑)" },
      2: { daruma: "まゆだま", negi: "絹の帯", key_a: "糸巻き鍵(金)", key_b: "糸巻き鍵(銀)", key_c: "糸巻き鍵(緑)" },
      3: { daruma: "赤城の護符", negi: "上毛かるたの札", key_a: "勾玉の鍵(赤)", key_b: "勾玉の鍵(青)", key_c: "勾玉の鍵(緑)" },
    };
    return labels[this.stage]?.[key] ?? key;
  }

  private showQuiz(quiz: GunmaQuiz, onSuccess: () => void) {
    if (this.quizTimerInterval) { clearInterval(this.quizTimerInterval); this.quizTimerInterval = null; }
    this.quizElements.forEach(o => o.destroy());
    this.quizElements = [];
    this.isQuizActive = true;
    this.onQuizSuccess = onSuccess;
    this.player.setVelocity(0, 0);
    const { width, height } = this.scale;
    const D = 700, SF = 0;
    const diff = getDifficulty();

    // C2: easy = 3択、normal = 4択、hard = 4択+タイマー
    let displayQuiz = quiz;
    if (diff === "easy" && quiz.choices.length >= 4) {
      const correct = quiz.choices[quiz.answer];
      const wrong = quiz.choices.filter((_, i) => i !== quiz.answer);
      const reduced = [wrong[0], wrong[1], correct].sort(() => Math.random() - 0.5);
      displayQuiz = { ...quiz, choices: reduced, answer: reduced.indexOf(correct) };
    }

    const bg = this.add.rectangle(width / 2, height / 2, width - 60, 270, 0x050510)
      .setAlpha(0.95).setDepth(D).setScrollFactor(SF);
    bg.setStrokeStyle(2, 0xffaa00, 1);

    const diffLabel = { easy: "【かんたん】", normal: "【ふつう】", hard: "【むずかしい】" }[diff];
    const q = this.add.text(width / 2, height / 2 - 98, `❓ ${displayQuiz.question}\n${diffLabel}`, {
      fontSize: "15px", color: "#ffee88",
      wordWrap: { width: width - 110 }, align: "center",
    }).setOrigin(0.5).setDepth(D + 1).setScrollFactor(SF);

    this.quizElements.push(bg, q);

    displayQuiz.choices.forEach((choice, i) => {
      const btn = this.add.text(width / 2, height / 2 - 46 + i * 46, `${i + 1}. ${choice}`, {
        fontSize: "14px", color: "#dddddd",
        backgroundColor: "#111133", padding: { x: 14, y: 8 },
      }).setOrigin(0.5).setDepth(D + 1).setScrollFactor(SF)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerover", () => btn.setColor("#ffff00").setBackgroundColor("#222255"));
      btn.on("pointerout",  () => btn.setColor("#dddddd").setBackgroundColor("#111133"));
      btn.on("pointerdown", () => this.onQuizAnswer(i, displayQuiz));
      this.quizElements.push(btn);
    });

    [1, 2, 3, 4].forEach(n => {
      this.input.keyboard!.once(`keydown-${n}`, () => {
        if (this.isQuizActive) this.onQuizAnswer(n - 1, displayQuiz);
      });
    });

    if (diff === "hard") {
      let timeLeft = 10;
      this.quizTimerEl = this.add.text(width / 2 + (width / 2 - 60), height / 2 - 98, `⏱ ${timeLeft}`, {
        fontSize: "18px", color: "#ff8888", stroke: "#000", strokeThickness: 3,
      }).setOrigin(1, 0.5).setDepth(D + 2).setScrollFactor(SF);
      this.quizElements.push(this.quizTimerEl);
      this.quizTimerInterval = setInterval(() => {
        timeLeft--;
        this.quizTimerEl?.setText(`⏱ ${timeLeft}`);
        if (timeLeft <= 0) {
          clearInterval(this.quizTimerInterval!);
          this.quizTimerInterval = null;
          if (this.isQuizActive) this.onQuizAnswer(-1, displayQuiz);
        }
      }, 1000);
    }
  }

  private onQuizAnswer(idx: number, quiz: GunmaQuiz) {
    if (!this.isQuizActive) return;
    this.isQuizActive = false;
    if (this.quizTimerInterval) { clearInterval(this.quizTimerInterval); this.quizTimerInterval = null; }
    this.quizElements.forEach(o => o.destroy());
    this.quizElements = [];
    if (idx === quiz.answer) {
      this.sfx.correct();
      this.cameras.main.flash(400, 0, 180, 0, true);
      const correctVoice = Phaser.Utils.Array.GetRandom(TAKASHI_MONOLOGUE.correct) as string;
      this.showMessage(`✅ ${quiz.comment}\n\nたかし：「${correctVoice}」`, 3000, () => this.onQuizSuccess?.());
    } else {
      this.sfx.wrong();
      this.cameras.main.shake(350, 0.01);
      this.cameras.main.flash(300, 180, 0, 0, true);
      const wrongVoice = Phaser.Utils.Array.GetRandom(TAKASHI_MONOLOGUE.wrong) as string;
      this.showMessage(`❌ 不正解！群馬をもっと勉強してこい！\n\nたかし：「${wrongVoice}」`, 2800);
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

      if (item.isSafe) {
        if (this.inventory.has("master_key")) {
          this.showMessage(`🔓 金庫はもう開いた。\n${this.itemLabel("master_key")}は手の中にある。`, 1800);
        } else if (!this.inventory.has("cipher")) {
          this.showMessage(`🔒 金庫に暗号錠がある…\n「${this.itemLabel("cipher")}」が必要だ。\n先に奥の部屋を探そう！`, 2400);
        } else {
          this.showSafeQuiz();
        }
        return;
      }

      if (item.isBossShrine) {
        if (this.bossDefeated) {
          this.showMessage("封印の石碑…大将軍は眠った。\n出口を探せ！", 1800);
        } else {
          this.bossQuizChain = 0;
          this.showBossQuiz();
        }
        return;
      }

      if (item.isQuizPedestal) {
        if (item.quizDone || this.inventory.has("negi")) { this.showMessage("もう答えた。さあ次へ進め。", 1800); return; }
        const quizPool = STAGE_QUIZZES[this.stage - 1];
        const quiz = quizPool[this.quizIndex % quizPool.length];
        this.quizIndex++;
        this.showQuiz(quiz, () => {
          item.quizDone = true;
          this.inventory.add("negi");
          this.updateInventoryUI();
          this.sfx.pickup();
          const negiVoice = Phaser.Utils.Array.GetRandom(TAKASHI_MONOLOGUE.pickup.negi) as string;
          this.showMessage(`🎒 ${this.itemLabel("negi")}を手に入れた！\n次の扉が開けられる！\n\nたかし：「${negiVoice}」`, 2800);
        });
        return;
      }

      this.sfx.pickup();
      this.cameras.main.flash(200, 255, 255, 80, true);
      item.sprite.destroy();
      this.items.splice(i, 1);
      this.inventory.add(item.key);
      this.updateInventoryUI();
      const pickupPool = TAKASHI_MONOLOGUE.pickup[item.key as keyof typeof TAKASHI_MONOLOGUE.pickup];
      const pickupVoice = pickupPool ? (Phaser.Utils.Array.GetRandom(pickupPool) as string) : null;
      const pickupMsg = pickupVoice
        ? `🎒 ${this.itemLabel(item.key)}を拾った！\n\nたかし：「${pickupVoice}」`
        : `🎒 ${this.itemLabel(item.key)}を拾った！`;
      this.showMessage(pickupMsg, 2400);
      return;
    }

    // タンス
    for (const c of this.closets) {
      if (Math.hypot(px - c.x, py - c.y) >= REACH) continue;
      if (!this.player.isHiding) {
        this.player.isHiding = true;
        this.player.setAlpha(0.15);
        this.sfx.hide();
        const hideVoice = Phaser.Utils.Array.GetRandom(TAKASHI_MONOLOGUE.hide) as string;
        this.showMessage(`タンスに隠れた。（もう一度で出る）\n\nたかし：「${hideVoice}」`, 2400);
        this.showHidingTrivia();
      } else {
        this.player.isHiding = false;
        this.player.setAlpha(1);
        this.sfx.hide();
        this.hideHidingTrivia();
        this.showMessage("タンスから出た。", 800);
      }
      return;
    }

    // ドア
    for (const door of this.doors) {
      if (Math.hypot(px - door.x, py - door.y) >= REACH) continue;
      if (door.requiredItem === "none") {
        this.sfx.doorOpen();
        this.loadRoom(door.targetRoom, door.isBackDoor ?? false, door.spawnPos);
        this.fadeInOverlay(500);
        return;
      }
      if (door.requiredItem === "key_ab") {
        if (this.inventory.has("key_a") && this.inventory.has("key_b")) {
          this.triggerEnding();
        } else {
          const missing = !this.inventory.has("key_a") ? this.itemLabel("key_a") : this.itemLabel("key_b");
          this.showMessage(`鍵が足りない…\n「${missing}」をまだ持っていない。`, 2200);
        }
        return;
      }
      if (door.requiredItem === "master_ab") {
        if (this.inventory.has("master_key") && this.inventory.has("key_b")) {
          this.triggerEnding();
        } else if (!this.inventory.has("master_key")) {
          this.showMessage(`扉が開かない…\n「${this.itemLabel("master_key")}」が必要だ。\n最初の部屋の金庫を確認しよう！`, 2400);
        } else {
          this.showMessage(`鍵が足りない…\n「${this.itemLabel("key_b")}」をまだ持っていない。`, 2200);
        }
        return;
      }
      if (door.requiredItem === "master_abc") {
        if (this.bossRoom && !this.bossDefeated) {
          this.showMessage("⚠ 大将軍を倒すまで扉は開かない！\n封印の石碑でクイズを3問答えよ！", 2400);
          return;
        }
        if (this.inventory.has("master_key") && this.inventory.has("key_b") && this.inventory.has("key_c")) {
          this.triggerEnding();
        } else {
          const missing = !this.inventory.has("master_key") ? this.itemLabel("master_key")
            : !this.inventory.has("key_b") ? this.itemLabel("key_b")
            : this.itemLabel("key_c");
          this.showMessage(`扉が開かない…\n「${missing}」がまだ足りない。`, 2200);
        }
        return;
      }
      if (this.inventory.has(door.requiredItem)) {
        this.sfx.doorOpen();
        this.loadRoom(door.targetRoom);
        this.fadeInOverlay(500);
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
        if (item.isSafe) return "[ スペース ] 金庫を調べる";
        if (item.isBossShrine) return this.bossDefeated ? "[ スペース ] 封印の石碑を調べる" : "[ スペース ] 封印の石碑に挑む（クイズ×3）";
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
      if (Math.hypot(px - d.x, py - d.y) < REACH)
        return d.isBackDoor ? "[ スペース ] 前の部屋へ戻る" : "[ スペース ] ドアを調べる";
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
        BGMPlayer.stop();
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
        BGMPlayer.stop();
        this.scene.stop();
        this.scene.start("ClearScene", { deathCount: GameScene.deathCount, stage: this.stage, elapsedMs: Date.now() - this.stageStartTime });
      }, 500);
    }, 2500);
  }

  // ══════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════
  // HIDING TRIVIA
  // ══════════════════════════════════════════════════════
  private showHidingTrivia() {
    this.hideHidingTrivia();
    const { width, height } = this.scale;
    const trivia = Phaser.Utils.Array.GetRandom(GUNMA_TRIVIA_HIDING) as string;
    const bg = this.add.rectangle(width / 2, height - 18, width - 40, 28, 0x000000, 0.72)
      .setScrollFactor(0).setDepth(300).setOrigin(0.5, 1);
    const txt = this.add.text(width / 2, height - 22, `📌 ${trivia}`, {
      fontSize: "11px", color: "#bbddaa",
      stroke: "#000000", strokeThickness: 2,
      wordWrap: { width: width - 56 }, align: "center",
    }).setScrollFactor(0).setDepth(301).setOrigin(0.5, 1).setAlpha(0);
    this.tweens.add({ targets: [bg, txt], alpha: { from: 0, to: 1 }, duration: 600 });
    (this as any)._hidingTriviaBg = bg;
    this.hidingTriviaText = txt;
  }

  private hideHidingTrivia() {
    const bg = (this as any)._hidingTriviaBg as Phaser.GameObjects.Rectangle | undefined;
    if (bg) { bg.destroy(); (this as any)._hidingTriviaBg = null; }
    if (this.hidingTriviaText) { this.hidingTriviaText.destroy(); this.hidingTriviaText = null; }
  }

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

    const elapsed = Date.now() - this.stageStartTime;
    const mm = Math.floor(elapsed / 60000).toString().padStart(2, "0");
    const ss = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, "0");
    this.timerText?.setText(`${mm}:${ss}`);

    this.player?.update(delta);

    const stPct = this.player.stamina / 100;
    const barW = 100;
    this.staminaBar.width = barW * stPct;
    this.staminaBar.x = (this.scale.width - 10) - barW + (barW * stPct) / 2;
    this.staminaBar.setFillStyle(
      this.player.stamina < 25 ? 0xff4444 : this.player.isSprinting ? 0xffaa00 : 0x44aaff
    );

    const moving = (this.player.body as Phaser.Physics.Arcade.Body)?.speed > 10;
    if (moving) this.sfx.scheduleFootstep(this.player.isSprinting);

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
    const interactJustDown =
      Phaser.Input.Keyboard.JustDown(this.interactKey) ||
      Phaser.Input.Keyboard.JustDown(this.enterKey) ||
      (touchInteract && !this.prevTouchInteract);

    if (interactJustDown && !this.isQuizActive) {
      if (this.isShowingMessage) {
        if (this.messageTimer) { clearTimeout(this.messageTimer); this.messageTimer = null; }
        this.messageBox.setVisible(false);
        this.isShowingMessage = false;
        const cb = this.pendingOnClose;
        this.pendingOnClose = undefined;
        cb?.();
      } else {
        this.checkInteractions();
      }
    }
    this.prevTouchInteract = touchInteract;

    // インタラクトヒント（メッセージ表示中は隠す）
    if (!this.isShowingMessage && !this.isQuizActive) {
      const hint = this.nearestInteractable();
      this.hintLabel?.setText(hint ?? "");
    } else {
      this.hintLabel?.setText("");
    }

    // 危険ビネット：敵が追いかけているとき画面外枠を赤く光らせる
    if (this.dangerVignette) {
      const vigAlpha = chased ? Math.max(0, 0.55 + Math.sin(Date.now() / 180) * 0.3) : 0;
      this.dangerVignette.setStrokeStyle(24, 0xff0000, vigAlpha);
    }
  }

  shutdown() {
    if (this.scareTimer) clearTimeout(this.scareTimer);
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.sfx?.destroy();
  }
}
