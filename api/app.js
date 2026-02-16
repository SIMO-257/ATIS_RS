// APP.JS
const express = require('express');
const cors = require('cors');
const { connectDB} = require('./db');
const adminRoutes = require('./Routes/adminRoutes');
const candidateRoutes = require('./Routes/candidateRoutes');
const extractorRoutes = require('./Routes/extractorRoutes');
const formRoutes = require('./Routes/formRoutes');
const hiringRoutes = require('./Routes/hiringRoutes');
const refusedRoutes = require('./Routes/refusedRoutes'); // New
const departRoutes = require('./Routes/departRoutes');   // New
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'uploads' directory (for MinIO)
app.use('/uploads', express.static('uploads'));
// Also serve the temporary uploads for multer disk storage
app.use('/temp_uploads', express.static(path.join(__dirname, 'temp_uploads')));

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/extract', extractorRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/hiring', hiringRoutes);
app.use('/api/refused', refusedRoutes); // New
app.use('/api/depart', departRoutes);     // New

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        error: err.message || 'Something went wrong!' 
    });
});

const PORT = process.env.PORT || 5000;

// Only start the server if app.js is run directly (not imported)
if (require.main === module) {
    connectDB().then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 API available at http://localhost:${PORT}`);
        console.log(`MongoDB connecte`);
      });
    }).catch(err => {
      console.error('Erreur de connexion MongoDB:', err);
      process.exit(1);
    });
}

module.exports = app;