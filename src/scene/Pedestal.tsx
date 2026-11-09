import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, Color, DoubleSide, type Group, type Mesh, type MeshBasicMaterial, type PointLight, type SpriteMaterial } from 'three'
import { PEDESTAL_TOP_Y, PEDESTAL_X } from '../game/constants'
import { damp } from '../game/math'
import { world } from '../game/session'
import { getBeamTexture, getGlowTexture } from './textures'

const VIOLET = new Color('#8c6cff')
const GOLD = new Color('#ffc65c')
const RED = new Color('#ff4040')
const runeColor = new Color()

/**
 * Three states, all driven by the shared game logic:
 *  dormant  – faint violet runes
 *  ready    – a grabbed crystal is overhead: runes pulse brighter (drop hint)
 *  awakened – crystal placed: runes turn gold, a beam and shockwave appear
 */
export function Pedestal() {
  const runeMat = useRef<MeshBasicMaterial>(null)
  const socketMat = useRef<SpriteMaterial>(null)
  const beam = useRef<Group>(null)
  const beamMat = useRef<MeshBasicMaterial>(null)
  const wave = useRef<Mesh>(null)
  const waveMat = useRef<MeshBasicMaterial>(null)
  const light = useRef<PointLight>(null)
  const anim = useRef({ awake: 0, ready: 0, beam: 0, waveT: 99 })

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    const a = anim.current
    const placed = world.phase !== 'intro'
    // The big beam belongs to the awakening moment; during battle it settles to a faint glow.
    const beamLevel = world.phase === 'awakened' ? 1 : world.phase === 'victory' ? 0.8 : 0.25

    // Restart the shockwave the moment the crystal is placed.
    if (placed && a.awake < 0.02) a.waveT = 0
    a.awake = damp(a.awake, placed ? 1 : 0, placed ? 3 : 8, dt)
    a.beam = damp(a.beam, placed ? beamLevel : 0, 2, dt)
    a.ready = damp(a.ready, world.nearSocket ? 1 : 0, 10, dt)
    a.waveT += dt

    const pulse = 0.5 + 0.5 * Math.sin(t * 6)
    runeColor.copy(VIOLET).lerp(GOLD, a.awake).lerp(RED, world.pedestalFlash)
    if (runeMat.current) {
      runeMat.current.color.copy(runeColor)
      runeMat.current.opacity = 0.55 + a.ready * (0.4 + pulse * 0.25) + a.awake * 0.6
    }
    if (socketMat.current) {
      socketMat.current.color.copy(runeColor)
      socketMat.current.opacity = 0.16 + a.ready * 0.35 + a.awake * (0.55 + 0.1 * Math.sin(t * 2))
    }
    if (beam.current && beamMat.current) {
      beamMat.current.opacity = a.beam * 0.5
      beam.current.scale.set(1, 0.2 + a.beam * 0.8, 1)
    }
    if (wave.current && waveMat.current) {
      const p = Math.min(a.waveT / 1.2, 1)
      wave.current.scale.setScalar(0.5 + p * 7)
      waveMat.current.opacity = (1 - p) * 0.8
    }
    if (light.current) {
      light.current.intensity = 2.5 + a.ready * 6 + a.awake * 6 + a.beam * 10
      light.current.color.copy(runeColor)
    }
  })

  const glow = getGlowTexture()
  const top = PEDESTAL_TOP_Y
  return (
    <group position={[PEDESTAL_X, 0, 0]}>
      {/* Stone body: base, octagonal column, capital */}
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.85, 0.98, 0.32, 8]} />
        <meshStandardMaterial color="#4a4170" roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.38, 0.48, 0.62, 8]} />
        <meshStandardMaterial color="#544a7e" roughness={0.8} flatShading />
      </mesh>
      <mesh position={[0, top - 0.12, 0]}>
        <cylinderGeometry args={[0.74, 0.52, 0.24, 8]} />
        <meshStandardMaterial color="#5d5288" roughness={0.75} flatShading />
      </mesh>

      {/* Glowing rune ring on the top surface */}
      <mesh position={[0, top + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.46, 0.58, 8, 1]} />
        <meshBasicMaterial ref={runeMat} color={VIOLET} transparent opacity={0.35} side={DoubleSide} />
      </mesh>
      <sprite position={[0, top + 0.5, 0]} scale={[2.4, 2.4, 1]}>
        <spriteMaterial ref={socketMat} map={glow} color={VIOLET} transparent opacity={0.1} depthWrite={false} blending={AdditiveBlending} />
      </sprite>

      {/* Light beam rising from the pedestal once awakened */}
      <group ref={beam} position={[0, top, 0]}>
        <mesh position={[0, 3.5, 0]}>
          <cylinderGeometry args={[0.62, 0.45, 7, 24, 1, true]} />
          <meshBasicMaterial
            ref={beamMat}
            map={getBeamTexture()}
            color={GOLD}
            transparent
            opacity={0}
            depthWrite={false}
            blending={AdditiveBlending}
            side={DoubleSide}
          />
        </mesh>
      </group>
      {/* Shockwave ring that sweeps across the floor */}
      <mesh ref={wave} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 1, 96]} />
        <meshBasicMaterial ref={waveMat} color={GOLD} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
      </mesh>

      <pointLight ref={light} position={[0, top + 0.8, 0.6]} color={VIOLET} intensity={2.5} distance={9} decay={2} />
    </group>
  )
}
