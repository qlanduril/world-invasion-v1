export type Entity = number;

export class ECS {
  private static nextEntityId = 1;
  public static entities: Set<Entity> = new Set();
  public static systems: ((delta: number) => void)[] = [];

  public static createEntity(): Entity {
    const entity = this.nextEntityId++;
    this.entities.add(entity);
    return entity;
  }

  public static destroyEntity(entity: Entity) {
    this.entities.delete(entity);
  }

  public static tick(delta: number) {
    for (const system of this.systems) {
      system(delta);
    }
  }
}

