// Local UI fixtures derived from TaskHandler/TeamHandler response contracts.
// This mock does not establish backend authorization or database correctness.
const http = require('http');
const baseTask = { id: 'task-1', title: 'Informe mensual de operaciones', description: 'Seguimiento y revisión del equipo', dueDate: '2026-10-30T12:00:00Z', status: 'IN_PROGRESS', overdue: false, responsibleUserId: 'user-1', createdByUserId: 'coordinator-1', createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z', teamId: 'team-1', teamName: 'Operaciones' };
const team = { id: 'team-1', name: 'Operaciones', coordinatorUserId: 'coordinator-1', coordinatorEmail: 'coordinator@example.test' };
const otherMember = { id: 'user-2', email: 'next@example.test', firstName: 'Luis', lastName: 'Pérez' };
const member = { id: 'user-1', email: 'member@example.test', firstName: 'Ana', lastName: 'García' };
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const path = new URL(req.url, 'http://localhost').pathname;
  const reply = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(status === 204 ? undefined : JSON.stringify(body)); };
  const task = await pm.state.get('compira.task') || baseTask;
  const observations = await pm.state.get('compira.observations') || [];
  if (path === '/v1/notifications/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(`data: ${JSON.stringify([{ id: '1', taskId: 'task-1', taskTitle: baseTask.title, type: 'ASSIGNED', createdAt: baseTask.createdAt, readAt: null }])}\n\n`);
    return;
  }
  if (path === '/v1/tasks/indicators') return reply({ totalTasks: 1, overdueCount: 0, dueSoonCount: 0, closedCount: 0, closedOnTimeCount: 0, compliancePercentage: null, workloadByAssignee: [{ assigneeId: 'user-1', assigneeName: 'Ana García', assigneeEmail: member.email, taskCount: 1 }], assignees: [{ id: 'user-1', name: 'Ana García', email: member.email }] });
  if (path === '/v1/tasks/reports') return reply({ rows: [{ assigneeId: 'user-1', assigneeName: 'Ana García', assigneeEmail: member.email, totalTasks: 1, activeTasks: 1, closedTasks: 0, closedOnTimeTasks: 0, overdueTasks: 0, compliancePercentage: null, averageClosureHours: null }] });
  if (path === '/v1/tasks' || path === '/v1/tasks/assigned') return reply([task]);
  if (path === '/v1/tasks/task-1') return reply(task);
  if (req.method === 'POST' && ['/v1/tasks/task-1/assign', '/v1/tasks/task-1/reassign'].includes(path)) {
    const email = path.endsWith('/reassign') ? req.body?.newResponsibleEmail : req.body?.responsibleEmail;
    const selected = [member, otherMember].find(candidate => candidate.email === email);
    if (!selected) return reply({ code: 'TEAM_001', message: 'El responsable debe pertenecer al equipo de la tarea' }, 409);
    const updated = { ...task, responsibleUserId: selected.id };
    await pm.state.set('compira.task', updated);
    return reply(updated);
  }
  if (path === '/v1/tasks/task-1/history') return reply(observations.map(o => ({ id: o.id, taskId: o.taskId, event: 'OBSERVATION_ADDED', actorUserId: o.authorUserId, previousValue: null, newValue: null, detail: o.content, createdAt: o.createdAt })));
  if (path === '/v1/tasks/task-1/observations') {
    if (req.method === 'GET') return reply(observations);
    const content = req.body?.content;
    if (typeof content !== 'string' || !content.trim() || content.length > 2000) return reply({ code: 'VALIDATION_ERROR', message: 'Observación inválida' }, 400);
    const saved = { id: String(observations.length + 1), taskId: 'task-1', authorUserId: 'coordinator-1', content, createdAt: new Date().toISOString() };
    await pm.state.set('compira.observations', [...observations, saved]);
    return reply(saved, 201);
  }
  if (path === '/v1/teams') return reply([team]);
  if (path === '/v1/teams/team-1/members') return reply([member, otherMember]);
  if (path === '/v1/users') return reply([{ ...member, cognitoSub: 'fixture', phoneNumber: '+573001112233', preferredMfaChannel: 'EMAIL', status: 'ACTIVE', roles: ['COLLABORATOR'], teamName: 'Operaciones', lastLoginAt: baseTask.createdAt }]);
  if (path === '/v1/organization/settings') return reply({ timeZone: 'America/Bogota', notificationsEnabled: true });
  return reply({ message: 'Endpoint not modeled in UI audit' }, 501);
}).listen(process.env.PORT || 4946);
