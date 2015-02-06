$(document).ready(function() {

    var Q = window.Q = Quintus();
    Q.include("Sprites, Scenes, Input, 2D, Anim, Touch, UI");
    Q.setup({ maximize: true });
    Q.controls();

    Q.input.touchControls({
        controls: [['fire', 'Space' ]]
    });

    // Based off of platformerControls
    Q.component("pressSpaceControls", {
        defaults: {
            speed: 200,
            jumpSpeed: -300,
            collisions: []
        },

        added: function() {
            var p = this.entity.p;

            Q._defaults(p,this.defaults);

            this.entity.on("step", this, "step");
            this.entity.on("bump.bottom", this, "landed");

            p.landed = 0;
            p.direction = 'right';
        },

        landed: function(col) {
            var p = this.entity.p;
            p.landed = 1/5;
        },

        step: function(dt) {
            var p = this.entity.p;

            if(p.ignoreControls === undefined || !p.ignoreControls) {
                var collision = null;

                // Follow along the current slope, if possible.
                if(p.collisions !== undefined && p.collisions.length > 0 && (p.landed > 0)) {
                    if(p.collisions.length === 1) {
                        collision = p.collisions[0];
                    } else {
                        // If there's more than one possible slope, follow slope with negative Y normal
                        collision = null;

                        for(var i = 0; i < p.collisions.length; i++) {
                            if(p.collisions[i].normalY < 0) {
                                collision = p.collisions[i];
                            }
                        }
                    }

                    // Don't climb up walls.
                    if(collision !== null && collision.normalY > -0.3 && collision.normalY < 0.3) {
                        collision = null;
                    }
                }

                p.direction = 'right';
                if(collision && p.landed > 0) {
                    p.vx = -p.speed * collision.normalY;
                    p.vy = p.speed * collision.normalX;
                } else {
                    p.vx = p.speed;
                }

                if(p.landed > 0 && (Q.inputs['fire']) && !p.jumping) {
                    p.vy = p.jumpSpeed;
                    p.landed = -dt;
                    p.jumping = true;
                } else if(Q.inputs['fire']) {
                    p.jumping = true;
                }

                if(p.jumping && !(Q.inputs['fire'])) {
                    p.jumping = false;
                    if(p.vy < p.jumpSpeed / 3) {
                        p.vy = p.jumpSpeed / 3;
                    }
                }
            }
            p.landed -= dt;
        }
    });

    Q.Sprite.extend("Player", {

        init: function(p) {
            this._super(p, {
                sheet: "player",
                x: 0,
                y: 48
            });

            // The `2d` component adds in default 2d collision detection and kinetics (velocity, gravity)
            // The `platformerControls` makes the player controllable by the
            // default input actions (left, right to move,  up or action to jump)
            // It also checks to make sure the player is on a horizontal surface before
            // letting them jump.
            this.add('2d, pressSpaceControls');

            // events
            this.on("hit.sprite",function(collision) {
                if(collision.obj.isA("End")) {
                    Q.stageScene("start", 1, { label: "You Won! Press Space to Play Again" });
                    this.destroy();
                }
            });
        }
    });

    Q.Sprite.extend("End", {
        init: function(p) {
            this._super(p, { sheet: 'tower'});
        }
    });

    Q.Sprite.extend("StaticEnemy",{
        init: function(p) {
            this._super(p, { sheet: 'enemy', vx: 0 });

            this.add('2d');

            // Sprite collision on player: end the game unless the enemy is hit on top
            this.on('bump.left,bump.right,bump.bottom', function(collision) {
                if(collision.obj.isA("Player")) {
                    Q.stageScene('start', 1, { label: "You Lost! Press Space to Play Again" });
                    collision.obj.destroy();
                }
            });

            // If the enemy gets hit on the top, destroy it and give the user a "hop"
            this.on("bump.top",function(collision) {
                if(collision.obj.isA("Player")) {
                    this.destroy();
                    collision.obj.p.vy = -300;
                }
            });
        }
    });

    Q.Sprite.extend("MovingEnemy",{
        init: function(p) {
            this._super(p, { sheet: 'enemy', vx: 100});

            // Bounce AI changes whenever they run into something.
            this.add('2d, aiBounce');

            // Sprite collision on player: end the game unless the enemy is hit on top
            this.on('bump.left,bump.right,bump.bottom', function(collision) {
                if(collision.obj.isA("Player")) {
                    Q.stageScene('start', 1, { label: "You Lost! Press Space to Play Again" });
                    collision.obj.destroy();
                }
            });

            // If the enemy gets hit on the top, destroy it and give the user a "hop"
            this.on("bump.top",function(collision) {
                if(collision.obj.isA("Player")) {
                    this.destroy();
                    collision.obj.p.vy = -300;
                }
            });
        }
    });

    var loaded = false;
    var startStage = false;
    Q.input.on('fire', function() {
        if (startStage) {
            startStage = false;
            Q.clearStages();
            Q.stageScene('main');
        }
    });

    Q.scene('start', function(stage) {
        startStage = true;

        if (!loaded) {
            stage.insert(new Q.Repeater({asset: "background-wall.png", speedX: 0.5, speedY: 0.5}));
            loaded = true;
        }

        var container = stage.insert(new Q.UI.Container({
            x: Q.width/2, y: Q.height/2, fill: "rgba(0,0,0,0.5)"
        }));

        var label = container.insert(new Q.UI.Text({x: 0, y: 0, label: stage.options.label }));

        container.fit(20);
    });

    // Create a new scene called main
    Q.scene('main', function(stage) {

        stage.insert(new Q.Repeater({ asset: "background-wall.png", speedX: 0.5, speedY: 0.5 }));

        var titleLayer = new Q.TileLayer({
            dataAsset: "level.json",
            sheet: "tiles"
        });

        // Add in a tile layer, and make it the collision layer
        stage.collisionLayer(titleLayer);

        var player = stage.insert(new Q.Player());

        // Moveable viewport for stage that follows the player
        stage.add("viewport").follow(player);

        stage.insert(new Q.MovingEnemy({ x: 800, y: 0 }));

        stage.insert(new Q.End({ x: (titleLayer.p.tiles[2].length - 3/2) * 32, y: 34 }));
    });

    // ## Asset Loading and Game Launch
    // Q.load can be called at any time to load additional assets
    // assets that are already loaded will be skipped
    // The callback will be triggered when everything is loaded
    Q.load('sprites128.png, sprites.json, level.json, tiles.png, background-wall.png', function() {
        // Sprites sheets can be created manually
        Q.sheet('tiles', 'tiles.png', { tilew: 32, tileh: 32 });

        // Or from a .json asset that defines sprite locations
        Q.compileSheets('sprites128.png', 'sprites.json');

        // Finally, call stageScene to run the game
        Q.stageScene('start', 1, { label: "Press Space to Play" });
    });
});
