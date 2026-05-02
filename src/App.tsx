/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';

// Using types loosely for CDN scripts loaded in index.html
declare const Hands: any;
declare const Camera: any;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface FlowerState {
  grow: number;
  bloom: number;
  targetGrow: number;
  targetBloom: number;
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [handsDetected, setHandsDetected] = useState(false);
  
  // App state references
  const flowerStates = useRef<FlowerState[]>(Array(5).fill(0).map(() => ({
    grow: 0,
    bloom: 0,
    targetGrow: 0,
    targetBloom: 0
  })));
  const particles = useRef<Particle[]>([]);
  const isTerminating = useRef(false);
  const lastTime = useRef(0);
  const handsInstance = useRef<any>(null);
  const cameraInstance = useRef<any>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const initMediaPipe = async () => {
      // Ensure we don't start twice in dev mode
      if (handsInstance.current) return;

      // Fix for Emscripten arguments error if it persists
      (window as any).arguments = [];

      // Wait for scripts to be available if they're not yet
      let attempts = 0;
      while (attempts < 50 && (typeof Hands === 'undefined' || typeof Camera === 'undefined')) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (typeof Hands === 'undefined') {
        console.error('MediaPipe Hands not loaded');
        return;
      }

      if (!videoRef.current || !canvasRef.current) return;

      try {
        const hands = new Hands({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
          }
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        hands.onResults(onResults);
        handsInstance.current = hands;

        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && handsInstance.current) {
              await handsInstance.current.send({ image: videoRef.current });
            }
          },
          width: 1280,
          height: 720
        });
        
        cameraInstance.current = camera;
        await camera.start();
        
        if (mounted.current) {
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('Failed to start MediaPipe:', err);
      }
    };

    initMediaPipe();

    // Resize listener
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Animation loop
    let requestRef: number;
    const animate = (time: number) => {
      lastTime.current = time;
      draw(time);
      requestRef = requestAnimationFrame(animate);
    };
    requestRef = requestAnimationFrame(animate);

    return () => {
      mounted.current = false;
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestRef);
      if (cameraInstance.current) {
        cameraInstance.current.stop();
      }
      if (handsInstance.current) {
        // Not all versions have .close(), but most do.
        try { handsInstance.current.close(); } catch(e) {}
      }
    };
  }, []);

  const onResults = (results: any) => {
    if (!mounted.current) return;
    
    setHandsDetected(results.multiHandLandmarks && results.multiHandLandmarks.length > 0);
    
    if (isTerminating.current) {
      flowerStates.current.forEach(f => {
        f.targetGrow = 0;
        f.targetBloom = 0;
      });
      return;
    }

    let leftHand = null;
    let rightHand = null;

    if (results.multiHandLandmarks && results.multiHandedness) {
      results.multiHandedness.forEach((handedness: any, index: number) => {
        if (handedness.label === 'Left') {
          leftHand = results.multiHandLandmarks[index];
        } else {
          rightHand = results.multiHandLandmarks[index];
        }
      });
    }

    // Process Left Hand (Grow)
    if (leftHand) {
      const landmarks = leftHand;
      const wrist = landmarks[0];
      const middleMCP = landmarks[9];
      const handSize = Math.sqrt(Math.pow(wrist.x - middleMCP.x, 2) + Math.pow(wrist.y - middleMCP.y, 2));
      
      const pairs = [[8, 12], [12, 16], [16, 20]];
      let totalDist = 0;
      pairs.forEach(([a, b]) => {
        totalDist += Math.sqrt(Math.pow(landmarks[a].x - landmarks[b].x, 2) + Math.pow(landmarks[a].y - landmarks[b].y, 2));
      });
      const avgDist = totalDist / pairs.length;
      const normalizedGrow = Math.min(1.0, Math.max(0.0, (avgDist / handSize - 0.15) / 0.6));
      
      flowerStates.current.forEach(f => f.targetGrow = normalizedGrow);
      (window as any).leftHandData = leftHand;
      (window as any).growValue = normalizedGrow;
    } else {
      flowerStates.current.forEach(f => f.targetGrow = 0);
      (window as any).leftHandData = null;
    }

    // Process Right Hand (Bloom)
    if (rightHand) {
      const landmarks = rightHand;
      const wrist = landmarks[0];
      const middleMCP = landmarks[9];
      const handSize = Math.sqrt(Math.pow(wrist.x - middleMCP.x, 2) + Math.pow(wrist.y - middleMCP.y, 2));
      
      const pairs = [[8, 12], [12, 16], [16, 20]];
      let totalDist = 0;
      pairs.forEach(([a, b]) => {
        totalDist += Math.sqrt(Math.pow(landmarks[a].x - landmarks[b].x, 2) + Math.pow(landmarks[a].y - landmarks[b].y, 2));
      });
      const avgDist = totalDist / pairs.length;
      const normalizedBloom = Math.min(1.0, Math.max(0.0, (avgDist / handSize - 0.15) / 0.6));
      
      flowerStates.current.forEach(f => f.targetBloom = normalizedBloom);
      (window as any).rightHandData = rightHand;
      (window as any).bloomValue = normalizedBloom;
    } else {
      flowerStates.current.forEach(f => f.targetBloom = 0);
      (window as any).rightHandData = null;
    }
  };

  const draw = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const lerpSpeed = isTerminating.current ? 0.05 : 0.15;
    flowerStates.current.forEach(f => {
      f.grow += (f.targetGrow - f.grow) * lerpSpeed;
      f.bloom += (f.targetBloom - f.bloom) * lerpSpeed;
    });

    const leftHand = (window as any).leftHandData;
    const rightHand = (window as any).rightHandData;

    // Draw Hands Skeleton
    const drawSkeleton = (hand: any, isRight: boolean) => {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#4488ff';
      ctx.fillStyle = '#3355ff';

      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [5, 9], [9, 10], [10, 11], [11, 12],
        [9, 13], [13, 14], [14, 15], [15, 16],
        [13, 17], [17, 18], [18, 19], [19, 20],
        [0, 17]
      ];

      connections.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(hand[a].x * canvas.width, hand[a].y * canvas.height);
        ctx.lineTo(hand[b].x * canvas.width, hand[b].y * canvas.height);
        ctx.stroke();
      });

      if (isRight) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#aa44ff';
        ctx.beginPath();
        ctx.moveTo(hand[4].x * canvas.width, hand[4].y * canvas.height);
        ctx.lineTo(hand[8].x * canvas.width, hand[8].y * canvas.height);
        ctx.stroke();
        ctx.strokeStyle = '#4488ff';
      }

      hand.forEach((lm: any) => {
        ctx.beginPath();
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    if (leftHand) drawSkeleton(leftHand, false);
    if (rightHand) drawSkeleton(rightHand, true);

    // Labels
    const drawUnmirroredText = (text: string, x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#ff44cc';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };

    if (leftHand) {
      const gv = (window as any).growValue || 0;
      drawUnmirroredText(`Grow: ${gv.toFixed(2)}`, leftHand[9].x * canvas.width, leftHand[9].y * canvas.height);
    }
    if (rightHand) {
      const bv = (window as any).bloomValue || 0;
      drawUnmirroredText(`Bloom: ${bv.toFixed(2)}`, rightHand[9].x * canvas.width, rightHand[9].y * canvas.height);
    }

    // Flowers
    const fingertipIndices = [4, 8, 12, 16, 20];
    if (leftHand) {
      fingertipIndices.forEach((lmIdx, i) => {
        const flower = flowerStates.current[i];
        if (flower.grow < 0.01) return;

        const x = leftHand[lmIdx].x * canvas.width;
        const y = leftHand[lmIdx].y * canvas.height;
        const stemLen = flower.grow * 180;
        const sway = Math.sin(time / 400 + i) * 6;
        
        ctx.strokeStyle = '#aabbff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const cp1x = x + sway * 1.5;
        const cp1y = y - stemLen * 0.4;
        const endX = x + sway;
        const endY = y - stemLen;
        ctx.quadraticCurveTo(cp1x, cp1y, endX, endY);
        ctx.stroke();

        drawFlower(ctx, endX, endY, flower.bloom, flower.grow, time, i);
        
        if (flower.bloom > 0.75) {
          for(let p=0; p<2; p++) {
             particles.current.push({
               x: endX + (Math.random() - 0.5) * 40,
               y: endY - 30,
               vx: (Math.random() - 0.5) * 1.5,
               vy: -0.5 - Math.random(),
               life: 40
             });
          }
        }
      });
    }

    // Particles
    particles.current.forEach((p, i) => {
      ctx.save();
      ctx.globalAlpha = p.life / 40;
      ctx.fillStyle = '#ffee88';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
    });
    particles.current = particles.current.filter(p => p.life > 0);

    // No hands message
    if (!handsDetected && !isTerminating.current) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(-1, 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Show your hands to grow flowers 🌸', 0, 0);
      ctx.restore();
    }
  };

  const drawFlower = (ctx: CanvasRenderingContext2D, x: number, y: number, bloom: number, grow: number, time: number, index: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(grow, grow);

    // Interpolation Values
    let budWidth = 0;
    let petalLen = 0;
    let petalAngle = 0;
    let petalWidth = 0;
    let glow = 0;

    if (bloom <= 0.3) {
      const t = bloom / 0.3;
      budWidth = 12 * (1 - t) + 6 * t;
      petalLen = 5 * (1 - t) + 25 * t;
      petalAngle = 30 * t;
      petalWidth = 4 * (1 - t) + 8 * t;
      glow = 10 * (1 - t) + 15 * t;
    } else if (bloom <= 0.6) {
      const t = (bloom - 0.3) / 0.3;
      budWidth = 6 * (1 - t);
      petalLen = 25 * (1 - t) + 38 * t;
      petalAngle = 30 * (1 - t) + 55 * t;
      petalWidth = 8 * (1 - t) + 12 * t;
      glow = 15 * (1 - t) + 20 * t;
    } else {
      const t = (bloom - 0.6) / 0.4;
      budWidth = 0;
      petalLen = 38 * (1 - t) + 48 * t;
      petalAngle = 55 * (1 - t) + 75 * t;
      petalWidth = 12 * (1 - t) + 15 * t;
      glow = 20 * (1 - t) + 28 * t;
    }

    const glowColor = bloom > 0.7 ? '#ffdd00' : '#ffaa00';
    ctx.shadowBlur = glow;
    ctx.shadowColor = glowColor;

    // 0. Calyx (Green base)
    if (bloom > 0.05) {
      ctx.fillStyle = '#224411';
      for (let i = 0; i < 5; i++) {
        const side = (i - 2) * 0.4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(side * 15, 5, 0, 15);
        ctx.fill();
      }
    }

    // 1. Bud Shell
    const budHeight = 45 + Math.sin(time/200 + index)*3;
    if (budWidth > 0.5) {
      const grad = ctx.createLinearGradient(0, 0, 0, -budHeight);
      grad.addColorStop(0, '#cc2200');
      grad.addColorStop(0.5, '#ff6600');
      grad.addColorStop(1, '#ffdd00');
      ctx.fillStyle = grad;
      
      // Main bud (pointed ellipse)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-budWidth/2, -5, -budWidth/2, -budHeight + 5, 0, -budHeight);
      ctx.bezierCurveTo(budWidth/2, -budHeight + 5, budWidth/2, -5, 0, 0);
      ctx.fill();

      // Flanking guard petals
      const gWidth = budWidth * 0.7;
      const gHeight = budHeight * 0.7;
      ctx.fillStyle = '#cc2200';
      [-1, 1].forEach(side => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(side * gWidth, -gHeight * 0.4, 0, -gHeight);
        ctx.fill();
      });
    }

    // 2. Paddle Petals (Multilayered)
    const radAngle = (petalAngle * Math.PI) / 180;
    const layers = [
      { count: 10, size: 1.0, alpha: 1.0 },
      { count: 8, size: 0.6, alpha: 0.8 }
    ];

    layers.forEach((layer, lIdx) => {
      const numPetals = layer.count;
      const curLen = petalLen * layer.size;
      const curWidth = petalWidth * layer.size;

      for (let i = 0; i < numPetals; i++) {
        const baseAngle = (i / numPetals) * Math.PI * 2;
        const angle = baseAngle + (lIdx * 0.2); // Offset secondary layer
        
        ctx.save();
        ctx.rotate(angle);
        ctx.translate(0, -curLen * Math.sin(radAngle)); // Splay outward

        const pGrad = ctx.createLinearGradient(0, 0, 0, -curLen);
        pGrad.addColorStop(0, '#cc2200');
        pGrad.addColorStop(0.5, '#ff6600');
        pGrad.addColorStop(1, '#ffdd00');
        ctx.fillStyle = pGrad;
        ctx.globalAlpha = layer.alpha;

        // Draw Paddle Shape
        ctx.beginPath();
        ctx.moveTo(0, 0);
        // Left edge with ruffles
        ctx.bezierCurveTo(-curWidth/2, -curLen*0.2, -curWidth/2, -curLen*0.8, 0, -curLen);
        if (bloom > 0.4 && bloom < 0.8) { // Ruffled notches for stage 3
          ctx.lineTo(-2, -curLen + 3);
          ctx.lineTo(2, -curLen + 3);
        }
        // Right edge
        ctx.bezierCurveTo(curWidth/2, -curLen*0.8, curWidth/2, -curLen*0.2, 0, 0);
        ctx.fill();

        // Midrib line
        ctx.strokeStyle = 'rgba(204, 34, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -curLen * 0.8);
        ctx.stroke();

        ctx.restore();
      }
    });

    // 3. Central Intense Core
    if (bloom > 0.3) {
      const centerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 15 * bloom);
      centerGlow.addColorStop(0, '#ffffff');
      centerGlow.addColorStop(0.4, '#ffdd00');
      centerGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = centerGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 15 * bloom, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const handleTerminate = () => {
    isTerminating.current = true;
    setTimeout(() => {
      isTerminating.current = false;
      flowerStates.current.forEach(f => {
        f.grow = 0;
        f.bloom = 0;
        f.targetGrow = 0;
        f.targetBloom = 0;
      });
    }, 800);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 object-cover w-full h-full"
        style={{ transform: 'scaleX(-1)' }}
        playsInline
        muted
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ transform: 'scaleX(-1)', pointerEvents: 'none' }}
      />

      <div className="absolute top-5 right-5 z-[50]">
        <div className="w-20 h-20 rounded-full border-3 border-[#ffdd00] overflow-hidden bg-gray-800 shadow-lg">
           <img 
             src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent("Felix")}`} 
             alt="User Profile" 
             className="w-full h-full object-cover"
           />
        </div>
      </div>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[999]">
        <button
          id="terminate"
          onClick={handleTerminate}
          className="w-[160px] h-[44px] rounded-[22px] bg-[#cc0033] text-white font-bold text-[15px] uppercase shadow-xl hover:bg-[#aa0022] active:scale-95 transition-all cursor-pointer flex items-center justify-center"
        >
          ✕ TERMINATE
        </button>
      </div>

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 text-white z-[1000]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-t-pink-500 border-gray-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg font-medium">Connecting to Camera & AI...</p>
            <p className="text-sm text-gray-400 mt-2">Allow camera access to bloom your garden</p>
          </div>
        </div>
      )}
    </div>
  );
}
