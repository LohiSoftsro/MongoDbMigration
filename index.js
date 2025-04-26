/**
 * MongoDB Migration Tool
 * 
 * This application migrates data from one MongoDB database to another.
 * It prompts for source and target connection strings (including database names)
 * and transfers all collections and documents from the source to the target.
 */

const { MongoClient } = require('mongodb');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const dotenv = require('dotenv');

// Load environment variables from .env file if present
dotenv.config();

/**
 * Validates a MongoDB connection string
 * @param {string} uri - MongoDB connection string to validate
 * @returns {boolean|string} - True if valid, error message if invalid
 */
function validateConnectionString(uri) {
  // Basic validation for MongoDB connection string
  if (!uri) return 'Connection string cannot be empty';
  
  try {
    // Check if it's a valid MongoDB URI format
    if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
      return 'Connection string must start with mongodb:// or mongodb+srv://';
    }
    
    // Check if database name is included
    const dbNameCheck = uri.split('/').pop().split('?')[0];
    if (!dbNameCheck) {
      return 'Connection string must include a database name';
    }
    
    return true;
  } catch (error) {
    return 'Invalid connection string format';
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
 * Migrate a single collection from source to target
 * @param {Object} sourceDb - Source database instance
 * @param {Object} targetDb - Target database instance
 * @param {string} collectionName - Name of the collection to migrate
 * @param {Object} spinner - Ora spinner instance for progress indication
 * @returns {Promise<Object>} - Migration statistics
 */
async function migrateCollection(sourceDb, targetDb, collectionName, spinner) {
  try {
    const sourceCollection = sourceDb.collection(collectionName);
    const targetCollection = targetDb.collection(collectionName);
    
    // Get document count
    const count = await sourceCollection.countDocuments();
    spinner.text = `Migrating collection: ${collectionName} (${count} documents)`;
    
    // Get all documents from source collection
    const documents = await sourceCollection.find({}).toArray();
    
    // If there are documents to migrate
    if (documents.length > 0) {
      // Check if target collection already exists and has documents
      const targetExists = await targetDb.listCollections({ name: collectionName }).hasNext();
      if (targetExists) {
        const targetCount = await targetCollection.countDocuments();
        if (targetCount > 0) {
          // Drop the target collection to avoid duplicates
          await targetCollection.drop();
          spinner.text = `Dropped existing collection: ${collectionName} with ${targetCount} documents`;
        }
      }
      
      // Insert all documents to target collection
      await targetCollection.insertMany(documents);
      
      // Verify the document count in target collection
      const newCount = await targetCollection.countDocuments();
      
      return {
        collection: collectionName,
        documentCount: count,
        migratedCount: newCount,
        success: count === newCount
      };
    } else {
      return {
        collection: collectionName,
        documentCount: 0,
        migratedCount: 0,
        success: true,
        message: 'No documents to migrate'
      };
    }
  } catch (error) {
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
 */
async function migrateDatabase(sourceUri, targetUri) {
  let sourceClient, targetClient;
  const spinner = ora('Starting migration...').start();
  
  try {
    // Connect to source database
    spinner.text = 'Connecting to source database...';
    const source = await connectToDatabase(sourceUri);
    sourceClient = source.client;
    const sourceDb = source.db;
    const sourceDbName = source.dbName;
    
    // Connect to target database
    spinner.text = 'Connecting to target database...';
    const target = await connectToDatabase(targetUri);
    targetClient = target.client;
    const targetDb = target.db;
    const targetDbName = target.dbName;
    
    console.log(chalk.green(`\nConnected to source database: ${sourceDbName}`));
    console.log(chalk.green(`Connected to target database: ${targetDbName}\n`));
    
    // Get all collections from source database
    spinner.text = 'Getting collections from source database...';
    const collections = await getCollections(sourceDb);
    
    if (collections.length === 0) {
      spinner.fail('No collections found in source database');
      return;
    }
    
    console.log(chalk.cyan(`Found ${collections.length} collections to migrate\n`));
    
    // Migrate each collection
    const results = [];
    for (const collectionName of collections) {
      const result = await migrateCollection(sourceDb, targetDb, collectionName, spinner);
      results.push(result);
    }
    
    // Display migration results
    spinner.succeed('Migration completed');
    console.log('\nMigration Results:');
    
    let totalDocuments = 0;
    let totalMigrated = 0;
    let successCount = 0;
    let failCount = 0;
    
    results.forEach(result => {
      if (result.success) {
        console.log(chalk.green(`✓ ${result.collection}: ${result.migratedCount}/${result.documentCount} documents migrated`));
        totalDocuments += result.documentCount;
        totalMigrated += result.migratedCount;
        successCount++;
      } else {
        console.log(chalk.red(`✗ ${result.collection}: Failed - ${result.error}`));
        failCount++;
      }
    });
    
    console.log(chalk.bold('\nSummary:'));
    console.log(chalk.bold(`Total collections: ${collections.length}`));
    console.log(chalk.bold.green(`Successful migrations: ${successCount}`));
    console.log(chalk.bold.red(`Failed migrations: ${failCount}`));
    console.log(chalk.bold(`Total documents migrated: ${totalMigrated}/${totalDocuments}`));
    
  } catch (error) {
    spinner.fail(`Migration failed: ${error.message}`);
  } finally {
    // Close database connections
    if (sourceClient) await sourceClient.close();
    if (targetClient) await targetClient.close();
  }
}

/**
 * Main application function
 */
async function main() {
  console.log(chalk.bold.blue('=== MongoDB Migration Tool ===\n'));
  
  try {
    // Get connection strings from user
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'sourceUri',
        message: 'Enter source MongoDB connection string (including database name):',
        validate: validateConnectionString,
        default: process.env.SOURCE_URI || ''
      },
      {
        type: 'input',
        name: 'targetUri',
        message: 'Enter target MongoDB connection string (including database name):',
        validate: validateConnectionString,
        default: process.env.TARGET_URI || ''
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to proceed with the migration?',
        default: false
      }
    ]);
    
    if (!answers.confirm) {
      console.log(chalk.yellow('Migration cancelled'));
      return;
    }
    
    await migrateDatabase(answers.sourceUri, answers.targetUri);
    
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

// Run the application
main().catch(console.error);
