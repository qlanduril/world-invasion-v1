import { ECS } from '../ECS';
import { PositionComponent, RenderComponent, CollisionComponent } from '../Components';
import { Engine } from '../Engine';

export function RenderSystem(_delta: number) {
  for (const entity of ECS.entities) {
    const pos = PositionComponent.get(entity);
    const render = RenderComponent.get(entity);

    if (pos && render) {
      const collision = CollisionComponent.get(entity);

      if (collision) {
        const w = collision.width;
        const l = collision.length;

        // Dynamic visual shift proportional to footprint size (width and length)
        // to scale with the building's size and image scale.
        const shiftX = w * 0.3;
        const shiftY = l * 0.2;
        const screenX = Engine.toScreenX(pos.worldX + w + shiftX, pos.worldY + l + shiftY);
        const screenY = Engine.toScreenY(pos.worldX + w + shiftX, pos.worldY + l + shiftY);

        render.sprite.x = screenX;
        render.sprite.y = screenY - pos.worldZ * Engine.TILE_WIDTH;

        // Depth sorting using the furthest forward coordinate of the footprint
        render.sprite.zIndex = (pos.worldX + w) + (pos.worldY + l) + (pos.worldZ * 0.1);
      } else {
        const screenX = Engine.toScreenX(pos.worldX, pos.worldY);
        const screenY = Engine.toScreenY(pos.worldX, pos.worldY);

        render.sprite.x = screenX;
        render.sprite.y = screenY - pos.worldZ * Engine.TILE_WIDTH;

        // Depth sorting based on isometric position
        render.sprite.zIndex = pos.worldX + pos.worldY + (pos.worldZ * 0.1);
      }
    }
  }
}
