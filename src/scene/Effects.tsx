import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Mesh, type MeshBasicMaterial } from 'three'
import { SOCKET } from '../game/constants'
import { damp } from '../game/math'
import { world } from '../game/session'
import { MAX_PARTICLES, MAX_RINGS, particles, rings } from './effects'
import { getGlowTexture } from './textures'

const geometry = new BufferGeometry()
const positionAttr = new BufferAttribute(particles.position, 3)
const colorAttr = new BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3)
geometry.setAttribute('position', positionAttr)
geometry.setAttribute('color', colorAttr)

function stepParticles(dt: number): void {
  const p = particles
  const drag = Math.exp(-1.6 * dt)
  const colors = colorAttr.array as Float32Array
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (p.life[i] <= 0) {
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0 // black = invisible with additive blending
      continue
    }
    p.life[i] -= dt
    const v = p.velocity
    v[i * 3] *= drag
    v[i * 3 + 1] = v[i * 3 + 1] * drag - 0.9 * dt
    v[i * 3 + 2] *= drag
    p.position[i * 3] += v[i * 3] * dt
    p.position[i * 3 + 1] += v[i * 3 + 1] * dt
    p.position[i * 3 + 2] += v[i * 3 + 2] * dt
    const fade = Math.max(0, p.life[i] / p.maxLife[i])
    colors[i * 3] = p.baseColor[i * 3] * fade
    colors[i * 3 + 1] = p.baseColor[i * 3 + 1] * fade
    colors[i * 3 + 2] = p.baseColor[i * 3 + 2] * fade
  }
  positionAttr.needsUpdate = true
  colorAttr.needsUpdate = true
}

/** Particle bursts, shockwave rings and the pedestal's shield bubble. */
export function Effects() {
  const ringMeshes = useRef<(Mesh | null)[]>([])
  const shield = useRef<Mesh>(null)
  const shieldMat = useRef<MeshBasicMaterial>(null)
  const shieldLevel = useRef(0)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    if (!world.paused) stepParticles(dt)

    rings.forEach((r, i) => {
      const mesh = ringMeshes.current[i]
      if (!mesh) return
      if (!r.active) {
        mesh.visible = false
        return
      }
      if (!world.paused) r.age += dt
      const t = r.age / r.life
      if (t >= 1) {
        r.active = false
        mesh.visible = false
        return
      }
      mesh.visible = true
      mesh.position.set(r.x, r.y, 0.05)
      mesh.scale.setScalar(Math.max(0.01, r.radius * (1 - (1 - t) ** 3)))
      const mat = mesh.material as MeshBasicMaterial
      mat.color.copy(r.color)
      mat.opacity = (1 - t) * 0.9
    })

    // Shield bubble: fades in while a ward is active, flickers as it runs out.
    const active = world.shieldTime > 0
    shieldLevel.current = damp(shieldLevel.current, active ? 1 : 0, 6, dt)
    if (shield.current && shieldMat.current) {
      const ending = active && world.shieldTime < 1.2 ? 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 25) : 1
      shield.current.visible = shieldLevel.current > 0.01
      shield.current.scale.setScalar(1.55 + Math.sin(state.clock.elapsedTime * 3) * 0.03)
      shield.current.rotation.y += dt * 0.4
      shieldMat.current.opacity = shieldLevel.current * 0.22 * ending
    }
  })

  return (
    <>
      <points geometry={geometry} frustumCulled={false} dispose={null}>
        <pointsMaterial size={0.13} map={getGlowTexture()} vertexColors transparent depthWrite={false} blending={AdditiveBlending} />
      </points>
      {Array.from({ length: MAX_RINGS }, (_, i) => (
        <mesh key={i} ref={(m) => void (ringMeshes.current[i] = m)} visible={false}>
          <ringGeometry args={[0.94, 1, 96]} />
          <meshBasicMaterial transparent depthWrite={false} blending={AdditiveBlending} />
        </mesh>
      ))}
      <mesh ref={shield} position={[SOCKET.x, SOCKET.y - 0.35, 0]} visible={false}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial ref={shieldMat} color="#7dffc8" wireframe transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </>
  )
}
