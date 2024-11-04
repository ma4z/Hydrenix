const Keyv = require('keyv');
const db = new Keyv("sqlite://database.sqlite");

module.exports = { db };