import { Interactive } from "./interactive"

@Component("highlightFlag")
export class HighlightFlag {}

let physicsCast = PhysicsCast.instance

class HighlighterSystem implements ISystem {
  highlightGroup = engine.getComponentGroup(HighlightFlag)
  update(): void {
    // Fixed ray
    const ray: Ray = {
      origin: Vector3.Zero(),
      direction: Vector3.Forward(),
      distance: 1,
    }

    PhysicsCast.instance.hitAll(ray, (e) => {
      if (!e.didHit) {
        for (let highlightEntity of this.highlightGroup.entities as Interactive[]) {
          highlightEntity.setGlow(false)
        }
      }
    })

    // Ray from camera
    const rayFromCamera: Ray = PhysicsCast.instance.getRayFromCamera(4.1) // NOTE: should be 4 but raycasting calc is off slightly
    physicsCast.hitFirst(rayFromCamera, (e) => {
      if (e.entity.meshName == "interactive_collider") {
        let entity = engine.entities[e.entity.entityId] as Interactive
        entity.setGlow(true)
      }
    })
  }
}

engine.addSystem(new HighlighterSystem())
