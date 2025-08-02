const express = require('express')
const app = express()
const path = require('path')
const user = require('./model/user')

app.set('view engine','ejs')
app.use(express.json())
app.use(express.urlencoded({extended : true}))
app.use(express.static(path.join(__dirname,'public')))

// Home route
app.get('/',(req,res)=>{
    res.render('index')
})

// Read all users route
app.get('/read', async (req,res)=>{
    try {
        let users = await user.find()
        res.render('read',{users})
    } catch (error) {
        console.error('Error fetching users:', error)
        res.status(500).send('Error fetching users')
    }
})

// Delete user route - using URL parameter instead of query
app.get('/delete/:id', async (req,res)=>{
    try {
        let deleteduser = await user.findByIdAndDelete(req.params.id)
        if (!deleteduser) {
            return res.status(404).send('User not found')
        }
        res.redirect('/read')
    } catch (error) {
        console.error('Error deleting user:', error)
        res.status(500).send('Error deleting user')
    }
})

// Edit user form route - show edit form
app.get('/edit/:id', async (req,res)=>{
    try {
        let userToEdit = await user.findById(req.params.id)
        if (!userToEdit) {
            return res.status(404).send('User not found')
        }
        res.render('edit', {user: userToEdit})
    } catch (error) {
        console.error('Error fetching user for edit:', error)
        res.status(500).send('Error fetching user')
    }
})

// Update user route - handle form submission
app.post('/update/:id', async (req,res)=>{
    try {
        let {name, email, image} = req.body
        let updatedUser = await user.findByIdAndUpdate(
            req.params.id,
            {name, email, image},
            {new: true, runValidators: true}
        )
        if (!updatedUser) {
            return res.status(404).send('User not found')
        }
        res.redirect('/read')
    } catch (error) {
        console.error('Error updating user:', error)
        res.status(500).send('Error updating user')
    }
})

// Create user route
app.post('/create', async (req,res)=>{
    try {
        let {name, email, image} = req.body
        let createduser = await user.create({
            name,
            email,
            image
        }) 
        res.redirect('/read')
    } catch (error) {
        console.error('Error creating user:', error)
        res.status(500).send('Error creating user')
    }
})

// Create user form route (optional - if you want a separate create page)
app.get('/create', (req,res)=>{
    res.render('create')
})

app.listen(3000,()=>{
    console.log('Server listening at port 3000')
})