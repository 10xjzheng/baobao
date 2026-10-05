const repository = require('../../services/repository');
const localStore = require('../../services/local-store');

Page({
  data: { statusBarHeight: 20, measuredAt: '', weight: '', height: '', headCircumference: '', note: '', saving: false },
  onLoad() { this.setData({ statusBarHeight: getApp().globalData.layout.statusBarHeight, measuredAt: localStore.dateText() }); },
  goBack() { wx.navigateBack(); },
  updateField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  async save() {
    if (this.data.saving) return;
    const values = { weight: this.data.weight === '' ? null : Number(this.data.weight), height: this.data.height === '' ? null : Number(this.data.height), headCircumference: this.data.headCircumference === '' ? null : Number(this.data.headCircumference) };
    if (Object.values(values).every(value => value === null)) return wx.showToast({ title: '请至少填写一个指标', icon: 'none' });
    if (values.weight !== null && (values.weight < .1 || values.weight > 100)) return wx.showToast({ title: '体重范围为 0.1–100 kg', icon: 'none' });
    if (values.height !== null && (values.height < 10 || values.height > 250)) return wx.showToast({ title: '身高范围为 10–250 cm', icon: 'none' });
    if (values.headCircumference !== null && (values.headCircumference < 10 || values.headCircumference > 100)) return wx.showToast({ title: '头围范围为 10–100 cm', icon: 'none' });
    this.setData({ saving: true });
    try {
      const result = await repository.createGrowth({ measuredAt: this.data.measuredAt, ...values, note: this.data.note.trim() });
      wx.showToast({ title: result.inheritedFields && result.inheritedFields.length ? '已补齐并保存' : '成长曲线已更新', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 650);
    }
    catch (error) { wx.showToast({ title: error.message, icon: 'none' }); this.setData({ saving: false }); }
  }
});
