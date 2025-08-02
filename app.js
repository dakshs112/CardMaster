const express = require('express')
const app = express()
const path = require('path')
const mongoose = require('mongoose')
const user = require('./model/user')

// Environment variables with defaults
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'development'
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/testapp1'

// Trust proxy for deployment platforms like Render, Heroku, etc.
app.set('trust proxy', 1)

// Security middleware (recommended for production)
app.use((req, res, next) => {
    // Basic security headers
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
})

// Request logging middleware (development only)
if (NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
        next()
    })
}

// View engine setup
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// Body parsing middleware with size limits
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Static files middleware
app.use(express.static(path.join(__dirname, 'public')))

// Database connection with better error handling
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
})

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err)
})

mongoose.connection.on('connected', () => {
    console.log('Successfully connected to MongoDB')
})

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected')
})

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...')
    await mongoose.connection.close()
    process.exit(0)
})

process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...')
    await mongoose.connection.close()
    process.exit(0)
})

// Routes

// Home route
app.get('/', (req, res) => {
    try {
        res.render('index')
    } catch (error) {
        console.error('Error rendering index page:', error)
        res.status(500).json({ 
            error: 'Failed to load page',
            message: NODE_ENV === 'development' ? error.message : 'Internal server error'
        })
    }
})

// Read all users route
app.get('/read', async (req, res) => {
    try {
        const users = await user.find().lean() // .lean() for better performance
        res.render('read', { users })
    } catch (error) {
        console.error('Error fetching users:', error)
        res.status(500).json({ 
            error: 'Failed to fetch users',
            message: NODE_ENV === 'development' ? error.message : 'Database connection error'
        })
    }
})

// Delete user route
app.get('/delete/:id', async (req, res) => {
    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                error: 'Invalid user ID',
                message: 'The provided user ID is not valid'
            })
        }

        const deletedUser = await user.findByIdAndDelete(req.params.id)
        
        if (!deletedUser) {
            return res.status(404).json({
                error: 'User not found',
                message: 'The user you are trying to delete does not exist'
            })
        }

        console.log(`User deleted: ${deletedUser.name} (${deletedUser._id})`)
        res.redirect('/read')
    } catch (error) {
        console.error('Error deleting user:', error)
        res.status(500).json({ 
            error: 'Failed to delete user',
            message: NODE_ENV === 'development' ? error.message : 'Database operation failed'
        })
    }
})

// Edit user form route
app.get('/edit/:id', async (req, res) => {
    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                error: 'Invalid user ID',
                message: 'The provided user ID is not valid'
            })
        }

        const userToEdit = await user.findById(req.params.id).lean()
        
        if (!userToEdit) {
            return res.status(404).json({
                error: 'User not found',
                message: 'The user you are trying to edit does not exist'
            })
        }

        res.render('edit', { user: userToEdit })
    } catch (error) {
        console.error('Error fetching user for edit:', error)
        res.status(500).json({ 
            error: 'Failed to load user data',
            message: NODE_ENV === 'development' ? error.message : 'Database connection error'
        })
    }
})

// Update user route
app.post('/update/:id', async (req, res) => {
    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                error: 'Invalid user ID',
                message: 'The provided user ID is not valid'
            })
        }

        // Input validation
        const { name, email, image } = req.body

        if (!name || !email) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Name and email are required fields'
            })
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Invalid email format',
                message: 'Please provide a valid email address'
            })
        }

        // URL validation for image (if provided)
        if (image && image.trim()) {
            try {
                new URL(image.trim())
            } catch (urlError) {
                return res.status(400).json({
                    error: 'Invalid image URL',
                    message: 'Please provide a valid image URL'
                })
            }
        }

        const updatedUser = await user.findByIdAndUpdate(
            req.params.id,
            { 
                name: name.trim(), 
                email: email.trim().toLowerCase(), 
                image: image ? image.trim() : '' 
            },
            { new: true, runValidators: true }
        )

        if (!updatedUser) {
            return res.status(404).json({
                error: 'User not found',
                message: 'The user you are trying to update does not exist'
            })
        }

        console.log(`User updated: ${updatedUser.name} (${updatedUser._id})`)
        res.redirect('/read')
    } catch (error) {
        console.error('Error updating user:', error)
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Validation Error',
                message: Object.values(error.errors).map(e => e.message).join(', ')
            })
        }

        res.status(500).json({ 
            error: 'Failed to update user',
            message: NODE_ENV === 'development' ? error.message : 'Database operation failed'
        })
    }
})

// Create user route
app.post('/create', async (req, res) => {
    try {
        // Input validation
        const { name, email, image } = req.body

        if (!name || !email) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Name and email are required fields'
            })
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Invalid email format',
                message: 'Please provide a valid email address'
            })
        }

        // Check for duplicate email
        const existingUser = await user.findOne({ email: email.trim().toLowerCase() })
        if (existingUser) {
            return res.status(409).json({
                error: 'Email already exists',
                message: 'A user with this email address already exists'
            })
        }

        // URL validation for image (if provided)
        if (image && image.trim()) {
            try {
                new URL(image.trim())
            } catch (urlError) {
                return res.status(400).json({
                    error: 'Invalid image URL',
                    message: 'Please provide a valid image URL'
                })
            }
        }

        const createdUser = await user.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            image: image ? image.trim() : ''
        })

        console.log(`User created: ${createdUser.name} (${createdUser._id})`)
        res.redirect('/read')
    } catch (error) {
        console.error('Error creating user:', error)
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Validation Error',
                message: Object.values(error.errors).map(e => e.message).join(', ')
            })
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            return res.status(409).json({
                error: 'Duplicate Entry',
                message: 'A user with this information already exists'
            })
        }

        res.status(500).json({ 
            error: 'Failed to create user',
            message: NODE_ENV === 'development' ? error.message : 'Database operation failed'
        })
    }
})

// Create user form route
app.get('/create', (req, res) => {
    try {
        res.render('create')
    } catch (error) {
        console.error('Error rendering create page:', error)
        res.status(500).json({ 
            error: 'Failed to load page',
            message: NODE_ENV === 'development' ? error.message : 'Internal server error'
        })
    }
})

// Health check endpoint (useful for deployment platforms)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        environment: NODE_ENV
    })
})

// 404 handler - must be after all other routes
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Page Not Found',
        message: `The page ${req.originalUrl} does not exist`
    })
})

// Global error handler - must be last
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error)
    res.status(500).json({
        error: 'Internal Server Error',
        message: NODE_ENV === 'development' ? error.message : 'Something went wrong'
    })
})

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`Environment: ${NODE_ENV}`)
    console.log(`Access the app at: http://localhost:${PORT}`)
})

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`)
        process.exit(1)
    } else {
        console.error('Server error:', error)
        process.exit(1)
    }
})
