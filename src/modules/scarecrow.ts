export class Scarecrow extends Entity {
  constructor() {
    super()
    engine.addEntity(this)
    this.addComponent(new GLTFShape("models/scarecrow.glb"))
    this.addComponent(new Transform())
  }
}