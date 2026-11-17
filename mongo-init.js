// MongoDB initialization script
// This script runs when the MongoDB container starts for the first time

db = db.getSiblingDB('hmas_db');

db.createUser({
  user: 'hmas_user',
  pwd: 'hmas_user_pass_2026',
  roles: [
    {
      role: 'readWrite',
      db: 'hmas_db',
    },
  ],
});

// Create initial collections with validation
db.createCollection('users');
db.createCollection('hospitals');
db.createCollection('teams');
db.createCollection('audits');
db.createCollection('assignments');
db.createCollection('notifications');
db.createCollection('auditlogs');

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ userId: 1 }, { unique: true });
db.hospitals.createIndex({ facilityId: 1 }, { unique: true });
db.hospitals.createIndex({ state: 1, district: 1 });
db.audits.createIndex({ auditNumber: 1 }, { unique: true });
db.audits.createIndex({ status: 1 });
db.audits.createIndex({ hospital: 1 });
db.assignments.createIndex({ assignmentId: 1 }, { unique: true });
db.assignments.createIndex({ audit: 1, status: 1 });
db.notifications.createIndex({ recipient: 1, isRead: 1 });
db.notifications.createIndex({ createdAt: -1 });

print('HMAS database initialized successfully');
print('Created user: hmas_user with readWrite access on hmas_db');
