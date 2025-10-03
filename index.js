// const Matter = require('matter-js');

function mulberry32(a) {
	return function() {
		let t = a += 0x6D2B79F5;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	}
}

const rand = mulberry32(Date.now());

const {
	Engine, Render, Runner, Composites, Common, MouseConstraint, Mouse,
	Composite, Bodies, Events,
} = Matter;

const wallPad = 64;
const loseHeight = 95;
const statusBarHeight = 48;
const previewBallHeight = 32;
const friction = {
	friction: 0.006,
	frictionStatic: 0.006,
	frictionAir: 0,
	restitution: 0.1
};

const GameStates = {
	MENU: 0,
	READY: 1,
	DROP: 2,
	LOSE: 3,
};

const Game = {
	width: 1344,
	height: 768,
	elements: {
		canvas: document.getElementById('game-canvas'),
		ui: document.getElementById('game-ui'),
		score: document.getElementById('game-score'),
		end: document.getElementById('game-end-container'),
		endTitle: document.getElementById('game-end-title'),
		endLink: document.getElementById('game-end-link'),
		statusValue: document.getElementById('game-highscore-value'),
		nextFruitImg: document.getElementById('game-next-fruit'),
		previewBall: null,
		btnMute: document.getElementById('btn-mute'),
		btnMuteImg: document.getElementById('btn-mute-img'),
		btnStartCss: document.getElementById('btn-start-css'),
		status: document.getElementById('game-status'),
		creditText: document.getElementById('credit-text'),
	},
	cache: { highscore: 0 },
	sounds: {
		click: new Audio('./assets/click.mp3'),
		pop0: new Audio('./assets/pop0.mp3'),
		pop1: new Audio('./assets/pop1.mp3'),
		pop2: new Audio('./assets/pop2.mp3'),
		pop3: new Audio('./assets/pop3.mp3'),
		pop4: new Audio('./assets/pop4.mp3'),
		pop5: new Audio('./assets/pop5.mp3'),
		pop6: new Audio('./assets/pop6.mp3'),
		pop7: new Audio('./assets/pop7.mp3'),
		pop8: new Audio('./assets/pop8.mp3'),
		pop9: new Audio('./assets/pop9.mp3'),
		pop10: new Audio('./assets/pop10.mp3'),
		pop11: new Audio('./assets/pop10.mp3'),
		pop12: new Audio('./assets/pop10.mp3'),
		pop13: new Audio('./assets/pop10.mp3'),
		pop14: new Audio('./assets/pop10.mp3'),
		bgm: new Audio('./assets/bgm.mp3'),
	},

	stateIndex: GameStates.MENU,
	isMuted: false,
	hotkeysEnabled: false,
	score: 0,
	fruitsMerged: [],

	toggleMute: function () {
		Game.isMuted = !Game.isMuted;
		Game.elements.btnMuteImg.src = Game.isMuted ? './assets/img/unmute.png' : './assets/img/mute.png';

		// Only mute the BGM
		Game.sounds.bgm.muted = Game.isMuted;
	},
	calculateScore: function () {
		const score = Game.fruitsMerged.reduce((total, count, sizeIndex) => {
			const value = Game.fruitSizes[sizeIndex].scoreValue * count;
			return total + value;
		}, 0);

		Game.score = score;
		Game.elements.score.innerText = Game.score;
	},

	fruitSizes: [
        { radius: 18,  scoreValue: 1,   img: './assets/img/circle0.png'  },
        { radius: 24,  scoreValue: 3,   img: './assets/img/circle1.png'  },
        { radius: 30,  scoreValue: 6,   img: './assets/img/circle2.png'  },
        { radius: 42,  scoreValue: 10,  img: './assets/img/circle3.png'  },
        { radius: 48,  scoreValue: 15,  img: './assets/img/circle4.png'  },
        { radius: 54,  scoreValue: 21,  img: './assets/img/circle5.png'  },
        { radius: 63,  scoreValue: 28,  img: './assets/img/circle6.png'  },
        { radius: 72,  scoreValue: 36,  img: './assets/img/circle7.png'  },
        { radius: 74,  scoreValue: 45,  img: './assets/img/circle8.png'  },
        { radius: 83,  scoreValue: 55,  img: './assets/img/circle9.png'  },
        { radius: 89, scoreValue: 66,  img: './assets/img/circle10.png' },
        { radius: 97, scoreValue: 78,  img: './assets/img/circle11.png' },
        { radius: 110, scoreValue: 91,  img: './assets/img/circle12.png' },
        { radius: 122, scoreValue: 105, img: './assets/img/circle13.png' },
        { radius: 134, scoreValue: 120, img: './assets/img/circle14.png' },
	],
	currentFruitSize: 0,
	nextFruitSize: 0,
	setNextFruitSize: function () {
		Game.nextFruitSize = Math.floor(rand() * 5);
		Game.elements.nextFruitImg.src = `./assets/img/circle${Game.nextFruitSize}.png`;
	},

	showHighscore: function () {
		Game.elements.statusValue.innerText = Game.cache.highscore;
	},
	loadHighscore: function () {
		const gameCache = localStorage.getItem('suika-game-cache');
		if (gameCache === null) {
			Game.saveHighscore();
			return;
		}

		Game.cache = JSON.parse(gameCache);
		Game.showHighscore();
	},
	saveHighscore: function () {
		Game.calculateScore();
		if (Game.score < Game.cache.highscore) return;

		Game.cache.highscore = Game.score;
		Game.showHighscore();
		Game.elements.endTitle.innerText = 'New Highscore!';

		localStorage.setItem('suika-game-cache', JSON.stringify(Game.cache));
	},

	initGame: function () {
		Game.sounds.bgm.addEventListener('timeupdate', function(){
			// Manually loop the BGM when it's near the end
			if (this.currentTime > this.duration - 0.5) {
				this.currentTime = 0;
				this.play();
			}
		});
		Render.run(render);
		Runner.run(runner, engine);

		Composite.add(engine.world, menuStatics);
        Game.elements.canvas.style.backgroundImage = "url('./assets/img/menu-bg.png')";

		const unlockAudio = () => {
			Object.values(Game.sounds).forEach(sound => {
				sound.play();
				sound.pause();
				sound.currentTime = 0;
			});
			document.removeEventListener('mousedown', unlockAudio);
			document.removeEventListener('touchstart', unlockAudio);
		};
		document.addEventListener('mousedown', unlockAudio);
		document.addEventListener('touchstart', unlockAudio);

		Game.loadHighscore();
		Game.fruitsMerged = Array.apply(null, Array(Game.fruitSizes.length)).map(() => 0);
		Game.elements.btnStartCss.addEventListener('click', Game.startGame);
		Game.elements.btnMute.addEventListener('click', Game.toggleMute);
		Game.elements.endLink.addEventListener('click', Game.resetGame);

		document.addEventListener('keydown', function(event) {
			// Toggle hotkeys on/off with F1
			if (event.key === 'F2') {
				Game.hotkeysEnabled = !Game.hotkeysEnabled;
				console.log(`Hotkeys ${Game.hotkeysEnabled ? 'Enabled' : 'Disabled'}`);
				return;
			}

			// If hotkeys are not enabled, do nothing
			if (!Game.hotkeysEnabled) return;

			if (Game.stateIndex !== GameStates.READY && Game.stateIndex !== GameStates.DROP) {
				return; // Only active during gameplay
			}

			// Game state hotkeys
			if (event.key === 'l') {
				Game.loseGame();
				return;
			} else if (event.key === 'h') {
				// Directly trigger the highscore display effect for preview
				Game.sounds.bgm.pause();
				Game.sounds.bgm.currentTime = 0;
				Game.stateIndex = GameStates.LOSE;
				Game.elements.endTitle.innerText = 'New Highscore!'; // Set text directly
				Game.elements.end.style.display = 'flex';
				runner.enabled = false;
				return;
			}

			// Fruit selection hotkeys
			const keyToFruitIndex = {
				'5': 5, '6': 6, '7': 7,
				'8': 8, '9': 9, '0': 10,
				'1': 11, '2': 12, '3': 13, '4': 14
			};

			if (keyToFruitIndex.hasOwnProperty(event.key)) {
				const fruitIndex = keyToFruitIndex[event.key];
				Game.currentFruitSize = fruitIndex;

				// Update the preview ball
				Composite.remove(engine.world, Game.elements.previewBall);
				Game.elements.previewBall = Game.generateFruitBody(render.mouse.position.x, previewBallHeight, Game.currentFruitSize, {
					isStatic: true,
					collisionFilter: { mask: 0x0040 }
				});
				Composite.add(engine.world, Game.elements.previewBall);
			}
		});
	},

	startGame: function () {
		Game.sounds.click.play();
		console.log("Playing BGM");
		Game.sounds.bgm.play();
		Game.elements.btnStartCss.style.display = 'none';
		Game.elements.creditText.style.display = 'none';

        Game.elements.canvas.style.backgroundImage = "url('./assets/img/ingame-bg.png')";
		Composite.remove(engine.world, menuStatics);
		Composite.add(engine.world, gameStatics);

		Game.calculateScore();
		Game.elements.endTitle.innerText = 'Game Over!';
		Game.elements.ui.style.display = 'block';
		Game.elements.status.style.display = 'flex';
		Game.elements.end.style.display = 'none';
		Game.elements.previewBall = Game.generateFruitBody(Game.width / 2, previewBallHeight, 0, { isStatic: true });
		Composite.add(engine.world, Game.elements.previewBall);

		setTimeout(() => {
			Game.stateIndex = GameStates.READY;
		}, 250);

		Events.on(mouseConstraint, 'mouseup', function (e) {
			Game.addFruit(e.mouse.position.x);
		});

		Events.on(mouseConstraint, 'mousemove', function (e) {
			if (Game.stateIndex !== GameStates.READY) return;
			if (Game.elements.previewBall === null) return;

			Game.elements.previewBall.position.x = e.mouse.position.x;
		});

		Events.on(engine, 'collisionStart', function (e) {
			for (let i = 0; i < e.pairs.length; i++) {
				const { bodyA, bodyB } = e.pairs[i];

				// Skip if collision is wall
				if (bodyA.isStatic || bodyB.isStatic) continue;

				const aY = bodyA.position.y + bodyA.circleRadius;
				const bY = bodyB.position.y + bodyB.circleRadius;

				// Uh oh, too high!
				if (aY < loseHeight || bY < loseHeight) {
					Game.loseGame();
					return;
				}

				// Skip different sizes
				if (bodyA.sizeIndex !== bodyB.sizeIndex) continue;

				// Prevent largest fruit from merging
				if (bodyA.sizeIndex === Game.fruitSizes.length - 1) continue;

				// Skip if already popped
				if (bodyA.popped || bodyB.popped) continue;

				let newSize = bodyA.sizeIndex + 1;

				// Go back to smallest size
				if (bodyA.sizeIndex === Game.fruitSizes.length - 1) {
					newSize = 0;
				}

				Game.fruitsMerged[bodyA.sizeIndex] += 1;

				// Therefore, circles are same size, so merge them.
				const midPosX = (bodyA.position.x + bodyB.position.x) / 2;
				const midPosY = (bodyA.position.y + bodyB.position.y) / 2;

				bodyA.popped = true;
				bodyB.popped = true;

				Game.sounds[`pop${bodyA.sizeIndex}`].play();
				Composite.remove(engine.world, [bodyA, bodyB]);
				Composite.add(engine.world, Game.generateFruitBody(midPosX, midPosY, newSize));
				Game.addPop(midPosX, midPosY, bodyA.circleRadius);
				Game.calculateScore();
			}
		});
	},

	addPop: function (x, y, r) {
		const circle = Bodies.circle(x, y, r, {
			isStatic: true,
			collisionFilter: { mask: 0x0040 },
			angle: rand() * (Math.PI * 2),
			render: {
				sprite: {
					texture: './assets/img/pop.png',
					xScale: r / 384,
					yScale: r / 384,
				}
			},
		});

		Composite.add(engine.world, circle);
		setTimeout(() => {
			Composite.remove(engine.world, circle);
		}, 100);
	},

	loseGame: function () {
		Game.sounds.bgm.pause();
		Game.sounds.bgm.currentTime = 0;
		Game.stateIndex = GameStates.LOSE;
		Game.elements.end.style.display = 'flex';
		runner.enabled = false;
		Game.saveHighscore();
	},

	resetGame: function () {
		// Remove the leftover preview ball from the previous game
		if (Game.elements.previewBall) {
			Composite.remove(engine.world, Game.elements.previewBall);
		}

		// Clear all non-static bodies (fruits)
		const bodiesToRemove = Composite.allBodies(engine.world).filter(body => !body.isStatic);
		Composite.remove(engine.world, bodiesToRemove);

		// Reset scores and merged fruits array
		Game.score = 0;
		Game.fruitsMerged = Array.apply(null, Array(Game.fruitSizes.length)).map(() => 0);
		Game.calculateScore();

		// Hide game over screen
		Game.elements.end.style.display = 'none';

		// Re-enable physics
		runner.enabled = true;

		// Create first preview ball
		Game.currentFruitSize = 0;
		Game.setNextFruitSize();
		Game.elements.previewBall = Game.generateFruitBody(Game.width / 2, previewBallHeight, 0, { isStatic: true });
		Composite.add(engine.world, Game.elements.previewBall);

		// Restart BGM if it was playing
		if (!Game.isMuted) {
			Game.sounds.bgm.currentTime = 0;
			console.log("Playing BGM in resetGame");
			Game.sounds.bgm.play();
		}

		// Set state to ready
		Game.stateIndex = GameStates.READY;
	},

	// Returns an index, or null
	lookupFruitIndex: function (radius) {
		const sizeIndex = Game.fruitSizes.findIndex(size => size.radius == radius);
		if (sizeIndex === undefined) return null;
		if (sizeIndex === Game.fruitSizes.length - 1) return null;

		return sizeIndex;
	},

	generateFruitBody: function (x, y, sizeIndex, extraConfig = {}) {
		const size = Game.fruitSizes[sizeIndex];
		const circle = Bodies.circle(x, y, size.radius, {
			...friction,
			...extraConfig,
			render: { sprite: { texture: size.img, xScale: size.radius / 512, yScale: size.radius / 512 } },
		});
		circle.sizeIndex = sizeIndex;
		circle.popped = false;

		return circle;
	},

	addFruit: function (x) {
			if (Game.stateIndex !== GameStates.READY) return;

			Game.sounds.click.play();

			Game.stateIndex = GameStates.DROP;
			const latestFruit = Game.generateFruitBody(x, previewBallHeight, Game.currentFruitSize);
			Composite.add(engine.world, latestFruit);

			Game.currentFruitSize = Game.nextFruitSize;
			Game.setNextFruitSize();
			Game.calculateScore();

			Composite.remove(engine.world, Game.elements.previewBall);
			Game.elements.previewBall = Game.generateFruitBody(render.mouse.position.x, previewBallHeight, Game.currentFruitSize, {
				isStatic: true,
				collisionFilter: { mask: 0x0040 }
			});

			setTimeout(() => {
				if (Game.stateIndex === GameStates.DROP) {
					Composite.add(engine.world, Game.elements.previewBall);
					Game.stateIndex = GameStates.READY;
				}
			}, 500);
		}
}

const engine = Engine.create();
const runner = Runner.create();
const render = Render.create({
	element: Game.elements.canvas,
	engine,
	options: {
		width: Game.width,
		height: Game.height,
		wireframes: false,
		background: 'transparent'
	}
});

const menuStatics = [];

const wallProps = {
	isStatic: true,
	render: { fillStyle: '#FFEEDB' },
	...friction,
};

const gameStatics = [
	// Left
	Bodies.rectangle(-(wallPad / 2), Game.height / 2, wallPad, Game.height, wallProps),

	// Right
	Bodies.rectangle(Game.width + (wallPad / 2), Game.height / 2, wallPad, Game.height, wallProps),

	// Bottom
	Bodies.rectangle(Game.width / 2, Game.height + (wallPad / 2) - statusBarHeight, Game.width, wallPad, wallProps),
];

// add mouse control
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
	mouse: mouse,
	constraint: {
		stiffness: 0.2,
		render: {
			visible: false,
		},
	},
});
render.mouse = mouse;

Game.initGame();
