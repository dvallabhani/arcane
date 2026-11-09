import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color } from 'three'
import { getGlowTexture } from './textures'

/*
 * The ambient particle field exists exactly once, so its buffers are created
 * at module level and updated in place each frame (cheap: no allocations).
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
