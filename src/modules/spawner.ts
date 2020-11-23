import utils from "../../node_modules/decentraland-ecs-utils/index"
import { Pumpkin } from "./pumpkin"
import { HighlightFlag } from "./highlighter"
import { Interactive } from "./interactive"

const SEED = 16000
const TIME_OFFSET = 8000
const Y_OFFSET = 0.6

const pumpkinShape = new GLTFShape("models/pumpkin.glb") 

export class Spawner extends Entity implements Interactive {

  private glowEntity = new Entity()

  constructor(pumpkin: Pumpkin, public minX: number, public maxX: number, public minZ: number, public maxZ: number) {
    super()
    engine.addEntity(this)
    this.addComponent(pumpkinShape)

    let randomPos = this.updateSpawnPosition()
    this.addComponent(new Transform({ position: randomPos }))
    this.getComponent(Transform).rotate(Vector3.Up(), Math.random() * 360)

    // Setup glow
    this.addComponent(new HighlightFlag())
    this.glowEntity.addComponent(new GLTFShape("models/pumpkinGlow.glb"))
    this.glowEntity.addComponent(new Transform())
    this.glowEntity.getComponent(Transform).scale.setAll(0)
    this.glowEntity.setParent(this)

    this.addComponent(new Animator())
    this.getComponent(Animator).addClip(new AnimationState("Spawning", { looping: false }))
    this.getComponent(Animator).getClip("Spawning").play()
    this.addComponent(
      new OnPointerDown(
        () => {
          pumpkin.playerPickup()
          this.getComponent(Transform).position.y = -5
          let randomSpawnTime = this.updateRespawnTime()
          this.addComponentOrReplace(
            new utils.Delay(randomSpawnTime, () => {
              this.getComponent(Transform).position.y = 0
              randomPos = this.updateSpawnPosition()
              this.getComponent(Transform).position = randomPos
              this.getComponent(Transform).rotate(Vector3.Up(), Math.random() * 360)
              this.playSpawnAnim()
            })
          )
        },
        { hoverText: "Pick up", distance: 4, button: ActionButton.PRIMARY }
      )
    )
  }

  updateRespawnTime(): number {
    return Math.random() * SEED + TIME_OFFSET
  }

  updateSpawnPosition(): Vector3 {
    return new Vector3(Math.random() * (this.maxX - this.minX) + this.minX, Y_OFFSET, Math.random() * (this.maxZ - this.minZ) + this.minZ)
  }

  playSpawnAnim() {
    this.getComponent(GLTFShape).visible = true
    this.getComponent(Animator).getClip("Spawning").stop() // Bug workaround
    this.getComponent(Animator).getClip("Spawning").play()
  }

  setGlow(isOn: boolean): void {
    isOn ? this.glowEntity.getComponent(Transform).scale.setAll(1) : this.glowEntity.getComponent(Transform).scale.setAll(0) 
  }
}
