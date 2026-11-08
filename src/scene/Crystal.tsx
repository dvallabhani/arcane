import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, Color, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, type PointLight, type SpriteMaterial } from 'three'
import type { CrystalState } from '../game/interaction'
import { damp } from '../game/math'
import { crystal } from '../game/session'
import { getGlowTexture } from './textures'

/** Visual intensity for each interaction state (0 = dim, 1 = brightest). */
const GLOW: Record<CrystalState, number> = { idle: 0.35, hovered: 0.75, grabbed: 0.9, placed: 1 }
const CYAN = new Color('#5ef2ff')
const GOLD = new Color('#ffcf6b')
const tint = new Color() // reused every frame to avoid allocations

/**
 * The crystal reads the shared CrystalInteraction every frame and only
 * handles presentation: position, bobbing, spin and glow.
 */
export function Crystal() {
  const group = useRef<Group>(null)
  const body = useRef<Mesh>(null)
  const bodyMat = useRef<MeshStandardMaterial>(null)
  const coreMat = useRef<MeshBasicMaterial>(null)
  const haloMat = useRef<SpriteMaterial>(null)
  const light = useRef<PointLight>(null)
  const shadow = useRef<Mesh>(null)
  const shadowMat = useRef<MeshBasicMaterial>(null)
  const anim = useRef({ glow: GLOW.idle, bob: 0, scale: 1, gold: 0 })

  useFrame((state, delta) => {
    if (!group.current || !body.current) return
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    const a = anim.current
    const s = crystal.state

    a.glow = damp(a.glow, GLOW[s], 8, dt)
    // Gentle floating when free, held steady while grabbed.
    a.bob = damp(a.bob, s === 'grabbed' ? 0 : Math.sin(t * 1.6) * 0.09, 6, dt)
    a.scale = damp(a.scale, s === 'hovered' ? 1.1 : s === 'grabbed' ? 1.06 : 1, 10, dt)
    a.gold = damp(a.gold, s === 'placed' ? 1 : 0, 2.5, dt)

    group.current.position.set(crystal.position.x, crystal.position.y + a.bob, 0)
    group.current.scale.setScalar(a.scale)
    body.current.rotation.y += dt * (s === 'grabbed' ? 2.4 : s === 'placed' ? 1.4 : 0.6)

    tint.copy(CYAN).lerp(GOLD, a.gold * 0.55)
    if (bodyMat.current) {
      bodyMat.current.emissiveIntensity = 0.2 + a.glow * 0.6
      bodyMat.current.emissive.copy(tint)
    }
    if (coreMat.current) coreMat.current.opacity = 0.3 + a.glow * 0.45
    if (haloMat.current) {
      haloMat.current.opacity = 0.25 + a.glow * 0.5 + Math.sin(t * 3) * 0.04
      haloMat.current.color.copy(tint)
    }
    if (light.current) {
      light.current.intensity = 4 + a.glow * 14
      light.current.color.copy(tint)
    }
    // Soft contact shadow on the floor: darker and tighter the lower the crystal is.
    if (shadow.current && shadowMat.current) {
      const height = Math.max(group.current.position.y, 0.1)
      shadow.current.position.set(crystal.position.x, 0.02, 0)
      shadow.current.scale.setScalar(1.1 + height * 0.25)
      shadowMat.current.opacity = Math.min(0.7, 1.1 / height)
    }
  })

  const glow = getGlowTexture()
  return (
    <>
      <group ref={group}>
        <mesh ref={body} scale={[0.36, 0.62, 0.36]}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            ref={bodyMat}
            color="#3fd8f2"
            emissive="#5ef2ff"
            emissiveIntensity={1}
            roughness={0.12}
            metalness={0.2}
            flatShading
            transparent
            opacity={0.85}
          />
        </mesh>
        {/* bright inner core */}
        <mesh scale={[0.13, 0.26, 0.13]}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial ref={coreMat} color="#ffffff" transparent opacity={0.8} />
        </mesh>
        <sprite scale={[2.6, 2.6, 1]}>
          <spriteMaterial ref={haloMat} map={glow} color="#5ef2ff" transparent opacity={0.4} depthWrite={false} blending={AdditiveBlending} />
        </sprite>
        <pointLight ref={light} color="#5ef2ff" intensity={8} distance={7} decay={2} />
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.4, 1.4]} />
        <meshBasicMaterial ref={shadowMat} map={glow} color="#000000" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </>
  )
}
