import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type PointsMaterial } from 'three'
import { SOCKET } from '../game/constants'
import { useGame } from '../game/store'
import { getGlowTexture } from './textures'

/*
 * Both particle systems exist exactly once, so their buffers are created at
 * module level and updated in place each frame (cheap: no allocations).
 */

// ---------- Ambient motes ----------

const MOTE_COUNT = 240

const motes = (() => {
  const positions = new Float32Array(MOTE_COUNT * 3)
  const colors = new Float32Array(MOTE_COUNT * 3)
  const speeds = new Float32Array(MOTE_COUNT)
  const phases = new Float32Array(MOTE_COUNT)
  const palette = [new Color('#8c6cff'), new Color('#5ef2ff'), new Color('#c9b8ff')]
  for (let i = 0; i < MOTE_COUNT; i++) {
    const r = 1 + Math.random() * 7.5
    const a = Math.random() * Math.PI * 2
    positions.set([Math.cos(a) * r, Math.random() * 7, Math.sin(a) * r - 1], i * 3)
    const c = palette[i % palette.length]
    colors.set([c.r, c.g, c.b], i * 3)
    speeds[i] = 0.08 + Math.random() * 0.25
    phases[i] = Math.random() * Math.PI * 2
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return { geometry, speeds, phases }
})()

function stepMotes(time: number, dt: number): void {
  const pos = motes.geometry.attributes.position as BufferAttribute
  for (let i = 0; i < MOTE_COUNT; i++) {
    let y = pos.getY(i) + motes.speeds[i] * dt
    if (y > 7) y = 0 // recycle at the top
    pos.setY(i, y)
    pos.setX(i, pos.getX(i) + Math.sin(time * 0.6 + motes.phases[i]) * 0.002)
  }
  pos.needsUpdate = true
}

/** Slow-rising specks of light that fill the chamber. */
export function AmbientMotes() {
  useFrame((state, delta) => stepMotes(state.clock.elapsedTime, Math.min(delta, 0.05)))
  return (
    <points geometry={motes.geometry} frustumCulled={false} dispose={null}>
      <pointsMaterial size={0.09} map={getGlowTexture()} vertexColors transparent opacity={0.8} depthWrite={false} blending={AdditiveBlending} />
    </points>
  )
}

// ---------- Completion burst ----------

const BURST_COUNT = 280
const BURST_SECONDS = 2.6

const burst = {
  geometry: (() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(BURST_COUNT * 3), 3))
    return g
  })(),
  velocities: new Float32Array(BURST_COUNT * 3),
  active: false,
  age: 0,
}

/** Puts every spark at the socket with a random outward velocity (biased upward). */
function igniteBurst(): void {
  const pos = burst.geometry.attributes.position as BufferAttribute
  const v = burst.velocities
  for (let i = 0; i < BURST_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 1.6 - 0.6)
    const speed = 1.5 + Math.random() * 4
    v[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
    v[i * 3 + 1] = Math.cos(phi) * speed + 0.8
    v[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed
    pos.setXYZ(i, SOCKET.x, SOCKET.y, 0)
  }
  pos.needsUpdate = true
  burst.active = true
  burst.age = 0
}

/** Moves the sparks with drag and a little gravity. Returns the current opacity. */
function stepBurst(dt: number): number {
  if (!burst.active) return 0
  burst.age += dt
  const drag = Math.exp(-1.8 * dt)
  const pos = burst.geometry.attributes.position as BufferAttribute
  const v = burst.velocities
  for (let i = 0; i < BURST_COUNT; i++) {
    v[i * 3] *= drag
    v[i * 3 + 1] = v[i * 3 + 1] * drag - 1.2 * dt
    v[i * 3 + 2] *= drag
    pos.setXYZ(i, pos.getX(i) + v[i * 3] * dt, pos.getY(i) + v[i * 3 + 1] * dt, pos.getZ(i) + v[i * 3 + 2] * dt)
  }
  pos.needsUpdate = true
  if (burst.age > BURST_SECONDS) burst.active = false
  return Math.max(0, 1 - burst.age / BURST_SECONDS)
}

/**
 * Gold sparks that explode from the pedestal when the crystal is placed.
 * Triggered by `completionCount` in the store; cleared on reset.
 */
export function CompletionBurst() {
  const completionCount = useGame((s) => s.completionCount)
  const resetCount = useGame((s) => s.resetCount)
  const material = useRef<PointsMaterial>(null)

  useEffect(() => {
    if (completionCount > 0) igniteBurst()
  }, [completionCount])

  useEffect(() => {
    burst.active = false
  }, [resetCount])

  useFrame((_, delta) => {
    const opacity = stepBurst(Math.min(delta, 0.05))
    if (material.current) material.current.opacity = opacity
  })

  return (
    <points geometry={burst.geometry} frustumCulled={false} dispose={null}>
      <pointsMaterial ref={material} size={0.16} map={getGlowTexture()} color="#ffc65c" transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
    </points>
  )
}
