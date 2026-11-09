import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial, type SpriteMaterial } from 'three'
import { damp } from '../game/math'
import { cursorWorld, pointerInput, world } from '../game/session'
import { getGlowTexture } from './textures'

/**
 * A violet orb that sits exactly where the cursor ray meets the interaction
 * plane. Its ring tightens while you pinch / hold the button, so you can see
 * the grip register before anything else happens.
 *
 * Drawn without depth testing so it is never hidden behind the crystal.
 */
export function MagicCursor() {
  const group = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const ringMat = useRef<MeshBasicMaterial>(null)
  const coreMat = useRef<SpriteMaterial>(null)
  const haloMat = useRef<SpriteMaterial>(null)
  const anim = useRef({ opacity: 0, ring: 1, x: 0, y: 0 })

  useFrame((state, delta) => {
    if (!group.current || !ring.current) return
    const dt = Math.min(delta, 0.05)
    const a = anim.current

    a.opacity = damp(a.opacity, cursorWorld.visible ? 1 : 0, 12, dt)
    if (cursorWorld.visible) {
      // Jump straight to the cursor when it (re)appears, otherwise follow it.
      // Input is already smoothed upstream, so this follow is very light.
      if (a.opacity < 0.1) {
        a.x = cursorWorld.x
        a.y = cursorWorld.y
      } else {
        a.x = damp(a.x, cursorWorld.x, 35, dt)
        a.y = damp(a.y, cursorWorld.y, 35, dt)
      }
    }
    group.current.position.set(a.x, a.y, 0)
    group.current.visible = a.opacity > 0.01

    const gripping = pointerInput.grip
    const engaged = world.hoveredId !== null || world.heldId !== null
    a.ring = damp(a.ring, gripping ? 0.55 : engaged ? 1.25 : 1, 14, dt)
    ring.current.scale.setScalar(a.ring)
    ring.current.rotation.z += dt * (gripping ? 4 : 1.2)

    const flicker = 0.92 + Math.sin(state.clock.elapsedTime * 9) * 0.08
    if (ringMat.current) ringMat.current.opacity = a.opacity * (engaged ? 0.95 : 0.7)
    if (coreMat.current) coreMat.current.opacity = a.opacity * flicker
    if (haloMat.current) haloMat.current.opacity = a.opacity * (engaged ? 0.75 : 0.45)
  })

  const glow = getGlowTexture()
  return (
    <group ref={group} renderOrder={10}>
      <sprite scale={[1.5, 1.5, 1]} renderOrder={10}>
        <spriteMaterial ref={haloMat} map={glow} color="#9b6bff" transparent depthTest={false} depthWrite={false} blending={AdditiveBlending} />
      </sprite>
      <sprite scale={[0.32, 0.32, 1]} renderOrder={11}>
        <spriteMaterial ref={coreMat} map={glow} color="#f0e4ff" transparent depthTest={false} depthWrite={false} blending={AdditiveBlending} />
      </sprite>
      <mesh ref={ring} renderOrder={11}>
        {/* 6 segments: a hexagonal rune ring */}
        <ringGeometry args={[0.26, 0.3, 6]} />
        <meshBasicMaterial ref={ringMat} color="#c4a6ff" transparent depthTest={false} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  )
}
