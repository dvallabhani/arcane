import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import {
  AdditiveBlending,
  ConeGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  TetrahedronGeometry,
  type BufferGeometry,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type Sprite,
  type SpriteMaterial,
} from 'three'
import { BOSS, ENEMIES, type EnemyKind } from '../game/content'
import { world } from '../game/session'
import { getGlowTexture } from './textures'

/*
 * Shadows are near-black shapes with a crimson glow and a bright eye, so
 * they read clearly against the dark chamber and never look like crystals.
 */

const SHAPES: Record<EnemyKind, BufferGeometry> = {
  wisp: new IcosahedronGeometry(1, 0),
  dart: new ConeGeometry(0.55, 2, 5).rotateZ(-Math.PI / 2), // points along +x
  brute: new DodecahedronGeometry(1, 0),
  splitter: new OctahedronGeometry(1, 0),
  mote: new TetrahedronGeometry(1, 0),
}

const MAX_ENEMIES = 36

export function Enemies() {
  const slots = useRef<(Group | null)[]>([])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const group = slots.current[i]
      if (!group) continue
      const e = world.enemies[i]
      if (!e) {
        group.visible = false
        continue
      }
      group.visible = true
      const body = group.children[0] as Mesh
      const halo = group.children[1] as Sprite
      const eye = group.children[2] as Sprite
      const mat = body.material as MeshStandardMaterial

      if (body.geometry !== SHAPES[e.kind]) body.geometry = SHAPES[e.kind]
      const appear = Math.min(1, e.age / 0.45) // grow in from nothing
      const r = e.radius * appear
      group.position.set(e.x, e.y, 0)

      const windup = e.kind === 'dart' && e.age < (ENEMIES.dart.windup ?? 0)
      if (e.kind === 'dart') {
        body.rotation.set(0, 0, Math.atan2(e.dirY, e.dirX))
        body.scale.set(r * 0.9, r, r)
        if (windup) group.position.x += Math.sin(t * 60) * 0.03 // trembling before the dash
      } else {
        body.rotation.x = t * 0.7 + e.phase
        body.rotation.y = t * 1.1 + e.phase
        body.scale.setScalar(r)
      }

      const damaged = 1 - e.hp / e.maxHp
      mat.emissiveIntensity = 0.06 + e.hitFlash * 2.5 + damaged * 0.5 + (windup ? 0.8 + Math.sin(t * 20) * 0.4 : 0)
      halo.scale.setScalar(r * (4 + (windup ? 1.5 : 0)) * (1 + Math.sin(t * 4 + e.phase) * 0.08))
      ;(halo.material as SpriteMaterial).opacity = 0.7 * appear + e.hitFlash * 0.4
      eye.position.set(0, 0, r * 1.05)
      eye.scale.setScalar(r * 0.9)
      ;(eye.material as SpriteMaterial).opacity = appear * (0.85 + Math.sin(t * 7 + e.phase) * 0.15)
    }
  })

  const glow = getGlowTexture()
  return (
    <>
      {Array.from({ length: MAX_ENEMIES }, (_, i) => (
        <group key={i} ref={(g) => void (slots.current[i] = g)} visible={false}>
          <mesh geometry={SHAPES.wisp}>
            <meshStandardMaterial color="#0c0510" emissive="#ff2e63" emissiveIntensity={0.06} roughness={0.5} metalness={0.6} flatShading />
          </mesh>
          <sprite>
            <spriteMaterial map={glow} color="#ff2e63" transparent depthWrite={false} blending={AdditiveBlending} />
          </sprite>
          <sprite>
            <spriteMaterial map={glow} color="#ffd6e0" transparent depthWrite={false} blending={AdditiveBlending} />
          </sprite>
        </group>
      ))}
    </>
  )
}

const MAX_ORBS = 24

/** The boss's dark orbs: they drift at the pedestal and can be smashed or shot down. */
export function Orbs() {
  const slots = useRef<(Group | null)[]>([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < MAX_ORBS; i++) {
      const group = slots.current[i]
      if (!group) continue
      const o = world.orbs[i]
      if (!o) {
        group.visible = false
        continue
      }
      group.visible = true
      group.position.set(o.x, o.y, 0)
      const grow = Math.min(1, o.age / 0.3)
      group.children[0].scale.setScalar(BOSS.orbRadius * grow)
      group.children[1].scale.setScalar(BOSS.orbRadius * 5 * grow * (1 + Math.sin(t * 9 + o.id) * 0.15))
    }
  })
  const glow = getGlowTexture()
  return (
    <>
      {Array.from({ length: MAX_ORBS }, (_, i) => (
        <group key={i} ref={(g) => void (slots.current[i] = g)} visible={false}>
          <mesh>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial color="#0a0410" />
          </mesh>
          <sprite>
            <spriteMaterial map={glow} color="#ff2e63" transparent opacity={0.8} depthWrite={false} blending={AdditiveBlending} />
          </sprite>
        </group>
      ))}
    </>
  )
}

/** The Hollow Eye: a dark sphere in two rune rings, with one big eye that glows before it fires. */
export function Boss() {
  const group = useRef<Group>(null)
  const body = useRef<Mesh>(null)
  const bodyMat = useRef<MeshStandardMaterial>(null)
  const ringA = useRef<Mesh>(null)
  const ringB = useRef<Mesh>(null)
  const eyeMat = useRef<SpriteMaterial>(null)
  const eye = useRef<Sprite>(null)
  const pupil = useRef<Sprite>(null)
  const haloMat = useRef<SpriteMaterial>(null)

  useFrame((state, delta) => {
    const g = group.current
    const b = world.boss
    if (!g) return
    if (!b) {
      g.visible = false
      return
    }
    g.visible = true
    const t = state.clock.elapsedTime
    const dying = b.state === 'dying'
    const fade = dying ? Math.max(0, 1 - b.age / 2) : 1
    g.position.set(b.x, b.y, 0)
    g.scale.setScalar((dying ? 1 + b.age * 0.6 : 1) * (1 + b.hitFlash * 0.06))

    if (body.current) body.current.rotation.y += delta * 0.3
    if (ringA.current) ringA.current.rotation.set(t * 0.6, t * 0.9, 0)
    if (ringB.current) ringB.current.rotation.set(-t * 0.8, 0.4, t * 0.5)
    if (bodyMat.current) {
      bodyMat.current.emissiveIntensity = 0.08 + b.hitFlash * 2 + b.charge * 0.8
      bodyMat.current.opacity = fade
    }
    if (eyeMat.current) eyeMat.current.opacity = fade * (0.6 + b.charge * 0.4 + b.hitFlash * 0.4)
    if (eye.current) eye.current.scale.setScalar(0.9 + b.charge * 0.6)
    if (haloMat.current) haloMat.current.opacity = fade * (0.45 + b.charge * 0.35)
    // The pupil watches the pedestal.
    if (pupil.current) {
      const dx = 0 - b.x
      const dy = 1.7 - b.y
      const len = Math.hypot(dx, dy) || 1
      pupil.current.position.set((dx / len) * 0.18, (dy / len) * 0.18, BOSS.radius + 0.06)
      pupil.current.visible = !dying
    }
  })

  const glow = getGlowTexture()
  return (
    <group ref={group} visible={false}>
      <sprite scale={[5, 5, 1]}>
        <spriteMaterial ref={haloMat} map={glow} color="#ff2e63" transparent opacity={0.5} depthWrite={false} blending={AdditiveBlending} />
      </sprite>
      <mesh ref={body} scale={BOSS.radius}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial ref={bodyMat} color="#0a0510" emissive="#ff2e63" emissiveIntensity={0.08} roughness={0.45} metalness={0.6} flatShading transparent />
      </mesh>
      <mesh ref={ringA}>
        <torusGeometry args={[1.15, 0.032, 8, 64]} />
        <meshBasicMaterial color="#ff4f7b" transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={ringB}>
        <torusGeometry args={[1.36, 0.022, 8, 64]} />
        <meshBasicMaterial color="#b48cff" transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <sprite ref={eye} position={[0, 0, BOSS.radius]} scale={0.9}>
        <spriteMaterial ref={eyeMat} map={glow} color="#ffd6e0" transparent depthWrite={false} blending={AdditiveBlending} />
      </sprite>
      <sprite ref={pupil} position={[0, 0, BOSS.radius + 0.06]} scale={0.32}>
        <spriteMaterial map={glow} color="#000000" transparent opacity={0.95} depthWrite={false} />
      </sprite>
    </group>
  )
}
