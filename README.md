# MongoDB Migration Tool

A modern web-based tool for migrating data between MongoDB databases.

## Features

- Migrate all collections and documents from one MongoDB database to another
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
4. Click "Start Migration" to begin the process
5. Monitor the real-time progress of each collection being migrated
6. View the summary when migration completes
7. Start a new migration if needed

## Migration Process

The tool performs the following steps:

1. Connects to both source and target databases
2. Retrieves all collections from the source database
3. For each collection:
   - Counts documents in the source collection
   - Retrieves all documents
   - If the target collection exists and has documents, it drops it first
   - Inserts all documents into the target collection
   - Verifies the document count in the target collection
4. Displays detailed migration results with real-time progress tracking
5. Shows a summary of the migration with statistics

## User Interface

The web interface provides:

1. **Connection Form** - For entering source and target MongoDB connection strings
2. **Progress Tracking** - Real-time updates showing:
   - Overall migration progress
   - Individual collection migration status
   - Status indicators for each step of the process
3. **Summary View** - After migration completes:
   - Total collections migrated
   - Successful and failed collections
   - Total documents migrated
   - Option to start a new migration

## License

MIT
