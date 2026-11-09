import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, Color, DoubleSide, type Group, type Mesh, type MeshStandardMaterial, type SpriteMaterial } from 'three'
import { WELLS } from '../game/constants'
import { world } from '../game/session'
import type { ShardKind } from '../game/world'
import { getGlowTexture } from './textures'

const TINT: Record<ShardKind, Color> = {
  heart: new Color('#5ef2ff'),
  shard: new Color('#5ef2ff'),
  ward: new Color('#7dffc8'),
  nova: new Color('#ffb347'),
}
const CRACKED = new Color('#ffb3c1')
const scratch = new Color()

const MAX_SHARDS = 10

/**
 * Ammunition shards and the special crystals (ward, nova). The heart crystal
 * has its own component. Ward and nova are larger and pulse, so they read as
 * "take me to the pedestal".
 */
export function Shards() {
  const slots = useRef<(Group | null)[]>([])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const others = world.shards.filter((s) => s.kind !== 'heart')
    for (let i = 0; i < MAX_SHARDS; i++) {
      const group = slots.current[i]
      if (!group) continue
      const s = others[i]
      if (!s) {
        group.visible = false
        continue
      }
      group.visible = true
      const body = group.children[0] as Mesh
      const halo = group.children[1]
      const mat = body.material as MeshStandardMaterial
      const haloMat = (halo as unknown as { material: SpriteMaterial }).material
      const special = s.kind !== 'shard'
      const hovered = world.hoveredId === s.id
      const held = world.heldId === s.id
      const flying = s.state === 'flying'

      const appear = Math.min(1, s.age / 0.35)
      const bob = s.state === 'resting' ? Math.sin(t * 2 + s.id) * 0.06 : 0
      group.position.set(s.x, s.y + bob, 0)

      const base = special ? 0.36 : 0.22
      const size = base * appear * (hovered ? 1.2 : held ? 1.1 : 1) * (1 - s.hits * 0.08)
      if (flying) {
        // Stretch along the direction of travel.
        body.rotation.set(0, 0, Math.atan2(s.vy, s.vx) - Math.PI / 2)
        body.scale.set(size * 0.7, size * 2.4, size * 0.7)
      } else {
        body.rotation.set(0, t * (held ? 3 : 1) + s.id, 0)
        body.scale.set(size, size * 1.7, size)
      }

      scratch.copy(TINT[s.kind]).lerp(CRACKED, s.hits / 3)
      mat.color.copy(scratch)
      mat.emissive.copy(scratch)
      const pulse = special ? 0.25 * Math.sin(t * 4) : 0
      mat.emissiveIntensity = 0.35 + (hovered ? 0.5 : 0) + (held ? 0.6 : 0) + pulse
      haloMat.color.copy(scratch)
      haloMat.opacity = appear * (0.35 + (hovered || held ? 0.35 : 0) + pulse * 0.6 + (flying ? 0.3 : 0))
      halo.scale.setScalar(size * (special ? 6 : 5))
    }
  })

  const glow = getGlowTexture()
  return (
    <>
      {/* Rune rings that mark where shards are produced */}
      {WELLS.map((w, i) => (
        <mesh key={`well-${i}`} position={[w.x, w.y - 0.42, 0]} rotation={[-Math.PI / 2.4, 0, 0]}>
          <ringGeometry args={[0.32, 0.36, 6]} />
          <meshBasicMaterial color="#54e6ff" transparent opacity={0.35} side={DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {Array.from({ length: MAX_SHARDS }, (_, i) => (
        <group key={i} ref={(g) => void (slots.current[i] = g)} visible={false}>
          <mesh>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#5ef2ff" emissive="#5ef2ff" emissiveIntensity={0.4} roughness={0.15} metalness={0.2} flatShading transparent opacity={0.9} />
          </mesh>
          <sprite>
            <spriteMaterial map={glow} color="#5ef2ff" transparent opacity={0.4} depthWrite={false} blending={AdditiveBlending} />
          </sprite>
        </group>
      ))}
    </>
  )
}
