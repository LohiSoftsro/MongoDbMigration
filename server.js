/**
 * MongoDB Migration Tool - Server
 * 
 * This application provides a web interface for migrating data between MongoDB databases.
 * It allows users to input source and target connection strings and displays migration progress.
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { MongoClient } = require('mongodb');
const chalk = require('chalk');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Set up middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('A client connected');
  
  // Handle connection test request
  socket.on('testConnections', async (data) => {
    const { sourceUri, targetUri } = data;
    
    try {
      // Validate connection strings
      if (!validateConnectionString(sourceUri)) {
        return socket.emit('testResult', { success: false, source: false, target: false, error: 'Invalid source connection string' });
      }
      
      if (!validateConnectionString(targetUri)) {
        return socket.emit('testResult', { success: false, source: false, target: false, error: 'Invalid target connection string' });
      }
      
      // Test connections
      const testResult = await testConnections(sourceUri, targetUri, socket);
      socket.emit('testResult', testResult);
      
    } catch (error) {
      console.error('Connection test error:', error);
      socket.emit('testResult', { 
        success: false, 
        source: false, 
        target: false, 
        error: `Connection test failed: ${error.message}` 
      });
    }
  });
  
  // Handle migration request
  socket.on('startMigration', async (data) => {
    const { sourceUri, targetUri, migrationMode } = data;
    
    try {
      // Validate connection strings
      if (!validateConnectionString(sourceUri)) {
        return socket.emit('error', 'Invalid source connection string');
      }
      
      if (!validateConnectionString(targetUri)) {
        return socket.emit('error', 'Invalid target connection string');
      }
      
      // Start migration with the selected mode
      await migrateDatabase(sourceUri, targetUri, socket, migrationMode);
      
    } catch (error) {
      console.error('Migration error:', error);
      socket.emit('error', `Migration failed: ${error.message}`);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

/**
 * Validates a MongoDB connection string
 * @param {string} uri - MongoDB connection string to validate
 * @returns {boolean} - True if valid, false if invalid
 */
function validateConnectionString(uri) {
  if (!uri) return false;
  
  try {
    // Check if it's a valid MongoDB URI format
    if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
      return false;
    }
    
    // Check if database name is included
    const dbNameCheck = uri.split('/').pop().split('?')[0];
    if (!dbNameCheck) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Extracts database name from a MongoDB connection string
 * @param {string} uri - MongoDB connection string
 * @returns {string} - Database name
 */
function getDatabaseName(uri) {
  try {
    return uri.split('/').pop().split('?')[0];
  } catch (error) {
    console.error('Error extracting database name:', error);
    return '';
  }
}

/**
 * Connect to a MongoDB database
 * @param {string} uri - MongoDB connection string
 * @returns {Promise<Object>} - MongoDB client and database objects
 */
async function connectToDatabase(uri) {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const dbName = getDatabaseName(uri);
    const db = client.db(dbName);
    return { client, db, dbName };
  } catch (error) {
    throw new Error(`Failed to connect to database: ${error.message}`);
  }
}

/**
 * Get all collection names from a database
 * @param {Object} db - MongoDB database instance
 * @returns {Promise<Array>} - Array of collection names
 */
async function getCollections(db) {
  try {
    const collections = await db.listCollections().toArray();
    return collections.map(collection => collection.name);
  } catch (error) {
    throw new Error(`Failed to get collections: ${error.message}`);
  }
}

/**
 * Test database connections
 * @param {string} sourceUri - Source MongoDB connection string
 * @param {string} targetUri - Target MongoDB connection string
 * @param {Object} socket - Socket.io socket for updates
 * @returns {Promise<Object>} - Test results
 */
async function testConnections(sourceUri, targetUri, socket) {
  let sourceClient, targetClient;
  const result = {
    success: false,
    source: false,
    target: false,
    sourceDetails: {},
    targetDetails: {}
  };
  
  try {
    // Test source connection (read-only)
    socket.emit('status', { message: 'Testing source connection...', progress: 10 });
    const source = await connectToDatabase(sourceUri);
    sourceClient = source.client;
    const sourceDb = source.db;
    
    // Test read operation
    const collections = await sourceDb.listCollections().toArray();
    result.source = true;
    result.sourceDetails.dbName = source.dbName;
    result.sourceDetails.collections = collections.length;
    socket.emit('status', { message: 'Source connection successful', progress: 30 });
    
    // Test target connection (read, write, update, delete)
    socket.emit('status', { message: 'Testing target connection...', progress: 40 });
    const target = await connectToDatabase(targetUri);
    targetClient = target.client;
    const targetDb = target.db;
    
    // Test collection creation and document operations
    const testCollection = targetDb.collection('migration_test_collection');
    
    // Test write
    socket.emit('status', { message: 'Testing write permission on target...', progress: 50 });
    const writeResult = await testCollection.insertOne({ test: true, timestamp: new Date() });
    
    // Test read
    socket.emit('status', { message: 'Testing read permission on target...', progress: 60 });
    const readResult = await testCollection.findOne({ _id: writeResult.insertedId });
    
    // Test update
    socket.emit('status', { message: 'Testing update permission on target...', progress: 70 });
    await testCollection.updateOne({ _id: writeResult.insertedId }, { $set: { updated: true } });
    
    // Test delete
    socket.emit('status', { message: 'Testing delete permission on target...', progress: 80 });
    await testCollection.deleteOne({ _id: writeResult.insertedId });
    
    // Clean up test collection
    socket.emit('status', { message: 'Cleaning up test collection...', progress: 90 });
    await testCollection.drop().catch(() => {}); // Ignore error if collection doesn't exist
    
    result.target = true;
    result.targetDetails.dbName = target.dbName;
    socket.emit('status', { message: 'Target connection successful', progress: 100 });
    
    result.success = true;
    return result;
    
  } catch (error) {
    console.error('Connection test error:', error);
    result.error = error.message;
    socket.emit('status', { message: `Connection test failed: ${error.message}`, progress: 100 });
    return result;
  } finally {
    // Close database connections
    if (sourceClient) await sourceClient.close();
    if (targetClient) await targetClient.close();
  }
}

/**
 * Migrate a single collection from source to target
 * @param {Object} sourceDb - Source database instance
 * @param {Object} targetDb - Target database instance
 * @param {string} collectionName - Name of the collection to migrate
 * @param {Object} socket - Socket.io socket for progress updates
 * @param {number} index - Current collection index
 * @param {number} total - Total number of collections
 * @param {string} migrationMode - Migration mode ('complete' or 'newOnly')
 * @returns {Promise<Object>} - Migration statistics
 */
async function migrateCollection(sourceDb, targetDb, collectionName, socket, index, total, migrationMode) {
  try {
    const sourceCollection = sourceDb.collection(collectionName);
    const targetCollection = targetDb.collection(collectionName);
    
    // Get document count
    const count = await sourceCollection.countDocuments();
    socket.emit('collectionProgress', {
      collection: collectionName,
      status: 'starting',
      message: `Migrating collection: ${collectionName} (${count} documents)`,
      current: index,
      total: total,
      progress: 0
    });
    
    // Different behavior based on migration mode
    if (migrationMode === 'complete') {
      // Complete migration - drop target collection if it exists
      const targetExists = await targetDb.listCollections({ name: collectionName }).hasNext();
      if (targetExists) {
        const targetCount = await targetCollection.countDocuments();
        if (targetCount > 0) {
          // Drop the target collection
          await targetCollection.drop();
          socket.emit('collectionProgress', {
            collection: collectionName,
            status: 'preparing',
            message: `Dropped existing collection: ${collectionName} with ${targetCount} documents`,
            current: index,
            total: total,
            progress: 25
          });
        }
      }
      
      // Get all documents from source collection
      const documents = await sourceCollection.find({}).toArray();
      
      if (documents.length > 0) {
        // Update progress
        socket.emit('collectionProgress', {
          collection: collectionName,
          status: 'copying',
          message: `Copying ${documents.length} documents...`,
          current: index,
          total: total,
          progress: 50
        });
        
        // Insert all documents to target collection
        await targetCollection.insertMany(documents);
        
        // Verify the document count in target collection
        const newCount = await targetCollection.countDocuments();
        
        // Update progress
        socket.emit('collectionProgress', {
          collection: collectionName,
          status: 'completed',
          message: `Completed: ${newCount}/${documents.length} documents migrated`,
          current: index,
          total: total,
          progress: 100
        });
        
        return {
          collection: collectionName,
          documentCount: documents.length,
          migratedCount: newCount,
          success: documents.length === newCount,
          mode: 'complete'
        };
      } else {
        // Empty collection
        socket.emit('collectionProgress', {
          collection: collectionName,
          status: 'completed',
          message: 'No documents to migrate',
          current: index,
          total: total,
          progress: 100
        });
        
        return {
          collection: collectionName,
          documentCount: 0,
          migratedCount: 0,
          success: true,
          message: 'No documents to migrate',
          mode: 'complete'
        };
      }
    } else if (migrationMode === 'newOnly') {
      // New documents only - get existing IDs from target
      socket.emit('collectionProgress', {
        collection: collectionName,
        status: 'preparing',
        message: `Checking for new documents in ${collectionName}...`,
        current: index,
        total: total,
        progress: 20
      });
      
      // Get all document IDs from target collection
      const existingIds = new Set();
      const targetExists = await targetDb.listCollections({ name: collectionName }).hasNext();
      
      if (targetExists) {
        const existingIdObjects = await targetCollection.find({}, { projection: { _id: 1 } }).toArray();
        existingIdObjects.forEach(doc => existingIds.add(doc._id.toString()));
      }
      
      // Get all documents from source collection
      const allSourceDocs = await sourceCollection.find({}).toArray();
      
      // Filter out documents that already exist in target
      const newDocuments = allSourceDocs.filter(doc => !existingIds.has(doc._id.toString()));
      
      socket.emit('collectionProgress', {
        collection: collectionName,
        status: 'preparing',
        message: `Found ${newDocuments.length} new documents out of ${allSourceDocs.length} total`,
        current: index,
        total: total,
        progress: 40
      });
      
      if (newDocuments.length > 0) {
        // Update progress
        socket.emit('collectionProgress', {
          collection: collectionName,
          status: 'copying',
          message: `Copying ${newDocuments.length} new documents...`,
          current: index,
          total: total,
          progress: 60
        });
        
        // Insert new documents to target collection
        await targetCollection.insertMany(newDocuments);
        
        // Update progress
        socket.emit('collectionProgress', {
          collection: collectionName,
          status: 'completed',
          message: `Completed: ${newDocuments.length} new documents migrated`,
          current: index,
          total: total,
          progress: 100
        });
        
        return {
          collection: collectionName,
          totalDocuments: allSourceDocs.length,
          newDocuments: newDocuments.length,
          migratedCount: newDocuments.length,
          success: true,
          mode: 'newOnly'
        };
      } else {
        // No new documents
        socket.emit('collectionProgress', {
          collection: collectionName,
          status: 'completed',
          message: 'No new documents to migrate',
          current: index,
          total: total,
          progress: 100
        });
        
        return {
          collection: collectionName,
          totalDocuments: allSourceDocs.length,
          newDocuments: 0,
          migratedCount: 0,
          success: true,
          message: 'No new documents to migrate',
          mode: 'newOnly'
        };
      }
    } else {
      throw new Error(`Invalid migration mode: ${migrationMode}`);
    }
  } catch (error) {
    // Update progress for failed collection
    socket.emit('collectionProgress', {
      collection: collectionName,
      status: 'failed',
      message: `Failed: ${error.message}`,
      current: index,
      total: total,
      progress: 100
    });
    
    return {
      collection: collectionName,
      success: false,
      error: error.message
    };
  }
}

/**
 * Main migration function
 * @param {string} sourceUri - Source MongoDB connection string
 * @param {string} targetUri - Target MongoDB connection string
 * @param {Object} socket - Socket.io socket for progress updates
 * @param {string} migrationMode - Migration mode ('complete' or 'newOnly')
 */
async function migrateDatabase(sourceUri, targetUri, socket, migrationMode = 'complete') {
  let sourceClient, targetClient;
  
  try {
    // Validate migration mode
    if (migrationMode !== 'complete' && migrationMode !== 'newOnly') {
      throw new Error(`Invalid migration mode: ${migrationMode}`);
    }
    
    // Connect to source database
    socket.emit('status', { message: 'Connecting to source database...', progress: 5 });
    const source = await connectToDatabase(sourceUri);
    sourceClient = source.client;
    const sourceDb = source.db;
    const sourceDbName = source.dbName;
    
    // Connect to target database
    socket.emit('status', { message: 'Connecting to target database...', progress: 10 });
    const target = await connectToDatabase(targetUri);
    targetClient = target.client;
    const targetDb = target.db;
    const targetDbName = target.dbName;
    
    socket.emit('status', { 
      message: `Connected to source database: ${sourceDbName} and target database: ${targetDbName}`,
      progress: 15
    });
    
    // Display migration mode
    const modeMessage = migrationMode === 'complete' 
      ? 'Migration mode: Complete (drop existing collections)' 
      : 'Migration mode: New documents only (preserve existing documents)';
    
    socket.emit('status', { message: modeMessage, progress: 18 });
    
    // Get all collections from source database
    socket.emit('status', { message: 'Getting collections from source database...', progress: 20 });
    const collections = await getCollections(sourceDb);
    
    if (collections.length === 0) {
      socket.emit('status', { message: 'No collections found in source database', progress: 100 });
      socket.emit('completed', { 
        success: true, 
        message: 'No collections to migrate',
        migrationMode: migrationMode
      });
      return;
    }
    
    socket.emit('status', { 
      message: `Found ${collections.length} collections to migrate`,
      progress: 25
    });
    
    // Migrate each collection
    const results = [];
    for (let i = 0; i < collections.length; i++) {
      const collectionName = collections[i];
      const result = await migrateCollection(
        sourceDb, 
        targetDb, 
        collectionName, 
        socket,
        i + 1,
        collections.length,
        migrationMode
      );
      results.push(result);
      
      // Update overall progress
      const overallProgress = 25 + Math.floor(((i + 1) / collections.length) * 75);
      socket.emit('status', { 
        message: `Migrated ${i + 1}/${collections.length} collections`,
        progress: overallProgress
      });
    }
    
    // Calculate summary based on migration mode
    let totalDocuments = 0;
    let totalMigrated = 0;
    let newDocuments = 0;
    let successCount = 0;
    let failCount = 0;
    
    results.forEach(result => {
      if (result.success) {
        if (migrationMode === 'complete') {
          totalDocuments += result.documentCount || 0;
          totalMigrated += result.migratedCount || 0;
        } else { // newOnly mode
          totalDocuments += result.totalDocuments || 0;
          newDocuments += result.newDocuments || 0;
          totalMigrated += result.migratedCount || 0;
        }
        successCount++;
      } else {
        failCount++;
      }
    });
    
    // Send completion event
    socket.emit('completed', {
      success: true,
      migrationMode: migrationMode,
      totalCollections: collections.length,
      successfulCollections: successCount,
      failedCollections: failCount,
      totalDocuments: totalDocuments,
      newDocuments: migrationMode === 'newOnly' ? newDocuments : undefined,
      migratedDocuments: totalMigrated
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    socket.emit('status', { message: `Migration failed: ${error.message}`, progress: 100 });
    socket.emit('completed', { 
      success: false, 
      error: error.message,
      migrationMode: migrationMode 
    });
  } finally {
    // Close database connections
    if (sourceClient) await sourceClient.close();
    if (targetClient) await targetClient.close();
  }
}

// Start server
const PORT = process.env.PORT || 3000;

// Próbáljuk meg elindítani a szervert, ha a port foglalt, próbáljunk egy másikat
function startServer(port) {
  server.listen(port)
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(chalk.yellow(`Port ${port} is already in use, trying ${port + 1}...`));
        startServer(port + 1);
      } else {
        console.error(chalk.red(`Server error: ${err.message}`));
      }
    })
    .on('listening', () => {
      const actualPort = server.address().port;
      console.log(chalk.bold.green(`MongoDB Migration Tool server running on port ${actualPort}`));
      console.log(chalk.cyan(`Open http://localhost:${actualPort} in your browser to start`));
    });
}

startServer(PORT);
