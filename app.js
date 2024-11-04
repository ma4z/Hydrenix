const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const CatLoggr = require('cat-loggr');
const bodyParser = require('body-parser'); // Import body-parser
require('dotenv').config();

const init = async () => {
  const app = express();
  const expressWs = require('express-ws')(app); // Initialize WebSocket

  const { db } = require('./db');
  const log = new CatLoggr();

  // Set up view engine and session
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '/views'));

  // Set up session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key', // Replace with your secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set secure: true in production with HTTPS
  }));

  // Use body parser middleware
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // Load and initialize routes
  const allRoutes = fs.readdirSync('./routes').filter(file => file.endsWith('.js')); // Only JS files

  allRoutes.forEach(routeFile => {
    try {
      const routePath = path.join(__dirname, 'routes', routeFile);
      const route = require(routePath);
      
      // Apply routes
      app.use('/', route);
      log.info(`Loaded route: ${routeFile}`);
    } catch (error) {
      log.error(`Error loading route: ${routeFile}`);
      log.error(error.message); // Log the specific error message
    }
  });

  // Start the server
  const port = process.env.APP_PORT || 3000;
  app.listen(port, () => {
    log.info(`HydrenIX is listening on port ${port}!`);
  });
};

// Call init() function to start the app
init();
