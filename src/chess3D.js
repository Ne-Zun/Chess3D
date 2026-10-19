import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PieceFactory } from './pieceFactory.js';
import { Board3D } from './board3D.js';

/**
 * 3D Chess Scene Controller
 * Manages Three.js WebGL rendering, camera choreography, piece animations, and raycasting
 */

export class Chess3D {
  constructor(containerElement, onSquareClicked, onHoverSquare) {
    this.container = containerElement;
    this.onSquareClicked = onSquareClicked;
    this.onHoverSquare = onHoverSquare;

    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.board = null;
    this.pieceFactory = new PieceFactory();
    this.pieceMeshes = new Map(); // id -> mesh

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
    this.animatingPieces = []; // Array of active move animations

    this.cameraTargetPos = new THREE.Vector3(0, 15, 17);
    this.cameraTargetLook = new THREE.Vector3(0, 0, 0);
    this.isTransitioningCamera = false;

    this.theme = 'classic';

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 16, 18);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04; // Don't go below ground
    this.controls.minDistance = 8;
    this.controls.maxDistance = 38;
    this.controls.target.set(0, 0, 0);

    // Setup Lighting & Environment
    this.setupLighting();
    this.setupEnvironment();

    // Setup Board
    this.board = new Board3D(this.scene);

    // Event Listeners
    window.addEventListener('resize', this.onResize.bind(this));
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));

    // Animation Loop
    this.lastTime = performance.now();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    this.lightingGroup = new THREE.Group();
    this.scene.add(this.lightingGroup);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 0.7);
    this.lightingGroup.add(ambientLight);

    // Key Directional Light
    const keyLight = new THREE.DirectionalLight(0xfffaed, 1.8);
    keyLight.position.set(12, 22, 14);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 60;
    const d = 12;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    this.lightingGroup.add(keyLight);

    // Cool Fill Light
    const fillLight = new THREE.DirectionalLight(0xa5c4f5, 0.8);
    fillLight.position.set(-14, 16, -12);
    this.lightingGroup.add(fillLight);

    // Subtle Rim Light
    const rimLight = new THREE.DirectionalLight(0xffe5b4, 0.6);
    rimLight.position.set(0, 8, -18);
    this.lightingGroup.add(rimLight);
  }

  setupEnvironment() {
    // Elegant floor shadow catcher
    const floorGeom = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.28 });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.6;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Subtle ambient dust motes
    const particleCount = 200;
    const pGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 40;
      positions[i + 1] = Math.random() * 20;
      positions[i + 2] = (Math.random() - 0.5) * 40;
    }
    pGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0xffe8aa,
      size: 0.15,
      transparent: true,
      opacity: 0.4
    });
    this.particles = new THREE.Points(pGeom, pMat);
    this.scene.add(this.particles);
  }

  setTheme(themeName) {
    this.theme = themeName;
    this.pieceFactory.setTheme(themeName);
    this.board.setTheme(themeName);
  }

  // Synchronize 3D board pieces with logic board state
  syncBoardState(boardState) {
    // Clear existing pieces
    for (const [id, mesh] of this.pieceMeshes.entries()) {
      this.scene.remove(mesh);
    }
    this.pieceMeshes.clear();

    // Spawn pieces according to boardState
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardState[r][c];
        if (piece) {
          this.createAndPlacePiece(piece, r, c);
        }
      }
    }
  }

  createAndPlacePiece(pieceData, r, c) {
    const mesh = this.pieceFactory.createPiece(pieceData.type, pieceData.color);
    const worldPos = this.board.posToWorld(r, c);
    mesh.position.set(worldPos.x, worldPos.y, worldPos.z);
    mesh.userData = {
      ...mesh.userData,
      row: r,
      col: c,
      id: pieceData.id,
      color: pieceData.color,
      type: pieceData.type,
      isPiece: true
    };
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.userData = mesh.userData;
      }
    });
    this.scene.add(mesh);
    this.pieceMeshes.set(pieceData.id, mesh);
    return mesh;
  }

  // Animate a piece moving from `from` to `to`
  animateMove(moveData, onComplete) {
    const { from, to, piece, isCastle, rookFrom, rookTo, isEnPassant, capturedPawnPos } = moveData;
    const mesh = this.pieceMeshes.get(piece.id);

    if (!mesh) {
      if (onComplete) onComplete();
      return;
    }

    const startPos = mesh.position.clone();
    const endPos = this.board.posToWorld(to.r, to.c);

    // If there is an opponent piece at `to`, or en passant capture
    let capturedMesh = null;
    if (moveData.capture) {
      if (isEnPassant && capturedPawnPos) {
        capturedMesh = this.findMeshAt(capturedPawnPos.r, capturedPawnPos.c);
      } else {
        capturedMesh = this.findMeshAt(to.r, to.c, mesh);
      }
    }

    const duration = 400; // ms
    const startTime = performance.now();

    // Animate moving piece with a smooth parabola arc
    const anim = {
      mesh,
      startPos,
      endPos,
      startTime,
      duration,
      update: (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress < 0.5
          ? 2 * progress * progress
          : -1 + (4 - 2 * progress) * progress;

        // X and Z interpolate linearly with ease
        mesh.position.x = startPos.x + (endPos.x - startPos.x) * ease;
        mesh.position.z = startPos.z + (endPos.z - startPos.z) * ease;

        // Parabolic arc for Y
        const heightArc = 1.3 * Math.sin(progress * Math.PI);
        mesh.position.y = startPos.y + (endPos.y - startPos.y) * progress + heightArc;

        // When halfway, animate captured piece shrinking & vanishing
        if (capturedMesh && progress > 0.4) {
          const capProg = (progress - 0.4) / 0.6;
          capturedMesh.scale.setScalar(Math.max(0.001, 1 - capProg));
          capturedMesh.position.y = Math.max(-0.5, 0.2 - capProg * 0.7);
        }

        if (progress >= 1) {
          mesh.position.copy(endPos);
          mesh.userData.row = to.r;
          mesh.userData.col = to.c;

          if (capturedMesh) {
            this.scene.remove(capturedMesh);
            for (const [id, m] of this.pieceMeshes.entries()) {
              if (m === capturedMesh) {
                this.pieceMeshes.delete(id);
                break;
              }
            }
          }

          // Handle castling rook animation
          if (isCastle && rookFrom && rookTo) {
            const rookMesh = this.findMeshAt(rookFrom.r, rookFrom.c);
            if (rookMesh) {
              const rStart = rookMesh.position.clone();
              const rEnd = this.board.posToWorld(rookTo.r, rookTo.c);
              this.animatingPieces.push({
                mesh: rookMesh,
                startPos: rStart,
                endPos: rEnd,
                startTime: performance.now(),
                duration: 250,
                update: (rNow) => {
                  const rElapsed = rNow - this.animatingPieces[this.animatingPieces.length - 1].startTime;
                  const rProg = Math.min(rElapsed / 250, 1);
                  rookMesh.position.lerpVectors(rStart, rEnd, rProg);
                  if (rProg >= 1) {
                    rookMesh.position.copy(rEnd);
                    rookMesh.userData.row = rookTo.r;
                    rookMesh.userData.col = rookTo.c;
                    return true;
                  }
                  return false;
                }
              });
            }
          }

          if (onComplete) onComplete();
          return true; // Completed
        }
        return false;
      }
    };

    this.animatingPieces.push(anim);
  }

  findMeshAt(r, c, excludeMesh = null) {
    for (const mesh of this.pieceMeshes.values()) {
      if (mesh !== excludeMesh && mesh.userData.row === r && mesh.userData.col === c) {
        return mesh;
      }
    }
    return null;
  }

  // Camera presets
  setCameraPreset(preset) {
    this.isTransitioningCamera = true;
    switch (preset) {
      case 'white':
        this.cameraTargetPos.set(0, 15, 17);
        this.cameraTargetLook.set(0, 0, 0);
        break;
      case 'black':
        this.cameraTargetPos.set(0, 15, -17);
        this.cameraTargetLook.set(0, 0, 0);
        break;
      case 'top':
        this.cameraTargetPos.set(0, 24, 0.05);
        this.cameraTargetLook.set(0, 0, 0);
        break;
      case 'free':
        this.isTransitioningCamera = false;
        break;
    }
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  onPointerMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast for hover
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    let hoveredSquare = null;
    for (const hit of intersects) {
      let obj = hit.object;
      while (obj && !obj.userData?.isTile && !obj.userData?.isPiece && !obj.userData?.isLegalMarker && obj.parent) {
        obj = obj.parent;
      }

      if (obj && obj.userData) {
        if (obj.userData.isTile || obj.userData.isPiece) {
          hoveredSquare = { r: obj.userData.row, c: obj.userData.col };
          break;
        } else if (obj.userData.isLegalMarker) {
          hoveredSquare = { r: obj.userData.targetMove.to.r, c: obj.userData.targetMove.to.c };
          break;
        }
      }
    }

    if (hoveredSquare) {
      this.board.setHover(hoveredSquare.r, hoveredSquare.c);
      if (this.onHoverSquare) this.onHoverSquare(hoveredSquare);
    } else {
      this.board.setHover(null, null);
      if (this.onHoverSquare) this.onHoverSquare(null);
    }
  }

  onPointerDown(event) {
    // Only respond to left click
    if (event.button !== 0) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    for (const hit of intersects) {
      let obj = hit.object;
      while (obj && !obj.userData?.isTile && !obj.userData?.isPiece && !obj.userData?.isLegalMarker && obj.parent) {
        obj = obj.parent;
      }

      if (obj && obj.userData) {
        if (obj.userData.isLegalMarker) {
          const move = obj.userData.targetMove;
          if (this.onSquareClicked) {
            this.onSquareClicked(move.to.r, move.to.c, null, move);
          }
          return;
        } else if (obj.userData.isPiece || obj.userData.isTile) {
          if (this.onSquareClicked) {
            this.onSquareClicked(obj.userData.row, obj.userData.col, obj.userData);
          }
          return;
        }
      }
    }
  }

  animate(time) {
    requestAnimationFrame(this.animate);

    // Update move animations
    for (let i = this.animatingPieces.length - 1; i >= 0; i--) {
      const anim = this.animatingPieces[i];
      const finished = anim.update(time);
      if (finished) {
        this.animatingPieces.splice(i, 1);
      }
    }

    // Camera preset transition interpolation
    if (this.isTransitioningCamera) {
      this.camera.position.lerp(this.cameraTargetPos, 0.08);
      this.controls.target.lerp(this.cameraTargetLook, 0.08);
      if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.05) {
        this.camera.position.copy(this.cameraTargetPos);
        this.controls.target.copy(this.cameraTargetLook);
        this.isTransitioningCamera = false;
      }
    }

    // Gentle particle motion
    if (this.particles) {
      this.particles.rotation.y += 0.0006;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
