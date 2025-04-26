# MongoDB Migration Tool

A simple Node.js tool for migrating data between MongoDB databases.

## Features

- Migrate all collections and documents from one MongoDB database to another
- Interactive command-line interface
- Progress indication with detailed statistics
- Validation of connection strings
- Support for environment variables

## Installation

```bash
# Clone the repository
git clone https://github.com/LohiSoftsro/MongoDbMigration.git

# Navigate to the project directory
cd mongodb-migration-tool

# Install dependencies
npm install
```

## Usage

```bash
# Start the migration tool
npm start
```

The tool will prompt you for:
1. Source MongoDB connection string (including database name)
2. Target MongoDB connection string (including database name)
3. Confirmation before starting the migration

### Using Environment Variables

You can also set the connection strings using environment variables:

1. Create a `.env` file in the project root
2. Add the following variables:
   ```
   SOURCE_URI=mongodb://username:password@hostname:port/source_database
   TARGET_URI=mongodb://username:password@hostname:port/target_database
   ```

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
4. Displays detailed migration results

## License

MIT
