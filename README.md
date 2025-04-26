# MongoDB Migration Tool

A modern web-based tool for migrating data between MongoDB databases with connection testing and flexible migration options.

## Features

- Migrate all collections and documents from one MongoDB database to another
- Test database connections before migration
- Two migration modes:
  - Complete migration (drop existing collections)
  - New documents only (preserve existing documents)
- Clean, modern web interface
- Real-time progress tracking with detailed statistics
- Collection-by-collection migration status
- Validation of connection strings
- Support for multiple consecutive migrations

## Installation

```bash
# Clone the repository
git clone https://github.com/LohiSoftsro/MongoDbMigration.git

# Navigate to the project directory
cd MongoDbMigration

# Install dependencies
npm install
```

## Usage

```bash
# Start the migration tool
npm start
```

After starting the server:

1. Open your browser and navigate to `http://localhost:3000`
2. Enter the source MongoDB connection string (including database name)
3. Enter the target MongoDB connection string (including database name)
4. Click "Test Connections" to verify your connection details
   - Source connection is tested for read permissions
   - Target connection is tested for read/write/update/delete permissions
5. Select a migration mode:
   - Complete Migration: Drops existing collections in target and performs full migration
   - New Documents Only: Preserves existing documents and only adds documents that don't exist in target (based on _id)
6. Click "Start Migration" to begin the process
7. Monitor the real-time progress of each collection being migrated
8. View the summary when migration completes
9. Start a new migration if needed

## Migration Process

### Connection Testing

Before migration, the tool can test the database connections:

1. Source database testing:
   - Connects to the source database
   - Tests read permissions by listing collections

2. Target database testing:
   - Connects to the target database
   - Creates a temporary test collection
   - Tests write permissions by inserting a document
   - Tests read permissions by querying the document
   - Tests update permissions by modifying the document
   - Tests delete permissions by removing the document
   - Cleans up by dropping the test collection

### Migration Modes

The tool supports two migration modes:

#### Complete Migration

1. Connects to both source and target databases
2. Retrieves all collections from the source database
3. For each collection:
   - Counts documents in the source collection
   - Retrieves all documents
   - If the target collection exists and has documents, it drops it first
   - Inserts all documents into the target collection
   - Verifies the document count in the target collection

#### New Documents Only

1. Connects to both source and target databases
2. Retrieves all collections from the source database
3. For each collection:
   - Retrieves all document IDs from the target collection
   - Retrieves all documents from the source collection
   - Filters out documents that already exist in the target (based on _id)
   - Inserts only new documents into the target collection
   - Preserves all existing documents in the target

4. Displays detailed migration results with real-time progress tracking
5. Shows a summary of the migration with statistics

## User Interface

The web interface provides:

1. **Connection Form** - For entering source and target MongoDB connection strings
2. **Connection Testing** - Test database connections before migration:
   - Verifies read access to source database
   - Verifies read/write/update/delete access to target database
   - Shows detailed connection status and error messages
3. **Migration Options** - Choose between migration modes:
   - Complete Migration (drop existing collections)
   - New Documents Only (preserve existing documents)
4. **Progress Tracking** - Real-time updates showing:
   - Overall migration progress
   - Individual collection migration status
   - Status indicators for each step of the process
5. **Summary View** - After migration completes:
   - Total collections migrated
   - Successful and failed collections
   - Total documents migrated
   - For "New Documents Only" mode: shows new vs. total documents
   - Option to start a new migration

## License

MIT
