const express = require('express');
const router = express.Router();
const { db } = require('../db'); // Ensure this path is correct
const { v4: uuidv4 } = require('uuid'); // Import the UUID function

require('dotenv').config();

// Middleware to check if the user is authenticated
const isAuthenticated = (req, res, next) => {
    // Check if the user is authenticated
    if (req.session && req.session.username) {
        return next(); // User is authenticated, proceed to the next middleware
    }
    res.redirect('/?err=NOT_AUTHENTICATED'); // Redirect to homepage if not authenticated
};

router.get('/', (req, res) => {
    res.render('index', {
        name: process.env.APP_NAME 
    });
});

// Login route
router.get('/auth/login', (req, res) => {
  console.log('Session before login:', req.session); // Log session details
    const { username, password } = req.query; // Use req.query for GET requests

    const SYSTEM_USERNAME = 'User';
    const SYSTEM_PASSWORD = process.env.PASSWORD;

    // Check credentials
    if (username === SYSTEM_USERNAME && password === SYSTEM_PASSWORD) {
        req.session.username = username; // Set the session username
        res.redirect('/cp'); // Redirect to /cp if credentials are correct
    } else {
        res.redirect('/?err=INVALID_CREDENTIALS'); // Redirect to the homepage with an error message
    }
});

// Protected route
router.get('/cp', isAuthenticated, (req, res) => {
    res.render('cp/main', {
        name: process.env.APP_NAME 
    });
});

router.get('/logout', isAuthenticated,(req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.redirect('/manage?err=INTERNALERROR'); // Redirect with an error if needed
    }
    res.redirect('./'); // Redirect to the home page
  });
});

router.get('/api/nodes', isAuthenticated, async (req, res) => {
  try {
      const nodes = await db.get('nodes') || []; // Fetch all nodes or an empty array if none
      res.json(nodes);
  } catch (error) {
      console.error('Error fetching nodes:', error);
      res.status(500).json({ message: 'Error fetching nodes' });
  }
});

// Route to create a node
router.post('/create/node/:name/:remote/:port/:processor', isAuthenticated, async (req, res) => {
    const { name, remote, port, processor } = req.params;

    try {
        // Get existing nodes
        const existingNodes = await db.get('nodes') || [];
        
        // Create a new node with a UUID
        const newNode = {
            id: uuidv4(), // Generate a random UUID
            name,
            remote,
            port,
            processor
        };

        // Add the new node to the existing nodes array
        existingNodes.push(newNode);

        // Save the updated nodes array back to the database
        await db.set('nodes', existingNodes);
        
        res.status(201).json({ message: 'Node created successfully', node: newNode });
    } catch (error) {
        console.error('Error creating node:', error);
        res.status(500).json({ message: 'Error creating node' });
    }
});
router.get('/node/delete/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Get existing nodes
        let existingNodes = await db.get('nodes') || [];

        // Filter out the node to be deleted
        existingNodes = existingNodes.filter(node => node.id !== id);

        // Save the updated nodes array back to the database
        await db.set('nodes', existingNodes);
        
        res.status(200).json({ message: 'Node deleted successfully' });
    } catch (error) {
        console.error('Error deleting node:', error);
        res.status(500).json({ message: 'Error deleting node' });
    }
});


router.get('/nodes', isAuthenticated, async (req, res) => { 
    try {
        const nodes = await db.get("nodes") || []; // Ensure nodes is an empty array if undefined
        const nodesWithStatus = await Promise.all(nodes.map(async (node) => {
            try {
                const statusResponse = await fetch(`http://${node.remote}:${node.port}/status?api_key=${node.id}`)
                const statusJson = await statusResponse.json();
                return {
                    ...node,
                    status: statusJson.status // Add the status to each node
                };
            } catch (err) {
                console.error(`Error fetching status for node ${node.name}:`, err.message);
                return {
                    ...node,
                    status: "offline" // Assign offline if there’s an error
                };
            }
        }));
  
        res.render('cp/nodes', {
            name: process.env.APP_NAME,
            nodes: nodesWithStatus // Pass nodes with status to the EJS template
        });
    } catch (error) {
        console.error('Error fetching nodes:', error);
        res.status(500).send('Internal Server Error');
    }
  });

  router.get('/containers', isAuthenticated, async (req, res) => {
    try {
        const nodes = await db.get("nodes") || []; // Await the Promise to get the actual nodes

        // Ensure nodes is an array
        if (!Array.isArray(nodes)) {
            console.warn('Expected nodes to be an array, but received:', nodes);
            nodes = []; // Default to an empty array if not an array
        }

        res.render('cp/list', {
            name: process.env.APP_NAME,
            kvms: require('../routes/kvms.json'),
            nodes,
        });
    } catch (error) {
        console.error('Error fetching nodes:', error);
        res.status(500).send('Internal Server Error');
    }
});

  
module.exports = router;
