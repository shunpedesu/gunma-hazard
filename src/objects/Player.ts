import Phaser from "phaser";

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private baseSpeed = 155;
  private speed = 155;
  public isHiding = false;
  public isDead = false;

  // スタミナ
  public stamina = 100;
  private maxStamina = 100;
  private staminaDrain = 28;   // 毎秒消費
  private staminaRegen = 18;   // 毎秒回復
  private staminaExhausted = false; // 息切れ中
  public isSprinting = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "player");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.shiftKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  }

  update(delta: number) {
    if (this.isDead || this.isHiding) {
      this.setVelocity(0, 0);
      this.isSprinting = false;
      return;
    }

    const touch = (window as any).__TOUCH__;
    const tx: number = touch?.x ?? 0;
    const ty: number = touch?.y ?? 0;
    const DZ = 0.15;

    const left  = this.cursors.left.isDown  || this.wasd.left.isDown  || tx < -DZ;
    const right = this.cursors.right.isDown || this.wasd.right.isDown || tx >  DZ;
    const up    = this.cursors.up.isDown    || this.wasd.up.isDown    || ty < -DZ;
    const down  = this.cursors.down.isDown  || this.wasd.down.isDown  || ty >  DZ;
    const moving = left || right || up || down;

    // スタミナ管理（タッチのDASHボタンも対応）
    const wantSprint = (this.shiftKey.isDown || !!touch?.sprint) && moving && !this.staminaExhausted;
    const dt = delta / 1000;
    if (wantSprint) {
      this.stamina = Math.max(0, this.stamina - this.staminaDrain * dt);
      if (this.stamina === 0) this.staminaExhausted = true;
      this.isSprinting = true;
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * dt);
      if (this.staminaExhausted && this.stamina > 30) this.staminaExhausted = false;
      this.isSprinting = false;
    }
    this.speed = this.isSprinting ? this.baseSpeed * 1.75 : this.baseSpeed;

    // 息切れ時に色を変える
    this.setTint(this.staminaExhausted ? 0xff8888 : 0xffffff);

    if (left) {
      this.setVelocityX(-this.speed);
      this.setFlipX(true);
    } else if (right) {
      this.setVelocityX(this.speed);
      this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }

    if (up) {
      this.setVelocityY(-this.speed);
    } else if (down) {
      this.setVelocityY(this.speed);
    } else {
      this.setVelocityY(0);
    }

    if ((left || right) && (up || down)) {
      this.body!.velocity.normalize().scale(this.speed);
    }
  }
}
