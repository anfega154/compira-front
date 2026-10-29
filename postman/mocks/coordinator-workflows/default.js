const http = require('http');
const prefix = 'coordinator-workflows.';
const now = '2026-10-29T12:00:00Z';
const coordinator = { id: 'coordinator-1', email: 'coordinator@example.test', firstName: 'Carolina', lastName: 'López' };
const member = { id: 'user-1', email: 'member@example.test', firstName: 'Ana', lastName: 'García' };
const originalTask = { id: 'task-1', title: 'Entrega del informe', description: 'Validación de seguimiento', dueDate: '2026-10-30T12:00:00Z', status: 'IN_PROGRESS', overdue: false, responsibleUserId: member.id, createdByUserId: coordinator.id, createdAt: now, updatedAt: now, teamId: 'team-1', teamName: 'Operaciones' };
const initialHistory = [
  { id: 'h1', taskId: 'task-1', event: 'CREATED', actorUserId: coordinator.id, actorName: 'Carolina López', actorEmail: coordinator.email, previousValue: null, newValue: 'PENDING', detail: null, createdAt: now },
  { id: 'h2', taskId: 'task-1', event: 'STATUS_CHANGED', actorUserId: null, actorName: null, actorEmail: null, previousValue: 'PENDING', newValue: 'DELAYED', detail: null, createdAt: now },
  { id: 'h3', taskId: 'task-1', event: 'STATUS_CHANGED', actorUserId: member.id, actorName: 'Ana García', actorEmail: member.email, previousValue: 'DELAYED', newValue: 'IN_PROGRESS', detail: null, createdAt: now },
];
const initialNotices = [{ id: '1', taskId: 'task-1', taskTitle: originalTask.title, type: 'DUE_SOON', createdAt: now, readAt: null }];
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const path = new URL(req.url, 'http://localhost').pathname;
  const reply = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(status === 204 ? undefined : JSON.stringify(body)); };
  const task = await pm.state.get(prefix + 'task') || originalTask;
  const history = await pm.state.get(prefix + 'history') || initialHistory;
  const observations = await pm.state.get(prefix + 'observations') || [];
  const notices = await pm.state.get(prefix + 'notices') || initialNotices;
  const actor = req.headers.authorization === 'Bearer fixture-collaborator-token' ? member : coordinator;
  const actorName = actor.firstName + ' ' + actor.lastName;
  const addNotice = async type => pm.state.set(prefix + 'notices', [...notices, { id: String(notices.length + 1), taskId: task.id, taskTitle: task.title, type, createdAt: new Date().toISOString(), readAt: null }]);
  if (req.method === 'GET' && path === '/v1/notifications') return reply(notices.slice().reverse());
  if (req.method === 'GET' && ['/v1/tasks', '/v1/tasks/assigned'].includes(path)) return reply([task]);
  if (req.method === 'GET' && path === '/v1/tasks/task-1') return reply(task);
  if (req.method === 'GET' && path === '/v1/tasks/task-1/history') return reply(history);
  if (req.method === 'GET' && path === '/v1/tasks/task-1/observations') return reply(observations);
  if (req.method === 'POST' && path === '/v1/tasks/task-1/status') {
    if (actor.id !== member.id) return reply({ code: 'TASK_007', message: 'Solo el responsable cambia estado' }, 403);
    if (req.body?.status !== 'COMPLETED' || task.status !== 'IN_PROGRESS') return reply({ code: 'TASK_009', message: 'Transición inválida' }, 409);
    const updated = { ...task, status: 'COMPLETED' };
    await pm.state.set(prefix + 'task', updated);
    await pm.state.set(prefix + 'history', [...history, { id: 'h' + (history.length + 1), taskId: task.id, event: 'STATUS_CHANGED', actorUserId: actor.id, actorName, actorEmail: actor.email, previousValue: task.status, newValue: 'COMPLETED', detail: null, createdAt: new Date().toISOString() }]);
    await addNotice('TASK_COMPLETED');
    return reply(updated);
  }
  if (req.method === 'POST' && path === '/v1/tasks/task-1/observations') {
    const content = req.body?.content;
    if (typeof content !== 'string' || !content.trim() || content.length > 2000) return reply({ code: 'TASK_013', message: 'Observación inválida' }, 400);
    const saved = { id: 'o' + (observations.length + 1), taskId: task.id, authorUserId: actor.id, authorName: actorName, authorEmail: actor.email, content, createdAt: new Date().toISOString() };
    await pm.state.set(prefix + 'observations', [...observations, saved]);
    await pm.state.set(prefix + 'history', [...history, { id: 'h' + (history.length + 1), taskId: task.id, event: 'OBSERVATION_ADDED', actorUserId: actor.id, actorName, actorEmail: actor.email, previousValue: null, newValue: null, detail: content, createdAt: saved.createdAt }]);
    await addNotice('OBSERVATION_ADDED');
    return reply(saved, 201);
  }
  if (req.method === 'GET' && path === '/v1/users') return reply([{ ...coordinator, phoneNumber: '+573001112233', status: 'ACTIVE', roles: ['COORDINATOR'], teamId: 'team-1', teamName: 'Operaciones, Ventas', createdAt: now, lastLoginAt: now }]);
  if (req.method === 'GET' && path === '/v1/teams') return reply([{ id: 'team-1', name: 'Operaciones', coordinatorUserId: coordinator.id, coordinatorEmail: coordinator.email }]);
  return reply({ message: 'Endpoint not modeled' }, 501);
}).listen(process.env.PORT);
