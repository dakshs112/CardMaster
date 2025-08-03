const express = require('express')
const app = express()
const path = require('path')

// Env Bana diye
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'development'

// Default wale
let users = [
    {
        _id: '1',
        name: 'Daksh Sharma',
        email: 'dakshs112@gmail.com',
        image: 'https://t4.ftcdn.net/jpg/01/80/57/69/360_F_180576920_TfIdXSmoBfzW8PaPfxqO1JdYtUYLIpUc.jpg'
    },
    {
        _id: '2',
        name: 'The Creator',
        email: 'Tanjiro@DS.com',
        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBc6_ixylZKPo97MXdP_m33BtHlopHUNjBtg&s'
    }
]

// Counter for saari generating IDs
let userIdCounter = 3

// Trust proxy for deployment platforms like Render, Heroku, etc.
app.set('trust proxy', 1)

// Middleware Security ke liye
app.use((req, res, next) => {
    // Basic security headers
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
})

// Track middlewares par sirf mere dev ke time
if (NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
        next()
    })
}

// View engine lagana
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// Body ki  parsing of middleware within limits
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Static files middleware
app.use(express.static(path.join(__dirname, 'public')))

// Smoothy AF shutdown ke liye
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...')
    process.exit(0)
})

process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...')
    process.exit(0)
})

// Routing start ab

// Home ke routes
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

// Read  users wale route
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

// Delete user ke route
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

// Edit user ke liye route
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

// Update user ke liye  route
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

        // Email Check karo
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Invalid email format',
                message: 'Please provide a valid email address'
            })
        }

        // Already existing ka checking
        const duplicateUser = users.find(user => 
            user.email.toLowerCase() === email.trim().toLowerCase() && user._id !== userId
        )
        if (duplicateUser) {
            return res.status(409).json({
                error: 'Email already exists',
                message: 'Another user with this email address already exists'
            })
        }

        // URL validate karna
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

        // Updating user changes ke baad
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

// Create user ke route
app.post('/create', (req, res) => {
    try {
        // Input Check karo
        const { name, email, image } = req.body

        if (!name || !email) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Name and email are required fields'
            })
        }

        // Email Check karo
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Invalid email format',
                message: 'Please provide a valid email address'
            })
        }

        // Already existing ka check
        const existingUser = users.find(user => 
            user.email.toLowerCase() === email.trim().toLowerCase()
        )
        if (existingUser) {
            return res.status(409).json({
                error: 'Email already exists',
                message: 'A user with this email address already exists'
            })
        }

        // Image ki URl Validation
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

        // Creating  new user
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

// Creating user ka initial form route
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

// Health check endpoint Deployment ke liye
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        environment: NODE_ENV,
        totalUsers: users.length
    })
})

// API endpoint taaki users in json format
app.get('/api/users', (req, res) => {
    res.json({
        success: true,
        count: users.length,
        data: users
    })
})

// 404 error jab sab routes fail ho jaye
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Page Not Found',
        message: `The page ${req.originalUrl} does not exist`
    })
})

// Global errors ke  handler 
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error)
    res.status(500).json({
        error: 'Internal Server Error',
        message: NODE_ENV === 'development' ? error.message : 'Something went wrong'
    })
})

// Server Chalu karo
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`Environment: ${NODE_ENV}`)
    console.log(`Access the app at: http://localhost:${PORT}`)
    console.log(`Started with ${users.length} sample users`)
})

// Server ke erros ke liye
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`)
        process.exit(1)
    } else {
        console.error('Server error:', error)
        process.exit(1)
    }
})
