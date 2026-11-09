import { useFrame } from '@react-three/fiber'
import { Fog, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { sound } from '../audio/sound'
import { damp } from '../game/math'
import { cursorWorld, handleSessionEvents, pointerInput, sceneLink, syncStore, world } from '../game/session'
import { gameStore } from '../game/store'
import type { GameEvent } from '../game/world'
import { Chamber } from './Chamber'
import { Effects } from './Effects'
import { playEffects, shake } from './effects'
import { Boss, Enemies, Orbs } from './Enemies'
import { HeartCrystal } from './HeartCrystal'
import { MagicCursor } from './MagicCursor'
import { AmbientMotes } from './Particles'
import { Pedestal } from './Pedestal'
import { Shards } from './Shards'

export function Experience() {
  return (
    <>
      <color attach="background" args={['#080716']} />
      <fog attach="fog" args={['#0c0a24', 10, 26]} />
      <CameraRig />
      <GameDriver />

      <hemisphereLight args={['#5a5096', '#07050f', 0.85]} />
      <directionalLight position={[-4, 9, 6]} intensity={0.7} color="#aebcff" />
      <directionalLight position={[2, 3, 10]} intensity={0.45} color="#d2c8ff" />
      <pointLight position={[0, 5, -7]} intensity={16} distance={22} color="#7a4dff" />

      <Chamber />
      <Pedestal />
      <HeartCrystal />
      <Shards />
      <Enemies />
      <Orbs />
      <Boss />
      <Effects />
      <MagicCursor />
      <AmbientMotes />
    </>
  )
}

// Scratch objects reused every frame (allocating new ones 60x/second creates garbage).
const plane = new Plane(new Vector3(0, 0, 1), 0) // the interaction plane z = 0
const raycaster = new Raycaster()
const ndcVector = new Vector2()
const hit = new Vector3()

/**
 * Runs first every frame (priority -1):
 *  1. take the cursor position in NDC (from mouse or hand),
 *  2. cast a ray from the camera through it and intersect the plane z = 0,
 *  3. advance the game world with that 2D point and the grip flag,
 *  4. hand the resulting events to effects, sound and the HUD.
 */
function GameDriver() {
  useFrame((state, delta) => {
    // Advance in small fixed steps: game speed stays real-time even at low frame
    // rates (down to 10 fps), and fast thrown shards can't skip past a shadow.
    const frameTime = Math.min(delta, 0.1) // a long pause (e.g. switching tabs) isn't replayed
    const steps = Math.max(1, Math.ceil(frameTime / (1 / 60) - 1e-6))
    const dt = frameTime / steps
    const playing = gameStore.get().screen === 'play'

    const toPlane = (ndc: { x: number; y: number } | null) => {
      if (!playing || !ndc) return null
      ndcVector.set(ndc.x, ndc.y)
      raycaster.setFromCamera(ndcVector, state.camera)
      return raycaster.ray.intersectPlane(plane, hit) ? { x: hit.x, y: hit.y } : null
    }

    const events: GameEvent[] = []
    if (playing) {
      // 1. Replay presses/releases that happened between frames (dt = 0: no movement).
      for (const edge of pointerInput.edges) events.push(...world.update({ pointer: toPlane(edge.ndc), grip: edge.grip }, 0))
    }
    pointerInput.edges.length = 0

    // 2. The regular per-frame update with the current cursor and grip.
    const pointer = toPlane(pointerInput.ndc)
    cursorWorld.visible = pointer !== null && !world.paused
    if (pointer) {
      cursorWorld.x = pointer.x
      cursorWorld.y = pointer.y
    }
    if (playing) {
      for (let i = 0; i < steps; i++) events.push(...world.update({ pointer, grip: pointerInput.grip }, dt))
    }

    if (events.length) {
      playEffects(events)
      sound.handle(events)
      handleSessionEvents(events)
    }
    syncStore()
  }, -1)

  return null
}

/**
 * Keeps the whole scene in view on any screen shape, performs the one
 * orchestrated camera move (title screen -> centred chamber) and applies
 * screen shake.
 */
const rig = { x: -1.8, y: 3, z: 10, lookX: -1.8 }

function CameraRig() {
  useFrame((state, delta) => {
    const camera = state.camera as PerspectiveCamera
    const pos = rig
    const dt = Math.min(delta, 0.05)
    const aspect = state.size.width / state.size.height
    const halfFov = (camera.fov * Math.PI) / 360
    // Distance needed so ±4.9 world units (the whole arena) fit horizontally.
    const dist = Math.max(9.4, 4.9 / (Math.tan(halfFov) * aspect))
    const title = gameStore.get().screen === 'title'
    const wide = aspect > 1.15
    const shift = title && wide ? -1.8 : 0
    const drift = title ? Math.sin(state.clock.elapsedTime * 0.25) * 0.25 : 0

    pos.x = damp(pos.x, shift + drift, 2.2, dt)
    pos.lookX = damp(pos.lookX, shift, 2.2, dt)
    pos.z = damp(pos.z, dist, 3, dt)
    pos.y = damp(pos.y, 1.9 + dist * 0.12, 3, dt)

    // Screen shake: a quick random jitter that decays.
    shake.amount = Math.max(0, shake.amount - dt * 2.2)
    const s = shake.amount * shake.amount * 0.25
    const jx = (Math.random() - 0.5) * s
    const jy = (Math.random() - 0.5) * s

    camera.position.set(pos.x + jx, pos.y + jy, pos.z)
    camera.lookAt(pos.lookX + jx * 0.5, 1.75 + jy * 0.5, 0)
    sceneLink.camera = camera
    if (state.scene.fog instanceof Fog) {
      state.scene.fog.near = pos.z + 1
      state.scene.fog.far = pos.z + 17
    }
  })
  return null
}
