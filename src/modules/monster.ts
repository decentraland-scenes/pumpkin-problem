import { Sound } from "./sound"
import utils from "../../node_modules/decentraland-ecs-utils/index"
import { monsterMouthOpenMeshVertices, monsterMouthOpenMeshIndices } from "./meshData/monsterMouthOpenMesh"
import { monsterMouthCloseMeshVertices, monsterMouthCloseMeshIndices } from "./meshData/monsterMouthCloseMesh"
import { monsterDyingMeshVertices, monsterDyingMeshIndices } from "./meshData/monsterDyingMesh"
import { monsterMouthInsideMeshVertices, monsterMouthInsideMeshIndices } from "./meshData/monsterMouthInsideMesh"

// Standard monster collider
const monsterCollider = new Entity()
monsterCollider.addComponent(new GLTFShape("models/monsterCollider.glb"))
monsterCollider.addComponent(new Transform({ position: new Vector3(16, 0, 41), rotation: Quaternion.Euler(0, 180, 0) }))
engine.addEntity(monsterCollider)

// Sounds
const monsterChewingSound = new Sound(new AudioClip("sounds/monsterChewing.mp3"), true)
const monsterDyingSound = new Sound(new AudioClip("sounds/monsterDying.mp3"), false)
const monsterIdleSound = new Sound(new AudioClip("sounds/monsterIdle.mp3"), true)
const monsterMouthCloseSound = new Sound(new AudioClip("sounds/monsterMouthClose.mp3"), false)
const monsterMouthOpenSound = new Sound(new AudioClip("sounds/monsterMouthOpen.mp3"), false)

const monsterAudioPos = new Vector3(16, 1, 30)

// Dummy entities for utils delay and interval
const mouthCloseAnimDelayDummy = new Entity()
engine.addEntity(mouthCloseAnimDelayDummy)

const mouthOpenAnimDelayDummy = new Entity()
engine.addEntity(mouthOpenAnimDelayDummy)

const mouthOpenPhysicDelayDummy = new Entity()
engine.addEntity(mouthOpenPhysicDelayDummy)

const monsterRecoverHealthDummy = new Entity()
engine.addEntity(monsterRecoverHealthDummy)

export class Monster extends Entity {
  public world: CANNON.World
  public monsterMouthCloseBody: CANNON.Body
  public monsterMouthOpenBody: CANNON.Body
  public monsterDyingBody: CANNON.Body
  public monsterMouthInsideBody: CANNON.Body

  constructor(transform: Transform, world: CANNON.World) {
    super()
    engine.addEntity(this)
    this.addComponent(new GLTFShape("models/monster.glb"))
    this.addComponent(transform)
    this.world = world

    // Audio
    monsterIdleSound.playAudioAtPosition(monsterAudioPos)

    // Create physics body for monster mouth open
    this.monsterMouthOpenBody = new CANNON.Body({
      mass: 0, // kg
      position: new CANNON.Vec3(32, 0, 0), // m
    })
    let monsterMouthOpenShape = new CANNON.Trimesh(monsterMouthOpenMeshVertices, monsterMouthOpenMeshIndices)
    this.monsterMouthOpenBody.addShape(monsterMouthOpenShape)

    // Create physics body for monster mouth close
    this.monsterMouthCloseBody = new CANNON.Body({
      mass: 0, // kg
      position: new CANNON.Vec3(32, 0, 0), // m
    })
    let monsterMouthCloseShape = new CANNON.Trimesh(monsterMouthCloseMeshVertices, monsterMouthCloseMeshIndices)
    this.monsterMouthCloseBody.addShape(monsterMouthCloseShape)
    world.addBody(this.monsterMouthCloseBody)

    // Create physics body for monster dying
    this.monsterDyingBody = new CANNON.Body({
      mass: 0, // kg
      position: new CANNON.Vec3(32, 0, 0), // m
    })
    let monsterDyingShape = new CANNON.Trimesh(monsterDyingMeshVertices, monsterDyingMeshIndices)
    this.monsterDyingBody.addShape(monsterDyingShape)

    // Create physics body for monster mouth inside
    this.monsterMouthInsideBody = new CANNON.Body({
      mass: -1, // kg
      position: new CANNON.Vec3(32, 0, 0), // m
    })
    let monsterMouthInsideShape = new CANNON.Trimesh(monsterMouthInsideMeshVertices, monsterMouthInsideMeshIndices)
    this.monsterMouthInsideBody.addShape(monsterMouthInsideShape)

    // Animation
    this.addComponent(new Animator())
    this.getComponent(Animator).addClip(new AnimationState("Chewing", { looping: true }))
    this.getComponent(Animator).addClip(new AnimationState("Dying", { looping: false }))
    this.getComponent(Animator).addClip(new AnimationState("Idle_BlinkEyes", { looping: true }))
    this.getComponent(Animator).addClip(new AnimationState("Idle_Breath", { looping: true }))
    this.getComponent(Animator).addClip(new AnimationState("Idle_HandL", { looping: true }))
    this.getComponent(Animator).addClip(new AnimationState("Idle_HandR", { looping: true }))
    this.getComponent(Animator).addClip(new AnimationState("Idle_Head", { looping: true }))
    this.getComponent(Animator).addClip(new AnimationState("OpenMouth", { looping: false }))
    this.getComponent(Animator).addClip(new AnimationState("OpenMouth_Close", { looping: false }))
    this.getComponent(Animator).addClip(new AnimationState("OpenMouth_Loop", { looping: false }))
    this.getComponent(Animator).getClip("Idle_BlinkEyes").play()
  }

  playIdleAnim() {
    this.stopAnimations()
    this.stopAudio()
    monsterIdleSound.playAudioAtPosition(monsterAudioPos)
    monsterIdleSound.getComponent(AudioSource).playing = true
    // this.getComponent(Animator).getClip("Idle_Breath").play()
  }

  playChewingAnim() {
    this.stopAnimations()

    this.stopAudio()
    monsterChewingSound.playAudioAtPosition(monsterAudioPos)
    // monsterChewingSound.getComponent(AudioSource).playing = true
    this.getComponent(Animator).getClip("Chewing").play()

    // Randomise chewing time
    let randomChewTime = Math.floor(Math.random() * 3500) + 4000

    // Reduce health
    monstersHealth -= 10
    setMonsterHealth(monstersHealth, this)

    mouthOpenAnimDelayDummy.addComponentOrReplace(
      new utils.Delay(randomChewTime, () => {
        this.playOpenMouthAnim()
      })
    )
  }

  playDyingAnim() {
    this.stopAnimations()

    this.world.remove(this.monsterMouthCloseBody)
    this.world.remove(this.monsterMouthOpenBody)
    this.world.remove(this.monsterMouthInsideBody)
    this.world.addBody(this.monsterDyingBody)

    this.stopAudio()
    monsterDyingSound.playAudioOnceAtPosition(monsterAudioPos)
    this.getComponent(Animator).getClip("Dying").play()

    // Remove dummy entities
    engine.removeEntity(mouthCloseAnimDelayDummy)
    engine.removeEntity(mouthOpenAnimDelayDummy)
  }

  playOpenMouthAnim() {
    this.stopAnimations()

    mouthOpenPhysicDelayDummy.addComponentOrReplace(
      new utils.Delay(830, () => {
        this.world.remove(this.monsterMouthCloseBody)
        this.world.addBody(this.monsterMouthOpenBody)
        this.world.addBody(this.monsterMouthInsideBody)
      })
    )

    this.stopAudio()
    monsterMouthOpenSound.playAudioOnceAtPosition(monsterAudioPos)
    this.getComponent(Animator).getClip("OpenMouth").play()
  }

  playCloseMouthAnim() {
    this.stopAnimations()

    this.world.remove(this.monsterMouthOpenBody)
    this.world.remove(this.monsterMouthInsideBody)
    this.world.addBody(this.monsterMouthCloseBody)

    this.stopAudio()
    monsterMouthCloseSound.playAudioOnceAtPosition(monsterAudioPos)
    this.getComponent(Animator).getClip("OpenMouth_Close").play()

    mouthCloseAnimDelayDummy.addComponentOrReplace(
      new utils.Delay(233, () => {
        this.playChewingAnim()
      })
    )
  }

  // Bug workaround: otherwise the next animation clip won't play
  stopAnimations() {
    this.getComponent(Animator).getClip("Chewing").stop()
    this.getComponent(Animator).getClip("Dying").stop()
    this.getComponent(Animator).getClip("Idle_BlinkEyes").stop()
    this.getComponent(Animator).getClip("Idle_Breath").stop()
    this.getComponent(Animator).getClip("Idle_HandL").stop()
    this.getComponent(Animator).getClip("Idle_HandR").stop()
    this.getComponent(Animator).getClip("Idle_Head").stop()
    this.getComponent(Animator).getClip("OpenMouth").stop()
    this.getComponent(Animator).getClip("OpenMouth_Close").stop()
    this.getComponent(Animator).getClip("OpenMouth_Loop").stop()
  }

  stopAudio() {
    monsterChewingSound.getComponent(AudioSource).playing = false
    monsterIdleSound.getComponent(AudioSource).playing = false
    monsterIdleSound.getComponent(AudioSource).playing = false
  }
}

// Monster's health ui
const canvas = new UICanvas()

let monsterHealthContainer = new UIContainerRect(canvas)
monsterHealthContainer.visible = false
monsterHealthContainer.height = "5%"
monsterHealthContainer.hAlign = "center"
monsterHealthContainer.vAlign = "top"
monsterHealthContainer.width = "20%"
monsterHealthContainer.color = Color4.White()

let monsterHealthBarBG = new UIContainerRect(monsterHealthContainer)
monsterHealthBarBG.visible = true
monsterHealthBarBG.height = "85%"
monsterHealthBarBG.hAlign = "left"
monsterHealthBarBG.vAlign = "center"
monsterHealthBarBG.positionX = "1%"
monsterHealthBarBG.width = "98%"
monsterHealthBarBG.color = Color4.FromHexString(`#d5d7daff`)

let monsterHealthBar = new UIContainerRect(monsterHealthContainer)
monsterHealthBar.visible = true
monsterHealthBar.height = "85%"
monsterHealthBar.hAlign = "left"
monsterHealthBar.vAlign = "center"
monsterHealthBar.positionX = "1%"
monsterHealthBar.width = "98%"
monsterHealthBar.color = Color4.FromHexString(`#22eeffff`)

// Monster's health
let monstersHealth = 100
let monsterHealthIcon = new Texture("images/monsterHealthIcon.png")
let monsterHealthTextImage = new UIImage(monsterHealthContainer, monsterHealthIcon)
monsterHealthTextImage.sourceWidth = 240
monsterHealthTextImage.sourceHeight = 23
monsterHealthTextImage.width = 180
monsterHealthTextImage.height = 18

export function showMonsterHealthUI(_visible: boolean) {
  monsterHealthContainer.visible = _visible
}
export function setMonsterHealth(_hp: number, monster?: Monster) {
  if (_hp > 0 && _hp < 100) {
    monsterHealthBar.width = Math.floor(_hp).toString() + "%"
  } else if (_hp <= 0) {
    monster.playDyingAnim()
    monsterHealthBar.width = "0%"
  }
}

showMonsterHealthUI(true)

monsterRecoverHealthDummy.addComponent(
  new utils.Interval(1000, () => {
    if (monstersHealth <= 0 || monstersHealth >= 98) return
    monstersHealth += 0.2
    setMonsterHealth(monstersHealth)
  })
)
