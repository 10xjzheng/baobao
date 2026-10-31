const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const database = cloud.database();
const command = database.command;

const COLLECTIONS = {
  babies: 'babies', members: 'familyMembers', feeds: 'feedRecords', growth: 'growthRecords', reminders: 'reminders', invites: 'familyInvites'
};

function ok(data) { return { ok: true, data }; }
function fail(message, code = 'BAD_REQUEST') { return { ok: false, code, message }; }
function text(value, maximum = 200) { return String(value || '').trim().slice(0, maximum); }
function numberInRange(value, minimum, maximum, optional = false) {
  if ((value === null || value === '' || typeof value === 'undefined') && optional) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`数值应在 ${minimum}–${maximum} 之间`);
  return parsed;
}

async function membershipFor(openid) {
  const result = await database.collection(COLLECTIONS.members).where({ openid, status: 'active' }).limit(1).get();
  return result.data[0] || null;
}

async function requireMembership(openid, roles = ['admin', 'editor', 'viewer']) {
  const membership = await membershipFor(openid);
  if (!membership || !roles.includes(membership.role)) throw new Error('你没有访问这个家庭的权限');
  return membership;
}

async function createFamily(openid, payload) {
  if (await membershipFor(openid)) throw new Error('当前微信已加入一个家庭');
  const babyName = text(payload.babyName, 20) || '宝宝';
  const babyResult = await database.collection(COLLECTIONS.babies).add({ data: { name: babyName, birthday: '', gender: 'unknown', createdBy: openid, createdAt: database.serverDate(), updatedAt: database.serverDate() } });
  const membership = { babyId: babyResult._id, openid, nickname: '妈妈', role: 'admin', status: 'active', joinedAt: database.serverDate() };
  await database.collection(COLLECTIONS.members).add({ data: membership });
  return { id: babyResult._id };
}

async function getDashboard(openid) {
  const membership = await membershipFor(openid);
  if (!membership) return { needsOnboarding: true, baby: { name: '宝宝', birthday: '', gender: 'unknown' }, feedCount: 0, feedAmount: 0, latestWeight: null, nextReminder: '--:--', timeline: [] };
  const baby = (await database.collection(COLLECTIONS.babies).doc(membership.babyId).get()).data;
  const feeds = (await database.collection(COLLECTIONS.feeds).where({ babyId: membership.babyId }).orderBy('recordedAt', 'desc').limit(20).get()).data;
  const growth = (await database.collection(COLLECTIONS.growth).where({ babyId: membership.babyId }).orderBy('measuredAt', 'desc').limit(1).get()).data[0];
  const reminder = (await database.collection(COLLECTIONS.reminders).where({ babyId: membership.babyId }).limit(1).get()).data[0];
  const today = new Date().toISOString().slice(0, 10);
  const todayFeeds = feeds.filter(record => String(record.recordedAt).startsWith(today));
  const milkFeeds = todayFeeds.filter(record => record.type !== 'solid');
  const reminderInfo = computeNextReminder(milkFeeds[0], reminder);
  return { baby: { id: baby._id, name: baby.name, birthday: baby.birthday || '', gender: baby.gender || 'unknown' }, feedCount: milkFeeds.length, feedAmount: milkFeeds.reduce((total, record) => total + Number(record.amount || 0), 0), latestWeight: growth ? growth.weight : null, ...reminderInfo, timeline: todayFeeds.slice(0, 3).map(formatFeed) };
}

function formatFeed(record) {
  const typeNames = { breast: '母乳', formula: '奶粉', mixed: '混合', solid: '辅食' };
  const parts = [];
  if (record.amount) parts.push(`${record.amount} ml`);
  if (record.duration) parts.push(`${record.duration} 分钟`);
  if (record.solidAmount) parts.push(`辅食 ${record.solidAmount} ml`);
  return { id: record._id, type: record.type, typeName: typeNames[record.type], amount: record.amount, duration: record.duration, solidAmount: record.solidAmount || 0, recordedAt: record.recordedAt, dateText: String(record.recordedAt).slice(0, 10), timeText: String(record.recordedAt).slice(11, 16), valueText: parts.join(' · '), recorderName: record.recorderName || '家庭成员' };
}

function timeToMinutes(value) {
  const parts = String(value || '').split(':').map(Number);
  return parts.length === 2 && parts.every(Number.isFinite) ? parts[0] * 60 + parts[1] : null;
}

function formatMinutes(total) {
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function computeNextReminder(lastFeed, reminder) {
  if (!lastFeed || !reminder || !reminder.enabled) return { nextReminder: '--:--', reminderText: '提醒未开启' };
  const feedMinutes = timeToMinutes(String(lastFeed.recordedAt).slice(11, 16));
  if (feedMinutes === null) return { nextReminder: '--:--', reminderText: '等待有效记录' };
  let target = feedMinutes + Number(reminder.intervalMinutes || 0);
  const quietStart = timeToMinutes(reminder.quietStart); const quietEnd = timeToMinutes(reminder.quietEnd);
  const targetOfDay = ((target % 1440) + 1440) % 1440;
  if (quietStart !== null && quietEnd !== null) {
    const inQuiet = quietStart > quietEnd ? targetOfDay >= quietStart || targetOfDay < quietEnd : targetOfDay >= quietStart && targetOfDay < quietEnd;
    if (inQuiet) target += (quietEnd - targetOfDay + 1440) % 1440;
  }
  return { nextReminder: formatMinutes(target), reminderText: `下次喂奶 ${formatMinutes(target)}` };
}

async function listFeedRecords(openid) {
  const membership = await requireMembership(openid);
  const records = await database.collection(COLLECTIONS.feeds).where({ babyId: membership.babyId }).orderBy('recordedAt', 'desc').limit(100).get();
  return records.data.map(formatFeed);
}

async function createFeed(openid, payload) {
  const membership = await requireMembership(openid, ['admin', 'editor']);
  const type = text(payload.type, 12);
  if (!['breast', 'formula', 'mixed', 'solid'].includes(type)) throw new Error('喂养方式不正确');
  let amount; let duration; let solidAmount;
  if (type === 'mixed') {
    const filled = value => Number.isFinite(Number(value)) && Number(value) > 0;
    amount = filled(payload.amount) ? numberInRange(payload.amount, 1, 1000) : 0;
    duration = filled(payload.duration) ? numberInRange(payload.duration, 1, 240) : 0;
    solidAmount = filled(payload.solidAmount) ? numberInRange(payload.solidAmount, 1, 1000) : 0;
    if ([amount, duration, solidAmount].filter(value => value > 0).length < 2) throw new Error('混合喂养请至少填写两项');
  } else {
    amount = type === 'breast' ? 0 : numberInRange(payload.amount, 1, 1000);
    duration = type === 'breast' ? numberInRange(payload.duration, 1, 240) : 0;
    solidAmount = 0;
  }
  const recordedAt = text(payload.recordedAt, 16);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(recordedAt)) throw new Error('记录时间格式不正确');
  const result = await database.collection(COLLECTIONS.feeds).add({ data: { babyId: membership.babyId, type, amount, duration, solidAmount, note: text(payload.note), recordedAt, recorderId: membership._id, recorderName: membership.nickname, createdBy: openid, createdAt: database.serverDate(), updatedAt: database.serverDate() } });
  return { id: result._id };
}

async function deleteFeed(openid, payload) {
  const membership = await requireMembership(openid, ['admin', 'editor']);
  const id = text(payload.id, 64);
  if (!id) throw new Error('记录编号不能为空');
  let record;
  try { record = (await database.collection(COLLECTIONS.feeds).doc(id).get()).data; }
  catch (error) { throw new Error('没有找到这条记录'); }
  if (record.babyId !== membership.babyId) throw new Error('你不能删除其他家庭的记录');
  if (membership.role !== 'admin' && record.recorderId !== membership._id) throw new Error('你只能删除自己创建的记录');
  await database.collection(COLLECTIONS.feeds).doc(id).remove();
  return { id };
}

async function listGrowthRecords(openid) {
  const membership = await requireMembership(openid);
  const result = await database.collection(COLLECTIONS.growth).where({ babyId: membership.babyId }).orderBy('measuredAt', 'asc').limit(100).get();
  return result.data.map(record => ({ id: record._id, measuredAt: record.measuredAt, weight: record.weight, height: record.height, headCircumference: record.headCircumference, recorderName: record.recorderName }));
}

async function createGrowth(openid, payload) {
  const membership = await requireMembership(openid, ['admin', 'editor']);
  const metricRules = { weight: { name: '体重', minimum: .1, maximum: 100 }, height: { name: '身高', minimum: 10, maximum: 250 }, headCircumference: { name: '头围', minimum: 10, maximum: 100 } };
  const values = {};
  Object.keys(metricRules).forEach(field => {
    const rule = metricRules[field];
    values[field] = numberInRange(payload[field], rule.minimum, rule.maximum, true);
  });
  if (Object.values(values).every(value => value === null)) throw new Error('请至少填写一个成长指标');
  const measuredAt = text(payload.measuredAt, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredAt)) throw new Error('测量日期格式不正确');
  const inheritedFields = Object.keys(metricRules).filter(field => values[field] === null);
  if (inheritedFields.length) {
    const previousRecords = (await database.collection(COLLECTIONS.growth).where({ babyId: membership.babyId }).orderBy('measuredAt', 'desc').limit(100).get()).data;
    inheritedFields.forEach(field => {
      const rule = metricRules[field];
      const previous = previousRecords.find(record => {
        const value = record[field];
        const parsed = Number(value);
        return value !== null && value !== '' && typeof value !== 'undefined' && Number.isFinite(parsed) && parsed >= rule.minimum && parsed <= rule.maximum;
      });
      if (!previous) throw new Error(`暂无可沿用的${rule.name}，请补充填写`);
      values[field] = Number(previous[field]);
    });
  }
  const result = await database.collection(COLLECTIONS.growth).add({ data: { babyId: membership.babyId, measuredAt, ...values, note: text(payload.note), recorderId: membership._id, recorderName: membership.nickname, createdBy: openid, createdAt: database.serverDate(), updatedAt: database.serverDate() } });
  return { id: result._id, inheritedFields };
}

async function deleteGrowth(openid, payload) {
  const membership = await requireMembership(openid, ['admin', 'editor']);
  const id = text(payload.id, 64);
  if (!id) throw new Error('记录编号不能为空');
  let record;
  try { record = (await database.collection(COLLECTIONS.growth).doc(id).get()).data; }
  catch (error) { throw new Error('没有找到这条记录'); }
  if (record.babyId !== membership.babyId) throw new Error('你不能删除其他家庭的记录');
  if (membership.role !== 'admin' && record.recorderId !== membership._id) throw new Error('你只能删除自己创建的记录');
  await database.collection(COLLECTIONS.growth).doc(id).remove();
  return { id };
}

async function getProfile(openid) {
  const membership = await membershipFor(openid);
  if (!membership) return { needsOnboarding: true, baby: { name: '宝宝', ageText: '等待加入家庭' }, babyInitial: '宝', members: [], reminder: { enabled: false }, currentRole: null };
  const baby = (await database.collection(COLLECTIONS.babies).doc(membership.babyId).get()).data;
  const members = (await database.collection(COLLECTIONS.members).where({ babyId: membership.babyId, status: 'active' }).get()).data.map(member => ({ id: member._id, nickname: member.nickname, initial: member.nickname.slice(0, 1), role: member.role }));
  const reminder = (await database.collection(COLLECTIONS.reminders).where({ babyId: membership.babyId }).limit(1).get()).data[0] || { enabled: false, intervalMinutes: 180, advanceMinutes: 10, quietStart: '22:00', quietEnd: '07:00' };
  return { baby: { id: baby._id, name: baby.name, birthday: baby.birthday || '', gender: baby.gender || 'unknown', ageText: baby.ageText || '宝宝档案' }, babyInitial: baby.name.slice(0, 1), members, reminder, currentRole: membership.role, currentMemberId: membership._id };
}

async function updateBaby(openid, payload) {
  const membership = await requireMembership(openid, ['admin']);
  const name = text(payload.name, 20);
  if (!name) throw new Error('宝宝昵称不能为空');
  const birthday = text(payload.birthday, 10);
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) throw new Error('生日格式不正确');
  const gender = text(payload.gender, 10);
  if (!['girl', 'boy', 'unknown'].includes(gender)) throw new Error('性别选项不正确');
  await database.collection(COLLECTIONS.babies).doc(membership.babyId).update({ data: { name, birthday, gender, updatedBy: openid, updatedAt: database.serverDate() } });
  return { id: membership.babyId, name, birthday, gender };
}

async function updateMemberRole(openid, payload) {
  const membership = await requireMembership(openid, ['admin']);
  const id = text(payload.id, 64); const role = text(payload.role, 12);
  if (!['editor', 'viewer'].includes(role)) throw new Error('成员权限不正确');
  let member;
  try { member = (await database.collection(COLLECTIONS.members).doc(id).get()).data; }
  catch (error) { throw new Error('没有找到该成员'); }
  if (member.babyId !== membership.babyId) throw new Error('你不能修改其他家庭的成员');
  if (member.role === 'admin') throw new Error('管理员权限不能在这里修改');
  await database.collection(COLLECTIONS.members).doc(id).update({ data: { role, updatedBy: openid, updatedAt: database.serverDate() } });
  return { id, role };
}

async function updateMemberNickname(openid, payload) {
  const membership = await requireMembership(openid);
  const id = text(payload.id, 64);
  const nickname = text(payload.nickname, 12);
  if (!id) throw new Error('成员编号不能为空');
  if (!nickname) throw new Error('家庭称呼不能为空');
  let member;
  try { member = (await database.collection(COLLECTIONS.members).doc(id).get()).data; }
  catch (error) { throw new Error('没有找到该成员'); }
  if (member.babyId !== membership.babyId) throw new Error('你不能修改其他家庭的成员');
  if (membership.role !== 'admin' && member._id !== membership._id) throw new Error('你只能修改自己的家庭称呼');
  await database.collection(COLLECTIONS.members).doc(id).update({ data: { nickname, updatedBy: openid, updatedAt: database.serverDate() } });
  return { id, nickname };
}

async function updateReminder(openid, payload) {
  const membership = await requireMembership(openid, ['admin', 'editor']);
  const data = { babyId: membership.babyId, enabled: Boolean(payload.enabled), intervalMinutes: numberInRange(payload.intervalMinutes, 30, 1440), advanceMinutes: numberInRange(payload.advanceMinutes, 0, 180), quietStart: text(payload.quietStart, 5), quietEnd: text(payload.quietEnd, 5), updatedAt: database.serverDate(), updatedBy: openid };
  const existing = await database.collection(COLLECTIONS.reminders).where({ babyId: membership.babyId }).limit(1).get();
  if (existing.data[0]) await database.collection(COLLECTIONS.reminders).doc(existing.data[0]._id).update({ data }); else await database.collection(COLLECTIONS.reminders).add({ data: { ...data, createdAt: database.serverDate() } });
  return data;
}

async function createInvite(openid) {
  const membership = await requireMembership(openid, ['admin']);
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await database.collection(COLLECTIONS.invites).add({ data: { code, babyId: membership.babyId, role: 'editor', createdBy: openid, createdAt: database.serverDate(), expiresAt, status: 'active' } });
  return { code, expiresAt: expiresAt.toISOString() };
}

async function joinFamily(openid, payload) {
  if (await membershipFor(openid)) throw new Error('当前微信已加入一个家庭');
  const code = text(payload.code, 12).toUpperCase();
  const inviteResult = await database.collection(COLLECTIONS.invites).where({ code, status: 'active', expiresAt: command.gt(new Date()) }).limit(1).get();
  const invite = inviteResult.data[0];
  if (!invite) throw new Error('邀请码无效或已过期');
  const result = await database.collection(COLLECTIONS.members).add({ data: { babyId: invite.babyId, openid, nickname: '家庭成员', role: invite.role, status: 'active', joinedAt: database.serverDate() } });
  await database.collection(COLLECTIONS.invites).doc(invite._id).update({ data: { status: 'used', usedBy: openid, usedAt: database.serverDate() } });
  return { id: result._id };
}

exports.main = async event => {
  const { OPENID } = cloud.getWXContext();
  const action = text(event.action, 40); const payload = event.payload || {};
  try {
    const handlers = { createFamily, getDashboard, listFeedRecords, createFeed, deleteFeed, listGrowthRecords, createGrowth, deleteGrowth, getProfile, updateBaby, updateMemberRole, updateMemberNickname, updateReminder, createInvite, joinFamily };
    if (!handlers[action]) return fail('不支持的操作');
    return ok(await handlers[action](OPENID, payload));
  } catch (error) {
    console.error({ action, message: error.message });
    return fail(error.message || '服务暂时不可用');
  }
};
