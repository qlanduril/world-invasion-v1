import './style.css';
import { Engine } from './Engine';
import { ECS } from './ECS';
import { Input } from './Input';
import { UI } from './UI';
import { ParticleSystem } from './Systems/ParticleSystem';
import { RenderSystem } from './Systems/RenderSystem';
import { DestructionSystem } from './Systems/DestructionSystem';
import { PlayerControlSystem } from './Systems/PlayerControlSystem';
import { PositionComponent, RenderComponent, CollisionComponent, WeaponComponent, PlayerComponent, HealthComponent, TargetComponent } from './Components';
import { Assets } from './Assets';
import * as PIXI from 'pixi.js';
import mapData from './assets/map_data.json';

async function initGame() {
  const appElement = document.getElementById('app');
  if (!appElement) return;

  const canvas = document.createElement('canvas');
  appElement.appendChild(canvas);

  await Engine.init(canvas);
  await Assets.initAssets();
  Input.init();
  UI.init();
  ParticleSystem.init();

  ECS.systems.push(PlayerControlSystem);
  ECS.systems.push(DestructionSystem);
  ECS.systems.push(RenderSystem); // Render last

  generateCity(45, 45, mapData);
  createPlayer();

  Engine.app.ticker.add((ticker) => {
    // ticker.deltaTime is in 60hz frames roughly, meaning 1 at 60fps
    ECS.tick(ticker.deltaTime);
    ParticleSystem.update(ticker.deltaTime);
    UI.update();
  });
}

interface BuildingDef {
  width: number;
  length: number;
  height: number;
  name: string;
}

const BUILDING_DEFS: Record<string, BuildingDef> = {
  '1': { width: 2, length: 2, height: 2, name: 'Hospital' },
  '2': { width: 4, length: 4, height: 1, name: 'Mall' },
  '3': { width: 3, length: 2, height: 1, name: 'School' },
  '4': { width: 4, length: 2, height: 1, name: 'Warehouse' }
};

export interface CityTileData {
  ratioX: number;
  ratioY: number;
  zone: string;
  size: string;
}

function generateCity(width: number, height: number, mapData?: CityTileData[]) {
  // We use a flat top-down texture and apply the isometric projection to it
  const groundContainer = new PIXI.Container();
  // Align container origin with grid origin
  groundContainer.x = 0;
  groundContainer.y = 0;

  // Make the background exactly the size of the city grid, instead of infinite
  const tilingSprite = new PIXI.TilingSprite({
    texture: Assets.textures['city_background_topdown_red'],
    width: width * Engine.TILE_WIDTH,
    height: height * Engine.TILE_WIDTH
  });
  tilingSprite.anchor.set(0);
  
  // Transform it to match isometric view (rotate 45 degrees)
  tilingSprite.rotation = Math.PI / 4;
  
  // Set tiling scale to perfectly map the 1008px image to exactly 15x15 grid tiles (15 * 64 = 960)
  const TILE_SCALE = 960 / 1008;
  tilingSprite.tileScale.set(TILE_SCALE); 
  
  // Shift the sprite back to 0,0. 
  // Because it's rotated by 45 degrees from 0,0, its bounding box naturally covers the entire positive Y half-plane and symmetric X plane!
  tilingSprite.x = 0;
  tilingSprite.y = 0;

  groundContainer.addChild(tilingSprite);
  // Squash the container to complete the isometric projection
  groundContainer.scale.y = 0.5;

  Engine.backgroundLayer.addChild(groundContainer);

  // Initialize occupancy grid to prevent overlapping buildings
  const occupied = Array.from({ length: width }, () => new Array(height).fill(false));

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      // Create ground tile
      const ground = new PIXI.Graphics();
      // Draw a simple diamond for isometric tile
      ground.moveTo(0, -Engine.TILE_WIDTH * 0.5);
      ground.lineTo(Engine.TILE_WIDTH * 0.866, 0);
      ground.lineTo(0, Engine.TILE_WIDTH * 0.5);
      ground.lineTo(-Engine.TILE_WIDTH * 0.866, 0);
      ground.closePath();
      
      // Make the tiles completely transparent since we have a textured ground now
      ground.fill({ color: 0x000000, alpha: 0.0 });
      ground.stroke({ color: 0x000000, width: 1, alpha: 0.0 });
      
      const screenX = Engine.toScreenX(x, y);
      const screenY = Engine.toScreenY(x, y);
      ground.x = screenX;
      ground.y = screenY;
      Engine.cityLayer.addChild(ground);
    }
  }

  const spawnBuilding = (gridX: number, gridY: number, visualX: number, visualY: number, type: string) => {
    const def = BUILDING_DEFS[type];
    if (!def) return;

    // Check boundary limits using integer grid
    if (gridX < 0 || gridY < 0 || gridX + def.width > width || gridY + def.length > height) return;

    // Check if any covered grid cell is occupied
    let canPlace = true;
    for (let dx = 0; dx < def.width; dx++) {
      for (let dy = 0; dy < def.length; dy++) {
        if (occupied[gridX + dx][gridY + dy]) {
          canPlace = false;
          break;
        }
      }
      if (!canPlace) break;
    }

    if (canPlace) {
      // Mark all covered cells as occupied
      for (let dx = 0; dx < def.width; dx++) {
        for (let dy = 0; dy < def.length; dy++) {
          occupied[gridX + dx][gridY + dy] = true;
        }
      }

      // Spawn the building entity using exact visual float coordinates!
      const entity = ECS.createEntity();
      PositionComponent.set(entity, { worldX: visualX, worldY: visualY, worldZ: 0 });
      CollisionComponent.set(entity, { 
        width: def.width, 
        length: def.length, 
        height: def.height, 
        active: true 
      });
      HealthComponent.set(entity, { currentHP: 100, maxHP: 100, state: 0 });
      TargetComponent.set(entity, { isHighValue: true });

      let prefix = `building_${type}_stage_`;
      if (type === '1') {
        const orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
        prefix = `building_1_${orientation}_stage_`;
      }
      const bSprite = new PIXI.Sprite(Assets.textures[`${prefix}0`]);
      
      if (bSprite.texture.defaultAnchor) {
        bSprite.anchor.copyFrom(bSprite.texture.defaultAnchor);
      } else {
        bSprite.anchor.set(0.5, 1.0);
      }

      // Adjust scale factor according to the footprint size.
      // BUILDING_SCALE_FACTOR is set to 2.55 to make them a bit bigger as requested.
      const BUILDING_SCALE_FACTOR = 2.55;
      const footprintScale = (def.width + def.length) / 2;
      const scaleFactor = (Engine.TILE_WIDTH * BUILDING_SCALE_FACTOR * footprintScale) / bSprite.texture.width;
      bSprite.scale.set(scaleFactor);
      
      Engine.cityLayer.addChild(bSprite);
      RenderComponent.set(entity, { 
        sprite: bSprite, 
        anchorX: bSprite.anchor.x, 
        anchorY: bSprite.anchor.y,
        texturePrefix: prefix
      });
    }
  };

  if (mapData) {
    // 2. Loop through the structural layout JSON array across the entire city chunk by chunk
    const chunkWidth = 15;
    const chunkHeight = 15;

    for (let cx = 0; cx < width; cx += chunkWidth) {
      for (let cy = 0; cy < height; cy += chunkHeight) {
        for (const node of mapData) {
          let typeId = '3'; // Default to school
          if (node.zone === 'hospital') typeId = '1';
          else if (node.zone === 'school') typeId = '3';
          
          // 1. Calculate the real un-rotated coordinate within the 15x15 chunk
          // Since Engine projection now perfectly matches the background projection,
          // the world coordinate is simply the ratio mapped to the 15 tile grid!
          const localWorldX = node.ratioX * 15;
          const localWorldY = node.ratioY * 15;
          
          // Determine footprint to offset the spawn from the definition dynamically
          const def = BUILDING_DEFS[typeId];
          const bw = def ? def.width : 1;
          const bl = def ? def.length : 1;
          
          const visualX = localWorldX - bw / 2;
          const visualY = localWorldY - bl / 2;
          
          const finalTileX = Math.round(localWorldX - bw / 2);
          const finalTileY = Math.round(localWorldY - bl / 2);

          spawnBuilding(cx + finalTileX, cy + finalTileY, cx + visualX, cy + visualY, typeId);
        }
      }
    }
  } else {
    // Iterate and attempt to spawn buildings in a non-overlapping manner (random generation)
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (occupied[x][y]) continue;
        
        // Spawning chance
        if (Math.random() < 0.4) {
          const types = ['3', '1'];
          const type = types[Math.floor(Math.random() * types.length)];
          spawnBuilding(x, y, x, y, type);
        }
      }
    }
  }
}

function createPlayer() {
  const entity = ECS.createEntity();
  PositionComponent.set(entity, { worldX: 7.5, worldY: 7.5, worldZ: 4 });
  WeaponComponent.set(entity, { currentSelected: 1, heatLevel: 0, fireRate: 15 });
  PlayerComponent.set(entity, {});

  const pGraphics = new PIXI.Graphics();
  // Simple UFO shape
  pGraphics.ellipse(0, 0, 40, 15);
  pGraphics.fill({ color: 0x00ffff }); // Cyan body
  pGraphics.ellipse(0, -5, 20, 10);
  pGraphics.fill({ color: 0xaaffff, alpha: 0.8 }); // Glass dome

  Engine.playerLayer.addChild(pGraphics);
  RenderComponent.set(entity, { sprite: pGraphics, anchorX: 0.5, anchorY: 0.5 });
}

initGame();
