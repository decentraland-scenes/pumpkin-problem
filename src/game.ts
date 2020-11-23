import { Pumpkin } from "./modules/pumpkin"
import { farmMeshVertices, farmMeshIndices } from "./modules/meshData/farmMesh"
import * as ui from "../node_modules/@dcl/ui-utils/index"
import { BarStyles } from "../node_modules/@dcl/ui-utils/utils/types"
import { Spawner } from "./modules/spawner"
import { Scarecrow } from "./modules/scarecrow"
import { Sound } from "./modules/sound"
import { Monster } from "./modules/monster"

// Add music
const musicSound = new Sound(new AudioClip("sounds/music.mp3"), true, new Vector3(16, 16, 24))
musicSound.getComponent(AudioSource).loop = true
musicSound.getComponent(AudioSource).playing = true

// Create farm
const farm = new Entity()
farm.addComponent(new GLTFShape("models/farm.glb"))
engine.addEntity(farm)

// Create scarecrow
const scarecrow = new Scarecrow()

// Setup our world
const world = new CANNON.World()
world.quatNormalizeSkip = 0
world.quatNormalizeFast = false
world.gravity.set(0, -9.82, 0) // m/s²

// Monster
export const monster = new Monster(new Transform({ position: new Vector3(16, 0, 41), rotation: Quaternion.Euler(0, 180, 0) }), world)

// Create pumpkin hero
const pumpkinHero = new Pumpkin(new Transform({ position: new Vector3(0, -0.65, 1) }), world, monster)

// Pumpkin spawner
const pumpkinSpawnA = new Spawner(pumpkinHero, 3.5, 10.5, 6.5, 16)
const pumpkinSpawnB = new Spawner(pumpkinHero, 3.5, 10.5, 16.5, 26.5)
const pumpkinSpawnC = new Spawner(pumpkinHero, 21.5, 28.5, 6.5, 16)
const pumpkinSpawnD = new Spawner(pumpkinHero, 21.5, 28.5, 16.5, 26.5)

// Setup ground material
const groundMaterial = new CANNON.Material("groundMaterial")
const ballContactMaterial = new CANNON.ContactMaterial(groundMaterial, pumpkinHero.body.material, { friction: 0.25, restitution: 0.33 })
world.addContactMaterial(ballContactMaterial)

// Farm trimesh
let farmShape = new CANNON.Trimesh(farmMeshVertices, farmMeshIndices)
const farmBody = new CANNON.Body({
  mass: 0,
  position: new CANNON.Vec3(32, 0, 0),
})
farmBody.addShape(farmShape)
farmBody.material = groundMaterial
world.addBody(farmBody)

// Create a ground plane and apply physics material
const groundShape: CANNON.Plane = new CANNON.Plane()
const groundBody: CANNON.Body = new CANNON.Body({ mass: 0 })
groundBody.addShape(groundShape)
groundBody.material = groundMaterial
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2) // Reorient ground plane to be in the y-axis
world.addBody(groundBody) // Add ground body to world

// Controls and UI
let throwPower = 0
let powerBar = new ui.UIBar(0, -80, 80, Color4.Yellow(), BarStyles.ROUNDWHITE)
let powerIcon = new ui.SmallIcon("images/powerIcon.png", -101, 85, 90, 23)
let isPowerUp = true
const POWER_UP_SPEED = 150

class PowerMeterSystem implements ISystem {
  update(dt: number): void {
    if (throwPower < 1) {
      isPowerUp = true
    } else if (throwPower > 99) {
      isPowerUp = false
    }

    if (throwPower > 0 || throwPower < 99) {
      isPowerUp ? (throwPower += dt * POWER_UP_SPEED * 1.1) : (throwPower -= dt * POWER_UP_SPEED) // Powering up is 10% faster
      powerBar.set(throwPower / 100)
      throwPower > 80 ? (powerBar.bar.color = Color4.Red()) : (powerBar.bar.color = Color4.Yellow())
    }
  }
}

let powerMeterSys: PowerMeterSystem

// Controls
Input.instance.subscribe("BUTTON_DOWN", ActionButton.POINTER, false, (e) => {
  if (!pumpkinHero.isThrown) {
    powerBar.bar.visible = true
    powerBar.background.visible = true
    throwPower = 1
    powerMeterSys = new PowerMeterSystem()
    engine.addSystem(powerMeterSys)
  }
})

Input.instance.subscribe("BUTTON_UP", ActionButton.POINTER, false, (e) => {
  if (!pumpkinHero.isThrown) {
    // Strength system
    engine.removeSystem(powerMeterSys)
    powerBar.set(0)

    let throwDirection = Vector3.Forward().rotate(Camera.instance.rotation) // Camera's forward vector
    pumpkinHero.playerThrow(throwDirection, throwPower)
  }
})
