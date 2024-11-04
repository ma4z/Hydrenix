const express = require('express');
const router = express.Router();
const { db } = require('../db'); // Ensure this path is correct
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Assuming the file path for kvms.json is set as follows
const kvmsFilePath = path.join(__dirname, 'kvms.json');

router.post('/create-kvm', async (req, res) => {
    const { ram, cores, nodeIds } = req.body; // Expecting RAM, cores, and node IDs from the request body

    // Validate input
    if (!ram || !cores || !Array.isArray(nodeIds) || nodeIds.length === 0) {
        return res.status(400).json({ error: 'RAM, cores, and node IDs are required' });
    }

    try {
        // Fetch all nodes from the Keyv database
        const nodes = await db.get('nodes'); // Get the array directly

        // Debugging: Check what nodes is
        console.log('Nodes Data:', nodes);

        // Ensure nodes is an array before filtering
        if (!Array.isArray(nodes)) {
            return res.status(500).json({ error: 'Unexpected nodes data structure' });
        }

        // Filter valid nodes based on provided node IDs
        const validNodes = nodes.filter(node => nodeIds.includes(node.id));

        if (validNodes.length === 0) {
            return res.status(404).json({ error: 'No nodes found for the provided IDs' });
        }

        // Prepare to collect the container IDs and SSH commands from the node requests
        const creationPromises = validNodes.map(async (node) => {
            const url = `http://${node.remote}:${node.port}/vm/create?ram=${ram}G&cores=${cores}&api_key=${node.id}`;
            const response = await axios.get(url); // Sending a GET request to create the VM
            
            // Return an object containing container_id and ssh_command
            return {
                container_id: response.data.container_id, // Use response.data.container_id
                ssh_command: response.data.ssh_command,   // Use response.data.ssh_command
                nodeId: node.id // Optionally include the node ID for reference
            };
        });

        // Wait for all node requests to complete
        const results = await Promise.all(creationPromises);
        console.log(results)

        // Generate a unique ID for the instance
        const instanceId = uuidv4(); 
        const instanceData = {
            id: instanceId,
            ram: ram,
            cores: cores,
            createdAt: new Date(),
            container_ids: results.map(result => result.container_id), // Store container IDs in an array
            ssh_commands: results.map(result => result.ssh_command) // Store SSH commands in an array
        };

        // Read existing KVMs from the kvms.json file
        let kvms = [];
        if (fs.existsSync(kvmsFilePath)) {
            const kvmsData = fs.readFileSync(kvmsFilePath, 'utf-8');
            kvms = JSON.parse(kvmsData);
        }

        // Add the new instance to the KVMs array
        kvms.push(instanceData);

        // Write the updated KVMs back to the kvms.json file
        fs.writeFileSync(kvmsFilePath, JSON.stringify(kvms, null, 2));

        res.status(201).json({ message: 'KVM instance created', instance: instanceData });
    } catch (error) {
        console.error('Error creating KVM:', error);
        res.status(500).json({ error: 'Failed to create KVM instance' });
    }
});


module.exports = router;
