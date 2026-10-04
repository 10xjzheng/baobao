const repository = require('../../services/repository');

Page({
  data: { statusBarHeight: 20, loading: true, enabled: false, intervalMinutes: '', advanceMinutes: '', quietStart: '', quietEnd: '', saving: false },
  onLoad() { this.setData({ statusBarHeight: getApp().globalData.layout.statusBarHeight }); this.loadReminder(); },
  async loadReminder() {
    this.setData({ loading: true });
    try {
      const profile = await repository.getProfile();
      this.setData({ ...profile.reminder, loading: false });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '提醒数据加载失败', icon: 'none' });
    }
  },
  goBack() { wx.navigateBack(); },
  toggle(event) { this.setData({ enabled: event.detail.value }); },
  updateField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  async save() {
    if (this.data.loading) return;
    if (this.data.intervalMinutes === '' || this.data.advanceMinutes === '' || !this.data.quietStart || !this.data.quietEnd) {
      return wx.showToast({ title: '请先补全提醒设置', icon: 'none' });
    }
    this.setData({ saving: true });
    try { await repository.updateReminder({ enabled: this.data.enabled, intervalMinutes: Number(this.data.intervalMinutes), advanceMinutes: Number(this.data.advanceMinutes), quietStart: this.data.quietStart, quietEnd: this.data.quietEnd }); wx.showToast({ title: '提醒设置已保存', icon: 'success' }); }
    catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
    finally { this.setData({ saving: false }); }
  }
});
