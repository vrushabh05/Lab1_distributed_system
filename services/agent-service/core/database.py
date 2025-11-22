# services/agent-service/core/database.py
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

class DatabaseManager:
    def __init__(self, config, logger):
        self.uri = config.MONGODB_URI
        self.logger = logger
        self.client = None
        self.db = None

    def connect(self):
        try:
            self.logger.info("Connecting to MongoDB...")
            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
            # The ismaster command is cheap and does not require auth.
            self.client.admin.command('ismaster')
            self.db = self.client.get_database() # Get default database from URI
            self.logger.info("✅ MongoDB connected successfully.")
        except ConnectionFailure as e:
            self.logger.error(f"❌ MongoDB connection failed: {e}")
            raise

    def disconnect(self):
        if self.client:
            self.client.close()
            self.logger.info("MongoDB connection closed.")

    def get_db(self):
        if self.db is None:
            raise Exception("Database not connected. Call connect() first.")
        return self.db

    def health_check(self):
        try:
            self.client.admin.command('ping')
            return {"ok": True, "message": "MongoDB is reachable"}
        except Exception as e:
            return {"ok": False, "message": str(e)}

def create_database_manager(config, logger):
    return DatabaseManager(config, logger)
