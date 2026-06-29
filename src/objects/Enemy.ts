import Phaser from "phaser";
import { Player } from "./Player";

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private player: Player;
  chaseSpeed = 55;
  private detectionRange = 160;
  private isChasing = false;
  private wasChasing = false;
  private patrolPoints: { x: number; y: number }[];
  private currentPatrolIndex = 0;
  private patrolTimer = 0;
  private exclamation!: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    player: Player,
    patrolPoints?: { x: number; y: number }[],
    speed?: number,
    textureKey = "enemy_konnyaku"
  ) {
    super(scene, x, y, textureKey);
    if (speed !== undefined) this.chaseSpeed = speed;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setDepth(10);
    this.player = player;
    this.patrolPoints = patrolPoints ?? [{ x, y }];

    this.exclamation = scene.add.text(x, y - 44, "！", {
      fontSize: "24px", color: "#ff2222",
      stroke: "#000000", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30).setAlpha(0);
  }

  update(delta: number) {
    this.exclamation.setPosition(this.x, this.y - 44);

    if (this.player.isDead) {
      this.setVelocity(0, 0);
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.player.x, this.player.y);

    if (this.player.isHiding) {
      this.isChasing = false;
      this.patrol(delta); // 隠れている間もパトロールを継続（やり過ごせる）
      if (dist < 80) this.scene.cameras.main.shake(200, 0.005);
      return;
    }

    if (dist < this.detectionRange) {
      this.isChasing = true;
    } else if (dist > this.detectionRange * 1.5) {
      this.isChasing = false;
    }

    if (this.isChasing && !this.wasChasing) this.showExclamation();
    this.wasChasing = this.isChasing;

    if (this.isChasing) {
      this.chasePlayer();
    } else {
      this.patrol(delta);
    }
  }

  private showExclamation() {
    this.exclamation.setAlpha(1).setScale(1.5);
    this.scene.tweens.add({
      targets: this.exclamation,
      scaleX: 1, scaleY: 1,
      duration: 200, ease: "Back.easeOut",
    });
    this.scene.time.delayedCall(700, () => {
      this.scene.tweens.add({ targets: this.exclamation, alpha: 0, duration: 300 });
    });
    this.scene.cameras.main.shake(150, 0.008);
  }

  private chasePlayer() {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.player.x, this.player.y);
    this.setVelocityX(Math.cos(angle) * this.chaseSpeed);
    this.setVelocityY(Math.sin(angle) * this.chaseSpeed);
    this.setFlipX(this.player.x < this.x);
  }

  private patrol(delta: number) {
    if (this.patrolPoints.length <= 1) { this.setVelocity(0, 0); return; }
    const target = this.patrolPoints[this.currentPatrolIndex];
    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    if (dist < 8) {
      this.patrolTimer += delta;
      this.setVelocity(0, 0);
      if (this.patrolTimer > 1000) {
        this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
        this.patrolTimer = 0;
      }
    } else {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
      this.setVelocityX(Math.cos(angle) * (this.chaseSpeed * 0.5));
      this.setVelocityY(Math.sin(angle) * (this.chaseSpeed * 0.5));
    }
  }

  public startChase() { this.isChasing = true; }
  public get chasing() { return this.isChasing; }

  destroy(fromScene?: boolean) {
    this.exclamation?.destroy();
    super.destroy(fromScene);
  }
}
