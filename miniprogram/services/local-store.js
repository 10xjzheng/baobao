const STORAGE_KEY = 'baobao_demo_v1';

function dateText(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initialData() {
  const today = dateText();
  return {
    baby: { id: 'demo-baby', name: '乐乐', birthday: dateText(-184), gender: 'girl' },
    members: [
      { id: 'member-mom', nickname: '妈妈', role: 'admin' },
      { id: 'member-dad', nickname: '爸爸', role: 'editor' },
      { id: 'member-grandma', nickname: '外婆', role: 'viewer' }
    ],
    feedRecords: [
      { id: 'feed-1', type: 'formula', amount: 180, duration: 0, recordedAt: `${today} 09:30`, recorderName: '妈妈' },
      { id: 'feed-2', type: 'breast', amount: 0, duration: 15, recordedAt: `${today} 12:10`, recorderName: '爸爸' },
      { id: 'feed-3', type: 'formula', amount: 160, duration: 0, recordedAt: `${today} 16:25`, recorderName: '外婆' }
    ],
    growthRecords: [
      { id: 'growth-1', measuredAt: dateText(-120), weight: 5.9, height: 59.1, headCircumference: 39.2, recorderName: '妈妈' },
      { id: 'growth-2', measuredAt: dateText(-90), weight: 6.25, height: 61.4, headCircumference: 40.1, recorderName: '妈妈' },
      { id: 'growth-3', measuredAt: dateText(-60), weight: 6.62, height: 63.3, headCircumference: 40.8, recorderName: '爸爸' },
      { id: 'growth-4', measuredAt: dateText(-30), weight: 7.02, height: 65.3, headCircumference: 41.6, recorderName: '爸爸' },
      { id: 'growth-5', measuredAt: today, weight: 7.2, height: 66.5, headCircumference: 42, recorderName: '妈妈' }
    ],
    reminder: { enabled: true, intervalMinutes: 180, advanceMinutes: 10, quietStart: '22:00', quietEnd: '07:00' }
  };
}

function read() {
  const stored = wx.getStorageSync(STORAGE_KEY);
  if (stored) return stored;
  const data = initialData();
  wx.setStorageSync(STORAGE_KEY, data);
  return data;
}

function write(data) {
  wx.setStorageSync(STORAGE_KEY, data);
  return data;
}

module.exports = { read, write, dateText };
