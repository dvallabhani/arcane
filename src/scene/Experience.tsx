import { useFrame } from '@react-three/fiber'
import { Fog, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { InteractionEvent } from '../game/interaction'
import { damp } from '../game/math'
import { crystal, cursorWorld, pointerInput, sceneLink } from '../game/session'
import { gameStore } from '../game/store'
import { Chamber } from './Chamber'
import { Crystal } from './Crystal'
import { MagicCursor } from './MagicCursor'
import { AmbientMotes, CompletionBurst } from './Particles'
import { Pedestal } from './Pedestal'

export function Experience() {
  return (
    <>
      <color attach="background" args={['#080716']} />
      <fog attach="fog" args={['#0c0a24', 10, 26]} />
      <CameraRig />
      <InteractionDriver />

      <hemisphereLight args={['#5a5096', '#07050f', 0.85]} />
      <directionalLight position={[-4, 9, 6]} intensity={0.7} color="#aebcff" />
      <directionalLight position={[2, 3, 10]} intensity={0.45} color="#d2c8ff" />
      <pointLight position={[0, 5, -7]} intensity={16} distance={22} color="#7a4dff" />

      <Chamber />
      <Pedestal />
      <Crystal />
      <MagicCursor />
      <AmbientMotes />
      <CompletionBurst />
    </>
  )
}

/**
 * Runs first every frame (priority -1):
 *  1. take the cursor position in NDC (from mouse or hand),
 *  2. cast a ray from the camera through it,
 *  3. intersect that ray with the interaction plane z = 0,
 *  4. feed the resulting 2D point into the shared game logic.
 */
// Scratch objects reused every frame (allocating new ones 60x/second creates garbage).
const plane = new Plane(new Vector3(0, 0, 1), 0) // the interaction plane z = 0
const raycaster = new Raycaster()
const ndcVector = new Vector2()
const hit = new Vector3()

function InteractionDriver() {
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05) // avoid a giant jump after switching tabs
    const playing = gameStore.get().screen === 'play'

    // Project an NDC point onto the interaction plane (null if there is none).
    const toPlane = (ndc: { x: number; y: number } | null) => {
      if (!playing || !ndc) return null
      ndcVector.set(ndc.x, ndc.y)
      raycaster.setFromCamera(ndcVector, state.camera)
      return raycaster.ray.intersectPlane(plane, hit) ? { x: hit.x, y: hit.y } : null
    }

    const events: InteractionEvent[] = []
    // 1. Replay presses/releases that happened between frames (dt = 0: no movement).
    for (const edge of pointerInput.edges) {
      events.push(...crystal.update({ pointer: toPlane(edge.ndc), grip: playing && edge.grip }, 0))
    }
    pointerInput.edges.length = 0

    // 2. The regular per-frame update with the current cursor and grip.
    const pointer = toPlane(pointerInput.ndc)
    cursorWorld.visible = pointer !== null
    if (pointer) {
      cursorWorld.x = pointer.x
      cursorWorld.y = pointer.y
    }
    events.push(...crystal.update({ pointer, grip: playing && pointerInput.grip }, dt))

    const s = gameStore.get()
    gameStore.set({
      crystal: crystal.state,
      nearSocket: crystal.nearSocket,
      ...(events.includes('placed') ? { completed: true, completionCount: s.completionCount + 1 } : {}),
    })
  }, -1)

  return null
}

/**
 * Keeps the whole scene in view on any screen shape and performs the one
 * orchestrated camera move: on the title screen the chamber sits to the right
 * of the title; pressing Play glides it to the centre.
 */
const rig = { x: -1.8, y: 3, z: 10, lookX: -1.8 }

function CameraRig() {
  useFrame((state, delta) => {
    const camera = state.camera as PerspectiveCamera
    const pos = rig
    const dt = Math.min(delta, 0.05)
    const aspect = state.size.width / state.size.height
    const halfFov = (camera.fov * Math.PI) / 360
    // Distance needed so ±4.7 world units fit horizontally.
    const dist = Math.max(9.2, 4.7 / (Math.tan(halfFov) * aspect))
    const title = gameStore.get().screen === 'title'
    const wide = aspect > 1.15
    const shift = title && wide ? -1.8 : 0
    const drift = title ? Math.sin(state.clock.elapsedTime * 0.25) * 0.25 : 0

    pos.x = damp(pos.x, shift + drift, 2.2, dt)
    pos.lookX = damp(pos.lookX, shift, 2.2, dt)
    pos.z = damp(pos.z, dist, 3, dt)
    pos.y = damp(pos.y, 1.7 + dist * 0.12, 3, dt)

    camera.position.set(pos.x, pos.y, pos.z)
    camera.lookAt(pos.lookX, 1.55, 0)
    sceneLink.camera = camera
    if (state.scene.fog instanceof Fog) {
      state.scene.fog.near = pos.z + 1
      state.scene.fog.far = pos.z + 17
    }
  })
  return null
}
