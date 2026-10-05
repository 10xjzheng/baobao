const repository = require('../../services/repository');

function currentDateTime() {
  const date = new Date();
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return { day, time };
}

Page({
  data: { statusBarHeight: 20, type: 'breast', day: '', time: '', amount: '180', duration: '15', note: '', saving: false },
  onLoad() { const now = currentDateTime(); this.setData({ statusBarHeight: getApp().globalData.layout.statusBarHeight, ...now }); },
  goBack() { wx.navigateBack(); },
  setType(event) { this.setData({ type: event.currentTarget.dataset.type }); },
  updateField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  async save() {
    if (this.data.saving) return;
    const amount = Number(this.data.amount || 0); const duration = Number(this.data.duration || 0);
    if (this.data.type !== 'breast' && (amount < 1 || amount > 1000)) return wx.showToast({ title: '奶量请输入 1–1000 ml', icon: 'none' });
    if (this.data.type !== 'formula' && (duration < 1 || duration > 240)) return wx.showToast({ title: '时长请输入 1–240 分钟', icon: 'none' });
    this.setData({ saving: true });
    try {
      await repository.createFeed({ type: this.data.type, amount: this.data.type === 'breast' ? 0 : amount, duration: this.data.type === 'formula' ? 0 : duration, recordedAt: `${this.data.day} ${this.data.time}`, note: this.data.note.trim() });
      wx.showToast({ title: '记录已保存', icon: 'success' }); setTimeout(() => wx.navigateBack(), 650);
    } catch (error) { wx.showToast({ title: error.message, icon: 'none' }); this.setData({ saving: false }); }
  }
});
