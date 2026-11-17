require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Team = require('../models/Team');
const Hospital = require('../models/Hospital');
const Setting = require('../models/Setting');
const { generateUserId, generateTeamId } = require('./generateId');

const pad = (n) => String(n).padStart(2, '0');

const seed = async () => {
  await connectDB();
  console.log('\n--- HAMS Seeder ---\n');

  // Clean existing data
  await User.deleteMany({});
  await Team.deleteMany({});
  await Hospital.deleteMany({});
  await Setting.deleteMany({});
  console.log('Cleared existing users, teams, hospitals, settings.\n');

  // ── Admin ───────────────────────────────────────────────────────────────
  const adminUserId = await generateUserId();
  const admin = await User.create({
    userId: adminUserId,
    name: 'HAMS Administrator',
    email: 'admin@hams.gov.in',
    mobile: '9000000001',
    role: 'ADMIN',
    passwordHash: 'Admin@1234',
    isActive: true,
  });
  console.log(`Created Admin : ${admin.email} / Admin@1234`);

  // ── 20 Team Leads + 20 Teams ────────────────────────────────────────────
  console.log('');
  for (let i = 1; i <= 20; i++) {
    const num = pad(i);
    const teamTag = `T-${num}`;

    // Team lead user
    const leadUserId = await generateUserId();
    const lead = await User.create({
      userId: leadUserId,
      name: `Team Lead ${teamTag}`,
      email: `t${num}@hams.gov.in`,
      mobile: `90000${String(i + 1).padStart(5, '0')}`,
      role: 'TEAM_LEAD',
      passwordHash: 'Team@1234',
      isActive: true,
    });

    // Team
    const teamId = await generateTeamId();
    await Team.create({
      teamId,
      teamName: teamTag,
      teamLead: lead._id,
      teamLeadMobile: lead.mobile,
      teamLeadEmail: lead.email,
      members: [],
      expertise: [],
      preferredDistricts: [],
      availability: 'Available',
      isActive: true,
    });

    console.log(`  ${teamTag}  lead: ${lead.email} / Team@1234`);
  }

  // ── Sample hospitals ────────────────────────────────────────────────────
  const hospitals = [
    {
      facilityId: 'BIH-PAT-H-0001',
      facilityName: 'Patna Medical College and Hospital',
      facilityType: 'Medical College Hospital',
      state: 'Bihar', district: 'Patna',
      specialities: ['General Medicine', 'Surgery', 'Orthopedics', 'Pediatrics', 'Gynecology'],
      hospitalType: 'Government', totalBedStrength: 1500,
      nodalOfficerName: 'Dr. Amit Sharma', nodalOfficerNumber: '9811000001',
      nodalOfficerEmail: 'nodal.pmch@gov.in', schemeCode: 'PMCH-BIH-001',
      address: 'Ashok Rajpath, Patna, Bihar', pinCode: '800004',
      latitude: 25.6107, longitude: 85.1376,
      riskCategory: 'HIGH', auditPriority: 'HIGH', source: 'MANUAL',
    },
    {
      facilityId: 'BIH-GAY-H-0001',
      facilityName: 'Anugrah Narayan Magadh Medical College',
      facilityType: 'Medical College Hospital',
      state: 'Bihar', district: 'Gaya',
      specialities: ['General Medicine', 'Surgery', 'Dermatology'],
      hospitalType: 'Government', totalBedStrength: 800,
      nodalOfficerName: 'Dr. Sunita Devi', nodalOfficerNumber: '9811000002',
      nodalOfficerEmail: 'nodal.anmmc@gov.in', schemeCode: 'ANMMC-BIH-001',
      address: 'Sherghati Road, Gaya, Bihar', pinCode: '823001',
      latitude: 24.7914, longitude: 85.0002,
      riskCategory: 'MEDIUM', auditPriority: 'NORMAL', source: 'MANUAL',
    },
    {
      facilityId: 'BIH-MUZ-H-0001',
      facilityName: 'Sri Krishna Medical College and Hospital',
      facilityType: 'Medical College Hospital',
      state: 'Bihar', district: 'Muzaffarpur',
      specialities: ['General Medicine', 'Pediatrics', 'ENT', 'Ophthalmology'],
      hospitalType: 'Government', totalBedStrength: 1000,
      nodalOfficerName: 'Dr. Rakesh Prasad', nodalOfficerNumber: '9811000003',
      nodalOfficerEmail: 'nodal.skmch@gov.in', schemeCode: 'SKMCH-BIH-001',
      address: 'Umanagar, Muzaffarpur, Bihar', pinCode: '842004',
      latitude: 26.1197, longitude: 85.3910,
      riskCategory: 'MEDIUM', auditPriority: 'NORMAL', source: 'MANUAL',
    },
    {
      facilityId: 'BIH-NAL-H-0001',
      facilityName: 'Sadar Hospital Nalanda',
      facilityType: 'Sadar Hospital',
      state: 'Bihar', district: 'Nalanda',
      specialities: ['General Medicine', 'Surgery', 'Gynecology'],
      hospitalType: 'Government', totalBedStrength: 200,
      nodalOfficerName: 'Dr. Meena Kumari', nodalOfficerNumber: '9811000004',
      nodalOfficerEmail: 'nodal.nalanda.sdh@gov.in', schemeCode: 'SDH-NAL-001',
      address: 'Biharsharif, Nalanda, Bihar', pinCode: '803101',
      latitude: 25.1981, longitude: 85.5270,
      riskCategory: 'LOW', auditPriority: 'LOW', source: 'MANUAL',
    },
    {
      facilityId: 'BIH-BHG-H-0001',
      facilityName: 'Jawaharlal Nehru Medical College Bhagalpur',
      facilityType: 'Medical College Hospital',
      state: 'Bihar', district: 'Bhagalpur',
      specialities: ['General Medicine', 'Surgery', 'Neurology', 'Cardiology'],
      hospitalType: 'Government', totalBedStrength: 900,
      nodalOfficerName: 'Dr. Suresh Singh', nodalOfficerNumber: '9811000005',
      nodalOfficerEmail: 'nodal.jlnmc@gov.in', schemeCode: 'JLNMC-BIH-001',
      address: 'Bhagalpur, Bihar', pinCode: '812001',
      latitude: 25.2425, longitude: 86.9842,
      riskCategory: 'HIGH', auditPriority: 'HIGH', source: 'MANUAL',
    },
  ];

  console.log('');
  for (const h of hospitals) {
    await Hospital.create(h);
    console.log(`Created Hospital : ${h.facilityName} (${h.facilityId})`);
  }

  // ── Default settings ────────────────────────────────────────────────────
  const defaultSettings = [
    { key: 'districts', value: ['Patna', 'Gaya', 'Muzaffarpur', 'Nalanda', 'Bhagalpur', 'Darbhanga', 'Purnia', 'Begusarai', 'Sitamarhi', 'Vaishali'], description: 'List of districts for hospital filtering' },
    { key: 'hospitalTypes', value: ['Government', 'Private', 'Trust/NGO', 'Central Government', 'Semi-Government'], description: 'Types of hospitals' },
    { key: 'facilityTypes', value: ['Medical College Hospital', 'Sadar Hospital', 'Sub-Divisional Hospital', 'Primary Health Centre', 'Community Health Centre', 'District Hospital', 'Referral Hospital', 'Specialty Hospital'], description: 'Types of facilities' },
    { key: 'specialities', value: ['General Medicine', 'Surgery', 'Pediatrics', 'Gynecology', 'Orthopedics', 'ENT', 'Ophthalmology', 'Dermatology', 'Cardiology', 'Neurology', 'Psychiatry', 'Radiology', 'Anesthesia', 'Pathology'], description: 'Medical specialities' },
    { key: 'schemes', value: ['PMJAY', 'NABH', 'NHM', 'PMCH Scheme', 'State Health Mission'], description: 'Government health schemes' },
    { key: 'auditTypes', value: ['Routine', 'Surprise', 'Complaint', 'Follow-up', 'Re-audit', 'Special', 'Verification'], description: 'Types of audits' },
    { key: 'priorities', value: ['Low', 'Normal', 'High', 'Critical'], description: 'Priority levels' },
    { key: 'reassignmentReasons', value: ['Team member unavailable due to illness', 'Conflict of interest', 'Expertise mismatch', 'Logistical constraints', 'Prior commitment', 'Natural disaster in area', 'Other'], description: 'Reasons for requesting reassignment' },
    { key: 'rescheduleReasons', value: ['Hospital not ready', 'Team member unavailable', 'Weather conditions', 'Travel disruption', 'Administrative requirement', 'Other'], description: 'Reasons for rescheduling an audit' },
    { key: 'acknowledgementTimeoutHours', value: 24, description: 'Hours within which team lead must acknowledge assignment' },
  ];

  for (const s of defaultSettings) {
    await Setting.create({ ...s, updatedBy: admin._id, updatedAt: new Date() });
  }

  console.log(`\nSeeded ${defaultSettings.length} default settings.`);
  console.log('\n=== Seeding Complete ===\n');
  console.log('Admin   : admin@hams.gov.in  / Admin@1234');
  console.log('Teams   : t01@hams.gov.in … t20@hams.gov.in  / Team@1234');
  console.log('          (team names: T-01 … T-20)\n');

  process.exit(0);
};

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
