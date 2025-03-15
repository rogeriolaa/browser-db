# Browser-DB

A lightweight, TypeScript-based IndexedDB wrapper that provides SQL-like functionality for browser applications.

## Features

- Simple API for database and table management
- CRUD operations with TypeScript generics for type safety
- SQL-like query capabilities with conditions and operators ($eq, $gt, $gte, $lt, $lte, $ne)
- Advanced table joins (inner, left, right, full)
- Pagination and sorting support
- Indexing for optimized queries
- Promise-based interface for modern async/await usage
- Full TypeScript support with type definitions
- Batch operations support
- Transaction management

## Installation

```bash
npm install @n0n3br/browser-db
```

## Usage

### Initialize and Open Database

```typescript
import { BrowserDB } from '@n0n3br/browser-db';

// Create a new database instance
const db = new BrowserDB('myDatabase', 1);

// Open the database connection
await db.open();
```

### Create a Table

```typescript
// Define your data interface
interface User {
  id?: number;
  name: string;
  email: string;
  age: number;
}

// Create a table with schema
await db.createTable({
  name: 'users',
  keyPath: 'id',
  autoIncrement: true,
  indexes: [
    { name: 'email', keyPath: 'email', options: { unique: true } },
    { name: 'name', keyPath: 'name' }
  ]
});
```

### Basic CRUD Operations

```typescript
// Insert a record
const userId = await db.insert('users', {
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

// Get a record by key
const user = await db.get('users', userId);

// Update a record
await db.update('users', {
  id: userId,
  name: 'John Smith',
  email: 'john@example.com',
  age: 31
});

// Delete a record
await db.delete('users', userId);
```

### Batch Operations

```typescript
// Batch insert multiple records
const userIds = await db.insert('users', [
  { name: 'John Doe', email: 'john@example.com', age: 30 },
  { name: 'Jane Smith', email: 'jane@example.com', age: 25 }
]);

// Batch update multiple records
await db.update('users', [
  { id: userIds[0], name: 'John Smith', email: 'john@example.com', age: 31 },
  { id: userIds[1], name: 'Jane Doe', email: 'jane@example.com', age: 26 }
]);

// Batch delete multiple records
await db.delete('users', userIds);

// Update multiple records using a condition
await db.update('users', 
  { age: { $lt: 30 } }, // condition
  { active: true }     // updates to apply
);

// Delete multiple records using a condition
await db.delete('users', { age: { $gt: 50 } });
```

### Query Operations

```typescript
// Find records with conditions
const users = await db.find('users', {
  age: { $gt: 25, $lt: 35 },
  name: 'John Smith'
});

// Get all records with pagination and sorting
const options = {
  limit: 10,
  offset: 0,
  direction: 'next' // or 'prev' for reverse order
};
const allUsers = await db.getAll('users', options);

// Count records
const totalUsers = await db.count('users');
```

### Join Operations

```typescript
interface Order {
  id?: number;
  userId: number;
  total: number;
}

// Create orders table
await db.createTable({
  name: 'orders',
  keyPath: 'id',
  autoIncrement: true,
  indexes: [{ name: 'userId', keyPath: 'userId' }]
});

// Perform an inner join
const userOrders = await db.join(
  'users',
  'orders',
  { leftKey: 'id', rightKey: 'userId' },
  { type: 'inner' } // 'inner', 'left', 'right', or 'full'
);
```

### Table and Database Management

```typescript
// Clear all records from a table
await db.clear('users');

// Drop a table
await db.dropTable('users');

// Drop the entire database
await db.dropDatabase();

// Close the database connection
db.close();
```

## API Reference

### BrowserDB Class

#### Constructor
- `new BrowserDB(dbName: string = 'browserDB', version: number = 1)`

#### Methods
- `open(): Promise<BrowserDB>` - Open database connection
- `close(): void` - Close database connection
- `dropDatabase(): Promise<void>` - Delete the database

#### Table Operations
- `createTable(schema: TableSchema): Promise<void>` - Create a new table
- `dropTable(tableName: string): Promise<void>` - Drop a table
- `clear(tableName: string): Promise<void>` - Clear all records in a table

#### CRUD Operations
- `insert<T>(tableName: string, data: T | T[]): Promise<IDBValidKey | IDBValidKey[]>` - Insert one or more records
- `update<T>(tableName: string, dataOrCondition: T | T[] | QueryCondition<T>, updates?: Partial<T>): Promise<void>` - Update records
- `delete(tableName: string, keysOrCondition: IDBValidKey | IDBValidKey[] | QueryCondition<T>): Promise<void>` - Delete records
- `get<T>(tableName: string, key: IDBValidKey): Promise<T | null>` - Get a record by key

#### Query Operations
- `getAll<T>(tableName: string, options?: QueryOptions): Promise<T[]>` - Get all records
- `find<T>(tableName: string, condition: QueryCondition<T>, options?: QueryOptions): Promise<T[]>` - Find records
- `count(tableName: string): Promise<number>` - Count records
- `join<T, U, R>(leftTableName: string, rightTableName: string, condition: JoinCondition<T, U>, options?: JoinOptions): Promise<R[]>` - Join tables

## License

ISC