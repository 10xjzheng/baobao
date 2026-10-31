const environment = require('../config/env');
const localStore = require('./local-store');

function useCloud() {
  return Boolean(environment.CLOUD_ENABLED && environment.CLOUD_ENV_ID && getApp().globalData.cloudReady);
}

async function callCloud(action, payload = {}) {
  const response = await wx.cloud.callFunction({
    name: environment.CLOUD_FUNCTION_NAME,
    data: { action, payload }
  });
  if (!response.result || response.result.ok !== true) {
    throw new Error((response.result && response.result.message) || '云端服务暂时不可用');
  }
  return response.result.data;
}

function formatFeed(record) {
  const typeNames = { breast: '母乳', formula: '奶粉', mixed: '混合', solid: '辅食' };
  const parts = [];
  if (record.amount) parts.push(`${record.amount} ml`);
  if (record.duration) parts.push(`${record.duration} 分钟`);
  if (record.solidAmount) parts.push(`辅食 ${record.solidAmount} ml`);
  return {
    ...record,
    typeName: typeNames[record.type] || '喂奶',
    dateText: record.recordedAt.slice(0, 10),
    timeText: record.recordedAt.slice(11, 16),
    valueText: parts.join(' · ')
  };
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
  const quietStart = timeToMinutes(reminder.quietStart);
  const quietEnd = timeToMinutes(reminder.quietEnd);
  const targetOfDay = ((target % 1440) + 1440) % 1440;
  if (quietStart !== null && quietEnd !== null) {
    const inQuiet = quietStart > quietEnd ? targetOfDay >= quietStart || targetOfDay < quietEnd : targetOfDay >= quietStart && targetOfDay < quietEnd;
    if (inQuiet) target += (quietEnd - targetOfDay + 1440) % 1440;
  }
  return { nextReminder: formatMinutes(target), reminderText: `下次喂奶 ${formatMinutes(target)}` };
}

async function getDashboard() {
  if (useCloud()) return callCloud('getDashboard');
  const data = localStore.read();
  const today = localStore.dateText();
  const todayFeeds = data.feedRecords.filter(record => record.recordedAt.startsWith(today));
  const milkFeeds = todayFeeds.filter(record => record.type !== 'solid');
  const latestGrowth = data.growthRecords[data.growthRecords.length - 1];
  const reminderInfo = computeNextReminder(milkFeeds[milkFeeds.length - 1], data.reminder);
  return {
    mode: 'demo', baby: data.baby,
    feedCount: milkFeeds.length,
    feedAmount: milkFeeds.reduce((total, record) => total + (record.amount || 0), 0),
    latestWeight: latestGrowth ? latestGrowth.weight : null,
    ...reminderInfo,
    timeline: todayFeeds.slice(-3).reverse().map(formatFeed)
  };
}

async function listFeedRecords() {
  if (useCloud()) return callCloud('listFeedRecords');
  return localStore.read().feedRecords.slice().reverse().map(formatFeed);
}

async function createFeed(payload) {
  if (useCloud()) return callCloud('createFeed', payload);
  const data = localStore.read();
  data.feedRecords.push({ id: `feed-${Date.now()}`, recorderName: '妈妈', ...payload });
  localStore.write(data);
  return { id: data.feedRecords[data.feedRecords.length - 1].id };
}

async function deleteFeed(id) {
  if (useCloud()) return callCloud('deleteFeed', { id });
  const data = localStore.read();
  const originalLength = data.feedRecords.length;
  data.feedRecords = data.feedRecords.filter(record => record.id !== id);
  if (data.feedRecords.length === originalLength) throw new Error('没有找到这条记录');
  localStore.write(data);
  return { id };
}

async function listGrowthRecords() {
  if (useCloud()) return callCloud('listGrowthRecords');
  return localStore.read().growthRecords;
}

async function createGrowth(payload) {
  if (useCloud()) return callCloud('createGrowth', payload);
  const data = localStore.read();
  const metricNames = { weight: '体重', height: '身高', headCircumference: '头围' };
  const values = { weight: payload.weight, height: payload.height, headCircumference: payload.headCircumference };
  const hasValue = value => value !== null && value !== '' && typeof value !== 'undefined' && Number.isFinite(Number(value));
  if (Object.values(values).every(value => !hasValue(value))) throw new Error('请至少填写一个成长指标');
  const inheritedFields = [];
  Object.keys(metricNames).forEach(field => {
    if (hasValue(values[field])) return;
    const previous = data.growthRecords.slice().reverse().find(record => hasValue(record[field]));
    if (!previous) throw new Error(`暂无可沿用的${metricNames[field]}，请补充填写`);
    values[field] = Number(previous[field]);
    inheritedFields.push(field);
  });
  data.growthRecords.push({ id: `growth-${Date.now()}`, recorderName: '妈妈', ...payload, ...values });
  localStore.write(data);
  return { id: data.growthRecords[data.growthRecords.length - 1].id, inheritedFields };
}

async function deleteGrowth(id) {
  if (useCloud()) return callCloud('deleteGrowth', { id });
  const data = localStore.read();
  const originalLength = data.growthRecords.length;
  data.growthRecords = data.growthRecords.filter(record => record.id !== id);
  if (data.growthRecords.length === originalLength) throw new Error('没有找到这条记录');
  localStore.write(data);
  return { id };
}

async function getProfile() {
  if (useCloud()) return callCloud('getProfile');
  const data = localStore.read();
  return { mode: 'demo', baby: data.baby, babyInitial: data.baby.name.slice(0, 1), members: data.members.map(member => ({ ...member, initial: member.nickname.slice(0, 1) })), reminder: data.reminder, currentRole: 'admin' };
}

async function updateBaby(payload) {
  if (useCloud()) return callCloud('updateBaby', payload);
  const data = localStore.read();
  data.baby = { ...data.baby, ...payload };
  localStore.write(data);
  return data.baby;
}

async function updateMemberRole(id, role) {
  if (useCloud()) return callCloud('updateMemberRole', { id, role });
  const data = localStore.read();
  const member = data.members.find(item => item.id === id);
  if (!member) throw new Error('没有找到该成员');
  member.role = role;
  localStore.write(data);
  return { id, role };
}

async function updateMemberNickname(id, nickname) {
  if (useCloud()) return callCloud('updateMemberNickname', { id, nickname });
  const data = localStore.read();
  const member = data.members.find(item => item.id === id);
  if (!member) throw new Error('没有找到该成员');
  member.nickname = String(nickname || '').trim().slice(0, 12);
  if (!member.nickname) throw new Error('家庭称呼不能为空');
  localStore.write(data);
  return { id, nickname: member.nickname };
}

async function updateReminder(payload) {
  if (useCloud()) return callCloud('updateReminder', payload);
  const data = localStore.read();
  data.reminder = { ...data.reminder, ...payload };
  localStore.write(data);
  return data.reminder;
}

async function createInvite() {
  if (useCloud()) return callCloud('createInvite');
  return { code: 'DEMO2026', expiresAt: '演示模式，不可用于真实加入' };
}

async function createFamily(payload) {
  if (useCloud()) return callCloud('createFamily', payload);
  return { id: 'demo-baby' };
}

async function joinFamily(code) {
  if (useCloud()) return callCloud('joinFamily', { code });
  throw new Error('演示模式无法加入真实家庭，请先配置 CloudBase EnvId');
}

module.exports = {
  useCloud,
  getDashboard,
  listFeedRecords,
  createFeed,
  deleteFeed,
  listGrowthRecords,
  createGrowth,
  deleteGrowth,
  getProfile,
  updateBaby,
  updateMemberRole,
  updateMemberNickname,
  updateReminder,
  createFamily,
  createInvite,
  joinFamily
};
