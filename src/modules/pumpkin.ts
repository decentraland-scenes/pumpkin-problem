import { Sound } from "./sound"
import { HighlightFlag } from "./highlighter"
import { Interactive } from "./interactive"
import utils from "../../node_modules/decentraland-ecs-utils/index"
import { Monster } from "./monster"

const pumpkinHitGroundSound01 = new Sound(new AudioClip("sounds/pumpkinHitGround01.mp3"), false)
const pumpkinHitGroundSound02 = new Sound(new AudioClip("sounds/pumpkinHitGround02.mp3"), false)
const pumpkinHitGroundSound03 = new Sound(new AudioClip("sounds/pumpkinHitGround03.mp3"), false)
const pumpkinHitSounds: Sound[] = [pumpkinHitGroundSound01, pumpkinHitGroundSound02, pumpkinHitGroundSound03]

const pumpkinSplatSound = new Sound(new AudioClip("sounds/pumpkinSplat.mp3"), false)
const pumpkinPickUpSound = new Sound(new AudioClip("sounds/pumpkinPickUp.mp3"), false)
const pumpkinThrowSound = new Sound(new AudioClip("sounds/pumpkinThrow.mp3"), false)

const FIXED_TIME_STEPS = 1.0 / 60.0 // seconds
const MAX_TIME_STEPS = 3
const PUMPKIN_SMASH_LIMIT = 80
const THROW_STRENGTH_MULTIPLIER = 0.8
let hasGameStarted = false

export class Pumpkin extends Entity implements Interactive {
  public isThrown: boolean = true
  public body: CANNON.Body
  public world: CANNON.World
  public glowEntity = new Entity()
  public monster: Monster
  private throwPower: number
  private pumpkinSmash = new Entity()

  constructor(transform: Transform, world: CANNON.World, monster: Monster) {
    super()
    engine.addEntity(this)
    this.addComponent(new GLTFShape("models/pumpkin.glb"))
    this.addComponent(transform)
    this.world = world
    this.monster = monster
    this.toggleOnPointerDown(true)

    // Setup glow
    this.addComponent(new HighlightFlag())
    this.glowEntity.addComponent(new GLTFShape("models/pumpkinGlow.glb"))
    this.glowEntity.addComponent(new Transform())
    this.glowEntity.getComponent(Transform).scale.setAll(0)
    this.glowEntity.setParent(this)

    // Create physics body for pumpkin
    this.body = new CANNON.Body({
      mass: 3, // kg
      position: new CANNON.Vec3(transform.position.x, transform.position.y, transform.position.z), // m
      shape: new CANNON.Sphere(0.475), // Create sphere shaped body with a diameter of 0.95m
    })
    // Bug workaround: physics ball body starts of at the base coordinates
    this.body.position.set(Camera.instance.position.x, Camera.instance.position.y, Camera.instance.position.z)

    // Create physics material for the pumpkin
    const pumpkinMaterial: CANNON.Material = new CANNON.Material("pumpkinMaterial")

    // Add material and dampening to stop the ball rotating and moving continuously
    this.body.material = pumpkinMaterial
    this.body.linearDamping = 0.4
    this.body.angularDamping = 0.4
    world.addBody(this.body) // Add pumpkin body to the world

    // Pumpkin smashes on impact if the velocity is great enough

    this.body.addEventListener("collide", (e) => {
      log("Body ID: ", e.body.id) // ID seems to be inconsistent so using mass instead
      log("Body Mass: ", e.body.mass)
      let randomAudioTrackNo = Math.floor(Math.random() * 2)
      pumpkinHitSounds[randomAudioTrackNo].playAudioOnceAtPosition(this.getComponent(Transform).position)
      if (this.throwPower > PUMPKIN_SMASH_LIMIT) {
        this.smashPumpkin()
      }

      // When pumpkin hits the inside of the mouth
      if (e.body.mass == -1) {
        monster.playCloseMouthAnim()
        this.smashPumpkin()
      }
    })

    this.addComponent(new Animator())
    this.getComponent(Animator).addClip(new AnimationState("Spawning", { looping: false }))
    this.getComponent(Animator).addClip(new AnimationState("Eaten", { looping: false }))

    this.pumpkinSmash.addComponent(new GLTFShape("models/pumpkinSmash.glb"))
    this.pumpkinSmash.addComponent(new Transform())
    this.pumpkinSmash.getComponent(Transform).scale.setAll(0)
    this.pumpkinSmash.addComponent(new Animator())
    this.pumpkinSmash.getComponent(Animator).addClip(new AnimationState("Smashing", { looping: false }))
    this.pumpkinSmash.setParent(this)
  }

  private smashPumpkin(): void {
    pumpkinSplatSound.playAudioOnceAtPosition(this.getComponent(Transform).position)
    this.glowEntity.getComponent(GLTFShape).visible = false // If the pumpkin is going to be smashed then no glow is needed
    this.playSmashAnim()
    this.body.sleep()

    // Move the physic body away to a place where it's not affecting anything
    this.addComponentOrReplace(
      new utils.Delay(500, () => {
        this.body.position.set(16, 24, 38)
      })
    )
  }

  playerPickup(): void {
    pumpkinPickUpSound.getComponent(AudioSource).playOnce()
    this.body.sleep()
    this.isThrown = false
    this.setParent(Attachable.FIRST_PERSON_CAMERA)
    this.getComponent(Transform).position.set(0, -0.65, 1)
    this.playSpawnAnim()
    this.toggleOnPointerDown(false)

    // Start game when the player first picks up the pumpkin
    if (!hasGameStarted) {
      this.monster.addComponentOrReplace(
        new utils.Delay(3000, () => {
          this.monster.playOpenMouthAnim()
          hasGameStarted = true
        })
      )
    }

    // FIX: Issue with highlight glow showing when it's not supposed to
    this.glowEntity.getComponent(GLTFShape).visible = false
  }

  playerThrow(throwDirection: Vector3, throwPower: number): void {
    pumpkinThrowSound.getComponent(AudioSource).playOnce()

    this.isThrown = true
    this.throwPower = throwPower
    this.setParent(null)
    this.toggleOnPointerDown(true)
    engine.addSystem(new ThrowPumpkinSystem(this))

    // Physics
    this.body.wakeUp()
    this.body.velocity.setZero()
    this.body.angularVelocity.setZero()

    this.body.position.set(
      Camera.instance.feetPosition.x + throwDirection.x,
      throwDirection.y + Camera.instance.position.y,
      Camera.instance.feetPosition.z + throwDirection.z
    )

    let throwPowerAdjusted = throwPower * THROW_STRENGTH_MULTIPLIER

    // Throw
    this.body.applyImpulse(
      new CANNON.Vec3(throwDirection.x * throwPowerAdjusted, throwDirection.y * throwPowerAdjusted, throwDirection.z * throwPowerAdjusted),
      new CANNON.Vec3(this.body.position.x, this.body.position.y, this.body.position.z)
    )
  }

  toggleOnPointerDown(isOn: boolean): void {
    if (isOn) {
      this.addComponentOrReplace(
        new OnPointerDown(
          () => {
            this.playerPickup()
          },
          { hoverText: "Pick up", distance: 4, button: ActionButton.PRIMARY }
        )
      )
    } else {
      if (this.hasComponent(OnPointerDown)) this.removeComponent(OnPointerDown)
    }
  }

  playSpawnAnim() {
    this.stopAnimations()
    this.getComponent(GLTFShape).visible = true
    this.getComponent(Animator).getClip("Spawning").play()
    this.pumpkinSmash.getComponent(Transform).scale.setAll(0)
  }

  playEatenAnim() {
    this.stopAnimations()
    this.getComponent(GLTFShape).visible = true
    this.getComponent(Animator).getClip("Eaten").play()
    this.pumpkinSmash.getComponent(Transform).scale.setAll(0)
  }

  playSmashAnim() {
    this.stopAnimations()
    this.getComponent(GLTFShape).visible = false
    this.pumpkinSmash.getComponent(Transform).scale.setAll(1)
    this.pumpkinSmash.getComponent(Animator).getClip("Smashing").play()
  }

  // Bug workaround: otherwise the next animation clip won't play
  stopAnimations() {
    this.getComponent(Animator).getClip("Spawning").stop()
    this.getComponent(Animator).getClip("Eaten").stop()
    this.pumpkinSmash.getComponent(Animator).getClip("Smashing").stop()
  }

  setGlow(isOn: boolean): void {
    isOn ? this.glowEntity.getComponent(Transform).scale.setAll(1) : this.glowEntity.getComponent(Transform).scale.setAll(0)
  }
}

class ThrowPumpkinSystem implements ISystem {
  pumpkin: Pumpkin
  constructor(pumpkin: Pumpkin) {
    this.pumpkin = pumpkin
  }
  update(dt: number): void {
    if (this.pumpkin.isThrown) {
      this.pumpkin.world.step(FIXED_TIME_STEPS, dt, MAX_TIME_STEPS)
      this.pumpkin.getComponent(Transform).position.copyFrom(this.pumpkin.body.position)
      this.pumpkin.getComponent(Transform).rotation.copyFrom(this.pumpkin.body.quaternion)

      // Turn glow back on when it's velocity is almost zero and not sleeping
      if (this.pumpkin.body.velocity.almostEquals(new CANNON.Vec3(0, 0, 0), 2) && this.pumpkin.body.sleepState !== CANNON.Body.SLEEPING) {
        this.pumpkin.glowEntity.getComponent(GLTFShape).visible = true
      }
    } else {
      engine.removeSystem(this)
    }
  }
}
