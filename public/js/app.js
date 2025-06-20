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

// Инициализация
function init() {
  // Сцена
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf9f9f9);
  
  // Камера
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;
  
  // Рендерер
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('viewer').appendChild(renderer.domElement);
  
  // Освещение
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);
  
  // Управление
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  
  // Сетка (будем масштабировать при загрузке модели)
  gridHelper = new THREE.GridHelper(10, 10);
  scene.add(gridHelper);
  
  // Оси
  axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);
  
  // Обработчики
  window.addEventListener('resize', onWindowResize);
  document.getElementById('viewer').addEventListener('click', onModelClick);
  
  // Инициализация UI
  setupUI();
  
  // Анимация
  animate();
}

// Настройка UI
function setupUI() {
  // Загрузка модели
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
      loadModel(data.modelUrl);
    } catch (error) {
      console.error('Upload error:', error);
    }
  });
  
  // Кнопки управления
  document.getElementById('rotateBtn').addEventListener('click', toggleRotation);
  document.getElementById('resetBtn').addEventListener('click', resetView);
  document.getElementById('zoomInBtn').addEventListener('click', () => zoom(0.8));
  document.getElementById('zoomOutBtn').addEventListener('click', () => zoom(1.2));

  
  // Режимы отображения
  document.getElementById('wireframeBtn').addEventListener('click', () => setViewMode('wireframe'));
  document.getElementById('monochromeBtn').addEventListener('click', () => setViewMode('monochrome'));
  document.getElementById('shadedBtn').addEventListener('click', () => setViewMode('shaded'));
  document.getElementById('renderedBtn').addEventListener('click', () => setViewMode('rendered'));
  
  // Toggle options
  document.getElementById('toggleGrid').addEventListener('change', (e) => {
    gridHelper.visible = e.target.checked;
  });
  
  document.getElementById('toggleAxes').addEventListener('change', (e) => {
    axesHelper.visible = e.target.checked;
  });
  
  // Standard views
  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      setStandardView(view);
    });
  });
  const toggleBtn = document.getElementById('toggleSidebar');
  toggleBtn.addEventListener('click', toggleSidebar);


    // Табы библиотеки
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

document.querySelectorAll('.btn-load').forEach(btn => {
  btn.addEventListener('click', async function() {
    const modelItem = this.closest('.model-item');
    const modelName = modelItem.dataset.model;
    
    // Визуальная обратная связь
    const originalText = this.textContent;
    this.textContent = 'Loading...';
    this.disabled = true;
    
    try {
      await loadFromLibrary(modelName);
      
      // Помечаем загруженную модель
      document.querySelectorAll('.model-item').forEach(item => {
        item.classList.remove('active');
      });
      modelItem.classList.add('active');
      
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      this.textContent = originalText;
      this.disabled = false;
    }
  });
});

document.getElementById('modelSearch').addEventListener('input', function() {
  const searchTerm = this.value.toLowerCase();
  document.querySelectorAll('.model-item').forEach(item => {
    const modelName = item.querySelector('.model-name').textContent.toLowerCase();
    item.style.display = modelName.includes(searchTerm) ? 'flex' : 'none';
  });
});

document.querySelectorAll('.clickable-article').forEach(card => {
    card.addEventListener('click', async (e) => {
      // Проверяем, не было ли клика по внутренним элементам, которые не должны триггерить открытие
      if (e.target.tagName === 'A' || e.target.classList.contains('no-trigger')) {
        return;
      }
      
      const articleId = card.dataset.article;
      loadArticle(articleId);
    });
  });


  document.getElementById('measureBtn').addEventListener('click', function() {
    if (isMeasuringAngle) {
      clearAngleMeasurements(); // Очищаем измерения углов при включении измерения расстояний
    }
    toggleMeasurement();
  });
  
  document.getElementById('angleBtn').addEventListener('click', function() {
    if (isMeasuring) {
      clearMeasurements(); // Очищаем измерения расстояний при включении измерения углов
    }
    toggleAngleMeasurement();
  });

}



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
  

  
  // Навигация
  modal.querySelector('.prev').addEventListener('click', () => {
    if (articleCard.dataset.prev) {
      loadArticle(articleCard.dataset.prev);
      modal.remove();
    }
  });
  
  modal.querySelector('.next').addEventListener('click', () => {
    if (articleCard.dataset.next) {
      loadArticle(articleCard.dataset.next);
      modal.remove();
    }
  });
  
  modal.style.opacity = '0';
  modal.style.transform = 'translateX(20px)';
  document.body.appendChild(modal);
  
  setTimeout(() => {
    modal.style.opacity = '1';
    modal.style.transform = 'translateX(0)';
  }, 10);
  
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
  // Удаляем активный класс у всех статей
  document.querySelectorAll('.article-card').forEach(card => {
    card.classList.remove('active');
  });
  
  // Добавляем активный класс текущей статье
  const currentCard = document.querySelector(`.article-card[data-article="${articleId}"]`);
  if (currentCard) {
    currentCard.classList.add('active');
  }
  
  // Остальной код загрузки статьи
  try {
    const response = await fetch(`/articles/${articleId}.md`);
    const markdown = await response.text();
    showArticleModal(markdown, articleId);
  } catch (error) {
    console.error('Error loading article:', error);
  }
}




async function loadFromLibrary(modelName) {
  try {
    // Показываем индикатор загрузки
    document.getElementById('viewer').style.opacity = '0.5';
    
    // Загружаем модель
    const response = await fetch(`/models/${modelName}.obj`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const text = await response.text();
    const loader = new THREE.OBJLoader();
    const object = loader.parse(text);
 
    
    // Очищаем предыдущую модель
    if (model) {
      scene.remove(model);
      // Освобождаем ресурсы
      model.traverse(child => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material.dispose) child.material.dispose();
        }
      });
    }
    
    // Устанавливаем новую модель
    model = object;
    currentFilename = `${modelName}.obj`;
    updateFilenameDisplay();
    
    // Позиционируем и добавляем модель
    positionModel(); // Теперь эта функция определена
    scene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    updateModelInfo(size);
    
    // Применяем текущий режим отображения
    applyViewMode();
    
document.querySelectorAll('.model-item').forEach(item => {
  item.classList.remove('active');
  if (item.dataset.model === modelName) {
    item.classList.add('active');
  }
});

    // Добавляем в историю
  //  addToHistory(currentFilename, text);
    
  } catch (error) {
    console.error('Error loading model:', error);
    alert(`Failed to load model: ${error.message}`);
  } finally {
    document.getElementById('viewer').style.opacity = '1';


  }
}

function updateFilenameDisplay() {
  const display = document.getElementById('filename-display');
  display.textContent = currentFilename ? ` • ${currentFilename}` : '';
}

// Новая версия функции toggleSidebar
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const viewerContainer = document.querySelector('.viewer-container');
  const toggleBtn = document.getElementById('toggleSidebar');
  
  // Переключаем состояние
  const isCollapsing = !sidebar.classList.contains('collapsed');
  
  // Обновляем классы
  sidebar.classList.toggle('collapsed');
  toggleBtn.classList.toggle('collapsed');
  
  // Обновляем иконку
  const icon = toggleBtn.querySelector('i');
  icon.classList.toggle('fa-chevron-left');
  icon.classList.toggle('fa-chevron-right');
  
  // Позиционируем кнопку
  toggleBtn.style.left = isCollapsing ? '0px' : `${sidebar.offsetWidth}px`;
  
  // Обновляем область просмотра
  viewerContainer.style.marginLeft = isCollapsing ? `-${sidebar.offsetWidth}px` : '0';
}

function setStandardView(view) {
  if (!model) return;
  
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  
  switch(view) {
    case 'front':
      camera.position.set(center.x, center.y, center.z + size * 2);
      controls.target.copy(center);
      camera.up.set(0, 1, 0);
      break;
    case 'top':
      camera.position.set(center.x, center.y + size * 2, center.z);
      controls.target.copy(center);
      camera.up.set(0, 0, -1);
      break;
    case 'side':
      camera.position.set(center.x + size * 2, center.y, center.z);
      controls.target.copy(center);
      camera.up.set(0, 1, 0);
      break;
  }
  controls.update();
}

function loadModel(url) {
  if (model) {
    scene.remove(model);
    clearMeasurements();
  }

  const loader = new THREE.OBJLoader();
  loader.load(url, (object) => {
    model = object;
    applyViewMode();

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Update model info
    updateModelInfo(size);

    // Масштабирование
    let scale = 1;
    const maxSize = Math.max(size.x, size.y, size.z);
    if (maxSize > 10) scale = 10 / maxSize;

    // Центрирование и размещение на сетке
    model.position.sub(center);
    
    // Точка отсчета в левом нижнем углу модели
    model.position.x += size.x/2 * scale;
    model.position.y -= box.min.y * scale;
    model.position.z += size.z/2 * scale;
    
    model.scale.set(scale, scale, scale);

    // Обновляем сетку
    const modelWidth = size.x * scale;
    const modelDepth = size.z * scale;
    const gridSize = Math.max(10, modelWidth, modelDepth) * 1.5;

    gridHelper.scale.set(gridSize, 1, gridSize);
    gridHelper.position.y = 0;

    // Обновляем камеру
    const newBox = new THREE.Box3().setFromObject(model);
    const newSize = newBox.getSize(new THREE.Vector3()).length();
    
    camera.position.z = newSize * 2;
    controls.target.copy(newBox.getCenter(new THREE.Vector3()));
    controls.update();

    scene.add(model);
  }, undefined, (error) => {
    console.error('Error loading model:', error);
  });
}


function positionModel() {
  if (!model) return;

  // 1. Создаем ограничивающую рамку для модели
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // 2. Вычисляем масштаб для нормализации размера модели
  let scale = 1;
  const maxSize = Math.max(size.x, size.y, size.z);
  if (maxSize > 10) scale = 10 / maxSize;

  // 3. Позиционируем модель (левый нижний угол в начале координат)
  model.position.x = -center.x * scale + size.x/2 * scale;
  model.position.y = -box.min.y * scale; // Опускаем на уровень сетки
  model.position.z = -center.z * scale + size.z/2 * scale;
  model.scale.set(scale, scale, scale);

  // 4. Настраиваем сетку под размер модели
  const gridSize = Math.max(10, size.x * scale, size.z * scale) * 1.5;
  gridHelper.scale.set(gridSize, 1, gridSize);
  gridHelper.position.y = 0;

  // 5. Настраиваем камеру
  camera.position.z = size.length() * 2;
  controls.target.copy(new THREE.Vector3(0, size.y/2 * scale, 0));
  controls.update();
}

function updateModelInfo(size) {
  const dimensionsEl = document.querySelector('#modelDimensions p:first-child span');
  const sizeEl = document.querySelector('#modelDimensions p:last-child span');
  
  dimensionsEl.textContent = `${(size.x).toFixed(0)} × ${(size.y).toFixed(0)} × ${(size.z).toFixed(0)} mm`;
  sizeEl.textContent = `${Math.max(size.x, size.y, size.z).toFixed(0)} mm`;
}

function setViewMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.btn-icon').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`${mode}Btn`).classList.add('active');
  
  if (!model) return;
  
  model.traverse((child) => {
    if (child.isMesh) {
      child.children.filter(c => c.userData.isEdge).forEach(edge => child.remove(edge));
      
      switch (currentMode) {
        case 'wireframe':
          child.material = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            wireframe: true
          });
          break;
          
        case 'monochrome':
          child.material = new THREE.MeshBasicMaterial({ 
            color: 0x888888,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
          });
          break;
          
        case 'shaded':
          child.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.1,
            side: THREE.DoubleSide
          });
          
          const edgesGeometry = new THREE.EdgesGeometry(child.geometry, 30); // Увеличен угол для большего количества ребер
          const edgesMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000, 
            linewidth: 2 // Более толстые линии
          });
          const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
          edges.userData.isEdge = true;
          child.add(edges);
          break;
          
        case 'rendered':
          child.material = new THREE.MeshStandardMaterial({
            color: 0x4361ee,
            roughness: 0.3,
            metalness: 0.1,
            side: THREE.DoubleSide
          });
          break;
      }
    }
  });
}

function applyViewMode() {
  setViewMode(currentMode);
}

// Функции управления
function toggleRotation() {
  isRotating = !isRotating;
  document.getElementById('rotateBtn').classList.toggle('active');
}

function zoom(factor) {
  camera.fov *= factor;
  camera.updateProjectionMatrix();
}

function resetView() {
  if (model) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    
    camera.position.copy(center);
    camera.position.z = size * 2;
    controls.target.copy(center);
    camera.up.set(0, 1, 0);
  } else {
    camera.position.set(0, 0, 5);
    controls.target.set(0, 0, 0);
  }
  controls.update();
}


function toggleMeasurement() {
  isMeasuring = !isMeasuring;
  document.getElementById('measureBtn').classList.toggle('active');
  
  if (isMeasuring) {
    // Если включаем измерение расстояния, выключаем измерение углов
    if (isMeasuringAngle) {
      toggleAngleMeasurement();
    }
    document.getElementById('viewer').style.cursor = "crosshair";
    clearMeasurements(); // Очищаем предыдущие измерения
    document.getElementById('viewer').addEventListener('mousemove', onMouseMove);
  } else {
    // При выключении очищаем ВСЕ точки, включая последнюю
    clearMeasurements();
    document.getElementById('viewer').style.cursor = "";
    document.getElementById('viewer').removeEventListener('mousemove', onMouseMove);
  }
}

function onMouseMove(event) {
  if (!isMeasuring || !model) return;
  
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  // Проверяем пересечение с моделью
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(model, true);
  
  if (intersects.length > 0) {
    // Меняем курсор при наведении на ребро/вершину
    document.getElementById('viewer').style.cursor = "crosshair";
  } else {
    document.getElementById('viewer').style.cursor = "not-allowed";
  }
}

function onModelClick(event) {
 if (isMeasuring) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(model, true);
    
    if (intersects.length > 0) {
      const point = intersects[0].point;
      measurePoints.push(point);
      
      // Создаем точку (увеличиваем размер)
      const pointGeometry = new THREE.SphereGeometry(0.04, 16, 16);
      const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial);
      pointMesh.position.copy(point);
      pointMesh.userData.isHelper = true;
      scene.add(pointMesh);
      
      if (measurePoints.length === 2) {
        drawMeasurementLine(measurePoints[0], measurePoints[1]);
        measurePoints = []; // Очищаем точки после создания линии
      }
    }
} else if (isMeasuringAngle) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(model, true);
    
    if (intersects.length > 0) {
      const point = intersects[0].point;
      anglePoints.push(point);
      
      // Создаем точку сразу после клика (увеличиваем размер в 2 раза)
      const pointGeometry = new THREE.SphereGeometry(0.02, 16, 16); // Было 0.02
      const pointMaterial = new THREE.MeshBasicMaterial({ 
        color: anglePoints.length === 2 ? 0xFFFF00 : 0x00FF00
      });
      const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial);
      pointMesh.position.copy(point);
      scene.add(pointMesh);
      angleHelpers.push(pointMesh);
      
      // Если это вторая точка, рисуем первую линию
      if (anglePoints.length === 2) {
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000FF, linewidth: 2 });
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([anglePoints[0], anglePoints[1]]);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(line);
        angleHelpers.push(line);
      }
      
      // Если это третья точка, завершаем измерение
      if (anglePoints.length === 3) {
        drawAngleMeasurement(anglePoints);
        anglePoints = [];
      }
    }
  }
}

function drawMeasurementLine(point1, point2) {
  // Создаем линию
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([point1, point2]);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
  const line = new THREE.Line(lineGeometry, lineMaterial);
  line.userData.isHelper = true;
  scene.add(line);
  
  // Вычисляем расстояние (в метрах)
  const distance = point1.distanceTo(point2);
  
  // Создаем текст с расстоянием
  const midPoint = new THREE.Vector3().addVectors(point1, point2).multiplyScalar(0.5);
  
  const distanceText = document.createElement('div');
  distanceText.className = 'distance-label';
  distanceText.textContent = `${distance.toFixed(2)} mm`;
  
  // Сохраняем позицию в мировых координатах
  distanceText.userData = { worldPosition: midPoint.clone() };
  distanceLabels.push(distanceText);
  
  updateDistanceLabelPosition(distanceText);
  document.getElementById('viewer').appendChild(distanceText);
}

function updateDistanceLabelPosition(label) {
  const vector = label.userData.worldPosition.clone().project(camera);
  const x = (vector.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
  const y = (-(vector.y * 0.5) + 0.5) * renderer.domElement.clientHeight;
  
  label.style.left = `${x}px`;
  label.style.top = `${y}px`;
}

function clearMeasurements() {
  // Удаляем все точки и линии
  scene.children.forEach(child => {
    if (child.userData.isHelper || 
        (child.isMesh && child.material.color.getHex() === 0xff0000) || // Красные точки измерения
        (child.isLine && child.material.color.getHex() === 0xff0000)) { // Красные линии измерения
      scene.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
  });
  
  // Очищаем массивы
  measurePoints = [];
  
  // Удаляем все метки
  distanceLabels.forEach(label => label.remove());
  distanceLabels = [];
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  
  if (isRotating && model) model.rotation.y += 0.005;
  controls.update();
  
  // Обновляем позиции всех меток расстояний и углов
  distanceLabels.forEach(label => updateDistanceLabelPosition(label));
  angleLabels.forEach(label => updateDistanceLabelPosition(label));
  
  renderer.render(scene, camera);
}



function toggleAngleMeasurement() {
  isMeasuringAngle = !isMeasuringAngle;
  document.getElementById('angleBtn').classList.toggle('active');
  
  if (isMeasuringAngle) {
    // Если включаем измерение углов, выключаем измерение расстояния
    if (isMeasuring) {
      toggleMeasurement();
    }
    document.getElementById('viewer').style.cursor = "crosshair";
    document.getElementById('viewer').addEventListener('mousemove', onMouseMove);
  } else {
    // При выключении очищаем измерения
    clearAngleMeasurements();
    document.getElementById('viewer').style.cursor = "";
    document.getElementById('viewer').removeEventListener('mousemove', onMouseMove);
  }
}

function clearAngleMeasurements() {
  anglePoints = [];
  
  // Удаляем все вспомогательные элементы углов
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
  
  // Удаляем все метки углов
  angleLabels.forEach(label => label.remove());
  angleLabels = [];
}

function calculateAngle(p1, p2, p3) {
  const v1 = new THREE.Vector3().subVectors(p1, p2);
  const v2 = new THREE.Vector3().subVectors(p3, p2);
  
  v1.normalize();
  v2.normalize();
  
  const angle = v1.angleTo(v2) * (180 / Math.PI);
  return angle.toFixed(1);
}

function drawAngleMeasurement(points) {
  // Вторая линия (от второй точки к третьей)
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000FF, linewidth: 2 });
  const line2Geometry = new THREE.BufferGeometry().setFromPoints([points[1], points[2]]);
  const line2 = new THREE.Line(line2Geometry, lineMaterial);
  scene.add(line2);
  angleHelpers.push(line2);
  
  // Вычисляем угол
  const angle = calculateAngle(points[0], points[1], points[2]);
  
  // Позиция для метки угла
  const midPoint = new THREE.Vector3()
    .addVectors(points[0], points[2])
    .multiplyScalar(0.5)
    .lerp(points[1], 0.5);
  
  // Создаем метку угла
  const angleText = document.createElement('div');
  angleText.className = 'distance-label';
  angleText.textContent = `${angle}°`;
  angleText.style.color = '#FF00FF';
  angleText.style.fontSize = '14px'; // Увеличиваем шрифт
  
  angleText.userData = { worldPosition: midPoint.clone() };
  angleLabels.push(angleText);
  
  updateDistanceLabelPosition(angleText);
  document.getElementById('viewer').appendChild(angleText);
}


window.onload = init;