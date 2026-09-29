// =========================================================================
// LocalDoc Motion & Animation System (Lottie & Micro-Interactions)
// 100% Offline, Privacy-First, Zero-External Dependencies, 60fps Native Performance
// =========================================================================

(function (window) {
  'use strict';

  // Embedded Pure Vector Lottie Animation Presets (Lightweight JSON)
  const LOTTIE_PRESETS = {
    // 1. Success Celebratory Pop & Checkmark
    'success-check': {
      v: '5.5.7',
      fr: 60,
      ip: 0,
      op: 60,
      w: 120,
      h: 120,
      nm: 'SuccessCheck',
      ddd: 0,
      assets: [],
      layers: [
        {
          ddd: 0,
          ind: 1,
          ty: 4,
          nm: 'Checkmark',
          sr: 1,
          ks: {
            o: { k: 100 },
            r: { k: 0 },
            p: { k: [60, 60, 0] },
            a: { k: [0, 0, 0] },
            s: {
              k: [
                { i: { x: [0.2, 0.2, 0.2], y: [1, 1, 1] }, o: { x: [0.7, 0.7, 0.7], y: [0, 0, 0] }, t: 15, s: [0, 0, 100] },
                { i: { x: [0.2, 0.2, 0.2], y: [1, 1, 1] }, o: { x: [0.7, 0.7, 0.7], y: [0, 0, 0] }, t: 30, s: [120, 120, 100] },
                { t: 40, s: [100, 100, 100] }
              ]
            }
          },
          shapes: [
            {
              ty: 'gr',
              it: [
                {
                  ty: 'sh',
                  ks: {
                    k: {
                      i: [[0, 0], [0, 0], [0, 0]],
                      o: [[0, 0], [0, 0], [0, 0]],
                      v: [[-22, 2], [-6, 18], [22, -14]],
                      c: false
                    }
                  }
                },
                {
                  ty: 'st',
                  c: { k: [0.08, 0.72, 0.65, 1] }, // Brand Teal #14B8A6
                  o: { k: 100 },
                  w: { k: 6 },
                  lc: 2,
                  lj: 2
                },
                {
                  ty: 'tr',
                  p: { k: [0, 0] },
                  a: { k: [0, 0] },
                  s: { k: [100, 100] },
                  r: { k: 0 },
                  o: { k: 100 }
                }
              ]
            }
          ]
        },
        {
          ddd: 0,
          ind: 2,
          ty: 4,
          nm: 'CircleRing',
          sr: 1,
          ks: {
            o: { k: 100 },
            r: { k: 0 },
            p: { k: [60, 60, 0] },
            a: { k: [0, 0, 0] },
            s: {
              k: [
                { i: { x: [0.2, 0.2, 0.2], y: [1, 1, 1] }, o: { x: [0.7, 0.7, 0.7], y: [0, 0, 0] }, t: 0, s: [0, 0, 100] },
                { t: 25, s: [100, 100, 100] }
              ]
            }
          },
          shapes: [
            {
              ty: 'gr',
              it: [
                {
                  ty: 'el',
                  p: { k: [0, 0] },
                  s: { k: [84, 84] }
                },
                {
                  ty: 'st',
                  c: { k: [0.08, 0.72, 0.65, 1] },
                  o: { k: 100 },
                  w: { k: 5 }
                },
                {
                  ty: 'tr',
                  p: { k: [0, 0] },
                  a: { k: [0, 0] },
                  s: { k: [100, 100] },
                  r: { k: 0 },
                  o: { k: 100 }
                }
              ]
            }
          ]
        }
      ]
    },

    // 2. Futuristic Document Scanning Laser
    'scan-laser': {
      v: '5.5.7',
      fr: 60,
      ip: 0,
      op: 90,
      w: 120,
      h: 120,
      nm: 'ScanLaser',
      ddd: 0,
      assets: [],
      layers: [
        {
          ddd: 0,
          ind: 1,
          ty: 4,
          nm: 'LaserBeam',
          sr: 1,
          ks: {
            o: { k: 100 },
            r: { k: 0 },
            p: {
              k: [
                { i: { x: 0.4, y: 1 }, o: { x: 0.6, y: 0 }, t: 0, s: [60, 24, 0] },
                { i: { x: 0.4, y: 1 }, o: { x: 0.6, y: 0 }, t: 45, s: [60, 96, 0] },
                { t: 90, s: [60, 24, 0] }
              ]
            },
            a: { k: [0, 0, 0] },
            s: { k: [100, 100, 100] }
          },
          shapes: [
            {
              ty: 'gr',
              it: [
                {
                  ty: 'sh',
                  ks: {
                    k: {
                      i: [[0, 0], [0, 0]],
                      o: [[0, 0], [0, 0]],
                      v: [[-36, 0], [36, 0]],
                      c: false
                    }
                  }
                },
                {
                  ty: 'st',
                  c: { k: [0.08, 0.72, 0.65, 1] },
                  o: { k: 100 },
                  w: { k: 3 },
                  lc: 2
                },
                {
                  ty: 'tr',
                  p: { k: [0, 0] },
                  a: { k: [0, 0] },
                  s: { k: [100, 100] },
                  r: { k: 0 },
                  o: { k: 100 }
                }
              ]
            }
          ]
        },
        {
          ddd: 0,
          ind: 2,
          ty: 4,
          nm: 'DocumentOutline',
          sr: 1,
          ks: {
            o: { k: 100 },
            r: { k: 0 },
            p: { k: [60, 60, 0] },
            a: { k: [0, 0, 0] },
            s: { k: [100, 100, 100] }
          },
          shapes: [
            {
              ty: 'gr',
              it: [
                {
                  ty: 'rc',
                  p: { k: [0, 0] },
                  s: { k: [64, 84] },
                  r: { k: 8 }
                },
                {
                  ty: 'st',
                  c: { k: [0.3, 0.4, 0.5, 0.8] },
                  o: { k: 100 },
                  w: { k: 3 }
                },
                {
                  ty: 'tr',
                  p: { k: [0, 0] },
                  a: { k: [0, 0] },
                  s: { k: [100, 100] },
                  r: { k: 0 },
                  o: { k: 100 }
                }
              ]
            }
          ]
        }
      ]
    }
  };

  class MotionSystem {
    // -----------------------------------------------------------------------
    // 1. Play Lottie Animation (Canvas or SVG Renderer)
    // -----------------------------------------------------------------------
    static playLottie(container, animationKeyOrJson, userOptions = {}) {
      if (!container) return null;

      const animationData = typeof animationKeyOrJson === 'string'
        ? LOTTIE_PRESETS[animationKeyOrJson]
        : animationKeyOrJson;

      if (!animationData) {
        console.warn(`[Motion] Animation preset "${animationKeyOrJson}" not found.`);
        return null;
      }

      if (window.bodymovin || window.lottie) {
        const lottieLib = window.lottie || window.bodymovin;
        return lottieLib.loadAnimation({
          container: container,
          renderer: userOptions.renderer || 'svg',
          loop: userOptions.loop !== undefined ? userOptions.loop : true,
          autoplay: userOptions.autoplay !== undefined ? userOptions.autoplay : true,
          animationData: animationData,
          ...userOptions
        });
      }

      // Pure CSS fallback if lottie is not loaded yet
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">
          <div style="width:40px;height:40px;border:3.5px solid rgba(20,184,166,0.25);border-top-color:#14B8A6;border-radius:50%;animation:motionSpin 0.75s linear infinite;"></div>
        </div>
      `;
      return null;
    }

    // -----------------------------------------------------------------------
    // 2. Celebratory Confetti Burst (Physics-based Canvas)
    // -----------------------------------------------------------------------
    static confetti(originX = window.innerWidth / 2, originY = window.innerHeight / 2) {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '999999';
      document.body.appendChild(canvas);

      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const colors = ['#14B8A6', '#06B6D4', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];
      const particles = [];

      for (let i = 0; i < 48; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 8;
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 5 + Math.random() * 5,
          alpha: 1,
          rot: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 12
        });
      }

      function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = 0;

        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.25; // gravity
          p.rot += p.rotSpeed;
          p.alpha -= 0.018;

          if (p.alpha > 0) {
            alive++;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rot * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
          }
        }

        if (alive > 0) {
          requestAnimationFrame(render);
        } else {
          canvas.remove();
        }
      }

      requestAnimationFrame(render);
    }

    // -----------------------------------------------------------------------
    // 3. Smooth Dynamic Number Counter (e.g. Compression size -94%)
    // -----------------------------------------------------------------------
    static counter(element, start, end, duration = 800, suffix = '') {
      if (!element) return;
      const startTime = performance.now();

      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Smooth easeOutExpo
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const currentVal = Math.round(start + (end - start) * ease);
        element.textContent = currentVal + suffix;

        if (progress < 1) {
          requestAnimationFrame(update);
        }
      }

      requestAnimationFrame(update);
    }
  }

  // Inject standard spin keyframe if not present
  if (!document.getElementById('localdoc-motion-keyframes')) {
    const style = document.createElement('style');
    style.id = 'localdoc-motion-keyframes';
    style.textContent = `
      @keyframes motionSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes motionPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.04); opacity: 0.88; }
      }
    `;
    document.head.appendChild(style);
  }

  window.MotionSystem = MotionSystem;
})(window);
