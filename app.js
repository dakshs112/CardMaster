const express = require('express')
const app = express()
const path = require('path')

// Environment variables with defaults
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'development'

// In-memory storage for users (will reset when server restarts)
let users = [
    {
        _id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face'
    },
    {
        _id: '2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face'
    }
]

// Counter for generating IDs
let userIdCounter = 3

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

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...')
    process.exit(0)
})

process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...')
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
app.get('/read', (req, res) => {
    try {
        res.render('read', { users })
    } catch (error) {
        console.error('Error fetching users:', error)
        res.status(500).json({ 
            error: 'Failed to fetch users',
            message: NODE_ENV === 'development' ? error.message : 'Failed to load users'
        })
    }
})

// Delete user route
app.get('/delete/:id', (req, res) => {
    try {
        const userId = req.params.id
        const userIndex = users.findIndex(user => user._id === userId)
        
        if (userIndex === -1) {
            return res.status(404).json({
                error: 'User not found',
                message: 'The user you are trying to delete does not exist'
            })
        }

        const deletedUser = users.splice(userIndex, 1)[0]
        console.log(`User deleted: ${deletedUser.name} (${deletedUser._id})`)
        res.redirect('/read')
    } catch (error) {
        console.error('Error deleting user:', error)
        res.status(500).json({ 
            error: 'Failed to delete user',
            message: NODE_ENV === 'development' ? error.message : 'Delete operation failed'
        })
    }
})

// Edit user form route
app.get('/edit/:id', (req, res) => {
    try {
        const userId = req.params.id
        const user = users.find(user => user._id === userId)
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'The user you are trying to edit does not exist'
            })
        }

        res.render('edit', { user })
    } catch (error) {
        console.error('Error fetching user for edit:', error)
        res.status(500).json({ 
            error: 'Failed to load user data',
            message: NODE_ENV === 'development' ? error.message : 'Failed to load user'
        })
    }
})

// Update user route
app.post('/update/:id', (req, res) => {
    try {
        const userId = req.params.id
        const userIndex = users.findIndex(user => user._id === userId)
        
        if (userIndex === -1) {
            return res.status(404).json({
                error: 'User not found',
                message: 'The user you are trying to update does not exist'
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

        // Check for duplicate email (excluding current user)
        const duplicateUser = users.find(user => 
            user.email.toLowerCase() === email.trim().toLowerCase() && user._id !== userId
        )
        if (duplicateUser) {
            return res.status(409).json({
                error: 'Email already exists',
                message: 'Another user with this email address already exists'
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

        // Update user
        users[userIndex] = {
            ...users[userIndex],
            name: name.trim(),
            email: email.trim().toLowerCase(),
            image: image ? image.trim() : ''
        }

        console.log(`User updated: ${users[userIndex].name} (${users[userIndex]._id})`)
        res.redirect('/read')
    } catch (error) {
        console.error('Error updating user:', error)
        res.status(500).json({ 
            error: 'Failed to update user',
            message: NODE_ENV === 'development' ? error.message : 'Update operation failed'
        })
    }
})

// Create user route
app.post('/create', (req, res) => {
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
        const existingUser = users.find(user => 
            user.email.toLowerCase() === email.trim().toLowerCase()
        )
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

        // Create new user
        const newUser = {
            _id: userIdCounter.toString(),
            name: name.trim(),
            email: email.trim().toLowerCase(),
            image: image ? image.trim() : ''
        }

        users.push(newUser)
        userIdCounter++

        console.log(`User created: ${newUser.name} (${newUser._id})`)
        res.redirect('/read')
    } catch (error) {
        console.error('Error creating user:', error)
        res.status(500).json({ 
            error: 'Failed to create user',
            message: NODE_ENV === 'development' ? error.message : 'Create operation failed'
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
        environment: NODE_ENV,
        totalUsers: users.length
    })
})

// API endpoint to get users as JSON
app.get('/api/users', (req, res) => {
    res.json({
        success: true,
        count: users.length,
        data: users
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
    console.log(`Started with ${users.length} sample users`)
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
