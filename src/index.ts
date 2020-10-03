/* CSCI 5619 Lecture 8, Fall 2020
 * Author: Evan Suma Rosenberg
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */ 

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight" 
import { AssetsManager } from "@babylonjs/core/Misc/assetsManager"
import { PointerEventTypes, PointerInfo } from "@babylonjs/core/Events/pointerEvents";
import { WebXRControllerComponent } from "@babylonjs/core/XR/motionController/webXRControllerComponent";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { Logger } from "@babylonjs/core";

// Side effects
import "@babylonjs/loaders/glTF/2.0/glTFLoader"
import "@babylonjs/core/Helpers/sceneHelpers";
//import "@babylonjs/core/XR/webXRInput"

// Import debug layer
import "@babylonjs/inspector"

// Note: The structure has changed since previous assignments because we need to handle the 
// async methods used for setting up XR. In particular, "createDefaultXRExperienceAsync" 
// needs to load models and create various things.  So, the function returns a promise, 
// which allows you to do other things while it runs.  Because we don't want to continue
// executing until it finishes, we use "await" to wait for the promise to finish. However,
// await can only run inside async functions. https://javascript.info/async-await
class Game 
{ 
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;
    private leftController: WebXRInputSource | null;
    private rightController: WebXRInputSource | null;
    private xrCamera: WebXRCamera | null; 

    constructor()
    {
        // Get the canvas element 
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // Generate the BABYLON 3D engine
        this.engine = new Engine(this.canvas, true); 

        // Creates a basic Babylon Scene object
        this.scene = new Scene(this.engine);   

        this.leftController = null;
        this.rightController = null;
        this.xrCamera = null;
    }

    start() : void 
    {
        // Create the scene and then execute this function afterwards
        this.createScene().then(() => {

            // Register a render loop to repeatedly render the scene
            this.engine.runRenderLoop(() => { 
                this.scene.render();
            });

            // Watch for browser/canvas resize events
            window.addEventListener("resize", () => { 
                this.engine.resize();
            });
        });
    }

    private async createScene() 
    {
        // This creates and positions a first-person camera (non-mesh)
        var camera = new UniversalCamera("camera1", new Vector3(0, 1.6, 0), this.scene);
        camera.fov = 90 * Math.PI / 180;

        // This attaches the camera to the canvas
        camera.attachControl(this.canvas, true);

        // Some ambient light to illuminate the scene
        var ambientlight = new HemisphericLight("ambient", Vector3.Up(), this.scene);
        ambientlight.intensity = 1.0;
        ambientlight.diffuse = new Color3(.25, .25, .25);

        // Add a directional light to imitate sunlight
        var directionalLight = new DirectionalLight("sunlight", Vector3.Down(), this.scene);
        directionalLight.intensity = 1.0;

        // Creates a default skybox
        const environment = this.scene.createDefaultEnvironment({
            createGround: false,
            skyboxSize: 750,
            skyboxColor: new Color3(.059, .663, .80)
        });

        // Creates the XR experience helper
        const xrHelper = await this.scene.createDefaultXRExperienceAsync({});

        // Assigns the web XR camera to a member variable
        this.xrCamera = xrHelper.baseExperience.camera;

        // There is a bug in Babylon 4.1 that fails to reenable pointer selection after a teleport
        // This is a hacky workaround that disables a different unused feature instead
        xrHelper.teleportation.setSelectionFeature(xrHelper.baseExperience.featuresManager.getEnabledFeature("xr-background-remover"));

        // Register event handlers for button presses
        xrHelper.input.onControllerAddedObservable.add((inputSource) => {
            inputSource.onMotionControllerInitObservable.add((motionController) => {
                switch (inputSource.uniqueId)
                {
                    case "controller-1-tracked-pointer-left":
                        this.leftController = inputSource;
                        motionController.getComponent("xr-standard-trigger").onButtonStateChangedObservable.add(this.onLeftTrigger); 
                        motionController.getComponent("xr-standard-squeeze").onButtonStateChangedObservable.add(this.onLeftSqueeze);
                        motionController.getComponent("xr-standard-thumbstick").onButtonStateChangedObservable.add(this.onLeftThumbstick);  
                        motionController.getComponent("x-button").onButtonStateChangedObservable.add(this.onLeftX); 
                        motionController.getComponent("y-button").onButtonStateChangedObservable.add(this.onLeftY); 
                        motionController.getComponent("xr-standard-thumbstick").onAxisValueChangedObservable.add(this.onLeftThumbstickAxis)
                        break;

                    case "controller-0-tracked-pointer-right":
                        this.rightController = inputSource;
                        motionController.getComponent("xr-standard-trigger").onButtonStateChangedObservable.add(this.onRightTrigger); 
                        motionController.getComponent("xr-standard-squeeze").onButtonStateChangedObservable.add(this.onRightSqueeze); 
                        motionController.getComponent("xr-standard-thumbstick").onButtonStateChangedObservable.add(this.onRightThumbstick); 
                        motionController.getComponent("a-button").onButtonStateChangedObservable.add(this.onRightA); 
                        motionController.getComponent("b-button").onButtonStateChangedObservable.add(this.onRightB);
                        motionController.getComponent("xr-standard-thumbstick").onAxisValueChangedObservable.add(this.onRightThumbstickAxis)
                        break;
                }
            });
        });

        // The assets manager can be used to load multiple assets
        var assetsManager = new AssetsManager(this.scene);

        // Create a task for each asset you want to load
        var worldTask = assetsManager.addMeshTask("world task", "", "assets/models/", "world.glb");
        worldTask.onSuccess = (task) => {
            worldTask.loadedMeshes[0].name = "world";
            worldTask.loadedMeshes[0].position = new Vector3(0, 0.5, 0);
        }
        
        // This loads all the assets and displays a loading screen
        assetsManager.load();

        // This will execute when all assets are loaded
        assetsManager.onFinish = (tasks) => {

            // Add the floor meshes to the teleporter
            worldTask.loadedMeshes.forEach((mesh) => {
                if(mesh.name.startsWith("rpgpp_lt_terrain")) {
                    xrHelper.teleportation.addFloorMesh(mesh);
                }
            });
            
            // Show the debug layer
            //this.scene.debugLayer.show();
        };  
    
    }

    private onLeftTrigger(component: WebXRControllerComponent)
    {  
        if(component.changes.pressed)
        {
            if(component.pressed)
            {
                Logger.Log("left trigger pressed");
            }
            else
            {
                Logger.Log("left trigger released");
            }
        }     
    }

    private onLeftSqueeze(component: WebXRControllerComponent)
    {  
        if(component.changes.pressed)
        {
            if(component.pressed)
            {
                Logger.Log("left squeeze pressed");
            }
            else
            {
                Logger.Log("left squeeze released");
            }
        }  
    }

    private onLeftX(component: WebXRControllerComponent)
    {  
        if(component.changes.pressed)
        {
            if(component.pressed)
            {
                Logger.Log("left X pressed");
            }
            else
            {
                Logger.Log("left X released");
            }
        }  
    }

    private onLeftY(component: WebXRControllerComponent)
    {  
        if(component.changes.pressed)
        {
            if(component.pressed)
            {
                Logger.Log("left Y pressed");
            }
            else
            {
                Logger.Log("left Y released");
            }
        }  
    }

    private onLeftThumbstick(component: WebXRControllerComponent)
    {   
        if(component.changes.pressed)
        {
            if(component.pressed)
            {
                Logger.Log("left thumbstick pressed");
            }
            else
            {
                Logger.Log("left thumbstick released");
            }
        }  
    }

    private onLeftThumbstickAxis(eventData: {x: number, y: number})
    {  
        Logger.Log("left thumbstick axis: (" + eventData.x + "," + eventData.y + ")");
    }

    private onRightTrigger(component: WebXRControllerComponent)
    {  
        if(component.changes.pressed)
        {
            if(component.pressed)
            {
                Logger.Log("right trigger pressed");
            }
            else
            {
                Logger.Log("right trigger released");
            }
        }  
    }

    private onRightSqueeze(component: WebXRControllerComponent)
    {  
        if(component.changes.pressed)
        {
            if(component.pressed)
            {
                Logger.Log("right squeeze pressed");
            }
            else
            {
                Logger.Log("right squeeze released");
            }
        }  
    }

    private onRightA(component: WebXRControllerComponent)
    {  
        if(component.changes.pressed)
        {
            if(component.pressed)
            {
                Logger.Log("right A pressed");
            }
            else
            {
                Logger.Log("right A released");
            }
        }  
    }

    private onRightB(component: WebXRControllerComponent)
    {  
        if(component.changes.pressed)
        {
            if(component.pressed)
            {
                Logger.Log("right B pressed");
            }
            else
            {
                Logger.Log("right B released");
            }
        }  
    }

    private onRightThumbstick(component: WebXRControllerComponent)
    {  
        if(component.changes.pressed)
        {
            if(component.pressed)
            {
                Logger.Log("right thumbstick pressed");
            }
            else
            {
                Logger.Log("right thumbstick released");
            }
        }  
    }  
    
    private onRightThumbstickAxis(eventData: {x: number, y: number})
    {  
        Logger.Log("right thumbstick axis: (" + eventData.x + "," + eventData.y + ")");
    }
}
/******* End of the Game class ******/   

// start the game
var game = new Game();
game.start();