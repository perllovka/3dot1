const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());

// Создаем папки если их нет
const modelsDir = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

// Маршрут загрузки
app.post('/upload', (req, res) => {
  if (!req.files || !req.files.model) {
    return res.status(400).send('No file uploaded');
  }

  const file = req.files.model;
  const fileName = `model_${Date.now()}${path.extname(file.name)}`;
  const filePath = path.join(modelsDir, fileName);

  file.mv(filePath, (err) => {
    if (err) {
      console.error('File save error:', err);
      return res.status(500).send(err.message);
    }
    
    console.log('File saved to:', filePath);
    res.json({ 
      success: true,
      modelUrl: `/models/${fileName}`
    });
  });
});


// Добавьте статическую папку для моделей
app.use('/models', express.static(path.join(__dirname, 'models')));

app.get('/models/:modelName', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'models', req.params.modelName));
});


app.get('/articles/:id', (req, res) => {
  try {
    const articlePath = path.join(__dirname, 'articles', `${req.params.id}.md`);
    const markdown = fs.readFileSync(articlePath, 'utf-8');
    res.send(markdown);
  } catch (error) {
    res.status(404).send('Article not found');
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Models directory: ${modelsDir}`);
});


