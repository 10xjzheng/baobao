const repository = require('../../services/repository');

Page({
  data: { statusBarHeight: 20, name: '', birthday: '', gender: 'unknown', saving: false },
  onLoad() { this.setData({ statusBarHeight: getApp().globalData.layout.statusBarHeight }); this.loadBaby(); },
  async loadBaby() { try { const profile = await repository.getProfile(); this.setData({ name: profile.baby.name || '', birthday: profile.baby.birthday || '', gender: profile.baby.gender || 'unknown' }); } catch (error) { wx.showToast({ title: error.message, icon: 'none' }); } },
  goBack() { wx.navigateBack(); },
  updateField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  setGender(event) { this.setData({ gender: event.currentTarget.dataset.gender }); },
  async save() {
    const name = this.data.name.trim();
    if (!name) return wx.showToast({ title: '请填写宝宝昵称', icon: 'none' });
    this.setData({ saving: true });
    try { await repository.updateBaby({ name, birthday: this.data.birthday, gender: this.data.gender }); wx.showToast({ title: '宝宝档案已保存', icon: 'success' }); setTimeout(() => wx.navigateBack(), 650); }
    catch (error) { wx.showToast({ title: error.message, icon: 'none' }); this.setData({ saving: false }); }
  }
});
