import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { isPublicReadOnlyMode } from "./lib/publicMode";

// ---------------------------------------------------------------------------
// NCAA Women's Basketball half-court dimensions (feet).
// ---------------------------------------------------------------------------
const C = {
  width: 50,
  length: 47,
  // Values match the ESPN NCAAW court SVG (espn-court-light.svg, viewBox
  // 940x500 at 10 units/ft) after visual calibration onto the 3D court.
  laneWidth: 16,
  laneLength: 19,
  ftRadius: 6,
  restrictedRadius: 4,
  threeRadius: 20.75,
  cornerInset: 4.25,
  hoopFromBaseline: 5.25,
  backboardFromBaseline: 4,
  hoopRadius: 0.75,
  rimHeight: 10,
  backboardWidth: 6,
  backboardHeight: 3.5,
};

// Total wall-clock duration of the cinematic intro. Both the drone-cam
// fly-up AND the marker pop-in animations target this so they finish on
// the same frame — pulled out here so they can't drift apart.
const DRONE_INTRO_MS = 4500;

// Camera pose used as the START of the cinematic intro. The renderer
// places the camera here on first frame so the user never sees a flash
// of the default pose before the drone animation kicks in.
const TOPDOWN_CAM = { fov: 22, x: 0, y: 120, z: -0.01 };

const HALF_W = C.width / 2;
const HALF_L = C.length / 2;
const BASELINE_Z = HALF_L;
const HOOP_Z = HALF_L - C.hoopFromBaseline;
const BACKBOARD_Z = HALF_L - C.backboardFromBaseline;
const FT_Z = HALF_L - C.laneLength;
const LANE_X = C.laneWidth / 2;
const CORNER3_X = HALF_W - C.cornerInset;
const CORNER3_ARC_Z = HOOP_Z - Math.sqrt(C.threeRadius ** 2 - CORNER3_X ** 2);

// ---------------------------------------------------------------------------
// Shot-zone classifier — 10 zones, numbered for the heatmap overlay.
// Coordinates are 3D world coords (wx ∈ [-25,25], wz ∈ [-23.5, 23.5]).
// HOOP at (0, HOOP_Z). Higher wz = closer to baseline (behind the hoop on the
// rendered half). Lower wz = closer to half-court line.
// ---------------------------------------------------------------------------
// 12 zones — left/right splits kept for asymmetric defense info; only
// short/long center is collapsed (the area above the FT line in the
// middle is small and rarely shot from).
const ZONES = [
  { id: 1,  label: "Restricted Area"     },
  { id: 2,  label: "Paint"               },
  { id: 3,  label: "Short Midrange Left"  },
  { id: 4,  label: "Short Midrange Right" },
  { id: 5,  label: "Long Midrange Left"   },
  { id: 6,  label: "Midrange Center"      },
  { id: 7,  label: "Long Midrange Right"  },
  { id: 8,  label: "Corner-3 Left"        },
  { id: 9,  label: "Corner-3 Right"       },
  { id: 10, label: "Wing-3 Left"          },
  { id: 11, label: "Top of Key 3"         },
  { id: 12, label: "Wing-3 Right"         },
];

// Distance threshold (ft from hoop) that splits short-mid from long-mid.
const SHORT_MID_MAX_DIST = 14;

// Corner-3 zone extends this many feet *along the 3-pt arc toward the
// wing*. Inner boundary follows the actual arc (curved); the wz floor
// caps how far the strip extends along the sideline.
const CORNER3_WZ_EXTENSION = 5;

// Centroid (label position) per zone in world coords (wx, wz). These
// match the layout saved out of the in-app zone editor on 2026-05-19 —
// the user dragged each label into the spot that reads best against the
// court geometry, then "Copy Layout" emitted this set.
const ZONE_CENTROIDS = {
  1:  { wx:   0,                    wz: 17.75   },               // RA
  2:  { wx:   0.0596,               wz: 10.4031 },               // Paint
  3:  { wx: -11,                    wz: 17.25   },               // Short Midrange Left
  4:  { wx:  11,                    wz: 17.25   },               // Short Midrange Right
  5:  { wx: -16,                    wz: 12.25   },               // Long Midrange Left
  6:  { wx:  -0.0100,               wz:  1.5967 },               // Midrange Center
  7:  { wx:  16,                    wz: 12.25   },               // Long Midrange Right
  8:  { wx: -22.875,                wz: 18.375  },               // Corner-3 Left
  9:  { wx:  22.875,                wz: 18.375  },               // Corner-3 Right
  10: { wx: -17.8397,               wz:  2.8236 },               // Wing-3 Left
  11: { wx:  -0.0548,               wz: -4.9242 },               // Top of Key 3
  12: { wx:  17.9311,               wz:  2.7446 },               // Wing-3 Right
};

// Pure classifier. Returns one of ZONES[i].id for any (wx, wz).
function classifyZoneId(wx, wz) {
  const dx = wx;
  const dz = wz - HOOP_Z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Three-point region. Corner-3's INNER boundary IS the 3-pt arc itself
  // — same curve as the painted line. The wz floor caps how far down the
  // corner-3 strip extends along the sideline before it becomes wing-3.
  // Per-shot scoring uses shot.attemptValue, so absorbing some wing-side
  // shots into the corner-3 zone doesn't inflate 3-pt scoring.
  if (dist > C.threeRadius) {
    if (wz >= (CORNER3_ARC_Z - CORNER3_WZ_EXTENSION)) {
      return wx < 0 ? 8 : 9;     // Corner-3 (curved inner boundary)
    }
    // Wing/top dividers only exist above WING_TOP_DIVIDER_FLOOR. Below
    // that, everything outside the arc collapses to a single zone so
    // black divider lines don't extend deep into the halfcourt area.
    const WING_TOP_DIVIDER_FLOOR = -15;
    if (wz < WING_TOP_DIVIDER_FLOOR) return 11;
    if (wx < -LANE_X) return 10;  // Wing-3 Left
    if (wx >  LANE_X) return 12;  // Wing-3 Right
    return 11;                    // Top of Key 3
  }

  // Two-point region.
  if (dist <= C.restrictedRadius) return 1;
  if (Math.abs(wx) <= LANE_X && wz >= FT_Z && wz <= BASELINE_Z) return 2;

  // Mid-range. Center is one zone (no short/long split). Left/right
  // split by distance from the hoop.
  if (Math.abs(wx) <= LANE_X) return 6;            // Midrange Center
  const isShort = dist <= SHORT_MID_MAX_DIST;
  if (wx < -LANE_X) return isShort ? 3 : 5;        // Short / Long Mid Left
  return isShort ? 4 : 7;                           // Short / Long Mid Right
}

// Assumed physical tile size of the Poly Haven wood_floor texture (feet).
// Bumped up so the court has very few visible tile seams — real arena
// hardwood reads as one continuous surface.
const WOOD_TILE_FT = 26;

// Stanchion sits behind the baseline, like a real arena hoop — the
// backboard cantilevers out over the court from a support behind the endline.
const STANCHION_BEHIND = 3.2; // feet behind baseline
const STANCHION_Z = BASELINE_Z + STANCHION_BEHIND;
// Plinth extends further behind the hoop side so the stanchion base has a
// crimson apron to sit on (like an NCAA baseline apron).
const PLINTH_EXTRA_BEHIND = 14;
// Wood "out of bounds" area around the painted court so the thin painted
// baseline/sideline reads as a line separate from the thick crimson apron.
const OOB_MARGIN = 2;
const FLOOR_W = C.width + OOB_MARGIN * 2;
const FLOOR_L = C.length + OOB_MARGIN * 2;

// Painted court lines use the true OU brand crimson; the 3D apron uses a
// pre-darkened variant so ACES tonemapping + key-light exposure don't lift
// it into a pink. Match the overlay "hot" crimson so the court reads as a
// single brand color.
// Team accent color used for the lane / apron / painted lines / hoop padding.
// Defaults to OU "Athletic Crimson" (Pantone 201) so the existing PDFPage06
// render keeps its branding when no team color is passed in. The component
// reassigns these at the top of its body when `teamPrimaryColor` is supplied.
// They are `let` (not `const`) so the team-aware tool can override them at
// render time; only one instance is ever mounted at a time so there's no
// cross-render contention.
let CRIMSON = "#841617";
let APRON_HEX = 0x841617;
let CRIMSON_HEX = APRON_HEX;
// Wordmark painted on the apron in front of the bench. Defaults to OKLAHOMA
// so PDFPage06 (existing OU showcase) keeps its branding when no team name
// is provided. The component reassigns this at render time when teamWordmark
// is passed in.
let TEAM_WORDMARK = "OKLAHOMA";

// Marker-role colors. These must match the shot-marker fills produced in the
// scene-building useEffect (see PRIMARY_HEX / SHOOTER_HEX / ROLE_HEX usage
// down below). Promoted to module level so `buildFloorAlbedo` can paint the
// in-court legend with the exact same shades.
const MARKER_PRIMARY_HEX = "#3b82f6";
const MARKER_SHOOTER_HEX = "#22c55e";
const MARKER_ROLE_HEX = "#050505";

// Relative-luminance test on a #rrggbb hex string. Used to decide whether
// labels painted on the team's lane color (paint + rim zones) should be
// black-on-light or white-on-dark.
function isHexDark(hex) {
  if (typeof hex !== "string") return false;
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  // sRGB luma weighting (Rec. 709)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 0.5;
}

// ---------------------------------------------------------------------------
// Asset loading
// ---------------------------------------------------------------------------
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Floor: bake wood (tiled) + painted lines + OU logo into a single canvas
// texture. Combined with tiled normal/roughness maps, this reads as one
// continuous painted hardwood floor.
// ---------------------------------------------------------------------------
function buildFloorAlbedo(woodImage, ouLogoImage) {
  const ppf = 44; // pixels per foot
  const W = Math.round(FLOOR_W * ppf);
  const H = Math.round(FLOOR_L * ppf);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Tile the wood pattern at WOOD_TILE_FT feet per tile
  const tilePx = Math.round(WOOD_TILE_FT * ppf);
  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = tilePx;
  tileCanvas.height = tilePx;
  tileCanvas.getContext("2d").drawImage(woodImage, 0, 0, tilePx, tilePx);
  ctx.fillStyle = ctx.createPattern(tileCanvas, "repeat");
  ctx.fillRect(0, 0, W, H);

  // Gentle lift to pull the wood base toward a neutral honey maple without
  // over-saturating it into a yellow/orange cast.
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(170, 140, 102, 1)";
  ctx.fillRect(0, 0, W, H);

  // Mild amber multiply for grain depth — kept subtle to avoid yellow tint.
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(215, 188, 150, 1)";
  ctx.fillRect(0, 0, W, H);

  // --- Plank flooring: real maple courts are installed as strip-oak in
  // ~2.25" wide boards running the length of the court. Alternate a very
  // slight warm/cool tint per plank so the wood reads as individual boards
  // rather than a single continuous photo, then drop a thin dark seam line
  // between every plank.
  ctx.globalCompositeOperation = "source-over";
  const plankWidthFt = 1.0;                  // 1 ft wide panels
  const buttFt = 3.0;                        // 3 ft long panels
  const seamPx = Math.max(1, Math.round(0.012 * ppf));
  let pIdx = 0;
  for (let fx = -FLOOR_W / 2; fx <= FLOOR_W / 2; fx += plankWidthFt, pIdx += 1) {
    const px = (fx + FLOOR_W / 2) * ppf;
    const tint = (pIdx * 53) % 7;
    // Alternating per-plank tone (very subtle) to break up repetition.
    if (tint < 2) {
      ctx.fillStyle = "rgba(210, 170, 110, 0.10)";
      ctx.fillRect(Math.round(px), 0, Math.round(plankWidthFt * ppf), H);
    } else if (tint === 6) {
      ctx.fillStyle = "rgba(160, 120,  70, 0.08)";
      ctx.fillRect(Math.round(px), 0, Math.round(plankWidthFt * ppf), H);
    }
    // Very subtle seam between planks.
    ctx.fillStyle = "rgba( 55,  32,  14, 0.18)";
    ctx.fillRect(Math.round(px), 0, seamPx, H);
  }
  // Staggered end-joints (butt joints) every 3 ft.
  ctx.fillStyle = "rgba( 40,  22,   8, 0.18)";
  for (let fx = -FLOOR_W / 2, i = 0; fx <= FLOOR_W / 2; fx += plankWidthFt, i += 1) {
    const offset = ((i * 11) % 13) * (buttFt / 13);
    for (let fz = -FLOOR_L / 2 + offset; fz <= FLOOR_L / 2; fz += buttFt) {
      const px = (fx + FLOOR_W / 2) * ppf;
      const py = (fz + FLOOR_L / 2) * ppf;
      ctx.fillRect(Math.round(px), Math.round(py), Math.round(plankWidthFt * ppf), seamPx);
    }
  }

  // Final warm varnish glaze — very low alpha so grain still shows through.
  ctx.fillStyle = "rgba(232, 208, 170, 0.10)";
  ctx.fillRect(0, 0, W, H);

  // Court→canvas coord helpers. The canvas is FLOOR_W × FLOOR_L, with the
  // painted court boundary (50 × 47) inset by OOB_MARGIN on each side.
  const cx = (x) => (x + HALF_W + OOB_MARGIN) * ppf;
  const cy = (z) => (BASELINE_Z + OOB_MARGIN - z) * ppf;

  // Slightly darker tan inside the 3-point region so the scoring zone reads
  // as a distinct color family from the rest of the floor. Painted crimson
  // (lane) will cover this where it overlaps.
  {
    const cornerAngleFill = Math.asin(
      (HOOP_Z - CORNER3_ARC_Z) / C.threeRadius
    );
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx(CORNER3_X), cy(BASELINE_Z));
    ctx.lineTo(cx(CORNER3_X), cy(CORNER3_ARC_Z));
    ctx.arc(
      cx(0),
      cy(HOOP_Z),
      C.threeRadius * ppf,
      cornerAngleFill,
      Math.PI - cornerAngleFill,
      false
    );
    ctx.lineTo(cx(-CORNER3_X), cy(BASELINE_Z));
    ctx.closePath();
    ctx.fillStyle = "rgba(70, 45, 18, 0.20)";
    ctx.fill();
    ctx.restore();
  }

  // Crimson fill for the lane (painted key).
  ctx.fillStyle = CRIMSON;
  ctx.fillRect(
    cx(-LANE_X),
    cy(BASELINE_Z),
    C.laneWidth * ppf,
    C.laneLength * ppf
  );

  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 0.2 * ppf;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  // Court outline — painted at the true 50×47 court boundary, leaving
  // OOB_MARGIN of wood beyond.
  ctx.strokeRect(
    cx(-HALF_W),
    cy(BASELINE_Z),
    C.width * ppf,
    C.length * ppf
  );

  // Half-court line (at z = −HALF_L, the far side)
  ctx.beginPath();
  ctx.moveTo(cx(-HALF_W), cy(-HALF_L));
  ctx.lineTo(cx(HALF_W), cy(-HALF_L));
  ctx.stroke();

  // Lane (key)
  ctx.strokeRect(
    cx(-LANE_X),
    cy(BASELINE_Z),
    C.laneWidth * ppf,
    C.laneLength * ppf
  );

  // Backboard floor mark
  ctx.beginPath();
  ctx.moveTo(cx(-C.backboardWidth / 2), cy(BACKBOARD_Z));
  ctx.lineTo(cx(C.backboardWidth / 2), cy(BACKBOARD_Z));
  ctx.stroke();

  // 3-point arc
  const cornerAngle = Math.asin((HOOP_Z - CORNER3_ARC_Z) / C.threeRadius);
  ctx.beginPath();
  ctx.arc(
    cx(0),
    cy(HOOP_Z),
    C.threeRadius * ppf,
    cornerAngle,
    Math.PI - cornerAngle,
    false
  );
  ctx.stroke();

  // Corner-3 straight lines
  ctx.beginPath();
  ctx.moveTo(cx(-CORNER3_X), cy(BASELINE_Z));
  ctx.lineTo(cx(-CORNER3_X), cy(CORNER3_ARC_Z));
  ctx.moveTo(cx(CORNER3_X), cy(BASELINE_Z));
  ctx.lineTo(cx(CORNER3_X), cy(CORNER3_ARC_Z));
  ctx.stroke();

  // Free-throw circle — solid half
  ctx.beginPath();
  ctx.arc(cx(0), cy(FT_Z), C.ftRadius * ppf, 0, Math.PI, false);
  ctx.stroke();

  // FT circle — dashed half (toward baseline)
  ctx.save();
  ctx.setLineDash([22, 12]);
  ctx.beginPath();
  ctx.arc(cx(0), cy(FT_Z), C.ftRadius * ppf, Math.PI, Math.PI * 2, false);
  ctx.stroke();
  ctx.restore();

  // Lane block ticks
  [7, 10, 13, 16].forEach((off) => {
    const z = BASELINE_Z - off;
    const zy = cy(z);
    ctx.beginPath();
    ctx.moveTo(cx(-LANE_X - 0.7), zy);
    ctx.lineTo(cx(-LANE_X), zy);
    ctx.moveTo(cx(LANE_X), zy);
    ctx.lineTo(cx(LANE_X + 0.7), zy);
    ctx.stroke();
  });

  // Coaches-box hash marks on sideline (28 ft from baseline)
  const coachZ = BASELINE_Z - 28;
  ctx.beginPath();
  ctx.moveTo(cx(-HALF_W), cy(coachZ));
  ctx.lineTo(cx(-HALF_W + 3), cy(coachZ));
  ctx.moveTo(cx(HALF_W - 3), cy(coachZ));
  ctx.lineTo(cx(HALF_W), cy(coachZ));
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

// Paint the classic Oklahoma interlocking-OU block-letter wordmark.
// Units: `s` is one "letter-scale unit" (roughly 1 ft in court feet).
// The camera looks at the court with +X on its left, so we draw O on world
// +X (camera-left) and U on world −X (camera-right) → reads "OU".
//
// Style details (matching the OU wordmark):
// - O is a thick rounded-rectangle ring (bold, roughly square)
// - U is a thick block U with rounded bottom-outer corners, flat/square top
// - A small serif tab on the U's right leg inside-top (identifying feature)
// - The two letters interlock: the O's right edge tucks behind the U's left
function drawOULogo(ctx, cx0, cy0, s) {
  ctx.save();
  ctx.fillStyle = CRIMSON;

  const letterH = 3.4 * s;
  const strokeT = 0.62 * s;
  // Letters sit side-by-side with a small gap (matching the user's ref).
  // Positive = overlap (interlocked); negative = gap between letters.
  const overlap = -0.18 * s;

  // --- O: thick rounded-rectangle ring on camera-LEFT (+X side) ---
  const oW = 2.35 * s;
  const oH = letterH;
  const oX = cx0 + oW / 2 - overlap / 2;
  const oCornerOuter = 0.55 * s;
  const oCornerInner = Math.max(oCornerOuter - strokeT * 0.55, 0.14 * s);
  ctx.beginPath();
  roundedRectPath(
    ctx,
    oX - oW / 2,
    cy0 - oH / 2,
    oW,
    oH,
    oCornerOuter
  );
  roundedRectPath(
    ctx,
    oX - oW / 2 + strokeT,
    cy0 - oH / 2 + strokeT,
    oW - 2 * strokeT,
    oH - 2 * strokeT,
    oCornerInner
  );
  ctx.fill("evenodd");

  // --- U: block letter on camera-RIGHT (−X side), tucked under the O ---
  const uW = 2.45 * s;
  const uH = letterH;
  const uX = cx0 - uW / 2 + overlap / 2;
  const uR = 0.95 * s;                         // outer bottom-corner radius
  const uIR = Math.max(uR - strokeT, 0.2 * s); // inner bottom-corner radius
  const L = uX - uW / 2;
  const R = uX + uW / 2;
  const T = cy0 - uH / 2;
  const B = cy0 + uH / 2;

  ctx.beginPath();
  // Outer perimeter: TL → down-left → rounded bottom → up-right → top of right leg
  ctx.moveTo(L, T);
  ctx.lineTo(L, B - uR);
  ctx.quadraticCurveTo(L, B, L + uR, B);
  ctx.lineTo(R - uR, B);
  ctx.quadraticCurveTo(R, B, R, B - uR);
  ctx.lineTo(R, T);
  ctx.lineTo(R - strokeT, T);
  // Inner perimeter: down right-leg-inside → rounded inner bottom → up left-leg-inside → across top
  ctx.lineTo(R - strokeT, B - strokeT - uIR);
  ctx.quadraticCurveTo(R - strokeT, B - strokeT, R - strokeT - uIR, B - strokeT);
  ctx.lineTo(L + strokeT + uIR, B - strokeT);
  ctx.quadraticCurveTo(L + strokeT, B - strokeT, L + strokeT, B - strokeT - uIR);
  ctx.lineTo(L + strokeT, T);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// Helper: trace a rounded-rect subpath onto the current canvas path.
function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

// ---------------------------------------------------------------------------
// Hoop assembly (procedural but with nicer PBR materials)
// ---------------------------------------------------------------------------
function roundedBox(width, height, depth, radius, color, roughness = 0.55) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -depth / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius);
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSize: 0.04,
    bevelThickness: 0.04,
    bevelSegments: 2,
  });
  geom.rotateX(-Math.PI / 2);
  // After rotation the extruded solid spans y=0..height in local space;
  // shift DOWN by height/2 so it's centered on y=0 (mesh.position.y sets the center).
  geom.translate(0, -height / 2, 0);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.05,
  });
  return new THREE.Mesh(geom, mat);
}

function buildHoopAssembly() {
  const group = new THREE.Group();

  // ---- Heavy padded base (Sketchfab-style: big, black, wide, padded) ----
  // A pro portable hoop has a long rectangular padded base running
  // front-to-back, wider than the pole, with slight crown on top.
  const baseBodyMat = new THREE.MeshStandardMaterial({
    color: 0x0d0d0d, roughness: 0.62, metalness: 0.12,
  });
  const baseBody = roundedBox(5.2, 2.2, 7.2, 0.28, 0x0d0d0d, 0.62);
  baseBody.material = baseBodyMat;
  baseBody.position.set(0, 1.1, STANCHION_Z + 0.4);
  baseBody.castShadow = true;
  baseBody.receiveShadow = true;
  group.add(baseBody);

  // Slim chrome kick-plate caps on the front/rear of the base for detail
  const kickMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, roughness: 0.35, metalness: 0.85,
  });
  const kickFront = new THREE.Mesh(new THREE.BoxGeometry(5.25, 0.32, 0.08), kickMat);
  kickFront.position.set(0, 0.22, STANCHION_Z + 0.4 - 3.6);
  group.add(kickFront);
  const kickRear = kickFront.clone();
  kickRear.position.z = STANCHION_Z + 0.4 + 3.6;
  group.add(kickRear);

  // ---- Pole: thick rectangular black stanchion (not a round cylinder) ----
  const baseTopY = 2.2; // top of baseBody
  const poleTopY = 10.5;
  const poleH = poleTopY - baseTopY;
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x141414, roughness: 0.4, metalness: 0.7,
  });
  const pole = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, poleH, 0.75),
    poleMat
  );
  pole.position.set(0, (baseTopY + poleTopY) / 2, STANCHION_Z);
  pole.castShadow = true;
  group.add(pole);

  // Horizontal cantilever arm from pole forward to backboard (rectangular)
  const armLen = Math.abs(STANCHION_Z - BACKBOARD_Z) + 0.4;
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.45, armLen),
    poleMat
  );
  arm.position.set(0, 10.25, (STANCHION_Z + BACKBOARD_Z) / 2);
  arm.castShadow = true;
  group.add(arm);

  // Diagonal triangular support strut under the arm (real pro hoops have
  // a visible triangulated brace from mid-arm down to the upper pole).
  const strutMat = new THREE.MeshStandardMaterial({
    color: 0x141414, roughness: 0.4, metalness: 0.7,
  });
  const strutFromZ = STANCHION_Z;
  const strutFromY = 6.5;
  const strutToZ = (STANCHION_Z + BACKBOARD_Z) / 2;
  const strutToY = 10.05;
  const strutDZ = strutToZ - strutFromZ;
  const strutDY = strutToY - strutFromY;
  const strutLen = Math.sqrt(strutDZ * strutDZ + strutDY * strutDY);
  const strut = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.25, strutLen),
    strutMat
  );
  strut.position.set(0, (strutFromY + strutToY) / 2, (strutFromZ + strutToZ) / 2);
  strut.rotation.x = Math.atan2(strutDY, strutDZ);
  strut.castShadow = true;
  group.add(strut);

  // Padded bumper wrap around the lower pole (thick black sleeve above base)
  const poleBumper = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 2.6, 1.15),
    new THREE.MeshStandardMaterial({
      color: 0x0a0a0a, roughness: 0.85, metalness: 0.02,
    })
  );
  poleBumper.position.set(0, baseTopY + 1.3, STANCHION_Z);
  group.add(poleBumper);

  // Crimson "OU" band wraps the bumper (just a thin painted stripe)
  const bumperBand = new THREE.Mesh(
    new THREE.BoxGeometry(1.17, 0.35, 1.17),
    new THREE.MeshStandardMaterial({
      color: CRIMSON_HEX, roughness: 0.6, metalness: 0.08,
    })
  );
  bumperBand.position.set(0, baseTopY + 2.2, STANCHION_Z);
  group.add(bumperBand);

  // ---- Backboard: clear tempered glass with white frame ----
  const backboardY = 11.25;
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xf6f6f4, roughness: 0.35, metalness: 0.2,
  });
  const frameT = new THREE.Mesh(
    new THREE.BoxGeometry(C.backboardWidth + 0.22, 0.12, 0.18),
    frameMat
  );
  frameT.position.set(0, backboardY + C.backboardHeight / 2 + 0.04, BACKBOARD_Z);
  group.add(frameT);
  const frameL = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, C.backboardHeight + 0.22, 0.18),
    frameMat
  );
  frameL.position.set(-C.backboardWidth / 2 - 0.06, backboardY, BACKBOARD_Z);
  group.add(frameL);
  const frameR = frameL.clone();
  frameR.position.x = C.backboardWidth / 2 + 0.06;
  group.add(frameR);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(C.backboardWidth, C.backboardHeight, 0.12),
    new THREE.MeshPhysicalMaterial({
      color: 0xf0f4f7,
      roughness: 0.03,
      metalness: 0,
      transmission: 0.95,
      transparent: true,
      opacity: 0.45,
      ior: 1.48,
      thickness: 0.12,
      clearcoat: 0.9,
      clearcoatRoughness: 0.05,
    })
  );
  glass.position.set(0, backboardY, BACKBOARD_Z);
  group.add(glass);

  // Shooter's square painted behind the rim (BLACK per NBA/NCAA standard)
  const squareMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.6,
  });
  const squareTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.04, 0.06, 0.02),
    squareMat
  );
  squareTop.position.set(0, backboardY - 0.45 + 1.2, BACKBOARD_Z + 0.08);
  group.add(squareTop);
  const squareBot = new THREE.Mesh(
    new THREE.BoxGeometry(2.04, 0.06, 0.02),
    squareMat
  );
  squareBot.position.set(0, backboardY - 0.45, BACKBOARD_Z + 0.08);
  group.add(squareBot);
  const squareL = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.2, 0.02),
    squareMat
  );
  squareL.position.set(-1, backboardY - 0.45 + 0.6, BACKBOARD_Z + 0.08);
  group.add(squareL);
  const squareR = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.2, 0.02),
    squareMat
  );
  squareR.position.set(1, backboardY - 0.45 + 0.6, BACKBOARD_Z + 0.08);
  group.add(squareR);

  // ---- Thick padded bottom bumper (black with crimson stripe, branded) ----
  const bbPadMain = new THREE.Mesh(
    new THREE.BoxGeometry(C.backboardWidth + 0.3, 0.55, 0.35),
    new THREE.MeshStandardMaterial({
      color: 0x0a0a0a, roughness: 0.85, metalness: 0.03,
    })
  );
  bbPadMain.position.set(0, backboardY - C.backboardHeight / 2 - 0.15, BACKBOARD_Z);
  bbPadMain.castShadow = true;
  group.add(bbPadMain);
  // Crimson accent stripe on the front of the pad
  const bbPadStripe = new THREE.Mesh(
    new THREE.BoxGeometry(C.backboardWidth + 0.31, 0.14, 0.02),
    new THREE.MeshStandardMaterial({
      color: CRIMSON_HEX, roughness: 0.6, metalness: 0.06,
    })
  );
  bbPadStripe.position.set(0, backboardY - C.backboardHeight / 2 - 0.15, BACKBOARD_Z - 0.18);
  group.add(bbPadStripe);

  // ---- Mounting bracket + heavy-duty plate bolted to glass ----
  // Thick silver backing plate against the glass (what the bracket bolts to)
  const glassPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.05),
    new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, roughness: 0.45, metalness: 0.75,
    })
  );
  glassPlate.position.set(0, C.rimHeight, BACKBOARD_Z - 0.085);
  group.add(glassPlate);

  // 4 visible mounting bolts on the plate
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x888888, roughness: 0.35, metalness: 0.9,
  });
  const boltPositions = [
    [-0.32,  0.32], [ 0.32,  0.32],
    [-0.32, -0.32], [ 0.32, -0.32],
  ];
  for (const [bx, by] of boltPositions) {
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.06, 10),
      boltMat
    );
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(bx, C.rimHeight + by, BACKBOARD_Z - 0.11);
    group.add(bolt);
  }

  // Beefy orange mounting arm running from the plate out to the rim
  const bracketLen = (HOOP_Z - BACKBOARD_Z) - 0.2;
  const bracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.5, Math.abs(bracketLen)),
    new THREE.MeshStandardMaterial({
      color: 0xc45317, roughness: 0.45, metalness: 0.55,
    })
  );
  bracket.position.set(
    0,
    C.rimHeight - 0.02,
    (HOOP_Z + BACKBOARD_Z) / 2 - 0.02
  );
  bracket.castShadow = true;
  group.add(bracket);

  // Spring housing where the rim joins the bracket (breakaway mechanism)
  const springHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.38, 18),
    new THREE.MeshStandardMaterial({
      color: 0x222222, roughness: 0.38, metalness: 0.78,
    })
  );
  springHousing.rotation.x = Math.PI / 2;
  springHousing.position.set(0, C.rimHeight - 0.05, HOOP_Z - 0.34);
  group.add(springHousing);

  // ---- Rim: bright orange, chunky ----
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(C.hoopRadius, 0.085, 20, 64),
    new THREE.MeshStandardMaterial({
      color: 0xf4701f, roughness: 0.3, metalness: 0.6,
    })
  );
  rim.position.set(0, C.rimHeight, HOOP_Z);
  rim.rotation.x = -Math.PI / 2;
  rim.castShadow = true;
  group.add(rim);

  // Net-attachment ring just below the rim (where the net hooks hang)
  const netRing = new THREE.Mesh(
    new THREE.TorusGeometry(C.hoopRadius - 0.02, 0.028, 10, 48),
    new THREE.MeshStandardMaterial({
      color: 0x8f3d12, roughness: 0.45, metalness: 0.55,
    })
  );
  netRing.position.set(0, C.rimHeight - 0.11, HOOP_Z);
  netRing.rotation.x = -Math.PI / 2;
  group.add(netRing);

  // Net — proper criss-cross (diamond-mesh) pattern between rim & bottom.
  // Each "row" is a ring of points; rows are connected by segments that
  // alternate left/right to form diamonds, like a real basketball net.
  const NET_SEG = 12;                      // points per ring
  const netRows = [
    { y: 0,     r: 1.00 },  // at the rim
    { y: -0.45, r: 0.86 },
    { y: -0.85, r: 0.72 },
    { y: -1.15, r: 0.60 },
    { y: -1.35, r: 0.52 },  // tapered bottom
  ];
  const netMat = new THREE.LineBasicMaterial({
    color: 0xf2f2f2,
    transparent: true,
    opacity: 0.88,
  });
  const netPoint = (row, i) => {
    const rowData = netRows[row];
    const a = (i / NET_SEG) * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(a) * C.hoopRadius * rowData.r,
      C.rimHeight + rowData.y,
      Math.sin(a) * C.hoopRadius * rowData.r + HOOP_Z
    );
  };
  // Horizontal rings (each row closed)
  for (let r = 0; r < netRows.length; r += 1) {
    const pts = [];
    for (let i = 0; i <= NET_SEG; i += 1) pts.push(netPoint(r, i % NET_SEG));
    group.add(
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), netMat)
    );
  }
  // Diagonal criss-cross between rows, alternating direction each row
  for (let r = 0; r < netRows.length - 1; r += 1) {
    for (let i = 0; i < NET_SEG; i += 1) {
      const shift = r % 2 === 0 ? 1 : 0;
      const pts1 = [netPoint(r, i), netPoint(r + 1, (i + shift) % NET_SEG)];
      const pts2 = [netPoint(r, (i + 1) % NET_SEG), netPoint(r + 1, (i + shift) % NET_SEG)];
      group.add(
        new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts1), netMat)
      );
      group.add(
        new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), netMat)
      );
    }
  }

  // Shot clock assembly on top of the backboard — two thin support arms,
  // matte black housing, and a bright red LED "24" baked into a canvas.
  const clockSupportMat = new THREE.MeshStandardMaterial({
    color: 0x1d1d1d, roughness: 0.5, metalness: 0.65,
  });
  const supportL = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.9, 0.12),
    clockSupportMat
  );
  supportL.position.set(-0.55, backboardY + C.backboardHeight / 2 + 0.95, BACKBOARD_Z);
  group.add(supportL);
  const supportR = supportL.clone();
  supportR.position.x = 0.55;
  group.add(supportR);

  // Clock housing — slightly wider, darker, more rugged
  const clockBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.35, 0.42),
    new THREE.MeshStandardMaterial({
      color: 0x0a0a0a, roughness: 0.42, metalness: 0.3,
    })
  );
  const clockY = backboardY + C.backboardHeight / 2 + 2.55;
  clockBody.position.set(0, clockY, BACKBOARD_Z);
  group.add(clockBody);

  // Thin crimson bezel around the display
  const clockBezel = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 1.1, 0.04),
    new THREE.MeshStandardMaterial({
      color: CRIMSON_HEX, roughness: 0.5, metalness: 0.2,
    })
  );
  clockBezel.position.set(0, clockY, BACKBOARD_Z - 0.21);
  group.add(clockBezel);

  // LED "24" baked onto a canvas — bright emissive red so it "glows"
  const ledCanvas = document.createElement("canvas");
  ledCanvas.width = 512;
  ledCanvas.height = 256;
  const lctx = ledCanvas.getContext("2d");
  // Pitch-black background
  lctx.fillStyle = "#050505";
  lctx.fillRect(0, 0, 512, 256);
  // Faint dotted LED matrix for texture
  lctx.fillStyle = "rgba(80,20,20,0.35)";
  for (let y = 14; y < 256; y += 10) {
    for (let x = 14; x < 512; x += 10) {
      lctx.fillRect(x, y, 3, 3);
    }
  }
  // Main red "24" — 7-segment style using a bold monospace font
  lctx.shadowColor = "#ff2a1a";
  lctx.shadowBlur = 28;
  lctx.fillStyle = "#ff3b1e";
  lctx.font = "bold 220px 'Courier New', monospace";
  lctx.textAlign = "center";
  lctx.textBaseline = "middle";
  lctx.fillText("24", 256, 138);
  // Brighter inner fill pass for hotter core
  lctx.shadowBlur = 8;
  lctx.fillStyle = "#ffdccf";
  lctx.fillText("24", 256, 138);

  const ledTex = new THREE.CanvasTexture(ledCanvas);
  ledTex.anisotropy = 8;
  const clockFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85, 0.95),
    new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false })
  );
  clockFace.position.set(0, clockY, BACKBOARD_Z - 0.225);
  clockFace.rotation.y = Math.PI;
  group.add(clockFace);

  // Small red status pip on the top of the clock housing
  const statusLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff3b1e, toneMapped: false })
  );
  statusLed.position.set(0.9, clockY + 0.72, BACKBOARD_Z - 0.15);
  group.add(statusLed);

  // Cream OU sponsor panels on the sides & front of the new wider base.
  // Base: 5.2 wide × 2.6 tall × 7.2 deep, centered at (0, 1.3, STANCHION_Z + 0.4).
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0xfdf9d8, roughness: 0.5,
  });
  const baseSideZ = STANCHION_Z + 0.4; // center of base on Z
  const panelL = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.4), panelMat);
  panelL.position.set(-2.601, 1.4, baseSideZ);
  panelL.rotation.y = -Math.PI / 2;
  group.add(panelL);
  const panelR = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.4), panelMat);
  panelR.position.set(2.601, 1.4, baseSideZ);
  panelR.rotation.y = Math.PI / 2;
  group.add(panelR);
  // Front panel faces the COURT (−Z side of the base)
  const panelFront = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.4), panelMat);
  panelFront.position.set(0, 1.4, baseSideZ - 3.601);
  panelFront.rotation.y = Math.PI;
  group.add(panelFront);

  return group;
}

// ---------------------------------------------------------------------------
// Load the downloaded STL hoop (3D-printable pro hoop kit) from /public/hoop/
// and apply per-category materials. Returns a Promise<Group>.
//
// Categories → materials:
//   Base/*, Boom/*, Supports/*, Weight_Bucket/* → matte black metal
//   Accessories/* → matte black (handles, hydraulic, camera mount, screens)
//   Backboard/Left_Backboard, Right_Backboard → clear glass
//   Backboard/Top_Backboard, Backboard_Mount, Backboard_Arm_* → white frame
//   Padding/** → padded black
//   Ring/* → bright orange
// ---------------------------------------------------------------------------
function loadProHoop(ouLogoImage) {
  const stlLoader = new STLLoader();

  // Shared materials
  const matBlackMetal = new THREE.MeshStandardMaterial({
    color: 0x141414, roughness: 0.45, metalness: 0.7,
  });
  // Crimson padding on the base/arm/support pads. Unlit + toneMapped:false so
  // it renders the exact team hex and matches the apron / lane crimson.
  const matPaddingCrimson = new THREE.MeshBasicMaterial({ color: CRIMSON_HEX, toneMapped: false });
  // Backboard safety bumper stays black (standard for glass-edge padding).
  const matPaddingBlack = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a, roughness: 0.88, metalness: 0.03,
  });
  // Light grey for the Board_Padding pads that wrap the backboard edges.
  const matPaddingGrey = new THREE.MeshStandardMaterial({
    color: 0xbfbfbf, roughness: 0.75, metalness: 0.08,
  });
  const matFrame = new THREE.MeshStandardMaterial({
    color: 0xf4f2ed, roughness: 0.4, metalness: 0.2,
  });
  // Tempered-glass backboard: visible against dark backgrounds thanks to a
  // slight blue-gray tint + moderate opacity. No transmission pass needed so
  // it renders reliably, and kept semi-transparent so the rim bracket is
  // visible through it from behind.
  const matGlass = new THREE.MeshPhysicalMaterial({
    color: 0xb8c7cf,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.55,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    side: THREE.DoubleSide,
    envMapIntensity: 1.3,
  });
  const matRim = new THREE.MeshStandardMaterial({
    color: 0xf4701f, roughness: 0.32, metalness: 0.6,
  });

  // Explicit list of parts + materials. Using encodeURI to handle the spaces
  // and "x2" in the filenames.
  const parts = [
    // Base (heavy padded base)
    ["Base/Base_Front.stl", matBlackMetal],
    ["Base/Base_Top_Left_Join.stl", matBlackMetal],
    ["Base/Base_Top_Right_Join.stl", matBlackMetal],
    ["Base/Base_Top_rear.stl", matBlackMetal],
    ["Base/Bottom_Left_Join.stl", matBlackMetal],
    ["Base/Bottom_Rear_Base.stl", matBlackMetal],
    ["Base/Bottom_Right_Join.stl", matBlackMetal],
    // Boom (main arm connecting base to backboard) — crimson for OU branding.
    ["Boom/Boom_1.stl", matPaddingCrimson],
    ["Boom/Boom_2.stl", matPaddingCrimson],
    ["Boom/Boom_3.stl", matPaddingCrimson],
    ["Boom/Boom_4.stl", matPaddingCrimson],
    ["Boom/Boom_5.stl", matPaddingCrimson],
    ["Boom/Boom_6.stl", matPaddingCrimson],
    // Supports
    ["Supports/Front_Support_1.stl", matBlackMetal],
    ["Supports/Front_Support_2.stl", matBlackMetal],
    ["Supports/Front_Support_3.stl", matBlackMetal],
    ["Supports/Front_Support_Rod.stl", matBlackMetal],
    ["Supports/Front_Support_Spacer x2.stl", matBlackMetal],
    ["Supports/Rear-Support_Rod.stl", matBlackMetal],
    ["Supports/Rear_Support.stl", matBlackMetal],
    ["Supports/Rear_Support_Spacer x2.stl", matBlackMetal],
    // Weight bucket + loose accessories omitted — they read as floating
    // parts around the rig rather than load-bearing structure.
    // Backboard — Left/Right/Top are the 3 print-sized panels of the glass
    // board (combined they form the full tempered-glass surface).
    ["Backboard/Left_Backboard.stl", matGlass],
    ["Backboard/Right_Backboard.stl", matGlass],
    ["Backboard/Top_Backboard.stl", matGlass],
    ["Backboard/Backboard_Mount.stl", matBlackMetal],
    ["Backboard/Backboard_Arm_Left.stl", matBlackMetal],
    ["Backboard/Backboard_Arm_Right.stl", matBlackMetal],
    // Padding — all crimson to match team branding.
    ["Padding/Front_Base_Padding.stl", matPaddingCrimson],
    ["Padding/Left_Side_Padding.stl", matPaddingCrimson],
    ["Padding/Right_Side_Padding.stl", matPaddingCrimson],
    ["Padding/Front_Padding/Front_Support_Padding_1.stl", matPaddingCrimson],
    ["Padding/Front_Padding/Front_Support_Padding_2.stl", matPaddingCrimson],
    ["Padding/Front_Padding/Front_Support_Padding_3.stl", matPaddingCrimson],
    ["Padding/Arm_Padding/Front_Arm_Padding.stl", matPaddingCrimson],
    ["Padding/Board_Padding/Backboard_Padding_Left.stl", matPaddingGrey],
    ["Padding/Board_Padding/Backboard_Padding_Right.stl", matPaddingGrey],
    // Ring (rim + net ring)
    ["Ring/Ring_1.stl", matRim],
    ["Ring/Ring_2.stl", matRim],
  ];

  const rawGroup = new THREE.Group();
  rawGroup.name = "proHoopRaw";
  const ringMeshes = [];      // rim meshes (for positioning the net)
  const backboardMeshes = []; // STL glass panel pieces (we'll hide + replace)
  const frontPadMeshes = []; // front base padding (for the OU logo decal)
  const boardPadMeshes = []; // backboard padding (Board_Padding/*) — offset forward
  const mountMeshes = [];    // backboard mount + arms — offset forward to reach board

  const FRONT_PAD_PATHS = new Set([
    "Padding/Front_Base_Padding.stl",
  ]);

  const BOARD_GLASS_PATHS = new Set([
    "Backboard/Left_Backboard.stl",
    "Backboard/Right_Backboard.stl",
    "Backboard/Top_Backboard.stl",
  ]);

  const BOARD_PAD_PATHS = new Set([
    "Padding/Board_Padding/Backboard_Padding_Left.stl",
    "Padding/Board_Padding/Backboard_Padding_Right.stl",
  ]);

  const MOUNT_PATHS = new Set([
    "Backboard/Backboard_Mount.stl",
    "Backboard/Backboard_Arm_Left.stl",
    "Backboard/Backboard_Arm_Right.stl",
  ]);

  const loads = parts.map(([relPath, mat]) =>
    new Promise((resolve) => {
      stlLoader.load(
        encodeURI(`/hoop/${relPath}`),
        (geom) => {
          geom.computeVertexNormals();
          const mesh = new THREE.Mesh(geom, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.partPath = relPath;
          rawGroup.add(mesh);
          if (relPath.startsWith("Ring/")) ringMeshes.push(mesh);
          if (BOARD_GLASS_PATHS.has(relPath)) backboardMeshes.push(mesh);
          if (FRONT_PAD_PATHS.has(relPath)) frontPadMeshes.push(mesh);
          if (BOARD_PAD_PATHS.has(relPath)) boardPadMeshes.push(mesh);
          if (MOUNT_PATHS.has(relPath)) mountMeshes.push(mesh);
          resolve(true);
        },
        undefined,
        () => {
          console.warn(`[hoop] failed to load ${relPath}`);
          resolve(false);
        }
      );
    })
  );

  return Promise.all(loads).then(() => {
    // The STL is in 3D-printer units (mm) with Z-up.
    //   Step 1: rotate rawGroup so Z-up → Y-up AND spin 180° so the rim
    //           points toward the court (−Z).
    //   Step 2: auto-scale by bbox so hoop is ~13.5 ft tall.
    //   Step 3: reposition so it sits on the floor, centered on x=0, with
    //           the rim right over HOOP_Z.
    //   Step 4: find the scaled rim center, attach a procedural net.
    const wrapper = new THREE.Group();
    wrapper.name = "proHoop";

    // Inner pivot handles the coordinate-system conversion.
    const pivot = new THREE.Group();
    pivot.add(rawGroup);
    // Z-up → Y-up, then spin 180° around Y so the rim faces the court.
    rawGroup.rotation.x = -Math.PI / 2;
    rawGroup.rotation.z = Math.PI; // in local (pre-X-rotate) coords this flips front/back
    wrapper.add(pivot);

    // Measure after rotation
    wrapper.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(rawGroup);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    // Target full hoop height (floor → top of backboard) ≈ 13.5 ft.
    const targetHeight = 13.5;
    const scale = size.y > 0 ? targetHeight / size.y : 1;
    wrapper.scale.setScalar(scale);

    // Re-measure in world coords after scaling
    wrapper.updateMatrixWorld(true);
    const bbox2 = new THREE.Box3().setFromObject(rawGroup);
    const center = new THREE.Vector3();
    bbox2.getCenter(center);

    // Find the rim center (average of the Ring mesh bboxes, in world coords).
    const rimCenter = new THREE.Vector3();
    if (ringMeshes.length > 0) {
      const ringBox = new THREE.Box3();
      for (const m of ringMeshes) ringBox.expandByObject(m);
      ringBox.getCenter(rimCenter);
    } else {
      rimCenter.copy(center);
    }

    // Translate so the bbox bottom is at y=0 and the rim center is
    // horizontally above x=0, z=HOOP_Z.
    wrapper.position.x -= rimCenter.x;
    wrapper.position.y -= bbox2.min.y;
    wrapper.position.z += HOOP_Z - rimCenter.z;

    // The STL's rim is probably not exactly at 10 ft; adjust Y so the rim
    // lands at the regulation rimHeight. Priority is rim at 10 ft; the top
    // of the backboard will float a little higher or lower accordingly.
    wrapper.updateMatrixWorld(true);
    const ringBoxFinal = new THREE.Box3();
    for (const m of ringMeshes) ringBoxFinal.expandByObject(m);
    const rimWorldY = (ringBoxFinal.min.y + ringBoxFinal.max.y) / 2;
    if (Number.isFinite(rimWorldY)) {
      wrapper.position.y += C.rimHeight - rimWorldY;
    }

    // --- Attach a procedural net just under the rim ---
    // We use the MEASURED rim position (so the net follows whatever the STL
    // model actually places the rim at), but we ignore the measured rim width
    // — the Ring STLs include mounting bracket that inflates the bbox. Use
    // the regulation rim radius (C.hoopRadius = 0.75 ft) instead.
    wrapper.updateMatrixWorld(true);
    const rimFinal = new THREE.Box3();
    for (const m of ringMeshes) rimFinal.expandByObject(m);
    const rimWorldCenter = new THREE.Vector3();
    rimFinal.getCenter(rimWorldCenter);
    // Force the net to hang from a circle of the regulation rim radius so it
    // never balloons to the size of the bracket.
    const rimR = C.hoopRadius * 0.98; // hair inside the rim so net reads "attached"
    // Lock the net centerline to the regulation rim position. Net top ring
    // is slightly ABOVE the rim (so the net wraps over the rim like on a real
    // hoop) and nudged toward the court to match where the STL rim actually
    // is in world space.
    rimWorldCenter.y = C.rimHeight + 0.12; // tad higher — top ring sits on top of rim
    rimWorldCenter.z = HOOP_Z - 0.53;      // centered under the visible STL rim
    rimWorldCenter.x = 0;

    // Net is 3 ft tall in world units (≈ real NCAA/NBA net length). The rows
    // taper inward toward the bottom for the classic basketball-net look.
    const NET_HEIGHT = 1.5; // feet, net drop below the rim
    const NET_SEG = 14;
    const netRows = [
      { y:  0.00, r: 1.00 },
      { y: -0.32, r: 0.86 },
      { y: -0.62, r: 0.72 },
      { y: -0.92, r: 0.60 },
      { y: -1.20, r: 0.52 },
      { y: -NET_HEIGHT, r: 0.48 },
    ];
    const netMat = new THREE.LineBasicMaterial({
      color: 0xf2f2f2, transparent: true, opacity: 0.9,
    });
    const netPoint = (row, i) => {
      const rd = netRows[row];
      const a = (i / NET_SEG) * Math.PI * 2;
      return new THREE.Vector3(
        Math.cos(a) * rimR * rd.r,
        rd.y,
        Math.sin(a) * rimR * rd.r
      );
    };

    // Build net in its own group centered on origin…
    const netGroup = new THREE.Group();
    netGroup.name = "proHoopNet";
    // Horizontal rings
    for (let r = 0; r < netRows.length; r += 1) {
      const pts = [];
      for (let i = 0; i <= NET_SEG; i += 1) pts.push(netPoint(r, i % NET_SEG));
      netGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), netMat));
    }
    // Criss-cross diagonals
    for (let r = 0; r < netRows.length - 1; r += 1) {
      for (let i = 0; i < NET_SEG; i += 1) {
        const shift = r % 2 === 0 ? 1 : 0;
        const p1 = [netPoint(r, i), netPoint(r + 1, (i + shift) % NET_SEG)];
        const p2 = [netPoint(r, (i + 1) % NET_SEG), netPoint(r + 1, (i + shift) % NET_SEG)];
        netGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p1), netMat));
        netGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p2), netMat));
      }
    }
    // …then place the whole net group at the rim's WORLD position.
    // By nesting it inside an outer group that holds both wrapper and net,
    // the net keeps its own identity scale — it won't shrink/grow with the STL.
    netGroup.position.copy(rimWorldCenter);

    // --- Procedural pro backboard (overlay replacing the STL glass panels) ---
    // The STL 3D-print files split the glass board into 3 thin printable
    // sub-panels that don't read as a real backboard in the scene. We hide
    // them and drop in a regulation-sized glass board with a white frame +
    // white shooter's square — matching the reference rendering.
    for (const m of backboardMeshes) m.visible = false;

    const boardGroup = new THREE.Group();
    boardGroup.name = "proHoopBackboard";
    const BOARD_W = C.backboardWidth;      // 6 ft
    const BOARD_H = C.backboardHeight;     // 3.5 ft
    const BOARD_T = 0.14;                  // thickness
    const BOARD_Y = C.rimHeight + 1.25;    // rim 10 ft + ~15 in up
    const BOARD_Z = HOOP_Z + 0.5;          // rim is 15" (≈1.25 ft) in front of board; align with the rim

    // Glass center — almost clear with just a hint of tint so edges read.
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xf1f5f7,
      roughness: 0.04,
      metalness: 0.05,
      transparent: true,
      opacity: 0.32,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      side: THREE.DoubleSide,
      envMapIntensity: 1.4,
    });
    const glassPanel = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_W - 0.18, BOARD_H - 0.18, BOARD_T),
      glassMat
    );
    glassPanel.position.set(0, BOARD_Y, BOARD_Z);
    boardGroup.add(glassPanel);

    // White frame around the edges (4 thin strips)
    const frameBoardMat = new THREE.MeshStandardMaterial({
      color: 0xf6f4ef, roughness: 0.4, metalness: 0.18,
    });
    const frameThickness = 0.12;
    const frameDepth = BOARD_T + 0.04;
    const frameT = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_W, frameThickness, frameDepth),
      frameBoardMat
    );
    frameT.position.set(0, BOARD_Y + BOARD_H / 2 - frameThickness / 2, BOARD_Z);
    boardGroup.add(frameT);
    const frameBot = frameT.clone();
    frameBot.position.y = BOARD_Y - BOARD_H / 2 + frameThickness / 2;
    boardGroup.add(frameBot);
    const frameL = new THREE.Mesh(
      new THREE.BoxGeometry(frameThickness, BOARD_H - frameThickness * 2, frameDepth),
      frameBoardMat
    );
    frameL.position.set(-BOARD_W / 2 + frameThickness / 2, BOARD_Y, BOARD_Z);
    boardGroup.add(frameL);
    const frameR = frameL.clone();
    frameR.position.x = BOARD_W / 2 - frameThickness / 2;
    boardGroup.add(frameR);

    // White shooter's square painted on the board, centered above the rim.
    // Regulation: 24" wide × 18" tall = 2 ft × 1.5 ft. Bottom edge sits ~4"
    // above the top of the rim (rim at 10 ft → square bottom at ~10.35 ft).
    const SQ_W = 2.0;
    const SQ_H = 1.5;
    const SQ_BOTTOM_Y = C.rimHeight + 0.35;
    const SQ_CENTER_Y = SQ_BOTTOM_Y + SQ_H / 2;
    const SQ_FRONT_Z = BOARD_Z - BOARD_T / 2 - 0.015; // just in front of glass
    const sqLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sqLineThickness = 0.05;
    // Top line
    const sqTop = new THREE.Mesh(
      new THREE.BoxGeometry(SQ_W, sqLineThickness, 0.015),
      sqLineMat
    );
    sqTop.position.set(0, SQ_BOTTOM_Y + SQ_H, SQ_FRONT_Z);
    boardGroup.add(sqTop);
    // Bottom line
    const sqBot = new THREE.Mesh(
      new THREE.BoxGeometry(SQ_W, sqLineThickness, 0.015),
      sqLineMat
    );
    sqBot.position.set(0, SQ_BOTTOM_Y, SQ_FRONT_Z);
    boardGroup.add(sqBot);
    // Left line
    const sqLeft = new THREE.Mesh(
      new THREE.BoxGeometry(sqLineThickness, SQ_H, 0.015),
      sqLineMat
    );
    sqLeft.position.set(-SQ_W / 2, SQ_CENTER_Y, SQ_FRONT_Z);
    boardGroup.add(sqLeft);
    // Right line
    const sqRight = sqLeft.clone();
    sqRight.position.x = SQ_W / 2;
    boardGroup.add(sqRight);

    // Return an outer group so the net isn't affected by wrapper's scale.
    const root = new THREE.Group();
    root.name = "proHoopRoot";
    root.add(wrapper);
    root.add(netGroup);
    root.add(boardGroup);

    // Pull the Board_Padding meshes out of rawGroup and reparent to root so
    // we can offset them in world coords. Negative Z moves them toward the
    // court (out from the backboard toward the rim/shooter).
    const BOARD_PAD_OFFSET = new THREE.Vector3(0, -0.2, -0.4); // world ft
    if (boardPadMeshes.length > 0) {
      wrapper.updateMatrixWorld(true);
      for (const m of boardPadMeshes) {
        root.attach(m); // preserves world transform
        m.position.add(BOARD_PAD_OFFSET);
      }
    }

    // Push Backboard_Mount + arms forward (−Z, toward the court) so they
    // reach the procedural backboard instead of stopping short.
    const MOUNT_OFFSET = new THREE.Vector3(0, -0.15, -0.5);
    if (mountMeshes.length > 0) {
      wrapper.updateMatrixWorld(true);
      for (const m of mountMeshes) {
        root.attach(m);
        m.position.add(MOUNT_OFFSET);
      }
    }

    // White OU logo decal on the front of the base padding.
    if (ouLogoImage && frontPadMeshes.length > 0) {
      wrapper.updateMatrixWorld(true);
      const padBox = new THREE.Box3();
      for (const m of frontPadMeshes) padBox.expandByObject(m);
      const padSize = new THREE.Vector3();
      padBox.getSize(padSize);
      const padCenter = new THREE.Vector3();
      padBox.getCenter(padCenter);

      // Bake a white-tinted copy of the OU logo using source-in compositing.
      const iw = ouLogoImage.naturalWidth || ouLogoImage.width || 1;
      const ih = ouLogoImage.naturalHeight || ouLogoImage.height || 1;
      const tw = 512;
      const th = Math.round((tw * ih) / iw);
      const logoCanvas = document.createElement("canvas");
      logoCanvas.width = tw;
      logoCanvas.height = th;
      const lctx = logoCanvas.getContext("2d");
      lctx.drawImage(ouLogoImage, 0, 0, tw, th);
      lctx.globalCompositeOperation = "source-in";
      lctx.fillStyle = "#ffffff";
      lctx.fillRect(0, 0, tw, th);
      const logoTex = new THREE.CanvasTexture(logoCanvas);
      logoTex.colorSpace = THREE.SRGBColorSpace;
      logoTex.anisotropy = 8;

      const decalH = padSize.y * 0.7;
      const decalW = decalH * (iw / ih);
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(decalW, decalH),
        new THREE.MeshBasicMaterial({
          map: logoTex,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      decal.rotation.y = Math.PI;
      decal.position.set(padCenter.x, padCenter.y, padBox.min.z - 0.05);
      root.add(decal);
    }

    return root;
  });
}

// ---------------------------------------------------------------------------
// Crimson "painted-line" outline around the floor — thin enough to read as a
// painted court boundary, not a thick apron. A separate stanchion pad sits
// behind the baseline so the hoop rig has something to rest on.
// ---------------------------------------------------------------------------
function buildPlinth(woodImage, normalTex, roughTex) {
  const group = new THREE.Group();

  // (Portfolio version: floor outline omitted so the court sits directly
  // on the page cream with no dark frame. Original Defense Dashboard adds
  // a thin 0x0a0a0a roundedBox here as a framing line.)

  // Crimson-tinted wood apron, court width, running from baseline to just
  // past the OKLAHOMA wordmark.
  const apronW = FLOOR_W; // 54 ft — aligns with the wood floor sidelines
  const apronD = 8;
  const apronZ = BASELINE_Z + apronD / 2; // front edge flush with baseline

  // Build the apron albedo canvas: same wood tile as the court, heavily
  // tinted crimson, with plank seams running with the court planks (along Z,
  // i.e. vertical in canvas space).
  const ppf = 44;
  const W = Math.max(512, Math.round(apronW * ppf));
  const H = Math.max(256, Math.round(apronD * ppf));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Pure CRIMSON — flat paint to match the lane crimson exactly.
  ctx.fillStyle = CRIMSON;
  ctx.fillRect(0, 0, W, H);

  // Very subtle 1 ft × 3 ft plank seams to match the rest of the court.
  const apronPlankFt = 1.0;
  const apronButtFt = 3.0;
  const apronSeamPx = Math.max(1, Math.round(0.012 * ppf));
  ctx.fillStyle = "rgba(30, 8, 10, 0.22)";
  for (let fx = 0; fx <= apronW; fx += apronPlankFt) {
    ctx.fillRect(Math.round(fx * ppf), 0, apronSeamPx, H);
  }
  for (let fx = 0, i = 0; fx < apronW; fx += apronPlankFt, i += 1) {
    const offset = ((i * 11) % 13) * (apronButtFt / 13);
    for (let fz = offset; fz <= apronD; fz += apronButtFt) {
      ctx.fillRect(
        Math.round(fx * ppf),
        Math.round(fz * ppf),
        Math.round(apronPlankFt * ppf),
        apronSeamPx
      );
    }
  }

  // Team wordmark in white — collegiate block font.
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = TEAM_WORDMARK;
  const collegiateFont = '"Graduate", "Arial Black", "Helvetica Neue", sans-serif';
  let fontPx = Math.floor(H * 0.7);
  ctx.font = `400 ${fontPx}px ${collegiateFont}`;
  let measured = ctx.measureText(text).width;
  const targetW = W * 0.9;
  if (measured > targetW) {
    fontPx = Math.floor(fontPx * (targetW / measured));
    ctx.font = `400 ${fontPx}px ${collegiateFont}`;
  }
  // Rotate 180° so the wordmark reads upright for a viewer at -Z.
  ctx.save();
  ctx.translate(W, H);
  ctx.scale(-1, -1);
  ctx.fillText(text, W / 2, H / 2);
  ctx.restore();

  const apronAlbedo = new THREE.CanvasTexture(canvas);
  apronAlbedo.colorSpace = THREE.SRGBColorSpace;
  apronAlbedo.anisotropy = 16;

  // Reuse the court's normal + roughness maps, retiled for this surface so
  // the wood grain matches in scale.
  const cloneTiled = (src) => {
    if (!src) return null;
    const t = src.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(apronW / WOOD_TILE_FT, apronD / WOOD_TILE_FT);
    t.anisotropy = 16;
    t.flipY = false;
    return t;
  };
  const apronNormal = cloneTiled(normalTex);
  const apronRough = cloneTiled(roughTex);

  // Unlit + toneMapped:false so neither the spotlight nor the ACES tonemap
  // desaturates the crimson. MeshBasic is still tonemapped by default, which
  // is what was washing the apron toward pink — the explicit flag fixes it.
  const apronMat = new THREE.MeshBasicMaterial({ map: apronAlbedo, toneMapped: false });
  const apronSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(apronW, apronD),
    apronMat
  );
  apronSurface.rotation.x = -Math.PI / 2;
  apronSurface.position.set(0, 0.01, apronZ);
  apronSurface.receiveShadow = true;
  group.add(apronSurface);

  // Crimson side slab so the apron has visible depth from side angles.
  const apronSideMat = new THREE.MeshBasicMaterial({ color: 0x3a0b0c });
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(apronW, 0.4, apronD),
    apronSideMat
  );
  slab.position.set(0, -0.2, apronZ);
  group.add(slab);

  return group;
}

// ---------------------------------------------------------------------------
// Shot zone painted-floor overlay — PPP heatmap using team palette.
// ---------------------------------------------------------------------------
// OU Women's Basketball season aggregated offensive stats by court zone.
// PPP = points per possession. L/R splits use half the combined attempts with
// identical PPP (user-supplied aggregates were L+R combined).
// ---------------------------------------------------------------------------

// Mid-range split distance (feet from hoop): divides short vs long midrange.
const MID_SPLIT_R = 13.5;

// Team palette — PPP bucketing (inverted: red=hottest, green=coldest so the
// "danger" color sits on the high-efficiency zones the defense must defend).
//   crimson (≥ 1.15)    : hot — elite efficiency
//   cream   (1.00–1.15) : warm — above average
//   grey    (0.96–1.00) : cool — below average
//   green   (< 0.96)    : cold — low efficiency
// Deep-blood OU crimson. At the overlay blend opacity, the lighter brand hex
// #841617 reads pink once it mixes with the maple below, so we pre-darken
// the palette rgb and raise the overlay opacity to compensate.
// Tan-family shading: four warm tones in the wood/cream family so the zone
// heat-map reads as a subtle tint on top of the maple rather than blocks of
// paint. Hot = richest saddle tan; cold = pale parchment.
const PALETTE = {
  crimson: { rgb: [184, 132,  70], hex: "#b88446", name: "Hot"  },
  cream:   { rgb: [208, 163, 101], hex: "#d0a365", name: "Warm" },
  grey:    { rgb: [224, 191, 141], hex: "#e0bf8d", name: "Cool" },
  green:   { rgb: [239, 217, 181], hex: "#efd9b5", name: "Cold" },
  paint:   { rgb: [ 12,  12,  14], hex: "#0c0c0e", name: "Paint" },
};

function pppToBucket(ppp) {
  if (ppp >= 1.15) return PALETTE.crimson;
  if (ppp >= 1.00) return PALETTE.cream;
  if (ppp >= 0.96) return PALETTE.grey;
  return PALETTE.green;
}

// Classify a world (x, z) position into one of the 10 zone keys (or null if
// outside the drawn court / out-of-bounds ring).
function classifyZone(x, z) {
  if (Math.abs(x) > HALF_W || Math.abs(z) > HALF_L) return null;
  const dx = x;
  const dz = z - HOOP_Z;
  const r = Math.hypot(dx, dz);

  // Rim (restricted-area disk)
  if (r <= 4) return "rim";

  // Corner 3s (rectangles outside the arc on the baseline side)
  if (Math.abs(x) >= CORNER3_X && z >= CORNER3_ARC_Z) {
    return x < 0 ? "c3L" : "c3R";
  }

  // Paint (lane rectangle, non-rim)
  if (Math.abs(x) <= LANE_X && z >= FT_Z && z <= BASELINE_Z) return "paint";

  // Beyond the 3pt arc → Wing / Top 3
  if (r > C.threeRadius) {
    return x < 0 ? "w3L" : "w3R";
  }

  // Inside 3pt arc, outside paint → midrange, split by distance
  if (r <= MID_SPLIT_R) return x < 0 ? "smL" : "smR";
  return x < 0 ? "lmL" : "lmR";
}

// Zones → PPP + n + display label + distance hint. n for split zones is half
// of the user's combined aggregate (rounded to conserve the total).
// All 33 tagged games (every numbered game 1–34 that has shot-locations in the
// clips DB; game 24 has no shot coords). Computed from clips.shot_x / shot_y
// using the same classifyZone() buckets below; PPP = points / FGA.
//
// Mirrored zones (short/long mid, wing/top-of-key 3, corner 3) display the
// SAME combined L+R totals on both sides — the court is symmetric so zone
// efficiency shouldn't depend on which side the shot came from.
//
// Wing 3 and top-of-key 3 checked separately (|x| < 10 ft above-break split):
// top 1.23 PPA vs wing 1.11 PPA — close enough that we collapse them into a
// single "WING/TOP 3" label rather than adding a 5th 3pt sub-zone.
const SHOT_ZONES = [
  { key: "rim",   label: "AT RIM",               dist: "0–4 ft",   n: 278, ppp: 1.04 },
  { key: "paint", label: "PAINT",                dist: "",          n: 527, ppp: 0.95 },
  { key: "smL",   label: "SHORT MIDRANGE",       dist: "4–14 ft",  n: 167, ppp: 0.80 },
  { key: "smR",   label: "SHORT MIDRANGE",       dist: "4–14 ft",  n: 167, ppp: 0.80 },
  { key: "lmL",   label: "LONG MIDRANGE",        dist: "14–22 ft", n: 163, ppp: 0.88 },
  { key: "lmR",   label: "LONG MIDRANGE",        dist: "14–22 ft", n: 163, ppp: 0.88 },
  { key: "w3L",   label: "WING/TOP OF KEY 3",    dist: "22+ ft",   n: 402, ppp: 1.12 },
  { key: "w3R",   label: "WING/TOP OF KEY 3",    dist: "22+ ft",   n: 402, ppp: 1.12 },
  { key: "c3L",   label: "CORNER 3",             dist: "22 ft",    n: 117, ppp: 1.00 },
  { key: "c3R",   label: "CORNER 3",             dist: "22 ft",    n: 117, ppp: 1.00 },
];

// Font families mirroring the report style guide. The previous build registered
// /fonts/*.ttf via @font-face from a sibling project; those files were never
// shipped on this site, so the requests 404'd on every page that loaded this
// chunk. The chunk is prefetched on the homepage, so the noise hit everyone.
// Apple system fonts and built-in Georgia render the canvas labels correctly
// on every platform we care about, so the @font-face block is dropped.
const FONT_TITLE = `-apple-system, "SF Pro Display", BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
const FONT_UI    = `-apple-system, "SF Pro Display", BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
const FONT_BODY  = `Georgia, "Times New Roman", serif`;
const FONT_BODY_BOLD = `Georgia, "Times New Roman", serif`;

const REPORT_FONT_FACES = ``;

// Label centroids on the court floor (world x, z). `rot` is the text rotation
// (radians) on the canvas — corner 3 zones are narrow strips so we rotate
// their labels to run along the long (baseline → midcourt) axis.
const SHOT_ZONE_LABEL_POS = {
  rim:   { cx:   0.0, cz: 17.0, rot: 0 },
  paint: { cx:   0.0, cz: 11.0, rot: 0 },
  smL:   { cx:  -9.5, cz: 12.0, rot: 0 },
  smR:   { cx:   9.5, cz: 12.0, rot: 0 },
  lmL:   { cx: -14.5, cz: 14.5, rot: 0 },
  lmR:   { cx:  14.5, cz: 14.5, rot: 0 },
  // Wing 3 labels sit well inside the zone, away from the 3pt arc, so they
  // can never bleed across into the long-mid zone.
  w3L:   { cx: -17.0, cz: -5.5, rot: 0 },
  w3R:   { cx:  17.0, cz: -5.5, rot: 0 },
  c3L:   { cx: -23.0, cz: 18.5, rot: -Math.PI / 2 },
  c3R:   { cx:  23.0, cz: 18.5, rot:  Math.PI / 2 },
};

// Default per-zone fill colors used when the user hasn't picked anything yet.
// The rim keeps its white wash; every other zone starts fully transparent
// (`null`) so the bare wood reads through. The UI color-picker writes to
// localStorage; persisted values override these defaults.
// Use `null` (not undefined) to distinguish "explicitly no fill" from a
// missing key during merges.
const DEFAULT_ZONE_COLORS = {
  rim:   { hex: "#ffffff", alpha: 248 },
  paint: null, // painted court key stays unchanged
  smL: null, smR: null,
  lmL: null, lmR: null,
  w3L: null, w3R: null,
  c3L: null, c3R: null,
};
const ZONE_COLORS_KEY = "shot-chart-3d:zoneColors:v1";

// Beyond this distance from the hoop we stop color-filling the wing/top-of-key
// 3 zones — the 3-point arc still reads from the painted line, but far-range
// attempts (heaves) are outside the interesting sample. Doesn't change
// classifyZone / stats, only the overlay paint.
const WING3_FILL_MAX_R = 26.0;

// Build the floor-painted zone overlay. Pixel-classifies every world position
// into its zone, paints each zone with its configured color (if any), and
// records centroids for downstream label placement.
function buildShotZonesOverlay(zoneColors = DEFAULT_ZONE_COLORS) {
  const group = new THREE.Group();
  group.name = "ShotZonesOverlay";

  // Canvas resolution: pixels per court-foot. 32 px/ft keeps label text
  // sharp when the camera pulls in (~1728×1632 canvas, ~2.8MP).
  const PPF = 32;
  const cw = Math.round(FLOOR_W * PPF);
  const ch = Math.round(FLOOR_L * PPF);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Parse the persisted color table into a fast {r,g,b,a} lookup per zone.
  // Missing keys fall through to defaults; a null value means "do not fill".
  const hex2rgb = (hex) => {
    const h = hex.replace("#", "");
    const v = h.length === 3
      ? h.split("").map((c) => parseInt(c + c, 16))
      : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return { r: v[0], g: v[1], b: v[2] };
  };
  const fillLookup = {};
  for (const z of SHOT_ZONES) {
    const entry = (zoneColors && (z.key in zoneColors))
      ? zoneColors[z.key]
      : DEFAULT_ZONE_COLORS[z.key];
    if (!entry) { fillLookup[z.key] = null; continue; }
    const { r, g, b } = hex2rgb(entry.hex || "#ffffff");
    const a = Number.isFinite(entry.alpha) ? entry.alpha : 200;
    fillLookup[z.key] = { r, g, b, a };
  }

  // --- Pass 1: fill zones pixel-by-pixel + accumulate per-zone stats for
  //     geometric centroid and row-wise width lookup (so labels fit cleanly).
  const img = ctx.createImageData(cw, ch);
  const data = img.data;
  const stats = {};
  for (const z of SHOT_ZONES) {
    stats[z.key] = { sx: 0, sy: 0, n: 0, rows: new Map() };
  }
  for (let py = 0; py < ch; py++) {
    const wz = (py / ch - 0.5) * FLOOR_L;
    for (let px = 0; px < cw; px++) {
      const wx = (px / cw - 0.5) * FLOOR_W;
      const zone = classifyZone(wx, wz);
      const idx = (py * cw + px) * 4;
      if (!zone) { data[idx + 3] = 0; continue; }
      // Radial clamp on wing/top-of-key 3 — paint stops past WING3_FILL_MAX_R.
      if ((zone === "w3L" || zone === "w3R")) {
        const dx = wx; const dz = wz - HOOP_Z;
        if (Math.hypot(dx, dz) > WING3_FILL_MAX_R) {
          data[idx + 3] = 0;
          // Still accumulate stats so label centroids stay valid.
          const s = stats[zone];
          s.sx += px; s.sy += py; s.n += 1;
          continue;
        }
      }
      const fill = fillLookup[zone];
      if (fill) {
        data[idx + 0] = fill.r;
        data[idx + 1] = fill.g;
        data[idx + 2] = fill.b;
        data[idx + 3] = fill.a;
      } else {
        data[idx + 3] = 0;
      }
      const s = stats[zone];
      s.sx += px; s.sy += py; s.n += 1;
      const r = s.rows.get(py);
      if (!r) s.rows.set(py, { minPx: px, maxPx: px });
      else { if (px < r.minPx) r.minPx = px; if (px > r.maxPx) r.maxPx = px; }
    }
  }

  // --- Pass 2 (disabled): no zone-divider seams — court texture shows through.
  ctx.putImageData(img, 0, 0);

  // Compute world-space centroids for every zone so downstream label builders
  // can place text directly at the geometric middle of each painted zone.
  const centroids = {};
  for (const z of SHOT_ZONES) {
    const s = stats[z.key];
    if (s && s.n > 0) {
      const cx = s.sx / s.n; // canvas pixels
      const cy = s.sy / s.n;
      // Canvas → world. The plane is rotated -π/2 around X so canvas y maps
      // to world z. FLOOR_W/FLOOR_L give the full court extents.
      const wx = (cx / cw - 0.5) * FLOOR_W;
      const wz = (cy / ch - 0.5) * FLOOR_L;
      centroids[z.key] = { x: wx, z: wz };
    } else {
      const pos = SHOT_ZONE_LABEL_POS[z.key];
      centroids[z.key] = { x: pos.cx, z: pos.cz };
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 16;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  const geom = new THREE.PlaneGeometry(FLOOR_W, FLOOR_L);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 1.0, // per-pixel alpha carries the transparency (only rim is
                  // tinted; every other zone is fully transparent).
    depthWrite: false,
  });
  const plane = new THREE.Mesh(geom, mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.02;
  plane.renderOrder = 1;
  group.add(plane);

  group.userData.centroids = centroids;
  return group;
}

// Build per-zone draggable label groups. Each zone gets a Group with:
//   • a TITLE plane — tilted ~25° up from the floor like a nameplate so it
//     reads edge-on but remains visible at our 3/4 camera angle;
//   • a VALUE plane (PPP number) — flat on the floor, big and bold;
//   • a BODY plane (FGA count) — flat on the floor, underneath the value.
// The Group is positioned at the zone centroid by default. Drag handlers at
// the scene level move the whole Group while keeping the same local layout.
function buildZoneLabelMeshes(centroids, savedPositions) {
  const root = new THREE.Group();
  root.name = "ZoneLabelGroups";

  // Text → texture helper.
  const makeTextTexture = ({
    text, w, h, font, fillStyle = "#141618", shadow = true,
  }) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    cx.clearRect(0, 0, w, h);
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.font = font;
    if (shadow) {
      cx.fillStyle = "rgba(255,255,255,0.55)";
      cx.fillText(text, w / 2 + 2, h / 2 + 2);
    }
    cx.fillStyle = fillStyle;
    cx.fillText(text, w / 2, h / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 16;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  };

  const makeTextPlane = (opts, planeW, planeH) => {
    const tex = makeTextTexture(opts);
    const m = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    const geom = new THREE.PlaneGeometry(planeW, planeH);
    const mesh = new THREE.Mesh(geom, m);
    mesh.renderOrder = 3;
    return mesh;
  };

  for (const z of SHOT_ZONES) {
    const g = new THREE.Group();
    g.name = `Label_${z.key}`;
    g.userData.zoneKey = z.key;
    g.userData.isLabel = true;

    // Default position from centroid, unless user has saved an override.
    const c = centroids[z.key] || { x: 0, z: 0 };
    const saved = savedPositions && savedPositions[z.key];
    const px = saved ? saved.x : c.x;
    const pz = saved ? saved.z : c.z;
    g.position.set(px, 0.03, pz);

    // Nameplate geometry: all three lines (title / value / body) share the
    // same tilt angle so they read as one leaning card. Tilt direction (along
    // which we stack the lines): world (0, 0.65, 0.77) after rx = -PI/2-0.70
    // combined with rz = PI. We space the centers along that vector with a
    // small gap so each line sits just above the next.
    const TILT_RX = -Math.PI / 2 - 0.70;
    const TILT_UP = { y: 0.65, z: 0.77 };

    const TITLE_W = 5.2, TITLE_H = 0.82;
    const VALUE_W = 2.6, VALUE_H = 1.60;
    // Body plate holds the FGA count — bumped larger so the sample size is
    // legible at page-7 export size.
    const BODY_W  = 4.6, BODY_H  = 0.88;
    const GAP = 0.18;

    // Vertical offsets up the nameplate, measured from the value center.
    const titleOff = VALUE_H / 2 + GAP + TITLE_H / 2;
    const bodyOff  = VALUE_H / 2 + GAP + BODY_H  / 2;
    // Lift the whole card so its lowest point doesn't dip below the floor.
    const lift = (VALUE_H / 2 + GAP + BODY_H) * TILT_UP.y + 0.10;

    // TITLE — at the top of the nameplate.
    const title = makeTextPlane(
      {
        text: z.label,
        w: 2048, h: 320,
        font: `800 200px ${FONT_UI}`,
        fillStyle: "#141618",
      },
      TITLE_W, TITLE_H,
    );
    title.rotation.x = TILT_RX;
    title.rotation.z = Math.PI;
    title.position.set(0, lift + TILT_UP.y * titleOff, TILT_UP.z * titleOff);
    g.add(title);

    // VALUE — PPP number, middle of the nameplate.
    const value = makeTextPlane(
      {
        text: z.ppp.toFixed(2),
        w: 1024, h: 640,
        font: `900 480px ${FONT_TITLE}`,
        fillStyle: "#141618",
      },
      VALUE_W, VALUE_H,
    );
    value.rotation.x = TILT_RX;
    value.rotation.z = Math.PI;
    value.position.set(0, lift, 0);
    g.add(value);

    // BODY — FGA count line, bottom of the nameplate.
    const bodyText = z.dist ? `FGA ${z.n}  ·  ${z.dist}` : `FGA ${z.n}`;
    const body = makeTextPlane(
      {
        text: bodyText,
        w: 1536, h: 280,
        font: `700 170px ${FONT_BODY_BOLD}`,
        fillStyle: "rgba(20,22,24,0.92)",
      },
      BODY_W, BODY_H,
    );
    body.rotation.x = TILT_RX;
    body.rotation.z = Math.PI;
    body.position.set(0, lift - TILT_UP.y * bodyOff, -TILT_UP.z * bodyOff);
    g.add(body);

    root.add(g);
  }

  return root;
}

// Thin black zone dividers — classifies adjacent pixels and marks the seams
// where zones differ. Renders as a transparent floor plane so it composites
// cleanly over the wood+paint.
function buildZoneDividers() {
  const group = new THREE.Group();
  group.name = "ZoneDividers";
  const PPF = 32;
  const cw = Math.round(FLOOR_W * PPF);
  const ch = Math.round(FLOOR_L * PPF);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(cw, ch);
  const data = img.data;
  // 2-pixel wide black seam wherever two adjacent samples classify into
  // different zones. 2 px ≈ 0.75 inches on the court at PPF=32 — reads as a
  // crisp boundary line without overpowering the painted court lines.
  const setPix = (px, py) => {
    if (px < 0 || py < 0 || px >= cw || py >= ch) return;
    const idx = (py * cw + px) * 4;
    data[idx + 0] = 8;
    data[idx + 1] = 8;
    data[idx + 2] = 10;
    data[idx + 3] = 255;
  };
  for (let py = 1; py < ch - 1; py++) {
    const wz = (py / ch - 0.5) * FLOOR_L;
    const wzNext = ((py + 1) / ch - 0.5) * FLOOR_L;
    for (let px = 1; px < cw - 1; px++) {
      const wx = (px / cw - 0.5) * FLOOR_W;
      const wxNext = ((px + 1) / cw - 0.5) * FLOOR_W;
      const a = classifyZone(wx, wz);
      if (!a) continue;
      const bR = classifyZone(wxNext, wz);
      const bD = classifyZone(wx, wzNext);
      // Suppress seams between mirrored L/R halves of the same logical zone.
      // The user wanted no center line running up through the above-break 3
      // band; applying the same rule to every L/R pair keeps the court
      // visually symmetric while still separating paint/mid/3 concentric
      // boundaries.
      const sameLogical = (p, q) => {
        if (!p || !q || p === q) return p === q;
        const pairs = [
          ["w3L", "w3R"], ["c3L", "c3R"],
          ["smL", "smR"], ["lmL", "lmR"],
        ];
        return pairs.some(([l, r]) => (p === l && q === r) || (p === r && q === l));
      };
      const right = bR && bR !== a && !sameLogical(a, bR);
      const down  = bD && bD !== a && !sameLogical(a, bD);
      if (right || down) {
        setPix(px,     py);
        setPix(px + 1, py);
        setPix(px,     py + 1);
        setPix(px + 1, py + 1);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_W, FLOOR_L),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    })
  );
  plane.rotation.x = -Math.PI / 2;
  // Above the rim-wash (y=0.02) so the seam reads on top of the white disk.
  plane.position.y = 0.025;
  plane.renderOrder = 2;
  group.add(plane);
  return group;
}

// ---------------------------------------------------------------------------
// Zone-label variants for A/B/C comparison. Each returns a Group that can be
// toggled on/off at runtime so the user can pick the style they like best.
// ---------------------------------------------------------------------------

// Helper: render a zone's PPP + label + FGA into a canvas at the given size.
function drawZoneLabelCanvas(z, { w, h, onLight = false }) {
  // Paint + Rim zones sit ON TOP of the team's primary-color lane, not
  // on the wood floor. If the team color is dark (Iowa navy, Vanderbilt,
  // UConn navy, Michigan blue, Notre Dame green, Duke blue, etc.), the
  // default dark ink is unreadable. Flip to light ink in that case so
  // every team gets a legible label.
  if ((z.key === "rim" || z.key === "paint") && onLight && isHexDark(CRIMSON)) {
    onLight = false;
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const ink = onLight ? "#141618" : "#f4ecd5";
  const subInk = onLight ? "rgba(20,22,24,0.78)" : "rgba(244,236,213,0.9)";
  const shadow = onLight ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.55)";

  const cx = w / 2;
  const cy = h / 2;
  const sTitle = Math.round(h * 0.18);
  const sValue = Math.round(h * 0.42);
  const sBody = Math.round(h * 0.16);

  ctx.font = `700 ${sTitle}px ${FONT_UI}`;
  ctx.fillStyle = shadow;
  ctx.fillText(z.label, cx + 1.5, cy - h * 0.28 + 1.5);
  ctx.fillStyle = subInk;
  ctx.fillText(z.label, cx, cy - h * 0.28);

  ctx.font = `800 ${sValue}px ${FONT_TITLE}`;
  ctx.fillStyle = shadow;
  ctx.fillText(z.ppp.toFixed(2), cx + 2, cy + 2);
  ctx.fillStyle = ink;
  ctx.fillText(z.ppp.toFixed(2), cx, cy);

  ctx.font = `400 ${sBody}px ${FONT_BODY}`;
  const body = z.dist ? `FGA ${z.n}  ·  ${z.dist}` : `FGA ${z.n}`;
  ctx.fillStyle = shadow;
  ctx.fillText(body, cx + 1.5, cy + h * 0.32 + 1.5);
  ctx.fillStyle = subInk;
  ctx.fillText(body, cx, cy + h * 0.32);

  return canvas;
}

// V1 — Billboarded sprites. One Sprite per zone centroid, floats ~1 ft above
// the floor, always faces the camera. Pill background for contrast.
function buildZoneLabelsSprites() {
  const group = new THREE.Group();
  group.name = "ZoneLabels_Sprites";
  const spriteW = 9.0; // ft (world units)
  const spriteH = 5.2;
  const texW = 512;
  const texH = Math.round(texW * (spriteH / spriteW));

  for (const z of SHOT_ZONES) {
    const pos = SHOT_ZONE_LABEL_POS[z.key];
    if (!pos) continue;
    const base = document.createElement("canvas");
    base.width = texW;
    base.height = texH;
    const bctx = base.getContext("2d");
    // Pill background.
    const pad = 16;
    const r = texH * 0.22;
    const pillW = texW - pad * 2;
    const pillH = texH - pad * 2;
    bctx.fillStyle = "rgba(8, 6, 8, 0.72)";
    bctx.strokeStyle = "rgba(244,236,213,0.25)";
    bctx.lineWidth = 3;
    bctx.beginPath();
    bctx.moveTo(pad + r, pad);
    bctx.arcTo(pad + pillW, pad, pad + pillW, pad + pillH, r);
    bctx.arcTo(pad + pillW, pad + pillH, pad, pad + pillH, r);
    bctx.arcTo(pad, pad + pillH, pad, pad, r);
    bctx.arcTo(pad, pad, pad + pillW, pad, r);
    bctx.closePath();
    bctx.fill();
    bctx.stroke();
    // Label canvas drawn on top.
    const label = drawZoneLabelCanvas(z, { w: texW, h: texH, onLight: false });
    bctx.drawImage(label, 0, 0);

    const tex = new THREE.CanvasTexture(base);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(spriteW, spriteH, 1);
    sprite.position.set(pos.cx, 2.4, pos.cz);
    sprite.renderOrder = 4;
    group.add(sprite);
  }
  return group;
}

// V2 — Flat baked overlay. Single canvas plane laid on the floor, text is
// drawn at each zone centroid (no colored zone fills, no dividers).
function buildZoneLabelsBaked() {
  const group = new THREE.Group();
  group.name = "ZoneLabels_Baked";
  const PPF = 32;
  const cw = Math.round(FLOOR_W * PPF);
  const ch = Math.round(FLOOR_L * PPF);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const toPX = (wx) => ((wx + FLOOR_W / 2) / FLOOR_W) * cw;
  const toPY = (wz) => ((wz + FLOOR_L / 2) / FLOOR_L) * ch;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const z of SHOT_ZONES) {
    const pos = SHOT_ZONE_LABEL_POS[z.key];
    if (!pos) continue;
    const isCorner = z.key === "c3L" || z.key === "c3R";
    const isPaint = z.key === "paint" || z.key === "rim";
    const fsTitle = isCorner ? 16 : 22;
    const fsValue = isCorner ? 34 : 52;
    const fsBody = isCorner ? 14 : 20;
    const yTitle = isCorner ? -42 : -56;
    const yValue = isCorner ? -6 : -10;
    const yBody = isCorner ? 26 : 36;

    const ink = isPaint ? "#f4ecd5" : "#141618";
    const subInk = isPaint ? "rgba(244,236,213,0.85)" : "rgba(20,22,24,0.78)";
    const shadow = isPaint ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.35)";

    ctx.save();
    ctx.translate(toPX(pos.cx), toPY(pos.cz));
    ctx.rotate(Math.PI + (pos.rot || 0));

    ctx.font = `700 ${fsTitle}px ${FONT_UI}`;
    ctx.fillStyle = shadow;
    ctx.fillText(z.label, 1.5, yTitle + 1.5);
    ctx.fillStyle = subInk;
    ctx.fillText(z.label, 0, yTitle);

    ctx.font = `800 ${fsValue}px ${FONT_TITLE}`;
    ctx.fillStyle = shadow;
    ctx.fillText(z.ppp.toFixed(2), 2, yValue + 2);
    ctx.fillStyle = ink;
    ctx.fillText(z.ppp.toFixed(2), 0, yValue);

    ctx.font = `400 ${fsBody}px ${FONT_BODY}`;
    const body = z.dist ? `FGA ${z.n}  ·  ${z.dist}` : `FGA ${z.n}`;
    ctx.fillStyle = shadow;
    ctx.fillText(body, 1.5, yBody + 1.5);
    ctx.fillStyle = subInk;
    ctx.fillText(body, 0, yBody);

    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_W, FLOOR_L),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.02;
  plane.renderOrder = 2;
  group.add(plane);
  return group;
}

// V3 — Per-zone raised planes. Each label sits on its own small plane lifted
// a few inches off the floor, with a subtle emissive so it reads as painted
// lettering with depth. More "premium" than flat-bake, less HUD-y than
// sprites.
function buildZoneLabelsExtruded() {
  const group = new THREE.Group();
  group.name = "ZoneLabels_Extruded";
  for (const z of SHOT_ZONES) {
    const pos = SHOT_ZONE_LABEL_POS[z.key];
    if (!pos) continue;
    const isCorner = z.key === "c3L" || z.key === "c3R";
    const wft = isCorner ? 3.0 : 5.5;
    const hft = isCorner ? 5.5 : 3.2;
    const texW = 512;
    const texH = Math.round(texW * (hft / wft));
    const label = drawZoneLabelCanvas(z, { w: texW, h: texH, onLight: true });

    const tex = new THREE.CanvasTexture(label);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      emissive: 0x2a1a0a,
      emissiveMap: tex,
      emissiveIntensity: 0.35,
      roughness: 0.55,
      metalness: 0.0,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(wft, hft), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.rotation.z = Math.PI + (pos.rot || 0);
    plane.position.set(pos.cx, 0.05, pos.cz);
    plane.renderOrder = 3;
    group.add(plane);
  }
  return group;
}

// ---------------------------------------------------------------------------
// Arena seating — instanced seat boxes on raked tiers around all four sides
// so the stands read as real geometry, not painted walls.
// ---------------------------------------------------------------------------
function buildArena() {
  const group = new THREE.Group();
  group.name = "Arena";

  // Dark concourse floor surrounding the raised court.
  const concourseMat = new THREE.MeshStandardMaterial({
    color: 0x06080c, roughness: 0.95, metalness: 0.0,
  });
  const concourse = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260),
    concourseMat
  );
  concourse.rotation.x = -Math.PI / 2;
  concourse.position.y = -0.02;
  concourse.receiveShadow = true;
  group.add(concourse);

  // A single seat box — small enough that rows read as individual chairs.
  const seatGeo = new THREE.BoxGeometry(1.2, 0.95, 1.25);
  seatGeo.translate(0, 0.475, 0); // anchor to bottom

  const seatMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,          // base white; tinted per-instance
    roughness: 0.72,
    metalness: 0.05,
    envMapIntensity: 0.7,
  });

  const tmpMat = new THREE.Matrix4();
  const tmpColor = new THREE.Color();

  // Crimson crowd with scattered cream + empty seats for realism.
  const paintSeat = () => {
    const roll = Math.random();
    if (roll < 0.08) tmpColor.setHex(0xd7c28a); // cream
    else if (roll < 0.14) tmpColor.setHex(0x151014); // empty
    else {
      const base = new THREE.Color(0x7a1420);
      base.multiplyScalar(0.72 + Math.random() * 0.55);
      tmpColor.copy(base);
    }
  };

  const ROWS = 16;
  const SEAT_PITCH = 1.4;    // along-row spacing
  const ROW_RUN = 1.55;      // per-row depth step
  const ROW_RISE = 1.25;     // per-row vertical step
  const FIRST_ROW_GAP = 5.5; // court edge → front row

  const sides = [
    { axis: "z", sign: +1, courtHalf: HALF_L, spanLen: C.width + 42 },
    { axis: "z", sign: -1, courtHalf: HALF_L, spanLen: C.width + 42 },
    { axis: "x", sign: +1, courtHalf: HALF_W, spanLen: C.length + 42 },
    { axis: "x", sign: -1, courtHalf: HALF_W, spanLen: C.length + 42 },
  ];

  for (const side of sides) {
    const cols = Math.floor(side.spanLen / SEAT_PITCH);
    const total = cols * ROWS;
    const mesh = new THREE.InstancedMesh(seatGeo, seatMat, total);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    let idx = 0;
    for (let r = 0; r < ROWS; r += 1) {
      const outward = FIRST_ROW_GAP + r * ROW_RUN;
      const y = r * ROW_RISE;
      for (let c = 0; c < cols; c += 1) {
        const along = -side.spanLen / 2 + SEAT_PITCH / 2 + c * SEAT_PITCH;
        let x;
        let z;
        if (side.axis === "z") {
          x = along;
          z = side.sign * (side.courtHalf + outward);
        } else {
          x = side.sign * (side.courtHalf + outward);
          z = along;
        }
        tmpMat.makeTranslation(x, y, z);
        mesh.setMatrixAt(idx, tmpMat);
        paintSeat();
        mesh.setColorAt(idx, tmpColor);
        idx += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

// ---------------------------------------------------------------------------
// LED scoreboard panels mounted behind the hoop — a branded title panel on
// the left and a zone-breakdown table on the right. Rendered as emissive
// canvases so they glow against the dark arena.
// ---------------------------------------------------------------------------
function buildLedPanel(drawFn, pxW, pxH) {
  const can = document.createElement("canvas");
  can.width = pxW;
  can.height = pxH;
  const ctx = can.getContext("2d");
  // LED dot-matrix undercoat (painted first so drawFn sits on top)
  ctx.fillStyle = "#05070c";
  ctx.fillRect(0, 0, pxW, pxH);
  drawFn(ctx, pxW, pxH);
  const tex = new THREE.CanvasTexture(can);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

function drawLedDotGrid(ctx, w, h) {
  ctx.fillStyle = "rgba(18, 24, 36, 0.55)";
  for (let y = 0; y < h; y += 6) {
    for (let x = 0; x < w; x += 6) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
}

function buildScoreboard() {
  const group = new THREE.Group();
  group.name = "Scoreboard";

  // --- Left panel: team/title block ---
  const leftTex = buildLedPanel((c, w, h) => {
    drawLedDotGrid(c, w, h);

    // Crimson left accent bar (team primary color)
    c.fillStyle = CRIMSON;
    c.fillRect(0, 0, 16, h);

    // Eyebrow
    c.fillStyle = "#d9c48f";
    c.font = `700 40px -apple-system, "SF Pro Display", Arial, sans-serif`;
    c.fillText("OKLAHOMA SOONERS", 60, 88);

    // Big title
    c.fillStyle = "#ffffff";
    c.font = `900 128px -apple-system, "SF Pro Display", Arial, sans-serif`;
    c.fillText("SHOT", 56, 240);
    c.fillText("EFFICIENCY", 56, 380);

    // Season
    c.fillStyle = "#8b939f";
    c.font = `500 38px -apple-system, "SF Pro Display", Arial, sans-serif`;
    c.fillText("2025 – 2026 SEASON", 60, 448);

    // Divider
    c.strokeStyle = CRIMSON;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(60, 492);
    c.lineTo(w - 60, 492);
    c.stroke();

    // Total sample size — useful context for a coach glancing at the board
    const totalFGA = SHOT_ZONES.reduce((s, z) => s + z.n, 0);
    c.fillStyle = "#d9c48f";
    c.font = `800 56px -apple-system, "SF Pro Display", Arial, sans-serif`;
    c.fillText(`${totalFGA} TOTAL FGA`, 60, 568);
  }, 1024, 640);

  // --- Right panel: zone breakdown table ---
  // Aggregate L+R splits into a single row each for readability.
  const aggregated = [
    { label: "AT RIM",    n: 120, ppp: 1.40 },
    { label: "PAINT",     n: 119, ppp: 1.00 },
    { label: "SHORT MID", n:  55, ppp: 0.96 },
    { label: "LONG MID",  n:  92, ppp: 1.02 },
    { label: "WING 3",    n: 156, ppp: 1.25 },
    { label: "CORNER 3",  n:  19, ppp: 0.95 },
  ];

  const rightTex = buildLedPanel((c, w, h) => {
    drawLedDotGrid(c, w, h);

    // Crimson left accent bar (team primary color)
    c.fillStyle = CRIMSON;
    c.fillRect(0, 0, 16, h);

    // Section title
    c.fillStyle = "#d9c48f";
    c.font = `700 36px -apple-system, "SF Pro Display", Arial, sans-serif`;
    c.fillText("ZONE BREAKDOWN", 60, 78);

    // Column headers
    c.fillStyle = "#6c7482";
    c.font = `700 22px -apple-system, "SF Pro Display", Arial, sans-serif`;
    c.textAlign = "left";
    c.fillText("ZONE", 100, 132);
    c.textAlign = "right";
    c.fillText("FGA", w - 240, 132);
    c.fillText("PPP", w - 60, 132);
    c.textAlign = "left";

    // Divider under headers
    c.strokeStyle = "rgba(108, 116, 130, 0.5)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(60, 148);
    c.lineTo(w - 40, 148);
    c.stroke();

    // Rows
    aggregated.forEach((z, i) => {
      const y = 208 + i * 70;
      const bucket = pppToBucket(z.ppp);

      // Alternating row backdrop
      if (i % 2 === 1) {
        c.fillStyle = "rgba(18, 24, 36, 0.45)";
        c.fillRect(60, y - 40, w - 100, 60);
      }

      // Color swatch for the PPP bucket
      c.fillStyle = bucket.hex;
      c.fillRect(80, y - 24, 12, 32);

      // Zone name
      c.textAlign = "left";
      c.fillStyle = "#ffffff";
      c.font = `800 32px -apple-system, "SF Pro Display", Arial, sans-serif`;
      c.fillText(z.label, 108, y);

      // FGA value
      c.textAlign = "right";
      c.fillStyle = "#c9cdd4";
      c.font = `600 28px -apple-system, "SF Pro Display", Arial, sans-serif`;
      c.fillText(String(z.n), w - 240, y);

      // PPP value — tinted to match its bucket
      c.fillStyle = bucket.hex;
      c.font = `900 36px -apple-system, "SF Pro Display", Arial, sans-serif`;
      c.fillText(z.ppp.toFixed(2), w - 60, y);
    });
  }, 1024, 640);

  // Panel geometry shared by both sides.
  const PANEL_W = 16;
  const PANEL_H = 10;
  const PANEL_Y = 19;
  const PANEL_Z = BASELINE_Z + 14.5; // out in front of the back stand

  const mkScreen = (tex) => new THREE.MeshBasicMaterial({
    map: tex,
    toneMapped: false, // keep the LED glow from getting dimmed by ACES
  });

  const leftScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_W, PANEL_H),
    mkScreen(leftTex)
  );
  leftScreen.rotation.y = Math.PI; // face the camera at -Z
  leftScreen.position.set(-PANEL_W / 2 - 0.6, PANEL_Y, PANEL_Z);
  group.add(leftScreen);

  const rightScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_W, PANEL_H),
    mkScreen(rightTex)
  );
  rightScreen.rotation.y = Math.PI;
  rightScreen.position.set(PANEL_W / 2 + 0.6, PANEL_Y, PANEL_Z);
  group.add(rightScreen);

  // Dark bezel behind each LED panel
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x13161c, roughness: 0.65, metalness: 0.35,
  });
  for (const screen of [leftScreen, rightScreen]) {
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(PANEL_W + 0.7, PANEL_H + 0.7, 0.4),
      bezelMat
    );
    bezel.position.copy(screen.position);
    bezel.position.z += 0.22;
    group.add(bezel);
  }

  // Mounting truss above the pair (two thin horizontal rails)
  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x0c0e12, roughness: 0.55, metalness: 0.65,
  });
  for (let i = 0; i < 2; i += 1) {
    const truss = new THREE.Mesh(
      new THREE.BoxGeometry(PANEL_W * 2 + 4, 0.28, 0.28),
      trussMat
    );
    truss.position.set(0, PANEL_Y + PANEL_H / 2 + 0.7 + i * 0.55, PANEL_Z - 0.6);
    group.add(truss);
  }

  // Stubby vertical hanger bars from the trusses down to the bezel
  for (const xOffset of [-PANEL_W / 2 - 0.6, PANEL_W / 2 + 0.6]) {
    const hang = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1.4, 0.2),
      trussMat
    );
    hang.position.set(xOffset, PANEL_Y + PANEL_H / 2 + 0.4, PANEL_Z - 0.3);
    group.add(hang);
  }

  return group;
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------
export default function ThreeJsShotChartPrototype({
  shots = [],
  primaryDesignationNames,
  shooterDesignationNames,
  viewMode = "markers", // "markers" | "zones"
  // Optional: parent owns the wrapper dimensions; the tuning panel can
  // emit suggested width/height via onChartResize so the user can drag
  // sliders to find a layout that fits the page.
  onChartResize,
  initialChartWidth,
  initialChartHeight,
  // Bumped by the parent to fly the camera back to the Default preset.
  resetViewNonce = 0,
  // Bumped by the parent to fly the camera to the Top-down preset.
  topDownViewNonce = 0,
  // Bumped by the parent to dolly the camera in (closer to target).
  zoomInNonce = 0,
  // Bumped by the parent to dolly the camera out (farther from target).
  zoomOutNonce = 0,
  // Optional zone-label drag/resize unlock (kept for future use — no UI
  // button surfaces it on the portfolio at the moment).
  zoneEditable = false,
  zoneResetNonce = 0,
  // When true, clicking a marker on the court fires onMarkerTrim with its
  // shot id so the parent can suppress it. Hover tooltips are skipped in
  // this mode to avoid double-handling pointerdown.
  trimMode = false,
  onMarkerTrim,
  // Optional callback — fires whenever the camera settles into one of
  // the named presets (default | topdown) or drifts away from any
  // preset (sends `null`). Lets the parent highlight the matching
  // CAMERA VIEW button even after the user manually orbits/tilts.
  onActivePresetChange,
  // Portfolio-only: list of player cards to paint onto the court in the
  // half-court area. Each entry includes athleteId (for headshot), name,
  // designation, and a `rows` array of stat objects matching the same
  // shape the HTML PlayerCardView uses.
  courtPanelCards,
  // Team primary color for the lane / apron / hoop padding / floor accent
  // paint. Defaults to OU crimson so PDFPage06 (existing OU showcase) keeps
  // rendering identically. Pass any "#RRGGBB" string to recolor the court
  // for a different team in the 3D Shot Chart tool.
  teamPrimaryColor = "#841617",
  // URL of the team logo painted on the front padding and court floor.
  // Defaults to OU's logo so existing call sites are unaffected.
  teamLogoUrl = "/ou-logo.svg",
  // Text wordmark painted on the apron (e.g. "OKLAHOMA", "UCLA"). Defaults
  // to OKLAHOMA so PDFPage06 stays unchanged.
  teamWordmark = "OKLAHOMA",
} = {}) {
  // Mirror the team color into the module-level CRIMSON / APRON_HEX / CRIMSON_HEX
  // so that downstream paint functions (buildFloorAlbedo, drawOULogo, buildPlinth,
  // drawLedDotGrid, buildScoreboard, etc.) pick up the team's accent without
  // needing per-function color parameters. Safe because only one instance of
  // this component is mounted at a time.
  CRIMSON = teamPrimaryColor;
  APRON_HEX = parseInt(teamPrimaryColor.replace("#", ""), 16);
  CRIMSON_HEX = APRON_HEX;
  TEAM_WORDMARK = teamWordmark;

  const mountRef = useRef(null);
  const rafRef = useRef(0);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const markersGroupRef = useRef(null);
  const courtGroupRef = useRef(null);
  const zoneOverlayRef = useRef(null);
  // Tracks whether the cinematic intro (default → top-down drone) has
  // played. Only fires once per mount so re-renders don't replay it.
  const droneIntroDoneRef = useRef(false);
  // Interactive zone-label editor refs: invisible overlay boxes anchored
  // to each zone-label centroid. Drag the body = move; drag the corner
  // square = resize. Visual rendering is still flat canvas text — the
  // overlay just provides hit-testing.
  const labelDivsRef = useRef({});
  const draggingLabelIdRef = useRef(null);
  const resizingLabelIdRef = useRef(null);
  const resizeStartRef = useRef({ scale: 1, distPx: 1 });
  const viewModeRef = useRef("markers");
  const zoneLabelsLatestRef = useRef([]);
  const zoneExtentsRef = useRef(new Map());
  // RAF id of any in-flight `flyTo` camera transition — used to cancel a
  // previous fly when a new one starts (e.g. user spams preset buttons).
  const flyToRafRef = useRef(0);
  // Ref to the latest court-panel repaint function, set inside the scene
  // useEffect once headshots are loaded. A separate effect below calls it
  // whenever `courtPanelCards` changes so the stat numbers re-render
  // without rebuilding the whole 3D scene.
  const repaintCardsRef = useRef(null);
  // Latest courtPanelCards — read by repaintCardsRef when the parent
  // updates the props (Game / Result filter changes).
  const courtPanelCardsRef = useRef(courtPanelCards);
  courtPanelCardsRef.current = courtPanelCards;
  // Trim-mode refs — the click handler inside the scene useEffect (empty
  // deps) reads these on each click so the parent's latest state and
  // callback are always honored.
  const trimModeRef = useRef(trimMode);
  trimModeRef.current = trimMode;
  const onMarkerTrimRef = useRef(onMarkerTrim);
  onMarkerTrimRef.current = onMarkerTrim;

  // Smoothly drift the camera to a target pose. Same easing curve as the
  // intro drone shot, so preset clicks and "Apply view" feel cinematic
  // instead of snappy. Cancels any in-flight fly.
  const flyTo = (target, fov, durationMs = 2200) => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    if (flyToRafRef.current) {
      window.cancelAnimationFrame(flyToRafRef.current);
      flyToRafRef.current = 0;
    }
    const startPos = cam.position.clone();
    const startFov = cam.fov;
    const endPos = new THREE.Vector3(target.x, target.y, target.z);
    const endFov = fov;
    const t0 = performance.now();
    ctrl.enabled = false;
    const tick = () => {
      const elapsed = performance.now() - t0;
      const t = Math.min(1, elapsed / durationMs);
      const eased = t * t * (3 - 2 * t); // smoothstep
      cam.position.lerpVectors(startPos, endPos, eased);
      cam.fov = startFov + (endFov - startFov) * eased;
      cam.updateProjectionMatrix();
      cam.lookAt(ctrl.target);
      if (t < 1) {
        flyToRafRef.current = window.requestAnimationFrame(tick);
      } else {
        flyToRafRef.current = 0;
        ctrl.enabled = true;
        ctrl.update();
      }
    };
    flyToRafRef.current = window.requestAnimationFrame(tick);
  };
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // ── Live camera-tuning panel ──────────────────────────────────────────
  // Toggle with the ` key. Adjust sliders, read the values, then hardcode.
  const [camPanelOpen, setCamPanelOpen] = useState(false);
  const CAM_DEFAULT_STORAGE_KEY = "shotChart3D.camDefault.v1";
  const BASE_CAM_DEFAULT = {
    minDist:    80,
    maxDist:    220,
    maxPolar:   58,
    targetZ:    0,
    enablePan:  false,
    enableZoom: false,
    // Portfolio version: near-top-down so the on-court legend + player
    // cards (flat decals at half-court) read cleanly without foreshortening.
    // Original Defense Dashboard uses fov:22 / camY:116 / camZ:-70.
    fov:        32,
    camX:       0,
    camY:       110,
    camZ:       -22,
    zoom:       1.0,
    courtScale: 0.95,
    courtY:     0.25,
  };
  const [camLimits, setCamLimits] = useState(() => {
    if (typeof window === "undefined") return { ...BASE_CAM_DEFAULT };
    try {
      const raw = window.localStorage.getItem(CAM_DEFAULT_STORAGE_KEY);
      if (!raw) return { ...BASE_CAM_DEFAULT };
      const saved = JSON.parse(raw);
      return { ...BASE_CAM_DEFAULT, ...saved };
    } catch {
      return { ...BASE_CAM_DEFAULT };
    }
  });
  // Saved snapshot used by the "Default" preset button. Lets the user
  // adjust camLimits transiently (sliders, dragging) without changing
  // what "Default" returns to. Updated by the "Save as Default" button.
  const camDefaultRef = useRef({ ...camLimits });
  // Chart wrapper size (px) — sliders in the tuning panel emit these to the
  // parent via onChartResize so the user can fit the chart to the page.
  // Default height trimmed to ~720 so the empty arena floor below the
  // court doesn't push down content (e.g. the shot count).
  const [chartSize, setChartSize] = useState(() => ({
    width:  Math.round(initialChartWidth  ?? 1300),
    height: Math.round(initialChartHeight ?? 723),
  }));

  // Editable per-zone label config. Position (wx, wz) and scale persist
  // across reloads via localStorage so user adjustments stick.
  const ZONE_LABELS_STORAGE_KEY = "shotChart3D.zoneLabels.v1";
  const [zoneLabels, setZoneLabels] = useState(() => {
    const defaults = ZONES.map((z) => {
      // Corner-3 zones (ids 8 + 9) are narrow; bump default scale so
      // numbers read.
      const isCorner3 = z.id === 8 || z.id === 9;
      return {
        id: z.id,
        wx: ZONE_CENTROIDS[z.id].wx,
        wz: ZONE_CENTROIDS[z.id].wz,
        scale: isCorner3 ? 1.8 : 1.0,
      };
    });
    try {
      const saved = window.localStorage?.getItem(ZONE_LABELS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === defaults.length) {
          // Merge by id so any new fields fall back to defaults.
          return defaults.map((d) => {
            const hit = parsed.find((p) => p.id === d.id);
            return hit ? { ...d, ...hit } : d;
          });
        }
      }
    } catch {
      /* ignore localStorage errors */
    }
    return defaults;
  });
  // Persist any zone-label edit to localStorage.
  useEffect(() => {
    try {
      window.localStorage?.setItem(
        ZONE_LABELS_STORAGE_KEY,
        JSON.stringify(zoneLabels)
      );
    } catch {
      /* ignore */
    }
  }, [zoneLabels]);


  // Per-zone maximum extent (in feet) inside that zone's own polygon.
  // Scanned from the DEFAULT centroid (ZONE_CENTROIDS), not the user's
  // dragged position — that way moving a label doesn't change its size.
  // Resize is owned exclusively by the corner handle (lbl.scale).
  const zoneExtents = useMemo(() => {
    const STEP = 0.15;
    const MAX  = 32;
    const MARGIN = 0.4;
    const inBounds = (wx, wz) =>
      Math.abs(wx) <= HALF_W - MARGIN &&
      wz <= HALF_L - MARGIN &&
      wz >= -HALF_L + MARGIN;
    const m = new Map();
    for (const zone of ZONES) {
      const myZid = zone.id;
      const c = ZONE_CENTROIDS[myZid];
      let left = MAX, right = MAX, up = MAX, down = MAX;
      for (let d = STEP; d <= MAX; d += STEP) {
        if (left === MAX) {
          const w = c.wx - d;
          if (!inBounds(w, c.wz) || classifyZoneId(w, c.wz) !== myZid) left = d;
        }
        if (right === MAX) {
          const w = c.wx + d;
          if (!inBounds(w, c.wz) || classifyZoneId(w, c.wz) !== myZid) right = d;
        }
        if (up === MAX) {
          const z = c.wz + d;
          if (!inBounds(c.wx, z) || classifyZoneId(c.wx, z) !== myZid) up = d;
        }
        if (down === MAX) {
          const z = c.wz - d;
          if (!inBounds(c.wx, z) || classifyZoneId(c.wx, z) !== myZid) down = d;
        }
        if (left < MAX && right < MAX && up < MAX && down < MAX) break;
      }
      m.set(myZid, {
        left:  Math.max(0.4, left),
        right: Math.max(0.4, right),
        up:    Math.max(0.4, up),
        down:  Math.max(0.4, down),
      });
    }
    return m;
  }, []); // constant — independent of zoneLabels positions

  // Per-zone defensive stats from the (already role/game-filtered) shots
  // prop. Re-computed only when the shot set changes — used by the HTML
  // label overlay AND by the panel readouts.
  const zoneStats = useMemo(() => {
    const m = new Map();
    for (const z of ZONES) m.set(z.id, { att: 0, mk: 0, pts: 0 });
    for (const shot of shots) {
      if (shot.x == null || shot.y == null) continue;
      const sx = Math.max(0, Math.min(50, shot.x));
      const sy = Math.max(0, Math.min(35, shot.y));
      const wx = 25 - sx;
      const wz = BACKBOARD_Z - sy;
      const zid = classifyZoneId(wx, wz);
      const s = m.get(zid);
      if (!s) continue;
      s.att += 1;
      if (shot.made === true) {
        s.mk += 1;
        // 3-pt zones are ids 8..12 (Corner-3 + Wings + Top of Key 3)
        s.pts += Number(shot.attemptValue) || (zid >= 8 ? 3 : 2);
      }
    }
    return m;
  }, [shots]);

  // Sync refs so the per-frame project loop inside the scene useEffect
  // can read current viewMode / zoneLabels / zoneExtents values.
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { zoneLabelsLatestRef.current = zoneLabels; }, [zoneLabels]);
  useEffect(() => { zoneExtentsRef.current = zoneExtents; }, [zoneExtents]);
  // Nonce to force "apply exact view" (snap camera to current slider values
  // without waiting for user drag).
  const [applyViewNonce, setApplyViewNonce] = useState(0);
  // Flips to true once the async scene-setup finishes and
  // markersGroupRef.current is wired up. Drives the marker-rebuild effect
  // so it re-runs once the scene is ready even when `shots` hasn't changed.
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    const cleanup = [];

    // --- Renderer / Scene / Camera --- (sync so StrictMode cleanup can reach)
    const scene = new THREE.Scene();
    // No scene background: paired with an alpha-enabled renderer below so
    // the canvas is transparent and the portfolio page color shows through
    // around the court. (Original Defense Dashboard uses 0x04060b.)
    scene.background = null;

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;
    // First frame renders at the TOP-DOWN pose so the cinematic intro
    // can drone *down* to the working default pose without a 1-frame
    // glitch where the user briefly sees the default view first.
    const camera = new THREE.PerspectiveCamera(TOPDOWN_CAM.fov, width / height, 0.5, 1500);
    camera.position.set(TOPDOWN_CAM.x, TOPDOWN_CAM.y, TOPDOWN_CAM.z);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    // Transparent clear so the portfolio page bg shows through around the
    // court. (Original Defense Dashboard relies on the solid scene bg.)
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Bumped from 0.82 → 1.1 so the wood floor reads bright against the
    // cream portfolio bg instead of looking dimmed-arena.
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Register renderer-teardown cleanup IMMEDIATELY so StrictMode can tear
    // down the first mount before the async texture loads resolve.
    cleanup.push(() => {
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    });

    (async () => { try {

      if (disposed) return;

      // Environment map via PMREM for nice reflections on glass backboard
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      cleanup.push(() => pmrem.dispose());

      // --- Lighting --- (portfolio version: brighter ambient so the wood
      // reads on a cream bg; original Defense Dashboard uses 0.12 / hemi
      // 0x2a3654 over 0x070406 for an arena-mood low-ambient feel.)
      scene.add(new THREE.AmbientLight(0xffffff, 0.35));
      const hemi = new THREE.HemisphereLight(0xfafaf6, 0xd6c5a8, 0.45);
      scene.add(hemi);
      const key = new THREE.DirectionalLight(0xffffff, 1.15);
      key.position.set(-14, 48, -12);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -35;
      key.shadow.camera.right = 35;
      key.shadow.camera.top = 35;
      key.shadow.camera.bottom = -35;
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 120;
      key.shadow.bias = -0.0005;
      scene.add(key);
      // Fill + rim point lights — pushed off-axis from court centre and
      // dimmed dramatically so the Top-Down camera doesn't see a bright
      // hotspot directly under it. Ambient lifts to keep average court
      // brightness reasonable.
      const fill = new THREE.PointLight(0xcadcff, 3, 140, 1.6);
      fill.position.set(-32, 60, -30);
      scene.add(fill);
      const rim = new THREE.PointLight(0xffd1b5, 3, 90, 1.8);
      rim.position.set(28, 40, 24);
      scene.add(rim);

      // --- Inject the collegiate display font (Graduate) once ---
      if (!document.getElementById("graduate-font-link")) {
        const link = document.createElement("link");
        link.id = "graduate-font-link";
        link.rel = "stylesheet";
        link.href = "https://fonts.googleapis.com/css2?family=Graduate&display=swap";
        document.head.appendChild(link);
      }

      // --- Inject the OU report fonts (SF Pro / Georgia) so canvas text in
      // the 3D chart matches the PDF output exactly. ---
      if (!document.getElementById("ou-report-fonts")) {
        const style = document.createElement("style");
        style.id = "ou-report-fonts";
        style.textContent = REPORT_FONT_FACES;
        document.head.appendChild(style);
      }

      // --- Load wood textures + OU logo + collegiate font + build composite floor ---
      // Note: ouLogoImg is the team logo image — the variable name is kept
      // for legacy reasons across the downstream paint functions.
      const [woodImg, ouLogoImg, normalTex, roughTex] = await Promise.all([
        loadImage("/textures/wood_floor/diff.jpg"),
        loadImage(teamLogoUrl).catch(() => null),
        new THREE.TextureLoader().loadAsync("/textures/wood_floor/normal.jpg"),
        new THREE.TextureLoader().loadAsync("/textures/wood_floor/rough.jpg"),
        document.fonts
          ? document.fonts.load('400 120px "Graduate"').catch(() => null)
          : null,
      ]);
      if (disposed) return;

      const albedoTex = buildFloorAlbedo(woodImg, ouLogoImg);
      const tilesX = FLOOR_W / WOOD_TILE_FT;
      const tilesY = FLOOR_L / WOOD_TILE_FT;
      for (const t of [normalTex, roughTex]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(tilesX, tilesY);
        t.anisotropy = 16;
        t.flipY = false;
      }

      const floorMat = new THREE.MeshStandardMaterial({
        map: albedoTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(0.35, 0.35),
        roughnessMap: roughTex,
        // Less mirror-like — at 0.2 roughness + 1.6 envMapIntensity the
        // top-down camera sees a bright ceiling reflection right under
        // it. Dialed back so the wood stays lit but doesn't hotspot.
        roughness: 0.5,
        metalness: 0.1,
        envMapIntensity: 0.6,
      });
      // Group everything court-related (floor, plinth, lane overlay, markers,
      // hoop) so we can scale the entire court down without shrinking the
      // arena environment. Keeps corners from clipping out of frame while
      // the orbit camera swings around. Smaller scale = more dark
      // environment visible around the court at all rotation angles.
      const courtGroup = new THREE.Group();
      courtGroup.name = "court-group";
      // Default scale + Y offset; the camLimits-sync effect drives these
      // live so the user can dial size and vertical position from sliders.
      courtGroup.scale.setScalar(0.9);
      courtGroup.position.y = 0.25;
      scene.add(courtGroup);
      courtGroupRef.current = courtGroup;

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(FLOOR_W, FLOOR_L),
        floorMat
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      courtGroup.add(floor);

      // Portfolio version: the arena surround + dome are skipped entirely
      // so the canvas's transparent clear lets the page cream show through
      // around the court. (Original Defense Dashboard uses a dark plane +
      // hemisphere to hide the abrupt court edge against arena dark.)

      courtGroup.add(buildPlinth(woodImg, normalTex, roughTex));

      // Unlit crimson overlay on the lane with baked white lane boundary +
      // FT circle solid half + restricted-area half-circle, so the crimson
      // matches the apron exactly (MeshStandard otherwise lifts the paint
      // toward pink under the spotlight).
      const lanePpf = 160;
      const laneCanvasW = Math.round(C.laneWidth * lanePpf);
      const laneCanvasH = Math.round(C.laneLength * lanePpf);
      const laneCanvas = document.createElement("canvas");
      laneCanvas.width = laneCanvasW;
      laneCanvas.height = laneCanvasH;
      const lctx = laneCanvas.getContext("2d");
      lctx.fillStyle = CRIMSON;
      lctx.fillRect(0, 0, laneCanvasW, laneCanvasH);

      // Very subtle plank seams over the bright crimson base, matching the
      // 1 ft × 3 ft panel layout of the wood floor. No grain overlay — the
      // paint stays bright crimson; only the panel lines read through.
      const lanePlankFt = 1.0;
      const laneButtFt = 3.0;
      const laneSeamPx = Math.max(1, Math.round(0.012 * lanePpf));
      const seamColor = "rgba(30, 8, 10, 0.22)";
      lctx.fillStyle = seamColor;
      for (let fx = 0; fx <= C.laneWidth; fx += lanePlankFt) {
        lctx.fillRect(
          Math.round(fx * lanePpf),
          0,
          laneSeamPx,
          laneCanvasH
        );
      }
      // Staggered butt joints — offset per-plank so seams don't line up.
      for (let fx = 0, i = 0; fx < C.laneWidth; fx += lanePlankFt, i += 1) {
        const offset = ((i * 11) % 13) * (laneButtFt / 13);
        for (let fz = offset; fz <= C.laneLength; fz += laneButtFt) {
          lctx.fillRect(
            Math.round(fx * lanePpf),
            Math.round(fz * lanePpf),
            Math.round(lanePlankFt * lanePpf),
            laneSeamPx
          );
        }
      }

      lctx.strokeStyle = "#ffffff";
      lctx.lineWidth = 0.2 * lanePpf;
      // Lane boundary (FT line + both sides). Inset half a stroke so the line
      // renders fully on-canvas.
      const half = lctx.lineWidth / 2;
      lctx.strokeRect(
        half,
        half,
        laneCanvasW - lctx.lineWidth,
        laneCanvasH - lctx.lineWidth
      );
      // Restricted-area half-circle (4 ft around the rim, opening toward the
      // FT line). Canvas top = FT line side, canvas bottom = baseline side,
      // so the rim sits (HOOP_Z − FT_Z) ft down from canvas top.
      const rimCanvasY =
        ((HOOP_Z - FT_Z) / C.laneLength) * laneCanvasH;
      const rimCanvasX = laneCanvasW / 2;
      const restrictedR = C.restrictedRadius * lanePpf;
      lctx.beginPath();
      lctx.arc(rimCanvasX, rimCanvasY, restrictedR, Math.PI, 2 * Math.PI, false);
      lctx.stroke();

      const laneTex = new THREE.CanvasTexture(laneCanvas);
      laneTex.colorSpace = THREE.SRGBColorSpace;
      laneTex.anisotropy = 16;
      const laneOverlay = new THREE.Mesh(
        new THREE.PlaneGeometry(C.laneWidth, C.laneLength),
        new THREE.MeshBasicMaterial({ map: laneTex, toneMapped: false })
      );
      laneOverlay.rotation.x = -Math.PI / 2;
      laneOverlay.position.set(
        0,
        0.006,
        (BASELINE_Z + FT_Z) / 2
      );
      courtGroup.add(laneOverlay);

      if (courtPanelCards && courtPanelCards.length > 0) {
        const PANEL_W = 50;
        const PANEL_D = 20; // sits in the back-court area, below the 3pt arc
        const CANV_W = 4000;
        const CANV_H = Math.round((CANV_W * PANEL_D) / PANEL_W); // 1600

        const panelCanvas = document.createElement("canvas");
        panelCanvas.width = CANV_W;
        panelCanvas.height = CANV_H;
        const pctx = panelCanvas.getContext("2d");

        const drawRoundRect = (ctx, x, y, w, h, r, fill) => {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
          ctx.fill();
        };

        const inset = 16;
        const padX = 40;
        const sectionGap = 40; // vertical gap between stacked cards
        const contentLeft = inset + padX;
        const contentRight = CANV_W - inset - padX;
        const contentW = contentRight - contentLeft;
        // Stacked layout: each card takes the FULL panel width so the
        // 13-column stat row has room to breathe.
        const cardW = contentW;
        const cardH = (CANV_H - inset * 2 - 40 - sectionGap) / 2;
        const sectionTop = inset + 20;

        // ─── Legend section ─── (dark text so it reads on the wood floor)
        const drawLegend = () => {
          let y = sectionTop;
          pctx.fillStyle = "rgba(24,23,26,0.85)";
          pctx.font = "800 56px ui-sans-serif, system-ui, sans-serif";
          pctx.textAlign = "left";
          pctx.textBaseline = "alphabetic";
          pctx.fillText("SHOT LEGEND", contentLeft, y + 50);
          y += 92;
          pctx.font = "700 28px ui-sans-serif, system-ui, sans-serif";
          pctx.fillStyle = "rgba(24,23,26,0.55)";
          pctx.textAlign = "left";
          pctx.fillText("DESIGNATION", contentLeft, y);
          pctx.textAlign = "center";
          const dotMadeX = contentLeft + legendW - 130;
          const dotMissX = contentLeft + legendW - 40;
          pctx.fillText("MADE", dotMadeX, y);
          pctx.fillText("MISS", dotMissX, y);
          y += 42;
          const legendRows = [
            { label: "Primary", color: "#1d4ed8" }, // deeper blue for wood-bg contrast
            { label: "Shooter", color: "#15803d" }, // deeper green
            { label: "Role Player", color: "#374151" },
          ];
          for (const r of legendRows) {
            pctx.font = "800 40px ui-sans-serif, system-ui, sans-serif";
            pctx.fillStyle = r.color;
            pctx.textAlign = "left";
            pctx.fillText(r.label, contentLeft, y + 52);
            pctx.beginPath();
            pctx.arc(dotMadeX, y + 40, 22, 0, Math.PI * 2);
            pctx.fillStyle = r.color;
            pctx.fill();
            pctx.beginPath();
            pctx.arc(dotMissX, y + 40, 22, 0, Math.PI * 2);
            pctx.strokeStyle = r.color;
            pctx.lineWidth = 5;
            pctx.stroke();
            y += 90;
          }
        };

        // ─── Player card ─── (no dark background; text directly on wood)
        const drawPlayerCard = (card, x, y, w, h, headshotImg) => {
          const badge =
            card.designation === "primary"
              ? { text: "PRIMARY POST", color: "#1d4ed8" }
              : card.designation === "shooter"
                ? { text: "SHOOTER", color: "#15803d" }
                : { text: "ROLE", color: "#374151" };

          const padding = 28;
          let cy = y + padding;
          // Headshot circle — large portrait now that each card is full-width.
          const HEAD_SIZE = 260;
          const headX = x + padding;
          const headY = cy;
          if (headshotImg && headshotImg.complete && headshotImg.naturalWidth > 0) {
            pctx.save();
            pctx.beginPath();
            pctx.arc(headX + HEAD_SIZE / 2, headY + HEAD_SIZE / 2, HEAD_SIZE / 2, 0, Math.PI * 2);
            pctx.closePath();
            pctx.clip();
            pctx.drawImage(headshotImg, headX, headY, HEAD_SIZE, HEAD_SIZE);
            pctx.restore();
            pctx.beginPath();
            pctx.arc(headX + HEAD_SIZE / 2, headY + HEAD_SIZE / 2, HEAD_SIZE / 2, 0, Math.PI * 2);
            pctx.strokeStyle = "rgba(24,23,26,0.4)";
            pctx.lineWidth = 4;
            pctx.stroke();
          } else {
            // Headshot couldn't load — show placeholder circle with initials.
            pctx.beginPath();
            pctx.arc(headX + HEAD_SIZE / 2, headY + HEAD_SIZE / 2, HEAD_SIZE / 2, 0, Math.PI * 2);
            pctx.fillStyle = "rgba(24,23,26,0.18)";
            pctx.fill();
            pctx.strokeStyle = "rgba(24,23,26,0.4)";
            pctx.lineWidth = 4;
            pctx.stroke();
            const initials = card.name.split(/\s+/).map((s) => s[0]).join("");
            pctx.fillStyle = "rgba(24,23,26,0.7)";
            pctx.font = "800 46px ui-sans-serif, system-ui, sans-serif";
            pctx.textAlign = "center";
            pctx.textBaseline = "middle";
            pctx.fillText(initials, headX + HEAD_SIZE / 2, headY + HEAD_SIZE / 2 + 4);
          }

          // Name + role badge — solid black, very large
          const textX = headX + HEAD_SIZE + 48;
          pctx.fillStyle = "#000000";
          pctx.font = "900 120px ui-sans-serif, system-ui, sans-serif";
          pctx.textAlign = "left";
          pctx.textBaseline = "alphabetic";
          pctx.fillText(card.name, textX, cy + 110);
          // Badge sized to fit "PRIMARY POST" (12 chars) at a large font.
          const badgeW = 540;
          const badgeH = 84;
          const badgeY = cy + 140;
          drawRoundRect(pctx, textX, badgeY, badgeW, badgeH, 12, badge.color);
          pctx.fillStyle = "#fafaf6";
          pctx.font = "900 60px ui-sans-serif, system-ui, sans-serif";
          pctx.textAlign = "center";
          pctx.textBaseline = "middle";
          pctx.fillText(badge.text, textX + badgeW / 2, badgeY + badgeH / 2 + 2);

          cy += HEAD_SIZE + 60;

          // Stat table — each card has the FULL panel width.
          const tableX = x + padding;
          const tableW = w - padding * 2;
          const labelColW = 320;
          const cellW = (tableW - labelColW) / card.rows.length;
          // Header row supports two-line labels (e.g. "PAINT" / "FGM") so
          // multi-word headers fit cleanly without squishing into the
          // neighbor column.
          pctx.font = "900 44px ui-sans-serif, system-ui, sans-serif";
          pctx.fillStyle = "#000000";
          pctx.textAlign = "center";
          pctx.textBaseline = "alphabetic";
          card.rows.forEach((r, i) => {
            const cx = tableX + labelColW + cellW * (i + 0.5);
            // Split labels containing "-" onto two lines.
            if (r.label.includes("-")) {
              const [top, bot] = r.label.split("-");
              pctx.fillText(top, cx, cy + 44);
              pctx.fillText(bot, cx, cy + 88);
            } else {
              pctx.fillText(r.label, cx, cy + 70);
            }
          });
          cy += 110;

          const drawValueRow = (label, valueGetter, colorGetter) => {
            // Bigger row title so GAME / SEASON read clearly.
            pctx.font = "900 60px ui-sans-serif, system-ui, sans-serif";
            pctx.fillStyle = "#000000";
            pctx.textAlign = "left";
            pctx.fillText(label, tableX, cy + 70);
            pctx.font = "900 60px ui-sans-serif, system-ui, sans-serif";
            pctx.textAlign = "center";
            card.rows.forEach((r, i) => {
              const cx = tableX + labelColW + cellW * (i + 0.5);
              pctx.fillStyle = colorGetter(r);
              pctx.fillText(valueGetter(r), cx, cy + 70);
            });
            cy += 100;
          };

          const cellColor = (row) => {
            if (row.direction === "neutral") return "#000000";
            const a = row.gameNum;
            const b = row.seasonNum;
            if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return "#000000";
            const margin = Math.max(Math.abs(b) * 0.10, 0.4);
            const diff = a - b;
            if (Math.abs(diff) <= margin) return "#000000";
            const goodWhenLower = row.direction === "lower";
            const isGood = goodWhenLower ? diff < 0 : diff > 0;
            return isGood ? "#15803d" : "#b91c1c";
          };

          drawValueRow("GAME", (r) => r.game, cellColor);
          drawValueRow("SEASON", (r) => r.season, () => "#000000");
        };

        const card1X = contentLeft;
        // Stacked vertically — both cards at the same X.
        const card1Y = sectionTop;
        const card2Y = card1Y + cardH + sectionGap;

        const panelTex = new THREE.CanvasTexture(panelCanvas);
        panelTex.colorSpace = THREE.SRGBColorSpace;
        panelTex.anisotropy = 8;
        panelTex.center.set(0.5, 0.5);
        panelTex.rotation = Math.PI;
        panelTex.needsUpdate = true;

        const panelGeo = new THREE.PlaneGeometry(PANEL_W, PANEL_D);
        const panelMat = new THREE.MeshBasicMaterial({
          map: panelTex,
          transparent: true,
          depthWrite: false,
        });
        const panelMesh = new THREE.Mesh(panelGeo, panelMat);
        panelMesh.rotation.x = -Math.PI / 2;
        // Position so the panel sits squarely in the half-court area: top
        // edge below the 3-point arc, bottom edge inside the half-court
        // line (so Verhulst's bottom row isn't cut off into the cream).
        panelMesh.position.set(0, 0.08, -HALF_L + PANEL_D / 2 - 1);
        panelMesh.renderOrder = 5;
        courtGroup.add(panelMesh);

        // Cache loaded headshots so subsequent repaints (when the parent
        // changes the Game / Result filter) don't re-fetch them.
        let cachedHeadshots = [null, null];

        // Repaint uses the LATEST courtPanelCards from the ref so prop
        // updates flow through without rebuilding the scene.
        const repaint = (headshotImgs) => {
          const cards = courtPanelCardsRef.current || [];
          pctx.clearRect(0, 0, CANV_W, CANV_H);
          if (cards[0]) {
            drawPlayerCard(cards[0], card1X, card1Y, cardW, cardH, headshotImgs[0]);
          }
          if (cards[1]) {
            drawPlayerCard(cards[1], card1X, card2Y, cardW, cardH, headshotImgs[1]);
          }
          panelTex.needsUpdate = true;
        };
        repaint(cachedHeadshots);

        // Expose a stable repaint hook to the outside-scene effect so it
        // can fire when courtPanelCards changes.
        repaintCardsRef.current = () => repaint(cachedHeadshots);

        // Load headshots in the background (CORS may block — fallback to
        // initials placeholder if so).
        const loadHeadshot = (athleteId) =>
          new Promise((resolve) => {
            if (!athleteId) return resolve(null);
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.referrerPolicy = "no-referrer";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = `https://a.espncdn.com/combiner/i?img=/i/headshots/womens-college-basketball/players/full/${athleteId}.png&w=160&h=160&scale=crop`;
          });

        Promise.all(courtPanelCards.map((c) => loadHeadshot(c.athleteId))).then((imgs) => {
          if (disposed) return;
          cachedHeadshots = imgs;
          repaint(imgs);
        });

        cleanup.push(() => {
          repaintCardsRef.current = null;
          panelTex.dispose();
          panelMat.dispose();
          panelGeo.dispose();
        });
      }

      // (Earlier on-court 3D toolbar was removed — controls now live as an
      // HTML row underneath the chart.)
      if (false) {
        const TBAR_W = 50;
        const TBAR_D = 8;
        const TBAR_CW = 4000;
        const TBAR_CH = Math.round((TBAR_CW * TBAR_D) / TBAR_W); // 640
        const tcv = document.createElement("canvas");
        tcv.width = TBAR_CW;
        tcv.height = TBAR_CH;
        const tcx = tcv.getContext("2d");

        const drawRR = (ctx, x, y, w, h, r, fill, stroke) => {
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
          if (fill) { ctx.fillStyle = fill; ctx.fill(); }
          if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
        };

        const repaintToolbar = () => {
          tcx.clearRect(0, 0, TBAR_CW, TBAR_CH);
          toolbarRegionsRef.current = [];

          const state = toolbarStateRef.current || {};
          const CARDS = 7;
          const gap = 14;
          const inset = 14;
          const innerW = TBAR_CW - inset * 2 - gap * (CARDS - 1);
          const cardW = innerW / CARDS;
          const cardH = TBAR_CH - inset * 2;

          const cards = [
            {
              group: "camera",
              title: "CAMERA",
              type: "buttons",
              options: [
                { key: "default", label: "Default" },
                { key: "topdown", label: "Top-Down" },
              ],
              active: state.activeCam,
            },
            {
              group: "view",
              title: "CHART VIEW",
              type: "buttons",
              options: [
                { key: "markers", label: "Markers" },
                { key: "zones", label: "Zones" },
              ],
              active: state.viewMode,
            },
            {
              group: "game",
              title: "GAME",
              type: "static",
              value: "Oklahoma State",
            },
            {
              group: "result",
              title: "RESULT",
              type: "buttons",
              options: [
                { key: "all", label: "All" },
                { key: "made", label: "Made" },
                { key: "miss", label: "Miss" },
              ],
              active: state.resultFilter,
            },
            {
              group: "role",
              title: "ROLE",
              type: "buttons",
              options: [
                { key: "all", label: "All" },
                { key: "primary", label: "Primary" },
                { key: "shooter", label: "Shooter" },
                { key: "role", label: "Role" },
              ],
              active: state.roleFilter,
            },
            {
              group: "legend",
              title: "SHOT LEGEND",
              type: "legend",
              rows: [
                { label: "Primary", color: "#1d4ed8" },
                { label: "Shooter", color: "#15803d" },
                { label: "Role", color: "#374151" },
              ],
            },
            {
              group: "reset",
              title: "",
              type: "reset",
              label: "↻ RESET",
            },
          ];

          cards.forEach((c, idx) => {
            const cx0 = inset + (cardW + gap) * idx;
            const cy0 = inset;
            // Card background — dark translucent panel
            drawRR(tcx, cx0, cy0, cardW, cardH, 10, "rgba(20, 20, 22, 0.92)", "rgba(255,255,255,0.10)");

            const padX = 18;
            const padY = 14;

            if (c.type === "reset") {
              // Full-card reset button — team primary color
              drawRR(tcx, cx0 + 8, cy0 + 8, cardW - 16, cardH - 16, 8, CRIMSON);
              tcx.fillStyle = "#fafaf6";
              tcx.font = "900 44px ui-sans-serif, system-ui, sans-serif";
              tcx.textAlign = "center";
              tcx.textBaseline = "middle";
              tcx.fillText(c.label, cx0 + cardW / 2, cy0 + cardH / 2);
              toolbarRegionsRef.current.push({ group: c.group, key: "reset", x: cx0, y: cy0, w: cardW, h: cardH });
              return;
            }

            // Title row (top inside the card)
            tcx.fillStyle = "rgba(255,255,255,0.55)";
            tcx.font = "800 28px ui-sans-serif, system-ui, sans-serif";
            tcx.textAlign = "left";
            tcx.textBaseline = "alphabetic";
            tcx.fillText(c.title, cx0 + padX, cy0 + padY + 28);

            const contentY = cy0 + padY + 44;
            const contentH = cardH - (padY + 44) - padY;
            const contentX = cx0 + padX;
            const contentW = cardW - padX * 2;

            if (c.type === "buttons") {
              const N = c.options.length;
              const btnGap = 6;
              const btnW = (contentW - btnGap * (N - 1)) / N;
              c.options.forEach((opt, j) => {
                const bx = contentX + (btnW + btnGap) * j;
                const isActive = opt.key === c.active;
                drawRR(
                  tcx,
                  bx,
                  contentY,
                  btnW,
                  contentH,
                  6,
                  isActive ? CRIMSON : "rgba(40,40,42,0.85)",
                  "rgba(255,255,255,0.15)"
                );
                tcx.fillStyle = isActive ? "#fafaf6" : "#e8e8e6";
                tcx.font = "900 32px ui-sans-serif, system-ui, sans-serif";
                tcx.textAlign = "center";
                tcx.textBaseline = "middle";
                tcx.fillText(opt.label.toUpperCase(), bx + btnW / 2, contentY + contentH / 2);
                toolbarRegionsRef.current.push({ group: c.group, key: opt.key, x: bx, y: contentY, w: btnW, h: contentH });
              });
            } else if (c.type === "static") {
              drawRR(tcx, contentX, contentY, contentW, contentH, 6, "rgba(40,40,42,0.85)", "rgba(255,255,255,0.15)");
              tcx.fillStyle = "#fafaf6";
              tcx.font = "900 28px ui-sans-serif, system-ui, sans-serif";
              tcx.textAlign = "center";
              tcx.textBaseline = "middle";
              tcx.fillText(c.value, contentX + contentW / 2, contentY + contentH / 2);
            } else if (c.type === "legend") {
              // Three rows of [colored label] [filled dot] [ring dot]
              const rowH = contentH / 3;
              c.rows.forEach((r, j) => {
                const ry = contentY + rowH * j;
                tcx.fillStyle = r.color;
                tcx.font = "900 26px ui-sans-serif, system-ui, sans-serif";
                tcx.textAlign = "left";
                tcx.textBaseline = "middle";
                tcx.fillText(r.label, contentX, ry + rowH / 2);
                // Made dot
                const dotMadeX = contentX + contentW - 70;
                const dotMissX = contentX + contentW - 24;
                const dotCY = ry + rowH / 2;
                tcx.beginPath();
                tcx.arc(dotMadeX, dotCY, 10, 0, Math.PI * 2);
                tcx.fillStyle = r.color;
                tcx.fill();
                tcx.beginPath();
                tcx.arc(dotMissX, dotCY, 10, 0, Math.PI * 2);
                tcx.strokeStyle = r.color;
                tcx.lineWidth = 3;
                tcx.stroke();
              });
            }
          });
          tbarTex.needsUpdate = true;
        };

        const tbarTex = new THREE.CanvasTexture(tcv);
        tbarTex.colorSpace = THREE.SRGBColorSpace;
        tbarTex.center.set(0.5, 0.5);
        tbarTex.rotation = Math.PI;
        tbarTex.anisotropy = 8;

        repaintToolbar();

        const tbarGeo = new THREE.PlaneGeometry(TBAR_W, TBAR_D);
        const tbarMat = new THREE.MeshBasicMaterial({ map: tbarTex, transparent: true, depthWrite: false });
        const tbarMesh = new THREE.Mesh(tbarGeo, tbarMat);
        tbarMesh.rotation.x = -Math.PI / 2;
        // Position beyond the player cards (further past half-court line).
        tbarMesh.position.set(0, 0.09, -HALF_L - 6);
        tbarMesh.userData.kind = "court-toolbar";
        tbarMesh.userData.canvasW = TBAR_CW;
        tbarMesh.userData.canvasH = TBAR_CH;
        tbarMesh.renderOrder = 6;
        toolbarMeshRef.current = tbarMesh;
        toolbarMeshOuterRef.current = tbarMesh;
        courtGroup.add(tbarMesh);

        // Repaint hook — outer useEffect calls this when state changes.
        toolbarMeshRef.current.userData.repaint = repaintToolbar;

        cleanup.push(() => {
          tbarTex.dispose();
          tbarMat.dispose();
          tbarGeo.dispose();
        });

        // Raycaster click handler — maps screen click → toolbar plane UV →
        // region → onToolbarSelect callback.
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const onCanvasClick = (e) => {
          const cb = onToolbarSelectRef.current;
          if (!cb || !toolbarMeshRef.current) return;
          const rect = renderer.domElement.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(mouse, camera);
          const hits = raycaster.intersectObject(toolbarMeshRef.current, false);
          if (!hits.length || !hits[0].uv) return;
          const uv = hits[0].uv;
          const u = 1 - uv.x;
          const v = 1 - uv.y;
          const px = u * TBAR_CW;
          const py = v * TBAR_CH;
          for (const r of toolbarRegionsRef.current) {
            if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
              cb(r.group, r.key);
              return;
            }
          }
        };
        renderer.domElement.addEventListener("click", onCanvasClick);
        renderer.domElement.style.cursor = "pointer";
        cleanup.push(() => renderer.domElement.removeEventListener("click", onCanvasClick));
      }

      // Shot markers group (populated by the `shots` prop via a second effect).
      const markersGroup = new THREE.Group();
      markersGroup.name = "shot-markers";
      courtGroup.add(markersGroup);
      sceneRef.current = scene;
      markersGroupRef.current = markersGroup;
      // Dev hook: expose scene + groups so headless screenshot tools can
      // render an empty top-down court (markers/zones hidden) for report use.
      // Also expose THREE so the headless tool can inject custom geometry
      // (e.g., player headshot decals on the court floor).
      if (typeof window !== "undefined") {
        window.__shotChartScene = scene;
        window.__shotChartMarkers = markersGroup;
        window.__shotChartCourt = courtGroup;
        window.__shotChartTHREE = THREE;
        window.__shotChartCamera = cameraRef.current;
        window.__shotChartCameraRef = cameraRef;
      }
      // Notify the marker-rebuild effect that the scene is wired up.
      // Without this it would have run once on mount with a null ref and
      // never re-fire when the async setup finally resolved.
      setSceneReady(true);
      cleanup.push(() => {
        // Dispose any leftover marker geometries / materials on unmount.
        markersGroup.traverse((o) => {
          if (o.geometry) o.geometry.dispose?.();
          if (o.material) {
            if (o.material.map) o.material.map.dispose?.();
            o.material.dispose?.();
          }
        });
        scene.remove(markersGroup);
        sceneRef.current = null;
        markersGroupRef.current = null;
        setSceneReady(false);
      });

      // Load the pro hoop STL asynchronously. Fall back to a procedural hoop
      // if the STL download fails.
      loadProHoop(ouLogoImg)
        .then((hoopGroup) => {
          courtGroup.add(hoopGroup);
        })
        .catch((err) => {
          console.error("[hoop] loadProHoop failed", err);
          courtGroup.add(buildHoopAssembly());
        });

      // --- Controls ---
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      // Tilt is allowed but clamped between Top-Down (polar≈0, looking
      // straight down) and Default (polar≈31°). Anything past Default
      // would expose the empty arena floor / corner crops; anything past
      // Top-Down would invert the camera.
      controls.enableRotate = true;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = (58 * Math.PI) / 180;
      controls.minDistance = 80;
      controls.maxDistance = 220;
      // Lock azimuth to ±20° around the *default* azimuth (camera looking
      // from -Z toward the origin → azimuth ≈ -π). Beyond ±20° the rotated
      // court footprint projects past the canvas edges and the corners
      // start to crop. We compute the default azimuth from camera.position
      // so any future change to the baked default automatically updates
      // the clamp window — and so the limits straddle -π without
      // OrbitControls' wrap-around math snapping the camera to the wrong
      // hemisphere on first update().
      const _defAz = Math.atan2(
        camera.position.x - controls.target.x,
        camera.position.z - controls.target.z
      );
      const _azSwing = Math.PI / 9; // ±20°
      controls.minAzimuthAngle = _defAz - _azSwing;
      controls.maxAzimuthAngle = _defAz + _azSwing;
      controls.enablePan = false;
      controls.enableZoom = false; // re-enabled by camLimits sync if "zoom mode" turns on
      // autoRotateSpeed=12 → full 360° in ~5 seconds at 60 fps (three.js
      // default 2.0 = 30 s/orbit, so 12 = 5 s/orbit).
      controls.autoRotateSpeed = 12;
      controls.target.set(0, 0, 0);
      controls.update();
      controlsRef.current = controls;

      // --- Shot-marker hover tooltip ---
      // Mirrors the 2D chart's `.shot-marker-tooltip` look: clock • period
      // on one line, shooter name below. Raycaster walks markersGroup.children
      // (each mesh carries mesh.userData.shot).
      const tooltipEl = document.createElement("div");
      tooltipEl.style.cssText =
        // Attach to <body> via position:fixed so CSS zoom on ancestors
        // (html zoom on laptop, .clip-detail zoom, etc.) doesn't re-scale
        // the tooltip's coordinates. clientX/Y are in viewport pixels,
        // body has no inherited zoom, so the math lands exactly on the marker.
        "position:fixed;pointer-events:none;z-index:1000;transform:translate(-50%, calc(-100% - 12px));" +
        "background:rgba(5,5,6,0.82);color:#f5f5f2;padding:6px 10px;border-radius:8px;" +
        "font:600 11px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.06em;" +
        "text-align:center;min-width:120px;box-shadow:0 6px 16px rgba(0,0,0,0.55);" +
        "border:1px solid rgba(255,255,255,0.08);display:none;white-space:nowrap;";
      document.body.appendChild(tooltipEl);
      cleanup.push(() => {
        if (tooltipEl.parentNode) tooltipEl.parentNode.removeChild(tooltipEl);
      });

      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const projectedPos = new THREE.Vector3();
      const formatQuarter = (p) => {
        if (!p) return "";
        if (p <= 4) return `Q${p}`;
        return `OT${p - 4}`;
      };
      // Project a marker's 3D world position to viewport pixels.
      // Tooltip is fixed-positioned on <body>, so we want absolute
      // viewport coords (compatible with clientX/Y semantics).
      // CSS `zoom` on <html> re-scales fixed-positioned elements'
      // left/top values (a fixed:left=400 with html.zoom=0.85 paints
      // at 340 visual px). Divide by the inherited zoom so the
      // setting lands at the canvas-reported visual coords.
      const getInheritedZoom = () => {
        let z = 1;
        let el = document.documentElement;
        while (el) {
          const v = parseFloat(getComputedStyle(el).zoom || '1');
          if (Number.isFinite(v) && v > 0) z *= v;
          el = el.parentElement;
        }
        return z;
      };
      const projectToViewport = (markerWorldPos) => {
        const canvasRect = renderer.domElement.getBoundingClientRect();
        projectedPos.copy(markerWorldPos).project(camera);
        const visualX = canvasRect.left + (projectedPos.x * 0.5 + 0.5) * canvasRect.width;
        const visualY = canvasRect.top + (-projectedPos.y * 0.5 + 0.5) * canvasRect.height;
        const z = getInheritedZoom();
        return { x: visualX / z, y: visualY / z };
      };
      const renderTooltip = (shot, markerWorldPos) => {
        const { x: viewportX, y: viewportY } = projectToViewport(markerWorldPos);
        const parts = [];
        const clock = shot.clock || "";
        const quarter = formatQuarter(shot.period);
        const timeLine = [clock, quarter].filter(Boolean).join(" • ") || "—:—";
        parts.push(timeLine);
        const who =
          shot.athleteName ||
          shot.teamName ||
          (shot.isOpponent ? "Opponent" : "Unknown");
        parts.push(who.toUpperCase());
        const resultLine =
          shot.made === true
            ? "MADE"
            : shot.made === false
              ? "MISSED"
              : "";
        if (resultLine) {
          const pts = shot.attemptValue ? ` ${shot.attemptValue}PT` : "";
          parts.push(`${resultLine}${pts}`);
        }
        tooltipEl.innerHTML = parts
          .map((line, i) =>
            i === 1
              ? `<div style="font-weight:700;font-size:11.5px;letter-spacing:0.08em;margin-top:2px">${line}</div>`
              : `<div style="opacity:${i === 0 ? 0.82 : 0.7};font-size:10.5px;letter-spacing:0.10em;text-transform:uppercase">${line}</div>`,
          )
          .join("");
        // Tooltip is position:fixed on body, so left/top take viewport
        // coords directly. translate(-50%, calc(-100% - 12px)) in CSS
        // shifts it above + centered on the marker.
        tooltipEl.style.left = `${viewportX}px`;
        tooltipEl.style.top = `${viewportY}px`;
        tooltipEl.style.display = "block";
      };
      const hideTooltip = () => {
        tooltipEl.style.display = "none";
      };

      const onHoverMove = (e) => {
        if (!markersGroupRef.current) return;
        // Skip tooltip raycast when markers are hidden (zone heatmap mode).
        if (markersGroupRef.current.visible === false) {
          hideTooltip();
          renderer.domElement.style.cursor = "";
          return;
        }
        const rect = renderer.domElement.getBoundingClientRect();
        ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(
          markersGroupRef.current.children,
          false,
        );
        if (hits.length && hits[0].object.userData?.shot) {
          const markerWorldPos = new THREE.Vector3();
          hits[0].object.getWorldPosition(markerWorldPos);
          if (trimModeRef.current) {
            hideTooltip();
            renderer.domElement.style.cursor = "crosshair";
          } else {
            renderTooltip(hits[0].object.userData.shot, markerWorldPos);
            renderer.domElement.style.cursor = "pointer";
          }
        } else {
          hideTooltip();
          renderer.domElement.style.cursor = "";
        }
      };
      const onHoverLeave = () => {
        hideTooltip();
        renderer.domElement.style.cursor = "";
      };
      renderer.domElement.addEventListener("pointermove", onHoverMove);
      renderer.domElement.addEventListener("pointerleave", onHoverLeave);

      // Click handler for trim mode: raycast markers and fire the
      // parent's onMarkerTrim callback with the shot id. OrbitControls
      // sometimes treats short clicks as drags-of-length-0, so we filter
      // to true clicks (no pointer drift between down and up).
      let downX = 0, downY = 0, downT = 0;
      const onDown = (e) => { downX = e.clientX; downY = e.clientY; downT = performance.now(); };
      const onTrimClick = (e) => {
        if (!trimModeRef.current) return;
        const cb = onMarkerTrimRef.current;
        if (!cb) return;
        // Skip if this was a drag (pointer moved >5px or held >500ms).
        const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
        if (dist > 5) return;
        if (performance.now() - downT > 500) return;
        if (!markersGroupRef.current) return;
        const rect = renderer.domElement.getBoundingClientRect();
        ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(markersGroupRef.current.children, false);
        if (hits.length && hits[0].object.userData?.shot) {
          const shot = hits[0].object.userData.shot;
          if (shot.id) {
            e.preventDefault();
            e.stopPropagation();
            cb(String(shot.id));
            hideTooltip();
          }
        }
      };
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("click", onTrimClick);

      cleanup.push(() => {
        renderer.domElement.removeEventListener("pointermove", onHoverMove);
        renderer.domElement.removeEventListener("pointerleave", onHoverLeave);
        renderer.domElement.removeEventListener("pointerdown", onDown);
        renderer.domElement.removeEventListener("click", onTrimClick);
      });

      // (Draggable indicator pin removed — visual clutter on the court
      // during the load-in animation.)

      const resize = () => {
        const w = mount.clientWidth || window.innerWidth;
        const h = mount.clientHeight || window.innerHeight;
        if (w <= 0 || h <= 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      window.addEventListener("resize", resize);

      // Track wrapper size changes (chart-size sliders, parent layout
      // changes, container width animations) so the renderer re-fits.
      const ro = typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => resize())
        : null;
      if (ro) ro.observe(mount);
      cleanup.push(() => {
        window.removeEventListener("resize", resize);
        if (ro) ro.disconnect();
      });

      // Scratch vectors reused each frame for label projection.
      // Per-frame: project each zone-label centroid + its in-zone extent
      // to screen pixels, then size the invisible interactive overlay div
      // to match the label's bounding box.
      const _projC = new THREE.Vector3();
      const _projR = new THREE.Vector3();
      const _projU = new THREE.Vector3();
      const BLOCK_W_EM_OVERLAY = 6.0;
      const BLOCK_H_EM_OVERLAY = 2.55;
      const SAFETY_OVERLAY     = 0.85;

      const projectLabelOverlays = () => {
        if (viewModeRef.current !== "zones") return;
        const cg = courtGroupRef.current;
        if (!cg) return;
        const rect = renderer.domElement.getBoundingClientRect();
        const wCanvas = rect.width;
        const hCanvas = rect.height;
        const labels = zoneLabelsLatestRef.current;
        const exts   = zoneExtentsRef.current;
        for (const lbl of labels) {
          const div = labelDivsRef.current[lbl.id];
          if (!div) continue;
          const ext = exts.get(lbl.id);
          if (!ext) continue;
          const halfW = Math.min(ext.left, ext.right);
          const halfH = Math.min(ext.up, ext.down);
          _projC.set(lbl.wx, 0.4, lbl.wz);
          cg.localToWorld(_projC); _projC.project(camera);
          const cxs = (_projC.x + 1) * 0.5 * wCanvas;
          const cys = (-_projC.y + 1) * 0.5 * hCanvas;
          _projR.set(lbl.wx + halfW, 0.4, lbl.wz);
          cg.localToWorld(_projR); _projR.project(camera);
          const rxs = (_projR.x + 1) * 0.5 * wCanvas;
          _projU.set(lbl.wx, 0.4, lbl.wz + halfH);
          cg.localToWorld(_projU); _projU.project(camera);
          const uys = (-_projU.y + 1) * 0.5 * hCanvas;
          const halfPxX = Math.abs(rxs - cxs);
          const halfPxY = Math.abs(uys - cys);
          // Mirror the canvas-baked size logic: corners use auto-fit,
          // everyone else uses the uniform size, scaled by per-zone
          // multiplier. Then convert from canvas-px to screen-px using
          // the projected ratio for one canvas axis (X here).
          //   canvas_px / world_ft = PPF (texture units)
          //   screen_px / world_ft = halfPxX / halfW (projected ratio)
          // → screen_px / canvas_px = (halfPxX / halfW) / PPF
          const PPF_LOCAL = 80; // matches the heatmap canvas PPF
          const isCorner3O = lbl.id === 8 || lbl.id === 9;
          const UNIFORM_FS_O = 80; // matches UNIFORM_FS in heatmap effect
          let fsCanvas;
          if (isCorner3O) {
            const cw = (Math.min(ext.left, ext.right) * 2 * PPF_LOCAL) / BLOCK_W_EM_OVERLAY;
            const ch = (Math.min(ext.up, ext.down)   * 2 * PPF_LOCAL) / BLOCK_H_EM_OVERLAY;
            fsCanvas = Math.max(20, Math.min(60, Math.min(cw, ch) * SAFETY_OVERLAY * (lbl.scale ?? 1.0)));
          } else {
            // Truly uniform — no scale multiplier (matches heatmap math).
            fsCanvas = UNIFORM_FS_O;
          }
          // Convert canvas-px → screen-px for the overlay box, using the
          // projected ratio along the X axis (close enough for an overlay
          // hit-area; perfect symmetry isn't required).
          const halfWWorld = Math.max(0.01, Math.min(ext.left, ext.right));
          const screenPerCanvas = (halfPxX / halfWWorld) / PPF_LOCAL;
          const fs = fsCanvas * screenPerCanvas;
          const blockW = fs * BLOCK_W_EM_OVERLAY * 0.95;
          const blockH = fs * BLOCK_H_EM_OVERLAY * 1.05;
          const offscreen = _projC.z > 1 || _projC.z < -1;
          div.style.transform = `translate3d(${cxs - blockW/2}px, ${cys - blockH/2}px, 0)`;
          div.style.width  = `${blockW}px`;
          div.style.height = `${blockH}px`;
          div.style.opacity = offscreen ? "0" : "1";
        }
      };

      // Debounced active-preset emitter — runs at ~6Hz, not every frame.
      let _lastActivePreset = "__init__";
      let _lastPresetTick = 0;
      const detectActivePreset = (now) => {
        if (now - _lastPresetTick < 160) return; // ~6 Hz
        _lastPresetTick = now;
        const def = camDefaultRef.current ?? BASE_CAM_DEFAULT;
        const cx = camera.position.x;
        const cy = camera.position.y;
        const cz = camera.position.z;
        // Polar angle from +Y axis (0 = straight down / top-down).
        const polar = Math.atan2(Math.hypot(cx, cz), cy) * 180 / Math.PI;
        const defPolar = Math.atan2(Math.hypot(def.camX, def.camZ), def.camY) * 180 / Math.PI;
        let next = null;
        if (polar < 4) next = "topdown";
        else if (Math.abs(polar - defPolar) < 4) next = "default";
        if (next !== _lastActivePreset) {
          _lastActivePreset = next;
          if (typeof onActivePresetChange === "function") {
            onActivePresetChange(next);
          }
        }
      };

      const animate = () => {
        rafRef.current = window.requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
        projectLabelOverlays();
        detectActivePreset(performance.now());
      };
      animate();
      setLoading(false);

      cleanup.push(() => {
        window.removeEventListener("resize", resize);
        window.cancelAnimationFrame(rafRef.current);
        controls.dispose();
      });
    } catch (err) {
      console.error("[ShotChart3D] init failed:", err);
      setErrorMsg(err?.message || String(err));
      setLoading(false);
    } })();

    return () => {
      disposed = true;
      cleanup.forEach((fn) => fn());
    };
  }, []);

  // ─── Camera-tuning panel: backtick key toggles ────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) return;
      if (e.key === "`") setCamPanelOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ─── Sync camLimits → OrbitControls + camera live ─────────────────────
  // If a flyTo is in flight, skip the snap-to-target syncs (fov / target /
  // ctrl.update) — those would fight the interpolation and produce a
  // visible flicker the moment a preset button is pressed. The limits
  // (min/max dist, polar, etc.) are still safe to apply since they don't
  // change the rendered camera pose.
  useEffect(() => {
    const ctrl = controlsRef.current;
    const cam  = cameraRef.current;
    if (!ctrl || !cam) return;
    ctrl.minDistance   = camLimits.minDist;
    ctrl.maxDistance   = camLimits.maxDist;
    ctrl.maxPolarAngle = (camLimits.maxPolar * Math.PI) / 180;
    ctrl.enablePan     = camLimits.enablePan;
    ctrl.enableZoom    = !!camLimits.enableZoom;
    // Live court transform: scale (size on screen) + Y offset (lift up).
    const courtGroup = courtGroupRef.current;
    if (courtGroup) {
      courtGroup.scale.setScalar(camLimits.courtScale ?? 0.9);
      courtGroup.position.y = camLimits.courtY ?? 0;
    }
    const flying = !!flyToRafRef.current;
    if (!flying) {
      ctrl.target.set(0, 0, camLimits.targetZ);
      if (cam.fov !== camLimits.fov) {
        cam.fov = camLimits.fov;
        cam.updateProjectionMatrix();
      }
      ctrl.update();
    }
  }, [camLimits]);

  // ─── Live zoom: scale camera offset from target ───────────────────────
  // Independent of camX/Y/Z so dragging the zoom slider only changes the
  // camera distance, leaving the orbit angle and target alone.
  const lastZoomRef = useRef(1.0);
  useEffect(() => {
    const ctrl = controlsRef.current;
    const cam  = cameraRef.current;
    if (!ctrl || !cam) return;
    const prev = lastZoomRef.current || 1.0;
    const next = camLimits.zoom || 1.0;
    if (Math.abs(prev - next) < 1e-4) return;
    const ratio = next / prev;
    // offset = camera - target; scale offset by ratio.
    const ox = cam.position.x - ctrl.target.x;
    const oy = cam.position.y - ctrl.target.y;
    const oz = cam.position.z - ctrl.target.z;
    cam.position.set(
      ctrl.target.x + ox * ratio,
      ctrl.target.y + oy * ratio,
      ctrl.target.z + oz * ratio
    );
    ctrl.update();
    lastZoomRef.current = next;
  }, [camLimits.zoom]);

  // ─── Chart size: emit changes to parent via onChartResize ─────────────
  useEffect(() => {
    if (typeof onChartResize === "function") {
      onChartResize(chartSize);
    }
  }, [chartSize, onChartResize]);

  // ─── Apply-view: animate camera to current slider pose ───────────────
  // Same easing as the intro drone shot so "Apply view" + preset clicks
  // both feel cinematic instead of teleporting.
  useEffect(() => {
    if (applyViewNonce === 0) return;
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    ctrl.target.set(0, 0, camLimits.targetZ);
    const z = camLimits.zoom || 1.0;
    flyTo(
      { x: camLimits.camX * z, y: camLimits.camY * z, z: camLimits.camZ * z },
      camLimits.fov,
      2200
    );
    // Reset the zoom-delta baseline so the next zoom-slider tick measures
    // from this fresh position (otherwise it would double-apply the ratio).
    lastZoomRef.current = z;
  }, [applyViewNonce]);

  // ─── Reset View: parent's resetViewNonce → fly to Default preset ──────
  // Pulls from camDefaultRef so the user-saved default (via "Save as
  // Default" in the tuning panel) overrides the hardcoded baseline.
  useEffect(() => {
    if (resetViewNonce === 0) return;
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const d = camDefaultRef.current ?? BASE_CAM_DEFAULT;
    ctrl.target.set(0, 0, d.targetZ ?? 0);
    flyTo({ x: d.camX, y: d.camY, z: d.camZ }, d.fov, 1800);
    setCamLimits((prev) => ({ ...prev, ...d, zoom: 1.0 }));
    lastZoomRef.current = 1.0;
  }, [resetViewNonce]);

  // ─── Top-down View: parent's topDownViewNonce → fly to Top-down preset ─
  useEffect(() => {
    if (topDownViewNonce === 0) return;
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const td = { fov: 22, camX: 0, camY: 120, camZ: -0.01, targetZ: 0 };
    ctrl.target.set(0, 0, td.targetZ);
    flyTo({ x: td.camX, y: td.camY, z: td.camZ }, td.fov, 1800);
    setCamLimits((prev) => ({ ...prev, ...td, zoom: 1.0 }));
    lastZoomRef.current = 1.0;
  }, [topDownViewNonce]);

  // ─── Zoom controls: dolly the camera toward / away from its target ──
  // Each nonce bump dollys by ~12% (clamped to OrbitControls' min/max).
  useEffect(() => {
    if (zoomInNonce === 0) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    const dir = new THREE.Vector3().subVectors(cam.position, ctrl.target);
    const dist = dir.length();
    const next = Math.max(ctrl.minDistance, dist * 0.88);
    dir.setLength(next);
    const targetPos = new THREE.Vector3().addVectors(ctrl.target, dir);
    flyTo({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, cam.fov, 350);
  }, [zoomInNonce]);

  useEffect(() => {
    if (zoomOutNonce === 0) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    // Default distance = magnitude of the default camera vector from target
    // (computed from BASE_CAM_DEFAULT or the user-saved override). Zoom-out
    // is hard-capped at this distance so the user can never pull the chart
    // smaller than the page's intended framing.
    const d = camDefaultRef.current ?? BASE_CAM_DEFAULT;
    const defaultDist = Math.sqrt(
      (d.camX || 0) * (d.camX || 0) +
      (d.camY || 0) * (d.camY || 0) +
      ((d.camZ || 0) - (d.targetZ || 0)) * ((d.camZ || 0) - (d.targetZ || 0))
    );
    const dir = new THREE.Vector3().subVectors(cam.position, ctrl.target);
    const dist = dir.length();
    if (dist >= defaultDist - 0.5) return; // already at or beyond default
    const next = Math.min(defaultDist, dist * 1.14);
    dir.setLength(next);
    const targetPos = new THREE.Vector3().addVectors(ctrl.target, dir);
    flyTo({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, cam.fov, 350);
  }, [zoomOutNonce]);

  // ─── courtPanelCards prop changed → repaint canvas without scene rebuild
  useEffect(() => {
    if (typeof repaintCardsRef.current === "function") {
      repaintCardsRef.current();
    }
  }, [courtPanelCards]);

  // ─── Parent bumped zoneResetNonce → clear stored layout + restore
  // default centroids so the user can start fresh.
  useEffect(() => {
    if (zoneResetNonce === 0) return;
    try { window.localStorage?.removeItem(ZONE_LABELS_STORAGE_KEY); } catch { /* ignore */ }
    setZoneLabels(
      ZONES.map((z) => {
        const isCorner3 = z.id === 8 || z.id === 9;
        return {
          id: z.id,
          wx: ZONE_CENTROIDS[z.id].wx,
          wz: ZONE_CENTROIDS[z.id].wz,
          scale: isCorner3 ? 1.8 : 1.0,
        };
      })
    );
  }, [zoneResetNonce]);

  // ─── Shot markers ─────────────────────────────────────────────────────
  // Rebuild whenever `shots` or designation filters change. Markers are
  // flat discs lying on the court floor, matching the 2D chart's color
  // logic: blue = primary scorer, green = secondary/shooter, black = role,
  // gray = neutral. Made = filled disc, missed = ring (transparent center).
  useEffect(() => {
    const group = markersGroupRef.current;
    if (!group) return undefined;

    // Clear previous markers.
    while (group.children.length) {
      const child = group.children.pop();
      if (child.geometry) child.geometry.dispose?.();
      if (child.material) {
        if (child.material.map) child.material.map.dispose?.();
        child.material.dispose?.();
      }
    }

    if (!shots || shots.length === 0) return undefined;

    const primary = primaryDesignationNames ?? new Set();
    const shooter = shooterDesignationNames ?? new Set();

    const PRIMARY_HEX = MARKER_PRIMARY_HEX;
    const SHOOTER_HEX = MARKER_SHOOTER_HEX;
    const ROLE_HEX = MARKER_ROLE_HEX;
    const NEUTRAL_HEX = "#6b7280";

    const normalize = (s) => (s || "").trim().toLowerCase();
    const roleColorFor = (shot) => {
      const name = normalize(shot.athleteName);
      if (primary.has(name)) return PRIMARY_HEX;
      if (shooter.has(name)) return SHOOTER_HEX;
      if (name) return ROLE_HEX;
      return NEUTRAL_HEX;
    };
    // Load-in priority: primary (blue) 0 → shooter (green) 1 → role (black)
    // 2 → neutral (gray) 3. The animation loop iterates markers in this
    // order so the chart paints itself primary→shooter→role→neutral.
    const priorityFor = (shot) => {
      const name = normalize(shot.athleteName);
      if (primary.has(name)) return 0;
      if (shooter.has(name)) return 1;
      if (name) return 2;
      return 3;
    };

    // Pre-build one CanvasTexture per (color, made) pair. Shots reuse
    // textures so we keep draw-call / memory overhead low on large sets.
    const textureCache = new Map();
    const makeTexture = (hex, filled) => {
      const key = `${hex}:${filled ? 1 : 0}`;
      if (textureCache.has(key)) return textureCache.get(key);
      const SIZE = 128;
      const cnv = document.createElement("canvas");
      cnv.width = SIZE;
      cnv.height = SIZE;
      const cx = cnv.getContext("2d");
      const cxC = SIZE / 2;
      const cyC = SIZE / 2;
      const rOuter = SIZE * 0.44;
      const rInner = SIZE * 0.30;
      cx.clearRect(0, 0, SIZE, SIZE);
      // White outer halo so the marker pops against wood + crimson.
      cx.beginPath();
      cx.arc(cxC, cyC, rOuter + 3, 0, Math.PI * 2);
      cx.fillStyle = "rgba(255,255,255,0.95)";
      cx.fill();
      // Colored ring.
      cx.beginPath();
      cx.arc(cxC, cyC, rOuter, 0, Math.PI * 2);
      cx.fillStyle = hex;
      cx.fill();
      // Transparent center for missed shots (so it reads as a ring).
      // For made shots, refill inner with the same color.
      if (filled) {
        // Keep solid — nothing to do.
      } else {
        cx.globalCompositeOperation = "destination-out";
        cx.beginPath();
        cx.arc(cxC, cyC, rInner, 0, Math.PI * 2);
        cx.fill();
        cx.globalCompositeOperation = "source-over";
      }
      const tex = new THREE.CanvasTexture(cnv);
      tex.anisotropy = 8;
      tex.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(key, tex);
      return tex;
    };

    // Shared geometry. 1.2 ft disc matches the visual weight of the 2D
    // chart's 16px marker on a 1300px (≈94 ft) court (≈1.15 ft each side).
    const DISC_FT = 1.2;
    const discGeo = new THREE.PlaneGeometry(DISC_FT, DISC_FT);
    group.userData.sharedGeo = discGeo;

    // Collapse every shot onto the hoop half. ESPN's coordinates are
    // already normalized to the offensive basket (x ∈ [0,50], y ∈ [0,35]);
    // clamp defensively so long heaves or bad coords can't render past the
    // half-court line. The 2D chart clamps y to the same range.
    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
    const COURT_X = 50;
    const COURT_Y = 35;

    // Stacking: multiple shots can land on the same court pixel (tip-ins,
    // put-backs). Mirror the 2D chart's hex-ring fan exactly.
    //
    // 2D uses STACK_RADIUS_PCT = 0.9 applied to both leftPercent (depth)
    // and bottomPercent (lateral). Because those axes span different
    // physical lengths (94 ft vs 50 ft), 0.9% corresponds to different
    // foot-offsets — the 2D fan is actually elliptical in world units.
    //   depth:   0.9% of 94 ft  ≈ 0.846 ft   (cos, on wz)
    //   lateral: 0.9% of 50 ft  ≈ 0.450 ft   (sin, on wx)
    //
    // Hotspots like the restricted area (25, 1) can have 60+ shots on one
    // bucket. The 2D chart lets the fan extend past 100% leftPercent — CSS
    // overflow hides the spillover — but in 3D those markers would escape
    // the court. Cap the ring at 3 so at most 18 ring-markers + 1 center
    // are spaced apart; further shots overlap inside ring 3 (same visual
    // behavior as a dense cluster in the 2D chart).
    const STACK_DEPTH_FT = 0.846;
    const STACK_LATERAL_FT = 0.45;
    const STACK_RING_MAX = 3;
    const stackCounts = new Map();

    // Court bounds clamp — keep disc centers a half-foot inside the painted
    // boundaries so markers never spill past the baseline/sideline/half-court.
    const DISC_INSET = 0.35;
    const MAX_WX = 25 - DISC_INSET;
    const MIN_WX = -25 + DISC_INSET;
    const MAX_WZ = BASELINE_Z - DISC_INSET;
    const MIN_WZ = -HALF_L + DISC_INSET;

    // Coord mapping — derived from the ESPN-SVG calibration overlay.
    // Composing the 2D formula with the calibrated SVG-to-world mapping
    // (see espn-court-light.svg; 10 SVG units = 1 ft; right half of the
    // 940x500 viewBox fits exactly onto the 50x47 ft 3D half-court):
    //   svg_x = 900 − 10·y   (from leftPercent = 95.75 − 1.064·y)
    //   svg_y = 500 − 10·x   (from bottomPercent = 2·x)
    //   wz    = svg_x/10 − 70.5 = 19.5 − y     (= BACKBOARD_Z − y)
    //   wx    = (250 − svg_y)/10 = x − 25
    // ESPN y=0 is the backboard plane — 4 ft in from the baseline — NOT
    // the hoop plane; this matches where the 2D chart draws y=0 shots.
    shots.forEach((shot) => {
      if (shot.x == null || shot.y == null) return;
      const sx = clamp(shot.x, 0, COURT_X);
      const sy = clamp(shot.y, 0, COURT_Y);
      let wx = 25 - sx;
      let wz = BACKBOARD_Z - sy;
      const bucket = `${wx.toFixed(2)}|${wz.toFixed(2)}`;
      const idx = stackCounts.get(bucket) ?? 0;
      stackCounts.set(bucket, idx + 1);
      if (idx > 0) {
        const angle = (idx * Math.PI) / 3;
        const ring = Math.min(Math.ceil(idx / 6), STACK_RING_MAX);
        // cos → depth (matches 2D's leftPercent offset)
        // sin → lateral (matches 2D's bottomPercent offset)
        wz += Math.cos(angle) * STACK_DEPTH_FT * ring;
        wx += Math.sin(angle) * STACK_LATERAL_FT * ring;
      }
      // Snap markers to the side of the painted 3-pt arc that matches
      // the play-by-play. ESPN coords drift sometimes — a 3-pt make can
      // come back with (x, y) that lands inside the arc, or a 2-pt
      // floater can spill just past it. attemptValue is sometimes
      // missing, so fall back to `points` and a regex over shotType /
      // description so PBP-classified 2/3-pointers still snap.
      let av = Number(shot.attemptValue);
      if (av !== 2 && av !== 3) {
        if (shot.points === 2 || shot.points === 3) {
          av = shot.points;
        } else {
          const desc = `${shot.shotType ?? ""} ${shot.description ?? ""}`.toLowerCase();
          if (/\b3[- ]?(point|pt|pointer)|three[- ]?(point|pointer)/.test(desc)) av = 3;
          else if (/\b2[- ]?(point|pt|pointer)|two[- ]?(point|pointer)|jumper|layup|lay-up|dunk|tip[- ]?in|put[- ]?back|hook/.test(desc)) av = 2;
        }
      }
      if (av === 2 || av === 3) {
        const dx = wx;
        const dz = wz - HOOP_Z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const ARC_PAD = 0.6;
        // Wing/top: above the corner-3 arc-meet line. Snap radially to
        // the arc on the appropriate side.
        if (wz < (CORNER3_ARC_Z - CORNER3_WZ_EXTENSION)) {
          if (av === 3 && dist < C.threeRadius + ARC_PAD * 0.3 && dist > 0) {
            const k = (C.threeRadius + ARC_PAD) / dist;
            wx = dx * k;
            wz = HOOP_Z + dz * k;
          } else if (av === 2 && dist > C.threeRadius - ARC_PAD * 0.3 && dist > 0) {
            const k = (C.threeRadius - ARC_PAD) / dist;
            wx = dx * k;
            wz = HOOP_Z + dz * k;
          }
        } else {
          // Corner region: the painted 3-pt boundary is the straight
          // line at |wx| = CORNER3_X (parallel to the sideline).
          if (av === 3 && Math.abs(wx) < CORNER3_X + ARC_PAD * 0.3) {
            wx = wx >= 0 ? CORNER3_X + ARC_PAD : -(CORNER3_X + ARC_PAD);
          } else if (av === 2 && Math.abs(wx) > CORNER3_X - ARC_PAD * 0.3) {
            wx = wx >= 0 ? CORNER3_X - ARC_PAD : -(CORNER3_X - ARC_PAD);
          }
        }
      }
      // Final safety clamp so a dense hotspot never spills past the court.
      if (wz > MAX_WZ) wz = MAX_WZ;
      else if (wz < MIN_WZ) wz = MIN_WZ;
      if (wx > MAX_WX) wx = MAX_WX;
      else if (wx < MIN_WX) wx = MIN_WX;
      const hex = roleColorFor(shot);
      const filled = shot.made === true;
      const tex = makeTexture(hex, filled);
      // PDFPage06 paints two on-court player cards (Beers, Verhulst) on the
      // half-court side; markers that land on a text row of one of those
      // cards get dimmed so the text stays readable. The 3D Shot Chart
      // tool does not draw those cards, so skip the fade entirely when
      // courtPanelCards is not supplied — full opacity for every marker.
      const NAME_X = [13.35, 20.1];           // name + badge x window
      const STAT_X = [-23.95, 23.95];          // stat table x window
      const TEXT_STRIPS = [
        // Beers card (upper, closer to rim)
        { xMin: NAME_X[0], xMax: NAME_X[1], zMin: -6.85,   zMax: -5.30 },   // name
        { xMin: NAME_X[0], xMax: NAME_X[1], zMin: -8.10,   zMax: -7.05 },   // badge
        { xMin: STAT_X[0], xMax: STAT_X[1], zMin: -10.45,  zMax: -9.85 },   // labels
        { xMin: STAT_X[0], xMax: STAT_X[1], zMin: -11.925, zMax: -11.175 },// GAME row
        { xMin: STAT_X[0], xMax: STAT_X[1], zMin: -13.175, zMax: -12.425 },// SEASON row
        // Verhulst card (lower, farther from rim)
        { xMin: NAME_X[0], xMax: NAME_X[1], zMin: -16.60,  zMax: -15.10 },  // name
        { xMin: NAME_X[0], xMax: NAME_X[1], zMin: -17.90,  zMax: -16.85 },  // badge
        { xMin: STAT_X[0], xMax: STAT_X[1], zMin: -20.25,  zMax: -19.65 },  // labels
        { xMin: STAT_X[0], xMax: STAT_X[1], zMin: -21.725, zMax: -20.975 },// GAME row
        { xMin: STAT_X[0], xMax: STAT_X[1], zMin: -22.975, zMax: -22.225 },// SEASON row
      ];
      const cardsActive = Array.isArray(courtPanelCards) && courtPanelCards.length > 0;
      let overlapsText = false;
      if (cardsActive) {
        for (const s of TEXT_STRIPS) {
          if (wx >= s.xMin && wx <= s.xMax && wz >= s.zMin && wz <= s.zMax) {
            overlapsText = true;
            break;
          }
        }
      }
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        opacity: overlapsText ? 0.12 : 1.0,
      });
      const mesh = new THREE.Mesh(discGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      // Lie just above every other floor overlay (lane paint 0.02).
      mesh.position.set(wx, 0.07, wz);
      mesh.renderOrder = 10;
      // Attach the source shot so the pointer raycaster can render a
      // hover tooltip identical to the 2D chart (time • period, shooter).
      mesh.userData.shot = shot;
      // Start invisible — the animation loop below scales each marker
      // in on a staggered schedule. Store priority so we can load by
      // primary → shooter → role → neutral.
      mesh.scale.set(0, 0, 0);
      mesh.userData.priority = priorityFor(shot);
      group.add(mesh);
    });

    // Track textures for cleanup on next rebuild.
    group.userData.textures = Array.from(textureCache.values());

    // ── Staggered pop-in + slow auto-rotate during load ───────────────
    // Each marker starts at scale 0 and springs to 1 (outBack ease) with
    // a small per-marker delay so the chart "paints itself on". The court
    // slowly rotates for the duration of the sequence, then snaps back.
    const meshes = group.children.slice();
    // Sort so primary (blue) loads first, then shooter (green), then role
    // (black), then neutral (gray). Stable sort preserves original order
    // within each priority band.
    meshes.sort((a, b) => (a.userData.priority ?? 9) - (b.userData.priority ?? 9));
    const N = meshes.length;
    const DURATION  = 340;
    // Spread the staggered pop-in so the LAST marker finishes at exactly
    // DRONE_INTRO_MS — i.e. when the drone-cam intro arrives at top-down.
    //   total = (N-1)*STAGGER + DURATION = DRONE_INTRO_MS
    //   STAGGER = (DRONE_INTRO_MS − DURATION) / max(N−1, 1)
    const STAGGER_MS = N > 1
      ? (DRONE_INTRO_MS - DURATION) / (N - 1)
      : 0;
    const startTime = performance.now();
    const ctrl      = controlsRef.current;
    if (ctrl) ctrl.autoRotate = false;

    // outBack: overshoots past 1 then settles.
    const outBack = (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    let animRaf = 0;
    const animateMarkers = () => {
      const now = performance.now();
      const elapsedTotal = now - startTime;

      // Markers-only pop-in (no camera rotation).
      let allDone = true;
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i];
        const delay = i * STAGGER_MS;
        const elapsed = elapsedTotal - delay;
        if (elapsed <= 0) {
          m.scale.set(0, 0, 0);
          allDone = false;
          continue;
        }
        if (elapsed >= DURATION) {
          m.scale.set(1, 1, 1);
          continue;
        }
        const t = elapsed / DURATION;
        const s = Math.max(0, outBack(t));
        m.scale.set(s, s, s);
        allDone = false;
      }
      if (!allDone) {
        animRaf = window.requestAnimationFrame(animateMarkers);
      }
    };
    animRaf = window.requestAnimationFrame(animateMarkers);

    return () => {
      window.cancelAnimationFrame(animRaf);
      if (ctrl) ctrl.autoRotate = false;
    };
  }, [shots, primaryDesignationNames, shooterDesignationNames, sceneReady]);

  // ─── Cinematic intro: drone shot from top-down → default ──────────────
  // On first scene-ready, smoothly drift the camera from the top-down
  // pose (where it was placed at scene init) down to the user's working
  // default pose. Uses the same flyTo helper as preset clicks so the
  // animation feel is identical everywhere.
  useEffect(() => {
    if (!sceneReady) return undefined;
    if (droneIntroDoneRef.current) return undefined;
    droneIntroDoneRef.current = true;
    flyTo(
      { x: camLimits.camX, y: camLimits.camY, z: camLimits.camZ },
      camLimits.fov,
      DRONE_INTRO_MS
    );
    return undefined;
  }, [sceneReady]);

  // ─── Zone overlay: thin black borders + editable text labels ─────────
  // No fill colors. The overlay just splits the court into zones with thin
  // black lines, and drops one user-editable text label per zone. Labels
  // come from the `zoneLabels` state (text / position / size) so the user
  // can tune them in the panel and then bake the resulting JSON.
  useEffect(() => {
    if (!sceneReady) return undefined;
    const courtGroup = courtGroupRef.current;
    const markersGroup = markersGroupRef.current;
    if (!courtGroup) return undefined;

    // Toggle marker visibility based on view mode.
    if (markersGroup) markersGroup.visible = viewMode !== "zones";

    // Tear down any prior overlay so we can rebuild cleanly.
    const prev = zoneOverlayRef.current;
    if (prev) {
      courtGroup.remove(prev);
      prev.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          if (o.material.map) o.material.map.dispose?.();
          o.material.dispose?.();
        }
      });
      zoneOverlayRef.current = null;
    }

    if (viewMode !== "zones") return undefined;

    // ── Borders + labels canvas. Higher PPF (80) gives the labels more
    // source pixels so they stay crisp after the camera downsamples to
    // ~15 screen-px/ft, and uniform sampling is consistent across the
    // canvas (no LOD drift between top and bottom).
    const PPF = 80;
    const W = Math.round(C.width * PPF);
    const H = Math.round(C.length * PPF);
    const cnv = document.createElement("canvas");
    cnv.width = W;
    cnv.height = H;
    const ctx = cnv.getContext("2d");

    const pxToWx = (px) => (px / W) * C.width - HALF_W;
    const pxToWz = (py) => HALF_L - (py / H) * C.length;

    ctx.fillStyle = "rgba(0, 0, 0, 0.92)";
    const STRIDE = 2;
    // Suppress drawing several internal borders so the chart reads
    // cleaner. Stats classification is unaffected; only the visual
    // border between these zone pairs is skipped:
    //   - 2-pt zone (1-7) ↔ 3-pt zone (8-12) — the 3-pt arc itself,
    //     already drawn as a white painted line on the wood floor.
    //   - Any pair of 3-pt zones (8-12) — corner/wing/top-key dividers
    //     (L-shapes on the wings, line behind the wing/top arc).
    //   - Midrange Center (6) ↔ Mid Left/Right (3, 4, 5, 7) — the
    //     vertical at |wx|=8 running from the FT elbow down to the arc.
    const isSuppressedTransition = (a, b) => {
      const isTwoPt   = (z) => z >= 1 && z <= 7;
      const isThreePt = (z) => z >= 8 && z <= 12;
      if ((isTwoPt(a) && isThreePt(b)) || (isTwoPt(b) && isThreePt(a))) return true;
      if (isThreePt(a) && isThreePt(b)) return true;
      const isMidLR = (z) => z === 3 || z === 4 || z === 5 || z === 7;
      if ((a === 6 && isMidLR(b)) || (b === 6 && isMidLR(a))) return true;
      return false;
    };
    for (let py = 0; py < H; py += STRIDE) {
      const wz  = pxToWz(py);
      const wzN = pxToWz(py + STRIDE);
      for (let px = 0; px < W; px += STRIDE) {
        const wx  = pxToWx(px);
        const wxN = pxToWx(px + STRIDE);
        const z   = classifyZoneId(wx, wz);
        if (px + STRIDE < W) {
          const zR = classifyZoneId(wxN, wz);
          if (zR !== z && !isSuppressedTransition(z, zR)) ctx.fillRect(px + STRIDE - 1, py, 3, STRIDE);
        }
        if (py + STRIDE < H) {
          const zD = classifyZoneId(wx, wzN);
          if (zD !== z && !isSuppressedTransition(z, zD)) ctx.fillRect(px, py + STRIDE - 1, STRIDE, 3);
        }
      }
    }

    // ── Engraved zone labels (flat on the floor, 2D, baked into canvas) ──
    // Each label is a 3-line block: PPS / FG% / attempts. Sized by zone
    // extent (auto-fit) with the user's `scale` as a multiplier. We scale
    // (-1, 1) at draw time to undo the camera mirror so text reads
    // normally on screen.
    const wxToPx = (wx) => ((wx + HALF_W) / C.width) * W;
    const wzToPy = (wz) => ((HALF_L - wz) / C.length) * H;
    const PPF_X = W / C.width;   // canvas pixels per world foot (X)
    const PPF_Y = H / C.length;  // canvas pixels per world foot (Z)
    const BLOCK_W_EM = 6.0;
    const BLOCK_H_EM = 2.55;
    const SAFETY     = 0.85;
    const wsTextSans = `ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", sans-serif`;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const lbl of zoneLabels) {
      const ext = zoneExtents.get(lbl.id);
      if (!ext) continue;
      const halfW = Math.min(ext.left, ext.right);
      const halfH = Math.min(ext.up, ext.down);
      const availW = halfW * 2 * PPF_X;
      const availH = halfH * 2 * PPF_Y;
      // Uniform size for all zones except the corner-3s. Non-corner zones
      // ignore the saved per-zone `scale` so they stay perfectly uniform
      // regardless of any earlier resize-handle adjustments. Only corners
      // can be individually resized (their narrow strip benefits from it).
      const isCorner3 = lbl.id === 8 || lbl.id === 9;
      // 1 ft of world height — keeps labels readable across PPF changes.
      const UNIFORM_FS = PPF;
      let fs;
      if (isCorner3) {
        fs = Math.min(availW / BLOCK_W_EM, availH / BLOCK_H_EM)
          * SAFETY * (lbl.scale ?? 1.0);
        fs = Math.max(20, Math.min(60, fs));
      } else {
        fs = UNIFORM_FS; // truly uniform — no scale multiplier
      }

      const s = zoneStats.get(lbl.id) || { att: 0, mk: 0, pts: 0 };
      const fgPct  = s.att > 0 ? (s.mk / s.att) * 100 : null;
      const pps    = s.att > 0 ?  s.pts / s.att      : null;
      const ppsStr = pps   == null ? "—" : pps.toFixed(2) + " PPS";
      const fgStr  = fgPct == null ? "—" : `${fgPct.toFixed(0)}% FG`;
      const attStr = `${s.att} att`;

      const cx = wxToPx(lbl.wx);
      const cy = wzToPy(lbl.wz);
      const lineH = fs * 1.10;
      // Zone 1 (At Rim) and zone 2 (Paint) sit on the lane painted with the
      // team's primary color. For dark-color teams (Iowa, ND, UConn, Duke,
      // Vanderbilt, etc.) the default dark ink is unreadable on the dark
      // lane. Flip to cream ink in that case so the FG% / PPS / att lines
      // stay legible across every team.
      const isOnLane = lbl.id === 1 || lbl.id === 2;
      const useLightInk = isOnLane && isHexDark(CRIMSON);
      // FG% is the dominant line; PPS + attempts are sub-stats below.
      const lines = useLightInk
        ? [
            { text: fgStr,  font: `800 ${fs}px ${wsTextSans}`,                  fill: "rgba(244,236,213,0.98)" },
            { text: ppsStr, font: `700 ${Math.round(fs * 0.78)}px ${wsTextSans}`, fill: "rgba(244,236,213,0.92)" },
            { text: attStr, font: `600 ${Math.round(fs * 0.65)}px ${wsTextSans}`, fill: "rgba(244,236,213,0.85)" },
          ]
        : [
            { text: fgStr,  font: `800 ${fs}px ${wsTextSans}`,                  fill: "rgba(15,18,24,0.94)" },
            { text: ppsStr, font: `700 ${Math.round(fs * 0.78)}px ${wsTextSans}`, fill: "rgba(28,32,40,0.90)" },
            { text: attStr, font: `600 ${Math.round(fs * 0.65)}px ${wsTextSans}`, fill: "rgba(50,56,66,0.82)" },
          ];

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(-1, 1); // un-mirror — camera looks from behind the basket
      const blockH = lineH * lines.length;
      let y = -blockH / 2 + lineH / 2;
      for (const ln of lines) {
        ctx.font = ln.font;
        ctx.fillStyle = ln.fill;
        ctx.fillText(ln.text, 0, y);
        y += lineH;
      }
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(cnv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    // Disable mipmaps + use Linear minFilter so all text gets sampled at
    // the same source resolution. Otherwise the trilinear mipmap LOD
    // varies with on-screen position and labels at different positions
    // can look slightly different sizes / sharpness.
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.flipY = false;

    const overlayMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    const overlayMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(C.width, C.length),
      overlayMat
    );
    overlayMesh.rotation.x = -Math.PI / 2;
    overlayMesh.position.y = 0.04; // above lane paint (0.006), below markers (0.07)
    overlayMesh.renderOrder = 8;
    overlayMesh.name = "zone-heatmap-overlay";
    courtGroup.add(overlayMesh);
    zoneOverlayRef.current = overlayMesh;

    return () => {
      if (markersGroupRef.current) markersGroupRef.current.visible = true;
      if (zoneOverlayRef.current && courtGroupRef.current) {
        courtGroupRef.current.remove(zoneOverlayRef.current);
        zoneOverlayRef.current.traverse((o) => {
          if (o.geometry) o.geometry.dispose?.();
          if (o.material) {
            if (o.material.map) o.material.map.dispose?.();
            o.material.dispose?.();
          }
        });
        zoneOverlayRef.current = null;
      }
    };
  }, [viewMode, sceneReady, zoneLabels, zoneStats, zoneExtents]);

  // ─── Zone-label drag (move) + resize ────────────────────────────────
  // Window-level pointer move/up so we capture every motion regardless of
  // pointer speed. The active zone id is stored in a ref to avoid stale
  // closures across re-renders.
  useEffect(() => {
    const onMove = (e) => {
      // RESIZE wins over move when both are armed (corner handle takes
      // pointerdown stopPropagation, but be defensive).
      const resizeId = resizingLabelIdRef.current;
      if (resizeId) {
        const div = labelDivsRef.current[resizeId];
        if (!div) return;
        const r = div.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top  + r.height / 2;
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
        const start = resizeStartRef.current;
        const ratio = dist / Math.max(1, start.distPx);
        const newScale = Math.max(0.4, Math.min(2.5, start.scale * ratio));
        setZoneLabels((prev) =>
          prev.map((l) => (l.id === resizeId ? { ...l, scale: newScale } : l))
        );
        return;
      }
      const moveId = draggingLabelIdRef.current;
      if (!moveId) return;
      const cam = cameraRef.current;
      const renderer = rendererRef.current;
      const cg = courtGroupRef.current;
      if (!cam || !renderer || !cg) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, cam);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
      cg.worldToLocal(hit);
      const cx = Math.max(-HALF_W + 1, Math.min(HALF_W - 1, hit.x));
      const cz = Math.max(-HALF_L + 1, Math.min(HALF_L - 1, hit.z));
      setZoneLabels((prev) =>
        prev.map((l) => (l.id === moveId ? { ...l, wx: cx, wz: cz } : l))
      );
    };
    const onUp = () => {
      if ((draggingLabelIdRef.current || resizingLabelIdRef.current)
          && controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      draggingLabelIdRef.current = null;
      resizingLabelIdRef.current = null;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  // Zone-label editing is allowed when the parent explicitly passes
  // zoneEditable=true. Otherwise the public/coach view stays read-only.
  const canEditZones = zoneEditable === true || !isPublicReadOnlyMode();

  const startLabelDrag = (id, e) => {
    if (!canEditZones) return;
    e.preventDefault();
    e.stopPropagation();
    draggingLabelIdRef.current = id;
    if (controlsRef.current) controlsRef.current.enabled = false;
    document.body.style.cursor = "grabbing";
  };
  const startLabelResize = (id, e) => {
    if (!canEditZones) return;
    e.preventDefault();
    e.stopPropagation();
    const div = labelDivsRef.current[id];
    if (!div) return;
    const r = div.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top  + r.height / 2;
    const distPx = Math.max(1, Math.hypot(e.clientX - cx, e.clientY - cy));
    const cur = (zoneLabels.find((l) => l.id === id) || {}).scale ?? 1.0;
    resizeStartRef.current = { scale: cur, distPx };
    resizingLabelIdRef.current = id;
    if (controlsRef.current) controlsRef.current.enabled = false;
    document.body.style.cursor = "nwse-resize";
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#04060b]">
      <div ref={mountRef} className="absolute inset-0" />

      {/* ── Interactive zone-label edit overlay (transparent boxes) ───
           Coaches on Render see the chart in read-only mode, so the
           overlay's pointer-events + cursor + hover styles are all
           neutralized. Local/admin use keeps the drag UI. */}
      {viewMode === "zones" && canEditZones && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 15 }}>
          {zoneLabels.map((lbl) => (
            <div
              key={lbl.id}
              ref={(el) => { labelDivsRef.current[lbl.id] = el; }}
              onPointerDown={(e) => startLabelDrag(lbl.id, e)}
              style={{
                position: "absolute",
                left: 0, top: 0,
                pointerEvents: "auto",
                cursor: "grab",
                // Visual: subtle outline only on hover. Default state is
                // invisible so the canvas-baked text reads cleanly.
                background: "transparent",
                border: "1.5px dashed rgba(255,255,255,0)",
                borderRadius: 4,
                boxSizing: "border-box",
                transition: "border-color 120ms ease, background 120ms ease",
                transform: "translate3d(-9999px, -9999px, 0)",
                willChange: "transform, width, height",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(220,38,38,0.55)";
                e.currentTarget.style.background = "rgba(220,38,38,0.06)";
                const handle = e.currentTarget.querySelector('[data-resize-handle]');
                if (handle) handle.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0)";
                e.currentTarget.style.background = "transparent";
                const handle = e.currentTarget.querySelector('[data-resize-handle]');
                if (handle) handle.style.opacity = "0";
              }}
              title={`${ZONES.find((z) => z.id === lbl.id)?.label} — drag to move, drag corner to resize`}
            >
              {/* Resize handle (corner zones only — others are uniform). */}
              {(lbl.id === 8 || lbl.id === 9) && (
                <div
                  data-resize-handle
                  onPointerDown={(e) => startLabelResize(lbl.id, e)}
                  style={{
                    position: "absolute",
                    right: -6, bottom: -6,
                    width: 14, height: 14,
                    background: "#b91c1c",
                    border: "2px solid #fff",
                    borderRadius: 3,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                    cursor: "nwse-resize",
                    pointerEvents: "auto",
                    opacity: 0,
                    transition: "opacity 120ms ease",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {loading && !errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
          <div className="text-[13px] uppercase tracking-[0.3em]">
            Loading court…
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center p-10 text-center">
          <div className="max-w-lg rounded-xl border border-red-500/40 bg-red-50 p-5 text-red-900">
            <div className="text-[11px] uppercase tracking-[0.3em] text-red-600">
              Court init failed
            </div>
            <div className="mt-2 font-mono text-[12px] break-words">
              {errorMsg}
            </div>
            <div className="mt-3 text-[11px] text-red-600/70">
              Check the browser devtools console for the full stack.
            </div>
          </div>
        </div>
      )}

      {/* ── Live camera-tuning panel (` key to toggle) ───────────────── */}
      {/* Camera-tuning toggle button removed per request — the panel
          itself is still reachable for power-users via the backtick (`)
          keyboard shortcut so the "Save as Default" affordance isn't lost. */}

      {camPanelOpen && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 30,
          background: "#1a1a1a", color: "#e5e7eb",
          border: "1px solid #2a2a2a", borderRadius: 8,
          padding: "12px 14px", width: 280, maxHeight: "85%", overflowY: "auto",
          font: "12px/1.55 ui-monospace, Menlo, monospace",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 11, letterSpacing: "0.1em", color: "#9aa1ab" }}>
            CAMERA TUNING  (` to close)
          </div>

          {/* ── Save / Reset baked default ───────────────────── */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => {
                const cam = cameraRef.current;
                const ctrl = controlsRef.current;
                const snapshot = {
                  ...camLimits,
                  camX: cam ? +cam.position.x.toFixed(2) : camLimits.camX,
                  camY: cam ? +cam.position.y.toFixed(2) : camLimits.camY,
                  camZ: cam ? +cam.position.z.toFixed(2) : camLimits.camZ,
                  fov:  cam ? +cam.fov.toFixed(2)        : camLimits.fov,
                  targetZ: ctrl ? +ctrl.target.z.toFixed(2) : camLimits.targetZ,
                  zoom: 1.0,
                };
                camDefaultRef.current = snapshot;
                try {
                  window.localStorage.setItem(
                    CAM_DEFAULT_STORAGE_KEY,
                    JSON.stringify(snapshot)
                  );
                } catch {}
              }}
              style={{
                flex: 1,
                background: "#7f1d1d",
                color: "#fef2f2",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 5,
                padding: "5px 8px",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Save as Default
            </button>
            <button
              type="button"
              onClick={() => {
                camDefaultRef.current = { ...BASE_CAM_DEFAULT };
                try {
                  window.localStorage.removeItem(CAM_DEFAULT_STORAGE_KEY);
                } catch {}
                setCamLimits((prev) => ({ ...prev, ...BASE_CAM_DEFAULT }));
              }}
              style={{
                flex: 1,
                background: "transparent",
                color: "#cbd5e1",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 5,
                padding: "5px 8px",
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>

          {/* ── Live zoom (independent slider) ─────────────────── */}
          <div style={{ marginTop: 8, marginBottom: 4, fontSize: 10.5, letterSpacing: "0.1em", color: "#64748b" }}>
            ZOOM
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Zoom</span>
              <span style={{ color: "#60a5fa" }}>{camLimits.zoom.toFixed(2)}×</span>
            </div>
            <input type="range" min={0.4} max={1.8} step={0.01}
              value={camLimits.zoom}
              onChange={(e) => setCamLimits((prev) => ({ ...prev, zoom: parseFloat(e.target.value) }))}
              style={{ width: "100%", accentColor: "#b91c1c" }}
            />
            <div style={{ fontSize: 10, color: "#64748b" }}>
              &lt;1 pulls in, &gt;1 pushes out. Independent of camX/Y/Z.
            </div>
          </div>

          {/* ── Court geometry transform ──────────────────────── */}
          <div style={{ marginTop: 10, marginBottom: 4, fontSize: 10.5, letterSpacing: "0.1em", color: "#64748b" }}>
            COURT MODEL
          </div>
          {[
            { key: "courtScale", label: "Court size",  min: 0.3, max: 1.5, step: 0.01 },
            { key: "courtY",     label: "Court Y up",  min: -5,  max: 30,  step: 0.25 },
          ].map(({ key, label, min, max, step }) => (
            <div key={key} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{label}</span>
                <span style={{ color: "#60a5fa" }}>
                  {(camLimits[key] ?? 0).toFixed(2)}{key === "courtScale" ? "×" : " ft"}
                </span>
              </div>
              <input type="range" min={min} max={max} step={step}
                value={camLimits[key] ?? 0}
                onChange={(e) => setCamLimits((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                style={{ width: "100%", accentColor: "#b91c1c" }}
              />
            </div>
          ))}
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>
            Bigger size shrinks rotation margin — keep ≤ 1.0 to never crop.
          </div>

          {/* ── Chart wrapper size (drives the parent layout) ─── */}
          <div style={{ marginTop: 10, marginBottom: 4, fontSize: 10.5, letterSpacing: "0.1em", color: "#64748b" }}>
            CHART SIZE
          </div>
          {[
            { key: "width",  label: "Width  px", min: 600, max: 1800, step: 10 },
            { key: "height", label: "Height px", min: 400, max: 1400, step: 10 },
          ].map(({ key, label, min, max, step }) => (
            <div key={key} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{label}</span>
                <span style={{ color: "#60a5fa" }}>{chartSize[key]}</span>
              </div>
              <input type="range" min={min} max={max} step={step}
                value={chartSize[key]}
                onChange={(e) => setChartSize((prev) => ({ ...prev, [key]: parseInt(e.target.value, 10) }))}
                style={{ width: "100%", accentColor: "#b91c1c" }}
              />
            </div>
          ))}

          {/* ── Default view (initial camera pose) ─────────────── */}
          <div style={{ marginTop: 10, marginBottom: 4, fontSize: 10.5, letterSpacing: "0.1em", color: "#64748b" }}>
            DEFAULT VIEW
          </div>
          {[
            { key: "fov",   label: "FOV °", min: 10,   max: 90,  step: 1 },
            { key: "camX",  label: "Cam X", min: -120, max: 120, step: 0.5 },
            { key: "camY",  label: "Cam Y", min: 1,    max: 150, step: 0.5 },
            { key: "camZ",  label: "Cam Z", min: -120, max: 120, step: 0.5 },
          ].map(({ key, label, min, max, step }) => (
            <div key={key} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{label}</span>
                <span style={{ color: "#60a5fa" }}>{camLimits[key]}</span>
              </div>
              <input type="range" min={min} max={max} step={step}
                value={camLimits[key]}
                onChange={(e) => setCamLimits((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                style={{ width: "100%", accentColor: "#b91c1c" }}
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
            <button
              onClick={() => setApplyViewNonce((n) => n + 1)}
              style={{
                flex: 1, background: "#7f1d1d", color: "#fff",
                border: "none", borderRadius: 4, padding: "5px 8px",
                fontSize: 11, cursor: "pointer", fontWeight: 600,
              }}
            >
              Apply view
            </button>
            <button
              onClick={() => {
                const cam = cameraRef.current;
                const ctrl = controlsRef.current;
                if (!cam || !ctrl) return;
                setCamLimits((prev) => ({
                  ...prev,
                  fov:     Math.round(cam.fov),
                  camX:    +cam.position.x.toFixed(2),
                  camY:    +cam.position.y.toFixed(2),
                  camZ:    +cam.position.z.toFixed(2),
                  targetZ: +ctrl.target.z.toFixed(2),
                }));
              }}
              style={{
                flex: 1, background: "rgba(255,255,255,0.08)", color: "#e5e7eb",
                border: "1px solid rgba(255,255,255,0.18)", borderRadius: 4,
                padding: "5px 8px", fontSize: 11, cursor: "pointer",
              }}
            >
              Read current
            </button>
          </div>

          {/* ── Orbit limits ─────────────────────────────── */}
          <div style={{ marginTop: 12, marginBottom: 4, fontSize: 10.5, letterSpacing: "0.1em", color: "#64748b" }}>
            ORBIT LIMITS
          </div>
          {[
            { key: "minDist",  label: "Min zoom",    min: 10,  max: 80,  step: 1 },
            { key: "maxDist",  label: "Max zoom",    min: 30,  max: 200, step: 1 },
            { key: "maxPolar", label: "Max tilt °",  min: 10,  max: 90,  step: 1 },
            { key: "targetZ",  label: "Pivot depth", min: -24, max: 24,  step: 0.5 },
          ].map(({ key, label, min, max, step }) => (
            <div key={key} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{label}</span>
                <span style={{ color: "#60a5fa" }}>{camLimits[key]}</span>
              </div>
              <input type="range" min={min} max={max} step={step}
                value={camLimits[key]}
                onChange={(e) => setCamLimits((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                style={{ width: "100%", accentColor: "#b91c1c" }}
              />
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
            <input type="checkbox" id="cam-pan" checked={camLimits.enablePan}
              onChange={(e) => setCamLimits((prev) => ({ ...prev, enablePan: e.target.checked }))}
            />
            <label htmlFor="cam-pan" style={{ cursor: "pointer" }}>Enable pan</label>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <input type="checkbox" id="cam-zoom" checked={camLimits.enableZoom}
              onChange={(e) => setCamLimits((prev) => ({ ...prev, enableZoom: e.target.checked }))}
            />
            <label htmlFor="cam-zoom" style={{ cursor: "pointer" }}>
              Zoom mode <span style={{ color: "#64748b" }}>(scroll to zoom)</span>
            </label>
          </div>
          <div style={{ marginTop: 6, fontSize: 10.5, color: "#64748b" }}>
            Tip: turn on zoom mode, scroll to dial in the perfect distance, then
            click <em>Read current</em> + hardcode the camY/camZ values.
          </div>

          {/* ── Zone label editor (only useful in viewMode=zones) ── */}
          {viewMode === "zones" && (
            <>
              <div style={{ marginTop: 12, marginBottom: 4, fontSize: 10.5, letterSpacing: "0.1em", color: "#64748b" }}>
                ZONE LABELS
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>
                Labels auto-fit each zone's available area. <strong>Drag</strong>{" "}
                to move, <strong>scroll</strong> to scale (0.5×–1.5× of auto-fit).
              </div>
              {zoneLabels.map((lbl, idx) => {
                const zone = ZONES.find((z) => z.id === lbl.id);
                return (
                  <div key={lbl.id} style={{ marginBottom: 5, paddingBottom: 5, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3 }}>
                      <span style={{ width: 18, color: "#94a3b8", fontSize: 10 }}>#{lbl.id}</span>
                      <span style={{ flex: 1, color: "#cbd5e1", fontSize: 10.5 }}>
                        {zone?.label}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[
                        { key: "wx",    label: "X",     step: 0.5,  w: 56 },
                        { key: "wz",    label: "Y",     step: 0.5,  w: 56 },
                        { key: "scale", label: "scale", step: 0.05, w: 50 },
                      ].map(({ key, label, step, w }) => (
                        <label key={key} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#94a3b8" }}>
                          <span>{label}</span>
                          <input
                            type="number"
                            value={Number.isFinite(lbl[key]) ? +lbl[key].toFixed(2) : 0}
                            step={step}
                            onChange={(e) => setZoneLabels((prev) => prev.map((l, i) => i === idx ? { ...l, [key]: parseFloat(e.target.value) || 0 } : l))}
                            style={{
                              width: w, background: "rgba(255,255,255,0.05)", color: "#60a5fa",
                              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3,
                              padding: "2px 4px", fontSize: 11,
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => {
                  const json = JSON.stringify(zoneLabels, null, 2);
                  navigator.clipboard?.writeText?.(json).catch(() => {});
                  // eslint-disable-next-line no-console
                  console.log("ZONE_LABELS:", json);
                }}
                style={{
                  width: "100%", marginTop: 4, marginBottom: 6,
                  background: "#16a34a", color: "#fff", border: "none",
                  borderRadius: 4, padding: "6px 8px", fontSize: 11,
                  cursor: "pointer", fontWeight: 600,
                }}
              >
                Copy zone labels JSON
              </button>
            </>
          )}

          {/* ── Hardcode readout ─────────────────────────── */}
          <div style={{ marginTop: 12, padding: "8px", background: "rgba(163,230,53,0.06)", border: "1px solid rgba(163,230,53,0.2)", borderRadius: 4, fontSize: 10.5 }}>
            <div style={{ color: "#64748b", marginBottom: 4, letterSpacing: "0.08em" }}>HARDCODE:</div>
            <div style={{ color: "#a3e635" }}>
              fov={camLimits.fov}<br/>
              camera.position.set({(camLimits.camX * camLimits.zoom).toFixed(2)}, {(camLimits.camY * camLimits.zoom).toFixed(2)}, {(camLimits.camZ * camLimits.zoom).toFixed(2)})<br/>
              target.set(0, 0, {camLimits.targetZ})<br/>
              minDist={camLimits.minDist} maxDist={camLimits.maxDist}<br/>
              maxPolar={camLimits.maxPolar}° pan={String(camLimits.enablePan)}<br/>
              courtScale={(camLimits.courtScale ?? 0.9).toFixed(2)} courtY={(camLimits.courtY ?? 0).toFixed(2)}<br/>
              chartSize: {chartSize.width} × {chartSize.height}
            </div>
            {viewMode === "zones" && (
              <pre style={{
                marginTop: 6, padding: 6, fontSize: 10, lineHeight: 1.35,
                color: "#a3e635", background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3,
                maxHeight: 180, overflow: "auto", whiteSpace: "pre",
              }}>{JSON.stringify(zoneLabels, null, 2)}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
