import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/ogp.png");

// ── Windows日本語フォントを登録 ──
const winFonts = "C:/Windows/Fonts";
const jpFonts = ["msgothic.ttc", "meiryo.ttc", "YuGothM.ttc", "YuGothB.ttc", "meiryob.ttc"];
let loaded = "";
for (const f of jpFonts) {
  try {
    GlobalFonts.registerFromPath(`${winFonts}/${f}`);
    if (!loaded) loaded = f;
  } catch {}
}
console.log("Font loaded:", loaded || "none");

const W = 1200, H = 630;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// ── 背景グラデーション ──
const bg = ctx.createLinearGradient(0, 0, 0, H);
bg.addColorStop(0, "#0a0010");
bg.addColorStop(0.5, "#1a0030");
bg.addColorStop(1, "#0a0518");
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);

// ── 星 ──
const rng = (n) => Math.abs(Math.sin(n * 9301 + 49297) * 233280) % 1;
for (let i = 0; i < 80; i++) {
  const x = rng(i) * W;
  const y = rng(i + 100) * H;
  const r = 1 + rng(i + 200) * 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${0.3 + rng(i + 300) * 0.6})`;
  ctx.fill();
}

// ── 霧オーバーレイ ──
const fog = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 500);
fog.addColorStop(0, "rgba(80,0,120,0.15)");
fog.addColorStop(1, "rgba(0,0,0,0)");
ctx.fillStyle = fog;
ctx.fillRect(0, 0, W, H);

// ── 赤ヒビ ──
ctx.strokeStyle = "rgba(200,0,0,0.25)";
ctx.lineWidth = 1.5;
for (const [sx, sy, ex, ey] of [
  [0, 200, 200, 380], [1200, 100, 980, 300],
  [100, 630, 260, 480], [1100, 630, 940, 500],
]) {
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
}

ctx.textAlign = "center";
ctx.textBaseline = "middle";

const jpFont = loaded ? `"MS Gothic","Meiryo","Yu Gothic"` : "serif";

// ── メインタイトル ──
ctx.shadowColor = "#ff0000";
ctx.shadowBlur = 32;
ctx.fillStyle = "#ffffff";
ctx.font = `bold 108px ${jpFont}`;
ctx.fillText("グンマハザード", W / 2, H / 2 - 70);

ctx.shadowBlur = 0;
ctx.strokeStyle = "rgba(200,0,50,0.7)";
ctx.lineWidth = 2;
ctx.strokeText("グンマハザード", W / 2, H / 2 - 70);

// ── サブタイトル ──
ctx.shadowColor = "#880000";
ctx.shadowBlur = 10;
ctx.font = `34px ${jpFont}`;
ctx.fillStyle = "#ffbbbb";
ctx.fillText("群馬から逃げ出せ！ホラーコメディゲーム", W / 2, H / 2 + 30);

// ── ステージ3列 ──
ctx.shadowBlur = 0;
ctx.font = `20px ${jpFont}`;
const stages = [
  { label: "STAGE 1: こんにゃくおばけ", x: W / 2 - 320 },
  { label: "STAGE 2: だるまおばけ",      x: W / 2 },
  { label: "STAGE 3: かるた怨霊",         x: W / 2 + 320 },
];
for (const { label, x } of stages) {
  ctx.fillStyle = "rgba(255,100,100,0.9)";
  ctx.fillText(label, x, H / 2 + 100);
}

// ── 下部URL ──
ctx.font = `18px monospace`;
ctx.fillStyle = "rgba(180,180,180,0.6)";
ctx.fillText("shunpedesu.github.io/gunma-hazard", W / 2, H - 36);

// ── 枠線 ──
ctx.strokeStyle = "rgba(200,50,50,0.6)";
ctx.lineWidth = 4;
ctx.strokeRect(16, 16, W - 32, H - 32);
ctx.strokeStyle = "rgba(255,100,100,0.2)";
ctx.lineWidth = 1;
ctx.strokeRect(24, 24, W - 48, H - 48);

writeFileSync(OUT, canvas.toBuffer("image/png"));
console.log("Done →", OUT);
