import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, type Group } from 'three'
import { CRYSTAL_START } from '../game/constants'
import { getGlowTexture } from './textures'

const STONE = '#2e2a40'
const STONE_DARK = '#1b1828'
const RUNE_VIOLET = '#8c6cff'

/** Floor platform, an engraved rune dial, ruined pillars and background haze. */
export function Chamber() {
  const glow = getGlowTexture()
  return (
    <group>
      {/* Main platform and a lower step */}
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[6.6, 6.9, 0.6, 72]} />
        <meshStandardMaterial color={STONE} roughness={0.92} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.78, 0]}>
        <cylinderGeometry args={[7.3, 7.7, 0.36, 72]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.95} />
      </mesh>

      <RuneDial />
      <OriginCircle />

      {/* Ruined pillars around the back of the chamber */}
      {PILLARS.map((p, i) => (
        <Pillar key={i} {...p} />
      ))}

      {/* Distant violet haze behind everything */}
      <sprite position={[0, 3.5, -16]} scale={[34, 20, 1]}>
        <spriteMaterial map={glow} color="#5a2fd6" transparent opacity={0.35} depthWrite={false} blending={AdditiveBlending} />
      </sprite>
    </group>
  )
}

/** Concentric engraved rings with tick marks, slowly turning. */
function RuneDial() {
  const ticks = useMemo(() => Array.from({ length: 48 }, (_, i) => (i / 48) * Math.PI * 2), [])
  const ref = useRef<Group>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.02
  })
  return (
    <group ref={ref} position={[0, 0.012, 0]}>
      {[
        [4.55, 4.6],
        [5.3, 5.33],
        [2.0, 2.02],
      ].map(([inner, outer], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[inner, outer, 128]} />
          <meshBasicMaterial color={RUNE_VIOLET} transparent opacity={0.45} />
        </mesh>
      ))}
      {ticks.map((angle, i) => (
        <mesh key={i} position={[Math.cos(angle) * 4.95, 0, Math.sin(angle) * 4.95]} rotation={[0, -angle, 0]}>
          <boxGeometry args={[i % 4 === 0 ? 0.5 : 0.24, 0.01, 0.035]} />
          <meshBasicMaterial color={RUNE_VIOLET} transparent opacity={i % 4 === 0 ? 0.55 : 0.3} />
        </mesh>
      ))}
    </group>
  )
}

/** A faint cyan circle on the floor where the crystal starts. */
function OriginCircle() {
  return (
    <group position={[CRYSTAL_START.x, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.78, 0.82, 64]} />
        <meshBasicMaterial color="#54e6ff" transparent opacity={0.35} />
      </mesh>
      <mesh>
        <ringGeometry args={[1.02, 1.035, 64]} />
        <meshBasicMaterial color="#54e6ff" transparent opacity={0.2} />
      </mesh>
    </group>
  )
}

interface PillarProps {
  angle: number
  height: number
  broken?: boolean
}

const PILLARS: PillarProps[] = [
  { angle: 200, height: 6.5 },
  { angle: 225, height: 2.6, broken: true },
  { angle: 250, height: 7.2 },
  { angle: 290, height: 7.2 },
  { angle: 315, height: 3.4, broken: true },
  { angle: 340, height: 6.5 },
]

function Pillar({ angle, height, broken }: PillarProps) {
  const a = (angle * Math.PI) / 180
  const r = 8.6
  return (
    <group position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
      <mesh position={[0, height / 2 - 0.6, 0]}>
        <cylinderGeometry args={[0.42, 0.5, height, 8]} />
        <meshStandardMaterial color={STONE} roughness={0.9} flatShading />
      </mesh>
      {broken ? (
        <mesh position={[0.25, height - 0.5, 0]} rotation={[0.3, 0.4, 0.5]}>
          <cylinderGeometry args={[0.42, 0.42, 0.5, 8]} />
          <meshStandardMaterial color={STONE} roughness={0.9} flatShading />
        </mesh>
      ) : (
        <mesh position={[0, height - 0.45, 0]}>
          <boxGeometry args={[1.25, 0.3, 1.25]} />
          <meshStandardMaterial color={STONE_DARK} roughness={0.9} />
        </mesh>
      )}
    </group>
  )
}
