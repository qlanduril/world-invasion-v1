import { ECS } from '../ECS';
import { PlayerComponent, PositionComponent, WeaponComponent, HealthComponent, TargetComponent, CollisionComponent } from '../Components';
import { Engine } from '../Engine';
import { Input } from '../Input';
import { UI } from '../UI';
import { executeDestructionStrike } from './DestructionSystem';
import * as PIXI from 'pixi.js';
import { Assets } from '../Assets';

let laserGraphics: PIXI.Graphics | null = null;

export function PlayerControlSystem(delta: number) {
  if (!laserGraphics) {
    laserGraphics = new PIXI.Graphics();
    Engine.effectsLayer.addChild(laserGraphics);
  }

  laserGraphics.clear();

  let playerPos: any = null;

  for (const entity of ECS.entities) {
    if (PlayerComponent.has(entity)) {
      playerPos = PositionComponent.get(entity);
      const weapon = WeaponComponent.get(entity);

      if (!playerPos || !weapon) continue;

      // Movement
      const speed = 0.15 * delta;
      let dx = 0;
      let dy = 0;

      if (Input.keys['KeyW'] || Input.keys['ArrowUp']) { dx -= speed; dy -= speed; }
      if (Input.keys['KeyS'] || Input.keys['ArrowDown']) { dx += speed; dy += speed; }
      if (Input.keys['KeyA'] || Input.keys['ArrowLeft']) { dx -= speed; dy += speed; }
      if (Input.keys['KeyD'] || Input.keys['ArrowRight']) { dx += speed; dy -= speed; }

      // Normalize diagonals
      if (dx !== 0 && dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        dx = (dx / len) * speed;
        dy = (dy / len) * speed;
      }

      playerPos.worldX += dx;
      playerPos.worldY += dy;

      // Map limits
      playerPos.worldX = Math.max(0, Math.min(44, playerPos.worldX));
      playerPos.worldY = Math.max(0, Math.min(44, playerPos.worldY));

      // Camera follow with screen shake
      const screenX = Engine.toScreenX(playerPos.worldX, playerPos.worldY);
      const screenY = Engine.toScreenY(playerPos.worldX, playerPos.worldY) - playerPos.worldZ * Engine.TILE_WIDTH;

      let shakeOffsetX = 0;
      let shakeOffsetY = 0;
      if (Engine.shakeDuration > 0) {
        shakeOffsetX = (Math.random() - 0.5) * Engine.shakeIntensity;
        shakeOffsetY = (Math.random() - 0.5) * Engine.shakeIntensity;
        Engine.shakeDuration -= delta;
      }

      Engine.worldContainer.x = Engine.app.screen.width / 2 - screenX + shakeOffsetX;
      Engine.worldContainer.y = Engine.app.screen.height / 2 - screenY + shakeOffsetY;

      // Weapon Cooldown
      if (weapon.heatLevel > 0) {
        weapon.heatLevel -= delta;
      }

      // Laser firing
      if (Input.mouseDown && weapon.heatLevel <= 0) {
        weapon.heatLevel = weapon.fireRate;

        // Draw laser
        const targetScreenX = Input.mouseX;
        const targetScreenY = Input.mouseY;

        laserGraphics.moveTo(screenX, screenY);
        laserGraphics.lineTo(targetScreenX, targetScreenY);
        laserGraphics.stroke({ width: 4, color: 0x00ff00 }); // Neon green

        // Spawn laser tip hit feedback spark
        const spark = new PIXI.AnimatedSprite(Assets.explosion360Frames);
        spark.anchor.set(0.5);
        spark.x = targetScreenX;
        spark.y = targetScreenY;
        spark.scale.set(0.15 + Math.random() * 0.1); // Very small
        spark.rotation = Math.random() * Math.PI * 2; // Random rotation for variety
        spark.loop = false;
        spark.animationSpeed = 0.5; // Fast flash
        spark.onComplete = () => spark.destroy();
        Engine.effectsLayer.addChild(spark);
        spark.play();

        // Determine hit in world coordinates (assuming z = 0 ground plane)
        const rayA = targetScreenX / (Math.cos(Math.PI / 4) * Engine.TILE_WIDTH);
        const rayB = targetScreenY / (Math.sin(Math.PI / 4) * 0.5 * Engine.TILE_WIDTH);

        const targetWorldX = (rayA + rayB) / 2;
        const targetWorldY = (rayB - rayA) / 2;

        // Hit detection against HealthComponent
        for (const target of ECS.entities) {
          if (target === entity) continue;

          if (!TargetComponent.has(target)) continue;

          const targetPos = PositionComponent.get(target);
          const health = HealthComponent.get(target);
          const collision = CollisionComponent.get(target);

          if (targetPos && health && health.currentHP > 0) {
            let isHit = false;

            if (collision) {
              const w = collision.width;
              const l = collision.length;
              const h = collision.height;

              // Raycast check: check if there exists z in [0, h] such that targetWorldX_z=0 + z is in [worldX - 0.5, worldX + w - 0.5]
              // and targetWorldY_z=0 + z is in [worldY - 0.5, worldY + l - 0.5]
              // Add a small padding for easier clicking
              const padding = 0.25;
              const zMinX = targetPos.worldX - 0.5 - padding - targetWorldX;
              const zMaxX = targetPos.worldX + w - 0.5 + padding - targetWorldX;
              const zMinY = targetPos.worldY - 0.5 - padding - targetWorldY;
              const zMaxY = targetPos.worldY + l - 0.5 + padding - targetWorldY;

              const minZ = Math.max(0, zMinX, zMinY);
              const maxZ = Math.min(h, zMaxX, zMaxY);

              isHit = (minZ <= maxZ);
            } else {
              const dist = Math.sqrt(Math.pow(targetPos.worldX - targetWorldX, 2) + Math.pow(targetPos.worldY - targetWorldY, 2));
              isHit = (dist < 1.0);
            }

            if (isHit) {
              const oldHP = health.currentHP;

              // execute strike: coordinates are Input.mouseX/mouseY (the laser hit point)
              executeDestructionStrike(target, 20 * delta, Input.mouseX, Input.mouseY);

              UI.score += 2 * delta;

              if (oldHP > 0 && health.currentHP <= 0) {
                UI.score += 200; // Floor destroyed bonus
              }
            }
          }
        }
      }
    }
  }
}
