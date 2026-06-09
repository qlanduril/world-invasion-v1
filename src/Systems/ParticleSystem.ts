import { Engine } from '../Engine';
import * as PIXI from 'pixi.js';

interface Particle {
  sprite: PIXI.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface DebrisChunk {
  graphics: PIXI.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
}

export class ParticleSystem {
  private static pool: Particle[] = [];
  private static debrisPool: Particle[] = [];
  private static poolSize = 500;
  private static debrisPoolSize = 300;
  public static activeDebrisChunks: DebrisChunk[] = [];

  public static init() {
    for (let i = 0; i < this.poolSize; i++) {
      const g = new PIXI.Graphics();
      g.circle(0, 0, 4);
      g.fill({ color: 0xffffff }); // Default white, tinted later
      Engine.effectsLayer.addChild(g);
      g.visible = false;

      this.pool.push({
        sprite: g,
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1, active: false
      });
    }

    for (let i = 0; i < this.debrisPoolSize; i++) {
      const g = new PIXI.Graphics();
      g.rect(-4, -4, 8, 8); // Square debris chunk
      g.fill({ color: 0xffffff });
      Engine.effectsLayer.addChild(g);
      g.visible = false;

      this.debrisPool.push({
        sprite: g,
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1, active: false
      });
    }
  }

  public static spawn(x: number, y: number, color: number) {
    for (let i = 0; i < this.poolSize; i++) {
      const p = this.pool[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = (Math.random() - 0.5) * 6;
        p.vy = (Math.random() - 0.5) * 6 - 2; // Upwards bias
        p.life = 30 + Math.random() * 30;
        p.maxLife = p.life;
        p.sprite.tint = color;
        p.sprite.visible = true;
        p.sprite.alpha = 1;
        break;
      }
    }
  }

  public static spawnDebris(x: number, y: number, color: number) {
    for (let i = 0; i < this.debrisPoolSize; i++) {
      const p = this.debrisPool[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = (Math.random() - 0.5) * 8; // Burst outward
        p.vy = -Math.random() * 8 - 4;    // Shoot up
        p.life = 60 + Math.random() * 60; // 1 to 2 seconds
        p.maxLife = p.life;
        p.sprite.tint = color;
        p.sprite.visible = true;
        p.sprite.alpha = 1;
        p.sprite.rotation = Math.random() * Math.PI;
        break;
      }
    }
  }

  public static spawnDebrisBurst(x: number, y: number, color: number) {
    const count = 5 + Math.floor(Math.random() * 4); // 5 to 8 chunks
    for (let i = 0; i < count; i++) {
      const g = new PIXI.Graphics();
      g.rect(-2, -2, 4, 4); // 4x4 pixels block
      g.fill({ color });
      Engine.effectsLayer.addChild(g);

      this.activeDebrisChunks.push({
        graphics: g,
        x,
        y,
        vx: (Math.random() * 8) - 4,   // random horizontal velocity [-4, 4]
        vy: -2 - (Math.random() * 4),   // random upward velocity [-6, -2]
        gravity: 0.25
      });
    }
  }

  public static update(delta: number) {
    const gravity = 0.4;
    
    for (let i = 0; i < this.poolSize; i++) {
      const p = this.pool[i];
      if (p.active) {
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.life -= delta;
        p.sprite.x = p.x;
        p.sprite.y = p.y;
        p.sprite.alpha = Math.max(0, p.life / p.maxLife);
        
        if (p.life <= 0) {
          p.active = false;
          p.sprite.visible = false;
        }
      }
    }

    for (let i = 0; i < this.debrisPoolSize; i++) {
      const p = this.debrisPool[i];
      if (p.active) {
        p.x += p.vx * delta;
        p.vy += gravity * delta; // Gravity effect
        p.y += p.vy * delta;
        p.sprite.rotation += p.vx * 0.05 * delta; // Spin
        p.life -= delta;
        
        p.sprite.x = p.x;
        p.sprite.y = p.y;
        p.sprite.alpha = Math.max(0, p.life / p.maxLife);
        
        if (p.life <= 0) {
          p.active = false;
          p.sprite.visible = false;
        }
      }
    }

    // Update custom debris chunks
    for (let i = this.activeDebrisChunks.length - 1; i >= 0; i--) {
      const chunk = this.activeDebrisChunks[i];
      chunk.vy += chunk.gravity * delta;
      chunk.x += chunk.vx * delta;
      chunk.y += chunk.vy * delta;

      chunk.graphics.x = chunk.x;
      chunk.graphics.y = chunk.y;

      const screenY = chunk.y + Engine.worldContainer.y;
      
      // Remove once off-screen or too low
      if (screenY > Engine.app.screen.height + 50 || chunk.y > 1500) {
        chunk.graphics.destroy();
        this.activeDebrisChunks.splice(i, 1);
      }
    }
  }
}
