/**
 * browser-db - A browser-based database library
 * An IndexedDB wrapper that provides SQL-like functionality
 */

/**
 * Interface for table schema definition
 */
interface TableSchema {
  name: string;
  keyPath: string;
  autoIncrement?: boolean;
  indexes?: IndexDefinition[];
}

/**
 * Interface for index definition
 */
interface IndexDefinition {
  name: string;
  keyPath: string | string[];
  options?: IDBIndexParameters;
}

/**
 * Interface for query options
 */
interface QueryOptions {
  limit?: number;
  offset?: number;
  direction?: IDBCursorDirection;
}

/**
 * Type for query conditions
 */
type QueryCondition<T> = {
  [K in keyof T]?: T[K] | { $eq?: T[K]; $gt?: T[K]; $gte?: T[K]; $lt?: T[K]; $lte?: T[K]; $ne?: T[K]; };
};

/**
 * Interface for join options
 */
interface JoinOptions extends QueryOptions {
  type?: 'inner' | 'left' | 'right' | 'full';
}

/**
 * Interface for join condition
 */
interface JoinCondition<T, U> {
  leftKey: keyof T;
  rightKey: keyof U;
}

/**
 * Main BrowserDB class - IndexedDB wrapper with SQL-like API
 */
export class BrowserDB {
  private dbName: string;
  private db: IDBDatabase | null = null;
  private version: number;

  /**
   * Create a new BrowserDB instance
   * @param dbName The name of the database
   * @param version The version of the database
   */
  constructor(dbName: string = 'browserDB', version: number = 1) {
    this.dbName = dbName;
    this.version = version;
  }

  /**
   * Open a connection to the database
   * @returns Promise that resolves when the database is opened
   */
  async open(): Promise<BrowserDB> {
    if (this.db) {
      return this;
    }

    return new Promise<BrowserDB>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = (event) => {
        reject(new Error(`Failed to open database: ${(event.target as IDBRequest).error}`));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this);
      };

      request.onupgradeneeded = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
      };
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Delete the database
   * @returns Promise that resolves when the database is deleted
   */
  async dropDatabase(): Promise<void> {
    this.close();
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.dbName);

      request.onerror = (event) => {
        reject(new Error(`Failed to delete database: ${(event.target as IDBRequest).error}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Create a new table in the database
   * @param schema The table schema
   * @returns Promise that resolves when the table is created
   */
  async createTable(schema: TableSchema): Promise<void> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    // Need to close and reopen with a new version to create a table
    const newVersion = this.version + 1;
    this.close();

    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, newVersion);

      request.onerror = (event) => {
        reject(new Error(`Failed to upgrade database: ${(event.target as IDBRequest).error}`));
      };

      request.onupgradeneeded = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.version = newVersion;

        if (!this.db.objectStoreNames.contains(schema.name)) {
          const objectStore = this.db.createObjectStore(schema.name, {
            keyPath: schema.keyPath,
            autoIncrement: schema.autoIncrement || false
          });

          // Create indexes if defined
          if (schema.indexes) {
            for (const index of schema.indexes) {
              objectStore.createIndex(index.name, index.keyPath, index.options);
            }
          }
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.version = newVersion;
        resolve();
      };
    });
  }

  /**
   * Drop a table from the database
   * @param tableName The name of the table to drop
   * @returns Promise that resolves when the table is dropped
   */
  async dropTable(tableName: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    if (!this.db.objectStoreNames.contains(tableName)) {
      throw new Error(`Table ${tableName} does not exist`);
    }

    // Need to close and reopen with a new version to drop a table
    const newVersion = this.version + 1;
    this.close();

    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, newVersion);

      request.onerror = (event) => {
        reject(new Error(`Failed to upgrade database: ${(event.target as IDBRequest).error}`));
      };

      request.onupgradeneeded = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        if (this.db.objectStoreNames.contains(tableName)) {
          this.db.deleteObjectStore(tableName);
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.version = newVersion;
        resolve();
      };
    });
  }

  /**
   * Execute a transaction on a table
   * @private
   * @param tableName The name of the table
   * @param mode The transaction mode ('readonly' or 'readwrite')
   * @param operation The operation to perform on the object store
   * @returns Promise that resolves with the result of the operation
   * @throws Error if database is not open
   */
  private async executeTransaction<T>(
    tableName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest
  ): Promise<T> {
    if (!this.db) {
      throw new Error('Database not open');
    }
  
    return new Promise<T>((resolve, reject) => {
      const transaction = this.db!.transaction(tableName, mode);
      const objectStore = transaction.objectStore(tableName);
  
      const request = operation(objectStore);
  
      request.onerror = (event) => {
        reject(new Error(`Transaction failed: ${(event.target as IDBRequest).error}`));
      };
  
      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result);
      };
    });
  }

  /**
   * Insert a record into a table
   * @param tableName The name of the table
   * @param data The data to insert
   * @returns Promise that resolves with the key of the inserted record
   * @throws Error if database is not open
   */
  async insert<T>(tableName: string, data: T | T[]): Promise<IDBValidKey | IDBValidKey[]> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    // Handle single record insert
    if (!Array.isArray(data)) {
      return this.executeTransaction<IDBValidKey>(tableName, 'readwrite', (store) => store.add(data));
    }

    // Handle batch insert
    const transaction = this.db.transaction(tableName, 'readwrite');
    const objectStore = transaction.objectStore(tableName);

    return new Promise<IDBValidKey[]>((resolve, reject) => {
      const keys: IDBValidKey[] = [];

      transaction.onerror = (event) => {
        reject(new Error(`Transaction failed: ${(event.target as IDBRequest).error}`));
      };

      transaction.oncomplete = () => {
        resolve(keys);
      };

      data.forEach(item => {
        const request = objectStore.add(item);
        request.onsuccess = (event) => {
          keys.push((event.target as IDBRequest).result);
        };
      });
    });
  }

  /**
   * Update one or more records in a table
   * @param tableName The name of the table
   * @param dataOrCondition A single record, array of records, or query condition to match records for update
   * @param updates Optional updates to apply when using a query condition
   * @returns Promise that resolves when the updates are complete
   * @throws Error if database is not open
   */
  async update<T>(tableName: string, dataOrCondition: T | T[] | QueryCondition<T>, updates?: Partial<T>): Promise<void> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    // Handle query-based update
    if (!Array.isArray(dataOrCondition) && updates && typeof dataOrCondition === 'object') {
      const recordsToUpdate = await this.find<T>(tableName, dataOrCondition as QueryCondition<T>);
      const updatedRecords = recordsToUpdate.map(record => ({ ...record, ...updates }));
      return this.update(tableName, updatedRecords);
    }

    // Handle direct update (single record or array)
    const dataArray = Array.isArray(dataOrCondition) ? dataOrCondition : [dataOrCondition];
    const transaction = this.db.transaction(tableName, 'readwrite');
    const objectStore = transaction.objectStore(tableName);

    return new Promise<void>((resolve, reject) => {
      transaction.onerror = (event) => {
        reject(new Error(`Transaction failed: ${(event.target as IDBRequest).error}`));
      };

      transaction.oncomplete = () => {
        resolve();
      };

      dataArray.forEach(item => {
        objectStore.put(item);
      });
    });
  }

  /**
   * Delete one or more records from a table
   * @param tableName The name of the table
   * @param keysOrCondition A single key, array of keys, or query condition to match records for deletion
   * @returns Promise that resolves when the deletions are complete
   * @throws Error if database is not open
   */
  async delete<T>(tableName: string, keysOrCondition: IDBValidKey | IDBValidKey[] | QueryCondition<T>): Promise<void> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    // Handle query-based delete
    if (typeof keysOrCondition === 'object' && !Array.isArray(keysOrCondition) && !(keysOrCondition instanceof IDBKeyRange)) {
      const recordsToDelete = await this.find<T>(tableName, keysOrCondition as QueryCondition<T>);
      const keyPath = this.db.transaction(tableName).objectStore(tableName).keyPath as string;
      const keys = recordsToDelete.map(record => record[keyPath as keyof T]);
      return this.delete(tableName, keys);
    }

    // Handle direct delete (single key or array of keys)
    const keysArray = Array.isArray(keysOrCondition) ? keysOrCondition : [keysOrCondition];
    const transaction = this.db.transaction(tableName, 'readwrite');
    const objectStore = transaction.objectStore(tableName);

    return new Promise<void>((resolve, reject) => {
      transaction.onerror = (event) => {
        reject(new Error(`Transaction failed: ${(event.target as IDBRequest).error}`));
      };

      transaction.oncomplete = () => {
        resolve();
      };

      keysArray.forEach(key => {
        objectStore.delete(key);
      });
    });
  }

  
  /**
   * Get a record from a table by its key
   * @param tableName The name of the table
   * @param key The key of the record to get
   * @returns Promise that resolves with the record or null if not found
   * @throws Error if database is not open
   */
  async get<T>(tableName: string, key: IDBValidKey): Promise<T | null> {
    const result = await this.executeTransaction<T | undefined>(tableName, 'readonly', (store) => store.get(key));
    return result || null;
  }

  /**
   * Count records in a table
   * @param tableName The name of the table
   * @returns Promise that resolves with the count of records
   * @throws Error if database is not open
   */
  async count(tableName: string): Promise<number> {
    return this.executeTransaction<number>(tableName, 'readonly', (store) => store.count());
  }

  /**
   * Get all records from a table
   * @param tableName The name of the table
   * @param options Query options for pagination and sorting
   * @returns Promise that resolves with an array of records
   * @throws Error if database is not open
   */
  async getAll<T>(tableName: string, options: QueryOptions = {}): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not open');
    }
  
    return new Promise<T[]>((resolve, reject) => {
      const transaction = this.db!.transaction(tableName, 'readonly');
      const objectStore = transaction.objectStore(tableName);
      const results: T[] = [];
  
      const request = objectStore.openCursor(null, options.direction);
      let skipped = 0;
      let count = 0;
  
      request.onerror = (event) => {
        reject(new Error(`Failed to get records: ${(event.target as IDBRequest).error}`));
      };
  
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        
        if (cursor) {
          // Handle offset
          if (options.offset && skipped < options.offset) {
            skipped++;
            cursor.continue();
            return;
          }
          
          // Handle limit
          if (options.limit && count >= options.limit) {
            resolve(results);
            return;
          }
          
          results.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    });
  }

  /**
   * Clear all records from a table
   * @param tableName The name of the table to clear
   * @returns Promise that resolves when the table is cleared
   * @throws Error if database is not open
   */
  async clear(tableName: string): Promise<void> {
    return this.executeTransaction<void>(tableName, 'readwrite', (store) => store.clear());
  }

  /**
   * Find records in a table that match the given condition
   * @param tableName The name of the table
   * @param condition The condition to match
   * @param options Query options for pagination and sorting
   * @returns Promise that resolves with an array of matching records
   * @throws Error if database is not open
   */
  async find<T>(tableName: string, condition: QueryCondition<T>, options: QueryOptions = {}): Promise<T[]> {
    const allRecords = await this.getAll<T>(tableName, options);
    
    return allRecords.filter(record => {
      return Object.entries(condition).every(([key, value]) => {
        const recordValue = record[key as keyof T];
        
        // Handle complex conditions
        if (value !== null && typeof value === 'object') {
          const complexCondition = value as any;
          
          if ('$eq' in complexCondition && recordValue !== complexCondition.$eq) return false;
          if ('$gt' in complexCondition && !(recordValue > complexCondition.$gt)) return false;
          if ('$gte' in complexCondition && !(recordValue >= complexCondition.$gte)) return false;
          if ('$lt' in complexCondition && !(recordValue < complexCondition.$lt)) return false;
          if ('$lte' in complexCondition && !(recordValue <= complexCondition.$lte)) return false;
          if ('$ne' in complexCondition && recordValue === complexCondition.$ne) return false;
          
          return true;
        }
        
        // Simple equality check
        return recordValue === value;
      });
    });
  }


  /**
   * Merge records from two tables during a join operation
   * @private
   * @param leftRecord The record from the left table
   * @param rightRecord The record from the right table, or null if no match
   * @returns A merged record combining properties from both records
   */
  private mergeRecords<T extends object, U extends object>(leftRecord: T, rightRecord: U | null): Record<string, unknown> {
    const merged = { ...leftRecord } as Record<string, unknown>;
    if (rightRecord) {
      for (const [k, value] of Object.entries(rightRecord)) {
        if (!(k in merged)) {
          merged[k] = value;
        }
      }
    }
    return merged;
  }

  /**
   * Create a record with null values for all properties of a template object
   * @private
   * @param template The object to use as a template for the null record
   * @returns A record with the same keys as the template but all values set to null
   */
  private createNullRecord<T extends object>(template: T): Record<string, null> {
    return Object.fromEntries(
      Object.keys(template).map(k => [k, null])
    );
  }

    /**
   * Join two tables based on a condition
   * @param leftTableName The name of the left table
   * @param rightTableName The name of the right table
   * @param condition The join condition defining which fields to join on
   * @param options Join options including join type and pagination
   * @returns Promise that resolves with an array of joined records
   * @throws Error if database is not open
   */

  async join<T extends object, U extends object, R = T & Partial<U>>(
    leftTableName: string,
    rightTableName: string,
    condition: JoinCondition<T, U>,
    options: JoinOptions = {}
  ): Promise<R[]> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    const joinType = options.type || 'inner';
    const leftRecords = await this.getAll<T>(leftTableName);
    const rightRecords = await this.getAll<U>(rightTableName);

    // Create index for right records
    const rightMap = new Map<any, U[]>();
    for (const rightRecord of rightRecords) {
      const key = rightRecord[condition.rightKey];
      if (!rightMap.has(key)) {
        rightMap.set(key, []);
      }
      rightMap.get(key)!.push(rightRecord);
    }

    const results: R[] = [];
    const processedRightKeys = new Set<any>();

    // Process left records
    for (const leftRecord of leftRecords) {
      const leftKey = leftRecord[condition.leftKey];
      const matchingRightRecords = rightMap.get(leftKey) || [];

      if (matchingRightRecords.length > 0) {
        // Handle matched records
        for (const rightRecord of matchingRightRecords) {
          results.push(this.mergeRecords(leftRecord, rightRecord) as R);
          processedRightKeys.add(leftKey);
        }
      } else if (joinType === 'left' || joinType === 'full') {
        // Handle unmatched left records for left/full join
        results.push(this.mergeRecords(leftRecord, null) as R);
      }
    }

    // Process right records for right/full join
    if (joinType === 'right' || joinType === 'full') {
      for (const rightRecord of rightRecords) {
        const rightKey = rightRecord[condition.rightKey];
        if ((joinType === 'right' && !processedRightKeys.has(rightKey)) ||
            (joinType === 'full' && !processedRightKeys.has(rightKey))) {
          const nullLeftRecord = leftRecords[0] ? this.createNullRecord(leftRecords[0]) : {};
          results.push({ ...rightRecord, ...nullLeftRecord } as R);
        }
      }
    }

    // Apply pagination
    if (options.limit !== undefined) {
      const start = options.offset || 0;
      const end = start + options.limit;
      return results.slice(start, end);
    }

    return results;
  }

  /**
   * Perform an inner join between two tables
   * @param leftTableName The name of the left table
   * @param rightTableName The name of the right table
   * @param condition The join condition
   * @param options Query options
   * @returns Promise that resolves with an array of joined records
   * @throws Error if database is not open
   * @example
   * // Join users and orders tables
   * const results = await db.innerJoin('users', 'orders', { leftKey: 'id', rightKey: 'userId' });
   */
  async innerJoin<T extends object, U extends object, R = T & Partial<U>>(
    leftTableName: string,
    rightTableName: string,
    condition: JoinCondition<T, U>,
    options: QueryOptions = {}
  ): Promise<R[]> {
    return this.join<T, U, R>(leftTableName, rightTableName, condition, { ...options, type: 'inner' });
  }

  /**
   * Perform a left join between two tables
   * @param leftTableName The name of the left table
   * @param rightTableName The name of the right table
   * @param condition The join condition
   * @param options Query options
   * @returns Promise that resolves with an array of joined records
   * @throws Error if database is not open
   * @example
   * // Join users and orders tables, keeping all users even if they have no orders
   * const results = await db.leftJoin('users', 'orders', { leftKey: 'id', rightKey: 'userId' });
   */
  async leftJoin<T extends object, U extends object, R = T & Partial<U>>(
    leftTableName: string,
    rightTableName: string,
    condition: JoinCondition<T, U>,
    options: QueryOptions = {}
  ): Promise<R[]> {
    return this.join<T, U, R>(leftTableName, rightTableName, condition, { ...options, type: 'left' });
  }

  /**
   * Perform a right join between two tables
   * @param leftTableName The name of the left table
   * @param rightTableName The name of the right table
   * @param condition The join condition
   * @param options Query options
   * @returns Promise that resolves with an array of joined records
   * @throws Error if database is not open
   * @example
   * // Join users and orders tables, keeping all orders even if they have no matching user
   * const results = await db.rightJoin('users', 'orders', { leftKey: 'id', rightKey: 'userId' });
   */
  async rightJoin<T extends object, U extends object, R = T & Partial<U>>(
    leftTableName: string,
    rightTableName: string,
    condition: JoinCondition<T, U>,
    options: QueryOptions = {}
  ): Promise<R[]> {
    return this.join<T, U, R>(leftTableName, rightTableName, condition, { ...options, type: 'right' });
  }

  /**
   * Perform a full join between two tables
   * @param leftTableName The name of the left table
   * @param rightTableName The name of the right table
   * @param condition The join condition
   * @param options Query options
   * @returns Promise that resolves with an array of joined records
   * @throws Error if database is not open
   * @example
   * // Join users and orders tables, keeping all records from both tables
   * const results = await db.fullJoin('users', 'orders', { leftKey: 'id', rightKey: 'userId' });
   */
  async fullJoin<T extends object, U extends object, R = T & Partial<U>>(
    leftTableName: string,
    rightTableName: string,
    condition: JoinCondition<T, U>,
    options: QueryOptions = {}
  ): Promise<R[]> {
    return this.join<T, U, R>(leftTableName, rightTableName, condition, { ...options, type: 'full' });
  }

  /**
   * Clear all records from a table
   * @param tableName The name of the table
   * @returns Promise that resolves when the table is cleared
   */
}