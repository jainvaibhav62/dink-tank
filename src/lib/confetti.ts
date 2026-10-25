// Tiny dependency-free confetti burst — a short, celebratory pop when a player
// records a win. Self-contained: spins up a full-screen canvas, animates a few
// dozen particles with gravity, then removes itself. No external library.

const COLORS = ['#65a30d', '#16a34a', '#0d9488', '#d9f99d', '#facc15', '#f97316']

export function burstConfetti(durationMs = 1400) {
  if (typeof document === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.createElement('canvas')
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  const dpr = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }
  ctx.scale(dpr, dpr)

  const W = window.innerWidth
  const particles = Array.from({ length: 90 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 120,
    y: window.innerHeight * 0.32,
    vx: (Math.random() - 0.5) * 9,
    vy: Math.random() * -9 - 4,
    size: 5 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
  }))

  const start = performance.now()
  function frame(now: number) {
    const elapsed = now - start
    ctx!.clearRect(0, 0, W, window.innerHeight)
    for (const p of particles) {
      p.vy += 0.22 // gravity
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      ctx!.save()
      ctx!.translate(p.x, p.y)
      ctx!.rotate(p.rot)
      ctx!.globalAlpha = Math.max(0, 1 - elapsed / durationMs)
      ctx!.fillStyle = p.color
      ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      ctx!.restore()
    }
    if (elapsed < durationMs) {
      requestAnimationFrame(frame)
    } else {
      canvas.remove()
    }
  }
  requestAnimationFrame(frame)
}
