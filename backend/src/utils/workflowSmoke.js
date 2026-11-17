/*
 * Read-only deployment smoke check.
 * Usage: npm run verify:workflow
 * Optional environment: API_URL, ADMIN_EMAIL, ADMIN_PASSWORD,
 * TEAM_LEAD_EMAIL, TEAM_LEAD_PASSWORD. Defaults match the development seed.
 */
const assert = require('node:assert/strict');

const baseUrl = process.env.API_URL || 'http://localhost:5000/api';
const credentials = {
  admin: { email: process.env.ADMIN_EMAIL || 'admin@hmas.gov.in', password: process.env.ADMIN_PASSWORD || 'Admin@1234' },
  teamLead: { email: process.env.TEAM_LEAD_EMAIL || 'teamlead@hmas.gov.in', password: process.env.TEAM_LEAD_PASSWORD || 'Lead@1234' },
};

const request = async (path, token) => {
  const response = await fetch(`${baseUrl}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const body = await response.json().catch(() => ({}));
  assert.ok(response.ok, `${path}: ${body.message || response.statusText}`);
  return body;
};
const login = async (account) => {
  const response = await fetch(`${baseUrl}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials[account]) });
  const body = await response.json().catch(() => ({}));
  const token = body.accessToken || body.token;
  assert.ok(response.ok && token, `${account} login failed: ${body.message || response.statusText}`);
  return token;
};

(async () => {
  await request('/health');
  const adminToken = await login('admin');
  const leadToken = await login('teamLead');
  const [adminDashboard, audits, teams, templates, reports, leadDashboard, assignments] = await Promise.all([
    request('/v1/dashboard/admin', adminToken), request('/v1/audits?limit=1', adminToken), request('/v1/teams?limit=1', adminToken),
    request('/v1/checklists/templates', adminToken), request('/v1/audits?status=COMPLETED,SUBMITTED,RETURNED,CLOSED&limit=1', adminToken),
    request('/v1/dashboard/team-lead', leadToken), request('/v1/assignments/my-assignments?limit=1', leadToken),
  ]);
  assert.ok(adminDashboard.summary && Array.isArray(audits.audits) && Array.isArray(teams.teams));
  assert.ok(Array.isArray(templates.templates) && Array.isArray(reports.audits));
  assert.ok(leadDashboard.summary && Array.isArray(assignments.assignments));
  console.log('Workflow smoke check passed: Admin, Team Lead, reports, checklist templates, and assignments are reachable.');
})().catch((error) => { console.error(`Workflow smoke check failed: ${error.message}`); process.exitCode = 1; });
