import { ECS, type Entity } from '../ECS';
import { HealthComponent, RenderComponent, PositionComponent, CollisionComponent, TargetComponent } from '../Components';
import { Engine } from '../Engine';
import { ParticleSystem } from './ParticleSystem';
import { Assets } from '../Assets';
import * as PIXI from 'pixi.js';

const frameOffsets: Record<number, { x: number, y: number }> = {
  0: { x: 0, y: 0 },
  1: { x: 0, y: 0 },
  2: { x: 0, y: 0 },
  3: { x: 0, y: 0 },
  4: { x: 0, y: 0 },
  5: { x: 0, y: 0 },
  6: { x: 0, y: 0 },
  7: { x: 0, y: 0 },
  8: { x: 0, y: 0 },
  9: { x: 0, y: 0 },
  10: { x: 0, y: 0 },
  11: { x: 0, y: 0 },
  12: { x: 0, y: 0 },
  13: { x: 0, y: 0 },
  14: { x: 0, y: 0 },
};

const SCHOOL_PALETTE = [0xc25a5a, 0x8c969e, 0xd1d5db, 0xf2c94c];

interface ActiveFire {
  sprite: PIXI.AnimatedSprite;
  lifetime: number;
  maxLifetime: number;
}
export const activeFires: ActiveFire[] = [];

export function spawnFire(x: number, y: number, duration: number, scale: number) {
  // Spawn a tiny, quick blast360 explosion flash to mark the ignition of the fire
  const flashSprite = new PIXI.AnimatedSprite(Assets.explosion360Frames);
  flashSprite.anchor.set(0.5, 0.5);
  flashSprite.x = x;
  flashSprite.y = y - 10; // slightly above base
  flashSprite.scale.set(scale * 1.3); // scaled very small relative to the fire
  flashSprite.loop = false;
  flashSprite.animationSpeed = 0.35; // plays quickly
  Engine.effectsLayer.addChild(flashSprite);
  flashSprite.play();
  flashSprite.onComplete = () => {
    flashSprite.destroy();
  };

  const animSprite = new PIXI.AnimatedSprite(Assets.fireFrames);
  animSprite.anchor.set(0.5, 1.0); // bottom-centered so it sits on building footprint
  animSprite.x = x;
  animSprite.y = y;
  animSprite.scale.set(scale);
  animSprite.animationSpeed = 0.15 + Math.random() * 0.1; // random animation speed
  animSprite.loop = true;

  Engine.effectsLayer.addChild(animSprite);
  animSprite.play();

  activeFires.push({
    sprite: animSprite,
    lifetime: 0,
    maxLifetime: duration
  });
}


export function executeDestructionStrike(entity: Entity, damageAmount: number, impactX: number, impactY: number) {
  const health = HealthComponent.get(entity);
  if (!health || health.currentHP <= 0) return;

  const oldFrameIndex = health.state;

  // Find the maximum frame index available for this building type
  const render = RenderComponent.get(entity);
  const prefix = render?.texturePrefix || 'building_3_stage_';
  let maxFrame = 0;
  while (Assets.textures[`${prefix}${maxFrame + 1}`] !== undefined) {
    maxFrame++;
  }

  // Deduct HP and compute target frame index
  health.currentHP = Math.max(0, health.currentHP - damageAmount);
  let damagePercent = 1 - (health.currentHP / health.maxHP);
  let newFrameIndex = Math.floor(damagePercent * maxFrame);
  if (newFrameIndex < 0) newFrameIndex = 0;
  if (newFrameIndex > maxFrame) newFrameIndex = maxFrame;

  if (oldFrameIndex === newFrameIndex) {
    // If no state transition occurs, spawn a minor spark effect and exit
    ParticleSystem.spawn(impactX, impactY, 0xffffff);
    return;
  }

  // Determine if this hit transitions the building into its final rubble state
  const isFinalState = (newFrameIndex === maxFrame);
  const frames = isFinalState ? Assets.explosionFrames : Assets.explosion360Frames;
  const peakFrame = isFinalState ? 2 : 3; // Frame 2 is peak for blast, Frame 3 is peak for blast360

  // Instantiate explosion AnimatedSprite on the Effects Layer
  const animSprite = new PIXI.AnimatedSprite(frames);
  animSprite.anchor.set(0.5, 0.5);
  animSprite.x = impactX;
  animSprite.y = impactY;
  animSprite.scale.set(0.75); // scaled down for better visual proportion
  animSprite.loop = false;
  animSprite.animationSpeed = 0.25; // plays at ~15fps

  Engine.effectsLayer.addChild(animSprite);
  animSprite.play();

  let swapped = false;

  animSprite.onFrameChange = (currentFrame: number) => {
    if (currentFrame === peakFrame && !swapped) {
      swapped = true;

      // Update building state and swap texture
      health.state = newFrameIndex;
      const render = RenderComponent.get(entity);
      if (render && render.sprite instanceof PIXI.Sprite) {
        const sprite = render.sprite as PIXI.Sprite;
        const prefix = render.texturePrefix || 'building_3_stage_';
        sprite.texture = Assets.textures[`${prefix}${newFrameIndex}`];
        if (sprite.texture.defaultAnchor) {
          sprite.anchor.copyFrom(sprite.texture.defaultAnchor);
        }

        const offset = frameOffsets[newFrameIndex] || { x: 0, y: 0 };
        sprite.pivot.set(offset.x, offset.y);
      }

      // Drop Collision and Remove Target tag if building is destroyed/rubble
      if (newFrameIndex >= maxFrame - 2) {
        const collision = CollisionComponent.get(entity);
        if (collision) {
          collision.active = false;
        }
        TargetComponent.delete(entity);
      }

      // Trigger screen shake matrix offset
      Engine.triggerShake(8, 10);

      // Launch custom physics debris chunks
      const color = SCHOOL_PALETTE[Math.floor(Math.random() * SCHOOL_PALETTE.length)];
      ParticleSystem.spawnDebrisBurst(impactX, impactY, color);

      // Spawn multiple fires if the building transitions into rubble (final form)
      if (newFrameIndex === maxFrame) {
        const numFires = 1 + Math.floor(Math.random() * 2); // 1 to 2 fires
        for (let i = 0; i < numFires; i++) {
          const offsetX = (Math.random() - 0.5) * 30;
          const offsetY = (Math.random() - 0.5) * 15; // close to center
          const duration = 180 + Math.random() * 240; // 3 to 7 seconds
          const scale = 0.1 + Math.random() * 0.1; // very small scale
          spawnFire(impactX + offsetX, impactY + offsetY, duration, scale);
        }
      }
    }
  };

  animSprite.onComplete = () => {
    animSprite.destroy();
  };
}

export function DestructionSystem(delta: number) {
  for (const entity of ECS.entities) {
    const health = HealthComponent.get(entity);
    if (!health) continue;

    const render = RenderComponent.get(entity);
    const pos = PositionComponent.get(entity);

    if (!render || !pos || !(render.sprite instanceof PIXI.Sprite)) continue;

    const frameIndex = health.state;

    // Find the maximum frame index available for this building type
    const prefix = render.texturePrefix || 'building_3_stage_';
    let maxFrame = 0;
    while (Assets.textures[`${prefix}${maxFrame + 1}`] !== undefined) {
      maxFrame++;
    }

    // Emit continuous smoke based on visual state
    if (frameIndex > Math.floor(maxFrame * 0.2) && frameIndex < Math.floor(maxFrame * 0.8) && Math.random() < 0.05 * delta) {
      const px = Engine.toScreenX(pos.worldX, pos.worldY);
      const py = Engine.toScreenY(pos.worldX, pos.worldY) - pos.worldZ * Engine.TILE_WIDTH;
      ParticleSystem.spawn(px + (Math.random() - 0.5) * 20, py - 60, 0xaaaaaa);
    } else if (frameIndex >= Math.floor(maxFrame * 0.8) && Math.random() < 0.1 * delta) {
      const px = Engine.toScreenX(pos.worldX, pos.worldY);
      const py = Engine.toScreenY(pos.worldX, pos.worldY) - pos.worldZ * Engine.TILE_WIDTH;
      ParticleSystem.spawn(px + (Math.random() - 0.5) * 20, py - 40, 0x333333);
      if (Math.random() < 0.5) ParticleSystem.spawn(px + (Math.random() - 0.5) * 20, py - 30, 0xff5500);
    }

    // Randomly spawn continuous fires for damaged buildings (probability scales with damage state)
    if (frameIndex > 0) {
      const spawnChance = 0.00025 * delta * frameIndex;
      if (Math.random() < spawnChance) {
        let renderX = pos.worldX;
        let renderY = pos.worldY;
        const collision = CollisionComponent.get(entity);
        let baseLimitX = 20;
        let baseLimitY = 10;

        if (collision) {
          const w = collision.width;
          const l = collision.length;
          renderX = pos.worldX + (w - 1) / 2;
          renderY = pos.worldY + (l - 1) / 2;
          baseLimitX = 8 * (w + l);
          baseLimitY = 4 * (w + l);
        }

        const screenX = Engine.toScreenX(renderX, renderY);
        const footW = collision ? collision.width : 1;
        const footL = collision ? collision.length : 1;
        const screenY = Engine.toScreenY(pos.worldX + footW - 0.5, pos.worldY + footL - 0.5) - pos.worldZ * Engine.TILE_WIDTH;

        // Adjust vertical height offset to place the fire near the actual center of the sprite based on state
        const heightOffset = (frameIndex === maxFrame) ? 5 : 20;

        const offsetX = (Math.random() - 0.5) * baseLimitX;
        const offsetY = (Math.random() - 0.5) * baseLimitY - heightOffset;
        const duration = 120 + Math.random() * 180; // 2 to 5 seconds
        const scale = 0.06 + Math.random() * 0.08; // very small

        spawnFire(screenX + offsetX, screenY + offsetY, duration, scale);
      }
    }
  }

  // Update active fires: fade out and clean up
  for (let i = activeFires.length - 1; i >= 0; i--) {
    const f = activeFires[i];
    f.lifetime += delta;

    if (f.lifetime >= f.maxLifetime) {
      f.sprite.alpha -= 0.05 * delta;
      if (f.sprite.alpha <= 0) {
        f.sprite.destroy();
        activeFires.splice(i, 1);
      }
    }
  }
}
