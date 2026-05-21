// Interactive 3D shot chart for the portfolio.
// Renders Oklahoma vs Oklahoma State (2025-12-13) shots on a half-court.
// Coords:
//   ESPN x ∈ [0, 50] → world x = espn_x − 25 (centers court on x=0)
//   ESPN y ∈ [0, 35] → world z = espn_y (baseline at z=0, half-court at z=35)
// Camera orbits around the lane.

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const COURT_WIDTH = 50
const COURT_DEPTH = 35
const LANE_WIDTH = 16
const LANE_LENGTH = 19
const ARC_RADIUS = 22.15
const HOOP_Z = 4.75
const HOOP_HEIGHT = 10
const COURT_FLOOR_Y = 0
const LINE_Y = 0.03

const COLOR_FLOOR = 0xb8884a
const COLOR_FLOOR_DARK = 0x6a4a26
const COLOR_LINE = 0xfafaf6
const COLOR_LANE_FILL = 0x6b1018
const COLOR_BG = 0x18171a
const COLOR_OU_MADE = 0x6b1018
const COLOR_OU_MISS = 0xf3c3c8
const COLOR_OPP_MADE = 0x18171a
const COLOR_OPP_MISS = 0x8a8a86

function makeLineLoop(points2d, color = COLOR_LINE, y = LINE_Y) {
  const pts = points2d.map(([x, z]) => new THREE.Vector3(x, y, z))
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color }))
}

function makeArc(centerX, centerZ, radius, startAngle, endAngle, segments = 96, color = COLOR_LINE, y = LINE_Y) {
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const t = startAngle + (endAngle - startAngle) * (i / segments)
    pts.push(new THREE.Vector3(centerX + radius * Math.cos(t), y, centerZ + radius * Math.sin(t)))
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color }))
}

function buildCourt(scene) {
  // Wood floor (two-tone subtle gradient via two planes)
  const floorGeo = new THREE.PlaneGeometry(COURT_WIDTH + 4, COURT_DEPTH + 6)
  const floorMat = new THREE.MeshStandardMaterial({ color: COLOR_FLOOR, roughness: 0.85, metalness: 0.0 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, COURT_FLOOR_Y, COURT_DEPTH / 2)
  scene.add(floor)

  // Lane fill (burgundy)
  const laneGeo = new THREE.PlaneGeometry(LANE_WIDTH, LANE_LENGTH)
  const laneMat = new THREE.MeshStandardMaterial({ color: COLOR_LANE_FILL, roughness: 0.7 })
  const lane = new THREE.Mesh(laneGeo, laneMat)
  lane.rotation.x = -Math.PI / 2
  lane.position.set(0, COURT_FLOOR_Y + 0.01, LANE_LENGTH / 2)
  scene.add(lane)

  // Court boundary (half court rectangle)
  scene.add(makeLineLoop([
    [-COURT_WIDTH / 2, 0],
    [COURT_WIDTH / 2, 0],
    [COURT_WIDTH / 2, COURT_DEPTH],
    [-COURT_WIDTH / 2, COURT_DEPTH],
    [-COURT_WIDTH / 2, 0],
  ]))

  // Half-court line
  const halfCt = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-COURT_WIDTH / 2, LINE_Y, COURT_DEPTH),
    new THREE.Vector3(COURT_WIDTH / 2, LINE_Y, COURT_DEPTH),
  ])
  scene.add(new THREE.Line(halfCt, new THREE.LineBasicMaterial({ color: COLOR_LINE })))

  // Lane outline
  scene.add(makeLineLoop([
    [-LANE_WIDTH / 2, 0],
    [LANE_WIDTH / 2, 0],
    [LANE_WIDTH / 2, LANE_LENGTH],
    [-LANE_WIDTH / 2, LANE_LENGTH],
    [-LANE_WIDTH / 2, 0],
  ]))

  // Free throw circle (full)
  scene.add(makeArc(0, LANE_LENGTH, 6, 0, Math.PI * 2))

  // 3-point arc + corner straight lines
  const cornerZ = 14
  const halfWidthAtCorner = Math.sqrt(ARC_RADIUS * ARC_RADIUS - (cornerZ - HOOP_Z) * (cornerZ - HOOP_Z))
  const cornerX = halfWidthAtCorner
  // Arc spans from (cornerX, cornerZ) over the top to (-cornerX, cornerZ)
  const startAngle = Math.atan2(cornerZ - HOOP_Z, cornerX)
  const endAngle = Math.PI - startAngle
  scene.add(makeArc(0, HOOP_Z, ARC_RADIUS, startAngle, endAngle))
  // Corner straight segments from baseline to arc point
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(cornerX, LINE_Y, 0),
      new THREE.Vector3(cornerX, LINE_Y, cornerZ),
    ]),
    new THREE.LineBasicMaterial({ color: COLOR_LINE })
  ))
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-cornerX, LINE_Y, 0),
      new THREE.Vector3(-cornerX, LINE_Y, cornerZ),
    ]),
    new THREE.LineBasicMaterial({ color: COLOR_LINE })
  ))

  // Center circle at half-court (decorative half visible)
  scene.add(makeArc(0, COURT_DEPTH, 6, Math.PI, Math.PI * 2))

  // Restricted area arc (4 ft from hoop)
  scene.add(makeArc(0, HOOP_Z, 4, 0, Math.PI))

  // Backboard
  const bbGeo = new THREE.BoxGeometry(6, 3.5, 0.12)
  const bbMat = new THREE.MeshStandardMaterial({ color: 0xfafaf6, transparent: true, opacity: 0.4, roughness: 0.2 })
  const backboard = new THREE.Mesh(bbGeo, bbMat)
  backboard.position.set(0, HOOP_HEIGHT + 0.5, HOOP_Z - 1.25)
  scene.add(backboard)

  // Rim
  const rimGeo = new THREE.TorusGeometry(0.75, 0.06, 10, 48)
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xff5520, roughness: 0.4, metalness: 0.5 })
  const rim = new THREE.Mesh(rimGeo, rimMat)
  rim.rotation.x = Math.PI / 2
  rim.position.set(0, HOOP_HEIGHT, HOOP_Z)
  scene.add(rim)

  // Net (a few hanging lines, decorative)
  const netMat = new THREE.LineBasicMaterial({ color: 0xfafaf6, transparent: true, opacity: 0.6 })
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const x0 = Math.cos(a) * 0.75
    const z0 = Math.sin(a) * 0.75
    const pts = [
      new THREE.Vector3(x0, HOOP_HEIGHT, HOOP_Z + z0),
      new THREE.Vector3(x0 * 0.4, HOOP_HEIGHT - 1.4, HOOP_Z + z0 * 0.4),
    ]
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), netMat))
  }
}

function buildShots(scene, shots) {
  const group = new THREE.Group()
  scene.add(group)
  const sphereGeo = new THREE.SphereGeometry(0.55, 18, 18)
  const ringGeo = new THREE.RingGeometry(0.5, 0.7, 24)

  for (const s of shots) {
    const wx = s.x - 25
    const wz = s.y
    let color
    if (s.isOpp) color = s.made ? COLOR_OPP_MADE : COLOR_OPP_MISS
    else color = s.made ? COLOR_OU_MADE : COLOR_OU_MISS

    if (s.made) {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.15 })
      const mesh = new THREE.Mesh(sphereGeo, mat)
      mesh.position.set(wx, 0.55, wz)
      mesh.userData = s
      group.add(mesh)
    } else {
      // Missed shots: a ring on the floor, easier to scan made vs miss
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      const ring = new THREE.Mesh(ringGeo, mat)
      ring.rotation.x = -Math.PI / 2
      ring.position.set(wx, LINE_Y + 0.04, wz)
      ring.userData = s
      group.add(ring)
    }
  }
  return group
}

async function init(mountEl, dataUrl) {
  const mount = mountEl
  const W = mount.clientWidth || 688
  const H = mount.clientHeight || 430

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLOR_BG)

  const camera = new THREE.PerspectiveCamera(38, W / H, 0.5, 500)
  camera.position.set(0, 32, -22)
  camera.lookAt(0, 0, 12)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(W, H, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  mount.appendChild(renderer.domElement)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.55))
  const key = new THREE.DirectionalLight(0xffffff, 0.75)
  key.position.set(15, 35, -10)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xffe9c4, 0.25)
  fill.position.set(-20, 18, 30)
  scene.add(fill)

  buildCourt(scene)

  const data = await fetch(dataUrl).then((r) => r.json())
  buildShots(scene, data.shots)

  // Caption update with game info if a meta element exists
  const meta = document.getElementById('cv-shot-chart-meta')
  if (meta && data) {
    const date = (data.date || '').slice(0, 10)
    meta.textContent = `Oklahoma vs ${data.opponent} · ${date} · ${data.result} · ${data.shots.length} shots`
  }

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 12)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 18
  controls.maxDistance = 90
  controls.maxPolarAngle = Math.PI / 2.05
  controls.minPolarAngle = 0.05
  controls.update()

  function loop() {
    controls.update()
    renderer.render(scene, camera)
    requestAnimationFrame(loop)
  }
  loop()

  // Handle resize
  function onResize() {
    const w = mount.clientWidth
    const h = mount.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  new ResizeObserver(onResize).observe(mount)
}

const mount = document.getElementById('cv-shot-chart')
if (mount) {
  init(mount, '/data/okstate-shots.json').catch((err) => {
    console.error('Shot chart failed:', err)
    mount.innerHTML = '<div style="color:#fafaf6;padding:20px;text-align:center;font-size:11px">Shot chart failed to load. ' + err.message + '</div>'
  })
}
