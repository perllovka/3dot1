// ============================================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И КОНСТАНТЫ
// ============================================================================

let scene, camera, renderer, controls, model;
let isRotating = false;
let isMeasuring = false;
let measurePoints = [];
let currentMode = 'rendered';
let gridHelper, axesHelper;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let currentFilename = '';
let distanceLabels = [];

let isMeasuringAngle = false;
let anglePoints = [];
let angleHelpers = [];
let angleLabels = [];

// Константы для оптимизации
const MOBILE_FPS = 30;
const DESKTOP_FPS = 60;
const MOBILE_BREAKPOINT = 768;
const POINT_SIZE = 0.04;
const ANGLE_POINT_SIZE = 0.02;

// Проверка мобильного устройства
const isMobileDevice = () => {
  return window.innerWidth <= MOBILE_BREAKPOINT || 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================================

function init() {
  try {
    initScene();
    initCamera();
    initRenderer();
    initLighting();
    initControls();
    initHelpers();
    initEventListeners();
    setupUI();
    animate();
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf9f9f9);
}

function initCamera() {
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;
}

function initRenderer() {
  const rendererOptions = {
    antialias: !isMobileDevice(),
    powerPreference: isMobileDevice() ? "low-power" : "high-performance",
    precision: isMobileDevice() ? "mediump" : "highp"
  };
  
  renderer = new THREE.WebGLRenderer(rendererOptions);
  
  if (isMobileDevice()) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  } else {
    renderer.setPixelRatio(window.devicePixelRatio);
  }
  
  updateRendererSize();
  
  renderer.shadowMap.enabled = !isMobileDevice();
  if (renderer.shadowMap.enabled) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  
  document.getElementById('viewer').appendChild(renderer.domElement);
}

function initLighting() {
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  
  if (!isMobileDevice()) {
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
  }
  
  scene.add(directionalLight);
}

function initControls() {
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = isMobileDevice() ? 0.1 : 0.05;
  controls.enablePan = !isMobileDevice(); // Отключаем панорамирование на мобильных
}

function initHelpers() {
  gridHelper = new THREE.GridHelper(10, 10);
  scene.add(gridHelper);
  
  axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);
}

function initEventListeners() {
  window.addEventListener('resize', throttle(onWindowResize, 250));
  document.getElementById('viewer').addEventListener('click', onModelClick);
  
  // Добавляем обработчики touch событий для мобильных устройств
  if (isMobileDevice()) {
    document.getElementById('viewer').addEventListener('touchstart', handleTouchStart, { passive: false });
    document.getElementById('viewer').addEventListener('touchmove', handleTouchMove, { passive: false });
  }
}

// ============================================================================
// УТИЛИТЫ И ОПТИМИЗАЦИЯ
// ============================================================================

// Throttle функция для оптимизации производительности
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Debounce функция для редких событий
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function updateRendererSize() {
  let width, height;
  
  if (isMobileDevice()) {
    width = Math.min(window.innerWidth, 768);
    height = window.innerHeight * 0.7;
  } else {
    width = Math.min(window.innerWidth, 1024);
    height = window.innerHeight * 0.8;
  }
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// Touch события для мобильных устройств
function handleTouchStart(event) {
  if (event.touches.length === 1) {
    mouse.x = (event.touches[0].clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.touches[0].clientY / renderer.domElement.clientHeight) * 2 + 1;
  }
}

function handleTouchMove(event) {
  event.preventDefault();
  if (isMeasuring && event.touches.length === 1) {
    onMouseMove(event);
  }
}

// ============================================================================
// НАСТРОЙКА UI
// ============================================================================

function setupUI() {
  setupFileUpload();
  setupControlButtons();
  setupViewModes();
  setupToggleOptions();
  setupStandardViews();
  setupSidebar();
  setupLibraryTabs();
  setupModelLibrary();
  setupArticles();
  setupMeasurementTools();
}

function setupFileUpload() {
  document.getElementById('modelFile').addEventListener('change', async (e) => {
    const fileInput = e.target;
    if (!fileInput.files.length) return;
    
    const file = fileInput.files[0];
    currentFilename = file.name;
    updateFilenameDisplay();
    
    const formData = new FormData();
    formData.append('model', file);
    
    try {
      const response = await fetch('/upload', { method: 'POST', body: formData });
      const data = await response.json();
      await loadModel(data.modelUrl);
    } catch (error) {
      console.error('Upload error:', error);
    }
  });
}

function setupControlButtons() {
  document.getElementById('rotateBtn').addEventListener('click', toggleRotation);
  document.getElementById('resetBtn').addEventListener('click', resetView);
  document.getElementById('zoomInBtn').addEventListener('click', () => zoom(0.8));
  document.getElementById('zoomOutBtn').addEventListener('click', () => zoom(1.2));
}

function setupViewModes() {
  const viewModes = ['wireframe', 'monochrome', 'shaded', 'rendered'];
  viewModes.forEach(mode => {
    document.getElementById(`${mode}Btn`).addEventListener('click', () => setViewMode(mode));
  });
}

function setupToggleOptions() {
  document.getElementById('toggleGrid').addEventListener('change', (e) => {
    gridHelper.visible = e.target.checked;
  });
  
  document.getElementById('toggleAxes').addEventListener('change', (e) => {
    axesHelper.visible = e.target.checked;
  });
}

function setupStandardViews() {
  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      setStandardView(view);
    });
  });
}

function setupSidebar() {
  const toggleBtn = document.getElementById('toggleSidebar');
  toggleBtn.addEventListener('click', throttle(toggleSidebar, 300));
}

function setupLibraryTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
      });
      document.getElementById(`${btn.dataset.tab}-tab`).style.display = 'block';
    });
  });
}

function setupModelLibrary() {
  document.querySelectorAll('.btn-load').forEach(btn => {
    btn.addEventListener('click', debounce(async function() {
      const modelItem = btn.closest('.model-item'); // Используем btn вместо this
      const modelName = modelItem.dataset.model;
      
      const originalText = btn.textContent;
      btn.textContent = 'Loading...';
      btn.disabled = true;
      
      try {
        await loadFromLibrary(modelName);
        
        document.querySelectorAll('.model-item').forEach(item => {
          item.classList.remove('active');
        });
        modelItem.classList.add('active');
        
      } catch (error) {
        console.error('Load error:', error);
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }, 500));
  });

  document.getElementById('modelSearch').addEventListener('input', debounce(function() {
    const searchTerm = this.value.toLowerCase();
    document.querySelectorAll('.model-item').forEach(item => {
      const modelName = item.querySelector('.model-name').textContent.toLowerCase();
      item.style.display = modelName.includes(searchTerm) ? 'flex' : 'none';
    });
  }, 300));
}

function setupArticles() {
  document.querySelectorAll('.clickable-article').forEach(card => {
    card.addEventListener('click', async (e) => {
      if (e.target.tagName === 'A' || e.target.classList.contains('no-trigger')) {
        return;
      }
      
      const articleId = card.dataset.article;
      await loadArticle(articleId);
    });
  });
}

function setupMeasurementTools() {
  document.getElementById('measureBtn').addEventListener('click', function() {
    if (isMeasuringAngle) {
      clearAngleMeasurements();
    }
    toggleMeasurement();
  });
  
  document.getElementById('angleBtn').addEventListener('click', function() {
    if (isMeasuring) {
      clearMeasurements();
    }
    toggleAngleMeasurement();
  });
}

// ============================================================================
// УПРАВЛЕНИЕ ФАЙЛАМИ И ОТОБРАЖЕНИЕМ
// ============================================================================

function updateFilenameDisplay() {
  const display = document.getElementById('filename-display');
  display.textContent = currentFilename ? ` • ${currentFilename}` : '';
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const viewerContainer = document.querySelector('.viewer-container');
  const toggleBtn = document.getElementById('toggleSidebar');
  
  const isCollapsing = !sidebar.classList.contains('collapsed');
  
  sidebar.classList.toggle('collapsed');
  toggleBtn.classList.toggle('collapsed');
  
  const icon = toggleBtn.querySelector('i');
  icon.classList.toggle('fa-chevron-left');
  icon.classList.toggle('fa-chevron-right');
  
  toggleBtn.style.left = isCollapsing ? '0px' : `${sidebar.offsetWidth}px`;
  viewerContainer.style.marginLeft = isCollapsing ? `-${sidebar.offsetWidth}px` : '0';
}

// ============================================================================
// ЗАГРУЗКА И УПРАВЛЕНИЕ МОДЕЛЯМИ
// ============================================================================

// Исправленная функция для загрузки из библиотеки
async function loadFromLibrary(modelName) {
  try {
    document.getElementById('viewer').style.opacity = '0.5';
    
    const response = await fetch(`/models/${modelName}.obj`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const text = await response.text();
    const loader = new THREE.OBJLoader();
    const object = loader.parse(text);
    
    // Очистка предыдущей модели с освобождением памяти
    if (model) {
      disposeModel(model);
      scene.remove(model);
    }
    
    model = object;
    currentFilename = `${modelName}.obj`;
    updateFilenameDisplay();
    
    // Используем новую функцию позиционирования
    positionModelOnGrid();
    scene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    updateModelInfo(size);
    
    applyViewMode();
    
    document.querySelectorAll('.model-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.model === modelName) {
        item.classList.add('active');
      }
    });
    
  } catch (error) {
    console.error('Error loading model:', error);
    alert(`Failed to load model: ${error.message}`);
  } finally {
    document.getElementById('viewer').style.opacity = '1';
  }
}


// Исправленная функция загрузки модели
async function loadModel(url) {
  if (model) {
    disposeModel(model);
    scene.remove(model);
    clearMeasurements();
  }

  return new Promise((resolve, reject) => {
    const loader = new THREE.OBJLoader();
    loader.load(url, (object) => {
      model = object;
      applyViewMode();

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());

      updateModelInfo(size);

      // Позиционируем модель правильно на сетке
      positionModelOnGrid();
      
      scene.add(model);
      resolve(model);
    }, undefined, reject);
  });
}

function disposeModel(model) {
  if (!model) return;
  
  model.traverse(child => {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });
}

function calculateOptimalScale(size) {
  const maxSize = Math.max(size.x, size.y, size.z);
  const targetSize = isMobileDevice() ? 8 : 10; // Меньший размер для мобильных
  return maxSize > targetSize ? targetSize / maxSize : 1;
}

// Исправленная функция обновления сетки
function updateGrid(size, scale) {
  // Находим максимальный размер модели в горизонтальной плоскости
  const maxHorizontalSize = Math.max(size.x, size.z);
  
  // Делаем сетку в 2-3 раза больше модели, но не меньше 10 единиц
  const gridSize = Math.max(10, maxHorizontalSize * 2.5);
  
  // Устанавливаем размер сетки
  scene.remove(gridHelper);
  gridHelper = new THREE.GridHelper(gridSize, Math.ceil(gridSize));
  gridHelper.position.y = 0; // сетка всегда на уровне Y = 0
  scene.add(gridHelper);
}

// Исправленная функция обновления камеры
function updateCamera(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  
  // Вычисляем оптимальное расстояние для камеры
  const maxSize = Math.max(size.x, size.y, size.z);
  const distance = maxSize * (isMobileDevice() ? 2.5 : 2);
  
  // Позиционируем камеру под углом для лучшего обзора
  camera.position.set(
    center.x + distance * 0.7,
    center.y + distance * 0.5, 
    center.z + distance * 0.7
  );
  
  // Направляем камеру на центр модели
  controls.target.copy(center);
  controls.update();
}
// Исправленная функция позиционирования модели на сетке
function positionModelOnGrid() {
  if (!model) return;

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Масштабируем модель если нужно
  const scale = calculateOptimalScale(size);
  model.scale.set(scale, scale, scale);

  // Пересчитываем размеры после масштабирования
  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledSize = scaledBox.getSize(new THREE.Vector3());
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

  // Позиционируем модель:
  // - центрируем по X и Z (горизонтальная плоскость)
  // - ставим нижнюю грань на Y = 0 (на сетку)
  model.position.x = -scaledCenter.x;
  model.position.y = -scaledBox.min.y; // нижняя грань на сетке
  model.position.z = -scaledCenter.z;

  // Обновляем сетку под размер модели
  updateGrid(scaledSize, 1); // scale уже применен к модели

  // Настраиваем камеру для оптимального просмотра
  updateCamera(model);
}

//function positionModel() {
//  if (!model) return;
//
//  const box = new THREE.Box3().setFromObject(model);
//  const size = box.getSize(new THREE.Vector3());
//  const center = box.getCenter(new THREE.Vector3());
//
//  const scale = calculateOptimalScale(size);
//
//  // Позиционирование (левый нижний угол в начале координат)
//  model.position.x = -center.x * scale + size.x/2 * scale;
//  model.position.y = -box.min.y * scale;
//  model.position.z = -center.z * scale + size.z/2 * scale;
//  model.scale.set(scale, scale, scale);
//
//  updateGrid(size, scale);
//
//  camera.position.z = size.length() * (isMobileDevice() ? 2.5 : 2);
//  controls.target.copy(new THREE.Vector3(0, size.y/2 * scale, 0));
//  controls.update();
//}

function updateModelInfo(size) {
  const dimensionsEl = document.querySelector('#modelDimensions p:first-child span');
  const sizeEl = document.querySelector('#modelDimensions p:last-child span');
  
  if (dimensionsEl && sizeEl) {
    dimensionsEl.textContent = `${size.x.toFixed(0)} × ${size.y.toFixed(0)} × ${size.z.toFixed(0)} mm`;
    sizeEl.textContent = `${Math.max(size.x, size.y, size.z).toFixed(0)} mm`;
  }
}

// ============================================================================
// РЕЖИМЫ ОТОБРАЖЕНИЯ
// ============================================================================

function setViewMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.btn-icon').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`${mode}Btn`).classList.add('active');
  
  if (!model) return;
  
  model.traverse((child) => {
    if (child.isMesh) {
      // Удаляем предыдущие края
      child.children.filter(c => c.userData.isEdge).forEach(edge => child.remove(edge));
      
      const materialOptions = getMaterialOptions(mode);
      child.material = new materialOptions.MaterialClass(materialOptions.options);
      
      // Добавляем края для shaded режима
      if (mode === 'shaded') {
        addEdges(child);
      }
    }
  });
}

function getMaterialOptions(mode) {
  const options = {
    wireframe: {
      MaterialClass: THREE.MeshBasicMaterial,
      options: { color: 0x000000, wireframe: true }
    },
    monochrome: {
      MaterialClass: THREE.MeshBasicMaterial,
      options: { color: 0x888888, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }
    },
    shaded: {
      MaterialClass: THREE.MeshStandardMaterial,
      options: { color: 0xffffff, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide }
    },
    rendered: {
      MaterialClass: THREE.MeshStandardMaterial,
      options: { color: 0x4361ee, roughness: 0.3, metalness: 0.1, side: THREE.DoubleSide }
    }
  };
  
  return options[mode];
}

function addEdges(mesh) {
  const edgesGeometry = new THREE.EdgesGeometry(mesh.geometry, 30);
  const edgesMaterial = new THREE.LineBasicMaterial({ 
    color: 0x000000, 
    linewidth: isMobileDevice() ? 1 : 2
  });
  const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
  edges.userData.isEdge = true;
  mesh.add(edges);
}

function applyViewMode() {
  setViewMode(currentMode);
}

function setStandardView(view) {
  if (!model) return;
  
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const distance = size * (isMobileDevice() ? 2.5 : 2);
  
  const viewPositions = {
    front: { pos: [center.x, center.y, center.z + distance], up: [0, 1, 0] },
    top: { pos: [center.x, center.y + distance, center.z], up: [0, 0, -1] },
    side: { pos: [center.x + distance, center.y, center.z], up: [0, 1, 0] }
  };
  
  const viewConfig = viewPositions[view];
  if (viewConfig) {
    camera.position.set(...viewConfig.pos);
    controls.target.copy(center);
    camera.up.set(...viewConfig.up);
    controls.update();
  }
}

// ============================================================================
// УПРАВЛЕНИЕ КАМЕРОЙ И АНИМАЦИЕЙ
// ============================================================================

function toggleRotation() {
  isRotating = !isRotating;
  document.getElementById('rotateBtn').classList.toggle('active');
}

function zoom(factor) {
  camera.fov *= factor;
  camera.fov = Math.max(10, Math.min(120, camera.fov)); // Ограничиваем зум
  camera.updateProjectionMatrix();
}

function resetView() {
  if (model) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    
    camera.position.copy(center);
    camera.position.z = size * (isMobileDevice() ? 2.5 : 2);
    controls.target.copy(center);
    camera.up.set(0, 1, 0);
  } else {
    camera.position.set(0, 0, 5);
    controls.target.set(0, 0, 0);
  }
  camera.fov = 75; // Сброс зума
  camera.updateProjectionMatrix();
  controls.update();
}

function onWindowResize() {
  updateRendererSize();
}

// Оптимизированная функция анимации
function animate() {
  const targetFPS = isMobileDevice() ? MOBILE_FPS : DESKTOP_FPS;
  const frameDelay = 1000 / targetFPS;
  
  setTimeout(() => {
    requestAnimationFrame(animate);
  }, frameDelay);
  
  if (isRotating && model) {
    model.rotation.y += isMobileDevice() ? 0.01 : 0.005;
  }
  
  controls.update();
  
  // Обновляем позиции меток только если они есть
  if (distanceLabels.length > 0) {
    distanceLabels.forEach(label => updateDistanceLabelPosition(label));
  }
  if (angleLabels.length > 0) {
    angleLabels.forEach(label => updateDistanceLabelPosition(label));
  }
  
  renderer.render(scene, camera);
}

// ============================================================================
// СИСТЕМА ИЗМЕРЕНИЙ
// ============================================================================

function toggleMeasurement() {
  isMeasuring = !isMeasuring;
  document.getElementById('measureBtn').classList.toggle('active');
  
  if (isMeasuring) {
    if (isMeasuringAngle) {
      toggleAngleMeasurement();
    }
    document.getElementById('viewer').style.cursor = "crosshair";
    clearMeasurements();
    document.getElementById('viewer').addEventListener('mousemove', throttle(onMouseMove, 50));
  } else {
    clearMeasurements();
    document.getElementById('viewer').style.cursor = "";
    document.getElementById('viewer').removeEventListener('mousemove', onMouseMove);
  }
}

function toggleAngleMeasurement() {
  isMeasuringAngle = !isMeasuringAngle;
  document.getElementById('angleBtn').classList.toggle('active');
  
  if (isMeasuringAngle) {
    if (isMeasuring) {
      toggleMeasurement();
    }
    document.getElementById('viewer').style.cursor = "crosshair";
    document.getElementById('viewer').addEventListener('mousemove', throttle(onMouseMove, 50));
  } else {
    clearAngleMeasurements();
    document.getElementById('viewer').style.cursor = "";
    document.getElementById('viewer').removeEventListener('mousemove', onMouseMove);
  }
}

function onMouseMove(event) {
  if ((!isMeasuring && !isMeasuringAngle) || !model) return;
  
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(model, true);
  
  document.getElementById('viewer').style.cursor = intersects.length > 0 ? "crosshair" : "not-allowed";
}

function onModelClick(event) {
  if (isMeasuring) {
    handleDistanceMeasurement(event);
  } else if (isMeasuringAngle) {
    handleAngleMeasurement(event);
  }
}

function handleDistanceMeasurement(event) {
  const point = getClickedPoint(event);
  if (!point) return;
  
  measurePoints.push(point);
  
  const pointMesh = createMeasurementPoint(point, 0xff0000, POINT_SIZE);
  scene.add(pointMesh);
  
  if (measurePoints.length === 2) {
    drawMeasurementLine(measurePoints[0], measurePoints[1]);
    measurePoints = [];
  }
}

function handleAngleMeasurement(event) {
  const point = getClickedPoint(event);
  if (!point) return;
  
  anglePoints.push(point);
  
  const color = anglePoints.length === 2 ? 0xFFFF00 : 0x00FF00;
  const pointMesh = createMeasurementPoint(point, color, ANGLE_POINT_SIZE);
  scene.add(pointMesh);
  angleHelpers.push(pointMesh);
  
  if (anglePoints.length === 2) {
    const line = createMeasurementLine(anglePoints[0], anglePoints[1], 0x0000FF);
    scene.add(line);
    angleHelpers.push(line);
  }
  
  if (anglePoints.length === 3) {
    drawAngleMeasurement(anglePoints);
    anglePoints = [];
  }
}

function getClickedPoint(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(model, true);
  
  return intersects.length > 0 ? intersects[0].point : null;
}

function createMeasurementPoint(position, color, size) {
  const geometry = new THREE.SphereGeometry(size, isMobileDevice() ? 8 : 16, isMobileDevice() ? 8 : 16);
  const material = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.userData.isHelper = true;
  return mesh;
}

function createMeasurementLine(point1, point2, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints([point1, point2]);
  const material = new THREE.LineBasicMaterial({ color, linewidth: isMobileDevice() ? 1 : 2 });
  const line = new THREE.Line(geometry, material);
  line.userData.isHelper = true;
  return line;
}

function drawMeasurementLine(point1, point2) {
  const line = createMeasurementLine(point1, point2, 0xff0000);
  scene.add(line);
  
  const distance = point1.distanceTo(point2);
  const midPoint = new THREE.Vector3().addVectors(point1, point2).multiplyScalar(0.5);
  
  const label = createDistanceLabel(`${distance.toFixed(2)} mm`, midPoint);
  distanceLabels.push(label);
  document.getElementById('viewer').appendChild(label);
}

function drawAngleMeasurement(points) {
  const line = createMeasurementLine(points[1], points[2], 0x0000FF);
  scene.add(line);
  angleHelpers.push(line);
  
  const angle = calculateAngle(points[0], points[1], points[2]);
  const midPoint = new THREE.Vector3()
    .addVectors(points[0], points[2])
    .multiplyScalar(0.5)
    .lerp(points[1], 0.5);
  
  const label = createDistanceLabel(`${angle}°`, midPoint, '#FF00FF');
  angleLabels.push(label);
  document.getElementById('viewer').appendChild(label);
}

function createDistanceLabel(text, worldPosition, color = '#000') {
  const label = document.createElement('div');
  label.className = 'distance-label';
  label.textContent = text;
  label.style.color = color;
  label.style.fontSize = isMobileDevice() ? '12px' : '14px';
  label.userData = { worldPosition: worldPosition.clone() };
  
  updateDistanceLabelPosition(label);
  return label;
}

function updateDistanceLabelPosition(label) {
  if (!label.userData?.worldPosition) return;
  
  const vector = label.userData.worldPosition.clone().project(camera);
  const x = (vector.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
  const y = (-(vector.y * 0.5) + 0.5) * renderer.domElement.clientHeight;
  
  label.style.left = `${x}px`;
  label.style.top = `${y}px`;
}

function calculateAngle(p1, p2, p3) {
  const v1 = new THREE.Vector3().subVectors(p1, p2).normalize();
  const v2 = new THREE.Vector3().subVectors(p3, p2).normalize();
  const angle = v1.angleTo(v2) * (180 / Math.PI);
  return angle.toFixed(1);
}

function clearMeasurements() {
  // Удаляем объекты из сцены
  const objectsToRemove = [];
  scene.traverse(child => {
    if (child.userData.isHelper || 
        (child.isMesh && child.material.color.getHex() === 0xff0000) ||
        (child.isLine && child.material.color.getHex() === 0xff0000)) {
      objectsToRemove.push(child);
    }
  });
  
  objectsToRemove.forEach(obj => {
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  
  measurePoints = [];
  distanceLabels.forEach(label => label.remove());
  distanceLabels = [];
}

function clearAngleMeasurements() {
  anglePoints = [];
  
  angleHelpers.forEach(helper => {
    if (helper.parent) {
      helper.parent.remove(helper);
    } else {
      scene.remove(helper);
    }
    if (helper.geometry) helper.geometry.dispose();
    if (helper.material) helper.material.dispose();
  });
  angleHelpers = [];
  
  angleLabels.forEach(label => label.remove());
  angleLabels = [];
}

// ============================================================================
// СИСТЕМА СТАТЕЙ
// ============================================================================

let currentArticleId = '';

function showArticleModal(markdown, articleId) {
  currentArticleId = articleId;
  const articleCard = document.querySelector(`.article-card[data-article="${articleId}"]`);
  const articleTitle = articleCard.querySelector('h4').textContent;
  
  const content = marked.parse(markdown);
  const modal = document.createElement('div');
  modal.className = 'article-modal';
  
  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${articleTitle}</h3>
      <button class="close-modal">&times;</button>
    </div>
    <div class="article-body">${content}</div>
    <div class="modal-footer">
      <button class="nav-button prev" ${!articleCard.dataset.prev ? 'disabled' : ''}>
        ${articleCard.dataset.prev ? document.querySelector(`.article-card[data-article="${articleCard.dataset.prev}"] h4`).textContent : 'Нет предыдущей'}
      </button>
      <button class="nav-button next" ${!articleCard.dataset.next ? 'disabled' : ''}>
        ${articleCard.dataset.next ? document.querySelector(`.article-card[data-article="${articleCard.dataset.next}"] h4`).textContent : 'Нет следующей'}
      </button>
    </div>
  `;
  
  // Навигация с debounce
  modal.querySelector('.prev').addEventListener('click', debounce(() => {
    if (articleCard.dataset.prev) {
      loadArticle(articleCard.dataset.prev);
      modal.remove();
    }
  }, 300));
  
  modal.querySelector('.next').addEventListener('click', debounce(() => {
    if (articleCard.dataset.next) {
      loadArticle(articleCard.dataset.next);
      modal.remove();
    }
  }, 300));
  
  // Анимация появления
  modal.style.opacity = '0';
  modal.style.transform = 'translateX(20px)';
  document.body.appendChild(modal);
  
  requestAnimationFrame(() => {
    modal.style.opacity = '1';
    modal.style.transform = 'translateX(0)';
  });
  
  // Закрытие с анимацией
  modal.querySelector('.close-modal').addEventListener('click', () => {
    modal.style.opacity = '0';
    modal.style.transform = 'translateX(20px)';
    setTimeout(() => {
      modal.remove();
      currentArticleId = '';
    }, 300);
  });
}

async function loadArticle(articleId) {
  document.querySelectorAll('.article-card').forEach(card => {
    card.classList.remove('active');
  });
  
  const currentCard = document.querySelector(`.article-card[data-article="${articleId}"]`);
  if (currentCard) {
    currentCard.classList.add('active');
  }
  
  try {
    const response = await fetch(`/articles/${articleId}.md`);
    const markdown = await response.text();
    showArticleModal(markdown, articleId);
  } catch (error) {
    console.error('Error loading article:', error);
  }
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================================================

window.addEventListener('load', init);