/**
 * ParticleSystem for animating AC/DC current flow in circuit wires
 *
 * Features:
 * - Particles flow along wire paths
 * - Sinusoidal velocity for AC current
 * - Particle density reflects current magnitude
 * - Direction indicates current flow
 */

export class Particle {
  constructor(wireId, position = 0, velocity = 0) {
    this.wireId = wireId; // Wire this particle belongs to
    this.position = position; // 0 to 1, position along the wire path
    this.velocity = velocity; // speed along path (can be negative for reverse flow)
    this.phase = Math.random() * Math.PI * 2; // Random phase offset for visual variety
  }

  update(dt, baseVelocity, isAC = false, frequency = 1000) {
    if (isAC) {
      // AC: velocity oscillates sinusoidally
      const time = Date.now() / 1000; // seconds
      const omega = 2 * Math.PI * frequency; // angular frequency
      const currentVelocity = baseVelocity * Math.sin(omega * time + this.phase);
      this.position += currentVelocity * dt;
    } else {
      // DC: constant velocity
      this.position += baseVelocity * dt;
    }

    // Wrap around: if particle goes past the end, reset to beginning
    if (this.position > 1) {
      this.position = this.position % 1;
    } else if (this.position < 0) {
      this.position = 1 + (this.position % 1);
    }
  }

  // Get interpolated (x, y) position along a polyline path
  getPositionOnPath(pathPoints) {
    if (!pathPoints || pathPoints.length < 2) return null;

    // Calculate total path length and segment lengths
    const segments = [];
    let totalLength = 0;

    for (let i = 0; i < pathPoints.length - 1; i++) {
      const p1 = pathPoints[i];
      const p2 = pathPoints[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      segments.push({ start: p1, end: p2, length });
      totalLength += length;
    }

    // Find which segment contains this position
    const targetDistance = this.position * totalLength;
    let accumulatedDistance = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (accumulatedDistance + seg.length >= targetDistance) {
        // Particle is in this segment
        const distanceInSegment = targetDistance - accumulatedDistance;
        const t = seg.length > 0 ? distanceInSegment / seg.length : 0;

        return {
          x: seg.start.x + (seg.end.x - seg.start.x) * t,
          y: seg.start.y + (seg.end.y - seg.start.y) * t,
        };
      }
      accumulatedDistance += seg.length;
    }

    // Fallback: return last point
    return pathPoints[pathPoints.length - 1];
  }
}

export class ParticleSystem {
  constructor() {
    this.particles = new Map(); // wireId -> Particle[]
    this.wireConfigs = new Map(); // wireId -> { current, isAC, frequency, particleCount }
  }

  /**
   * Update configuration for a wire
   * @param {string} wireId - Wire identifier
   * @param {number} current - Instantaneous current in amperes (determines velocity/direction)
   * @param {boolean} isAC - Whether this is AC (internal sine wave generation)
   * @param {number} frequency - Frequency in Hz (for AC)
   * @param {number} [averageCurrent] - Representative current for particle density (e.g. peak/RMS). If omitted, uses `current`.
   */
  setWireConfig(wireId, current, isAC = false, frequency = 1000, averageCurrent = null) {
    const absCurrent = Math.abs(current);
    const densityCurrent = averageCurrent !== null ? Math.abs(averageCurrent) : absCurrent;

    // Determine particle count based on DENSITY current (stable)
    // More current = more particles
    let particleCount = 0;
    if (densityCurrent > 1e-9) {
      // Logarithmic scaling: 1µA -> 2 particles, 1mA -> 5, 1A -> 8, 10A -> 12
      const log = Math.log10(densityCurrent + 1e-12);
      particleCount = Math.max(2, Math.min(15, Math.floor(5 + log * 2)));
    }

    // Determine base velocity based on INSTANTANEOUS current
    // Speed should increase with current magnitude
    let baseVelocity = 0;
    if (absCurrent > 1e-9) {
      const log = Math.log10(absCurrent + 1e-12);
      baseVelocity = Math.max(0.001, Math.min(0.02, 0.005 + log * 0.002));
    }

    // Direction: positive current = forward, negative = reverse
    if (current < 0) {
      baseVelocity = -baseVelocity;
    }

    this.wireConfigs.set(wireId, {
      current: absCurrent,
      isAC,
      frequency,
      particleCount,
      baseVelocity,
    });

    // Initialize particles if they don't exist or count changed
    const existing = this.particles.get(wireId) || [];
    if (existing.length !== particleCount) {
      const newParticles = [];
      for (let i = 0; i < particleCount; i++) {
        // Distribute particles evenly along the wire
        // If resizing, try to preserve relative positions or just reset?
        // Resetting is safer for now to ensure even distribution
        const position = i / particleCount;
        newParticles.push(new Particle(wireId, position, baseVelocity));
      }
      this.particles.set(wireId, newParticles);
    }
  }

  /**
   * Remove all particles for a wire
   */
  clearWire(wireId) {
    this.particles.delete(wireId);
    this.wireConfigs.delete(wireId);
  }

  /**
   * Clear all particles
   */
  clear() {
    this.particles.clear();
    this.wireConfigs.clear();
  }

  /**
   * Update all particles (call every frame)
   * @param {number} dt - Delta time (usually 1/60 for 60fps)
   */
  update(dt = 1 / 60) {
    for (const [wireId, particles] of this.particles.entries()) {
      const config = this.wireConfigs.get(wireId);
      if (!config || config.particleCount === 0) continue;

      for (const particle of particles) {
        particle.update(
          dt,
          config.baseVelocity,
          config.isAC,
          config.frequency
        );
      }
    }
  }

  /**
   * Render particles on canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Map} wirePaths - Map of wireId -> array of {x, y} points
   */
  render(ctx, wirePaths) {
    for (const [wireId, particles] of this.particles.entries()) {
      const path = wirePaths.get(wireId);
      if (!path || path.length < 2) continue;

      const config = this.wireConfigs.get(wireId);
      if (!config) continue;

      for (const particle of particles) {
        const pos = particle.getPositionOnPath(path);
        if (!pos) continue;

        // Draw particle as a glowing dot
        ctx.save();

        // Glow effect
        ctx.shadowBlur = 8;
        ctx.shadowColor = config.isAC ? "rgba(0, 200, 255, 0.8)" : "rgba(255, 200, 0, 0.8)";

        // Outer glow
        ctx.fillStyle = config.isAC
          ? "rgba(0, 150, 255, 0.3)"
          : "rgba(255, 180, 0, 0.3)";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Inner dot
        ctx.fillStyle = config.isAC
          ? "rgba(0, 200, 255, 0.9)"
          : "rgba(255, 220, 0, 0.9)";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }
  }

  /**
   * Get particle count for a wire (for debugging)
   */
  getParticleCount(wireId) {
    return this.particles.get(wireId)?.length || 0;
  }
}
